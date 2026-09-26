// supabase/functions/_shared/cors.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
function handleOptions(req) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

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

// supabase/functions/_shared/whatsapp.ts
var SETTINGS_COLUMNS = [
  "whatsapp_enabled",
  "whatsapp_meta_api_version",
  "whatsapp_phone_number_id",
  "whatsapp_waba_id",
  "whatsapp_template_language",
  "whatsapp_order_status_template",
  "whatsapp_last_tested_at",
  "whatsapp_last_test_status",
  "whatsapp_verified_name",
  "whatsapp_display_phone_number",
  "whatsapp_quality_rating"
].join(", ");
function clean(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}
function normalizeApiVersion(value) {
  const version = clean(value, 16);
  return /^v\d+\.\d+$/.test(version) ? version : "v26.0";
}
function normalizeWhatsAppPhone(value) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^05\d{8}$/.test(digits)) return `966${digits.slice(1)}`;
  if (/^5\d{8}$/.test(digits)) return `966${digits}`;
  if (/^9665\d{8}$/.test(digits)) return digits;
  return digits;
}
async function getWhatsAppSettings(supabase) {
  const { data, error } = await supabase.from("settings").select(SETTINGS_COLUMNS).eq("id", 1).maybeSingle();
  if (error) throw error;
  return {
    enabled: data?.whatsapp_enabled === true,
    apiVersion: normalizeApiVersion(data?.whatsapp_meta_api_version),
    phoneNumberId: clean(data?.whatsapp_phone_number_id, 80),
    wabaId: clean(data?.whatsapp_waba_id, 80),
    templateLanguage: clean(data?.whatsapp_template_language, 20) || "ar",
    orderStatusTemplate: clean(data?.whatsapp_order_status_template, 120) || "order_status_update",
    verifiedName: clean(data?.whatsapp_verified_name, 160),
    displayPhoneNumber: clean(data?.whatsapp_display_phone_number, 80),
    qualityRating: clean(data?.whatsapp_quality_rating, 40),
    lastTestedAt: clean(data?.whatsapp_last_tested_at, 80),
    lastTestStatus: clean(data?.whatsapp_last_test_status, 40),
    accessTokenConfigured: Boolean(Deno.env.get("META_WHATSAPP_ACCESS_TOKEN"))
  };
}
function getAccessToken() {
  const token = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
  if (!token) throw new Error("meta_access_token_missing");
  return token;
}
async function graphRequest(settings, path, init) {
  const response = await fetch(`https://graph.facebook.com/${settings.apiVersion}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Content-Type": "application/json"
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `meta_http_${response.status}`;
    throw new Error(`meta_whatsapp_error:${message}`);
  }
  return payload;
}
async function testWhatsAppConnection(supabase) {
  const settings = await getWhatsAppSettings(supabase);
  if (!settings.phoneNumberId) throw new Error("meta_phone_number_id_missing");
  const payload = await graphRequest(
    settings,
    `${encodeURIComponent(settings.phoneNumberId)}?fields=verified_name,display_phone_number,quality_rating`
  );
  return {
    verifiedName: clean(payload?.verified_name, 160),
    displayPhoneNumber: clean(payload?.display_phone_number, 80),
    qualityRating: clean(payload?.quality_rating, 40),
    phoneNumberId: clean(payload?.id, 80) || settings.phoneNumberId
  };
}
async function sendWhatsAppStatusTemplate(supabase, input) {
  const settings = await getWhatsAppSettings(supabase);
  if (!settings.enabled) return { skipped: true, reason: "whatsapp_disabled" };
  if (!settings.phoneNumberId) throw new Error("meta_phone_number_id_missing");
  if (!settings.accessTokenConfigured) throw new Error("meta_access_token_missing");
  const to = normalizeWhatsAppPhone(input.to);
  if (!/^\d{10,15}$/.test(to)) throw new Error("invalid_whatsapp_phone");
  const parameters = [
    clean(input.customerName, 160) || "\u0639\u0645\u064A\u0644 \u0644\u062D\u0638\u0629 \u0641\u0646",
    clean(input.orderNumber, 80),
    clean(input.statusLabel, 160),
    clean(input.trackingUrl, 500)
  ].map((text) => ({ type: "text", text }));
  const payload = await graphRequest(settings, `${encodeURIComponent(settings.phoneNumberId)}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: settings.orderStatusTemplate,
        language: { code: settings.templateLanguage },
        components: [{ type: "body", parameters }]
      }
    })
  });
  return {
    skipped: false,
    providerMessageId: clean(payload?.messages?.[0]?.id, 200),
    recipient: to
  };
}

