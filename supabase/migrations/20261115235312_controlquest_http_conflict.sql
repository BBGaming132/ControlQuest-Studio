-- The HTTP gateway can wait on SQL serialization failures. Return explicit
-- retryable HTTP conflicts so the client can reread and rerun its reducer.
do $$
declare definition text := pg_get_functiondef('controlquest_app.write_batch(jsonb,jsonb)'::regprocedure);
begin
    if strpos(definition, 'perform pg_advisory_xact_lock(2450653220);') = 0
        or strpos(definition, 'errcode=''40001''') = 0
    then raise exception 'Unexpected write-batch definition'; end if;
    definition := replace(definition, 'perform pg_advisory_xact_lock(2450653220);',
        'if not pg_try_advisory_xact_lock(2450653220) then raise exception using errcode=''PT423'', message=''ControlQuest is saving another update''; end if;');
    execute replace(definition, 'errcode=''40001''', 'errcode=''PT409''');
end;
$$;
