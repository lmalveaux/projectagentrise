const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const sql=fs.readFileSync(path.resolve(__dirname,'..','supabase','install.sql'),'utf8');
const core=['agents','prospects','resource_groups','prospect_resource_groups','training_appointments','call_log'];
const support=['carriers','activity_events','automation_jobs'];
for(const table of [...core,...support]){
  assert.match(sql,new RegExp(`create table if not exists public\\.${table}\\b`));
  assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
}
for(const index of ['prospects_agent','prospects_next_follow_up','call_log_agent','call_log_prospect','training_appointments_agent','resource_groups_agent'])assert.match(sql,new RegExp(`create index if not exists ${index}\\b`));
for(const fn of ['load_agent_workspace','save_agent_workspace','complete_automation_job','handle_new_agent'])assert.match(sql,new RegExp(`create or replace function public\\.${fn}\\b`));
assert.match(sql,/drop trigger if exists on_auth_user_created_agent_rise on auth\.users;/);
assert.match(sql,/create trigger on_auth_user_created_agent_rise[\s\S]*after insert on auth\.users/);
assert.doesNotMatch(sql,/^\s*(begin|commit);\s*$/mi);
assert.doesNotMatch(sql,/create table public\./i);
assert.doesNotMatch(sql,/create index (?!if not exists)/i);
console.log('PASS: single-run installer contains the complete schema, RLS, indexes, RPCs, and auth trigger with rerunnable table/index creation.');
