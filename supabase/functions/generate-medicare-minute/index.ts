import { createClient } from "npm:@supabase/supabase-js@2";

const OWNER_EMAILS = new Set(["lisasjazz@gmail.com", "121media.info@gmail.com"]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY") ?? "";
    const voiceId = Deno.env.get("ELEVENLABS_VOICE_ID") ?? "";
    if (!supabaseUrl || !serviceKey || !elevenLabsKey || !voiceId) {
      throw new Error("The Medicare Minute service is not fully configured.");
    }

    const authorization = request.headers.get("Authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in is required." }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Your session has expired." }, 401);
    const email = String(userData.user.email ?? "").trim().toLowerCase();
    if (!OWNER_EMAILS.has(email)) return json({ error: "Owner access is required." }, 403);

    const body = await request.json();
    const script = String(body?.script ?? "").trim();
    if (!script) return json({ error: "A script is required." }, 400);
    if (script.length > 5000) return json({ error: "The script is too long." }, 400);

    const speechResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_turbo_v2_5",
          output_format: "mp3_44100_128",
          voice_settings: { stability: 0.48, similarity_boost: 0.78, style: 0.18, use_speaker_boost: true },
        }),
      },
    );
    if (!speechResponse.ok) {
      const detail = await speechResponse.text();
      throw new Error(`Voice generation failed (${speechResponse.status}): ${detail.slice(0, 300)}`);
    }
    const audio = new Uint8Array(await speechResponse.arrayBuffer());

    if (body?.publish === true) {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.date ?? ""))
        ? String(body.date)
        : new Date().toISOString().slice(0, 10);
      const brief = body?.brief && typeof body.brief === "object" ? body.brief : {};
      await admin.storage.createBucket("medicare-minute", { public: true }).catch(() => undefined);
      const audioPath = `daily/${date}.mp3`;
      const record = {
        ...brief,
        date,
        script,
        audioPath,
        publishedAt: new Date().toISOString(),
      };
      const audioUpload = await admin.storage.from("medicare-minute").upload(audioPath, audio, {
        contentType: "audio/mpeg",
        upsert: true,
        cacheControl: "300",
      });
      if (audioUpload.error) throw audioUpload.error;
      const recordBytes = new TextEncoder().encode(JSON.stringify({ medicareMinute: record }, null, 2));
      for (const path of [`daily/${date}.json`, "latest.json", "assets/data/news.json"]) {
        const result = await admin.storage.from("medicare-minute").upload(path, recordBytes, {
          contentType: "application/json",
          upsert: true,
          cacheControl: "60",
        });
        if (result.error) throw result.error;
      }
      const publicUrl = admin.storage.from("medicare-minute").getPublicUrl(audioPath).data.publicUrl;
      return json({ ok: true, date, audioUrl: publicUrl, record });
    }

    return new Response(audio, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("generate-medicare-minute", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
