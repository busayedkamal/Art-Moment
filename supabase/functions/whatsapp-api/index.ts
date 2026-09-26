import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import {
  getWhatsAppSettings,
  sendWhatsAppStatusTemplate,
  testWhatsAppConnection,
} from '../_shared/whatsapp.ts';

function clean(value: unknown, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

function getBearerToken(req: Request) {
  return (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1] || '';
}

async function getAdminActor(req: Request, supabase: ReturnType<typeof getServiceClient>) {
  const token = getBearerToken(req);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: admins, error: adminError } = await supabase.from('admin_users').select('user_id, email');
  if (adminError) throw adminError;
  const email = String(data.user.email || '').toLowerCase();
  const allowed = !admins?.length || admins.some((admin: Record<string, unknown>) => (
    String(admin.user_id || '') === data.user.id
    || String(admin.email || '').toLowerCase() === email
  ));
  return allowed ? { id: data.user.id, email } : null;
}

const STATUS_LABELS: Record<string, string> = {
  pending_verification: 'بانتظار التأكيد', confirmed: 'تم التأكيد', processing: 'قيد التجهيز',
  attention_required: 'يحتاج متابعة', ready_for_delivery: 'جاهز', shipped: 'تم الشحن',
  delivered: 'تم الاستلام', cancelled: 'ملغي', returned: 'مرتجع',
  new: 'جديد', printing: 'طباعة', done: 'جاهز',
};

async function logWhatsApp(
  supabase: ReturnType<typeof getServiceClient>,
  input: Record<string, unknown>,
) {
  const { error } = await supabase.from('customer_message_logs').insert(input);
  if (error && !/customer_message_logs|schema cache|relation|does not exist/i.test(error.message || '')) {
    console.error('WhatsApp message log failed:', error);
  }
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const supabase = getServiceClient();
  try {
    const actor = await getAdminActor(req, supabase);
    if (!actor) return jsonResponse({ error: 'not_authorized' }, 403);
    const body = await req.json();
    const action = clean(body?.action, 60);

    if (action === 'get_settings') {
      return jsonResponse({ settings: await getWhatsAppSettings(supabase) });
    }

    if (action === 'save_settings') {
      const apiVersion = clean(body?.settings?.apiVersion, 16);
      if (!/^v\d+\.\d+$/.test(apiVersion)) return jsonResponse({ error: 'invalid_meta_api_version' }, 400);
      const payload = {
        whatsapp_enabled: body?.settings?.enabled === true,
        whatsapp_provider: 'meta',
        whatsapp_meta_api_version: apiVersion,
        whatsapp_phone_number_id: clean(body?.settings?.phoneNumberId, 80) || null,
        whatsapp_waba_id: clean(body?.settings?.wabaId, 80) || null,
        whatsapp_template_language: clean(body?.settings?.templateLanguage, 20) || 'ar',
        whatsapp_order_status_template: clean(body?.settings?.orderStatusTemplate, 120) || 'order_status_update',
      };
      const { error } = await supabase.from('settings').update(payload).eq('id', 1);
      if (error) throw error;
      return jsonResponse({ settings: await getWhatsAppSettings(supabase) });
    }

    if (action === 'test_connection') {
      try {
        const result = await testWhatsAppConnection(supabase);
        await supabase.from('settings').update({
          whatsapp_last_tested_at: new Date().toISOString(),
          whatsapp_last_test_status: 'connected',
          whatsapp_verified_name: result.verifiedName || null,
          whatsapp_display_phone_number: result.displayPhoneNumber || null,
          whatsapp_quality_rating: result.qualityRating || null,
        }).eq('id', 1);
        return jsonResponse({ ok: true, connection: result });
      } catch (error) {
        await supabase.from('settings').update({
          whatsapp_last_tested_at: new Date().toISOString(),
          whatsapp_last_test_status: 'failed',
        }).eq('id', 1);
        throw error;
      }
    }

    if (action === 'send_test') {
      const result = await sendWhatsAppStatusTemplate(supabase, {
        to: body?.phone,
        customerName: 'عميل تجريبي',
        orderNumber: 'TEST-001',
        statusLabel: 'اختبار اتصال ناجح',
        trackingUrl: 'https://www.art-moment.com/track',
      });
      return jsonResponse({ ok: true, result });
    }

    if (action === 'send_order_status') {
      const orderType = body?.orderType === 'store' ? 'store' : 'print';
      const table = orderType === 'store' ? 'store_orders' : 'orders';
      const orderId = clean(body?.orderId, 100);
      if (!orderId) return jsonResponse({ error: 'order_id_required' }, 400);
      const { data: order, error: orderError } = await supabase.from(table).select('*').eq('id', orderId).maybeSingle();
      if (orderError) throw orderError;
      if (!order) return jsonResponse({ error: 'order_not_found' }, 404);

      const orderNumber = clean(order.short_id || order.id, 80).slice(0, 12);
      const statusLabel = STATUS_LABELS[clean(order.status, 80)] || clean(body?.statusLabel || order.status, 160);
      const metadata = { provider: 'meta', orderType, orderId, orderNumber, status: order.status };
      try {
        const result = await sendWhatsAppStatusTemplate(supabase, {
          to: order.phone,
          customerName: order.customer_name || order.name,
          orderNumber,
          statusLabel,
          trackingUrl: 'https://www.art-moment.com/track',
        });
        if (!result.skipped) {
          await logWhatsApp(supabase, {
            customer_id: order.customer_id || null,
            channel: 'whatsapp', type: 'order_status', subject: `تحديث الطلب #${orderNumber}`,
            body: statusLabel, status: 'sent', sent_at: new Date().toISOString(),
            provider_id: result.providerMessageId || null,
            metadata: { ...metadata, providerMessageId: result.providerMessageId || null },
          });
        }
        return jsonResponse({ ok: true, result });
      } catch (sendError) {
        await logWhatsApp(supabase, {
          customer_id: order.customer_id || null,
          channel: 'whatsapp', type: 'order_status', subject: `تحديث الطلب #${orderNumber}`,
          body: statusLabel, status: 'failed',
          error_message: sendError instanceof Error ? sendError.message : 'whatsapp_send_failed',
          metadata,
        });
        throw sendError;
      }
    }

    return jsonResponse({ error: 'unknown_action' }, 400);
  } catch (error) {
    console.error('whatsapp-api error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'whatsapp_api_failed' }, 500);
  }
});