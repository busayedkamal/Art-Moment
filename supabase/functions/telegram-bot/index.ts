import { getServiceClient } from '../_shared/supabase.ts';

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramChat = {
  id: number;
  type?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  title?: string;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

const PAYMENT_TASK_STATUSES = new Set(['pending_payment', 'awaiting_review', 'payment_failed']);
const OPEN_RETURN_STATUSES = new Set(['new_request', 'under_review', 'approved', 'awaiting_item', 'item_received']);
const CLOSED_ORDER_STATUSES = new Set(['delivered', 'cancelled', 'returned']);
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_verification: 'بانتظار التأكيد',
  confirmed: 'تم التأكيد',
  processing: 'قيد التجهيز',
  ready_for_delivery: 'جاهز للتسليم',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
  returned: 'مرتجع',
  new: 'جديد',
  printing: 'طباعة',
  done: 'جاهز',
};
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'بانتظار الدفع',
  awaiting_review: 'بانتظار المراجعة',
  paid: 'مدفوع',
  payment_failed: 'فشل الدفع',
  partial_refund: 'مسترد جزئياً',
  full_refund: 'مسترد بالكامل',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function getCommand(text: string | undefined) {
  const firstPart = String(text || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
  return firstPart.split('@')[0];
}

function getDisplayName(chat: TelegramChat, user?: TelegramUser) {
  const name = [user?.first_name || chat.first_name, user?.last_name || chat.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name || chat.title || chat.username || user?.username || String(chat.id);
}

async function telegramRequest(token: string, method: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.ok === false) {
    throw new Error(`telegram_${method}_failed:${result?.description || response.status}`);
  }
  return result;
}

async function sendMessage(token: string, chatId: number, text: string) {
  return telegramRequest(token, 'sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

function ensureNoQueryError(result: { error?: { message?: string } | null }, label: string) {
  if (result.error) throw new Error(`${label}:${result.error.message || 'query_failed'}`);
}

async function getOperationsSummary(supabase: ReturnType<typeof getServiceClient>) {
  const [printResult, storeResult, productsResult, returnsResult, settingsResult] = await Promise.all([
    supabase.from('orders').select('status'),
    supabase.from('store_orders').select('status, payment_status'),
    supabase.from('products').select('stock_quantity, in_stock'),
    supabase.from('store_return_requests').select('status'),
    supabase.from('settings').select('low_stock_threshold').limit(1).maybeSingle(),
  ]);

  ensureNoQueryError(printResult, 'print_orders');
  ensureNoQueryError(storeResult, 'store_orders');
  ensureNoQueryError(productsResult, 'products');
  ensureNoQueryError(returnsResult, 'return_requests');

  const lowStockThreshold = Math.max(0, Number(settingsResult.data?.low_stock_threshold ?? 3));
  const printOrders = printResult.data || [];
  const storeOrders = storeResult.data || [];
  const products = productsResult.data || [];
  const returns = returnsResult.data || [];

  return {
    printActive: printOrders.filter((order) => !CLOSED_ORDER_STATUSES.has(String(order.status || ''))).length,
    storeActive: storeOrders.filter((order) => !CLOSED_ORDER_STATUSES.has(String(order.status || ''))).length,
    paymentsNeedAction: storeOrders.filter((order) => PAYMENT_TASK_STATUSES.has(String(order.payment_status || ''))).length,
    returnsNeedAction: returns.filter((request) => OPEN_RETURN_STATUSES.has(String(request.status || ''))).length,
    lowStock: products.filter((product) => (
      product.in_stock !== false
      && Number.isFinite(Number(product.stock_quantity))
      && Number(product.stock_quantity) <= lowStockThreshold
    )).length,
    lowStockThreshold,
  };
}

async function getRecentOrders(supabase: ReturnType<typeof getServiceClient>) {
  const [printResult, storeResult] = await Promise.all([
    supabase
      .from('orders')
      .select('id, customer_name, status, total_amount, created_at')
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('store_orders')
      .select('id, short_id, customer_name, status, payment_status, total_amount, created_at')
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  ensureNoQueryError(printResult, 'recent_print_orders');
  ensureNoQueryError(storeResult, 'recent_store_orders');

  const printLines = (printResult.data || []).map((order) => (
    `• #${String(order.id).slice(0, 6)} | ${order.customer_name || 'بدون اسم'} | ${ORDER_STATUS_LABELS[String(order.status || '')] || order.status || '-'} | ${Number(order.total_amount || 0).toFixed(2)} ر.س`
  ));
  const storeLines = (storeResult.data || []).map((order) => (
    `• #${order.short_id || String(order.id).slice(0, 6)} | ${order.customer_name || 'بدون اسم'} | ${ORDER_STATUS_LABELS[String(order.status || '')] || order.status || '-'} | ${PAYMENT_STATUS_LABELS[String(order.payment_status || '')] || order.payment_status || '-'} | ${Number(order.total_amount || 0).toFixed(2)} ر.س`
  ));

  return [
    'آخر طلبات الطباعة',
    ...(printLines.length ? printLines : ['لا توجد طلبات.']),
    '',
    'آخر طلبات المتجر',
    ...(storeLines.length ? storeLines : ['لا توجد طلبات.']),
  ].join('\n');
}

async function markUpdate(
  supabase: ReturnType<typeof getServiceClient>,
  updateId: number,
  values: Record<string, unknown>,
) {
  const { error } = await supabase
    .from('telegram_bot_updates')
    .update(values)
    .eq('update_id', updateId);
  if (error) console.error('Telegram update log failed:', error);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ ok: false }, 405);

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
  const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';
  const configuredAdminChatId = String(Deno.env.get('TELEGRAM_ADMIN_CHAT_ID') || '').trim();
  const requestSecret = req.headers.get('x-telegram-bot-api-secret-token') || '';

  if (!botToken || !webhookSecret) return jsonResponse({ ok: false, error: 'telegram_not_configured' }, 503);
  if (!timingSafeEqual(requestSecret, webhookSecret)) return jsonResponse({ ok: false }, 401);

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  if (!Number.isFinite(Number(update.update_id))) return jsonResponse({ ok: true, ignored: true });

  const message = update.message;
  const command = getCommand(message?.text);
  const chatId = Number(message?.chat?.id);
  const supabase = getServiceClient();
  let attemptCount = 1;

  const { error: updateInsertError } = await supabase.from('telegram_bot_updates').insert({
    update_id: update.update_id,
    chat_id: Number.isFinite(chatId) ? chatId : null,
    update_type: message ? 'message' : 'unsupported',
    command: command || null,
  });

  if (updateInsertError?.code === '23505') {
    const { data: existingUpdate, error: existingUpdateError } = await supabase
      .from('telegram_bot_updates')
      .select('processed_at, error_message, attempt_count')
      .eq('update_id', update.update_id)
      .maybeSingle();
    if (existingUpdateError) return jsonResponse({ ok: false }, 500);
    if (existingUpdate?.processed_at && !existingUpdate.error_message) {
      return jsonResponse({ ok: true, duplicate: true });
    }

    attemptCount = Math.min(20, Number(existingUpdate?.attempt_count || 1) + 1);
    if (attemptCount > 5) return jsonResponse({ ok: true, retry_limit_reached: true });

    const { error: retryUpdateError } = await supabase
      .from('telegram_bot_updates')
      .update({
        attempt_count: attemptCount,
        received_at: new Date().toISOString(),
        processed_at: null,
        error_message: null,
      })
      .eq('update_id', update.update_id);
    if (retryUpdateError) return jsonResponse({ ok: false }, 500);
  }
  if (updateInsertError && updateInsertError.code !== '23505') {
    console.error('Telegram update insert failed:', updateInsertError);
    return jsonResponse({ ok: false }, 500);
  }

  if (!message || !Number.isFinite(chatId)) {
    await markUpdate(supabase, update.update_id, { processed_at: new Date().toISOString() });
    return jsonResponse({ ok: true, ignored: true });
  }

  try {
    const { data: existingChat, error: chatLookupError } = await supabase
      .from('telegram_bot_chats')
      .select('is_active')
      .eq('chat_id', chatId)
      .maybeSingle();
    if (chatLookupError) throw chatLookupError;

    const isConfiguredAdmin = configuredAdminChatId !== '' && configuredAdminChatId === String(chatId);
    const isActive = Boolean(existingChat?.is_active) || isConfiguredAdmin;
    const { error: chatUpsertError } = await supabase.from('telegram_bot_chats').upsert({
      chat_id: chatId,
      telegram_user_id: message.from?.id || null,
      username: message.from?.username || message.chat.username || null,
      display_name: getDisplayName(message.chat, message.from),
      chat_type: message.chat.type || null,
      is_active: isActive,
      last_command: command || null,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'chat_id' });
    if (chatUpsertError) throw chatUpsertError;

    if (command === '/start') {
      const accessText = isActive
        ? 'تم تفعيل هذه المحادثة لإدارة لحظة فن.'
        : 'تم تسجيل المحادثة، لكنها غير مفعلة بعد. أضف رقم المحادثة إلى TELEGRAM_ADMIN_CHAT_ID ثم أعد المحاولة.';
      await sendMessage(botToken, chatId, [
        'مرحباً بك في بوت لحظة فن.',
        accessText,
        `رقم المحادثة: ${chatId}`,
        '',
        'الأوامر المتاحة بعد التفعيل:',
        '/status ملخص التشغيل',
        '/orders آخر الطلبات',
        '/help المساعدة',
      ].join('\n'));
    } else if (!isActive) {
      await sendMessage(botToken, chatId, 'هذه المحادثة غير مخولة للوصول إلى بيانات المشروع. أرسل /start لمعرفة رقم المحادثة.');
    } else if (command === '/status') {
      const summary = await getOperationsSummary(supabase);
      await sendMessage(botToken, chatId, [
        'ملخص تشغيل لحظة فن',
        '',
        `طلبات الطباعة النشطة: ${summary.printActive}`,
        `طلبات المتجر النشطة: ${summary.storeActive}`,
        `مدفوعات تحتاج إجراء: ${summary.paymentsNeedAction}`,
        `استرجاعات تحتاج إجراء: ${summary.returnsNeedAction}`,
        `منتجات منخفضة المخزون: ${summary.lowStock}`,
        `حد المخزون المنخفض: ${summary.lowStockThreshold}`,
      ].join('\n'));
    } else if (command === '/orders') {
      await sendMessage(botToken, chatId, await getRecentOrders(supabase));
    } else if (command === '/help') {
      await sendMessage(botToken, chatId, [
        'أوامر بوت لحظة فن',
        '/status ملخص التشغيل والمهام المفتوحة',
        '/orders آخر طلبات الطباعة والمتجر',
        '/help عرض هذه القائمة',
      ].join('\n'));
    } else {
      await sendMessage(botToken, chatId, 'الأمر غير معروف. أرسل /help لعرض الأوامر المتاحة.');
    }

    await markUpdate(supabase, update.update_id, {
      processed_at: new Date().toISOString(),
      error_message: null,
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    console.error('Telegram bot processing failed:', error);
    await markUpdate(supabase, update.update_id, {
      processed_at: new Date().toISOString(),
      error_message: messageText.slice(0, 1000),
    });
    return jsonResponse({ ok: false }, attemptCount < 5 ? 500 : 200);
  }

  return jsonResponse({ ok: true });
});
