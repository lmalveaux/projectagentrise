import { createClient } from "npm:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const OPENAI_MODEL = "gpt-4o-mini";
const MAX_QUERY_LENGTH = 4_000;
const ALLOWED_ORIGINS = new Set([
  "https://agentrisepro.com",
  "https://www.agentrisepro.com",
  "https://projectagentrise.netlify.app",
]);

function cors(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://agentrisepro.com";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, origin);
  }

  try {
    if (!OPENAI_API_KEY) {
      return json({ error: "The AI service is not configured." }, 503, origin);
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return json({ error: "Authentication is not configured." }, 503, origin);
    }

    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return json({ error: "Sign in is required to use Ask AI." }, 401, origin);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return json({ error: "Your session is not valid. Please sign in again." }, 401, origin);
    }

    const body = await request.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (!query) {
      return json({ error: "A question is required." }, 400, origin);
    }
    if (query.length > MAX_QUERY_LENGTH) {
      return json({ error: `Question exceeds the ${MAX_QUERY_LENGTH} character limit.` }, 400, origin);
    }

    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: "You are Agent Rise AI. Give clear, concise support for an independent insurance agent. Do not present legal, tax, or compliance guidance as professional advice.",
          },
          { role: "user", content: query },
        ],
      }),
    });

    if (!openAIResponse.ok) {
      console.error("OpenAI request failed", { status: openAIResponse.status });
      return json({ error: "Ask AI is temporarily unavailable. Please try again." }, 502, origin);
    }

    const completion = await openAIResponse.json();
    const text = String(completion?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) {
      return json({ error: "Ask AI returned an empty response. Please try again." }, 502, origin);
    }

    return json({ text }, 200, origin);
  } catch (error) {
    console.error("ask-gpt failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Ask AI is temporarily unavailable. Please try again." }, 500, origin);
  }
});
