-- Synthetic policy tests. Every fixture is rolled back.
begin;

insert into public.controlquest_documents (path, data) values
    ('users/cq_policy_alex', '{}'),
    ('users/cq_policy_alex/studyReviews/check', '{}'),
    ('users/cq_policy_sam', '{}'),
    ('groups/cq_policy_member', '{}'),
    ('groups/cq_policy_member/studyCards/check', '{}'),
    ('groups/cq_policy_nonmember', '{}'),
    ('publicStudyCards/cq_policy_check', '{}');
insert into public.controlquest_guild_members (guild_id, user_id) values
    ('cq_policy_member', 'cq_policy_alex'),
    ('cq_policy_nonmember', 'cq_policy_sam');

do $$
begin
    if has_table_privilege('anon', 'public.controlquest_documents', 'SELECT')
        or has_table_privilege('authenticated', 'public.controlquest_documents', 'INSERT')
        or has_table_privilege('authenticated', 'public.controlquest_documents', 'UPDATE')
        or has_table_privilege('authenticated', 'public.controlquest_documents', 'DELETE')
        or has_table_privilege('authenticated', 'public.controlquest_guild_members', 'INSERT')
        or has_table_privilege('authenticated', 'public.controlquest_guild_members', 'UPDATE')
        or has_table_privilege('authenticated', 'public.controlquest_guild_members', 'DELETE')
    then
        raise exception 'Unexpected grants on the read model';
    end if;
end;
$$;

set local role authenticated;
do $$
declare
    claims jsonb := '{
        "iss": "https://securetoken.google.com/controlquest-studio-18ba7",
        "aud": "controlquest-studio-18ba7",
        "sub": "cq_policy_alex",
        "firebase": {"sign_in_provider": "password"}
    }';
    expected text[] := array[
        'groups/cq_policy_member', 'groups/cq_policy_member/studyCards/check',
        'publicStudyCards/cq_policy_check', 'users/cq_policy_alex', 'users/cq_policy_alex/studyReviews/check'
    ];
    actual text[];
begin
    perform set_config('request.jwt.claims', claims::text, true);
    select array_agg(path order by path collate "C") into actual
      from public.controlquest_documents where position('cq_policy_' in path) > 0;
    if actual is distinct from expected then
        raise exception 'Firebase user saw the wrong set of documents';
    end if;
    if (select count(*) from public.controlquest_guild_members where starts_with(user_id, 'cq_policy_')) <> 1 then
        raise exception 'Firebase user saw the wrong set of Guild memberships';
    end if;

    perform set_config('request.jwt.claims', jsonb_set(claims, '{aud}', '"another-project"')::text, true);
    if exists (select 1 from public.controlquest_documents) then
        raise exception 'A token for another project could see ControlQuest data';
    end if;

    perform set_config('request.jwt.claims', jsonb_set(claims, '{iss}', '"https://another-issuer.example"')::text, true);
    if exists (select 1 from public.controlquest_documents) then
        raise exception 'A token from another issuer could see ControlQuest data';
    end if;

    perform set_config('request.jwt.claims', jsonb_set(claims, '{firebase,sign_in_provider}', '"anonymous"')::text, true);
    if exists (select 1 from public.controlquest_documents) then
        raise exception 'An anonymous Firebase token could see ControlQuest data';
    end if;
end;
$$;

rollback;
