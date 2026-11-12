import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const ALLOWED_ORIGINS = new Set([
  "https://agentrisepro.com",
  "https://www.agentrisepro.com",
  "https://projectagentrise.netlify.app",
]);
const SYSTEM_PROMPT = "You are an AI Assistant for a Medicare agent using Agent Rise Pro. You must always include TPMO disclaimers when discussing plan-specific benefits and never make guarantees. If the user is on the Pilot tier, restrict your answers strictly to Medicare and insurance-related questions, compliance, and app functionality. If the user is on the Pro or Pro-Plus tier, you act as a full business assistant: answer Medicare questions, draft emails, create marketing ideas, analyze business strategies, and help with general business tasks.";

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://agentrisepro.com",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "AI service is not configured." }, 500, origin);
  if (!OPENAI_API_KEY) return json({ error: "Missing OPENAI_API_KEY." }, 500, origin);

  try {
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Sign in is required." }, 401, origin);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData.user;
    if (authError || !user) return json({ error: "Your session is not valid." }, 401, origin);

    const [adminResult, entitlementResult] = await Promise.all([
      admin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
      admin.from("account_entitlements").select("tier,status,current_period_end").eq("user_id", user.id).maybeSingle(),
    ]);
    if (adminResult.error) throw adminResult.error;
    if (entitlementResult.error) throw entitlementResult.error;

    const entitlement = entitlementResult.data;
    const periodActive = !entitlement?.current_period_end || Date.parse(entitlement.current_period_end) > Date.now();
    const paidTier = ["pro", "pro-plus", "agency", "owner"].includes(entitlement?.tier ?? "");
    const allowed = Boolean(adminResult.data || (entitlement?.status === "active" && paidTier && periodActive));
    if (!allowed) return json({ error: "The A.I. Assistant requires an active Pro subscription." }, 403, origin);

    const body = await request.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) return json({ error: "Enter a question for the A.I. Assistant." }, 400, origin);
    if (query.length > 4000) return json({ error: "Keep your question under 4,000 characters." }, 400, origin);

    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
      }),
    });

    const openAIData = await openAIResponse.json().catch(() => ({}));
    if (!openAIResponse.ok) {
      console.error("OpenAI request failed", openAIResponse.status, openAIData?.error?.type ?? "unknown_error");
      return json({ error: "The A.I. Assistant is temporarily unavailable." }, 502, origin);
    }

    const text = typeof openAIData?.choices?.[0]?.message?.content === "string"
      ? openAIData.choices[0].message.content.trim()
      : "";
    if (!text) return json({ error: "The A.I. Assistant returned an empty response." }, 502, origin);

    return json({ text }, 200, origin);
  } catch (error) {
    console.error("Ask GPT failed", error);
    return json({ error: "The A.I. Assistant is unavailable." }, 500, origin);
  }
});
