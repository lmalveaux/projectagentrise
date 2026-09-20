-- Agent Rise complete Supabase installer.
-- Paste this entire file into the Supabase SQL Editor and choose Run once.
-- Safe to re-run after a successful or partially completed installation.

create table if not exists public.agents (
 id uuid primary key references auth.users(id) on delete cascade,
 email text unique, preferred_name text, appearance_theme text default 'default',
 schema_version integer not null default 2, revision bigint not null default 0,
 skip_remove_import_warning boolean not null default false,
 workspace_data jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.agents enable row level security;
-- Repair the partial agents table left by the earlier setup attempt.
alter table public.agents add column if not exists email text;
alter table public.agents add column if not exists preferred_name text;
alter table public.agents add column if not exists appearance_theme text default 'default';
alter table public.agents add column if not exists schema_version integer not null default 2;
alter table public.agents add column if not exists revision bigint not null default 0;
alter table public.agents add column if not exists skip_remove_import_warning boolean not null default false;
alter table public.agents add column if not exists workspace_data jsonb not null default '{}'::jsonb;
alter table public.agents add column if not exists created_at timestamptz not null default now();
create unique index if not exists agents_email_unique on public.agents(email);

drop policy if exists own_agent on public.agents;
drop policy if exists own_agent_select on public.agents;
drop policy if exists own_agent_insert on public.agents;
drop policy if exists own_agent_update on public.agents;
create policy own_agent_select on public.agents for select to authenticated using(id=auth.uid());
create policy own_agent_insert on public.agents for insert to authenticated with check(id=auth.uid());
create policy own_agent_update on public.agents for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create table if not exists public.prospects (
 id uuid primary key default gen_random_uuid(),
 agent_id uuid not null references public.agents(id) on delete cascade,
 first_name text,
 last_name text,
 phone text,
 email text,
 product text,
 status text,
 lead_pool text,
 qualification_status text,
 relationship_category text,
 source text,
 marketing_eligibility text,
 client_status text,
 policy_status text,
 ptc_source text,
 ptc_signed_date date,
 ptc_expiration_date date,
 soa_completed text,
 soa_date date,
 soa_method text,
 carrier_provider text,
 effective_date date,
 closing_date date,
 reason_closed text,
 next_follow_up date,
 last_contact date,
 contact_outcome text,
 service_history text,
 future_opportunity text,
 notes text,
 archived boolean default false,
 appointment_date timestamptz,
 created_at timestamptz default now(),
 updated_at timestamptz default now(),
 data jsonb not null default '{}'::jsonb,
 unique(id,agent_id)
);
alter table public.prospects enable row level security;
drop policy if exists own_prospects on public.prospects;
create policy own_prospects on public.prospects for all to authenticated using(agent_id=auth.uid()) with check(agent_id=auth.uid());
create index if not exists prospects_agent on public.prospects(agent_id);
create index if not exists prospects_next_follow_up on public.prospects(next_follow_up);
create table if not exists public.resource_groups (
 id uuid primary key default gen_random_uuid(),
 agent_id uuid not null references public.agents(id) on delete cascade,
 name text not null,
 created_at timestamptz default now(),
 data jsonb not null default '{}'::jsonb,
 unique(id,agent_id)
);
alter table public.resource_groups enable row level security;
drop policy if exists own_resource_groups on public.resource_groups;
create policy own_resource_groups on public.resource_groups for all to authenticated using(agent_id=auth.uid()) with check(agent_id=auth.uid());
create index if not exists resource_groups_agent on public.resource_groups(agent_id);
create table if not exists public.training_appointments (
 id uuid primary key default gen_random_uuid(),
 agent_id uuid not null references public.agents(id) on delete cascade,
 type text,
 title text,
 date date,
 time time,
 duration integer,
 location text,
 notes text,
 created_at timestamptz default now(),
 data jsonb not null default '{}'::jsonb,
 unique(id,agent_id)
);
alter table public.training_appointments enable row level security;
drop policy if exists own_training_appointments on public.training_appointments;
create policy own_training_appointments on public.training_appointments for all to authenticated using(agent_id=auth.uid()) with check(agent_id=auth.uid());
create index if not exists training_appointments_agent on public.training_appointments(agent_id);
create table if not exists public.call_log (
 id uuid primary key default gen_random_uuid(),
 agent_id uuid not null references public.agents(id) on delete cascade,
 prospect_id uuid,
 direction text,
 phone_number text,
 outcome text,
 duration integer,
 recording_url text,
 notes text,
 called_at timestamptz default now(),
 attempt_only boolean,
 provider_call_id text,
 data jsonb not null default '{}'::jsonb,
 unique(id,agent_id),
 foreign key(prospect_id,agent_id) references public.prospects(id,agent_id)
);
alter table public.call_log enable row level security;
drop policy if exists own_call_log on public.call_log;
create policy own_call_log on public.call_log for all to authenticated using(agent_id=auth.uid()) with check(agent_id=auth.uid());
create index if not exists call_log_agent on public.call_log(agent_id);
create index if not exists call_log_prospect on public.call_log(prospect_id);
create table if not exists public.carriers (
 id uuid primary key default gen_random_uuid(),
 agent_id uuid not null references public.agents(id) on delete cascade,
 carrier_name text,
 products text,
 states_available text,
 contracting_path text,
 writing_number text,
 commission_initial numeric,
 commission_renewal numeric,
 appointment_deadline date,
 jit_available text,
 portal_link text,
 notes text,
 data jsonb not null default '{}'::jsonb,
 unique(id,agent_id)
);
alter table public.carriers enable row level security;
drop policy if exists own_carriers on public.carriers;
create policy own_carriers on public.carriers for all to authenticated using(agent_id=auth.uid()) with check(agent_id=auth.uid());
create index if not exists carriers_agent on public.carriers(agent_id);
create table if not exists public.activity_events (
 id uuid primary key default gen_random_uuid(),
 agent_id uuid not null references public.agents(id) on delete cascade,
 prospect_id uuid,
 type text,
 occurred_at timestamptz,
 data jsonb not null default '{}'::jsonb,
 unique(id,agent_id),
 foreign key(prospect_id,agent_id) references public.prospects(id,agent_id)
);
alter table public.activity_events enable row level security;
drop policy if exists own_activity_events on public.activity_events;
create policy own_activity_events on public.activity_events for all to authenticated using(agent_id=auth.uid()) with check(agent_id=auth.uid());
create index if not exists activity_events_agent on public.activity_events(agent_id);
create table if not exists public.prospect_resource_groups (
 prospect_id uuid not null, resource_group_id uuid not null, agent_id uuid not null references public.agents(id) on delete cascade,
 primary key(prospect_id,resource_group_id),
 foreign key(prospect_id,agent_id) references public.prospects(id,agent_id) on delete cascade,
 foreign key(resource_group_id,agent_id) references public.resource_groups(id,agent_id) on delete cascade
);
alter table public.prospect_resource_groups enable row level security;
drop policy if exists own_memberships on public.prospect_resource_groups;
create policy own_memberships on public.prospect_resource_groups for all to authenticated using(agent_id=auth.uid()) with check(agent_id=auth.uid());
create index if not exists memberships_agent on public.prospect_resource_groups(agent_id);
-- Auxiliary job ledger: persists provider idempotency and authenticated callback ownership.
create table if not exists public.automation_jobs (
 id uuid primary key, agent_id uuid not null references public.agents(id) on delete cascade,
 prospect_id uuid not null, task text not null, status text not null default 'queued',
 provider_job_id text, callback_token_hash text not null, result jsonb,
 created_at timestamptz not null default now(), completed_at timestamptz,
 foreign key(prospect_id,agent_id) references public.prospects(id,agent_id) on delete cascade
);
alter table public.automation_jobs enable row level security;
drop policy if exists own_jobs_read on public.automation_jobs;
create policy own_jobs_read on public.automation_jobs for select to authenticated using(agent_id=auth.uid());
-- Provider identity and callback writes are server-only.
revoke all on public.automation_jobs from anon, authenticated;
grant select on public.automation_jobs to authenticated;
create or replace function public.load_agent_workspace() returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.agents;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 insert into public.agents(id,email) values(auth.uid(),auth.jwt()->>'email') on conflict(id) do nothing;
 select * into a from public.agents where id=auth.uid();
 return jsonb_build_object('schemaVersion',a.schema_version,'revision',a.revision,
 'profile',jsonb_build_object('preferredAgentName',a.preferred_name,'appearanceTheme',a.appearance_theme,'skipRemoveImportWarning',a.skip_remove_import_warning,'workspaceData',a.workspace_data),
 'prospects',coalesce((select jsonb_agg(data || jsonb_build_object('id',id,'firstName',first_name,'lastName',last_name,'phone',phone,'email',email,'product',product,'status',status,'leadPool',lead_pool,'qualificationStatus',qualification_status,'relationshipCategory',relationship_category,'source',source,'marketingEligibility',marketing_eligibility,'clientStatus',client_status,'policyStatus',policy_status,'ptcSource',ptc_source,'ptcSignedDate',ptc_signed_date,'ptcExpirationDate',ptc_expiration_date,'soaCompleted',soa_completed,'soaDate',soa_date,'soaMethod',soa_method,'carrierProvider',carrier_provider,'effectiveDate',effective_date,'closingDate',closing_date,'reasonClosed',reason_closed,'nextFollowUp',next_follow_up,'lastContact',last_contact,'contactOutcome',contact_outcome,'serviceHistory',service_history,'futureOpportunity',future_opportunity,'notes',notes,'archived',archived,'appointmentDate',appointment_date,'createdAt',created_at,'updatedAt',updated_at)) from public.prospects where agent_id=auth.uid()),'[]'::jsonb),
 'resourceGroups',coalesce((select jsonb_agg(data || jsonb_build_object('id',id,'name',name,'createdAt',created_at)) from public.resource_groups where agent_id=auth.uid()),'[]'::jsonb),
 'training',coalesce((select jsonb_agg(data || jsonb_build_object('id',id,'type',type,'title',title,'date',date,'time',time,'duration',duration,'location',location,'notes',notes,'createdAt',created_at)) from public.training_appointments where agent_id=auth.uid()),'[]'::jsonb),
 'calls',coalesce((select jsonb_agg(data || jsonb_build_object('id',id,'prospectId',prospect_id,'direction',direction,'phoneNumber',phone_number,'outcome',outcome,'duration',duration,'recordingUrl',recording_url,'notes',notes,'calledAt',called_at,'attemptOnly',attempt_only,'providerCallId',provider_call_id)) from public.call_log where agent_id=auth.uid()),'[]'::jsonb),
 'carriers',coalesce((select jsonb_agg(data || jsonb_build_object('id',id,'carrierName',carrier_name,'products',products,'statesAvailable',states_available,'contractingPath',contracting_path,'writingNumber',writing_number,'commissionInitial',commission_initial,'commissionRenewal',commission_renewal,'appointmentDeadline',appointment_deadline,'jitAvailable',jit_available,'portalLink',portal_link,'notes',notes)) from public.carriers where agent_id=auth.uid()),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(data || jsonb_build_object('id',id,'prospectId',prospect_id,'type',type,'occurredAt',occurred_at)) from public.activity_events where agent_id=auth.uid()),'[]'::jsonb));
