// src/pages/TrackOrderPage.jsx
import React, { useState } from 'react';
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

export default function TrackOrderPage() {
  const [activeTab, setActiveTab] = useState('id'); // 'id' or 'history'
  const [searchId, setSearchId] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  const [ordersList, setOrdersList] = useState([]);
  const [paymentsMap, setPaymentsMap] = useState({}); 
  const [customerStats, setCustomerStats] = useState({ points: 0, packages: 0, debt: 0, net: 0 });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const storeStatusMap = {
    pending_verification: { label: 'بانتظار التأكيد', color: 'bg-blue-100 text-blue-700' },
    confirmed:            { label: 'مؤكد',            color: 'bg-indigo-100 text-indigo-700' },
    processing:           { label: 'قيد التجهيز',     color: 'bg-amber-100 text-amber-700' },
    ready_for_delivery:   { label: 'جاهز للتسليم',    color: 'bg-teal-100 text-teal-700' },
    shipped:              { label: 'تم الشحن',        color: 'bg-cyan-100 text-cyan-700' },
    delivered:            { label: 'تم الاستلام',     color: 'bg-emerald-100 text-emerald-700' },
    cancelled:            { label: 'ملغي',            color: 'bg-red-100 text-red-700' },
    returned:             { label: 'مرتجع',           color: 'bg-orange-100 text-orange-700' },
  };

  const fetchCustomerStats = async (phoneStr) => {
    if (!phoneStr) return;
    let digits = String(phoneStr).replace(/\D/g, '');
    if (digits.startsWith('966')) digits = digits.slice(3);
    if (digits.startsWith('0')) digits = digits.slice(1);
    const withZero = digits.length === 9 ? '0' + digits : digits;
    const allFormats = [withZero, digits, '966' + digits, '+966' + digits, '+966' + withZero, '00966' + digits];

    try {
      const { data: walletsFound } = await supabase.from('wallets').select('id, points_balance').in('phone', allFormats);
      const allWalletIds = (walletsFound || []).map(w => w.id);
      const pointsBalance = (walletsFound || []).reduce((sum, w) => sum + Number(w.points_balance || 0), 0);

      let packageBalance = 0;
      if (allWalletIds.length > 0) {
        const { data: pkgTx } = await supabase.from('wallet_transactions').select('type, points, amount_value')
          .in('wallet_id', allWalletIds).in('type', ['package_charge', 'package_redeem']);
        (pkgTx || []).forEach(tx => {
          if (tx.type === 'package_charge') packageBalance += Number(tx.points || 0);
          if (tx.type === 'package_redeem') packageBalance -= Number(tx.amount_value || 0);
        });
        packageBalance = Math.max(0, packageBalance);
      }
      setCustomerStats({ points: pointsBalance, packages: packageBalance, debt: 0, net: pointsBalance });
    } catch (e) {
      console.error("Error fetching stats:", e);
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
      const [printRes, storeRes] = await Promise.all([
        supabase.from('orders').select('*').eq('short_id', shortCleanId).maybeSingle(),
        supabase.from('store_orders').select(`*, store_order_items(quantity, price_at_time, products(name, image))`).eq('short_id', shortCleanId).maybeSingle(),
      ]);

      let foundOrder = null;
      if (printRes.data) foundOrder = { ...printRes.data, order_type: 'print' };
      else if (storeRes.data) foundOrder = { ...storeRes.data, order_type: 'store' };

      if (!foundOrder) {
        setError('لم يتم العثور على طلب بهذا الرقم، تأكد من الرقم وحاول مجدداً.');
        return;
      }

      setOrdersList([foundOrder]);

      if (foundOrder.order_type === 'print') {
        const { data: payData } = await supabase.from('order_payments').select('*').eq('order_id', foundOrder.id).order('payment_date', { ascending: true });
        setPaymentsMap({ [foundOrder.id]: payData || [] });
        if (foundOrder.phone) await fetchCustomerStats(foundOrder.phone);
      }
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
      let shortPhone = cleanPhone;
      if (cleanPhone.startsWith('0')) shortPhone = cleanPhone.slice(1);
      if (cleanPhone.startsWith('966')) shortPhone = cleanPhone.slice(3);
      
      const phoneQuery = `phone.eq.${shortPhone},phone.eq.0${shortPhone},phone.eq.966${shortPhone},phone.eq.+966${shortPhone}`;

      const { data: wallet } = await supabase.from('wallets').select('*').eq('subscription_code', pin).or(phoneQuery).maybeSingle();

      if (!wallet) {
        setError('رقم الجوال أو رمز الاشتراك غير صحيح');
        setLoading(false); return;
      }

      await fetchCustomerStats(shortPhone);

      const [printRes, storeRes] = await Promise.all([
        supabase.from('orders').select('*').or(phoneQuery),
        supabase.from('store_orders').select(`*, store_order_items(quantity, price_at_time, products(name, image))`).or(phoneQuery)
      ]);

      const pOrders = (printRes.data || []).map(o => ({ ...o, order_type: 'print' }));
      const sOrders = (storeRes.data || []).map(o => ({ ...o, order_type: 'store' }));
      
      const combined = [...pOrders, ...sOrders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      let calcPayments = 0;
      let calcDebt = 0;
      pOrders.forEach(o => {
        const total = Number(o.total_amount || 0);
        const paid  = Number(o.deposit || 0) + Number(o.wallet_used || 0);
        calcPayments += paid;
        calcDebt     += Math.max(0, total - paid);
      });
      sOrders.forEach(o => {
        const total = Number(o.total_amount || 0);
        const paid  = Number(o.amount_paid || 0);
        calcPayments += paid;
        calcDebt     += Math.max(0, total - paid);
      });
      setCustomerStats(prev =>
        prev ? { ...prev, totalPayments: calcPayments, totalDebt: calcDebt }
             : { points: 0, packages: 0, totalPayments: calcPayments, totalDebt: calcDebt }
      );

      if (combined.length === 0) {
        toast.success('تم تسجيل الدخول بنجاح، ولكن لا توجد طلبات سابقة.');
      } else {
        const printIds = pOrders.map(o => o.id);
        if (printIds.length > 0) {
          const {data: payData} = await supabase.from('order_payments').select('*').in('order_id', printIds).order('payment_date', { ascending: true });
          const pMap = {};
          (payData || []).forEach(p => {
            if (!pMap[p.order_id]) pMap[p.order_id] = [];
            pMap[p.order_id].push(p);
          });
          setPaymentsMap(pMap);
        }
      }
      setOrdersList(combined);

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
    <div className="min-h-screen bg-[#F8F5F2] flex flex-col items-center py-10 px-4 relative font-sans text-[#4A4A4A]" dir="rtl">
      <Toaster position="top-center" />
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
         <div className="absolute top-[-10%] right-[-5%] w-[30rem] h-[30rem] bg-[#D9A3AA]/10 rounded-full blur-3xl"></div>
         <div className="absolute bottom-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-[#C5A059]/10 rounded-full blur-3xl"></div>
      </div>

      <Link to="/" className="absolute top-6 right-6 flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-[#D9A3AA]/20 shadow-sm text-[#4A4A4A] hover:text-[#D9A3AA] transition-colors font-bold text-sm z-10">
        <Home size={16} /> الرئيسية
      </Link>

      <div className="text-center mb-10 mt-8 relative z-10">
        <img src={logo} alt="Art Moment" className="w-24 h-24 mx-auto mb-4 object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300"/>
        <h1 className="text-3xl font-black text-[#4A4A4A] mb-2">تتبع طلبك</h1>
        <p className="text-[#4A4A4A]/60">أدخل البيانات لمعرفة حالة طلباتك والمبالغ المتبقية</p>
      </div>

      <div className="w-full max-w-xl mx-auto relative z-10">

        {/* Tabs */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-[#D9A3AA]/10 mb-6">
          <button
            onClick={() => { setActiveTab('id'); setOrdersList([]); setError(null); }}
            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'id' ? 'bg-[#D9A3AA]/40 text-[#4A4A4A]' : 'text-[#4A4A4A]/50 hover:bg-[#F8F5F2]'
            }`}
          >
            <Package size={18} /> رقم الطلب
          </button>
          <button
            onClick={() => { setActiveTab('history'); setOrdersList([]); setError(null); }}
            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'history' ? 'bg-[#C5A059]/40 text-[#4A4A4A]' : 'text-[#4A4A4A]/50 hover:bg-[#F8F5F2]'
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
              className="w-full h-14 pl-14 pr-6 rounded-2xl border-2 border-[#D9A3AA]/20 bg-white shadow-sm focus:border-[#D9A3AA] outline-none text-center font-mono transition-all" dir="ltr"
            />
            <button type="submit" disabled={loading} className="absolute left-2 top-2 bottom-2 aspect-square bg-[#D9A3AA] text-white rounded-xl flex items-center justify-center hover:bg-[#C5A059] transition-colors disabled:opacity-70 shadow-md">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={24} />}
            </button>
          </form>
        ) : (
          <form onSubmit={handleHistorySearch} className="space-y-4 mb-6">
            <div className="relative">
              <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D9A3AA]/50" size={20} />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم الجوال المسجل (مثال: 05...)" className="w-full h-14 pr-12 pl-4 rounded-2xl border-2 border-[#D9A3AA]/20 bg-white shadow-sm focus:border-[#D9A3AA] outline-none transition-all" />
            </div>
            <div className="relative">
              <ShieldCheck className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D9A3AA]/50" size={20} />
              <input type="text" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="رقم الاشتراك السري (4 أرقام)" className="w-full h-14 pr-12 pl-4 rounded-2xl border-2 border-[#D9A3AA]/20 bg-white shadow-sm focus:border-[#D9A3AA] outline-none transition-all font-mono tracking-widest text-center" dir="ltr" maxLength="4"/>
            </div>
            <button type="submit" disabled={loading} className="w-full h-14 bg-gradient-to-r from-[#D9A3AA] to-[#C5A059] text-white rounded-2xl font-black text-lg hover:shadow-lg transition-all flex items-center justify-center gap-2">
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
              <div className="bg-white p-5 rounded-[2rem] border border-[#D9A3AA]/20 shadow-sm">
                 <h3 className="text-sm font-bold text-[#4A4A4A] mb-4 flex items-center gap-2">
                   <UserCheck size={18} className="text-[#D9A3AA]"/> نظرة عامة على حسابك
                 </h3>
                 <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-[#F8F5F2] rounded-xl p-3 border border-[#D9A3AA]/10">
                       <span className="font-bold text-violet-600/60 block mb-1 text-[10px]">رصيد الباقات المتاح</span>
                       <span className="font-black text-violet-600 dir-ltr text-xl">{(customerStats.packages || 0).toFixed(2)}</span>
                    </div>
                    <div className="bg-[#F8F5F2] rounded-xl p-3 border border-[#D9A3AA]/10">
                       <span className="font-bold text-emerald-600/60 block mb-1 text-[10px]">رصيد النقاط (كاش باك)</span>
                       <span className="font-black text-emerald-600 dir-ltr text-xl">{(customerStats.points || 0).toFixed(2)}</span>
                    </div>
                    <div className="bg-[#F8F5F2] rounded-xl p-3 border border-[#D9A3AA]/10">
                       <span className="font-bold text-blue-600/60 block mb-1 text-[10px]">المدفوعات الكلية</span>
                       <span className="font-black text-blue-600 dir-ltr text-xl">{(customerStats.totalPayments || 0).toFixed(2)}</span>
                    </div>
                    <div className="bg-[#F8F5F2] rounded-xl p-3 border border-[#D9A3AA]/10">
                       <span className="font-bold text-red-600/60 block mb-1 text-[10px]">المديونية المتبقية</span>
                       <span className="font-black text-red-600 dir-ltr text-xl">{(customerStats.totalDebt || 0).toFixed(2)}</span>
                    </div>
                 </div>
              </div>
            )}

            {ordersList.map(order => {
              const currentStep = getStepStatus(order.status);
              const walletUsed = Number(order.wallet_used || 0);
              const remaining = order.order_type === 'store'
                ? Number(order.total_amount || 0) - Number(order.amount_paid || 0)
                : Number(order.total_amount || 0) - Number(order.deposit || 0) - walletUsed;
              const orderPayments = paymentsMap[order.id] || [];

              return (
                <div key={order.id} className="bg-white rounded-[2rem] border border-[#D9A3AA]/20 shadow-xl overflow-hidden">
                  <div className="bg-[#4A4A4A] text-white p-6 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#C5A059]/20 rounded-full blur-2xl"></div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${order.order_type === 'store' ? 'bg-[#C5A059] text-white' : 'bg-[#D9A3AA] text-white'}`}>
                          {order.order_type === 'store' ? 'متجر' : 'طباعة'}
                        </span>
                        <span className="font-mono text-xs opacity-70">#{order.id.slice(0, 6)}</span>
                      </div>
                      <h2 className="text-2xl font-black mt-2">
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
                    {/* Progress Bar */}
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
                              <div className="absolute top-1/2 right-0 h-1 bg-[#C5A059] -translate-y-1/2 z-0 transition-all duration-1000" style={{ left: `${100 - ((Math.max(activeStep-1,0)) / 3 * 100)}%` }}></div>
                              {storeSteps.map((_, i) => {
                                const Icon = icons[i];
                                return (
                                  <div key={i} className="relative z-10 flex flex-col items-center gap-1">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${activeStep > i ? 'bg-[#C5A059] border-[#C5A059] text-white shadow-md scale-110' : 'bg-white border-[#F8F5F2] text-[#4A4A4A]/30'}`}><Icon size={14} /></div>
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
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${currentStep >= step.id ? 'bg-[#50C878] border-[#50C878] text-white shadow-md scale-110' : 'bg-white border-[#F8F5F2] text-[#4A4A4A]/30'}`}><step.icon size={14} /></div>
                              <span className={`text-[10px] font-bold ${currentStep >= step.id ? 'text-[#D9A3AA]' : 'text-[#4A4A4A]/30'}`}>{step.label}</span>
                              {stepDate && <span className="text-[9px] text-[#4A4A4A]/60 font-mono bg-[#F8F5F2] px-1.5 py-0.5 rounded border border-[#D9A3AA]/10 mt-1 min-w-[60px] text-center">{stepDate}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Order Details */}
                    <div className="bg-[#F8F5F2] rounded-2xl p-5 border border-[#D9A3AA]/10 space-y-3 mb-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[#4A4A4A]/60">التاريخ</span>
                        <span className="font-bold text-[#4A4A4A]">{formatDate(order.created_at)}</span>
                      </div>
                      {order.order_type === 'store' && (order.city || order.district || order.street) && (
                        <div className="flex justify-between items-start text-sm">
                          <span className="text-[#4A4A4A]/60 flex items-center gap-1"><MapPin size={12}/> عنوان التوصيل</span>
                          <span className="font-bold text-[#4A4A4A] text-left">{[order.city, order.district, order.street].filter(Boolean).join(' - ')}</span>
                        </div>
                      )}
                      {order.order_type === 'store' && order.tracking_number && (
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-[#D9A3AA]/15">
                          <span className="text-[#4A4A4A]/60 flex items-center gap-1"><Truck size={12}/> رقم الشحن ({order.courier_name})</span>
                          <a href={order.courier_name?.toLowerCase().includes('aramex') ? `https://www.aramex.com/track/results?ShipmentNumber=${order.tracking_number}` : `https://smsa.com/en/track-shipment?track=${order.tracking_number}`} target="_blank" rel="noopener noreferrer" className="font-mono font-bold text-[#C5A059] underline">
                            {order.tracking_number}
                          </a>
                        </div>
                      )}
                    </div>

                    {order.order_type === 'print' && (
                      <div className="bg-white rounded-2xl border border-[#D9A3AA]/20 p-5 mb-4 shadow-sm">
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
                              <span className="block text-[10px] text-[#4A4A4A]/60 mb-1">الألبومات</span>
                              <span className="font-bold text-[#C5A059] text-lg">{order.album_qty}</span>
                            </div>
                            <div className="flex-1">
                              <span className="block text-[10px] text-[#4A4A4A]/60 mb-1">السعر</span>
                              <span className="font-bold text-[#4A4A4A]">{order.album_price}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Store Order Items */}
                    {order.order_type === 'store' && order.store_order_items && order.store_order_items.length > 0 && (
                      <div className="bg-white rounded-2xl border border-[#D9A3AA]/20 p-5 mb-4 shadow-sm">
                        <h4 className="text-sm font-bold text-[#4A4A4A] mb-3 flex items-center gap-2">
                          <ShoppingBag size={16} className="text-[#C5A059]" /> المنتجات المطلوبة
                        </h4>
                        <div className="space-y-3">
                          {order.store_order_items.map((item, idx) => {
                            const productInfo = Array.isArray(item.products) ? item.products[0] : item.products;
                            return (
                              <div key={idx} className="flex items-center gap-3 bg-[#F8F5F2] p-2.5 rounded-xl border border-[#D9A3AA]/10 hover:border-[#C5A059]/30 transition-colors">
                                <div className="w-14 h-14 rounded-lg bg-white overflow-hidden shrink-0 border border-[#D9A3AA]/20 flex items-center justify-center p-1">
                                  {productInfo?.image
                                    ? <img src={productInfo.image} alt={productInfo?.name} className="w-full h-full object-cover rounded-md" />
                                    : <Package size={24} className="text-[#D9A3AA]/30" />
                                  }
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-bold text-[#4A4A4A] leading-tight">{productInfo?.name || 'منتج محذوف'}</p>
                                  <div className="flex justify-between items-center mt-2">
                                    <span className="text-xs text-[#4A4A4A]/60 bg-white px-2 py-0.5 rounded-md border border-[#D9A3AA]/10">الكمية: <span className="font-bold text-[#D9A3AA]">{item.quantity}</span></span>
                                    <span className="text-xs font-black text-[#4A4A4A]">{Number(item.price_at_time || 0).toFixed(2)} ر.س</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Financials */}
                    <div className="bg-white rounded-2xl border border-[#D9A3AA]/20 p-4">
                      <div className="space-y-3 mb-4">
                        {order.order_type === 'store' ? (
                          <>
                            <div className="flex justify-between items-center text-sm px-1"><span>المنتجات</span><span className="font-bold">{Number(order.total_amount || 0).toFixed(2)}</span></div>
                            {Number(order.delivery_fee || 0) > 0 && <div className="flex justify-between items-center text-sm px-1"><span className="flex items-center gap-1"><MapPin size={12}/> توصيل</span><span className="font-bold">{Number(order.delivery_fee).toFixed(2)}</span></div>}
                            {Number(order.amount_paid || 0) > 0 && <div className="flex justify-between items-center text-sm text-emerald-600 px-2 bg-emerald-50 py-1.5 rounded-lg"><span>المدفوع</span><span className="font-bold dir-ltr">-{Number(order.amount_paid).toFixed(2)}</span></div>}
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between items-center text-sm px-1"><span>قيمة المنتجات</span><span className="font-bold">{Number(order.subtotal || 0).toFixed(2)}</span></div>
                            {Number(order.delivery_fee || 0) > 0 && <div className="flex justify-between items-center text-sm px-1"><span className="flex items-center gap-1"><MapPin size={12}/> توصيل</span><span className="font-bold">{Number(order.delivery_fee).toFixed(2)}</span></div>}
                            {Number(order.discount || 0) > 0 && <div className="flex justify-between items-center text-sm text-red-500 px-2 bg-red-50 py-1.5 rounded-lg"><span>خصم</span><span className="font-bold dir-ltr">-{Number(order.discount).toFixed(2)}</span></div>}
                            {walletUsed > 0 && <div className="flex justify-between items-center text-sm text-emerald-600 px-2 bg-emerald-50 py-1.5 rounded-lg"><span>دفع محفظة</span><span className="font-bold dir-ltr">-{walletUsed.toFixed(2)}</span></div>}
                          </>
                        )}
                      </div>

                      <div className="flex justify-between items-center mb-5 px-1 border-t border-[#D9A3AA]/20 pt-4">
                        <span className="font-bold text-[#4A4A4A]">الإجمالي النهائي</span>
                        <span className="font-black text-xl text-[#4A4A4A]">{Number(order.total_amount || 0).toFixed(2)} ر.س</span>
                      </div>

                      {order.order_type === 'print' && orderPayments.length > 0 && (
                        <div className="mb-4 bg-[#F8F5F2] p-3 rounded-xl border border-[#D9A3AA]/10">
                          <p className="text-[10px] text-[#4A4A4A]/50 font-bold mb-2 flex justify-between items-center">
                            <span>سجل الدفعات</span><span className="text-[#D9A3AA] bg-[#D9A3AA]/10 px-2 py-1 rounded">المدفوع: {Number(order.deposit || 0).toFixed(2)}</span>
                          </p>
                          <div className="space-y-1">
                            {orderPayments.map((p) => (
                              <div key={p.id} className="flex justify-between items-center text-xs border-b border-white pb-1.5 pt-1.5">
                                <span className="flex items-center gap-1"><Calendar size={10} className="text-[#C5A059]"/> {formatDate(p.payment_date)}</span>
                                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">+{Number(p.amount).toFixed(2)} ر.س</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className={`p-4 rounded-xl flex justify-between items-center ${remaining > 0 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-[#D9A3AA] text-white'}`}>
                        <span className="text-xs font-bold flex items-center gap-2"><Wallet size={16}/> {remaining > 0 ? 'المبلغ المتبقي' : 'حالة الدفع'}</span>
                        <span className="text-xl font-black">{remaining > 0 ? `${remaining.toFixed(2)} ر.س` : 'خالص ✅'}</span>
                      </div>
                    </div>

                    {order.status === 'done' && order.order_type === 'print' && (
                      <div className="mt-4 p-4 bg-[#C5A059]/10 text-[#C5A059] text-center rounded-xl text-sm font-bold border border-[#C5A059]/20 animate-pulse">
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
            <div className="bg-white p-6 rounded-2xl border border-[#D9A3AA]/20 shadow-sm text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-pink-50 text-[#D9A3AA] mb-3">
                <ShieldCheck size={20} />
              </div>
              <h3 className="font-bold text-[#4A4A4A] mb-2 flex items-center justify-center gap-2">
                خصوصيتك في أيدٍ أمينة 🌸
              </h3>
              <p className="text-sm text-[#4A4A4A]/70 leading-relaxed mb-4">
                جميع طلباتكم تُعالج وتُطبع وتُغلف بأيدي <span className="font-bold text-[#D9A3AA]">كادر نسائي 100%</span> لضمان السرية التامة.
              </p>
              <Link to="/privacy" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C5A059] bg-[#C5A059]/10 px-4 py-2 rounded-lg hover:bg-[#C5A059]/20 transition-colors">
                <FileText size={14} /> اقرأ سياسة الخصوصية
              </Link>
            </div>

            {/* Share Banner */}
            <div className="bg-gradient-to-br from-[#F8F5F2] to-white p-6 rounded-2xl border border-[#C5A059]/20 shadow-sm text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-[#C5A059]/10 rounded-full blur-xl"></div>
              <h3 className="font-bold text-[#C5A059] mb-2 flex items-center justify-center gap-2">
                شارك الفن واكسب! 🎁
              </h3>
              <p className="text-sm text-[#4A4A4A]/70 leading-relaxed mb-4">
                عجبتك خدمتنا؟ شارك (لحظة فن) مع أصدقائك وعند طلبهم تستحق خصم خاص في <span className="font-bold text-[#D9A3AA]">محفظتك!</span>
              </p>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText('https://art-moment.com');
                  toast.success('تم نسخ الرابط! شاركه الآن 🤍');
                }}
                className="inline-flex items-center gap-2 text-sm font-bold text-[#C5A059] bg-white border border-[#C5A059]/30 px-6 py-2.5 rounded-xl hover:bg-[#C5A059]/5 transition-colors shadow-sm"
              >
                <Copy size={16} /> انسخ رابط المتجر للمشاركة
              </button>
            </div>

            {/* Help Button */}
            <a href="https://wa.me/966569663697" target="_blank" rel="noreferrer" className="block w-full text-center py-4 rounded-2xl bg-white border border-[#D9A3AA]/20 text-[#4A4A4A] font-bold text-sm hover:bg-[#F8F5F2] transition-colors flex items-center justify-center gap-2 shadow-sm">
              <MessageCircle size={18} className="text-[#25D366]" /> هل تحتاج إلى مساعدة؟ تواصل معنا
            </a>
          </div>
        )}

      </div>
      
      <Link to="/admin/login" className="mt-auto pt-10 pb-4 text-[#4A4A4A]/20 text-xs hover:text-[#D9A3AA] transition-colors font-mono">
        Art Moment Admin
      </Link>
    </div>
  );
}