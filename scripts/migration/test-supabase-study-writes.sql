-- Run in a transaction. All test data must be rolled back by the runner.
set local role authenticated;

do $$
declare
    claims jsonb := '{
        "iss":"https://securetoken.google.com/controlquest-studio-18ba7",
        "aud":"controlquest-studio-18ba7",
        "sub":"cq_write_test",
        "firebase":{"sign_in_provider":"password"}
    }';
    progress jsonb := '{"uid":"cq_write_test","id":"progress-test","repetitions":1}';
    review jsonb := '{"uid":"cq_write_test","id":"review-test","rating":"Good"}';
    quiz jsonb := '{"uid":"cq_write_test","id":"homework_quiz_week-1","key":"week-1","recordType":"homework-quiz","value":{"uid":"cq_write_test","id":"quiz-test","weekId":"week-1","status":"active","_revision":1}}';
    completion jsonb := '{"uid":"cq_write_test","id":"homework_completion_d1-t01","key":"d1-t01","recordType":"homework-completion","value":{"lessonId":"d1-t01","completedAt":"2026-11-15T20:00:00Z"}}';
    submitted jsonb;
    change_set jsonb;
    result jsonb;
begin
    change_set := jsonb_build_array(
        jsonb_build_object('collection','studyProgress','id','progress-test','expected',null,'data',progress),
        jsonb_build_object('collection','studyReviews','id','review-test','expected',null,'data',review)
    );
    perform set_config('request.jwt.claims', claims::text, true);
    begin
        perform public.controlquest_preview_save_study('review-op', change_set);
        raise exception 'Missing preview claim allowed a write';
    exception when insufficient_privilege then null;
    end;

    claims := claims || '{"controlquest_write_preview":true}';
    perform set_config('request.jwt.claims', claims::text, true);
    result := public.controlquest_preview_save_study('review-op', change_set);
    if result->>'status' <> 'saved' then raise exception 'Review was not saved'; end if;
    result := public.controlquest_preview_save_study('review-op', change_set);
    if result->>'status' <> 'already_saved' then raise exception 'Review replay was not recognized'; end if;

    begin
        perform public.controlquest_preview_save_study('review-op', jsonb_build_array(change_set->0));
        raise exception 'A changed replay payload was accepted';
    exception when unique_violation then null;
    end;
    begin
        perform public.controlquest_preview_save_study('stale-op', jsonb_build_array(
            jsonb_build_object('collection','studyReviews','id','atomic-test','expected',null,
                'data',jsonb_set(review,'{id}','"atomic-test"')),
            change_set->0
        ));
        raise exception 'Stale progress overwrote saved progress';
    exception when serialization_failure then null;
    end;
    if public.controlquest_preview_load_study_record('studyReviews','atomic-test') is not null
        or public.controlquest_preview_load_study_record('studyProgress','progress-test') is distinct from progress
        or public.controlquest_preview_load_study_record('studyReviews','review-test') is distinct from review
    then raise exception 'Atomic review persistence failed'; end if;

    perform public.controlquest_preview_save_study('quiz-start', jsonb_build_array(
        jsonb_build_object('collection','studyReviews','id',quiz->>'id','expected',null,'data',quiz)
    ));
    perform public.controlquest_preview_save_study('completion-op', jsonb_build_array(
        jsonb_build_object('collection','studyReviews','id',completion->>'id','expected',null,'data',completion)
    ));
    if public.controlquest_preview_load_study_record('studyReviews',completion->>'id') is distinct from completion
    then raise exception 'Homework completion evidence did not survive reload'; end if;
    submitted := jsonb_set(jsonb_set(quiz,'{value,status}','"submitted"'),'{value,_revision}','2');
    perform public.controlquest_preview_save_study('quiz-submit', jsonb_build_array(
        jsonb_build_object('collection','studyReviews','id',quiz->>'id','expected',quiz,'data',submitted)
    ));
    begin
        perform public.controlquest_preview_save_study('quiz-reopen', jsonb_build_array(
            jsonb_build_object('collection','studyReviews','id',quiz->>'id','expected',submitted,
                'data',jsonb_set(quiz,'{value,_revision}','3'))
        ));
        raise exception 'A submitted quiz was reopened';
    exception when invalid_parameter_value then null;
    end;

    perform set_config('request.jwt.claims', jsonb_set(claims,'{sub}','"cq_other_write_test"')::text, true);
    if public.controlquest_preview_load_study_record('studyReviews','review-test') is not null
    then raise exception 'A second account could read the first account’s review'; end if;
    begin
        perform public.controlquest_preview_save_study('cross-account', change_set);
        raise exception 'Cross-account write was accepted';
    exception when invalid_parameter_value then null;
    end;
    raise notice 'Study write checks passed';
end;
$$;