end $$;
create or replace function public.save_agent_workspace(payload jsonb, expected_revision bigint) returns bigint
language plpgsql security invoker set search_path=public,pg_temp as $$
declare current_revision bigint; row_data jsonb; new_revision bigint; dataset text; group_id text;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if (payload->>'schemaVersion')::integer is distinct from 2 then raise exception 'Unsupported schema version'; end if;
 foreach dataset in array array['prospects','resourceGroups','training','calls','carriers','events'] loop
  if jsonb_typeof(payload->dataset) is distinct from 'array' then raise exception 'Incomplete backup: %',dataset; end if;
 end loop;
 select revision into current_revision from public.agents where id=auth.uid() for update;
 if not found then raise exception 'Load your account before saving'; end if;
 if current_revision is distinct from expected_revision then raise exception 'Account changed on another tab/device. Export pending changes, then reload and merge your backup'; end if;
 for row_data in select value from jsonb_array_elements(payload->'prospects') loop
  insert into public.prospects(id,agent_id,first_name,last_name,phone,email,product,status,lead_pool,qualification_status,relationship_category,source,marketing_eligibility,client_status,policy_status,ptc_source,ptc_signed_date,ptc_expiration_date,soa_completed,soa_date,soa_method,carrier_provider,effective_date,closing_date,reason_closed,next_follow_up,last_contact,contact_outcome,service_history,future_opportunity,notes,archived,appointment_date,created_at,updated_at,data)
  values ((row_data->>'id')::uuid,auth.uid(),nullif(row_data->>'firstName','')::text,nullif(row_data->>'lastName','')::text,nullif(row_data->>'phone','')::text,nullif(row_data->>'email','')::text,nullif(row_data->>'product','')::text,nullif(row_data->>'status','')::text,nullif(row_data->>'leadPool','')::text,nullif(row_data->>'qualificationStatus','')::text,nullif(row_data->>'relationshipCategory','')::text,nullif(row_data->>'source','')::text,nullif(row_data->>'marketingEligibility','')::text,nullif(row_data->>'clientStatus','')::text,nullif(row_data->>'policyStatus','')::text,nullif(row_data->>'ptcSource','')::text,nullif(row_data->>'ptcSignedDate','')::date,(nullif(row_data->>'ptcSignedDate','')::date + interval '1 year')::date,nullif(row_data->>'soaCompleted','')::text,nullif(row_data->>'soaDate','')::date,nullif(row_data->>'soaMethod','')::text,nullif(row_data->>'carrierProvider','')::text,nullif(row_data->>'effectiveDate','')::date,nullif(row_data->>'closingDate','')::date,nullif(row_data->>'reasonClosed','')::text,nullif(row_data->>'nextFollowUp','')::date,nullif(row_data->>'lastContact','')::date,nullif(row_data->>'contactOutcome','')::text,nullif(row_data->>'serviceHistory','')::text,nullif(row_data->>'futureOpportunity','')::text,nullif(row_data->>'notes','')::text,coalesce(nullif(row_data->>'archived','')::boolean,false),nullif(row_data->>'appointmentDate','')::timestamptz,nullif(row_data->>'createdAt','')::timestamptz,now(),row_data)
  on conflict(id) do update set first_name=excluded.first_name,last_name=excluded.last_name,phone=excluded.phone,email=excluded.email,product=excluded.product,status=excluded.status,lead_pool=excluded.lead_pool,qualification_status=excluded.qualification_status,relationship_category=excluded.relationship_category,source=excluded.source,marketing_eligibility=excluded.marketing_eligibility,client_status=excluded.client_status,policy_status=excluded.policy_status,ptc_source=excluded.ptc_source,ptc_signed_date=excluded.ptc_signed_date,ptc_expiration_date=excluded.ptc_expiration_date,soa_completed=excluded.soa_completed,soa_date=excluded.soa_date,soa_method=excluded.soa_method,carrier_provider=excluded.carrier_provider,effective_date=excluded.effective_date,closing_date=excluded.closing_date,reason_closed=excluded.reason_closed,next_follow_up=excluded.next_follow_up,last_contact=excluded.last_contact,contact_outcome=excluded.contact_outcome,service_history=excluded.service_history,future_opportunity=excluded.future_opportunity,notes=excluded.notes,archived=excluded.archived,appointment_date=excluded.appointment_date,created_at=excluded.created_at,updated_at=excluded.updated_at,data=excluded.data;
 end loop;
 for row_data in select value from jsonb_array_elements(payload->'resourceGroups') loop
  insert into public.resource_groups(id,agent_id,name,created_at,data)
  values ((row_data->>'id')::uuid,auth.uid(),nullif(row_data->>'name','')::text,nullif(row_data->>'createdAt','')::timestamptz,row_data)
  on conflict(id) do update set name=excluded.name,created_at=excluded.created_at,data=excluded.data;
 end loop;
 for row_data in select value from jsonb_array_elements(payload->'training') loop
  insert into public.training_appointments(id,agent_id,type,title,date,time,duration,location,notes,created_at,data)
  values ((row_data->>'id')::uuid,auth.uid(),nullif(row_data->>'type','')::text,nullif(row_data->>'title','')::text,nullif(row_data->>'date','')::date,nullif(row_data->>'time','')::time,nullif(row_data->>'duration','')::integer,nullif(row_data->>'location','')::text,nullif(row_data->>'notes','')::text,nullif(row_data->>'createdAt','')::timestamptz,row_data)
  on conflict(id) do update set type=excluded.type,title=excluded.title,date=excluded.date,time=excluded.time,duration=excluded.duration,location=excluded.location,notes=excluded.notes,created_at=excluded.created_at,data=excluded.data;
 end loop;
 for row_data in select value from jsonb_array_elements(payload->'calls') loop
  insert into public.call_log(id,agent_id,prospect_id,direction,phone_number,outcome,duration,recording_url,notes,called_at,attempt_only,provider_call_id,data)
  values ((row_data->>'id')::uuid,auth.uid(),(select (row_data->>'prospectId')::uuid where exists(select 1 from public.prospects where id=nullif(row_data->>'prospectId','')::uuid and agent_id=auth.uid())),nullif(row_data->>'direction','')::text,nullif(row_data->>'phoneNumber','')::text,nullif(row_data->>'outcome','')::text,nullif(row_data->>'duration','')::integer,nullif(row_data->>'recordingUrl','')::text,nullif(row_data->>'notes','')::text,nullif(row_data->>'calledAt','')::timestamptz,coalesce(nullif(row_data->>'attemptOnly','')::boolean,false),nullif(row_data->>'providerCallId','')::text,row_data)
  on conflict(id) do update set prospect_id=excluded.prospect_id,direction=excluded.direction,phone_number=excluded.phone_number,outcome=excluded.outcome,duration=excluded.duration,recording_url=excluded.recording_url,notes=excluded.notes,called_at=excluded.called_at,attempt_only=excluded.attempt_only,provider_call_id=excluded.provider_call_id,data=excluded.data;
 end loop;
 for row_data in select value from jsonb_array_elements(payload->'carriers') loop
  insert into public.carriers(id,agent_id,carrier_name,products,states_available,contracting_path,writing_number,commission_initial,commission_renewal,appointment_deadline,jit_available,portal_link,notes,data)
  values ((row_data->>'id')::uuid,auth.uid(),nullif(row_data->>'carrierName','')::text,nullif(row_data->>'products','')::text,nullif(row_data->>'statesAvailable','')::text,nullif(row_data->>'contractingPath','')::text,nullif(row_data->>'writingNumber','')::text,nullif(row_data->>'commissionInitial','')::numeric,nullif(row_data->>'commissionRenewal','')::numeric,nullif(row_data->>'appointmentDeadline','')::date,nullif(row_data->>'jitAvailable','')::text,nullif(row_data->>'portalLink','')::text,nullif(row_data->>'notes','')::text,row_data)
  on conflict(id) do update set carrier_name=excluded.carrier_name,products=excluded.products,states_available=excluded.states_available,contracting_path=excluded.contracting_path,writing_number=excluded.writing_number,commission_initial=excluded.commission_initial,commission_renewal=excluded.commission_renewal,appointment_deadline=excluded.appointment_deadline,jit_available=excluded.jit_available,portal_link=excluded.portal_link,notes=excluded.notes,data=excluded.data;
 end loop;
 for row_data in select value from jsonb_array_elements(payload->'events') loop
  insert into public.activity_events(id,agent_id,prospect_id,type,occurred_at,data)
  values ((row_data->>'id')::uuid,auth.uid(),(select (row_data->>'prospectId')::uuid where exists(select 1 from public.prospects where id=nullif(row_data->>'prospectId','')::uuid and agent_id=auth.uid())),nullif(row_data->>'type','')::text,nullif(row_data->>'occurredAt','')::timestamptz,row_data)
  on conflict(id) do update set prospect_id=excluded.prospect_id,type=excluded.type,occurred_at=excluded.occurred_at,data=excluded.data;
 end loop;
 delete from public.prospect_resource_groups where agent_id=auth.uid();
 for row_data in select value from jsonb_array_elements(payload->'prospects') loop
  for group_id in select jsonb_array_elements_text(coalesce(row_data->'resourceGroupIds','[]'::jsonb)) loop
   insert into public.prospect_resource_groups(prospect_id,resource_group_id,agent_id)
   values ((row_data->>'id')::uuid,group_id::uuid,auth.uid()) on conflict do nothing;
  end loop;
 end loop;
 -- Remove only own omitted records, atomically. Retain historical calls, detached from deleted prospects.
 update public.call_log set prospect_id=null,data=data||'{"prospectId":null}'::jsonb
 where agent_id=auth.uid() and prospect_id not in (select (value->>'id')::uuid from jsonb_array_elements(payload->'prospects'));
 update public.activity_events set prospect_id=null,data=data||'{"prospectId":null}'::jsonb
 where agent_id=auth.uid() and prospect_id not in (select (value->>'id')::uuid from jsonb_array_elements(payload->'prospects'));
 delete from public.prospects where agent_id=auth.uid() and id not in (select (value->>'id')::uuid from jsonb_array_elements(payload->'prospects'));
 delete from public.resource_groups where agent_id=auth.uid() and id not in (select (value->>'id')::uuid from jsonb_array_elements(payload->'resourceGroups'));
 delete from public.training_appointments where agent_id=auth.uid() and id not in (select (value->>'id')::uuid from jsonb_array_elements(payload->'training'));
 delete from public.carriers where agent_id=auth.uid() and id not in (select (value->>'id')::uuid from jsonb_array_elements(payload->'carriers'));
 update public.agents set preferred_name=payload->'profile'->>'preferredAgentName',
 appearance_theme=coalesce(payload->'profile'->>'appearanceTheme','default'),
 skip_remove_import_warning=coalesce((payload->'profile'->>'skipRemoveImportWarning')::boolean,false),
 workspace_data=coalesce(payload->'profile'->'workspaceData','{}'::jsonb),
 schema_version=2,revision=revision+1 where id=auth.uid() returning revision into new_revision;
 return new_revision;
