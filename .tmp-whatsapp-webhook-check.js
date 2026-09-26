// supabase/functions/_shared/supabase.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
function getServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service configuration is missing.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// supabase/functions/whatsapp-webhook/index.ts
function response(body, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
function bytesToHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function verifySignature(rawBody, signature) {
  const secret = Deno.env.get("META_WHATSAPP_APP_SECRET");
  if (!secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = `sha256=${bytesToHex(new Uint8Array(digest))}`;
  if (signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < signature.length; index += 1) {
    mismatch |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}
Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge") || "";
    const expected = Deno.env.get("META_WHATSAPP_WEBHOOK_VERIFY_TOKEN");
    if (mode === "subscribe" && expected && token === expected) return response(challenge);
    return response("forbidden", 403);
  }
  if (req.method !== "POST") return response("method_not_allowed", 405);
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256") || "";
  if (!await verifySignature(rawBody, signature)) return response("invalid_signature", 401);
  try {
    const payload = JSON.parse(rawBody);
    const statuses = (payload?.entry || []).flatMap((entry) => entry?.changes || []).flatMap((change) => change?.value?.statuses || []);
    const supabase = getServiceClient();
    for (const event of statuses) {
      const providerId = String(event?.id || "").trim();
      const status = String(event?.status || "").trim();
      if (!providerId || !["sent", "delivered", "read", "failed"].includes(status)) continue;
      const occurredAt = event?.timestamp ? new Date(Number(event.timestamp) * 1e3).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
      const update = {
        status,
        error_message: status === "failed" ? String(event?.errors?.[0]?.title || event?.errors?.[0]?.message || "meta_delivery_failed") : null
      };
      if (status === "delivered") update.delivered_at = occurredAt;
      if (status === "read") {
        update.delivered_at = occurredAt;
        update.read_at = occurredAt;
      }
      const { error } = await supabase.from("customer_message_logs").update(update).eq("provider_id", providerId);
      if (error) console.error("WhatsApp webhook log update failed:", error);
    }
    return response("ok");
  } catch (error) {
    console.error("WhatsApp webhook failed:", error);
    return response("invalid_payload", 400);
  }
});
