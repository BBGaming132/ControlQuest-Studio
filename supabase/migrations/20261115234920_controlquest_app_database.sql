create schema controlquest_app;
revoke all on schema controlquest_app from public, anon, authenticated, service_role;
grant usage on schema controlquest_app to anon, authenticated;
grant execute on function public.controlquest_firebase_uid() to anon;

create table controlquest_app.profile_backups (
    user_id text not null,
    backup_id text not null,
    data jsonb not null,
    primary key (user_id, backup_id)
);
alter table controlquest_app.profile_backups enable row level security;
revoke all on controlquest_app.profile_backups from public, anon, authenticated, service_role;

create function controlquest_app.can_read(uid text, document_path text)
returns boolean language sql stable set search_path = '' as $$
    select coalesce(case split_part(document_path, '/', 1)
        when 'users' then split_part(document_path, '/', 2) = uid
        when 'groups' then exists (
            select 1 from public.controlquest_guild_members
            where user_id = uid and guild_id = split_part(document_path, '/', 2)
        )
        else split_part(document_path, '/', 1) in (
            'publicStudyCards','publicStudyDecks','publicLessonContributions','publicLessonStatus'
        )
    end, false) and uid is not null;
$$;

create function controlquest_app.read_rows(location text, single_document boolean, after_path text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid text := public.controlquest_firebase_uid();
begin
    if uid is null then raise exception using errcode='42501', message='Sign in to ControlQuest'; end if;
    return coalesce((
        select jsonb_agg(jsonb_build_object('path', r.path, 'data', r.data, 'revision', md5(r.data::text))
            order by r.path)
        from (
            select d.path, d.data from public.controlquest_documents d
            where (case when single_document then d.path = location else d.collection_path = location end)
                and (after_path is null or d.path > after_path)
                and controlquest_app.can_read(uid, d.path)
            order by d.path limit 100
        ) r
    ), '[]'::jsonb);
end;
$$;

create function controlquest_app.merge_fields(original jsonb, patch jsonb, deep boolean)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare item record; prior jsonb; value jsonb;
begin
    original := coalesce(original, '{}'::jsonb);
    for item in select key, jsonb_each.value from jsonb_each(patch) loop
        prior := original->item.key;
        value := item.value;
        if jsonb_typeof(value) = 'object' and value->>'__cqArray' in ('union','remove') then
            prior := case when jsonb_typeof(prior) = 'array' then prior else '[]'::jsonb end;
            if value->>'__cqArray' = 'remove' then
                select coalesce(jsonb_agg(a.val order by a.position),'[]'::jsonb) into value
                from jsonb_array_elements(prior) with ordinality a(val,position)
                where not value->'items' @> jsonb_build_array(a.val);
            else
                for value in select item_value from jsonb_array_elements(item.value->'items') item_value loop
                    if not prior @> jsonb_build_array(value) then prior := prior || jsonb_build_array(value); end if;
                end loop;
                value := prior;
            end if;
        elsif deep and jsonb_typeof(value) = 'object' and value <> '{}'::jsonb then
            value := controlquest_app.merge_fields(
                case when jsonb_typeof(prior) = 'object' then prior else '{}'::jsonb end, value, true
            );
        end if;
        original := jsonb_set(original, array[item.key], value);
    end loop;
    return original;
end;
$$;

create function controlquest_app.write_batch(operations jsonb, expected jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
    uid text := public.controlquest_firebase_uid();
    item record;
    operation jsonb;
    document_path text;
    root text;
    scope_id text;
    operation_kind text;
    previous jsonb;
    payload jsonb;
    next_data jsonb;
    members jsonb;
begin
    if uid is null then raise exception using errcode='42501', message='Sign in to ControlQuest'; end if;
    if jsonb_typeof(operations) is distinct from 'array' or jsonb_typeof(expected) is distinct from 'object' then
        raise exception using errcode='22023', message='Invalid ControlQuest batch';
    end if;
    if jsonb_array_length(operations) > 350 or octet_length(operations::text) > 8000000 then
        raise exception using errcode='22023', message='ControlQuest batch is too large';
    end if;
    -- All library writers and invitation joins share the same short lock. This
    -- keeps expected reads, mutations and membership changes in one order.
    perform pg_advisory_xact_lock(2450653220);
    for item in select * from jsonb_each(expected) loop
        select md5(data::text) into document_path from public.controlquest_documents
        where path = item.key and controlquest_app.can_read(uid, path);
        if document_path is distinct from (item.value #>> '{}') then
            raise exception using errcode='40001', message='The record changed on another device';
        end if;
    end loop;
    for operation in select value from jsonb_array_elements(operations) loop
        document_path := operation->>'path';
        root := split_part(document_path,'/',1);
        scope_id := split_part(document_path,'/',2);
        operation_kind := operation->>'kind';
        payload := operation->'data';
        if document_path is null or length(document_path) > 1800 or scope_id = ''
            or coalesce(operation_kind,'') not in ('set','merge','replaceFields','update','delete')
            or (operation_kind <> 'delete' and jsonb_typeof(payload) is distinct from 'object')
        then raise exception using errcode='22023', message='Invalid ControlQuest document operation'; end if;
        select data into previous from public.controlquest_documents where path = document_path;

        if root = 'deletedProfiles' then
            if scope_id <> uid or operation_kind <> 'set' or document_path !~ '^deletedProfiles/[^/]+/backups/[^/]+$'
                or payload #>> '{profile,uid}' is distinct from uid
            then raise exception using errcode='42501', message='Profile backup permission denied'; end if;
            insert into controlquest_app.profile_backups values (uid,split_part(document_path,'/',4),payload)
            on conflict do nothing;
            continue;
        end if;
        if operation_kind = 'update' and previous is null then
            raise exception using errcode='P0002', message='The document no longer exists';
        end if;
        next_data := case operation_kind
            when 'delete' then null
            when 'set' then payload
            when 'replaceFields' then controlquest_app.merge_fields(previous,payload,false)
            when 'update' then controlquest_app.merge_fields(previous,payload,true)
            else controlquest_app.merge_fields(previous,payload,true)
        end;
        if root = 'users' then
            if scope_id <> uid or (next_data ? 'uid' and next_data->>'uid' is distinct from uid)
                or (next_data ? 'ownerUid' and next_data->>'ownerUid' is distinct from uid)
            then raise exception using errcode='42501', message='Personal record permission denied'; end if;
        elsif root = 'groups' then
            if document_path = 'groups/' || scope_id then
                if previous is null then
                    if next_data->>'ownerUid' is distinct from uid or next_data->>'id' is distinct from scope_id
                        or next_data #>> array['members',uid,'uid'] is distinct from uid
                    then raise exception using errcode='42501', message='Guild creator permission denied'; end if;
                    next_data := jsonb_set(next_data,'{members}',jsonb_build_object(uid,next_data #> array['members',uid]));
                    insert into public.controlquest_guild_members values (scope_id,uid);
                else
                    if not controlquest_app.can_read(uid,document_path) or next_data is null
                        or next_data->>'ownerUid' is distinct from previous->>'ownerUid'
                        or next_data->>'code' is distinct from previous->>'code'
                        or next_data->>'id' is distinct from scope_id
                    then raise exception using errcode='42501', message='Guild permission denied'; end if;
                    members := coalesce(previous->'members','{}'::jsonb);
                    if next_data #>> array['members',uid,'uid'] = uid then
                        members := jsonb_set(members,array[uid],next_data #> array['members',uid]);
                    end if;
                    next_data := jsonb_set(next_data,'{members}',members);
                end if;
            elsif not controlquest_app.can_read(uid,document_path) then
                raise exception using errcode='42501', message='Guild membership required';
            end if;
        elsif root in ('publicStudyCards','publicStudyDecks','publicLessonContributions') then
            if (previous is not null and previous->>'ownerUid' is distinct from uid)
                or (next_data is not null and next_data->>'ownerUid' is distinct from uid)
            then raise exception using errcode='42501', message='Contribution owner permission denied'; end if;
            if root = 'publicLessonContributions' and next_data is not null and (
                next_data->>'id' is distinct from scope_id
                or coalesce(next_data->>'lessonId','') !~ '^(d[1-5]-t[0-9]{2}|pe-[1-3])$'
                or (next_data - array['id','ownerUid','contributorName','sourceKey','sourceTitle','sourceUploader','lessonId','fingerprint','identity','question','choices','correctAnswer','justifications','source','updatedAt']) <> '{}'::jsonb
            ) then raise exception using errcode='22023', message='Invalid lesson contribution'; end if;
        elsif root = 'publicLessonStatus' then
            if next_data is null or next_data->>'updatedBy' is distinct from uid
                or scope_id !~ '^(d[1-5]-t[0-9]{2}|pe-[1-3])$'
                or jsonb_typeof(next_data->'completed') is distinct from 'boolean'
                or (next_data - array['completed','updatedBy','updatedByName','updatedAt']) <> '{}'::jsonb
            then raise exception using errcode='42501', message='Invalid lesson status'; end if;
        else
            raise exception using errcode='42501', message='Unknown ControlQuest collection';
        end if;
        if next_data is null then
            delete from public.controlquest_documents where path = document_path;
        else
            insert into public.controlquest_documents (path,data) values (document_path,next_data)
            on conflict (path) do update set data = excluded.data;
        end if;
    end loop;
end;
$$;

create function controlquest_app.join_guild(guild text, invite text, summary jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid text := public.controlquest_firebase_uid(); group_data jsonb;
begin
    if uid is null or guild is null or guild !~ '^[^/]+$' or summary->>'uid' is distinct from uid then
        raise exception using errcode='42501', message='Sign in to join a Guild';
    end if;
    perform pg_advisory_xact_lock(2450653220);
    select data into group_data from public.controlquest_documents where path = 'groups/' || guild;
    if nullif(invite,'') is null or group_data->>'code' is distinct from invite then return null; end if;
    insert into public.controlquest_guild_members values (guild,uid) on conflict do nothing;
    group_data := jsonb_set(group_data,'{members}',coalesce(group_data->'members','{}'::jsonb) || jsonb_build_object(uid,summary));
    update public.controlquest_documents set data = group_data where path = 'groups/' || guild;
    return group_data;
end;
$$;

revoke all on all functions in schema controlquest_app from public, anon, authenticated, service_role;
grant execute on function controlquest_app.read_rows(text,boolean,text),
    controlquest_app.write_batch(jsonb,jsonb), controlquest_app.join_guild(text,text,jsonb)
to anon, authenticated;

create function public.controlquest_read_rows(location text, single_document boolean, after_path text)
returns jsonb language sql set search_path = '' as $$
    select controlquest_app.read_rows(location,single_document,after_path);
$$;
create function public.controlquest_write_batch(operations jsonb, expected jsonb)
returns void language sql set search_path = '' as $$
    select controlquest_app.write_batch(operations,expected);
$$;
create function public.controlquest_join_guild(guild text, invite text, summary jsonb)
returns jsonb language sql set search_path = '' as $$
    select controlquest_app.join_guild(guild,invite,summary);
$$;
revoke all on function public.controlquest_read_rows(text,boolean,text),
    public.controlquest_write_batch(jsonb,jsonb), public.controlquest_join_guild(text,text,jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.controlquest_read_rows(text,boolean,text),
    public.controlquest_write_batch(jsonb,jsonb), public.controlquest_join_guild(text,text,jsonb)
to anon, authenticated;
