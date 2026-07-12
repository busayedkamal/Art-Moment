import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  ClipboardList,
  CreditCard,
  Edit3,
  ExternalLink,
  Loader2,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Truck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { logAdminActivity } from '../utils/adminActivity';
import { getEmailErrorMessage } from '../utils/emailErrors';
import {
  fetchAdminActionTasks,
  getFunctionError,
  summarizeAdminActionTasks,
} from '../utils/adminActionTasks';

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

const ACTION_ICON_MAP = {
  external: ExternalLink,
  truck: Truck,
  return: RotateCcw,
  bell: Bell,
  edit: Edit3,
};

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

function TaskCard({ task, onRetryNotification, retryingTaskId }) {
  const category = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.payment;
  const priority = PRIORITY_META[task.priority] || PRIORITY_META.low;
  const CategoryIcon = category.icon;
  const ActionIcon = ACTION_ICON_MAP[task.actionIcon] || ExternalLink;
  const isRetrying = retryingTaskId === task.id;

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

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          {task.directAction?.type === 'retry_notification' && (
            <button
              type="button"
              onClick={() => onRetryNotification(task)}
              disabled={isRetrying}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D9A3AA] px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-[#C5A059] disabled:opacity-60 transition-colors"
            >
              {isRetrying ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {task.directAction.label}
            </button>
          )}
          <Link
            to={task.href}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#4A4A4A] px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-[#C5A059] transition-colors"
          >
            {task.actionLabel || 'فتح المعالجة'} <ActionIcon size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function AdminActionTasks() {
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(searchParams.get('filter') || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [retryingTaskId, setRetryingTaskId] = useState(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await fetchAdminActionTasks());
    } catch (error) {
      console.error(error);
      toast.error('فشل تحميل مهام الإدارة');
    } finally {
      setLoading(false);
    }
  }, []);

  const retryNotification = async (task) => {
    const action = task.directAction;
    if (!action?.templateKey || !action?.customerId) {
      toast.error('هذه الرسالة غير مرتبطة بقالب قابل للإرسال');
      return;
    }

    setRetryingTaskId(task.id);
    const toastId = toast.loading('جاري إعادة إرسال الإشعار...');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const { error } = await supabase.functions.invoke('customer-marketing', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: {
          action: 'send_template',
          templateKey: action.templateKey,
          customerId: action.customerId,
          variables: action.variables || {},
        },
      });

      if (error) throw new Error(await getFunctionError(error));

      await logAdminActivity({
        action: 'customer_notification_resent',
        entityType: 'customer_message_log',
        entityId: action.logId,
        entityLabel: action.subject || 'إشعار عميل',
        oldValues: {
          status: 'failed',
          error_message: action.errorMessage || '',
        },
        newValues: {
          template_key: action.templateKey,
          customer_id: action.customerId,
        },
        metadata: {
          source: 'admin_action_tasks',
          original_log_id: action.logId,
          variables: action.variables || {},
        },
      });

      toast.success('تمت إعادة إرسال الإشعار', { id: toastId });
      fetchTasks();
    } catch (error) {
      console.error(error);
      await logAdminActivity({
        action: 'customer_notification_retry_failed',
        entityType: 'customer_message_log',
        entityId: action.logId,
        entityLabel: action.subject || 'إشعار عميل',
        oldValues: {
          status: 'failed',
          error_message: action.errorMessage || '',
        },
        newValues: {
          template_key: action.templateKey || '',
          customer_id: action.customerId || '',
        },
        metadata: {
          source: 'admin_action_tasks',
          retry_error: error.message || 'retry_failed',
        },
      });
      toast.error(getEmailErrorMessage(error.message), { id: toastId });
    } finally {
      setRetryingTaskId(null);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const filter = searchParams.get('filter') || 'all';
    if (FILTERS.some((item) => item.value === filter)) {
      setActiveFilter(filter);
    }
  }, [searchParams]);

  const stats = useMemo(() => summarizeAdminActionTasks(tasks), [tasks]);

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
            <TaskCard
              key={task.id}
              task={task}
              onRetryNotification={retryNotification}
              retryingTaskId={retryingTaskId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
