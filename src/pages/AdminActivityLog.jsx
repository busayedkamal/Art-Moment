import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  Box,
  History,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const ACTION_LABELS = {
  store_order_updated: 'تعديل طلب متجر',
  store_order_deleted: 'حذف طلب متجر',
  store_order_status_updated: 'تحديث حالة طلب',
  store_order_payment_updated: 'تحديث الدفع',
  store_order_shipping_updated: 'تحديث الشحن',
  store_return_status_updated: 'تحديث الاسترجاع',
  store_return_refund_updated: 'تحديث الاسترداد',
  customer_notification_sent: 'إرسال إشعار',
  customer_notification_failed: 'فشل إشعار',
  customer_notification_resent: 'إعادة إرسال إشعار',
  customer_notification_retry_failed: 'فشل إعادة الإرسال',
  customer_details_updated: 'تعديل بيانات عميل',
  customer_data_deletion_reviewed: 'مراجعة حذف بيانات',
  customer_wallet_balance_updated: 'تعديل رصيد عميل',
  customer_deleted: 'حذف عميل',
  marketing_campaign_sent: 'إرسال حملة تسويقية',
  product_created: 'إضافة منتج',
  product_updated: 'تعديل منتج',
  product_stock_status_updated: 'تحديث توفر منتج',
  product_deleted: 'حذف منتج',
};

const ENTITY_LABELS = {
  store_order: 'طلب متجر',
  store_return_request: 'استرجاع',
  customer_message_log: 'إشعار',
  customer_message: 'رسالة',
  customer: 'عميل',
  product: 'منتج',
};

const ENTITY_ICONS = {
  store_order: Package,
  store_return_request: RotateCcw,
  customer_message_log: Bell,
  customer_message: Bell,
  customer: User,
  product: Box,
};

const QUICK_FILTERS = [
  { value: 'all', label: 'الكل' },
  { value: 'store_order', label: 'الطلبات' },
  { value: 'customer', label: 'العملاء' },
  { value: 'product', label: 'المنتجات' },
  { value: 'notifications', label: 'الإشعارات' },
];

function getActionTone(action) {
  if (/failed|deleted/i.test(action)) return 'bg-red-50 text-red-600 border-red-100';
  if (/payment|refund|wallet/i.test(action)) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (/shipping|return/i.test(action)) return 'bg-cyan-50 text-cyan-700 border-cyan-100';
  if (/notification|campaign/i.test(action)) return 'bg-[#D9A3AA]/10 text-[#C5A059] border-[#D9A3AA]/15';
  return 'bg-[#F8F5F2] text-[#4A4A4A]/75 border-[#D9A3AA]/15';
}

function formatDate(value) {
  if (!value) return 'بدون تاريخ';
  return new Date(value).toLocaleString('ar-SA');
}

function jsonSummary(value) {
  if (!value || typeof value !== 'object') return '—';
  const entries = Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '');
  if (entries.length === 0) return '—';
  return entries.slice(0, 4).map(([key, item]) => `${key}: ${String(item)}`).join('، ');
}

