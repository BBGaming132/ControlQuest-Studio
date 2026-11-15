-- Administrators can inspect a verified Firestore snapshot before promoting it.
create function controlquest_migration.decode_firestore_value(encoded jsonb)
returns jsonb
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
    tag text;
    payload jsonb;
begin
    select key, value into strict tag, payload from jsonb_each(encoded);
    case tag
        when 'mapValue' then
            return coalesce((
                select jsonb_object_agg(key, controlquest_migration.decode_firestore_value(value))
                from jsonb_each(coalesce(payload->'fields', '{}'::jsonb))
            ), '{}'::jsonb);
        when 'arrayValue' then
            return coalesce((
                select jsonb_agg(controlquest_migration.decode_firestore_value(value) order by position)
                from jsonb_array_elements(coalesce(payload->'values', '[]'::jsonb)) with ordinality as item(value, position)
            ), '[]'::jsonb);
        when 'integerValue' then
            return to_jsonb((payload #>> '{}')::bigint);
        when 'nullValue', 'booleanValue', 'doubleValue', 'timestampValue', 'stringValue',
             'bytesValue', 'referenceValue', 'geoPointValue' then
            return payload;
        else
            raise exception 'Unsupported Firestore value type: %', tag;
    end case;
end;
$$;

create function controlquest_migration.read_candidate(snapshot_hash text)
returns table (path text, data jsonb)
language plpgsql
stable
set search_path = ''
as $$
declare
    expected_count integer;
    source_row record;
    field record;
    fragment record;
    field_value text;
    chunk text;
begin
    select retained_document_count into expected_count
    from controlquest_migration.snapshots
    where source_sha256 = snapshot_hash and source_project = 'controlquest-studio-18ba7';
    if expected_count is null or expected_count <> (
        select count(*) from controlquest_migration.documents where source_sha256 = snapshot_hash
    ) then
        raise exception 'Complete verified staging snapshot required';
    end if;

    for source_row in
        select d.path, d.document
        from controlquest_migration.documents d
        where d.source_sha256 = snapshot_hash
          and d.document #>> '{fields,recordType,stringValue}' is distinct from 'profile-chunk'
    loop
        path := source_row.path;
        data := controlquest_migration.decode_firestore_value(jsonb_build_object(
            'mapValue', jsonb_build_object('fields', coalesce(source_row.document->'fields','{}'::jsonb))
        ));
        if path ~ '^users/[^/]+$' and data->>'_profileChunks' is not null then
            if data #>> '{_profileChunks,version}' is distinct from '1' then
                raise exception 'Unsupported profile chunk metadata';
            end if;
            for field in select * from jsonb_each(data #> '{_profileChunks,fields}') loop
                field_value := '';
                if field.key in ('__proto__', 'prototype', 'constructor') or jsonb_typeof(field.value) <> 'array'
                    or jsonb_array_length(field.value) = 0
                then
                    raise exception 'Invalid profile chunk field';
                end if;
                for fragment in select value from jsonb_array_elements_text(field.value) loop
                    select d.document #>> '{fields,data,stringValue}' into chunk
                    from controlquest_migration.documents d
                    where d.source_sha256 = snapshot_hash
                      and d.path = source_row.path || '/studyReviews/' || fragment.value
                      and d.document #>> '{fields,recordType,stringValue}' = 'profile-chunk';
                    if chunk is null or fragment.value <> 'profile_chunk_' || encode(sha256(convert_to(chunk,'UTF8')), 'hex') then
                        raise exception 'Profile chunk missing or corrupt';
                    end if;
                    field_value := field_value || chunk;
                end loop;
                data := jsonb_set(data, array[field.key], field_value::jsonb);
            end loop;
        end if;
        if path ~ '^users/[^/]+$' then data := data - '_profileChunks'; end if;
        return next;
    end loop;
end;
$$;

revoke all on function controlquest_migration.decode_firestore_value(jsonb),
    controlquest_migration.read_candidate(text) from public, anon, authenticated, service_role;

-- This refreshes the read preview. Calling it does not switch the live app.
create function controlquest_migration.refresh_read_model(snapshot_hash text, earliest_read_time timestamptz)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    candidate_count integer;
    updated_count integer;
    deleted_count integer;
    memberships_count integer;
begin
    if earliest_read_time is null or not exists (
        select 1 from controlquest_migration.snapshots
        where source_sha256 = snapshot_hash and source_read_time >= earliest_read_time
    ) then
        raise exception 'The snapshot predates the requested refresh window';
    end if;

    lock table public.controlquest_documents, public.controlquest_guild_members in share row exclusive mode;
    create temporary table controlquest_refresh_candidate on commit drop as
    select path, data from controlquest_migration.read_candidate(snapshot_hash)
    where (
        path ~ '^(users|groups)/[^/]+$'
        or path ~ '^users/[^/]+/(studyCards|studyDecks|studyProgress|studyReviews)/[^/]+$'
        or path ~ '^groups/[^/]+/(studyCards|studyDecks)/[^/]+$'
        or path ~ '^(publicStudyCards|publicStudyDecks|publicLessonContributions|publicLessonStatus)/[^/]+$'
    );

    if not exists (select 1 from pg_temp.controlquest_refresh_candidate where path ~ '^users/[^/]+$') then
        raise exception 'The verified snapshot contains no learner profiles';
    end if;

    select count(*) into candidate_count from pg_temp.controlquest_refresh_candidate;
    insert into public.controlquest_documents as live (path, data)
    select path, data from pg_temp.controlquest_refresh_candidate
    on conflict (path) do update set data = excluded.data where live.data is distinct from excluded.data;
    get diagnostics updated_count = row_count;

    delete from public.controlquest_documents live
    where not exists (select 1 from pg_temp.controlquest_refresh_candidate c where c.path = live.path);
    get diagnostics deleted_count = row_count;

    delete from public.controlquest_guild_members;
    insert into public.controlquest_guild_members (guild_id, user_id)
    select split_part(guild.path, '/', 2), member.key
    from pg_temp.controlquest_refresh_candidate guild
    cross join lateral jsonb_each(
        case when jsonb_typeof(guild.data->'members') = 'object' then guild.data->'members' else '{}'::jsonb end
    ) member
    join pg_temp.controlquest_refresh_candidate profile on profile.path = 'users/' || member.key
    where guild.path ~ '^groups/[^/]+$' and member.value->>'uid' = member.key;
    get diagnostics memberships_count = row_count;

    return jsonb_build_object(
        'documents', candidate_count, 'insertedOrUpdated', updated_count, 'deleted', deleted_count,
        'guildMemberships', memberships_count
    );
end;
$$;

revoke all on function controlquest_migration.refresh_read_model(text, timestamptz)
from public, anon, authenticated, service_role;