// supabase/functions/whatsapp-api/index.ts
function clean2(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}
function getBearerToken(req) {
  return (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1] || "";
}
async function getAdminActor(req, supabase) {
  const token = getBearerToken(req);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: admins, error: adminError } = await supabase.from("admin_users").select("user_id, email");
  if (adminError) throw adminError;
  const email = String(data.user.email || "").toLowerCase();
  const allowed = !admins?.length || admins.some((admin) => String(admin.user_id || "") === data.user.id || String(admin.email || "").toLowerCase() === email);
  return allowed ? { id: data.user.id, email } : null;
}
var STATUS_LABELS = {
  pending_verification: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0623\u0643\u064A\u062F",
  confirmed: "\u062A\u0645 \u0627\u0644\u062A\u0623\u0643\u064A\u062F",
  processing: "\u0642\u064A\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632",
  attention_required: "\u064A\u062D\u062A\u0627\u062C \u0645\u062A\u0627\u0628\u0639\u0629",
  ready_for_delivery: "\u062C\u0627\u0647\u0632",
  shipped: "\u062A\u0645 \u0627\u0644\u0634\u062D\u0646",
  delivered: "\u062A\u0645 \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645",
  cancelled: "\u0645\u0644\u063A\u064A",
  returned: "\u0645\u0631\u062A\u062C\u0639",
  new: "\u062C\u062F\u064A\u062F",
  printing: "\u0637\u0628\u0627\u0639\u0629",
  done: "\u062C\u0627\u0647\u0632"
};
async function logWhatsApp(supabase, input) {
  const { error } = await supabase.from("customer_message_logs").insert(input);
  if (error && !/customer_message_logs|schema cache|relation|does not exist/i.test(error.message || "")) {
    console.error("WhatsApp message log failed:", error);
  }
}
Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  const supabase = getServiceClient();
  try {
    const actor = await getAdminActor(req, supabase);
    if (!actor) return jsonResponse({ error: "not_authorized" }, 403);
    const body = await req.json();
    const action = clean2(body?.action, 60);
    if (action === "get_settings") {
      return jsonResponse({ settings: await getWhatsAppSettings(supabase) });
    }
    if (action === "save_settings") {
      const apiVersion = clean2(body?.settings?.apiVersion, 16);
      if (!/^v\d+\.\d+$/.test(apiVersion)) return jsonResponse({ error: "invalid_meta_api_version" }, 400);
      const payload = {
        whatsapp_enabled: body?.settings?.enabled === true,
        whatsapp_provider: "meta",
        whatsapp_meta_api_version: apiVersion,
        whatsapp_phone_number_id: clean2(body?.settings?.phoneNumberId, 80) || null,
        whatsapp_waba_id: clean2(body?.settings?.wabaId, 80) || null,
        whatsapp_template_language: clean2(body?.settings?.templateLanguage, 20) || "ar",
        whatsapp_order_status_template: clean2(body?.settings?.orderStatusTemplate, 120) || "order_status_update"
      };
      const { error } = await supabase.from("settings").update(payload).eq("id", 1);
      if (error) throw error;
      return jsonResponse({ settings: await getWhatsAppSettings(supabase) });
    }
    if (action === "test_connection") {
      try {
        const result = await testWhatsAppConnection(supabase);
        await supabase.from("settings").update({
          whatsapp_last_tested_at: (/* @__PURE__ */ new Date()).toISOString(),
          whatsapp_last_test_status: "connected",
          whatsapp_verified_name: result.verifiedName || null,
          whatsapp_display_phone_number: result.displayPhoneNumber || null,
          whatsapp_quality_rating: result.qualityRating || null
        }).eq("id", 1);
        return jsonResponse({ ok: true, connection: result });
      } catch (error) {
        await supabase.from("settings").update({
          whatsapp_last_tested_at: (/* @__PURE__ */ new Date()).toISOString(),
          whatsapp_last_test_status: "failed"
        }).eq("id", 1);
        throw error;
      }
    }
    if (action === "send_test") {
      const result = await sendWhatsAppStatusTemplate(supabase, {
        to: body?.phone,
        customerName: "\u0639\u0645\u064A\u0644 \u062A\u062C\u0631\u064A\u0628\u064A",
        orderNumber: "TEST-001",
        statusLabel: "\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u062A\u0635\u0627\u0644 \u0646\u0627\u062C\u062D",
        trackingUrl: "https://www.art-moment.com/track"
      });
      return jsonResponse({ ok: true, result });
    }
    if (action === "send_order_status") {
      const orderType = body?.orderType === "store" ? "store" : "print";
      const table = orderType === "store" ? "store_orders" : "orders";
      const orderId = clean2(body?.orderId, 100);
      if (!orderId) return jsonResponse({ error: "order_id_required" }, 400);
      const { data: order, error: orderError } = await supabase.from(table).select("*").eq("id", orderId).maybeSingle();
      if (orderError) throw orderError;
      if (!order) return jsonResponse({ error: "order_not_found" }, 404);
      const orderNumber = clean2(order.short_id || order.id, 80).slice(0, 12);
      const statusLabel = STATUS_LABELS[clean2(order.status, 80)] || clean2(body?.statusLabel || order.status, 160);
      const metadata = { provider: "meta", orderType, orderId, orderNumber, status: order.status };
      try {
        const result = await sendWhatsAppStatusTemplate(supabase, {
          to: order.phone,
          customerName: order.customer_name || order.name,
          orderNumber,
          statusLabel,
          trackingUrl: "https://www.art-moment.com/track"
        });
        if (!result.skipped) {
          await logWhatsApp(supabase, {
            customer_id: order.customer_id || null,
            channel: "whatsapp",
            type: "order_status",
            subject: `\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0637\u0644\u0628 #${orderNumber}`,
            body: statusLabel,
            status: "sent",
            sent_at: (/* @__PURE__ */ new Date()).toISOString(),
            provider_id: result.providerMessageId || null,
            metadata: { ...metadata, providerMessageId: result.providerMessageId || null }
          });
        }
        return jsonResponse({ ok: true, result });
      } catch (sendError) {
        await logWhatsApp(supabase, {
          customer_id: order.customer_id || null,
          channel: "whatsapp",
          type: "order_status",
          subject: `\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0637\u0644\u0628 #${orderNumber}`,
          body: statusLabel,
          status: "failed",
          error_message: sendError instanceof Error ? sendError.message : "whatsapp_send_failed",
          metadata
        });
        throw sendError;
      }
    }
    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (error) {
    console.error("whatsapp-api error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "whatsapp_api_failed" }, 500);
  }
});