export default function AdminActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error(error);
      toast.error('فشل تحميل سجل النشاط');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const actionOptions = useMemo(() => (
    Array.from(new Set(logs.map((log) => log.action).filter(Boolean)))
  ), [logs]);

  const filteredLogs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesEntity = entityFilter === 'all'
        || log.entity_type === entityFilter
        || (entityFilter === 'notifications' && ['customer_message_log', 'customer_message'].includes(log.entity_type));
      const matchesAction = actionFilter === 'all' || log.action === actionFilter;
      const haystack = [
        log.actor_email,
        log.action,
        ACTION_LABELS[log.action],
        log.entity_type,
        ENTITY_LABELS[log.entity_type],
        log.entity_id,
        log.entity_label,
        JSON.stringify(log.old_values || {}),
        JSON.stringify(log.new_values || {}),
        JSON.stringify(log.metadata || {}),
      ].join(' ').toLowerCase();

      return matchesEntity && matchesAction && (!query || haystack.includes(query));
    });
  }, [actionFilter, entityFilter, logs, searchTerm]);

  const stats = useMemo(() => logs.reduce((acc, log) => {
    acc.total += 1;
    acc.orders += log.entity_type === 'store_order' ? 1 : 0;
    acc.customers += log.entity_type === 'customer' ? 1 : 0;
    acc.products += log.entity_type === 'product' ? 1 : 0;
    return acc;
  }, { total: 0, orders: 0, customers: 0, products: 0 }), [logs]);

  return (
    <div dir="rtl" className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#C5A059]/10 px-3 py-1 text-xs font-black text-[#C5A059] mb-3">
            <History size={14} /> Audit Log
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#4A4A4A]">سجل النشاط الإداري</h1>
          <p className="text-sm text-[#4A4A4A]/55 mt-1">
            متابعة التغييرات المهمة في الطلبات، الدفع، الشحن، الاسترجاع، العملاء، المنتجات، والإشعارات.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-[#D9A3AA]/20 px-4 py-3 text-sm font-black text-[#4A4A4A] shadow-sm hover:border-[#D9A3AA]/50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="كل الأحداث" value={stats.total} icon={Activity} />
        <StatCard label="أحداث الطلبات" value={stats.orders} icon={Package} tone="gold" />
        <StatCard label="أحداث العملاء" value={stats.customers} icon={User} tone="pink" />
        <StatCard label="أحداث المنتجات" value={stats.products} icon={Box} tone="green" />
      </div>

      <div className="rounded-3xl bg-white border border-[#D9A3AA]/15 p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto]">
          <label className="relative block">
            <Search size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4A4A4A]/35" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="ابحث بالعميل، رقم الطلب، نوع الحدث، أو القيم المتغيرة..."
              className="w-full rounded-2xl border border-[#D9A3AA]/15 bg-[#F8F5F2] py-3 pl-4 pr-11 text-sm font-bold outline-none focus:border-[#D9A3AA]"
            />
          </label>

          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="rounded-2xl border border-[#D9A3AA]/15 bg-[#F8F5F2] px-4 py-3 text-sm font-black outline-none focus:border-[#D9A3AA]"
          >
            <option value="all">كل الأحداث</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>{ACTION_LABELS[action] || action}</option>
            ))}
          </select>

          <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
            {QUICK_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setEntityFilter(filter.value)}
                className={`shrink-0 rounded-2xl px-4 py-3 text-xs font-black border transition-colors ${
                  entityFilter === filter.value
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

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-3xl bg-white border border-[#D9A3AA]/15 p-10 flex justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-[#D9A3AA]/25 border-t-[#D9A3AA] animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="rounded-3xl bg-white border border-[#D9A3AA]/15 p-10 text-center">
            <History size={38} className="mx-auto text-[#D9A3AA]/40 mb-3" />
            <p className="font-black text-[#4A4A4A]">لا توجد أحداث مطابقة</p>
            <p className="text-sm text-[#4A4A4A]/45 mt-1">جرّب تغيير الفلتر أو تحديث السجل.</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const EntityIcon = ENTITY_ICONS[log.entity_type] || Activity;
            return (
              <article key={log.id} className="rounded-3xl bg-white border border-[#D9A3AA]/15 p-4 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black ${getActionTone(log.action)}`}>
                        <EntityIcon size={12} /> {ACTION_LABELS[log.action] || log.action}
                      </span>
                      <span className="rounded-full bg-[#F8F5F2] border border-[#D9A3AA]/10 px-3 py-1 text-[11px] font-black text-[#4A4A4A]/60">
                        {ENTITY_LABELS[log.entity_type] || log.entity_type}
                      </span>
                    </div>
                    <h2 className="truncate text-base font-black text-[#4A4A4A]">
                      {log.entity_label || log.entity_id || 'حدث إداري'}
                    </h2>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <ValueBox title="قبل" value={jsonSummary(log.old_values)} />
                      <ValueBox title="بعد" value={jsonSummary(log.new_values)} />
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#F8F5F2] border border-[#D9A3AA]/10 p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-white border border-[#D9A3AA]/15 flex items-center justify-center text-[#D9A3AA]">
                        <User size={15} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#4A4A4A]">
                          {log.actor_email || 'الحساب الإداري'}
                        </p>
                        <p className="text-[11px] font-bold text-[#4A4A4A]/45">
                          {formatDate(log.created_at)}
                        </p>
                      </div>
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="rounded-xl bg-white/80 border border-[#D9A3AA]/10 px-3 py-2">
                        <p className="text-[10px] font-black text-[#4A4A4A]/45 mb-1">تفاصيل إضافية</p>
                        <p className="line-clamp-2 text-[11px] font-bold text-[#4A4A4A]/65">
                          {jsonSummary(log.metadata)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

function ValueBox({ title, value }) {
  return (
    <div className="rounded-2xl bg-[#F8F5F2] border border-[#D9A3AA]/10 p-3">
      <p className="text-[10px] font-black text-[#4A4A4A]/45 mb-1">{title}</p>
      <p className="line-clamp-2 text-xs font-bold leading-relaxed text-[#4A4A4A]/65">{value}</p>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-white text-[#4A4A4A] border-[#D9A3AA]/15',
    gold: 'bg-[#C5A059]/10 text-[#C5A059] border-[#C5A059]/15',
    pink: 'bg-[#D9A3AA]/10 text-[#D9A3AA] border-[#D9A3AA]/15',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  };

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${tones[tone] || tones.neutral}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold opacity-70">{label}</p>
          <p className="mt-2 text-3xl font-black">{value}</p>
        </div>
        <span className="w-11 h-11 rounded-2xl bg-white/70 flex items-center justify-center">
          {React.createElement(Icon, { size: 21 })}
        </span>
      </div>
    </div>
  );
}
