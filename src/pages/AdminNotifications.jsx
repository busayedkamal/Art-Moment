import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  User,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { logAdminActivity } from '../utils/adminActivity';
import { getEmailErrorMessage, isEmailConfigurationError } from '../utils/emailErrors';

const MESSAGE_TYPE_LABELS = {
  marketing_campaign: 'حملة تسويقية',
  marketing_unsubscribe: 'إلغاء اشتراك',
  customer_account: 'حساب العميل',
  store_return_request: 'استرجاع',
  template_order: 'إشعار طلب',
  template_payment: 'إشعار دفع',
  template_shipping: 'إشعار شحن',
  template_return: 'إشعار استرجاع',
  template_general: 'إشعار عام',
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'الكل' },
  { value: 'failed', label: 'فاشلة' },
  { value: 'queued', label: 'بالانتظار' },
  { value: 'sent', label: 'مرسلة' },
  { value: 'completed', label: 'مكتملة' },
  { value: 'skipped', label: 'متجاوزة' },
];

async function getFunctionError(error) {
  try {
    const body = await error?.context?.clone?.().json?.();
    return body?.error || error?.message;
  } catch {
    return error?.message;
  }
}

function getStatusMeta(status) {
  if (status === 'failed') {
    return {
      label: 'فشل',
      icon: XCircle,
      className: 'bg-red-50 text-red-600 border-red-100',
    };
  }
  if (status === 'sent' || status === 'completed') {
    return {
      label: status === 'completed' ? 'مكتمل' : 'مرسل',
      icon: CheckCircle,
      className: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    };
  }
  if (status === 'queued') {
    return {
      label: 'بالانتظار',
      icon: Clock,
      className: 'bg-amber-50 text-amber-700 border-amber-100',
    };
  }
  if (status === 'skipped') {
    return {
      label: 'متجاوز',
      icon: AlertTriangle,
      className: 'bg-slate-50 text-slate-600 border-slate-100',
    };
  }
  return {
    label: status || 'غير محدد',
    icon: Mail,
    className: 'bg-[#F8F5F2] text-[#4A4A4A]/70 border-[#D9A3AA]/15',
  };
}

function formatDate(value) {
  if (!value) return 'بدون تاريخ';
  return new Date(value).toLocaleString('ar-SA');
}

function getMetadata(log) {
  return log?.metadata && typeof log.metadata === 'object' ? log.metadata : {};
}

