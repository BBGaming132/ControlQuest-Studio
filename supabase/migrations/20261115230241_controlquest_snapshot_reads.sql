create function public.controlquest_firebase_uid()
returns text
language sql
stable
set search_path = ''
as $$
    select case
        when auth.jwt()->>'iss' = 'https://securetoken.google.com/controlquest-studio-18ba7'
          and auth.jwt()->>'aud' = 'controlquest-studio-18ba7'
          and auth.jwt() #>> '{firebase,sign_in_provider}' <> 'anonymous'
        then nullif(auth.jwt()->>'sub', '')
    end;
$$;

revoke all on function public.controlquest_firebase_uid() from public, anon, authenticated, service_role;
grant execute on function public.controlquest_firebase_uid() to authenticated;

create table public.controlquest_guild_members (
    guild_id text not null,
    user_id text not null,
    primary key (user_id, guild_id)
);

create table public.controlquest_documents (
    path text primary key check (
        path ~ '^(users|groups)/[^/]+$'
        or path ~ '^users/[^/]+/(studyCards|studyDecks|studyProgress|studyReviews)/[^/]+$'
        or path ~ '^groups/[^/]+/(studyCards|studyDecks)/[^/]+$'
        or path ~ '^(publicStudyCards|publicStudyDecks|publicLessonContributions|publicLessonStatus)/[^/]+$'
    ),
    collection_path text generated always as (left(path, length(path) - strpos(reverse(path), '/'))) stored,
    user_id text generated always as (
        case when split_part(path, '/', 1) = 'users' then split_part(path, '/', 2) end
    ) stored,
    guild_id text generated always as (
        case when split_part(path, '/', 1) = 'groups' then split_part(path, '/', 2) end
    ) stored,
    data jsonb not null check (jsonb_typeof(data) = 'object')
);

create index controlquest_documents_collection_path_idx on public.controlquest_documents (collection_path, path);

revoke all on public.controlquest_guild_members, public.controlquest_documents
from public, anon, authenticated, service_role;
grant select on public.controlquest_guild_members, public.controlquest_documents to authenticated;

alter table public.controlquest_guild_members enable row level security;
alter table public.controlquest_documents enable row level security;

create policy controlquest_own_memberships on public.controlquest_guild_members
for select to authenticated
using (user_id = (select public.controlquest_firebase_uid()));

create policy controlquest_own_documents on public.controlquest_documents
for select to authenticated
using (user_id = (select public.controlquest_firebase_uid()));

create policy controlquest_member_documents on public.controlquest_documents
for select to authenticated
using (guild_id in (select guild_id from public.controlquest_guild_members));

create policy controlquest_signed_in_public_content on public.controlquest_documents
for select to authenticated
using (
    (select public.controlquest_firebase_uid()) is not null
    and collection_path in ('publicStudyCards', 'publicStudyDecks', 'publicLessonContributions', 'publicLessonStatus')
);
