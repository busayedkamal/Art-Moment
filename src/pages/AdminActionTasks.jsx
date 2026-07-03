import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  ClipboardList,
  CreditCard,
  ExternalLink,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Truck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import {
  getPaymentState,
  getStoreOrderStatus,
  getStoreReturnStatus,
} from '../utils/storeOrderStatus';

const LOW_STOCK_THRESHOLD = 3;

const CATEGORY_CONFIG = {
  payment: {
    label: 'الدفع',
    icon: CreditCard,
    tone: 'bg-red-50 text-red-600 border-red-100',
    href: '/app/store-orders',
  },
  returns: {
    label: 'الاسترجاع',
    icon: RotateCcw,
    tone: 'bg-orange-50 text-orange-700 border-orange-100',
    href: '/app/store-orders',
  },
  shipping: {
    label: 'الشحن',
    icon: Truck,
    tone: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    href: '/app/store-orders',
  },
  notifications: {
    label: 'الإشعارات',
    icon: Bell,
    tone: 'bg-rose-50 text-rose-700 border-rose-100',
    href: '/app/notifications',
  },
  inventory: {
    label: 'المخزون',
    icon: Package,
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    href: '/app/products',
  },
};

const FILTERS = [
  { value: 'all', label: 'الكل' },
  { value: 'payment', label: 'الدفع' },
  { value: 'returns', label: 'الاسترجاع' },
  { value: 'shipping', label: 'الشحن' },
  { value: 'notifications', label: 'الإشعارات' },
  { value: 'inventory', label: 'المخزون' },
];

const PRIORITY_META = {
  high: {
    label: 'عاجلة',
    tone: 'bg-red-50 text-red-600 border-red-100',
    rank: 3,
  },
  medium: {
    label: 'متوسطة',
    tone: 'bg-amber-50 text-amber-700 border-amber-100',
    rank: 2,
  },
  low: {
    label: 'متابعة',
    tone: 'bg-[#F8F5F2] text-[#4A4A4A]/65 border-[#D9A3AA]/15',
    rank: 1,
  },
};

const PAYMENT_TASK_STATUSES = new Set(['pending_payment', 'awaiting_review', 'payment_failed']);
const OPEN_RETURN_STATUSES = new Set(['new_request', 'under_review', 'approved', 'awaiting_item', 'item_received']);

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
        href: '/app/store-orders',
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
        href: '/app/store-orders',
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
        href: '/app/store-orders',
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
    .map((log) => ({
      id: `notification-${log.id}`,
      category: 'notifications',
      priority: 'high',
      title: log.subject || 'إشعار فشل إرساله',
      description: log.error_message || 'توجد رسالة عميل فاشلة وتحتاج إعادة إرسال أو مراجعة القالب.',
      statusLabel: 'فشل الإرسال',
      statusTone: 'bg-red-50 text-red-600 border-red-100',
      href: '/app/notifications',
      createdAt: log.created_at,
      updatedAt: log.sent_at,
      meta: [
        { label: 'النوع', value: log.type || 'غير محدد' },
        { label: 'العميل', value: log.customer_id ? `#${String(log.customer_id).slice(0, 6)}` : 'غير محدد' },
        { label: 'التاريخ', value: formatDate(log.created_at) },
      ],
      searchable: [log.subject, log.body, log.error_message, log.type, log.customer_id].join(' '),
    }));
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
        href: '/app/products',
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

