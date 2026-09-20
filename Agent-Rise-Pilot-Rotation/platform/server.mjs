import http from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {submitCall} from './provider-adapter.mjs';
const env=process.env;
const supabaseSecret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
const required=['SUPABASE_URL','AGENT_RISE_ORIGIN','PUBLIC_API_URL'];
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v||'');
const hash=s=>createHash('sha256').update(s).digest('hex');
async function db(path,options={}){const r=await fetch(env.SUPABASE_URL+'/rest/v1/'+path,{...options,headers:{apikey:supabaseSecret,'Content-Type':'application/json',Prefer:'return=representation',...options.headers},signal:AbortSignal.timeout(15000)});const body=await r.text();if(!r.ok){const e=new Error(`Storage request failed (${r.status})`);e.status=r.status;throw e;}return body?JSON.parse(body):null;}
async function readBody(req){let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>65536)throw Error('Request is too large.');}return JSON.parse(data||'{}');}
async function user(req){const token=req.headers.authorization;if(!token?.startsWith('Bearer '))throw Error('Sign in required.');const r=await fetch(env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:supabaseSecret,Authorization:token},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Session expired. Sign in again.');return r.json();}
function expiry(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return '';const[y,m,d]=s.split('-').map(Number);if(new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)!==s)return '';return `${y+1}-${String(m).padStart(2,'0')}-${String(Math.min(d,new Date(Date.UTC(y+1,m,0)).getUTCDate())).padStart(2,'0')}`;}
function eligible(p){const today=new Date().toISOString().slice(0,10);if(p.marketing_eligibility!=='Active Insurance Prospect'||p.lead_pool==='Do Not Contact'||p.client_status==='Do Not Contact'||p.qualification_status==='Do Not Market')return false;if(!p.ptc_source||p.ptc_source==='Not on File'||!expiry(p.ptc_signed_date)||expiry(p.ptc_signed_date)<today||p.ptc_signed_date>today)return false;if(/medicare|\bpdp\b|turning 65/i.test(p.product||'')&&(p.soa_completed!=='Yes'||!p.soa_date||p.soa_date>today||!p.soa_method||p.soa_method==='Not Applicable'))return false;return true;}
export const server=http.createServer(async(req,res)=>{
  if(req.headers.origin===env.AGENT_RISE_ORIGIN){res.setHeader('Access-Control-Allow-Origin',env.AGENT_RISE_ORIGIN);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');}
  if(req.method==='OPTIONS')return res.writeHead(204).end();
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,callEConfigured:env.CALL_E_ADAPTER_ENABLED==='true'});
  if(req.method!=='POST')return json(res,405,{error:'Use POST.'});
  if(required.some(k=>!env[k])||!supabaseSecret)return json(res,503,{error:'Agent Rise calling service is not configured. Use manual calling.'});
  try{
    if(url.pathname==='/api/call-e'){
      if(req.headers.origin&&req.headers.origin!==env.AGENT_RISE_ORIGIN)return json(res,403,{error:'Origin not allowed.'});
      const agent=await user(req),body=await readBody(req);
      if(!uuid(body.prospectId)||!uuid(body.requestId)||!['confirm','screen','follow-up'].includes(body.task))return json(res,400,{error:'Invalid call request.'});
      const [existing]=await db(`automation_jobs?id=eq.${body.requestId}&agent_id=eq.${agent.id}`);
      if(existing)return json(res,200,{jobId:existing.id,status:existing.status});
      const [p]=await db(`prospects?id=eq.${body.prospectId}&agent_id=eq.${agent.id}`);
      if(!p||!eligible(p))return json(res,403,{error:'This contact does not meet the calling permission requirements.'});
      if(!/\d{7}/.test((p.phone||'').replace(/\D/g,'')))return json(res,400,{error:'A valid phone number is required.'});
      if(body.task==='confirm'&&!p.appointment_date||body.task==='screen'&&p.lead_pool!=='New Lead Pool'||body.task==='follow-up'&&!p.next_follow_up)return json(res,400,{error:'This task does not match the prospect record.'});
      const callbackToken=randomBytes(32).toString('hex');
      await db('automation_jobs',{method:'POST',body:JSON.stringify({id:body.requestId,agent_id:agent.id,prospect_id:p.id,task:body.task,callback_token_hash:hash(callbackToken)})});
      try{const result=await submitCall({requestId:body.requestId,phone:p.phone,task:body.task,appointmentDate:p.appointment_date,nextFollowUp:p.next_follow_up,callbackUrl:env.PUBLIC_API_URL.replace(/\/$/,'')+'/api/call-e/callback/'+body.requestId,callbackToken});await db(`automation_jobs?id=eq.${body.requestId}&status=eq.queued`,{method:'PATCH',body:JSON.stringify({provider_job_id:result.jobId,status:'submitted'})});return json(res,202,{jobId:body.requestId,status:'submitted'});}catch(e){await db('rpc/complete_automation_job',{method:'POST',body:JSON.stringify({job_id:body.requestId,result: {outcome:'failed',notes:e.message}})});return json(res,503,{error:e.message,logged:true,jobId:body.requestId});}
    }
    if(url.pathname.startsWith('/api/call-e/callback/')){
      const id=url.pathname.split('/').pop();if(!uuid(id))return json(res,400,{error:'Invalid job.'});const [job]=await db(`automation_jobs?id=eq.${id}`);const token=(req.headers.authorization||'').replace(/^Bearer /,'');if(!job||!token||!timingSafeEqual(Buffer.from(hash(token)),Buffer.from(job.callback_token_hash)))return json(res,403,{error:'Invalid callback signature.'});
      const body=await readBody(req);if(!['confirmed','rescheduled','declined','no_answer','voicemail','callback'].includes(body.outcome))return json(res,400,{error:'Unknown outcome.'});if(['rescheduled','callback'].includes(body.outcome)&&!/^\d{4}-\d{2}-\d{2}$/.test(body.next_follow_up||''))return json(res,400,{error:'A next_follow_up date is required.'});
      await db('rpc/complete_automation_job',{method:'POST',body:JSON.stringify({job_id:id,result:{outcome:body.outcome,next_follow_up:body.next_follow_up||null,duration:Math.max(0,Math.floor(Number(body.duration)||0)),notes:String(body.notes||'').slice(0,5000)}})});return json(res,200,{ok:true});
    }
    json(res,404,{error:'Endpoint not found.'});
  }catch(e){json(res,400,{error:e.message});}
});
if(process.argv[1]&&new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll('\\','/').split('/').pop()))server.listen(Number(env.PORT)||8787,'127.0.0.1',()=>console.log('Agent Rise calling API listening on '+(env.PORT||8787)));
export {eligible,expiry};
