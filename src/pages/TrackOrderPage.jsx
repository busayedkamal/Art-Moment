// src/pages/TrackOrderPage.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Search, Package, Clock, CheckCircle, Truck, 
  AlertCircle, Banknote, Wallet, FileText, 
  MapPin, Calendar, UserCheck, Home, ArrowLeft,
  Image, BookOpen 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo-art-moment.svg';

export default function TrackOrderPage() {
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState(null);
  const [payments, setPayments] = useState([]); 
  const [customerStats, setCustomerStats] = useState({ points: 0, packages: 0, debt: 0, net: 0 });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const storeStatusMap = {
    pending_verification: { label: 'بانتظار التأكيد', color: 'bg-blue-100 text-blue-700' },
    confirmed:            { label: 'مؤكد',            color: 'bg-indigo-100 text-indigo-700' },
    processing:           { label: 'قيد التجهيز',     color: 'bg-amber-100 text-amber-700' },
    ready_for_delivery:   { label: 'جاهز للتسليم',   color: 'bg-teal-100 text-teal-700' },
    shipped:              { label: 'تم الشحن',        color: 'bg-cyan-100 text-cyan-700' },
    delivered:            { label: 'تم الاستلام',     color: 'bg-emerald-100 text-emerald-700' },
    cancelled:            { label: 'ملغي',            color: 'bg-red-100 text-red-700' },
    returned:             { label: 'مرتجع',           color: 'bg-orange-100 text-orange-700' },
  };

  // ✅ الإصلاح: دالة تضمن أن الرقم يبدأ بـ 05 ليطابق قاعدة البيانات
  const normalizePhone = (raw) => {
    if (!raw) return '';
    let digits = String(raw).replace(/\D/g, ''); // حذف أي رموز
    if (digits.startsWith('966')) digits = digits.slice(3); // حذف 966
    if (digits.startsWith('0')) digits = digits.slice(1); // حذف الصفر مؤقتاً لتوحيد المعالجة
    
    // إذا كان الرقم سعودي (9 خانات ويبدأ بـ 5)، نرجع له الصفر
    if (digits.length === 9 && digits.startsWith('5')) {
      return '0' + digits; 
    }
    return digits; // أرقام أخرى ترجع كما هي
  };

  // دالة جلب البيانات المالية
  const fetchCustomerStats = async (phone) => {
    if (!phone) return;

    // نبني كل الأشكال الممكنة للرقم
    let digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('966')) digits = digits.slice(3);
    if (digits.startsWith('0')) digits = digits.slice(1);
    // digits = 9 أرقام بدون صفر
    const withZero = digits.length === 9 ? '0' + digits : digits;
    const allFormats = [withZero, digits, '966' + digits, '+966' + digits,
      '+966' + withZero, '00966' + digits];

    try {
      // 1. جلب كل المحافظ المطابقة (قد تكون أكثر من واحدة بسبب فروق التنسيق)
      const { data: walletsFound } = await supabase
        .from('wallets')
        .select('id, points_balance')
        .in('phone', allFormats);

      const allWalletIds = (walletsFound || []).map(w => w.id);
      const pointsBalance = (walletsFound || [])
        .reduce((sum, w) => sum + Number(w.points_balance || 0), 0);

      // 2. حساب رصيد الباقات من wallet_transactions لكل المحافظ المطابقة
      let packageBalance = 0;
      if (allWalletIds.length > 0) {
        const { data: pkgTx } = await supabase
          .from('wallet_transactions')
          .select('type, points, amount_value')
          .in('wallet_id', allWalletIds)
          .in('type', ['package_charge', 'package_redeem']);

        (pkgTx || []).forEach(tx => {
          if (tx.type === 'package_charge') packageBalance += Number(tx.points || 0);
          if (tx.type === 'package_redeem') packageBalance -= Number(tx.amount_value || 0);
        });
        packageBalance = Math.max(0, packageBalance);
      }

      // 3. جلب الديون — نقارن الرقم المُنظَّف من الجانبين
      const { data: allOrders } = await supabase
        .from('orders')
        .select('total_amount, deposit, wallet_used, phone');

      let totalDebt = 0;
      if (allOrders) {
        allOrders.forEach(o => {
          // ننظّف رقم الطلب بنفس الطريقة
          let oDigits = String(o.phone || '').replace(/\D/g, '');
          if (oDigits.startsWith('966')) oDigits = oDigits.slice(3);
          if (oDigits.startsWith('0')) oDigits = oDigits.slice(1);
          if (oDigits === digits) {
            const walletUsed = Number(o.wallet_used || 0);
            const debt = Number(o.total_amount || 0) - Number(o.deposit || 0) - walletUsed;
            if (debt > 0.5) totalDebt += debt;
          }
        });
      }

      const netBalance = pointsBalance - totalDebt;

      setCustomerStats({
        points: pointsBalance,
        packages: packageBalance,
        debt: totalDebt,
        net: netBalance
      });

    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const cleanId = orderId.replace('#', '').trim();
    if (!cleanId) return;

    setLoading(true);
    setError(null);
    setOrder(null);
    setPayments([]);
    setCustomerStats({ points: 0, packages: 0, debt: 0, net: 0 });

    try {
      const [printRes, storeRes] = await Promise.all([
        supabase.from('orders').select('*').ilike('id', `${cleanId}%`).maybeSingle(),
        supabase.from('store_orders').select('*').ilike('id', `${cleanId}%`).maybeSingle(),
      ]);

      let foundOrder = null;
      if (printRes.data) {
        foundOrder = { ...printRes.data, order_type: 'print' };
      } else if (storeRes.data) {
        foundOrder = { ...storeRes.data, order_type: 'store' };
      }

      if (!foundOrder) {
        setError('لم يتم العثور على طلب بهذا الرقم، تأكد من الرقم وحاول مجدداً.');
        return;
      }

      setOrder(foundOrder);

      if (foundOrder.order_type === 'print') {
        const { data: paymentsData } = await supabase
          .from('order_payments')
          .select('*')
          .eq('order_id', foundOrder.id)
          .order('payment_date', { ascending: true });
        setPayments(paymentsData || []);
        if (foundOrder.phone) await fetchCustomerStats(foundOrder.phone);
      }

    } catch (err) {
      setError('لم يتم العثور على طلب بهذا الرقم، تأكد من الرقم وحاول مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  const getStepStatus = (status) => {
    const steps = { new: 1, printing: 2, done: 3, delivered: 4 };
    return steps[status] || 1;
  };

  const currentStep = order ? getStepStatus(order.status) : 0;
  const walletUsed = order ? Number(order.wallet_used || 0) : 0;
  const remaining = order
    ? order.order_type === 'store'
      ? Number(order.total_amount || 0) - Number(order.amount_paid || 0)
      : Number(order.total_amount || 0) - Number(order.deposit || 0) - walletUsed
    : 0;

  const formatDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-[#F8F5F2] flex flex-col items-center py-10 px-4 relative font-sans text-[#4A4A4A]" dir="rtl">
      
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
         <div className="absolute top-[-10%] right-[-5%] w-[30rem] h-[30rem] bg-[#D9A3AA]/10 rounded-full blur-3xl"></div>
         <div className="absolute bottom-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-[#C5A059]/10 rounded-full blur-3xl"></div>
      </div>

      <Link to="/" className="absolute top-6 right-6 flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-[#D9A3AA]/20 shadow-sm text-[#4A4A4A] hover:text-[#D9A3AA] transition-colors font-bold text-sm z-10">
        <Home size={16} /> الرئيسية
      </Link>

      <div className="text-center mb-10 mt-8 relative z-10">
        <img 
          src={logo} 
          alt="Art Moment" 
          className="w-24 h-24 mx-auto mb-4 object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300"
        />
        <h1 className="text-3xl font-black text-[#4A4A4A] mb-2">تتبع طلبك</h1>
        <p className="text-[#4A4A4A]/60">أدخل رقم الطلب لمعرفة الحالة والمبلغ المتبقي</p>
      </div>

      <div className="w-full max-w-md relative z-10">
        <form onSubmit={handleSearch} className="relative mb-8 group">
          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="مثال: bf0177..."
            className="w-full h-14 pl-14 pr-6 rounded-2xl border-2 border-[#D9A3AA]/20 bg-white shadow-sm focus:border-[#D9A3AA] focus:ring-4 focus:ring-[#D9A3AA]/10 outline-none text-lg text-center font-mono placeholder:font-sans transition-all"
            dir="ltr"
          />
          <button 
            type="submit"
            disabled={loading}
            className="absolute left-2 top-2 bottom-2 aspect-square bg-[#D9A3AA] text-white rounded-xl flex items-center justify-center hover:bg-[#C5A059] transition-colors disabled:opacity-70 shadow-md"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={24} />}
          </button>
        </form>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 mb-6 border border-red-100 animate-in slide-in-from-top-2">
            <AlertCircle size={20} />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        {order && (
          <div className="bg-white rounded-[2rem] border border-[#D9A3AA]/20 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* ── رأس البطاقة ── */}
            <div className="bg-[#4A4A4A] text-white p-6 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#C5A059]/20 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${order.order_type === 'store' ? 'bg-[#C5A059] text-white' : 'bg-[#D9A3AA] text-white'}`}>
                    {order.order_type === 'store' ? 'متجر' : 'طباعة'}
                  </span>
                  <p className="text-[#C5A059] text-xs font-bold uppercase tracking-wider">حالة الطلب</p>
                </div>
                <h2 className="text-2xl font-black">
                  {order.order_type === 'store'
                    ? (storeStatusMap[order.status]?.label || order.status)
                    : (
                        order.status === 'new' ? 'جديد / قيد المراجعة' :
                        order.status === 'printing' ? 'جاري الطباعة والتجهيز' :
                        order.status === 'done' ? 'جاهز للاستلام' :
                        order.status === 'delivered' ? 'تم التسليم بنجاح' : order.status
                      )
                  }
                </h2>
              </div>
            </div>

            <div className="p-6">

              {/* ── شريط التقدم ── */}
              {order.order_type === 'store' ? (
                <div className="relative flex justify-between mb-8 px-2">
                  {(() => {
                    const storeSteps = ['confirmed','processing','shipped','delivered'];
                    const idx = storeSteps.indexOf(order.status);
                    const activeStep = idx === -1 ? 0 : idx + 1;
                    const icons = [CheckCircle, Clock, Truck, Package];
                    const labels = ['مؤكد','تجهيز','شحن','استلام'];
                    return (
                      <>
                        <div className="absolute top-1/2 left-0 right-0 h-1 bg-[#F8F5F2] -translate-y-1/2 z-0"></div>
                        <div className="absolute top-1/2 right-0 h-1 bg-[#C5A059] -translate-y-1/2 z-0 transition-all duration-1000"
                          style={{ left: `${100 - ((Math.max(activeStep-1,0)) / 3 * 100)}%` }}></div>
                        {storeSteps.map((_, i) => {
                          const Icon = icons[i];
                          return (
                            <div key={i} className="relative z-10 flex flex-col items-center gap-1">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${activeStep > i ? 'bg-[#C5A059] border-[#C5A059] text-white shadow-md scale-110' : 'bg-white border-[#F8F5F2] text-[#4A4A4A]/30'}`}>
                                <Icon size={14} />
                              </div>
                              <span className={`text-[10px] font-bold ${activeStep > i ? 'text-[#C5A059]' : 'text-[#4A4A4A]/30'}`}>{labels[i]}</span>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="relative flex justify-between mb-8 px-2">
                  <div className="absolute top-1/2 left-0 right-0 h-1 bg-[#F8F5F2] -translate-y-1/2 z-0"></div>
                  <div className="absolute top-1/2 right-0 h-1 bg-[#50C878] -translate-y-1/2 z-0 transition-all duration-1000"
                    style={{ left: `${100 - ((currentStep - 1) / 3 * 100)}%` }}></div>
                  {[
                    { id: 1, key: 'new', icon: Package, label: 'جديد' },
                    { id: 2, key: 'printing', icon: Clock, label: 'طباعة' },
                    { id: 3, key: 'done', icon: CheckCircle, label: 'جاهز' },
                    { id: 4, key: 'delivered', icon: Truck, label: 'تسليم' },
                  ].map((step) => {
                    const stepDate = formatDate(order[`date_${step.key}`]);
                    return (
                      <div key={step.id} className="relative z-10 flex flex-col items-center gap-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${currentStep >= step.id ? 'bg-[#50C878] border-[#50C878] text-white shadow-md scale-110' : 'bg-white border-[#F8F5F2] text-[#4A4A4A]/30'}`}>
                          <step.icon size={14} />
                        </div>
                        <span className={`text-[10px] font-bold ${currentStep >= step.id ? 'text-[#D9A3AA]' : 'text-[#4A4A4A]/30'}`}>{step.label}</span>
                        {stepDate && (
                          <span className="text-[9px] text-[#4A4A4A]/60 font-mono bg-[#F8F5F2] px-1.5 py-0.5 rounded border border-[#D9A3AA]/10 mt-1 min-w-[60px] text-center">
                            {stepDate}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── معلومات أساسية ── */}
              <div className="bg-[#F8F5F2] rounded-2xl p-5 border border-[#D9A3AA]/10 space-y-3 mb-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#4A4A4A]/60">رقم الطلب</span>
                  <span className="font-mono font-bold text-[#4A4A4A]">#{order.id.slice(0, 6)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#4A4A4A]/60">العميل</span>
                  <span className="font-bold text-[#4A4A4A]">{order.customer_name}</span>
                </div>
                {order.order_type === 'store' && (order.city || order.district || order.street) && (
                  <div className="flex justify-between items-start text-sm">
                    <span className="text-[#4A4A4A]/60 flex items-center gap-1"><MapPin size={12}/> عنوان التوصيل</span>
                    <span className="font-bold text-[#4A4A4A] text-left">
                      {[order.city, order.district, order.street].filter(Boolean).join(' - ')}
                    </span>
                  </div>
                )}
                {order.order_type === 'store' && order.tracking_number && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#4A4A4A]/60 flex items-center gap-1"><Truck size={12}/> رقم الشحن</span>
                    <a
                      href={order.courier_name?.toLowerCase().includes('aramex')
                        ? `https://www.aramex.com/track/results?ShipmentNumber=${order.tracking_number}`
                        : `https://smsa.com/en/track-shipment?track=${order.tracking_number}`}
                      target="_blank" rel="noopener noreferrer"
                      className="font-mono font-bold text-[#C5A059] underline"
                    >
                      {order.tracking_number}
                    </a>
                  </div>
                )}
              </div>

              {order.notes && (
                <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 mb-4">
                  <h3 className="text-xs font-bold text-amber-600 mb-2 flex items-center gap-1">
                    <FileText size={14}/> ملاحظات
                  </h3>
                  <p className="text-sm text-[#4A4A4A] leading-relaxed">{order.notes}</p>
                </div>
              )}

              {/* ── تفاصيل الإنتاج (طباعة فقط) ── */}
              {order.order_type === 'print' && (
                <div className="bg-white rounded-2xl border border-[#D9A3AA]/20 p-5 mb-4 shadow-sm">
                  <h3 className="text-xs font-bold text-[#4A4A4A] mb-4 flex items-center gap-2">
                    <Image size={16} className="text-[#D9A3AA]"/> تفاصيل محتويات الطلب
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-[#F8F5F2] p-3 rounded-xl text-center border border-[#D9A3AA]/10">
                      <span className="text-[10px] block text-[#4A4A4A]/60 mb-1">صور 4x6</span>
                      <span className="font-black text-xl text-[#4A4A4A]">{order.photo_4x6_qty || 0}</span>
                    </div>
                    <div className="bg-[#F8F5F2] p-3 rounded-xl text-center border border-[#D9A3AA]/10">
                      <span className="text-[10px] block text-[#4A4A4A]/60 mb-1">صور A4</span>
                      <span className="font-black text-xl text-[#4A4A4A]">{order.a4_qty || 0}</span>
                    </div>
                  </div>
                  {order.album_qty > 0 && (
                    <div className="bg-[#C5A059]/5 p-3 rounded-xl border border-[#C5A059]/20 flex gap-2 text-center text-sm">
                      <div className="flex-1 border-l border-[#C5A059]/10 pl-2">
                        <span className="block text-[10px] text-[#4A4A4A]/60 mb-1 flex items-center justify-center gap-1"><BookOpen size={10}/> عدد الألبومات</span>
                        <span className="font-bold text-[#C5A059] text-lg">{order.album_qty}</span>
                      </div>
                      <div className="flex-1">
                        <span className="block text-[10px] text-[#4A4A4A]/60 mb-1">سعر الألبوم</span>
                        <span className="font-bold text-[#4A4A4A]">{order.album_price}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── الحسابات المالية ── */}
              <div className="bg-white rounded-2xl border border-[#D9A3AA]/20 p-1">

                {/* ملخص الحساب (طباعة فقط) */}
                {order.order_type === 'print' && (
                  <div className="mb-1 bg-[#F8F5F2] rounded-xl p-4">
                    <h3 className="text-xs font-bold text-[#4A4A4A] mb-3 flex items-center gap-1">
                      <UserCheck size={16} className="text-[#D9A3AA]"/> ملخص حسابك
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-center mb-1">
                      <div className="bg-white rounded-lg p-3 border border-violet-200 shadow-sm">
                        <span className="font-black text-violet-600/60 block mb-1 text-[10px]">رصيد الباقات المتاح</span>
                        <span className="font-black text-violet-600 dir-ltr text-xl">{customerStats.packages.toFixed(2)}</span>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-emerald-200 shadow-sm">
                        <span className="font-black text-emerald-600/60 block mb-1 text-[10px]">رصيد النقاط (كاش باك)</span>
                        <span className="font-black text-emerald-600 dir-ltr text-xl">{customerStats.points.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-4">
                  <h3 className="text-xs font-bold text-[#4A4A4A]/60 mb-4 flex items-center gap-1">
                    <Banknote size={14}/> الحسابات المالية للطلب
                  </h3>
                  <div className="space-y-3">
                    {order.order_type === 'store' ? (
                      <>
                        <div className="flex justify-between items-center text-sm text-[#4A4A4A] px-1">
                          <span>إجمالي المنتجات</span>
                          <span className="font-bold">{Number(order.total_amount || 0).toFixed(2)}</span>
                        </div>
                        {Number(order.delivery_fee || 0) > 0 && (
                          <div className="flex justify-between items-center text-sm text-[#4A4A4A] px-1">
                            <span className="flex items-center gap-1"><MapPin size={12}/> رسوم التوصيل</span>
                            <span className="font-bold">{Number(order.delivery_fee).toFixed(2)}</span>
                          </div>
                        )}
                        {Number(order.amount_paid || 0) > 0 && (
                          <div className="flex justify-between items-center text-sm text-emerald-600 px-2 bg-emerald-50 py-1.5 rounded-lg border border-emerald-100/50">
                            <span className="font-bold">المبلغ المدفوع</span>
                            <span className="font-bold dir-ltr">-{Number(order.amount_paid).toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-center text-sm text-[#4A4A4A] px-1">
                          <span>قيمة المنتجات</span>
                          <span className="font-bold">{Number(order.subtotal || 0).toFixed(2)}</span>
                        </div>
                        {Number(order.delivery_fee || 0) > 0 && (
                          <div className="flex justify-between items-center text-sm text-[#4A4A4A] px-1">
                            <span className="flex items-center gap-1"><MapPin size={12}/> رسوم التوصيل</span>
                            <span className="font-bold">{Number(order.delivery_fee).toFixed(2)}</span>
                          </div>
                        )}
                        {Number(order.discount || 0) > 0 && (
                          <div className="flex justify-between items-center text-sm text-red-500 px-2 bg-red-50 py-1.5 rounded-lg border border-red-100/50">
                            <span className="font-bold">الخصم</span>
                            <span className="font-bold dir-ltr">-{Number(order.discount).toFixed(2)}</span>
                          </div>
                        )}
                        {walletUsed > 0 && (
                          <div className="flex justify-between items-center text-sm text-emerald-600 px-2 bg-emerald-50 py-1.5 rounded-lg border border-emerald-100/50">
                            <span className="font-bold">تم الدفع من المحفظة</span>
                            <span className="font-bold dir-ltr">-{walletUsed.toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="border-t border-[#D9A3AA]/20 my-4"></div>

                  <div className="flex justify-between items-center mb-5 px-1">
                    <span className="font-bold text-[#4A4A4A]">الإجمالي النهائي</span>
                    <span className="font-black text-xl text-[#4A4A4A]">{Number(order.total_amount || 0).toFixed(2)} ر.س</span>
                  </div>

                  {/* سجل الدفعات (طباعة فقط) */}
                  {order.order_type === 'print' && payments.length > 0 && (
                    <div className="mb-4 bg-[#F8F5F2] p-3 rounded-xl border border-[#D9A3AA]/10">
                      <p className="text-[10px] text-[#4A4A4A]/50 font-bold mb-2 flex justify-between items-center">
                        <span>سجل الدفعات (المبالغ المستلمة)</span>
                        <span className="text-[#D9A3AA] bg-[#D9A3AA]/10 px-2 py-1 rounded">مجموع المدفوع: {Number(order.deposit || 0).toFixed(2)}</span>
                      </p>
                      <div className="space-y-1">
                        {payments.map((p) => (
                          <div key={p.id} className="flex justify-between items-center text-xs text-[#4A4A4A] border-b border-white last:border-0 pb-1.5 last:pb-0 pt-1.5 first:pt-0">
                            <span className="flex items-center gap-1"><Calendar size={10} className="text-[#C5A059]"/> {formatDate(p.payment_date)}</span>
                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">+{Number(p.amount).toFixed(2)} ر.س</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* المتبقي */}
                  <div className={`p-4 rounded-xl flex justify-between items-center ${remaining > 0 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-[#D9A3AA] text-white shadow-lg shadow-[#D9A3AA]/30'}`}>
                    <span className="text-xs font-bold flex items-center gap-2">
                      <Wallet size={16}/> {remaining > 0 ? 'المبلغ المتبقي' : 'حالة الدفع'}
                    </span>
                    <span className="text-xl font-black">
                      {remaining > 0 ? `${remaining.toFixed(2)} ر.س` : 'خالص ✅'}
                    </span>
                  </div>
                </div>
              </div>

              {order.status === 'done' && order.order_type === 'print' && (
                <div className="mt-6 p-4 bg-[#C5A059]/10 text-[#C5A059] text-center rounded-xl text-sm font-bold border border-[#C5A059]/20 animate-pulse">
                  🎉 طلبك جاهز! تفضل بزيارتنا للاستلام.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <Link to="/admin/login" className="mt-auto pt-10 text-[#4A4A4A]/20 text-xs hover:text-[#D9A3AA] transition-colors font-mono">
        Art Moment Admin
      </Link>
    </div>
  );
}