-- Subscription checks return one short token, never the full question bank.
alter table public.controlquest_documents
add column revision text generated always as (md5(data::text)) stored;

create function controlquest_app.location_revision(location text, single_document boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare uid text := public.controlquest_firebase_uid();
begin
    if uid is null then raise exception using errcode='42501', message='Sign in to ControlQuest'; end if;
    if single_document then
        return (select revision from public.controlquest_documents
            where path = location and controlquest_app.can_read(uid,path));
    end if;
    return (select md5(string_agg(revision, '' order by path))
        from public.controlquest_documents
        where collection_path = location and controlquest_app.can_read(uid,path));
end;
$$;
revoke all on function controlquest_app.location_revision(text,boolean) from public, anon, authenticated, service_role;
grant execute on function controlquest_app.location_revision(text,boolean) to anon, authenticated;

create function public.controlquest_location_revision(location text, single_document boolean)
returns text language sql set search_path = '' as $$
    select controlquest_app.location_revision(location,single_document);
$$;
revoke all on function public.controlquest_location_revision(text,boolean) from public, anon, authenticated, service_role;
grant execute on function public.controlquest_location_revision(text,boolean) to anon, authenticated;
