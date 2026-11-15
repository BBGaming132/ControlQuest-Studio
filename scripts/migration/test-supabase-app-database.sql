-- Run in a transaction and roll back the synthetic accounts and Guild.
set local role anon;
do $$
declare
    claims jsonb := '{"iss":"https://securetoken.google.com/controlquest-studio-18ba7","aud":"controlquest-studio-18ba7","sub":"cq_app_test","firebase":{"sign_in_provider":"password"}}';
    group_path text := 'groups/cq_app_test_guild';
    card_path text := 'groups/cq_app_test_guild/studyCards/check';
    profile_path text := 'users/cq_app_test';
    group_doc jsonb := '{"id":"cq_app_test_guild","ownerUid":"cq_app_test","code":"CQTEST","members":{"cq_app_test":{"uid":"cq_app_test"}}}';
    group_rows jsonb;
    rev text;
begin
    begin
        perform public.controlquest_read_rows('users',false,null);
        raise exception 'Public request could read application data';
    exception when insufficient_privilege then null; end;
    perform set_config('request.jwt.claims',claims::text,true);
    perform public.controlquest_write_batch(jsonb_build_array(
        jsonb_build_object('path',profile_path,'kind','set','data','{"uid":"cq_app_test","v3":{"stale":true}}'::jsonb),
        jsonb_build_object('path',group_path,'kind','set','data',group_doc),
        jsonb_build_object('path',card_path,'kind','set','data','{"id":"check","deckIds":["a","b"]}'::jsonb)
    ),'{}');
    perform public.controlquest_write_batch(jsonb_build_array(
        jsonb_build_object('path',profile_path,'kind','replaceFields','data','{"v3":{"new":true}}'::jsonb),
        jsonb_build_object('path',card_path,'kind','merge','data','{"deckIds":{"__cqArray":"union","items":["b","c"]}}'::jsonb)
    ),'{}');
    if public.controlquest_read_rows(profile_path,true,null) #> '{0,data,v3}' <> '{"new":true}'::jsonb then
        raise exception 'Profile nested replacement did not work';
    end if;
    perform public.controlquest_write_batch(jsonb_build_array(
        jsonb_build_object('path',card_path,'kind','update','data','{"deckIds":{"__cqArray":"remove","items":["b"]}}'::jsonb)
    ),'{}');
    if public.controlquest_read_rows(card_path,true,null) #> '{0,data,deckIds}' is distinct from '["a","c"]'::jsonb then
        raise exception 'Card array transforms did not work';
    end if;
    group_rows := public.controlquest_read_rows(group_path,true,null);
    rev := group_rows #>> '{0,revision}';
    perform public.controlquest_write_batch(jsonb_build_array(
        jsonb_build_object('path',group_path,'kind','update','data','{"lessonStatus":{"d1-t01":true}}'::jsonb)
    ),jsonb_build_object(group_path,rev));
    begin
        perform public.controlquest_write_batch(jsonb_build_array(
            jsonb_build_object('path',group_path,'kind','update','data','{"lessonStatus":{"d1-t01":false}}'::jsonb)
        ),jsonb_build_object(group_path,rev));
        raise exception 'A stale transaction was accepted';
    exception when sqlstate 'PT409' then null; end;
    perform set_config('request.jwt.claims',jsonb_set(claims,'{sub}','"cq_app_test_member"')::text,true);
    if public.controlquest_read_rows(group_path,true,null) <> '[]'::jsonb
        or public.controlquest_read_rows(profile_path,true,null) <> '[]'::jsonb
        or public.controlquest_join_guild('cq_app_test_guild','wrong','{"uid":"cq_app_test_member"}') is not null
    then raise exception 'Non-member privacy check failed'; end if;
    if public.controlquest_join_guild('cq_app_test_guild','CQTEST','{"uid":"cq_app_test_member"}') is null
        or jsonb_array_length(public.controlquest_read_rows('groups/cq_app_test_guild/studyCards',false,null)) <> 1
    then raise exception 'Valid invite did not grant Guild library access'; end if;
    begin
        perform public.controlquest_write_batch(jsonb_build_array(
            jsonb_build_object('path',profile_path,'kind','delete')
        ),'{}');
        raise exception 'Another learner could delete the profile';
    exception when insufficient_privilege then null; end;
end;
$$;
