import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
process.env.SUPABASE_URL='https://storage.test';process.env.SUPABASE_SECRET_KEY='test-only';process.env.AGENT_RISE_ORIGIN='https://app.test';process.env.PUBLIC_API_URL='https://api.test';process.env.CALL_E_ADAPTER_ENABLED='false';
const realFetch=globalThis.fetch,agent=randomUUID(),other=randomUUID(),prospectId=randomUUID(),jobs=new Map();let completions=0;
const today=new Date().toISOString().slice(0,10);
const prospect={id:prospectId,agent_id:agent,phone:'3125550199',marketing_eligibility:'Active Insurance Prospect',ptc_source:'BRC',ptc_signed_date:today,product:'Medicare Advantage',soa_completed:'Yes',soa_date:today,soa_method:'Electronic Record',lead_pool:'New Lead Pool'};
globalThis.fetch=async(input,options={})=>{const url=new URL(input);const send=(data,status=200)=>new Response(JSON.stringify(data),{status});if(url.pathname==='/auth/v1/user'){if(!options.headers.Authorization)return send({},401);return send({id:options.headers.Authorization==='Bearer other'?other:agent});}assert.equal(options.headers.apikey,'test-only');assert.equal(options.headers.Authorization,undefined);const id=url.searchParams.get('id')?.slice(3),owner=url.searchParams.get('agent_id')?.slice(3);if(url.pathname==='/rest/v1/prospects')return send(owner===agent&&id===prospectId?[prospect]:[]);if(url.pathname==='/rest/v1/automation_jobs'){if(options.method==='POST'){const row=JSON.parse(options.body);jobs.set(row.id,{...row,status:'queued'});return send([row]);}return send(jobs.has(id)&&(!owner||jobs.get(id).agent_id===owner)?[jobs.get(id)]:[]);}if(url.pathname==='/rest/v1/rpc/complete_automation_job'){const {job_id,result}=JSON.parse(options.body);jobs.get(job_id).status='failed';completions++;return send(null);}throw Error('Unexpected test request '+url);};
const {server,eligible,expiry}=await import('../platform/server.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
try{
 const post=(body,token='owner',origin='https://app.test')=>realFetch(base+'/api/call-e',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,Origin:origin},body:JSON.stringify(body)});
 assert.equal(expiry('2024-02-29'),'2025-02-28');assert.equal(eligible(prospect),true);assert.equal(eligible({...prospect,soa_completed:'No'}),false);
 const requestId=randomUUID();let r=await post({prospectId,requestId,task:'screen'});assert.equal(r.status,503);const failed=await r.json();assert.equal(failed.logged,true);assert.equal(completions,1);
 r=await post({prospectId,requestId,task:'screen'});assert.equal(r.status,200);assert.equal((await r.json()).status,'failed');assert.equal(completions,1);
 r=await post({prospectId,requestId:randomUUID(),task:'screen'},'other');assert.equal(r.status,403);
 r=await post({prospectId,requestId:randomUUID(),task:'screen'},'owner','https://untrusted.test');assert.equal(r.status,403);
 r=await realFetch(base+'/api/call-e/callback/'+requestId,{method:'POST',headers:{Authorization:'Bearer invalid','Content-Type':'application/json'},body:'{"outcome":"confirmed"}'});assert.equal(r.status,403);
 console.log('PASS: platform consent checks, disabled-provider error logging, duplicate request handling, owner isolation, origin checks, and invalid callback rejection (mock storage; no real calls).');
}finally{await new Promise(resolve=>server.close(resolve));globalThis.fetch=realFetch;}
