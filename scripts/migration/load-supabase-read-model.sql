-- Run as a database administrator against the dedicated ControlQuest project.
-- Load the previously validated, decoded staging snapshot into the read model once.
begin;

lock table public.controlquest_documents, public.controlquest_guild_members in share row exclusive mode;

do $$
begin
    if not exists (select 1 from cq_migration.documents where path ~ '^users/[^/]+$')
        or exists (select 1 from cq_migration.documents where path ~ '^users/[^/]+$' and data ? '_profileChunks')
    then
        raise exception 'Expected verified, hydrated ControlQuest staging profiles';
    end if;

    if exists (select 1 from public.controlquest_documents)
        or exists (select 1 from public.controlquest_guild_members)
    then
        raise exception 'The read model already contains data';
    end if;
end;
$$;

insert into public.controlquest_documents (path, data)
select path, data
from cq_migration.documents
where (
    path ~ '^(users|groups)/[^/]+$'
    or path ~ '^users/[^/]+/(studyCards|studyDecks|studyProgress|studyReviews)/[^/]+$'
    or path ~ '^groups/[^/]+/(studyCards|studyDecks)/[^/]+$'
    or path ~ '^(publicStudyCards|publicStudyDecks|publicLessonContributions|publicLessonStatus)/[^/]+$'
)
and data->>'recordType' is distinct from 'profile-chunk'
and raw_document #>> '{fields,recordType,stringValue}' is distinct from 'profile-chunk';

-- A group with no recorded owner still has members. Owner privileges must be
-- resolved separately. Only explicit, consistent membership entries are copied.
insert into public.controlquest_guild_members (guild_id, user_id)
select split_part(groups.path, '/', 2), member.key
from cq_migration.documents groups
cross join lateral jsonb_each(
    case when jsonb_typeof(groups.data->'members') = 'object'
        then groups.data->'members' else '{}'::jsonb end
) member
join public.controlquest_documents profiles on profiles.path = 'users/' || member.key
where groups.path ~ '^groups/[^/]+$' and member.value->>'uid' = member.key;

commit;