end $$;
revoke all on function public.load_agent_workspace() from public,anon;
revoke all on function public.save_agent_workspace(jsonb,bigint) from public,anon;
grant execute on function public.load_agent_workspace() to authenticated;
grant execute on function public.save_agent_workspace(jsonb,bigint) to authenticated;
grant select,insert,update,delete on public.agents,public.prospects,public.resource_groups,
 public.prospect_resource_groups,public.training_appointments,public.call_log,public.carriers,public.activity_events to authenticated;
grant all on public.agents,public.prospects,public.resource_groups,public.prospect_resource_groups,
 public.training_appointments,public.call_log,public.carriers,public.activity_events,public.automation_jobs to service_role;
-- Create an Agent Rise profile whenever a Supabase Auth user signs up.
create or replace function public.handle_new_agent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.agents(id,email)
  values(new.id,new.email)
  on conflict(id) do update set email=excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_agent_rise on auth.users;
create trigger on_auth_user_created_agent_rise
after insert on auth.users
for each row execute function public.handle_new_agent();

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
-- Verification query (run after installation):
-- select table_name from information_schema.tables
-- where table_schema='public'
-- order by table_name;
-- Required core tables include: agents, call_log, prospect_resource_groups,
-- prospects, resource_groups, and training_appointments.
