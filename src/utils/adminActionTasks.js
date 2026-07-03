import { supabase } from '../lib/supabase';
import {
  getPaymentState,
  getStoreOrderStatus,
  getStoreReturnStatus,
} from './storeOrderStatus';

const LOW_STOCK_THRESHOLD = 3;
const PAYMENT_TASK_STATUSES = new Set(['pending_payment', 'awaiting_review', 'payment_failed']);
const OPEN_RETURN_STATUSES = new Set(['new_request', 'under_review', 'approved', 'awaiting_item', 'item_received']);

export const ADMIN_TASK_PRIORITY_RANK = {
  high: 3,
  medium: 2,
  low: 1,
};

export const ADMIN_TASK_CATEGORIES = ['payment', 'returns', 'shipping', 'notifications', 'inventory'];

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ر.س`;
}

function formatDate(value) {
  if (!value) return 'بدون تاريخ';
  return new Date(value).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getOrderLabel(order) {
  return order?.short_id || String(order?.id || '').slice(0, 6) || 'طلب';
}

function getTaskDate(task) {
  const value = task.createdAt || task.updatedAt;
  const date = value ? new Date(value).getTime() : 0;
  return Number.isFinite(date) ? date : 0;
}

function hasTrackingNumber(order) {
  return Boolean(String(order?.tracking_number || '').trim());
}

function getMetadata(log) {
  return log?.metadata && typeof log.metadata === 'object' ? log.metadata : {};
}

export async function getFunctionError(error) {
  try {
    const body = await error?.context?.clone?.().json?.();
    return body?.error || error?.message;
  } catch {
    return error?.message;
  }
}

async function safeQuery(label, queryBuilder) {
  try {
    const { data, error } = await queryBuilder;
    if (error) throw error;
    return data || [];
  } catch (error) {
    const message = error?.message || '';
    if (/schema cache|relation|does not exist|permission denied/i.test(message)) {
      console.warn(`${label} tasks skipped:`, error);
      return [];
    }
    throw error;
  }
}

function buildPaymentTasks(orders) {
  return orders
    .filter((order) => PAYMENT_TASK_STATUSES.has(order.payment_status))
    .map((order) => {
      const payment = getPaymentState(order);
      const total = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
      const remaining = Math.max(0, total - Number(order.amount_paid || 0));

      return {
        id: `payment-${order.id}`,
        category: 'payment',
        priority: order.payment_status === 'payment_failed' || order.payment_status === 'awaiting_review' ? 'high' : 'medium',
        title: `طلب #${getOrderLabel(order)} يحتاج متابعة الدفع`,
        description: payment.description,
        statusLabel: payment.label,
        statusTone: payment.tone,
        href: `/app/store-orders?order=${encodeURIComponent(order.id)}&task=payment`,
        actionLabel: 'افتح الطلب',
        actionIcon: 'external',
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        meta: [
          { label: 'العميل', value: order.customer_name || order.phone || 'غير محدد' },
          { label: 'المتبقي', value: formatMoney(remaining) },
          { label: 'الإجمالي', value: formatMoney(total) },
        ],
        searchable: [order.short_id, order.customer_name, order.phone, payment.label, remaining].join(' '),
      };
    });
}

function buildShippingTasks(orders) {
  return orders
    .filter((order) => order.status === 'ready_for_delivery' || (order.status === 'shipped' && !hasTrackingNumber(order)))
    .map((order) => {
      const orderStatus = getStoreOrderStatus(order.status);
      const missingTracking = !hasTrackingNumber(order);

      return {
        id: `shipping-${order.id}`,
        category: 'shipping',
        priority: order.status === 'shipped' && missingTracking ? 'high' : 'medium',
        title: missingTracking
          ? `طلب #${getOrderLabel(order)} يحتاج رقم تتبع`
          : `طلب #${getOrderLabel(order)} جاهز للشحن`,
        description: missingTracking
          ? 'الطلب وصل إلى مرحلة الشحن بدون رقم تتبع واضح للعميل.'
          : 'الطلب جاهز وينتظر تجهيز بيانات الشحن أو تسليمه.',
        statusLabel: orderStatus.label,
        statusTone: orderStatus.tone,
        href: `/app/store-orders?order=${encodeURIComponent(order.id)}&task=shipping`,
        actionLabel: missingTracking ? 'إضافة رقم التتبع' : 'افتح الشحن',
        actionIcon: 'truck',
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        meta: [
          { label: 'العميل', value: order.customer_name || order.phone || 'غير محدد' },
          { label: 'رقم التتبع', value: hasTrackingNumber(order) ? order.tracking_number : 'غير مسجل' },
          { label: 'التاريخ', value: formatDate(order.created_at) },
        ],
        searchable: [order.short_id, order.customer_name, order.phone, order.tracking_number, orderStatus.label].join(' '),
      };
    });
}

function buildReturnTasks(returnRequests) {
  return returnRequests
    .filter((request) => OPEN_RETURN_STATUSES.has(request.status))
    .map((request) => {
      const returnStatus = getStoreReturnStatus(request.status);

      return {
        id: `return-${request.id}`,
        category: 'returns',
        priority: request.status === 'new_request' || request.status === 'item_received' ? 'high' : 'medium',
        title: `طلب استرجاع #${String(request.id || '').slice(0, 6)}`,
        description: request.reason || returnStatus.description,
        statusLabel: returnStatus.label,
        statusTone: returnStatus.tone,
        href: request.store_order_id
          ? `/app/store-orders?order=${encodeURIComponent(request.store_order_id)}&return=${encodeURIComponent(request.id)}`
          : '/app/store-orders',
        actionLabel: 'راجع الاسترجاع',
        actionIcon: 'return',
        createdAt: request.created_at,
        updatedAt: request.updated_at,
        meta: [
          { label: 'العميل', value: request.customer_name || request.phone || 'غير محدد' },
          { label: 'المبلغ المطلوب', value: formatMoney(request.requested_refund_amount) },
          { label: 'طلب المتجر', value: request.store_order_id ? `#${String(request.store_order_id).slice(0, 6)}` : 'غير مرتبط' },
        ],
        searchable: [request.customer_name, request.phone, request.reason, returnStatus.label, request.store_order_id].join(' '),
      };
    });
}

