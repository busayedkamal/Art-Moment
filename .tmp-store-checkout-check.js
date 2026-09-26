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

// supabase/functions/_shared/customerToken.ts
var TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
function getSigningSecret() {
  const secret = Deno.env.get("CUSTOMER_SESSION_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("customer_session_secret_missing");
  return secret;
}
function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}
function base64UrlToText(value) {
  return new TextDecoder().decode(base64UrlToBytes(value));
}
function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}
async function signTokenPayload(data) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSigningSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return bytesToBase64Url(new Uint8Array(signature));
}
async function verifyCustomerSessionToken(token) {
  const value = String(token ?? "").trim();
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return null;
  const expectedSignature = await signTokenPayload(encodedPayload);
  if (!timingSafeEqual(signature, expectedSignature)) return null;
  const payload = JSON.parse(base64UrlToText(encodedPayload));
  if (payload.aud !== "customer" || !payload.sub || !payload.exp) return null;
  if (Math.floor(Date.now() / 1e3) > payload.exp) return null;
  return payload;
}

// supabase/functions/_shared/email.ts
var RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";
function getProviderError(result) {
  const payload = result && typeof result === "object" ? result : {};
  const nested = payload.error && typeof payload.error === "object" ? payload.error : {};
  return {
    name: String(payload.name || nested.name || ""),
    message: String(payload.message || nested.message || "")
  };
}
function getEmailFailureCode(status, result) {
  const providerError = getProviderError(result);
  const message = `${providerError.name} ${providerError.message}`.toLowerCase();
  if (/only send testing emails to your own|testing emails to your own email/.test(message)) {
    return "email_testing_recipient_restricted";
  }
  if (/domain.+not verified|not verified.+domain/.test(message)) {
    return "email_sender_domain_not_verified";
  }
  if (/invalid api key|api key is invalid/.test(message)) {
    return "email_api_key_invalid";
  }
  if (status === 429 || /rate.?limit|too many requests/.test(message)) {
    return "email_rate_limited";
  }
  if (/invalid.+from|from.+invalid|sender.+invalid/.test(message)) {
    return "email_sender_invalid";
  }
  if (/validation_error|validation error/.test(message)) {
    return "email_validation_failed";
  }
  return "email_send_failed";
}
async function sendEmail({ to, subject, html, text, tags }) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM") || "Art Moment <onboarding@resend.dev>";
  const replyTo = Deno.env.get("RESEND_REPLY_TO") || "art.moment26@gmail.com";
  if (!apiKey) {
    throw new Error("email_api_key_missing");
  }
  const response = await fetch(RESEND_EMAIL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
      tags,
      reply_to: replyTo || void 0
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failureCode = getEmailFailureCode(response.status, result);
    console.error("Resend email failed:", {
      status: response.status,
      failureCode,
      provider: getProviderError(result)
    });
    throw new Error(failureCode);
  }
  return result;
}

// supabase/functions/_shared/phone.ts
function normalizeSaudiPhone(input) {
  const digits = String(input ?? "").replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("00966")) local = local.slice(5);
  if (local.startsWith("966")) local = local.slice(3);
  if (local.startsWith("0")) local = local.slice(1);
  if (local.length === 9 && local.startsWith("5")) return `0${local}`;
  return digits;
}
function phoneVariants(input) {
  const normalized = normalizeSaudiPhone(input);
  const digits = normalized.replace(/\D/g, "");
  const local = digits.startsWith("0") ? digits.slice(1) : digits;
  return Array.from(new Set([
    normalized,
    digits,
    local,
    local ? `0${local}` : "",
    local ? `966${local}` : "",
    local ? `+966${local}` : "",
    local ? `00966${local}` : ""
  ].filter(Boolean)));
}
function isValidSaudiMobile(input) {
  return /^05\d{8}$/.test(normalizeSaudiPhone(input));
}

// supabase/functions/_shared/storeCoupons.ts
function normalizeCouponCode(value) {
  return String(value || "").trim().toUpperCase().slice(0, 40);
}
async function calculateStoreCouponDiscount(supabase, codeInput, subtotalInput, scopedSubtotals) {
  const code = normalizeCouponCode(codeInput);
  const subtotal = Math.max(0, Number(subtotalInput || 0));
  if (!code) return null;
  if (subtotal <= 0) throw new Error("empty_cart");
  let couponResult = await supabase.from("coupons").select("code, discount_type, discount_amount, is_active, scope").ilike("code", code).eq("is_active", true).limit(1).maybeSingle();
  if (couponResult.error && /scope|schema cache|column/i.test(couponResult.error.message || "")) {
    couponResult = await supabase.from("coupons").select("code, discount_type, discount_amount, is_active").ilike("code", code).eq("is_active", true).limit(1).maybeSingle();
  }
  const { data: coupon, error } = couponResult;
  if (error) throw error;
  if (!coupon) throw new Error("invalid_coupon");
  const typedCoupon = coupon;
  const scope = ["products", "print"].includes(String(typedCoupon.scope)) ? typedCoupon.scope : "all";
  const eligibleSubtotal = scope === "products" ? Math.max(0, Number(scopedSubtotals?.products || 0)) : scope === "print" ? Math.max(0, Number(scopedSubtotals?.print || 0)) : subtotal;
  if (eligibleSubtotal <= 0) throw new Error("coupon_scope_empty");
  const rawAmount = Math.max(0, Number(typedCoupon.discount_amount || 0));
  const discountValue = typedCoupon.discount_type === "percent" ? eligibleSubtotal * Math.min(rawAmount, 100) / 100 : rawAmount;
  const safeDiscount = Math.min(eligibleSubtotal, Number(discountValue.toFixed(2)));
  return {
    code: typedCoupon.code,
    discountType: typedCoupon.discount_type === "percent" ? "percent" : "fixed",
    discountAmount: rawAmount,
    discountValue: safeDiscount,
    subtotal,
    totalAfterDiscount: Math.max(0, Number((subtotal - safeDiscount).toFixed(2))),
    scope,
    scopeLabel: scope === "products" ? "\u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0641\u0642\u0637" : scope === "print" ? "\u0627\u0644\u0637\u0628\u0627\u0639\u0629 \u0641\u0642\u0637" : "\u0643\u0644 \u0627\u0644\u0637\u0644\u0628"
  };
}

