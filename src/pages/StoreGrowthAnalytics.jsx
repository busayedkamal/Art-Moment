import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  UserRoundCheck,
  WalletCards,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const FUNNEL_STAGES = [
  { key: 'store_visit', label: 'زيارة المتجر', icon: TrendingUp, color: '#4A4A4A' },
  { key: 'add_to_cart', label: 'إضافة للسلة', icon: ShoppingCart, color: '#D9A3AA' },
  { key: 'login', label: 'دخول العميل', icon: UserRoundCheck, color: '#C5A059' },
  { key: 'checkout_started', label: 'بدء إتمام الطلب', icon: WalletCards, color: '#3B82F6' },
  { key: 'payment_completed', label: 'دفع مكتمل', icon: CheckCircle2, color: '#10B981' },
];

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} ر.س`;
}

function formatDate(value) {
  if (!value) return 'غير محدد';
  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function StoreGrowthAnalytics() {
  const [days, setDays] = useState(30);
  const [events, setEvents] = useState([]);
  const [carts, setCarts] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [eventsResult, cartsResult, errorsResult] = await Promise.all([
      supabase
        .from('store_funnel_events')
        .select('event_name, anonymous_id, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10000),
      supabase
        .from('abandoned_carts')
        .select('id, status, subtotal, last_activity_at, reminder_sent_at, customers(name, email)')
        .order('last_activity_at', { ascending: false })
        .limit(100),
      supabase
        .from('app_error_logs')
        .select('id, message, path, occurrence_count, last_seen_at')
        .is('resolved_at', null)
        .order('last_seen_at', { ascending: false })
        .limit(50),
    ]);

    const missingFoundation = [eventsResult.error, cartsResult.error, errorsResult.error]
      .some((error) => /does not exist|schema cache|relation/i.test(error?.message || ''));

    if (missingFoundation) {
      toast.error('شغّل ترحيل أساس نمو المتجر أولاً.');
    } else if (eventsResult.error || cartsResult.error || errorsResult.error) {
      toast.error('تعذر تحميل لوحة نمو المتجر.');
    }

    setEvents(eventsResult.data || []);
    setCarts(cartsResult.data || []);
    setErrors(errorsResult.data || []);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const funnel = useMemo(() => {
    const counts = new Map();
    FUNNEL_STAGES.forEach((stage) => counts.set(stage.key, new Set()));
    events.forEach((event) => counts.get(event.event_name)?.add(event.anonymous_id));

    return FUNNEL_STAGES.map((stage, index) => {
      const count = counts.get(stage.key)?.size || 0;
      const previous = index === 0 ? count : (counts.get(FUNNEL_STAGES[index - 1].key)?.size || 0);
      return {
        ...stage,
        count,
        conversion: index === 0 ? 100 : (previous > 0 ? Math.round((count / previous) * 100) : 0),
      };
    });
  }, [events]);

  const activeCarts = carts.filter((cart) => cart.status === 'active');
  const recoveredCarts = carts.filter((cart) => ['converted', 'recovered'].includes(cart.status));
  const reminderCarts = activeCarts.filter((cart) => cart.reminder_sent_at);
  const maxCount = Math.max(1, ...funnel.map((stage) => stage.count));

  const resolveError = async (id) => {
    const { error } = await supabase
      .from('app_error_logs')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error('تعذر إغلاق الخطأ.');
      return;
    }
    setErrors((current) => current.filter((item) => item.id !== id));
    toast.success('تم تعليم الخطأ كمعالج.');
  };

  return (
    <div className="space-y-6 font-[Tajawal] text-[#4A4A4A]" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-black text-[#C5A059]">القياس والتشغيل</p>
          <h1 className="text-3xl font-black">نمو المتجر</h1>
          <p className="mt-1 text-sm text-[#4A4A4A]/55">
            مسار الشراء، السلات المتروكة، والأخطاء التي تحتاج متابعة.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="rounded-lg border border-[#D9A3AA]/25 bg-white px-4 py-2.5 text-sm font-bold outline-none"
            aria-label="الفترة الزمنية"
          >
            <option value={7}>آخر 7 أيام</option>
            <option value={30}>آخر 30 يوماً</option>
            <option value={90}>آخر 90 يوماً</option>
          </select>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#D9A3AA]/25 bg-white"
            title="تحديث"
            aria-label="تحديث البيانات"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <section className="border-y border-[#D9A3AA]/15 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black">مسار الشراء</h2>
            <p className="text-xs text-[#4A4A4A]/50">زوار فريدون لكل مرحلة خلال الفترة المختارة.</p>
          </div>
          <span className="rounded-full bg-[#F8F5F2] px-3 py-1 text-xs font-black">
            {events.length.toLocaleString('ar-SA')} حدث
          </span>
        </div>
        <div className="grid gap-3 lg:grid-cols-5">
          {funnel.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <article key={stage.key} className="rounded-lg border border-[#D9A3AA]/15 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F8F5F2]" style={{ color: stage.color }}>
                    <Icon size={19} />
                  </span>
                  {index > 0 && (
                    <span className="text-xs font-black text-[#4A4A4A]/45">{stage.conversion}% من السابقة</span>
                  )}
                </div>
                <p className="text-xs font-bold text-[#4A4A4A]/55">{stage.label}</p>
                <p className="mt-1 text-2xl font-black">{stage.count.toLocaleString('ar-SA')}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F8F5F2]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.max(4, stage.count / maxCount * 100)}%`, backgroundColor: stage.color }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-[#D9A3AA]/15 bg-white p-5">
          <p className="text-xs font-bold text-[#4A4A4A]/55">سلات نشطة</p>
          <p className="mt-2 text-3xl font-black">{activeCarts.length.toLocaleString('ar-SA')}</p>
          <p className="mt-2 text-xs text-[#4A4A4A]/50">
            بقيمة تقريبية {formatMoney(activeCarts.reduce((sum, cart) => sum + Number(cart.subtotal || 0), 0))}
          </p>
        </article>
        <article className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-bold text-amber-800/70">أُرسل لها تذكير</p>
          <p className="mt-2 text-3xl font-black text-amber-800">{reminderCarts.length.toLocaleString('ar-SA')}</p>
          <p className="mt-2 text-xs text-amber-800/60">للعملاء الموافقين على الرسائل فقط.</p>
        </article>
        <article className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-bold text-emerald-800/70">سلات مستعادة أو محولة</p>
          <p className="mt-2 text-3xl font-black text-emerald-800">{recoveredCarts.length.toLocaleString('ar-SA')}</p>
          <p className="mt-2 text-xs text-emerald-800/60">تظهر بعد إتمام الطلب من السلة المحفوظة.</p>
        </article>
      </section>

      <section className="border-t border-[#D9A3AA]/15 pt-6">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle size={19} className="text-rose-500" />
          <h2 className="text-lg font-black">أخطاء غير معالجة</h2>
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-600">{errors.length}</span>
        </div>

        {errors.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-emerald-200 bg-emerald-50/50 text-sm font-bold text-emerald-700">
            لا توجد أخطاء غير معالجة.
          </div>
        ) : (
          <div className="grid gap-3">
            {errors.map((item) => (
              <article key={item.id} className="grid gap-4 rounded-lg border border-rose-100 bg-white p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <p className="break-words text-sm font-black">{item.message}</p>
                  <p className="mt-1 truncate text-xs text-[#4A4A4A]/45" dir="ltr">{item.path || 'unknown path'}</p>
                  <p className="mt-2 text-xs text-[#4A4A4A]/45">
                    تكرر {Number(item.occurrence_count || 1).toLocaleString('ar-SA')} مرة · آخر ظهور {formatDate(item.last_seen_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => resolveError(item.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4A4A4A] px-4 py-2.5 text-xs font-black text-white"
                >
                  <CheckCircle2 size={15} /> تم الحل
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