function buildNotificationTasks(logs) {
  return logs
    .filter((log) => log.status === 'failed')
    .map((log) => {
      const metadata = getMetadata(log);
      const canRetry = Boolean(metadata.templateKey && log.customer_id);

      return {
        id: `notification-${log.id}`,
        category: 'notifications',
        priority: 'high',
        title: log.subject || 'إشعار فشل إرساله',
        description: log.error_message || 'توجد رسالة عميل فاشلة وتحتاج إعادة إرسال أو مراجعة القالب.',
        statusLabel: canRetry ? 'قابل للإرسال' : 'راجع السجل',
        statusTone: canRetry ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-600 border-red-100',
        href: `/app/notifications?log=${encodeURIComponent(log.id)}&status=failed`,
        actionLabel: 'فتح السجل',
        actionIcon: 'bell',
        directAction: canRetry ? {
          type: 'retry_notification',
          label: 'أعد الإرسال',
          logId: log.id,
          templateKey: metadata.templateKey,
          customerId: log.customer_id,
          variables: metadata.variables || {},
          subject: log.subject || 'إشعار عميل',
          messageType: log.type || 'template_general',
          errorMessage: log.error_message || '',
        } : null,
        createdAt: log.created_at,
        updatedAt: log.sent_at,
        meta: [
          { label: 'النوع', value: log.type || 'غير محدد' },
          { label: 'العميل', value: log.customer_id ? `#${String(log.customer_id).slice(0, 6)}` : 'غير محدد' },
          { label: 'التاريخ', value: formatDate(log.created_at) },
        ],
        searchable: [log.subject, log.body, log.error_message, log.type, log.customer_id].join(' '),
      };
    });
}

function buildInventoryTasks(products) {
  return products
    .filter((product) => Number(product.stock_quantity || 0) <= LOW_STOCK_THRESHOLD || product.in_stock === false)
    .map((product) => {
      const quantity = Number(product.stock_quantity || 0);
      const unavailable = product.in_stock === false || quantity <= 0;

      return {
        id: `product-${product.id}`,
        category: 'inventory',
        priority: unavailable ? 'high' : 'low',
        title: product.name || 'منتج بدون اسم',
        description: unavailable
          ? 'المنتج غير متوفر أو كميته منتهية، وقد يؤثر على تجربة الشراء.'
          : `الكمية المتبقية ${quantity} فقط، يفضل تحديث المخزون قريباً.`,
        statusLabel: unavailable ? 'نفد المخزون' : 'مخزون منخفض',
        statusTone: unavailable ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100',
        href: `/app/products?product=${encodeURIComponent(product.id)}`,
        actionLabel: 'حدّث المخزون',
        actionIcon: 'edit',
        createdAt: product.created_at,
        updatedAt: product.updated_at,
        meta: [
          { label: 'الكمية', value: quantity },
          { label: 'القسم', value: product.category || 'غير محدد' },
          { label: 'السعر', value: formatMoney(product.price) },
        ],
        searchable: [product.name, product.category, quantity, product.price].join(' '),
      };
    });
}

export function summarizeAdminActionTasks(tasks = []) {
  return tasks.reduce((acc, task) => {
    acc.total += 1;
    acc.high += task.priority === 'high' ? 1 : 0;
    acc.payment += task.category === 'payment' ? 1 : 0;
    acc.returns += task.category === 'returns' ? 1 : 0;
    acc.shipping += task.category === 'shipping' ? 1 : 0;
    acc.notifications += task.category === 'notifications' ? 1 : 0;
    acc.inventory += task.category === 'inventory' ? 1 : 0;
    return acc;
  }, {
    total: 0,
    high: 0,
    payment: 0,
    returns: 0,
    shipping: 0,
    notifications: 0,
    inventory: 0,
  });
}

export async function fetchAdminActionTasks() {
  const [orders, returnRequests, messageLogs, products] = await Promise.all([
    safeQuery('store orders', supabase
      .from('store_orders')
      .select('id, short_id, customer_name, phone, status, payment_status, payment_method, total_amount, delivery_fee, amount_paid, tracking_number, created_at')
      .order('created_at', { ascending: false })
      .limit(250)),
    safeQuery('return requests', supabase
      .from('store_return_requests')
      .select('id, store_order_id, customer_id, customer_name, phone, status, reason, requested_refund_amount, approved_refund_amount, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(150)),
    safeQuery('message logs', supabase
      .from('customer_message_logs')
      .select('id, customer_id, type, subject, body, status, error_message, metadata, sent_at, created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(150)),
    safeQuery('products', supabase
      .from('products')
      .select('id, name, category, price, in_stock, stock_quantity')
      .order('stock_quantity', { ascending: true })
      .limit(250)),
  ]);

  return [
    ...buildPaymentTasks(orders),
    ...buildReturnTasks(returnRequests),
    ...buildShippingTasks(orders),
    ...buildNotificationTasks(messageLogs),
    ...buildInventoryTasks(products),
  ].sort((left, right) => {
    const priorityDiff = (ADMIN_TASK_PRIORITY_RANK[right.priority] || 0) - (ADMIN_TASK_PRIORITY_RANK[left.priority] || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return getTaskDate(right) - getTaskDate(left);
  });
}
