-- Isolated write preview. The migrated snapshot remains the read baseline.
create schema controlquest_write_preview;
revoke all on schema controlquest_write_preview from public, anon, authenticated, service_role;
grant usage on schema controlquest_write_preview to authenticated;

create table controlquest_write_preview.records (
    user_id text not null,
    collection text not null check (collection in ('studyProgress', 'studyReviews')),
    document_id text not null,
    data jsonb not null,
    primary key (user_id, collection, document_id)
);

create table controlquest_write_preview.receipts (
    user_id text not null,
    operation_id text not null,
    changes jsonb not null,
    primary key (user_id, operation_id)
);

revoke all on all tables in schema controlquest_write_preview from public, anon, authenticated, service_role;
grant select, insert, update on controlquest_write_preview.records to authenticated;
grant select, insert on controlquest_write_preview.receipts to authenticated;
alter table controlquest_write_preview.records enable row level security;
alter table controlquest_write_preview.receipts enable row level security;

create policy own_preview_records on controlquest_write_preview.records
to authenticated
using (
    user_id = (select public.controlquest_firebase_uid())
    and (select auth.jwt()->'controlquest_write_preview') = 'true'::jsonb
);

create policy own_preview_receipts on controlquest_write_preview.receipts
to authenticated
using (
    user_id = (select public.controlquest_firebase_uid())
    and (select auth.jwt()->'controlquest_write_preview') = 'true'::jsonb
);

-- Expected and replacement values are supplied together so a stale offline
-- operation fails atomically. A successful retry never reapplies an old write.
create function public.controlquest_preview_save_study(operation_id text, changes jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    uid text := public.controlquest_firebase_uid();
    prior_changes jsonb;
    change jsonb;
    bucket text;
    doc_id text;
    current_data jsonb;
    next_data jsonb;
    record_type text;
    old_quiz jsonb;
    new_quiz jsonb;
    quiz_key text;
    previous_revision integer;
begin
    if uid is null or (auth.jwt()->'controlquest_write_preview') is distinct from 'true'::jsonb then
        raise exception using errcode = '42501', message = 'Study write preview access is required';
    end if;
    if operation_id is null or char_length(operation_id) not between 1 and 250
        or jsonb_typeof(changes) is distinct from 'array'
    then
        raise exception using errcode = '22023', message = 'Invalid study operation';
    end if;
    if jsonb_array_length(changes) not between 1 and 100 or octet_length(changes::text) > 1000000 then
        raise exception using errcode = '22023', message = 'Study operation exceeds preview limits';
    end if;
    if exists (
        select 1 from jsonb_array_elements(changes) entry
        group by entry->>'collection', entry->>'id' having count(*) > 1
    ) then
        raise exception using errcode = '22023', message = 'Duplicate study records in one operation';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('controlquest-study:' || uid, 0));
    select r.changes into prior_changes
    from controlquest_write_preview.receipts r
    where r.user_id = uid and r.operation_id = controlquest_preview_save_study.operation_id;
    if found then
        if prior_changes is distinct from changes then
            raise exception using errcode = '23505', message = 'Study operation ID was already used';
        end if;
        return jsonb_build_object('operationId', operation_id, 'status', 'already_saved');
    end if;

    for change in select value from jsonb_array_elements(changes) loop
        bucket := change->>'collection';
        doc_id := change->>'id';
        next_data := change->'data';
        record_type := coalesce(next_data->>'recordType', 'study-review');
        if bucket is null or bucket not in ('studyProgress', 'studyReviews')
            or doc_id is null or char_length(doc_id) not between 1 and 512 or strpos(doc_id, '/') > 0
            or not (change ? 'expected') or jsonb_typeof(next_data) is distinct from 'object'
            or next_data->>'uid' is distinct from uid or next_data->>'id' is distinct from doc_id
            or (bucket = 'studyReviews' and record_type not in ('study-review', 'homework-completion', 'homework-quiz'))
        then
            raise exception using errcode = '22023', message = 'Invalid personal study record';
        end if;

        select r.data into current_data
        from controlquest_write_preview.records r
        where r.user_id = uid and r.collection = bucket and r.document_id = doc_id;
        if not found then
            select d.data into current_data from public.controlquest_documents d
            where d.path = 'users/' || uid || '/' || bucket || '/' || doc_id;
        end if;
        if current_data is distinct from nullif(change->'expected', 'null'::jsonb) then
            raise exception using errcode = '40001', message = 'The study record changed. Reload before retrying.';
        end if;
        if bucket = 'studyReviews' and current_data is not null and (
            coalesce(current_data->>'recordType', 'study-review') <> record_type
            or record_type = 'study-review'
        ) then
            raise exception using errcode = '22023', message = 'Existing study event records are immutable';
        end if;
        if bucket = 'studyReviews' and record_type like 'homework-%' then
            quiz_key := next_data->>'key';
            if quiz_key is null or quiz_key !~ '^[-a-zA-Z0-9_]+$'
                or doc_id <> replace(record_type, '-', '_') || '_' || quiz_key
                or jsonb_typeof(next_data->'value') is distinct from 'object'
            then
                raise exception using errcode = '22023', message = 'Invalid homework record';
            end if;
        end if;
        if bucket = 'studyReviews' and record_type = 'homework-quiz' then
            old_quiz := current_data->'value';
            new_quiz := next_data->'value';
            previous_revision := coalesce((old_quiz->>'_revision')::integer, 0);
            if new_quiz->>'uid' is distinct from uid or new_quiz->>'weekId' is distinct from quiz_key
                or nullif(new_quiz->>'id', '') is null
                or coalesce(new_quiz->>'status', '') not in ('active', 'submitted')
                or new_quiz->'_revision' is distinct from to_jsonb(previous_revision + 1)
                or (old_quiz is null and new_quiz->>'status' <> 'active')
                or (old_quiz is not null and (
                    old_quiz->>'status' = 'submitted'
                    or old_quiz->>'result' is not null
                    or old_quiz - array['answers','status','result','submittedAt','_revision']
                        is distinct from new_quiz - array['answers','status','result','submittedAt','_revision']
                ))
            then
                raise exception using errcode = '22023', message = 'Invalid quiz revision or attempt change';
            end if;
        end if;

        insert into controlquest_write_preview.records (user_id, collection, document_id, data)
        values (uid, bucket, doc_id, next_data)
        on conflict (user_id, collection, document_id) do update set data = excluded.data;
    end loop;
    insert into controlquest_write_preview.receipts (user_id, operation_id, changes)
    values (uid, controlquest_preview_save_study.operation_id, changes);
    return jsonb_build_object('operationId', operation_id, 'status', 'saved');
end;
$$;

revoke all on function public.controlquest_preview_save_study(text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.controlquest_preview_save_study(text, jsonb) to authenticated;

create function public.controlquest_preview_load_study_record(bucket text, doc_id text)
returns jsonb
language sql
stable
set search_path = ''
as $$
    select case when auth.jwt()->'controlquest_write_preview' = 'true'::jsonb
        and bucket in ('studyProgress', 'studyReviews')
        and char_length(doc_id) between 1 and 512 and strpos(doc_id, '/') = 0
    then coalesce(
        (select data from controlquest_write_preview.records
         where user_id = public.controlquest_firebase_uid() and collection = bucket and document_id = doc_id),
        (select data from public.controlquest_documents
         where path = 'users/' || public.controlquest_firebase_uid() || '/' || bucket || '/' || doc_id)
    ) end;
$$;

revoke all on function public.controlquest_preview_load_study_record(text, text) from public, anon, authenticated, service_role;
grant execute on function public.controlquest_preview_load_study_record(text, text) to authenticated;
