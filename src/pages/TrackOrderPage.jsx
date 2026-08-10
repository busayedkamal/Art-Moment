// src/pages/TrackOrderPage.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Search, Package, Clock, CheckCircle, Truck,
  AlertCircle, Banknote, Wallet, FileText,
  MapPin, Calendar, UserCheck, Home,
  Image, BookOpen, History, ShieldCheck, Copy, MessageCircle, Phone, ShoppingBag
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import logo from '../assets/logo-art-moment.svg';
import { getCustomerSession } from '../utils/customerSession';
import OrderFinancialBreakdown from '../components/OrderFinancialBreakdown';
import { RewardPointsSummary, RewardRedemptionForm } from '../components/RewardPointsSummary';
import { getPrintOrderFinancials } from '../utils/orderFinancials';
import {
  getPaymentState,
  getStoreOrderStatus,
  getStoreOrderStepIndex,
  STORE_ORDER_STEPS,
} from '../utils/storeOrderStatus';

async function getFunctionError(error) {
  try {
    const body = await error?.context?.clone?.().json?.();
    return body?.error || error?.message;
  } catch {
    return error?.message;
  }
}

const STORE_STEP_ICONS = {
  pending_verification: Clock,
  confirmed: CheckCircle,
  processing: Package,
  ready_for_delivery: Package,
  shipped: Truck,
  delivered: ShieldCheck,
};

function StoreStatusBadge({ status }) {
  const info = getStoreOrderStatus(status);
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${info.tone}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {info.label}
    </span>
  );
}

