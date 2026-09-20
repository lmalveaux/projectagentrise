-- Run after schema.sql. Only the trusted Agent Rise platform may execute this.
create or replace function public.complete_automation_job(job_id uuid, result jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare j public.automation_jobs; p public.prospects; label text; call_id uuid; ndate date;
begin
 select * into j from public.automation_jobs where id=job_id;
 if not found then raise exception 'Unknown job'; end if;
 -- Use the same lock order as snapshot saving: agent, then job/prospect.
 perform 1 from public.agents where id=j.agent_id for update;
 select * into j from public.automation_jobs where id=job_id for update;
 if j.completed_at is not null then return; end if;
 select * into p from public.prospects where id=j.prospect_id and agent_id=j.agent_id;
 if not found then raise exception 'Prospect no longer exists'; end if;
 label=case result->>'outcome' when 'confirmed' then 'Appointment Confirmed' when 'rescheduled' then 'Rescheduled' when 'declined' then 'Declined' when 'no_answer' then 'No Answer' when 'voicemail' then 'Voicemail' when 'callback' then 'Callback Requested' when 'failed' then 'Automation unavailable' else null end;
 if label is null then raise exception 'Invalid result'; end if;
 if result->>'outcome' in ('rescheduled','callback') then
  ndate=nullif(result->>'next_follow_up','')::date;
  if ndate is null then raise exception 'Follow-up date required'; end if;
 end if;
 call_id=gen_random_uuid();
 insert into public.call_log(id,agent_id,prospect_id,direction,phone_number,outcome,duration,notes,called_at,attempt_only,data)
 values(call_id,j.agent_id,p.id,'outbound',p.phone,label,coalesce((result->>'duration')::integer,0),result->>'notes',now(),result->>'outcome'='failed',jsonb_build_object('id',call_id,'prospectId',p.id,'direction','outbound','phoneNumber',p.phone,'outcome',label,'duration',coalesce((result->>'duration')::integer,0),'notes',result->>'notes','calledAt',now(),'attemptOnly',result->>'outcome'='failed'));
 if result->>'outcome'<>'failed' then
  update public.prospects set contact_outcome=label,last_contact=current_date,next_follow_up=coalesce(ndate,next_follow_up),
   status=case when result->>'outcome' in ('confirmed','rescheduled','callback','declined') and status='New Lead' then 'Contacted' else status end,
   updated_at=now(),data=data||jsonb_build_object('contactOutcome',label,'lastContact',current_date,'nextFollowUp',coalesce(ndate,next_follow_up)) where id=p.id and agent_id=j.agent_id;
 end if;
 update public.automation_jobs set status=case when result->>'outcome'='failed' then 'failed' else 'completed' end,completed_at=now(),result=complete_automation_job.result where id=job_id;
 update public.agents set revision=revision+1 where id=j.agent_id;
end $$;
revoke all on function public.complete_automation_job(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.complete_automation_job(uuid,jsonb) to service_role;