export default function AdminNotifications() {
  const [logs, setLogs] = useState([]);
  const [customersById, setCustomersById] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('failed');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [retryingId, setRetryingId] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_message_logs')
        .select('id, customer_id, channel, type, subject, body, status, error_message, metadata, sent_at, created_at')
        .order('created_at', { ascending: false })
        .limit(250);
      if (error) throw error;

      const rows = data || [];
      const customerIds = Array.from(new Set(rows.map((log) => log.customer_id).filter(Boolean)));
      let customerMap = {};

      if (customerIds.length > 0) {
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select('id, name, email, phone')
          .in('id', customerIds);
        if (customersError) throw customersError;

        customerMap = (customers || []).reduce((acc, customer) => {
          acc[customer.id] = customer;
          return acc;
        }, {});
      }

      setLogs(rows);
      setCustomersById(customerMap);
    } catch (error) {
      console.error(error);
      toast.error('فشل تحميل مركز الإشعارات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const availableTypes = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.type).filter(Boolean)));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return logs.filter((log) => {
      const customer = customersById[log.customer_id] || {};
      const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
      const matchesType = typeFilter === 'all' || log.type === typeFilter;
      const haystack = [
        log.subject,
        log.body,
        log.error_message,
        MESSAGE_TYPE_LABELS[log.type],
        customer.name,
        customer.email,
        customer.phone,
      ].join(' ').toLowerCase();

      return matchesStatus && matchesType && (!query || haystack.includes(query));
    });
  }, [customersById, logs, searchTerm, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    return logs.reduce((acc, log) => {
      acc.total += 1;
      acc.failed += log.status === 'failed' ? 1 : 0;
      acc.sent += ['sent', 'completed'].includes(log.status) ? 1 : 0;
      acc.retryable += getMetadata(log).templateKey && log.customer_id ? 1 : 0;
      return acc;
    }, { total: 0, failed: 0, sent: 0, retryable: 0 });
  }, [logs]);

  const canRetry = (log) => {
    const metadata = getMetadata(log);
    return Boolean(metadata.templateKey && log.customer_id);
  };

  const retryMessage = async (log) => {
    const metadata = getMetadata(log);
    const customer = customersById[log.customer_id] || {};

    if (!metadata.templateKey) {
      toast.error('هذه الرسالة غير مرتبطة بقالب قابل لإعادة الإرسال');
      return;
    }

    setRetryingId(log.id);
    const toastId = toast.loading('جاري إعادة إرسال الإشعار...');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const { error } = await supabase.functions.invoke('customer-marketing', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: {
          action: 'send_template',
          templateKey: metadata.templateKey,
          customerId: log.customer_id,
          email: customer.email || '',
          customerName: customer.name || '',
          variables: metadata.variables || {},
        },
      });

      if (error) throw new Error(await getFunctionError(error));
      await logAdminActivity({
        action: 'customer_notification_resent',
        entityType: 'customer_message_log',
        entityId: log.id,
        entityLabel: log.subject || MESSAGE_TYPE_LABELS[log.type] || 'إشعار عميل',
        oldValues: {
          status: log.status,
          error_message: log.error_message || '',
        },
        newValues: {
          template_key: metadata.templateKey,
          customer_id: log.customer_id,
        },
        metadata: {
          source: 'admin_notifications',
          original_log_id: log.id,
          variables: metadata.variables || {},
        },
      });
      toast.success('تمت إعادة إرسال الإشعار', { id: toastId });
      fetchLogs();
    } catch (error) {
      console.error(error);
      await logAdminActivity({
        action: 'customer_notification_retry_failed',
        entityType: 'customer_message_log',
        entityId: log.id,
        entityLabel: log.subject || MESSAGE_TYPE_LABELS[log.type] || 'إشعار عميل',
        oldValues: {
          status: log.status,
          error_message: log.error_message || '',
        },
        newValues: {
          template_key: metadata.templateKey || '',
          customer_id: log.customer_id || '',
        },
        metadata: {
          source: 'admin_notifications',
          retry_error: error.message || 'retry_failed',
        },
      });
      toast.error(getEmailErrorMessage(error.message), { id: toastId });
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div dir="rtl" className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#D9A3AA]/10 px-3 py-1 text-xs font-black text-[#C5A059] mb-3">
            <Bell size={14} /> مركز المتابعة
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#4A4A4A]">إشعارات العملاء</h1>
          <p className="text-sm text-[#4A4A4A]/55 mt-1">
            متابعة الرسائل الفاشلة وسجل الإرسال وإعادة إرسال القوالب عند الحاجة.
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
        <StatCard label="كل الرسائل" value={stats.total} icon={Mail} />
        <StatCard label="فاشلة" value={stats.failed} icon={XCircle} tone="red" />
        <StatCard label="مرسلة" value={stats.sent} icon={CheckCircle} tone="green" />
        <StatCard label="قابلة للإعادة" value={stats.retryable} icon={RotateCcw} tone="gold" />
      </div>

      <div className="rounded-3xl bg-white border border-[#D9A3AA]/15 p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto]">
          <label className="relative block">
            <Search size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4A4A4A]/35" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="ابحث باسم العميل، البريد، العنوان، أو سبب الفشل..."
              className="w-full rounded-2xl border border-[#D9A3AA]/15 bg-[#F8F5F2] py-3 pl-4 pr-11 text-sm font-bold outline-none focus:border-[#D9A3AA]"
            />
          </label>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-2xl border border-[#D9A3AA]/15 bg-[#F8F5F2] px-4 py-3 text-sm font-black outline-none focus:border-[#D9A3AA]"
          >
            <option value="all">كل الأنواع</option>
            {availableTypes.map((type) => (
              <option key={type} value={type}>{MESSAGE_TYPE_LABELS[type] || type}</option>
            ))}
          </select>

          <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status.value}
                type="button"
                onClick={() => setStatusFilter(status.value)}
                className={`shrink-0 rounded-2xl px-4 py-3 text-xs font-black border transition-colors ${
                  statusFilter === status.value
                    ? 'bg-[#4A4A4A] text-white border-[#4A4A4A]'
                    : 'bg-[#F8F5F2] text-[#4A4A4A]/65 border-[#D9A3AA]/10 hover:border-[#D9A3AA]/40'
                }`}
              >
                {status.label}
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
            <Bell size={38} className="mx-auto text-[#D9A3AA]/40 mb-3" />
            <p className="font-black text-[#4A4A4A]">لا توجد رسائل مطابقة</p>
            <p className="text-sm text-[#4A4A4A]/45 mt-1">غيّر الفلتر أو حدّث القائمة.</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const statusMeta = getStatusMeta(log.status);
            const StatusIcon = statusMeta.icon;
            const metadata = getMetadata(log);
            const customer = customersById[log.customer_id] || {};
            const retryable = canRetry(log);
            const readableError = getEmailErrorMessage(log.error_message);
            const configurationError = isEmailConfigurationError(log.error_message);

            return (
              <article key={log.id} className="rounded-3xl bg-white border border-[#D9A3AA]/15 p-4 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-[1fr_260px_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black ${statusMeta.className}`}>
                        <StatusIcon size={12} /> {statusMeta.label}
                      </span>
                      <span className="rounded-full bg-[#F8F5F2] border border-[#D9A3AA]/10 px-3 py-1 text-[11px] font-black text-[#C5A059]">
                        {MESSAGE_TYPE_LABELS[log.type] || log.type}
                      </span>
                      {metadata.templateName && (
                        <span className="rounded-full bg-[#D9A3AA]/10 px-3 py-1 text-[11px] font-bold text-[#4A4A4A]/60">
                          {metadata.templateName}
                        </span>
                      )}
                    </div>
                    <h2 className="truncate text-base font-black text-[#4A4A4A]">
                      {log.subject || MESSAGE_TYPE_LABELS[log.type] || 'رسالة بدون عنوان'}
                    </h2>
                    {log.body && (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#4A4A4A]/60">
                        {log.body}
                      </p>
                    )}
                    {log.error_message && (
                      <div className="mt-3 rounded-2xl bg-red-50 border border-red-100 px-3 py-2 text-xs font-bold text-red-600">
                        <p>{readableError}</p>
                        {configurationError && (
                          <a
                            href="https://resend.com/domains"
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex text-[#4A4A4A] underline underline-offset-2"
                          >
                            فتح إعداد النطاق في Resend
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl bg-[#F8F5F2] border border-[#D9A3AA]/10 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-8 h-8 rounded-full bg-white border border-[#D9A3AA]/15 flex items-center justify-center text-[#D9A3AA]">
                        <User size={15} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#4A4A4A]">
                          {customer.name || 'عميل غير مرتبط'}
                        </p>
                        <p className="truncate text-[11px] font-bold text-[#4A4A4A]/45">
                          {customer.email || customer.phone || 'لا توجد بيانات اتصال'}
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] font-bold text-[#4A4A4A]/45">
                      {formatDate(log.sent_at || log.created_at)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => retryMessage(log)}
                    disabled={retryingId === log.id || !retryable}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#4A4A4A] px-5 text-sm font-black text-white shadow-sm transition-colors hover:bg-[#C5A059] disabled:opacity-45 disabled:hover:bg-[#4A4A4A]"
                    title={retryable ? 'إعادة إرسال الإشعار' : 'لا يمكن إعادة الإرسال بدون قالب محفوظ وعميل مرتبط'}
                  >
                    <Send size={15} />
                    {retryingId === log.id ? 'جاري الإرسال' : 'إعادة إرسال'}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-white text-[#4A4A4A] border-[#D9A3AA]/15',
    red: 'bg-red-50 text-red-600 border-red-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    gold: 'bg-[#C5A059]/10 text-[#C5A059] border-[#C5A059]/15',
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