function StorePaymentBadge({ order }) {
  const payment = getPaymentState({
    totalAmount: order.total_amount,
    deliveryFee: order.delivery_fee,
    amountPaid: order.amount_paid,
    pointsUsedAmount: order.points_used_amount,
    paymentStatus: order.payment_status,
    refundedAmount: order.refunded_amount,
  });

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${payment.tone}`}>
      <Wallet size={13} />
      {payment.label}
    </span>
  );
}

function StoreOrderTimeline({ status }) {
  const activeIndex = getStoreOrderStepIndex(status);
  const info = getStoreOrderStatus(status);

  if (activeIndex === -1) {
    return (
      <div className={`mb-6 rounded-2xl border p-4 text-sm font-bold ${info.tone}`}>
        {info.description}
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-[#E8B4BC]/15 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black text-[#C6A56B]">تتبع طلب المتجر</p>
          <p className="text-sm font-bold text-[#171717]/65">{info.description}</p>
        </div>
        <StoreStatusBadge status={status} />
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {STORE_ORDER_STEPS.map((step, index) => {
          const stepInfo = getStoreOrderStatus(step);
          const Icon = STORE_STEP_ICONS[step] || Package;
          const done = index <= activeIndex;

          return (
            <div key={step} className="flex flex-col items-center gap-2 text-center">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition-all ${
                done
                  ? 'border-[#C6A56B] bg-[#C6A56B] text-white shadow-sm'
                  : 'border-[#E8B4BC]/10 bg-[#FAF9F7] text-[#171717]/30'
              }`}>
                <Icon size={17} />
              </div>
              <span className={`text-[10px] font-black leading-tight ${done ? 'text-[#171717]' : 'text-[#171717]/35'}`}>
                {stepInfo.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrackOrderPage() {
  const [activeTab, setActiveTab] = useState('id'); // 'id' or 'history'
  const [searchId, setSearchId] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  const [ordersList, setOrdersList] = useState([]);
  const [paymentsMap, setPaymentsMap] = useState({}); 
  const [customerStats, setCustomerStats] = useState({ points: 0, packages: 0, debt: 0, net: 0 });
  const [customerSession, setCustomerSession] = useState(null);
  const [applyingPointsTo, setApplyingPointsTo] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const customer = getCustomerSession();
    setCustomerSession(customer);
    if (customer?.phone) setPhone(customer.phone);
  }, []);

  const handleApplyRewardPoints = async (order, points) => {
    const session = getCustomerSession();
    if (!session?.sessionToken) {
      toast.error('سجلي الدخول من صفحة طلباتي لاستخدام النقاط');
      return;
    }
    setApplyingPointsTo(order.id);
    const toastId = toast.loading('جاري تحديث النقاط...');
    try {
      const { error: functionError } = await supabase.functions.invoke('customer-orders', {
        body: {
          action: 'apply_reward_points',
          sessionToken: session.sessionToken,
          orderId: order.id,
          points,
        },
      });
      if (functionError) throw new Error(await getFunctionError(functionError));
      toast.success(points > 0 ? 'تم تطبيق النقاط على الطلب' : 'تم إلغاء النقاط من الطلب', { id: toastId });
      if (activeTab === 'history') await handleHistorySearch({ preventDefault() {} });
      else await handleIdSearch({ preventDefault() {} });
    } catch (err) {
      console.error(err);
      const message = String(err?.message || '');
      toast.error(
        message.includes('reward_minimum_redemption_not_met')
          ? 'لم تصلي إلى الحد الأدنى للاستبدال.'
          : message.includes('reward_redemption_limit_exceeded') || message.includes('reward_redemption_exceeds_unpaid_products')
            ? 'عدد النقاط يتجاوز الحد المسموح لهذا الطلب.'
            : message.includes('reward_points_balance_insufficient')
              ? 'رصيد النقاط غير كافٍ.'
              : 'تعذر تحديث النقاط حالياً.',
        { id: toastId },
      );
    } finally {
      setApplyingPointsTo(null);
    }
  };

  const handleIdSearch = async (e) => {
    e.preventDefault();

    const cleanInput = searchId.replace('#', '').trim().toLowerCase();
    if (!cleanInput) { setError('يرجى إدخال رقم الطلب'); return; }

    // أخذ أول 6 أحرف فقط — يعمل حتى لو لصق العميل UUID كاملاً
    const shortCleanId = cleanInput.slice(0, 6);

    setLoading(true); setError(null); setOrdersList([]); setCustomerStats(null);
    try {
      const { data, error } = await supabase.functions.invoke('track-order', {
        body: { mode: 'id', searchId: shortCleanId, sessionToken: getCustomerSession()?.sessionToken || null },
      });
      if (error) throw new Error(await getFunctionError(error));

      setOrdersList(data?.orders || []);
      setPaymentsMap(data?.paymentsMap || {});
      setCustomerStats(data?.customerStats || null);
    } catch (err) {
      console.error('Search Error:', err);
      setError('حدث خطأ أثناء البحث، يرجى المحاولة مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  const handleHistorySearch = async (e) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || !pin) { setError('يرجى إدخال الجوال ورقم الاشتراك'); return; }

    setLoading(true); setError(null); setOrdersList([]); setCustomerStats(null);
    try {
      const { data, error } = await supabase.functions.invoke('track-order', {
        body: { mode: 'history', phone, pin },
      });
      if (error) throw new Error(await getFunctionError(error));

      const orders = data?.orders || [];
      setOrdersList(orders);
      setPaymentsMap(data?.paymentsMap || {});
      setCustomerStats(data?.customerStats || null);

      if (orders.length === 0) {
        toast.success('تم تسجيل الدخول بنجاح، ولكن لا توجد طلبات سابقة.');
      }
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء جلب السجل.');
    } finally {
      setLoading(false);
    }
  };

  const getStepStatus = (status) => {
    const steps = { new: 1, printing: 2, done: 3, delivered: 4 };
    return steps[status] || 1;
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  return (
    <div className="art-page min-h-screen flex flex-col items-center py-10 px-4 relative font-[Tajawal] text-[#171717]" dir="rtl">
      <Toaster position="top-center" />

      <Link to="/" className="absolute top-6 right-6 flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-[#E8B4BC]/20 shadow-sm text-[#171717] hover:text-[#E8B4BC] transition-colors font-bold text-sm z-10">
        <Home size={16} /> الرئيسية
      </Link>

      <div className="text-center mb-10 mt-8 relative z-10">
        <img src={logo} alt="Art Moment" className="w-24 h-24 mx-auto mb-4 object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300"/>
        <h1 className="text-3xl font-black text-[#171717] mb-2">تتبع طلبك</h1>
        <p className="text-[#171717]/60">أدخل البيانات لمعرفة حالة طلباتك والمبالغ المتبقية</p>
      </div>

      <div className="w-full max-w-xl mx-auto relative z-10">

        {/* Tabs */}
        <div className="art-panel flex p-1 rounded-2xl mb-6">
          <button
            onClick={() => { setActiveTab('id'); setOrdersList([]); setError(null); }}
            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'id' ? 'bg-[#E8B4BC]/40 text-[#171717]' : 'text-[#171717]/50 hover:bg-[#FAF9F7]'
            }`}
          >
            <Package size={18} /> رقم الطلب
          </button>
          <button
            onClick={() => { setActiveTab('history'); setOrdersList([]); setError(null); }}
            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'history' ? 'bg-[#C6A56B]/40 text-[#171717]' : 'text-[#171717]/50 hover:bg-[#FAF9F7]'
            }`}
          >
            <History size={18} /> سجل طلباتي
          </button>
        </div>

        {/* Forms */}
        {activeTab === 'id' ? (
          <form onSubmit={handleIdSearch} className="relative mb-6">
            <input
              type="text" value={searchId} onChange={(e) => setSearchId(e.target.value)}
              placeholder="مثال: bf0177..."
              className="art-input w-full h-14 pl-14 pr-6 rounded-2xl outline-none text-center font-mono" dir="ltr"
            />
            <button type="submit" disabled={loading} className="absolute left-2 top-2 bottom-2 aspect-square bg-[#E8B4BC] text-white rounded-xl flex items-center justify-center hover:bg-[#C6A56B] transition-colors disabled:opacity-70 shadow-md">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={24} />}
            </button>
          </form>
        ) : (
          <form onSubmit={handleHistorySearch} className="space-y-4 mb-6">
            <div className="relative">
              <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-[#E8B4BC]/50" size={20} />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم الجوال المسجل (مثال: 05...)" className="art-input w-full h-14 pr-12 pl-4 rounded-2xl outline-none" />
            </div>
            <div className="relative">
              <ShieldCheck className="absolute right-4 top-1/2 -translate-y-1/2 text-[#E8B4BC]/50" size={20} />
              <input type="text" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="رقم الاشتراك السري (4 أرقام)" className="w-full h-14 pr-12 pl-4 rounded-2xl border-2 border-[#E8B4BC]/20 bg-white shadow-sm focus:border-[#E8B4BC] outline-none transition-all font-mono tracking-widest text-center" dir="ltr" maxLength="4"/>
            </div>
            <button type="submit" disabled={loading} className="w-full h-14 bg-gradient-to-r from-[#E8B4BC] to-[#C6A56B] text-white rounded-2xl font-black text-lg hover:shadow-lg transition-all flex items-center justify-center gap-2">
              {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><History size={20}/> عرض سجل طلباتي</>}
            </button>
          </form>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 mb-6 border border-red-100 animate-in slide-in-from-top-2">
            <AlertCircle size={20} />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        {/* Orders List Rendering */}
        {ordersList.length > 0 && (
          <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* Customer Stats Header (Only in History Tab) */}
            {activeTab === 'history' && customerStats && (
              <div className="bg-white p-5 rounded-[2rem] border border-[#E8B4BC]/20 shadow-sm">
                 <h3 className="text-sm font-bold text-[#171717] mb-4 flex items-center gap-2">
                   <UserCheck size={18} className="text-[#E8B4BC]"/> نظرة عامة على حسابك
                 </h3>
                 <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-[#FAF9F7] rounded-xl p-3 border border-[#E8B4BC]/10">
                       <span className="font-bold text-violet-600/60 block mb-1 text-[10px]">رصيد الباقات المتاح</span>
                       <span className="font-black text-violet-600 dir-ltr text-xl">{(customerStats.packages || 0).toFixed(2)}</span>
                    </div>
                    <div className="bg-[#FAF9F7] rounded-xl p-3 border border-[#E8B4BC]/10">
                       <span className="font-bold text-emerald-600/60 block mb-1 text-[10px]">رصيد النقاط</span>
                       <span className="font-black text-emerald-600 dir-ltr text-xl">{Number(customerStats.points || 0).toLocaleString()} نقطة</span>
                       <span className="mt-1 block text-[9px] text-emerald-700/55">تعادل {Number(customerStats.pointsValue || 0).toFixed(2)} ريال · الصلاحية {Number(customerStats.pointsExpiryMonths || 4)} أشهر</span>
                    </div>
                    <div className="bg-[#FAF9F7] rounded-xl p-3 border border-[#E8B4BC]/10">
                       <span className="font-bold text-blue-600/60 block mb-1 text-[10px]">المدفوعات الكلية</span>
                       <span className="font-black text-blue-600 dir-ltr text-xl">{(customerStats.totalPayments || 0).toFixed(2)}</span>
                    </div>
                    <div className="bg-[#FAF9F7] rounded-xl p-3 border border-[#E8B4BC]/10">
                       <span className="font-bold text-red-600/60 block mb-1 text-[10px]">المديونية المتبقية</span>
                       <span className="font-black text-red-600 dir-ltr text-xl">{(customerStats.totalDebt || 0).toFixed(2)}</span>
                    </div>
                 </div>
              </div>
            )}

            <RewardPointsSummary rewards={customerStats?.rewards} compact={activeTab !== 'history'} />

            {ordersList.map(order => {
              const currentStep = getStepStatus(order.status);
              const storeTotal = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
              const storeRefunded = Number(order.refunded_amount || 0);
              const storeStatus = order.order_type === 'store' ? getStoreOrderStatus(order.status) : null;
              const printFinancials = order.order_type === 'print' ? getPrintOrderFinancials(order) : null;
              const remaining = order.order_type === 'store'
                ? storeTotal - Number(order.amount_paid || 0) - Number(order.points_used_amount || 0)
                : printFinancials.remainingAmount;
              const orderPayments = paymentsMap[order.id] || [];

              return (
                <div key={order.id} className="bg-white rounded-[2rem] border border-[#E8B4BC]/20 shadow-xl overflow-hidden">
                  <div className="bg-[#171717] text-white p-6 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#C6A56B]/20 rounded-full blur-2xl"></div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${order.order_type === 'store' ? 'bg-[#C6A56B] text-white' : 'bg-[#E8B4BC] text-white'}`}>
                          {order.order_type === 'store' ? 'متجر' : 'طباعة'}
                        </span>
                        <span className="font-mono text-xs opacity-70">#{order.id.slice(0, 6)}</span>
                      </div>
                      <h2 className="text-2xl font-black mt-2">
                        {order.order_type === 'store'
                          ? (storeStatus?.label || order.status)
                          : (
                              order.status === 'new' ? 'جديد / قيد المراجعة' :
                              order.status === 'printing' ? 'جاري الطباعة والتجهيز' :
                              order.status === 'done' ? 'جاهز للاستلام' :
                              order.status === 'delivered' ? 'تم التسليم بنجاح' : order.status
                            )
                        }
                      </h2>
                      {order.order_type === 'store' && (
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                          <StoreStatusBadge status={order.status} />
                          <StorePaymentBadge order={order} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-6">
                    {/* Progress Bar */}
                    {order.order_type === 'store' ? (
                      <StoreOrderTimeline status={order.status} />
                    ) : (
                      <div className="relative flex justify-between mb-8 px-2">
                        <div className="absolute top-1/2 left-0 right-0 h-1 bg-[#FAF9F7] -translate-y-1/2 z-0"></div>
                        <div className="absolute top-1/2 right-0 h-1 bg-[#50C878] -translate-y-1/2 z-0 transition-all duration-1000" style={{ left: `${100 - ((currentStep - 1) / 3 * 100)}%` }}></div>
                        {[
                          { id: 1, key: 'new', icon: Package, label: 'جديد' },
                          { id: 2, key: 'printing', icon: Clock, label: 'طباعة' },
                          { id: 3, key: 'done', icon: CheckCircle, label: 'جاهز' },
                          { id: 4, key: 'delivered', icon: Truck, label: 'تسليم' },
                        ].map((step) => {
                          const stepDate = formatDate(order[`date_${step.key}`]);
                          return (
                            <div key={step.id} className="relative z-10 flex flex-col items-center gap-1">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${currentStep >= step.id ? 'bg-[#50C878] border-[#50C878] text-white shadow-md scale-110' : 'bg-white border-[#FAF9F7] text-[#171717]/30'}`}><step.icon size={14} /></div>
                              <span className={`text-[10px] font-bold ${currentStep >= step.id ? 'text-[#E8B4BC]' : 'text-[#171717]/30'}`}>{step.label}</span>
                              {stepDate && <span className="text-[9px] text-[#171717]/60 font-mono bg-[#FAF9F7] px-1.5 py-0.5 rounded border border-[#E8B4BC]/10 mt-1 min-w-[60px] text-center">{stepDate}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Order Details */}
                    <div className="bg-[#FAF9F7] rounded-2xl p-5 border border-[#E8B4BC]/10 space-y-3 mb-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[#171717]/60">التاريخ</span>
                        <span className="font-bold text-[#171717]">{formatDate(order.created_at)}</span>
                      </div>
                      {order.order_type === 'store' && (order.city || order.district || order.street) && (
                        <div className="flex justify-between items-start text-sm">
                          <span className="text-[#171717]/60 flex items-center gap-1"><MapPin size={12}/> عنوان التوصيل</span>
                          <span className="font-bold text-[#171717] text-left">{[order.city, order.district, order.street].filter(Boolean).join(' - ')}</span>
                        </div>
                      )}
                      {order.order_type === 'store' && order.tracking_number && (
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-[#E8B4BC]/15">
                          <span className="text-[#171717]/60 flex items-center gap-1"><Truck size={12}/> رقم الشحن ({order.courier_name})</span>
                          <a href={order.courier_name?.toLowerCase().includes('aramex') ? `https://www.aramex.com/track/results?ShipmentNumber=${order.tracking_number}` : `https://smsa.com/en/track-shipment?track=${order.tracking_number}`} target="_blank" rel="noopener noreferrer" className="font-mono font-bold text-[#C6A56B] underline">
                            {order.tracking_number}
                          </a>
                        </div>
                      )}
                    </div>

                    {order.order_type === 'print' && (
                      <div className="bg-white rounded-2xl border border-[#E8B4BC]/20 p-5 mb-4 shadow-sm">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-[#FAF9F7] p-3 rounded-xl text-center border border-[#E8B4BC]/10">
                            <span className="text-[10px] block text-[#171717]/60 mb-1">صور 4x6</span>
                            <span className="font-black text-xl text-[#171717]">{order.photo_4x6_qty || 0}</span>
                          </div>
                          <div className="bg-[#FAF9F7] p-3 rounded-xl text-center border border-[#E8B4BC]/10">
                            <span className="text-[10px] block text-[#171717]/60 mb-1">صور A4</span>
                            <span className="font-black text-xl text-[#171717]">{order.a4_qty || 0}</span>
                          </div>
                        </div>
                        {order.album_qty > 0 && (
                          <div className="bg-[#C6A56B]/5 p-3 rounded-xl border border-[#C6A56B]/20 flex gap-2 text-center text-sm">
                            <div className="flex-1 border-l border-[#C6A56B]/10 pl-2">
                              <span className="block text-[10px] text-[#171717]/60 mb-1">الألبومات</span>
                              <span className="font-bold text-[#C6A56B] text-lg">{order.album_qty}</span>
                            </div>
                            <div className="flex-1">
                              <span className="block text-[10px] text-[#171717]/60 mb-1">السعر</span>
                              <span className="font-bold text-[#171717]">{order.album_price}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Store Order Items */}
                    {order.order_type === 'store' && order.store_order_items && order.store_order_items.length > 0 && (
                      <div className="bg-white rounded-2xl border border-[#E8B4BC]/20 p-5 mb-4 shadow-sm">
                        <h4 className="text-sm font-bold text-[#171717] mb-3 flex items-center gap-2">
                          <ShoppingBag size={16} className="text-[#C6A56B]" /> المنتجات المطلوبة
                        </h4>
                        <div className="space-y-3">
                          {order.store_order_items.map((item, idx) => {
                            const productInfo = Array.isArray(item.products) ? item.products[0] : item.products;
                            return (
                              <div key={idx} className="flex items-center gap-3 bg-[#FAF9F7] p-2.5 rounded-xl border border-[#E8B4BC]/10 hover:border-[#C6A56B]/30 transition-colors">
                                <div className="w-14 h-14 rounded-lg bg-white overflow-hidden shrink-0 border border-[#E8B4BC]/20 flex items-center justify-center p-1">
                                  {productInfo?.image
                                    ? <img src={productInfo.image} alt={productInfo?.name} className="w-full h-full object-cover rounded-md" />
                                    : <Package size={24} className="text-[#E8B4BC]/30" />
                                  }
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-bold text-[#171717] leading-tight">{productInfo?.name || 'منتج محذوف'}</p>
                                  <div className="flex justify-between items-center mt-2">
                                    <span className="text-xs text-[#171717]/60 bg-white px-2 py-0.5 rounded-md border border-[#E8B4BC]/10">الكمية: <span className="font-bold text-[#E8B4BC]">{item.quantity}</span></span>
                                    <span className="text-xs font-black text-[#171717]">{Number(item.price_at_time || 0).toFixed(2)} ر.س</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Financials */}
                    <div className="bg-white rounded-2xl border border-[#E8B4BC]/20 p-4">
                      <div className="space-y-3 mb-4">
                        {order.order_type === 'store' ? (
                          <>
                            <div className="flex justify-between items-center text-sm px-1"><span>المنتجات قبل الخصم</span><span className="font-bold">{Number(order.subtotal_amount ?? order.total_amount ?? 0).toFixed(2)}</span></div>
                            {Number(order.discount_amount || 0) > 0 && <div className="flex justify-between items-center text-sm text-emerald-600 px-2 bg-emerald-50 py-1.5 rounded-lg"><span>{order.coupon_code ? `كوبون ${order.coupon_code}` : 'خصم'}</span><span className="font-bold dir-ltr">-{Number(order.discount_amount).toFixed(2)}</span></div>}
                            <div className="flex justify-between items-center text-sm px-1"><span>المنتجات بعد الخصم</span><span className="font-bold">{Number(order.total_amount || 0).toFixed(2)}</span></div>
                            {Number(order.delivery_fee || 0) > 0 && <div className="flex justify-between items-center text-sm px-1"><span className="flex items-center gap-1"><MapPin size={12}/> توصيل</span><span className="font-bold">{Number(order.delivery_fee).toFixed(2)}</span></div>}
                            {Number(order.amount_paid || 0) > 0 && <div className="flex justify-between items-center text-sm text-emerald-600 px-2 bg-emerald-50 py-1.5 rounded-lg"><span>المدفوع نقداً</span><span className="font-bold dir-ltr">-{Number(order.amount_paid).toFixed(2)}</span></div>}
                            {Number(order.points_used_amount || 0) > 0 && <div className="flex justify-between items-center text-sm text-[#B97882] px-2 bg-[#E8B4BC]/10 py-1.5 rounded-lg"><span>مدفوع بالنقاط ({Number(order.reward_points_used || 0).toLocaleString()} نقطة)</span><span className="font-bold dir-ltr">-{Number(order.points_used_amount).toFixed(2)}</span></div>}
                            {Number(order.points_restored_amount || 0) > 0 && <div className="flex justify-between items-center text-sm text-emerald-600 px-2 bg-emerald-50 py-1.5 rounded-lg"><span>نقاط مستعادة ({Number(order.reward_points_restored || 0).toLocaleString()} نقطة)</span><span className="font-bold dir-ltr">+{Number(order.points_restored_amount).toFixed(2)}</span></div>}
                            {Number(order.reward_points_earned || 0) > 0 && <div className="flex justify-between items-center text-sm text-[#9E7D35] px-2 bg-[#C6A56B]/10 py-1.5 rounded-lg"><span>نقاط مكتسبة</span><span className="font-bold dir-ltr">+{Number(order.reward_points_earned).toLocaleString()} نقطة</span></div>}
                            {storeRefunded > 0 && <div className="flex justify-between items-center text-sm text-orange-600 px-2 bg-orange-50 py-1.5 rounded-lg"><span>المسترد</span><span className="font-bold dir-ltr">{storeRefunded.toFixed(2)}</span></div>}
                          </>
                        ) : (
                          <OrderFinancialBreakdown financials={printFinancials} variant="light" />
                        )}
                      </div>

                      {order.order_type === 'store' && (
                        <div className="flex justify-between items-center mb-5 px-1 border-t border-[#E8B4BC]/20 pt-4">
                          <span className="font-bold text-[#171717]">الإجمالي النهائي</span>
                          <span className="font-black text-xl text-[#171717]">{storeTotal.toFixed(2)} ر.س</span>
                        </div>
                      )}

                      {order.order_type === 'print' && orderPayments.length > 0 && (
                        <div className="mb-4 bg-[#FAF9F7] p-3 rounded-xl border border-[#E8B4BC]/10">
                          <p className="text-[10px] text-[#171717]/50 font-bold mb-2 flex justify-between items-center">
                            <span>سجل الدفعات</span><span className="text-[#E8B4BC] bg-[#E8B4BC]/10 px-2 py-1 rounded">المدفوع: {Number(order.deposit || 0).toFixed(2)}</span>
                          </p>
                          <div className="space-y-1">
                            {orderPayments.map((p) => (
                              <div key={p.id} className="flex justify-between items-center text-xs border-b border-white pb-1.5 pt-1.5">
                                <span className="flex items-center gap-1"><Calendar size={10} className="text-[#C6A56B]"/> {formatDate(p.payment_date)}</span>
                                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">+{Number(p.amount).toFixed(2)} ر.س</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className={`p-4 rounded-xl flex justify-between items-center ${remaining > 0 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-[#E8B4BC] text-white'}`}>
                        <span className="text-xs font-bold flex items-center gap-2"><Wallet size={16}/> {remaining > 0 ? 'المبلغ المتبقي' : 'حالة الدفع'}</span>
                        <span className="text-xl font-black">{remaining > 0 ? `${remaining.toFixed(2)} ر.س` : 'خالص ✅'}</span>
                      </div>
                      {order.order_type === 'store' && customerSession?.sessionToken && (
                        <RewardRedemptionForm
                          order={order}
                          rewards={customerStats?.rewards}
                          onApply={(points) => handleApplyRewardPoints(order, points)}
                          submitting={applyingPointsTo === order.id}
                        />
                      )}
                      {order.order_type === 'store' && !customerSession?.sessionToken && remaining > 0 && (
                        <Link to={`/store/orders/${order.id}`} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#C6A56B]/25 bg-[#C6A56B]/5 px-4 py-3 text-xs font-black text-[#9E7D35]">
                          <Wallet size={15} /> سجلي الدخول من طلباتي لاستخدام النقاط
                        </Link>
                      )}
                    </div>

                    {order.status === 'done' && order.order_type === 'print' && (
                      <div className="mt-4 p-4 bg-[#C6A56B]/10 text-[#C6A56B] text-center rounded-xl text-sm font-bold border border-[#C6A56B]/20 animate-pulse">
                        🎉 طلبك جاهز! تفضل بزيارتنا للاستلام.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Banners (Shown only when no orders and not loading) */}
        {!loading && ordersList.length === 0 && (
          <div className="mt-8 space-y-4 animate-in slide-in-from-bottom-4 duration-700">
            {/* Privacy Banner */}
            <div className="bg-white p-6 rounded-2xl border border-[#E8B4BC]/20 shadow-sm text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-pink-50 text-[#E8B4BC] mb-3">
                <ShieldCheck size={20} />
              </div>
              <h3 className="font-bold text-[#171717] mb-2 flex items-center justify-center gap-2">
                خصوصيتك في أيدٍ أمينة 🌸
              </h3>
              <p className="text-sm text-[#171717]/70 leading-relaxed mb-4">
                جميع طلباتكم تُعالج وتُطبع وتُغلف بأيدي <span className="font-bold text-[#E8B4BC]">كادر نسائي 100%</span> لضمان السرية التامة.
              </p>
              <Link to="/privacy" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C6A56B] bg-[#C6A56B]/10 px-4 py-2 rounded-lg hover:bg-[#C6A56B]/20 transition-colors">
                <FileText size={14} /> اقرأ سياسة الخصوصية
              </Link>
            </div>

            {/* Share Banner */}
            <div className="bg-gradient-to-br from-[#FAF9F7] to-white p-6 rounded-2xl border border-[#C6A56B]/20 shadow-sm text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-[#C6A56B]/10 rounded-full blur-xl"></div>
              <h3 className="font-bold text-[#C6A56B] mb-2 flex items-center justify-center gap-2">
                شارك الفن واكسب! 🎁
              </h3>
              <p className="text-sm text-[#171717]/70 leading-relaxed mb-4">
                عجبتك خدمتنا؟ شارك (لحظة فن) مع أصدقائك وعند طلبهم تستحق خصم خاص في <span className="font-bold text-[#E8B4BC]">محفظتك!</span>
              </p>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText('https://art-moment.com');
                  toast.success('تم نسخ الرابط! شاركه الآن 🤍');
                }}
                className="inline-flex items-center gap-2 text-sm font-bold text-[#C6A56B] bg-white border border-[#C6A56B]/30 px-6 py-2.5 rounded-xl hover:bg-[#C6A56B]/5 transition-colors shadow-sm"
              >
                <Copy size={16} /> انسخ رابط المتجر للمشاركة
              </button>
            </div>

            {/* Help Button */}
            <a href="https://wa.me/966560301744" target="_blank" rel="noreferrer" className="block w-full text-center py-4 rounded-2xl bg-white border border-[#E8B4BC]/20 text-[#171717] font-bold text-sm hover:bg-[#FAF9F7] transition-colors flex items-center justify-center gap-2 shadow-sm">
              <MessageCircle size={18} className="text-[#25D366]" /> هل تحتاج إلى مساعدة؟ تواصل معنا
            </a>
          </div>
        )}

      </div>
      
      <Link to="/admin/login" className="mt-auto pt-10 pb-4 text-[#171717]/20 text-xs hover:text-[#E8B4BC] transition-colors font-mono">
        Art Moment Admin
      </Link>
    </div>
  );
}
