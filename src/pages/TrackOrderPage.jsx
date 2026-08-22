import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  History,
  Loader2,
  LogIn,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import CustomerAuthModal from '../components/CustomerAuthModal';
import PublicHeader from '../components/PublicHeader';
import { RewardPointsSummary } from '../components/RewardPointsSummary';
import SeoHead from '../components/SeoHead';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { getCustomerSession } from '../utils/customerSession';

async function getFunctionError(error) {
  try {
    const body = await error?.context?.clone?.().json?.();
    return body?.error || error?.message;
  } catch {
    return error?.message;
  }
}

function formatCurrency(value, language) {
  return new Intl.NumberFormat(language === 'en' ? 'en-SA' : 'ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value, language) {
  if (!value) return null;
  return new Intl.DateTimeFormat(language === 'en' ? 'en-SA' : 'ar-SA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function trackingUrl(shipment) {
  const number = shipment?.trackingNumber;
  const courier = String(shipment?.courier || '').toLowerCase();
  if (!number) return null;
  if (courier.includes('aramex') || courier.includes('أرامكس')) {
    return `https://www.aramex.com/track/results?ShipmentNumber=${encodeURIComponent(number)}`;
  }
  if (courier.includes('smsa') || courier.includes('سمسا')) {
    return `https://www.smsaexpress.com/sa/ar/trackingdetails?tracknumbers=${encodeURIComponent(number)}`;
  }
  return null;
}

const STATUS_TEXT = {
  ar: {
    pending_payment: ['بانتظار الدفع', 'بانتظار إكمال الدفع أو مراجعته.'],
    confirmed: ['تم استلام الطلب', 'وصل الطلب إلى لحظة فن وتم تأكيده.'],
    processing: ['قيد التجهيز', 'يجري تجهيز الطلب بعناية.'],
    ready: ['جاهز', 'أصبح الطلب جاهزًا للتسليم أو الشحن.'],
    shipped: ['تم الشحن', 'تم تسليم الطلب إلى شركة الشحن.'],
    completed: ['مكتمل', 'تم تسليم الطلب بنجاح.'],
    cancelled: ['ملغي', 'تم إلغاء الطلب.'],
    attention_required: ['يحتاج متابعة', 'توجد خطوة تحتاج إلى تواصل أو مراجعة.'],
  },
  en: {
    pending_payment: ['Awaiting payment', 'Payment or payment review is still pending.'],
    confirmed: ['Order received', 'Art Moment has received and confirmed your order.'],
    processing: ['In preparation', 'Your order is being prepared with care.'],
    ready: ['Ready', 'Your order is ready for delivery or dispatch.'],
    shipped: ['Shipped', 'Your order has been handed to the courier.'],
    completed: ['Completed', 'Your order has been delivered successfully.'],
    cancelled: ['Cancelled', 'This order has been cancelled.'],
    attention_required: ['Needs attention', 'A step requires review or contact.'],
  },
};

function statusCopy(code, language) {
  return STATUS_TEXT[language]?.[code] || STATUS_TEXT[language].attention_required;
}

function optionText(options) {
  return Object.entries(options || {})
    .filter(([, value]) => value !== null && value !== '')
    .map(([key, value]) => `${key}: ${value}`)
    .join(' • ');
}

function CustomerHistoryView({ data, language, loading, error, onRefresh }) {
  const text = language === 'en' ? {
    title: 'Your account overview',
    orders: 'All previous orders',
    totalOrders: 'Total orders',
    activeOrders: 'Active orders',
    remaining: 'Outstanding total',
    storeCredit: 'Store credit',
    print: 'Print order',
    store: 'Store order',
    quantity: 'Qty',
    empty: 'No previous orders are linked to this account yet.',
    openStoreOrder: 'Open full order details',
    account: 'Manage my account',
    allStoreOrders: 'Store orders',
    retry: 'Try again',
  } : {
    title: 'نظرة عامة على حسابك',
    orders: 'كل الطلبات السابقة',
    totalOrders: 'إجمالي الطلبات',
    activeOrders: 'طلبات نشطة',
    remaining: 'إجمالي المبالغ المتبقية',
    storeCredit: 'الرصيد النقدي بالمتجر',
    print: 'طلب طباعة',
    store: 'طلب متجر',
    quantity: 'الكمية',
    empty: 'لا توجد طلبات سابقة مرتبطة بهذا الحساب حتى الآن.',
    openStoreOrder: 'فتح تفاصيل الطلب كاملة',
    account: 'إدارة حسابي',
    allStoreOrders: 'طلبات المتجر',
    retry: 'إعادة المحاولة',
  };

  if (loading) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center border border-[#E8B4BC]/20 bg-white p-8 text-[#171717]/55">
        <Loader2 size={32} className="mb-4 animate-spin text-[#C6A56B]" />
        <p className="font-bold">{language === 'en' ? 'Loading your account...' : 'جاري تحميل سجل طلباتك...'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="border border-red-200 bg-red-50 p-6 text-center text-red-700">
        <AlertCircle size={30} className="mx-auto mb-3" />
        <p className="font-bold">{error}</p>
        <button type="button" onClick={onRefresh} className="mt-4 min-h-11 bg-[#171717] px-5 py-2 font-black text-white">
          {text.retry}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const orders = data.orders || [];
  const activeOrders = orders.filter((item) => !['completed', 'cancelled'].includes(item.status?.code)).length;
  const remaining = orders.reduce((total, item) => total + Number(item.financials?.remaining || 0), 0);

  return (
    <div className="space-y-5">
      <section className="border border-[#C6A56B]/25 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black text-[#C6A56B]">{text.title}</p>
            <h2 className="mt-1 text-2xl font-black">{data.customer?.name || '-'}</h2>
            {data.customer?.subscriptionCode && (
              <p className="mt-2 text-xs text-[#171717]/50">
                {language === 'en' ? 'Friendship code' : 'كود الصداقة'}:
                <strong className="ms-2 font-mono text-[#171717]" dir="ltr">{data.customer.subscriptionCode}</strong>
              </p>
            )}
          </div>
          <button type="button" onClick={onRefresh} className="flex min-h-11 items-center gap-2 border border-[#171717]/10 bg-[#FAF9F7] px-4 py-2 text-sm font-black">
            <RefreshCw size={16} /> {language === 'en' ? 'Refresh' : 'تحديث'}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="bg-[#FAF9F7] p-4"><span className="text-[11px] text-[#171717]/50">{text.totalOrders}</span><p className="mt-1 text-2xl font-black">{orders.length}</p></div>
          <div className="bg-[#C6A56B]/10 p-4"><span className="text-[11px] text-[#9E7D35]">{text.activeOrders}</span><p className="mt-1 text-2xl font-black text-[#9E7D35]">{activeOrders}</p></div>
          <div className="bg-[#E8B4BC]/10 p-4"><span className="text-[11px] text-[#B97882]">{text.remaining}</span><p className="mt-1 text-lg font-black text-[#B97882]">{formatCurrency(remaining, language)}</p></div>
          <div className="bg-emerald-50 p-4"><span className="text-[11px] text-emerald-700/65">{text.storeCredit}</span><p className="mt-1 text-lg font-black text-emerald-700">{formatCurrency(data.rewards?.storeCreditSar, language)}</p></div>
        </div>
      </section>

      <RewardPointsSummary rewards={data.rewards} />

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-black">{text.orders}</h2>
          <span className="text-xs font-bold text-[#171717]/45">{orders.length}</span>
        </div>

        {orders.length === 0 ? (
          <div className="border border-[#E8B4BC]/20 bg-white p-8 text-center">
            <ShoppingBag size={36} className="mx-auto mb-3 text-[#E8B4BC]" />
            <p className="font-bold text-[#171717]/60">{text.empty}</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {orders.map((item) => (
              <article key={item.id || item.orderNumber} className="border border-[#E8B4BC]/20 bg-white p-5 shadow-sm">
                <header className="flex items-start justify-between gap-4 border-b border-[#171717]/8 pb-4">
                  <div>
                    <p className="text-[11px] font-black text-[#C6A56B]">{item.orderType === 'print' ? text.print : text.store}</p>
                    <h3 className="mt-1 font-mono text-lg font-black" dir="ltr">#{item.orderNumber}</h3>
                    <p className="mt-1 text-[11px] text-[#171717]/45">{formatDate(item.createdAt, language)}</p>
                  </div>
                  <span className="bg-[#FAF9F7] px-3 py-1.5 text-xs font-black">{statusCopy(item.status?.code, language)[0]}</span>
                </header>

                <div className="divide-y divide-[#171717]/8">
                  {(item.items || []).slice(0, 3).map((orderItem, index) => (
                    <div key={orderItem.id || index} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span className="font-bold">{orderItem.name}</span>
                      <span className="shrink-0 text-xs text-[#171717]/50">{text.quantity}: {orderItem.quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between gap-4 border-t border-[#171717]/8 pt-4">
                  <span className="text-xs text-[#171717]/50">{text.remaining}</span>
                  <strong className={Number(item.financials?.remaining || 0) > 0 ? 'text-[#B97882]' : 'text-emerald-700'}>
                    {formatCurrency(item.financials?.remaining, language)}
                  </strong>
                </div>

                {item.orderType === 'store' && (
                  <Link to={`/store/orders/${item.id}`} className="mt-4 flex min-h-11 items-center justify-center gap-2 bg-[#171717] px-4 py-2 text-sm font-black text-white">
                    <ShieldCheck size={16} /> {text.openStoreOrder}
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/store/account" className="flex min-h-12 items-center justify-center gap-2 border border-[#C6A56B]/30 bg-white px-5 py-3 font-black">
          <ShieldCheck size={18} /> {text.account}
        </Link>
        <Link to="/store/orders" className="flex min-h-12 items-center justify-center gap-2 bg-[#171717] px-5 py-3 font-black text-white">
          <ShoppingBag size={18} /> {text.allStoreOrders}
        </Link>
      </div>
    </div>
  );
}

export default function TrackOrderPage() {
  const { language, direction } = useLanguage();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => (
    new URLSearchParams(location.search).get('tab') === 'history' ? 'history' : 'track'
  ));
  const [customerSession, setCustomerSession] = useState(() => getCustomerSession());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [orderNumber, setOrderNumber] = useState(() => location.state?.orderNumber || '');
  const [trackingToken, setTrackingToken] = useState(() => location.state?.trackingToken || '');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const ArrowIcon = direction === 'rtl' ? ArrowRight : ArrowLeft;

  const text = language === 'en' ? {
    title: 'Track your order',
    description: 'Enter the order number and secure tracking token included with your order confirmation.',
    orderNumber: 'Order number',
    orderPlaceholder: 'Example: 8a6c08',
    token: 'Secure tracking token',
    tokenPlaceholder: 'Paste the tracking token',
    submit: 'Track order',
    privacy: 'Your tracking token protects the order details. We never display customer contact details or original photo files here.',
    invalid: 'The order number and tracking token do not match. Check both values and try again.',
    limited: 'Too many attempts. Please wait a few minutes and try again.',
    failed: 'Tracking is temporarily unavailable. Please try again.',
    store: 'Store order',
    print: 'Print order',
    order: 'Order',
    timeline: 'Order progress',
    items: 'Order items',
    quantity: 'Qty',
    financials: 'Payment summary',
    subtotal: 'Subtotal',
    discount: 'Discount',
    coupon: 'Coupon',
    delivery: 'Delivery',
    cashPaid: 'Cash paid',
    pointsPaid: 'Paid with points',
    refunded: 'Refunded',
    remaining: 'Remaining',
    shipment: 'Shipment tracking',
    courier: 'Courier',
    openCourier: 'Open courier tracking',
    account: 'View all my orders',
    storeLink: 'Back to store',
    noItems: 'Item details are being prepared.',
    trackTab: 'Order number',
    historyTab: 'My order history',
    secureHistoryTitle: 'Sign in to view your complete history',
    secureHistoryCopy: 'Your print and store orders, reward points, expiring points and store credit are protected inside your account.',
    secureHistoryAction: 'Sign in and view history',
    friendshipNotice: 'The subscription number is a shareable friendship code, not an account password.',
  } : {
    title: 'تتبع طلبك',
    description: 'أدخل رقم الطلب ورمز التتبع الآمن المرفق بتأكيد الطلب.',
    orderNumber: 'رقم الطلب',
    orderPlaceholder: 'مثال: 8a6c08',
    token: 'رمز التتبع الآمن',
    tokenPlaceholder: 'الصق رمز التتبع',
    submit: 'تتبع الطلب',
    privacy: 'رمز التتبع يحمي تفاصيل الطلب. لا نعرض هنا بيانات تواصل العميل أو ملفات الصور الأصلية.',
    invalid: 'رقم الطلب ورمز التتبع غير متطابقين. تحقق من القيمتين ثم حاول مجددًا.',
    limited: 'تمت محاولات كثيرة. انتظر عدة دقائق ثم حاول مجددًا.',
    failed: 'خدمة التتبع غير متاحة مؤقتًا. حاول مرة أخرى.',
    store: 'طلب متجر',
    print: 'طلب طباعة',
    order: 'الطلب',
    timeline: 'تقدم الطلب',
    items: 'محتويات الطلب',
    quantity: 'الكمية',
    financials: 'ملخص الدفع',
    subtotal: 'المجموع الفرعي',
    discount: 'الخصم',
    coupon: 'الكوبون',
    delivery: 'التوصيل',
    cashPaid: 'المدفوع نقدًا',
    pointsPaid: 'المدفوع بالنقاط',
    refunded: 'المسترد',
    remaining: 'المتبقي',
    shipment: 'تتبع الشحنة',
    courier: 'شركة الشحن',
    openCourier: 'فتح تتبع شركة الشحن',
    account: 'عرض جميع طلباتي',
    storeLink: 'العودة للمتجر',
    noItems: 'يجري تجهيز تفاصيل محتويات الطلب.',
    trackTab: 'رقم الطلب',
    historyTab: 'سجل طلباتي',
    secureHistoryTitle: 'سجّلي الدخول لعرض سجلك الكامل',
    secureHistoryCopy: 'طلبات الطباعة والمتجر والنقاط القريبة من الانتهاء والرصيد النقدي محفوظة داخل حسابك الآمن.',
    secureHistoryAction: 'تسجيل الدخول وعرض السجل',
    friendshipNotice: 'رقم الاشتراك كود صداقة قابل للمشاركة، وليس كلمة مرور للحساب.',
  };

  const shipmentLink = useMemo(() => trackingUrl(order?.shipment), [order]);

  const loadHistory = useCallback(async () => {
    const session = getCustomerSession();
    setCustomerSession(session);
    if (!session?.sessionToken) {
      setHistoryData(null);
      setHistoryError('');
      return;
    }

    setHistoryLoading(true);
    setHistoryError('');
    try {
      const { data, error: functionError } = await supabase.functions.invoke('track-order', {
        body: {
          mode: 'history',
          sessionToken: session.sessionToken,
        },
      });
      if (functionError) throw new Error(await getFunctionError(functionError));
      setHistoryData(data || null);
    } catch (requestError) {
      const message = String(requestError?.message || '');
      if (message.includes('unauthorized')) {
        setCustomerSession(null);
        setHistoryData(null);
        setHistoryError(language === 'en' ? 'Your session has expired. Sign in again.' : 'انتهت جلسة الحساب. سجّلي الدخول من جديد.');
      } else {
        setHistoryError(language === 'en' ? 'Your order history is temporarily unavailable.' : 'تعذر تحميل سجل الطلبات مؤقتاً.');
      }
    } finally {
      setHistoryLoading(false);
    }
  }, [language]);

  useEffect(() => {
    if (activeTab === 'history' && customerSession?.sessionToken) loadHistory();
  }, [activeTab, customerSession?.sessionToken, loadHistory]);

  const submit = async (event) => {
    event.preventDefault();
    const cleanOrder = orderNumber.replace('#', '').trim();
    const cleanToken = trackingToken.trim();
    if (!cleanOrder || !cleanToken) {
      setError(text.invalid);
      setOrder(null);
      return;
    }

    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('track-order', {
        body: {
          orderNumber: cleanOrder,
          trackingToken: cleanToken,
        },
      });
      if (functionError) throw new Error(await getFunctionError(functionError));
      if (!data?.order) throw new Error('tracking_not_found');
      setOrder(data.order);

    } catch (requestError) {
      const code = String(requestError?.message || '');
      if (code.includes('tracking_unavailable')) setError(text.limited);
      else if (code.includes('tracking_not_found')) setError(text.invalid);
      else setError(text.failed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="art-page min-h-screen bg-[#FAF9F7] font-[Tajawal] text-[#171717]" dir={direction}>
      <SeoHead
        title={language === 'en' ? 'Track your order | Art Moment' : 'تتبع طلبك | لحظة فن'}
        description={text.description}
        path="/track"
        noindex
      />
      <PublicHeader />

      <main className="art-shell py-10 sm:py-14">
        <section className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#C6A56B]/25 bg-white text-[#C6A56B]">
              <Package size={25} />
            </div>
            <h1 className="text-3xl font-black sm:text-4xl">{text.title}</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#171717]/60">{text.description}</p>
          </div>

          <div className="mb-6 grid grid-cols-2 border border-[#171717]/10 bg-white p-1 shadow-sm" role="tablist" aria-label={text.title}>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'track'}
              onClick={() => setActiveTab('track')}
              className={`flex min-h-12 items-center justify-center gap-2 px-4 py-3 text-sm font-black transition-colors ${activeTab === 'track' ? 'bg-[#171717] text-white' : 'text-[#171717]/60'}`}
            >
              <Package size={18} /> {text.trackTab}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
              className={`flex min-h-12 items-center justify-center gap-2 px-4 py-3 text-sm font-black transition-colors ${activeTab === 'history' ? 'bg-[#C6A56B] text-white' : 'text-[#171717]/60'}`}
            >
              <History size={18} /> {text.historyTab}
            </button>
          </div>

          {activeTab === 'track' ? (
            <>
          <form id="tracking-form" onSubmit={submit} className="border border-[#E8B4BC]/25 bg-white p-5 shadow-sm sm:p-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-black text-[#171717]/65">{text.orderNumber}</span>
                <input
                  value={orderNumber}
                  onChange={(event) => setOrderNumber(event.target.value)}
                  placeholder={text.orderPlaceholder}
                  autoComplete="off"
                  dir="ltr"
                  className="art-input h-14 w-full px-4 text-center font-mono"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black text-[#171717]/65">{text.token}</span>
                <input
                  value={trackingToken}
                  onChange={(event) => setTrackingToken(event.target.value)}
                  placeholder={text.tokenPlaceholder}
                  autoComplete="off"
                  dir="ltr"
                  className="art-input h-14 w-full px-4 text-center font-mono"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 bg-[#171717] px-5 py-3 font-black text-white transition-colors hover:bg-[#C6A56B] disabled:opacity-60"
            >
              {loading ? <Loader2 size={19} className="animate-spin" /> : <Search size={19} />}
              {text.submit}
            </button>
            <p className="mt-4 flex items-start justify-center gap-2 text-center text-xs leading-6 text-emerald-700">
              <ShieldCheck size={16} className="mt-1 shrink-0" /> {text.privacy}
            </p>
          </form>

          {error && (
            <div role="alert" className="mt-5 flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {order && (
            <article className="mt-8 space-y-5">
              <header className="border border-[#171717]/10 bg-[#171717] p-6 text-white sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <p className="text-xs font-bold text-white/55">{order.orderType === 'print' ? text.print : text.store}</p>
                    <h2 className="mt-2 text-2xl font-black" dir="ltr">#{order.orderNumber}</h2>
                    <p className="mt-2 text-xs text-white/55">{formatDate(order.createdAt, language)}</p>
                  </div>
                  <div className="max-w-sm text-start">
                    <p className="text-lg font-black">{statusCopy(order.status?.code, language)[0]}</p>
                    <p className="mt-1 text-xs leading-6 text-white/65">{statusCopy(order.status?.code, language)[1]}</p>
                  </div>
                </div>
              </header>

              <section className="border border-[#E8B4BC]/20 bg-white p-5 sm:p-7">
                <h3 className="mb-5 flex items-center gap-2 font-black">
                  <Clock3 size={19} className="text-[#C6A56B]" /> {text.timeline}
                </h3>
                <ol className="grid gap-3 sm:grid-cols-2">
                  {(order.timeline || []).map((step, index) => (
                    <li key={`${step.code}-${index}`} className={`flex items-start gap-3 border p-4 ${step.current ? 'border-[#C6A56B]/40 bg-[#C6A56B]/8' : 'border-[#171717]/8 bg-[#FAF9F7]'}`}>
                      <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-[#C6A56B]" />
                      <div>
                        <p className="text-sm font-black">{statusCopy(step.code, language)[0]}</p>
                        {step.occurredAt && <p className="mt-1 text-[11px] text-[#171717]/50">{formatDate(step.occurredAt, language)}</p>}
                        {step.reason && <p className="mt-2 text-xs text-[#171717]/60">{step.reason}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="border border-[#E8B4BC]/20 bg-white p-5 sm:p-7">
                <h3 className="mb-5 flex items-center gap-2 font-black">
                  <ShoppingBag size={19} className="text-[#E8B4BC]" /> {text.items}
                </h3>
                {(order.items || []).length > 0 ? (
                  <div className="divide-y divide-[#171717]/8">
                    {order.items.map((item, index) => (
                      <div key={item.id || index} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                        <div>
                          <p className="font-black">{item.name}</p>
                          {optionText(item.options) && <p className="mt-1 text-xs leading-6 text-[#171717]/50">{optionText(item.options)}</p>}
                        </div>
                        <div className="shrink-0 text-end">
                          <p className="text-xs text-[#171717]/50">{text.quantity}: {item.quantity}</p>
                          {item.lineTotal !== undefined && <p className="mt-1 font-black text-[#C6A56B]">{formatCurrency(item.lineTotal, language)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-[#171717]/50">{text.noItems}</p>}
              </section>

              <section className="border border-[#E8B4BC]/20 bg-white p-5 sm:p-7">
                <h3 className="mb-5 flex items-center gap-2 font-black">
                  <CreditCard size={19} className="text-[#C6A56B]" /> {text.financials}
                </h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-[#171717]/55">{text.subtotal}</dt><dd className="font-black">{formatCurrency(order.financials?.subtotal, language)}</dd></div>
                  {Number(order.financials?.discount || 0) > 0 && <div className="flex justify-between gap-4 text-emerald-700"><dt>{order.financials?.couponCode ? `${text.coupon} ${order.financials.couponCode}` : text.discount}</dt><dd className="font-black">-{formatCurrency(order.financials.discount, language)}</dd></div>}
                  <div className="flex justify-between gap-4"><dt className="text-[#171717]/55">{text.delivery}</dt><dd className="font-black">{formatCurrency(order.financials?.deliveryFee, language)}</dd></div>
                  {Number(order.financials?.cashPaid || 0) > 0 && <div className="flex justify-between gap-4 text-emerald-700"><dt>{text.cashPaid}</dt><dd className="font-black">{formatCurrency(order.financials.cashPaid, language)}</dd></div>}
                  {Number(order.financials?.pointsPaid || 0) > 0 && <div className="flex justify-between gap-4 text-[#B97882]"><dt>{text.pointsPaid}</dt><dd className="font-black">{formatCurrency(order.financials.pointsPaid, language)}</dd></div>}
                  {Number(order.financials?.refunded || 0) > 0 && <div className="flex justify-between gap-4 text-orange-700"><dt>{text.refunded}</dt><dd className="font-black">{formatCurrency(order.financials.refunded, language)}</dd></div>}
                  <div className="flex justify-between gap-4 border-t border-[#171717]/10 pt-4 text-base"><dt className="font-black">{text.remaining}</dt><dd className="font-black text-[#E8B4BC]">{formatCurrency(order.financials?.remaining, language)}</dd></div>
                </dl>
              </section>

              {order.shipment && (
                <section className="border border-[#C6A56B]/25 bg-[#C6A56B]/8 p-5 sm:p-7">
                  <h3 className="mb-4 flex items-center gap-2 font-black"><Truck size={19} /> {text.shipment}</h3>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-[#171717]/50">{text.courier}: {order.shipment.courier || '-'}</p>
                      <p className="mt-1 font-mono text-lg font-black" dir="ltr">{order.shipment.trackingNumber}</p>
                    </div>
                    {shipmentLink && <a href={shipmentLink} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 bg-[#171717] px-4 py-2 text-sm font-black text-white">{text.openCourier} <ArrowIcon size={16} /></a>}
                  </div>
                </section>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Link to="/store/orders" className="flex min-h-12 items-center justify-center gap-2 border border-[#C6A56B]/30 bg-white px-5 py-3 font-black text-[#171717]">
                  <ShieldCheck size={18} /> {text.account}
                </Link>
                <Link to="/store" className="flex min-h-12 items-center justify-center gap-2 bg-[#171717] px-5 py-3 font-black text-white">
                  <ShoppingBag size={18} /> {text.storeLink}
                </Link>
              </div>
            </article>
          )}
            </>
          ) : customerSession?.sessionToken ? (
            <CustomerHistoryView
              data={historyData}
              language={language}
              loading={historyLoading}
              error={historyError}
              onRefresh={loadHistory}
            />
          ) : (
            <section className="border border-[#E8B4BC]/25 bg-white p-7 text-center shadow-sm sm:p-10">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C6A56B]/12 text-[#C6A56B]">
                <LogIn size={27} />
              </div>
              <h2 className="text-2xl font-black">{text.secureHistoryTitle}</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#171717]/60">{text.secureHistoryCopy}</p>
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="mx-auto mt-6 flex min-h-12 items-center justify-center gap-2 bg-[#171717] px-7 py-3 font-black text-white"
              >
                <LogIn size={18} /> {text.secureHistoryAction}
              </button>
              <p className="mt-5 flex items-start justify-center gap-2 text-xs leading-6 text-[#9E7D35]">
                <ShieldCheck size={16} className="mt-1 shrink-0" /> {text.friendshipNotice}
              </p>
            </section>
          )}
        </section>
      </main>

      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        initialMode="login"
        redirectTo="/track?tab=history"
        onClose={() => {
          setIsAuthModalOpen(false);
          setCustomerSession(getCustomerSession());
        }}
      />
    </div>
  );
}