function StatCard({ label, value, icon: Icon, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-white border-[#D9A3AA]/15 text-[#4A4A4A]',
    red: 'bg-red-50 border-red-100 text-red-600',
    gold: 'bg-[#C5A059]/10 border-[#C5A059]/20 text-[#C5A059]',
    green: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  };

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${tones[tone] || tones.neutral}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="w-11 h-11 rounded-2xl bg-white/70 flex items-center justify-center">
          {React.createElement(Icon, { size: 21 })}
        </span>
        <div className="text-left">
          <p className="text-xs font-black opacity-70">{label}</p>
          <p className="text-2xl font-black mt-1">{value}</p>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task }) {
  const category = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.payment;
  const priority = PRIORITY_META[task.priority] || PRIORITY_META.low;
  const CategoryIcon = category.icon;

  return (
    <article className="rounded-3xl bg-white border border-[#D9A3AA]/15 p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center border ${category.tone}`}>
            <CategoryIcon size={21} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black ${category.tone}`}>
                {category.label}
              </span>
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black ${priority.tone}`}>
                {priority.label}
              </span>
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black ${task.statusTone}`}>
                {task.statusLabel}
              </span>
            </div>
            <h2 className="text-base font-black text-[#4A4A4A] truncate">{task.title}</h2>
            <p className="text-sm font-bold text-[#4A4A4A]/55 mt-1 leading-6">{task.description}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {task.meta.map((item) => (
                <div key={`${task.id}-${item.label}`} className="rounded-2xl bg-[#F8F5F2] border border-[#D9A3AA]/10 px-3 py-2">
                  <p className="text-[10px] font-black text-[#4A4A4A]/40">{item.label}</p>
                  <p className="text-xs font-black text-[#4A4A4A] mt-1 truncate">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Link
          to={task.href}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#4A4A4A] px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-[#C5A059] transition-colors"
        >
          فتح المعالجة <ExternalLink size={15} />
        </Link>
      </div>
    </article>
  );
}

export default function AdminActionTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
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
          .select('id, customer_id, type, subject, body, status, error_message, sent_at, created_at')
          .eq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(150)),
        safeQuery('products', supabase
          .from('products')
          .select('id, name, category, price, in_stock, stock_quantity')
          .order('stock_quantity', { ascending: true })
          .limit(250)),
      ]);

      const nextTasks = [
        ...buildPaymentTasks(orders),
        ...buildReturnTasks(returnRequests),
        ...buildShippingTasks(orders),
        ...buildNotificationTasks(messageLogs),
        ...buildInventoryTasks(products),
      ].sort((left, right) => {
        const priorityDiff = (PRIORITY_META[right.priority]?.rank || 0) - (PRIORITY_META[left.priority]?.rank || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return getTaskDate(right) - getTaskDate(left);
      });

      setTasks(nextTasks);
    } catch (error) {
      console.error(error);
      toast.error('فشل تحميل مهام الإدارة');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const stats = useMemo(() => tasks.reduce((acc, task) => {
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
  }), [tasks]);

  const filteredTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesCategory = activeFilter === 'all' || task.category === activeFilter;
      const haystack = [
        task.title,
        task.description,
        task.statusLabel,
        task.searchable,
        ...task.meta.map((item) => `${item.label} ${item.value}`),
      ].join(' ').toLowerCase();
      return matchesCategory && (!query || haystack.includes(query));
    });
  }, [activeFilter, searchTerm, tasks]);

  return (
    <div dir="rtl" className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600 mb-3">
            <ClipboardList size={14} /> مركز التشغيل
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#4A4A4A]">مهام تحتاج إجراء</h1>
          <p className="text-sm text-[#4A4A4A]/55 mt-1">
            مكان واحد لمتابعة الدفع، الاسترجاع، الشحن، الإشعارات الفاشلة، ومخزون المتجر.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchTasks}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-[#D9A3AA]/20 px-4 py-3 text-sm font-black text-[#4A4A4A] shadow-sm hover:border-[#D9A3AA]/50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="كل المهام" value={stats.total} icon={ClipboardList} />
        <StatCard label="عاجلة" value={stats.high} icon={ShieldAlert} tone="red" />
        <StatCard label="الدفع والاسترجاع" value={stats.payment + stats.returns} icon={CreditCard} tone="gold" />
        <StatCard label="الشحن والمخزون" value={stats.shipping + stats.inventory} icon={Package} tone="green" />
      </div>

      <div className="rounded-3xl bg-white border border-[#D9A3AA]/15 p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4A4A4A]/35" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="ابحث باسم العميل، رقم الطلب، المنتج، أو سبب المهمة..."
              className="w-full rounded-2xl border border-[#D9A3AA]/15 bg-[#F8F5F2] py-3 pl-4 pr-11 text-sm font-bold outline-none focus:border-[#D9A3AA]"
            />
          </label>

          <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={`shrink-0 rounded-2xl px-4 py-3 text-xs font-black border transition-colors ${
                  activeFilter === filter.value
                    ? 'bg-[#4A4A4A] text-white border-[#4A4A4A]'
                    : 'bg-[#F8F5F2] text-[#4A4A4A]/65 border-[#D9A3AA]/10 hover:border-[#D9A3AA]/40'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl bg-white border border-[#D9A3AA]/15 p-10 flex justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-[#D9A3AA]/25 border-t-[#D9A3AA] animate-spin" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-3xl bg-white border border-[#D9A3AA]/15 p-10 text-center">
          <AlertTriangle size={38} className="mx-auto text-emerald-400/60 mb-3" />
          <p className="font-black text-[#4A4A4A]">لا توجد مهام مطابقة الآن</p>
          <p className="text-sm text-[#4A4A4A]/45 mt-1">
            الوضع هادئ. جرّب تغيير الفلتر أو تحديث اللوحة بعد قليل.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