// supabase/functions/_shared/printDrafts.ts
async function hashPrintDraftToken(token) {
  const bytes = new TextEncoder().encode(String(token || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function verifyPrintDraftAccess(supabase, draftId, accessToken, options = {}) {
  if (!draftId || !accessToken) throw new Error("print_draft_access_required");
  const { data: draft, error } = await supabase.from("print_drafts").select("*").eq("id", draftId).maybeSingle();
  if (error) throw error;
  if (!draft) throw new Error("print_draft_not_found");
  const tokenHash = await hashPrintDraftToken(accessToken);
  if (tokenHash !== draft.access_token_hash) throw new Error("print_draft_access_denied");
  if (new Date(draft.expires_at).getTime() <= Date.now()) throw new Error("print_draft_expired");
  if (!options.allowOrdered && ["ordered", "cancelled", "expired"].includes(String(draft.status))) {
    throw new Error("print_draft_locked");
  }
  return draft;
}
async function getPrintUnitPrice(supabase, printSize, totalCopies, variantId) {
  const { data: settings, error } = await supabase.from("settings").select("a4_price, a5_price, photo_4x6_price, is_dynamic_pricing_enabled, tier_1_limit, tier_1_price, tier_2_limit, tier_2_price, tier_3_price").eq("id", 1).maybeSingle();
  if (error) throw error;
  if (variantId) {
    const { data: variant, error: variantError } = await supabase.from("print_variants").select("pricing_mode, unit_price, is_active, is_available").eq("id", variantId).maybeSingle();
    if (variantError) throw variantError;
    if (!variant || !variant.is_active || variant.is_available === false) {
      throw new Error("print_variant_unavailable");
    }
    if (variant.pricing_mode === "fixed") {
      const fixedPrice = Number(Number(variant.unit_price || 0).toFixed(2));
      if (fixedPrice <= 0) throw new Error("print_variant_unavailable");
      return fixedPrice;
    }
    if (["existing_a4", "existing_a5"].includes(variant.pricing_mode)) {
      const sizePrice = Number(Number(settings?.[variant.pricing_mode === "existing_a5" ? "a5_price" : "a4_price"] || 0).toFixed(2));
      if (sizePrice <= 0) throw new Error("print_variant_unavailable");
      return sizePrice;
    }
  } else if (["A4", "A5"].includes(printSize)) {
    const sizePrice = Number(Number(settings?.[printSize === "A5" ? "a5_price" : "a4_price"] || 0).toFixed(2));
    if (sizePrice <= 0) throw new Error("print_variant_unavailable");
    return sizePrice;
  }
  let price = Number(settings?.photo_4x6_price || 0);
  if (settings?.is_dynamic_pricing_enabled) {
    if (totalCopies <= Number(settings?.tier_1_limit || 0)) price = Number(settings?.tier_1_price || price);
    else if (totalCopies <= Number(settings?.tier_2_limit || 0)) price = Number(settings?.tier_2_price || price);
    else price = Number(settings?.tier_3_price || price);
  }
  const normalizedPrice = Number(price.toFixed(2));
  if (normalizedPrice <= 0) throw new Error("print_variant_unavailable");
  return normalizedPrice;
}
async function recalculatePrintDraft(supabase, draftId) {
  const { data: draft, error: draftError } = await supabase.from("print_drafts").select("*").eq("id", draftId).single();
  if (draftError) throw draftError;
  if (draft.status === "ready" && draft.snapshot_at) {
    return { draft };
  }
  const { data: files, error: filesError } = await supabase.from("print_draft_files").select("copies").eq("draft_id", draftId).eq("upload_status", "uploaded");
  if (filesError) throw filesError;
  const fileCount = files?.length || 0;
  const totalCopies = (files || []).reduce((sum, file) => sum + Number(file.copies || 0), 0);
  const unitPrice = await getPrintUnitPrice(supabase, draft.print_size, totalCopies, draft.variant_id);
  const subtotal = Number((unitPrice * totalCopies).toFixed(2));
  const nextStatus = draft.status === "ready" && fileCount > 0 ? "ready" : fileCount > 0 ? "uploading" : "draft";
  const { data: updated, error: updateError } = await supabase.from("print_drafts").update({
    file_count: fileCount,
    total_copies: totalCopies,
    unit_price: unitPrice,
    subtotal,
    status: nextStatus,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", draftId).select("*").single();
  if (updateError) throw updateError;
  return { draft: updated };
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

// supabase/functions/store-checkout/index.ts
function generatePin() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(1e3 + values[0] % 9e3);
}
function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}
function getStockRpcErrorMessage(error) {
  const message = String(error?.message || "");
  if (/product_out_of_stock/i.test(message)) return "product_out_of_stock";
  if (/product_unavailable/i.test(message)) return "product_unavailable";
  if (/invalid_stock_items/i.test(message)) return "invalid_stock_items";
  if (/not_authorized/i.test(message)) return "not_authorized";
  return "stock_reservation_failed";
}
function normalizeProductOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return [];
  return rawOptions.map((rawOption, optionIndex) => {
    const option = rawOption && typeof rawOption === "object" ? rawOption : {};
    const id = String(option.id || `option_${optionIndex + 1}`).trim();
    const values = Array.isArray(option.values) ? option.values.map((rawValue) => {
      const valueObject = rawValue && typeof rawValue === "object" ? rawValue : { value: rawValue, label: rawValue };
      const value = String(valueObject.value || valueObject.label || "").trim();
      return {
        value,
        priceDelta: Number(valueObject.priceDelta || valueObject.price_delta || 0),
        available: valueObject.available !== false
      };
    }).filter((value) => value.value) : [];
    return {
      id,
      required: option.required !== false,
      values
    };
  }).filter((option) => option.id && option.values.length > 0);
}
function resolveProductOptions(rawOptions, rawSelections) {
  const productOptions = normalizeProductOptions(rawOptions);
  const selections = rawSelections && typeof rawSelections === "object" && !Array.isArray(rawSelections) ? rawSelections : {};
  const normalizedSelections = {};
  let priceDelta = 0;
  for (const option of productOptions) {
    const selectedValue = String(selections[option.id] || "").trim();
    const matchedValue = option.values.find((value) => value.value === selectedValue);
    if (option.required && !matchedValue) throw new Error("invalid_product_options");
    if (matchedValue?.available === false) throw new Error("product_option_unavailable");
    if (matchedValue) {
      normalizedSelections[option.id] = matchedValue.value;
      priceDelta += Number(matchedValue.priceDelta || 0);
    }
  }
  return {
    selections: normalizedSelections,
    priceDelta
  };
}
async function sendWhatsAppConfirmation(supabase, order) {
  return sendWhatsAppStatusTemplate(supabase, {
    to: order.phone,
    customerName: order.customer_name,
    orderNumber: String(order.short_id || order.id).slice(0, 12),
    statusLabel: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0623\u0643\u064A\u062F",
    trackingUrl: "https://www.art-moment.com/track"
  });
}
function orderEmailHtml(order, trackingToken, coupon, rewards) {
  const orderNumber = String(order.short_id || order.id).slice(0, 6);
  const totalAmount = Number(order.total_amount || 0).toFixed(2);
  const discount = Number(coupon?.discountValue || 0);
  const rewardPoints = Number(rewards?.points || 0);
  const rewardValue = Number(rewards?.value || 0);
  const amountDue = Math.max(0, Number(totalAmount) - rewardValue);
  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#4A4A4A;background:#F8F5F2;padding:28px">
      <div style="max-width:560px;margin:auto;background:#fff;border:1px solid #ead8da;border-radius:24px;padding:28px">
        <p style="margin:0 0 8px;color:#C5A059;font-weight:700">\u0644\u062D\u0638\u0629 \u0641\u0646 Art Moment</p>
        <h2 style="margin:0 0 12px;color:#4A4A4A">\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628\u0643 \u0628\u0646\u062C\u0627\u062D</h2>
        <p style="margin:0 0 18px">\u0634\u0643\u0631\u0627\u064B \u0644\u0627\u062E\u062A\u064A\u0627\u0631\u0643 \u0644\u062D\u0638\u0629 \u0641\u0646. \u0648\u0635\u0644\u0646\u0627 \u0637\u0644\u0628\u0643 \u0648\u0647\u0648 \u0627\u0644\u0622\u0646 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0623\u0643\u064A\u062F \u0648\u0627\u0644\u062F\u0641\u0639.</p>
        <div style="background:#F8F5F2;border-radius:18px;padding:16px;margin:16px 0">
          <p style="margin:0">\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628: <strong>#${orderNumber}</strong></p>
          <p style="margin:6px 0 0">\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A: <strong>${totalAmount} \u0631\u064A\u0627\u0644</strong></p>
          ${discount > 0 ? `<p style="margin:6px 0 0;color:#059669">\u0627\u0644\u062E\u0635\u0645: <strong>${discount.toFixed(2)} \u0631\u064A\u0627\u0644</strong></p>` : ""}
          ${rewardPoints > 0 ? `<p style="margin:6px 0 0;color:#B97882">\u0645\u062F\u0641\u0648\u0639 \u0628\u0627\u0644\u0646\u0642\u0627\u0637: <strong>${rewardPoints} \u0646\u0642\u0637\u0629 (${rewardValue.toFixed(2)} \u0631\u064A\u0627\u0644)</strong></p>` : ""}
          <p style="margin:6px 0 0">\u0627\u0644\u0645\u062A\u0628\u0642\u064A \u0644\u0644\u062F\u0641\u0639: <strong>${amountDue.toFixed(2)} \u0631\u064A\u0627\u0644</strong></p>
          <p style="margin:6px 0 0">\u0631\u0645\u0632 \u0627\u0644\u062A\u062A\u0628\u0639 \u0627\u0644\u0622\u0645\u0646: <strong>${trackingToken}</strong></p>
        </div>
        <p style="font-size:13px;color:#777;margin:0">\u064A\u0645\u0643\u0646\u0643 \u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0637\u0644\u0628 \u0645\u0646 \u0635\u0641\u062D\u0629 \u0637\u0644\u0628\u0627\u062A\u064A \u062F\u0627\u062E\u0644 \u0627\u0644\u0645\u062A\u062C\u0631.</p>
      </div>
    </div>
  `;
}
Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  const supabase = getServiceClient();
  let createdOrderId = null;
  let stockReserved = false;
  let reservedStockItems = [];
  let redeemedRewardPoints = false;
  let rewardWalletId = null;
  let rewardOrderValue = 0;
  let orderedPrintDraftIds = [];
  let createdGuestCustomerId = null;
  try {
    const body = await req.json();
    const customer = body?.customer || {};
    const payment = body?.payment || {};
    const couponCode = body?.couponCode;
    const idempotencyKey = String(body?.idempotencyKey || "").trim().slice(0, 120) || null;
    const requestedRewardPoints = Math.max(0, Math.floor(Number(body?.rewardPoints || 0)));
    const items = Array.isArray(body?.items) ? body.items : [];
    let phone = normalizeSaudiPhone(customer.phone);
    let customerEmail = normalizeEmail(customer.email);
    const allowedPaymentMethods = /* @__PURE__ */ new Set(["bank_transfer", "cash_on_delivery", "card", "wallet", "manual", "other"]);
    const paymentMethod = allowedPaymentMethods.has(String(payment.method)) ? String(payment.method) : "bank_transfer";
    const normalizedItems = items.filter((item) => item.itemType !== "print").map((item) => ({
      product_id: Number(item.id),
      quantity: Math.max(1, Number(item.qty || item.quantity || 1)),
      selected_options: item.selectedOptions && typeof item.selectedOptions === "object" ? item.selectedOptions : {}
    })).filter((item) => Number.isFinite(item.product_id) && item.quantity > 0);
    const printItems = items.filter((item) => item.itemType === "print").map((item) => ({
      draft_id: String(item.printDraftId || ""),
      access_token: String(item.printDraftToken || "")
    })).filter((item) => item.draft_id && item.access_token);
    if (normalizedItems.length === 0 && printItems.length === 0) {
      return jsonResponse({ error: "empty_cart" }, 400);
    }
    let verifiedCustomerId = null;
    let verifiedCustomerName = "";
    let verifiedCustomerEmail = "";
    let isAuthenticatedCustomer = false;
    const tokenPayload = await verifyCustomerSessionToken(customer.sessionToken);
    if (tokenPayload?.sub) {
      const { data: tokenCustomer, error: tokenCustomerError } = await supabase.from("customers").select("id, name, email, phone").eq("id", tokenPayload.sub).maybeSingle();
      if (tokenCustomerError) throw tokenCustomerError;
      const accountPhone = normalizeSaudiPhone(tokenCustomer?.phone);
      if (tokenCustomer && isValidSaudiMobile(accountPhone)) {
        verifiedCustomerId = String(tokenCustomer.id);
        verifiedCustomerName = String(tokenCustomer.name || "").trim();
        verifiedCustomerEmail = String(tokenCustomer.email || "").trim();
        customerEmail = normalizeEmail(tokenCustomer.email);
        phone = accountPhone;
        isAuthenticatedCustomer = true;
      }
    }
    if (!isValidSaudiMobile(phone) || !customerEmail || !String(customer.name || verifiedCustomerName || "").trim()) {
      return jsonResponse({ error: "invalid_customer_details" }, 400);
    }
    if (!verifiedCustomerId) {
      const variants2 = phoneVariants(phone);
      const [phoneMatchResult, emailMatchResult] = await Promise.all([
        supabase.from("customers").select("id, name, email, phone").in("phone", variants2).limit(1).maybeSingle(),
        supabase.from("customers").select("id, name, email, phone").ilike("email", customerEmail).limit(1).maybeSingle()
      ]);
      if (phoneMatchResult.error) throw phoneMatchResult.error;
      if (emailMatchResult.error) throw emailMatchResult.error;
      const phoneMatch = phoneMatchResult.data;
      const emailMatch = emailMatchResult.data;
      if (phoneMatch && emailMatch && phoneMatch.id !== emailMatch.id) {
        return jsonResponse({ error: "customer_identity_conflict" }, 409);
      }
      const guestCustomer = phoneMatch || emailMatch;
      if (guestCustomer) {
        const exactPhone = normalizeSaudiPhone(guestCustomer.phone) === phone;
        const exactEmail = normalizeEmail(guestCustomer.email) === customerEmail;
        if (!exactPhone || !exactEmail) {
          return jsonResponse({ error: "guest_customer_exists_login_required" }, 409);
        }
        verifiedCustomerId = String(guestCustomer.id);
        verifiedCustomerName = String(guestCustomer.name || "").trim();
        verifiedCustomerEmail = normalizeEmail(guestCustomer.email);
      } else {
        let guestInsert = await supabase.from("customers").insert({
          name: String(customer.name || "\u0639\u0645\u064A\u0644 \u0627\u0644\u0645\u062A\u062C\u0631").trim(),
          email: customerEmail,
          phone,
          password_hash: null,
          marketing_opt_in: false,
          account_origin: "store_guest"
        }).select("id, name, email, phone").single();
        if (guestInsert.error && /account_origin|schema cache|column/i.test(guestInsert.error.message || "")) {
          guestInsert = await supabase.from("customers").insert({
            name: String(customer.name || "\u0639\u0645\u064A\u0644 \u0627\u0644\u0645\u062A\u062C\u0631").trim(),
            email: customerEmail,
            phone,
            password_hash: null,
            marketing_opt_in: false
          }).select("id, name, email, phone").single();
        }
        if (guestInsert.error) throw guestInsert.error;
        verifiedCustomerId = String(guestInsert.data.id);
        verifiedCustomerName = String(guestInsert.data.name || "").trim();
        verifiedCustomerEmail = normalizeEmail(guestInsert.data.email);
        createdGuestCustomerId = verifiedCustomerId;
      }
    }
    if (idempotencyKey && verifiedCustomerId) {
      const existingOrderResult = await supabase.from("store_orders").select("id, short_id, tracking_access_token, customer_id, total_amount, subtotal_amount, discount_amount, coupon_code, reward_points_used, points_used_amount").eq("checkout_idempotency_key", idempotencyKey).maybeSingle();
      if (!existingOrderResult.error && existingOrderResult.data?.customer_id === verifiedCustomerId) {
        const existingOrder = existingOrderResult.data;
        return jsonResponse({
          order: {
            ...existingOrder,
            amount_due: Math.max(0, Number(existingOrder.total_amount || 0) - Number(existingOrder.points_used_amount || 0))
          },
          tracking_token: existingOrder.tracking_access_token,
          idempotent: true
        });
      }
      if (existingOrderResult.error && !/checkout_idempotency_key|schema cache|column/i.test(existingOrderResult.error.message || "")) {
        throw existingOrderResult.error;
      }
    }
    const productIds = normalizedItems.map((item) => item.product_id);
    let products = [];
    if (productIds.length > 0) {
      const productResult = await supabase.from("products").select("id, name, price, image, in_stock, stock_quantity, product_options").in("id", productIds);
      if (productResult.error) throw productResult.error;
      products = productResult.data || [];
    }
    const productById = new Map((products || []).map((product) => [String(product.id), product]));
    let productsSubtotal = 0;
    const orderItems = normalizedItems.map((item) => {
      const product = productById.get(String(item.product_id));
      if (!product || product.in_stock === false) throw new Error("product_unavailable");
      const stockQuantity = product.stock_quantity;
      if (stockQuantity !== null && stockQuantity !== void 0 && Number(stockQuantity) < item.quantity) {
        throw new Error("product_out_of_stock");
      }
      const resolvedOptions = resolveProductOptions(product.product_options, item.selected_options);
      const price = Number((Number(product.price || 0) + resolvedOptions.priceDelta).toFixed(2));
      productsSubtotal += price * item.quantity;
      return {
        product_id: item.product_id,
        item_type: "product",
        item_name: String(product.name || "\u0645\u0646\u062A\u062C \u0645\u0646 \u0644\u062D\u0638\u0629 \u0641\u0646"),
        item_image: product.image || null,
        status: "pending",
        quantity: item.quantity,
        price_at_time: price,
        selected_options: resolvedOptions.selections
      };
    });
    const printDraftsForOrder = [];
    let printSubtotal = 0;
    for (const printItem of printItems) {
      const accessedDraft = await verifyPrintDraftAccess(supabase, printItem.draft_id, printItem.access_token);
      let readyDraft = accessedDraft;
      if (!readyDraft.snapshot_at) {
        const recalculated = await recalculatePrintDraft(supabase, accessedDraft.id);
        const { data: snapshottedDraft, error: snapshotError } = await supabase.from("print_drafts").update({
          snapshot_unit_price: recalculated.draft.unit_price,
          snapshot_subtotal: recalculated.draft.subtotal,
          snapshot_total_copies: recalculated.draft.total_copies,
          snapshot_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", accessedDraft.id).eq("status", "ready").select("*").single();
        if (snapshotError) throw snapshotError;
        readyDraft = snapshottedDraft;
      }
      if (readyDraft.status !== "ready" || Number(readyDraft.file_count || 0) < 1) {
        throw new Error("print_draft_not_ready");
      }
      if (readyDraft.variant_id) {
        const { data: activeVariant, error: variantError } = await supabase.from("print_variants").select("is_active, is_available").eq("id", readyDraft.variant_id).maybeSingle();
        if (variantError) throw variantError;
        if (!activeVariant?.is_active || activeVariant?.is_available === false) {
          throw new Error("print_variant_unavailable");
        }
      }
      const snapshotUnitPrice = Number(readyDraft.snapshot_unit_price ?? readyDraft.unit_price ?? 0);
      const snapshotSubtotal = Number(readyDraft.snapshot_subtotal ?? readyDraft.subtotal ?? 0);
      const snapshotTotalCopies = Number(readyDraft.snapshot_total_copies ?? readyDraft.total_copies ?? 0);
      if (snapshotUnitPrice <= 0 || snapshotSubtotal <= 0 || snapshotTotalCopies < 1) {
        throw new Error("print_snapshot_invalid");
      }
      printSubtotal += snapshotSubtotal;
      printDraftsForOrder.push(readyDraft);
      orderItems.push({
        product_id: null,
        item_type: "print",
        item_name: `\u0637\u0628\u0627\u0639\u0629 \u0635\u0648\u0631 ${readyDraft.print_size}`,
        status: "files_received",
        print_draft_id: readyDraft.id,
        quantity: snapshotTotalCopies,
        price_at_time: snapshotUnitPrice,
        selected_options: {
          print_size: readyDraft.print_size,
          material: readyDraft.material,
          surface: readyDraft.surface,
          border_style: readyDraft.border_style,
          fit_mode: readyDraft.fit_mode
        },
        metadata: {
          file_count: Number(readyDraft.file_count || 0),
          total_copies: snapshotTotalCopies,
          unit_price: snapshotUnitPrice,
          total_price: snapshotSubtotal,
          snapshot_at: readyDraft.snapshot_at,
          variant_id: readyDraft.variant_id,
          original_files_private: true
        }
      });
    }
    const subtotal = Number((productsSubtotal + printSubtotal).toFixed(2));
    const coupon = await calculateStoreCouponDiscount(supabase, couponCode, subtotal, {
      products: productsSubtotal,
      print: printSubtotal
    });
    const discountAmount = Number(coupon?.discountValue || 0);
    const finalTotal = Math.max(0, Number((subtotal - discountAmount).toFixed(2)));
    rewardOrderValue = finalTotal;
    const variants = phoneVariants(phone);
    const { data: matchingWallets, error: walletError } = await supabase.from("wallets").select("id, subscription_code, reward_points_balance, points_balance").in("phone", variants);
    if (walletError) throw walletError;
    const existingWallet = (matchingWallets || []).sort((left, right) => {
      const leftPoints = Number(left.reward_points_balance ?? Math.round(Number(left.points_balance || 0) / 0.01));
      const rightPoints = Number(right.reward_points_balance ?? Math.round(Number(right.points_balance || 0) / 0.01));
      return rightPoints - leftPoints || Number(right.id || 0) - Number(left.id || 0);
    })[0];
    let customerPin = existingWallet?.subscription_code;
    let activeWallet = existingWallet;
    if (!existingWallet) {
      customerPin = generatePin();
      const { data: createdWallet, error: createWalletError } = await supabase.from("wallets").insert({
        phone,
        subscription_code: customerPin,
        points_balance: 0,
        reward_points_balance: 0,
        total_spent: 0
      }).select("id, subscription_code, reward_points_balance, points_balance").single();
      if (createWalletError) throw createWalletError;
      activeWallet = createdWallet;
    }
    const { data: rewardSettings, error: rewardSettingsError } = await supabase.from("settings").select("reward_program_enabled, reward_point_value, reward_minimum_redemption_points, reward_maximum_redemption_percent").eq("id", 1).maybeSingle();
    if (rewardSettingsError) throw rewardSettingsError;
    const pointValue = Number(rewardSettings?.reward_point_value || 0.01);
    const minimumRedemptionPoints = Number(rewardSettings?.reward_minimum_redemption_points || 500);
    const maximumRedemptionPercent = Number(rewardSettings?.reward_maximum_redemption_percent || 25);
    const availableRewardPoints = Number(activeWallet?.reward_points_balance ?? Math.round(Number(activeWallet?.points_balance || 0) / pointValue));
    const maximumRewardPoints = Math.max(0, Math.min(
      availableRewardPoints,
      Math.floor(finalTotal * maximumRedemptionPercent / 100 / pointValue)
    ));
    if (requestedRewardPoints > 0) {
      if (!isAuthenticatedCustomer) return jsonResponse({ error: "reward_login_required" }, 401);
      if (rewardSettings?.reward_program_enabled === false) {
        return jsonResponse({ error: "reward_program_disabled" }, 409);
      }
      if (requestedRewardPoints < minimumRedemptionPoints) {
        return jsonResponse({ error: "reward_minimum_redemption_not_met" }, 409);
      }
      if (requestedRewardPoints > availableRewardPoints) {
        return jsonResponse({ error: "reward_points_balance_insufficient" }, 409);
      }
      if (requestedRewardPoints > maximumRewardPoints) {
        return jsonResponse({ error: "reward_redemption_limit_exceeded" }, 409);
      }
    }
    const pointsUsedAmount = Number((requestedRewardPoints * pointValue).toFixed(2));
    rewardWalletId = Number(activeWallet?.id || 0) || null;
    const orderPayload = {
      customer_name: String(customer.name || verifiedCustomerName || "\u0639\u0645\u064A\u0644 \u0627\u0644\u0645\u062A\u062C\u0631").trim(),
      phone,
      subtotal_amount: subtotal,
      discount_amount: discountAmount,
      coupon_code: coupon?.code || null,
      total_amount: finalTotal,
      amount_paid: 0,
      reward_points_used: requestedRewardPoints,
      points_used_amount: pointsUsedAmount,
      delivery_fee: 0,
      payment_status: "pending_payment",
      payment_method: paymentMethod,
      payment_reference: null,
      payment_failed_reason: null,
      refunded_amount: 0,
      payment_updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      notes: String(customer.notes || "").trim() || null,
      city: String(customer.city || "").trim() || null,
      district: String(customer.district || "").trim() || null,
      street: String(customer.street || "").trim() || null,
      building_number: String(customer.buildingNumber || "").trim() || null,
      postal_code: String(customer.postalCode || "").trim() || null
    };
    if (idempotencyKey) orderPayload.checkout_idempotency_key = idempotencyKey;
    if (verifiedCustomerId) orderPayload.customer_id = verifiedCustomerId;
    reservedStockItems = normalizedItems.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity
    }));
    if (reservedStockItems.length > 0) {
      const { error: reserveStockError } = await supabase.rpc("reserve_store_stock", {
        items: reservedStockItems
      });
      if (reserveStockError) throw new Error(getStockRpcErrorMessage(reserveStockError));
      stockReserved = true;
    }
    let orderInsert = await supabase.from("store_orders").insert(orderPayload).select("id, short_id, tracking_access_token, customer_name, phone, total_amount").single();
    if (orderInsert.error?.code === "23505" && idempotencyKey) {
      if (stockReserved && reservedStockItems.length > 0) {
        const { error: restoreError } = await supabase.rpc("restore_store_stock", {
          items: reservedStockItems
        });
        if (restoreError) throw restoreError;
        stockReserved = false;
      }
      if (createdGuestCustomerId) {
        const { error: guestCleanupError } = await supabase.from("customers").delete().eq("id", createdGuestCustomerId).is("password_hash", null);
        if (guestCleanupError) throw guestCleanupError;
        createdGuestCustomerId = null;
      }
      const { data: existingOrder, error: existingOrderError } = await supabase.from("store_orders").select("id, short_id, tracking_access_token, customer_id, total_amount, subtotal_amount, discount_amount, coupon_code, reward_points_used, points_used_amount").eq("checkout_idempotency_key", idempotencyKey).maybeSingle();
      if (existingOrderError || !existingOrder) {
        throw existingOrderError || orderInsert.error;
      }
      return jsonResponse({
        order: {
          ...existingOrder,
          amount_due: Math.max(0, Number(existingOrder.total_amount || 0) - Number(existingOrder.points_used_amount || 0))
        },
        tracking_token: existingOrder.tracking_access_token,
        idempotent: true
      });
    }
    if (orderInsert.error && /reward_points_used|points_used_amount/i.test(orderInsert.error.message || "")) {
      throw new Error("reward_points_migration_required");
    }
    const isSchemaCompatibilityError = Boolean(orderInsert.error) && (["42703", "PGRST204"].includes(String(orderInsert.error?.code || "")) || /schema cache|column .* does not exist/i.test(orderInsert.error?.message || ""));
    if (orderInsert.error && isSchemaCompatibilityError) {
      if (/customer_id/i.test(orderInsert.error.message || "")) delete orderPayload.customer_id;
      if (/checkout_idempotency_key/i.test(orderInsert.error.message || "")) delete orderPayload.checkout_idempotency_key;
      if (/building_number|postal_code/i.test(orderInsert.error.message || "")) {
        delete orderPayload.building_number;
        delete orderPayload.postal_code;
      }
      if (/subtotal_amount|discount_amount|coupon_code|schema cache|column/i.test(orderInsert.error.message || "")) {
        delete orderPayload.subtotal_amount;
        delete orderPayload.discount_amount;
        delete orderPayload.coupon_code;
      }
      if (/payment_status|payment_method|payment_reference|payment_failed_reason|refunded_amount|payment_updated_at|schema cache|column/i.test(orderInsert.error.message || "")) {
        delete orderPayload.payment_status;
        delete orderPayload.payment_method;
        delete orderPayload.payment_reference;
        delete orderPayload.payment_failed_reason;
        delete orderPayload.refunded_amount;
        delete orderPayload.payment_updated_at;
      }
      orderInsert = await supabase.from("store_orders").insert(orderPayload).select("id, short_id, tracking_access_token, customer_name, phone, total_amount").single();
    }
    if (orderInsert.error) throw orderInsert.error;
    const order = orderInsert.data;
    const trackingToken = String(order.tracking_access_token || "");
    createdOrderId = String(order.id);
    const { error: itemsError } = await supabase.from("store_order_items").insert(orderItems.map((item) => ({
      ...item,
      store_order_id: order.id
    })));
    if (itemsError) throw itemsError;
    if (printDraftsForOrder.length > 0) {
      orderedPrintDraftIds = printDraftsForOrder.map((item) => String(item.id));
      const { error: printDraftError } = await supabase.from("print_drafts").update({
        status: "ordered",
        store_order_id: order.id,
        customer_id: verifiedCustomerId,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).in("id", orderedPrintDraftIds);
      if (printDraftError) throw printDraftError;
    }
    if (requestedRewardPoints > 0 && rewardWalletId) {
      const { error: rewardError } = await supabase.rpc("set_reward_points_redemption", {
        p_wallet_id: rewardWalletId,
        p_source_type: "store_order",
        p_source_id: order.id,
        p_requested_points: requestedRewardPoints,
        p_order_value: finalTotal
      });
      if (rewardError) throw rewardError;
      redeemedRewardPoints = true;
    }
    stockReserved = false;
    createdOrderId = null;
    createdGuestCustomerId = null;
    try {
      await sendWhatsAppConfirmation(supabase, order);
    } catch (notifyError) {
      console.error("store checkout notification error:", notifyError);
    }
    if (verifiedCustomerEmail) {
      try {
        await sendEmail({
          to: verifiedCustomerEmail,
          subject: `\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628\u0643 #${String(order.short_id || order.id).slice(0, 6)} - \u0644\u062D\u0638\u0629 \u0641\u0646`,
          html: orderEmailHtml(order, trackingToken, coupon, { points: requestedRewardPoints, value: pointsUsedAmount }),
          text: `\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628\u0643 \u0645\u0646 \u0644\u062D\u0638\u0629 \u0641\u0646. \u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628: #${String(order.short_id || order.id).slice(0, 6)}. \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A: ${Number(order.total_amount || 0).toFixed(2)} \u0631\u064A\u0627\u0644. \u0645\u062F\u0641\u0648\u0639 \u0628\u0627\u0644\u0646\u0642\u0627\u0637: ${requestedRewardPoints} \u0646\u0642\u0637\u0629 (${pointsUsedAmount.toFixed(2)} \u0631\u064A\u0627\u0644). \u0627\u0644\u0645\u062A\u0628\u0642\u064A \u0644\u0644\u062F\u0641\u0639: ${Math.max(0, Number(order.total_amount || 0) - pointsUsedAmount).toFixed(2)} \u0631\u064A\u0627\u0644. \u0631\u0645\u0632 \u0627\u0644\u062A\u062A\u0628\u0639 \u0627\u0644\u0622\u0645\u0646: ${trackingToken}.`,
          tags: [{ name: "type", value: "store_order_confirmation" }]
        });
      } catch (emailError) {
        console.error("store checkout customer email error:", emailError);
      }
    }
    const adminEmail = Deno.env.get("STORE_ORDER_NOTIFY_EMAIL") || Deno.env.get("RETURN_REQUEST_NOTIFY_EMAIL") || Deno.env.get("ADMIN_NOTIFY_EMAIL");
    if (adminEmail) {
      try {
        await sendEmail({
          to: adminEmail,
          subject: `\u0637\u0644\u0628 \u0645\u062A\u062C\u0631 \u062C\u062F\u064A\u062F #${String(order.short_id || order.id).slice(0, 6)}`,
          html: orderEmailHtml(order, trackingToken, coupon, { points: requestedRewardPoints, value: pointsUsedAmount }),
          text: `\u0637\u0644\u0628 \u0645\u062A\u062C\u0631 \u062C\u062F\u064A\u062F #${String(order.short_id || order.id).slice(0, 6)} \u0628\u0642\u064A\u0645\u0629 ${Number(order.total_amount || 0).toFixed(2)} \u0631\u064A\u0627\u0644.`,
          tags: [{ name: "type", value: "store_order_admin_notification" }]
        });
      } catch (emailError) {
        console.error("store checkout admin email error:", emailError);
      }
    }
    return jsonResponse({
      order: {
        id: order.id,
        short_id: order.short_id,
        total_amount: order.total_amount,
        subtotal_amount: subtotal,
        discount_amount: discountAmount,
        coupon_code: coupon?.code || null,
        reward_points_used: requestedRewardPoints,
        points_used_amount: pointsUsedAmount,
        amount_due: Number((finalTotal - pointsUsedAmount).toFixed(2))
      },
      tracking_token: trackingToken
    });
  } catch (error) {
    console.error("store-checkout error:", error);
    if (redeemedRewardPoints && rewardWalletId && createdOrderId) {
      const { error: restoreRewardError } = await supabase.rpc("set_reward_points_redemption", {
        p_wallet_id: rewardWalletId,
        p_source_type: "store_order",
        p_source_id: createdOrderId,
        p_requested_points: 0,
        p_order_value: rewardOrderValue
      });
      if (restoreRewardError) console.error("store-checkout reward restore error:", restoreRewardError);
    }
    if (stockReserved && reservedStockItems.length > 0) {
      const { error: restoreError } = await supabase.rpc("restore_store_stock", {
        items: reservedStockItems
      });
      if (restoreError) console.error("store-checkout stock restore error:", restoreError);
    }
    if (createdOrderId) {
      const { error: cleanupError } = await supabase.from("store_orders").delete().eq("id", createdOrderId);
      if (cleanupError) console.error("store-checkout cleanup error:", cleanupError);
    }
    if (orderedPrintDraftIds.length > 0) {
      const { error: restoreDraftError } = await supabase.from("print_drafts").update({
        status: "ready",
        store_order_id: null,
        customer_id: null,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).in("id", orderedPrintDraftIds);
      if (restoreDraftError) console.error("store-checkout print draft restore error:", restoreDraftError);
    }
    if (createdGuestCustomerId) {
      const { error: guestCleanupError } = await supabase.from("customers").delete().eq("id", createdGuestCustomerId).is("password_hash", null);
      if (guestCleanupError) console.error("store-checkout guest cleanup error:", guestCleanupError);
    }
    const message = error instanceof Error ? error.message : "checkout_failed";
    const status = ["product_unavailable", "product_option_unavailable", "product_out_of_stock", "print_draft_not_ready", "print_draft_locked", "print_variant_unavailable", "coupon_scope_empty", "reward_points_balance_insufficient", "reward_redemption_limit_exceeded", "reward_minimum_redemption_not_met", "guest_customer_exists_login_required", "customer_identity_conflict"].includes(message) ? 409 : message === "reward_points_migration_required" ? 503 : ["empty_cart", "invalid_stock_items", "not_authorized", "invalid_customer_details"].includes(message) ? 400 : 500;
    return jsonResponse({ error: message }, status);
  }
});
