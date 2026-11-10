import { createClient } from "npm:@supabase/supabase-js@2";
import carriers from "./carriers-by-state.json" with { type: "json" };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_ORIGINS = new Set([
  "https://agentrisepro.com",
  "https://www.agentrisepro.com",
  "https://projectagentrise.netlify.app",
]);

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://agentrisepro.com",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Feature service is not configured." }, 500, origin);

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

    const body = await request.json().catch(() => ({}));
    if (body.feature !== "jit-carriers") return json({ error: "Unknown Pro feature." }, 400, origin);

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
    if (!allowed) return json({ error: "This Pro feature requires an active subscription." }, 403, origin);

    return json({ feature: "jit-carriers", carriers }, 200, origin);
  } catch (error) {
    console.error("Pro feature access failed", error);
    return json({ error: "The Pro feature service is unavailable." }, 500, origin);
  }
});

