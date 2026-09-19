/* Configure this adapter against your Call-E vendor's verified API documentation.
   The provider identity/API was not supplied with the build specification.
   This explicit gateway contract avoids assuming a nonexistent vendor endpoint. */
export async function submitCall(job) {
  if (process.env.CALL_E_ADAPTER_ENABLED !== 'true') throw new Error('Call-E adapter is not configured. Manual calling is available.');
  const endpoint=process.env.CALL_E_PROVIDER_URL;
  if (!endpoint?.startsWith('https://') || !process.env.CALL_E_API_KEY) throw new Error('Call-E server configuration is incomplete.');
  // Your gateway must implement this request/response contract, or adjust this
  // single adapter to the actual provider API after its documentation is supplied.
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.CALL_E_API_KEY}`,'Idempotency-Key':job.requestId},body:JSON.stringify({
    phone_number:job.phone,task:job.task,appointment_at:job.appointmentDate,
    next_follow_up:job.nextFollowUp,callback_url:job.callbackUrl,
    callback_headers:{Authorization:`Bearer ${job.callbackToken}`},reference:job.requestId
  }),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`Call-E provider returned HTTP ${response.status}.`);
  const result=await response.json();
  if(typeof result.job_id!=='string'||!result.job_id)throw new Error('Call-E provider must return a job_id.');
  return {jobId:result.job_id};
}
