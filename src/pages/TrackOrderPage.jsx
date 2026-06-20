// src/pages/TrackOrderPage.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import {
  Search, Package, Clock, CheckCircle, Truck,
  Banknote, Wallet, FileText,
  MapPin, Calendar, UserCheck, Home,
  Image, BookOpen, History, Hash
} from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo-art-moment.svg';

export default function TrackOrderPage() {
  const [activeTab, setActiveTab] = useState('id');
  const [searchId, setSearchId] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [ordersList, setOrdersList] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [walletInfo, setWalletInfo] = useState(null);
  const [payments, setPayments] = useState({});

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

  const formatDate = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const getPrintStep = (status) => ({ new: 1, printing: 2, done: 3, delivered: 4 }[status] || 1);

  // ── تبويب 1: بحث بالرقم ──
  const handleIdSearch = async (e) => {
    e.preventDefault();
    const cleanId = searchId.replace('#', '').trim();
    if (!cleanId) { toast.error('يرجى إدخال رقم الطلب'); return; }

    setIsSearching(true);
    setOrdersList([]);
    setWalletInfo(null);

    try {
      const [printRes, storeRes] = await Promise.all([
        supabase.from('orders').select('*').ilike('id', `${cleanId}%`).maybeSingle(),
        supabase.from('store_orders').select('*').ilike('id', `${cleanId}%`).maybeSingle(),
      ]);

      let found = null;
      if (printRes.data) found = { ...printRes.data, order_type: 'print' };
      else if (storeRes.data) found = { ...storeRes.data, order_type: 'store' };

      if (!found) { toast.error('لم يتم العثور على طلب بهذا الرقم.'); return; }

      setOrdersList([found]);

      if (found.order_type === 'print') {
        const { data: pmts } = await supabase
          .from('order_payments').select('*')
          .eq('order_id', found.id).order('payment_date', { ascending: true });
        setPayments({ [found.id]: pmts || [] });
      }
    } catch { toast.error('حدث خطأ أثناء البحث'); }
    finally { setIsSearching(false); }
  };

  // ── تبويب 2: سجل الطلبات ──
  const handleHistorySearch = async (e) => {
    e.preventDefault();
    const formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone || !pin) { toast.error('يرجى إدخال الجوال ورمز الاشتراك'); return; }

    setIsSearching(true);
    setOrdersList([]);
    setWalletInfo(null);

    try {
      const { data: wallet } = await supabase
        .from('wallets').select('*')
        .eq('phone', formattedPhone)
        .eq('subscription_code', pin)
        .maybeSingle();

      if (!wallet) { toast.error('رقم الجوال أو رمز الاشتراك غير صحيح'); return; }
      setWalletInfo(wallet);

      const [printRes, storeRes] = await Promise.all([
        supabase.from('orders').select('*').eq('phone', formattedPhone),
        supabase.from('store_orders').select('*').eq('phone', formattedPhone),
      ]);

      const combined = [
        ...(printRes.data || []).map(o => ({ ...o, order_type: 'print' })),
        ...(storeRes.data || []).map(o => ({ ...o, order_type: 'store' })),
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      if (combined.length === 0) toast('لا توجد طلبات مسجلة لهذا الرقم.', { icon: '📭' });
      setOrdersList(combined);
    } catch { toast.error('حدث خطأ أثناء جلب السجل'); }
    finally { setIsSearching(false); }
  };

  const remaining = (o) =>
    o.order_type === 'store'
      ? Number(o.total_amount || 0) - Number(o.amount_paid || 0)
      : Number(o.total_amount || 0) - Number(o.deposit || 0) - Number(o.wallet_used || 0);

  // ── بطاقة طلب واحدة ──
  const OrderCard = ({ o }) => {
    const printStep = getPrintStep(o.status);
    const rem = remaining(o);
    const orderPayments = payments[o.id] || [];

    return (
      <div className="bg-white rounded-[2rem] border border-[#D9A3AA]/20 shadow-xl overflow-hidden mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* رأس البطاقة */}
        <div className="bg-[#4A4A4A] text-white p-5 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#C5A059]/20 rounded-full blur-2xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${o.order_type === 'store' ? 'bg-[#C5A059] text-white' : 'bg-[#D9A3AA] text-white'}`}>
                {o.order_type === 'store' ? 'متجر' : 'طباعة'}
              </span>
              <p className="text-[#C5A059] text-xs font-bold uppercase tracking-wider">حالة الطلب</p>
            </div>
            <h2 className="text-xl font-black">
              {o.order_type === 'store'
                ? (storeStatusMap[o.status]?.label || o.status)
                : (
                    o.status === 'new' ? 'جديد / قيد المراجعة' :
                    o.status === 'printing' ? 'جاري الطباعة والتجهيز' :
                    o.status === 'done' ? 'جاهز للاستلام' :
                    o.status === 'delivered' ? 'تم التسليم بنجاح' : o.status
                  )
              }
            </h2>
            <p className="text-white/40 text-xs mt-1 font-mono">#{o.id.slice(0, 6)}</p>
          </div>
        </div>

        <div className="p-5">

          {/* شريط التقدم */}
          {o.order_type === 'store' ? (
            <div className="relative flex justify-between mb-6 px-2">
              {(() => {
                const steps = ['confirmed','processing','shipped','delivered'];
                const idx = steps.indexOf(o.status);
                const active = idx === -1 ? 0 : idx + 1;
                const icons = [CheckCircle, Clock, Truck, Package];
                const labels = ['مؤكد','تجهيز','شحن','استلام'];
                return (
                  <>
                    <div className="absolute top-4 left-0 right-0 h-1 bg-[#F8F5F2] z-0"></div>
                    <div className="absolute top-4 right-0 h-1 bg-[#C5A059] z-0 transition-all duration-1000"
                      style={{ left: `${100 - (Math.max(active - 1, 0) / 3 * 100)}%` }}></div>
                    {steps.map((_, i) => {
                      const Icon = icons[i];
                      return (
                        <div key={i} className="relative z-10 flex flex-col items-center gap-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${active > i ? 'bg-[#C5A059] border-[#C5A059] text-white shadow-md scale-110' : 'bg-white border-[#F8F5F2] text-[#4A4A4A]/30'}`}>
                            <Icon size={14} />
                          </div>
                          <span className={`text-[10px] font-bold ${active > i ? 'text-[#C5A059]' : 'text-[#4A4A4A]/30'}`}>{labels[i]}</span>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="relative flex justify-between mb-6 px-2">
              <div className="absolute top-4 left-0 right-0 h-1 bg-[#F8F5F2] z-0"></div>
              <div className="absolute top-4 right-0 h-1 bg-[#50C878] z-0 transition-all duration-1000"
                style={{ left: `${100 - ((printStep - 1) / 3 * 100)}%` }}></div>
              {[
                { id: 1, key: 'new', icon: Package, label: 'جديد' },
                { id: 2, key: 'printing', icon: Clock, label: 'طباعة' },
                { id: 3, key: 'done', icon: CheckCircle, label: 'جاهز' },
                { id: 4, key: 'delivered', icon: Truck, label: 'تسليم' },
              ].map((step) => (
                <div key={step.id} className="relative z-10 flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${printStep >= step.id ? 'bg-[#50C878] border-[#50C878] text-white shadow-md scale-110' : 'bg-white border-[#F8F5F2] text-[#4A4A4A]/30'}`}>
                    <step.icon size={14} />
                  </div>
                  <span className={`text-[10px] font-bold ${printStep >= step.id ? 'text-[#D9A3AA]' : 'text-[#4A4A4A]/30'}`}>{step.label}</span>
                  {formatDate(o[`date_${step.key}`]) && (
                    <span className="text-[9px] text-[#4A4A4A]/60 font-mono bg-[#F8F5F2] px-1.5 py-0.5 rounded border border-[#D9A3AA]/10 mt-1 min-w-[60px] text-center">
                      {formatDate(o[`date_${step.key}`])}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* معلومات أساسية */}
          <div className="bg-[#F8F5F2] rounded-2xl p-4 border border-[#D9A3AA]/10 space-y-2.5 mb-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#4A4A4A]/60">العميل</span>
              <span className="font-bold">{o.customer_name}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#4A4A4A]/60">التاريخ</span>
              <span className="font-mono text-xs">{formatDate(o.created_at)}</span>
            </div>
            {o.order_type === 'store' && (o.city || o.district || o.street) && (
              <div className="flex justify-between items-start text-sm">
                <span className="text-[#4A4A4A]/60 flex items-center gap-1"><MapPin size={12}/> التوصيل</span>
                <span className="font-bold text-left">{[o.city, o.district, o.street].filter(Boolean).join(' - ')}</span>
              </div>
            )}
            {o.order_type === 'store' && o.tracking_number && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#4A4A4A]/60 flex items-center gap-1"><Truck size={12}/> رقم الشحن</span>
                <a href={o.courier_name?.toLowerCase().includes('aramex')
                    ? `https://www.aramex.com/track/results?ShipmentNumber=${o.tracking_number}`
                    : `https://smsa.com/en/track-shipment?track=${o.tracking_number}`}
                  target="_blank" rel="noopener noreferrer"
                  className="font-mono font-bold text-[#C5A059] underline text-xs">{o.tracking_number}</a>
              </div>
            )}
          </div>

          {/* ملاحظات */}
          {o.notes && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mb-4">
              <h3 className="text-xs font-bold text-amber-600 mb-1.5 flex items-center gap-1"><FileText size={13}/> ملاحظات</h3>
              <p className="text-sm text-[#4A4A4A] leading-relaxed">{o.notes}</p>
            </div>
          )}

          {/* تفاصيل الإنتاج — طباعة فقط */}
          {o.order_type === 'print' && (
            <div className="bg-white rounded-2xl border border-[#D9A3AA]/20 p-4 mb-4 shadow-sm">
              <h3 className="text-xs font-bold text-[#4A4A4A] mb-3 flex items-center gap-2">
                <Image size={15} className="text-[#D9A3AA]"/> محتويات الطلب
              </h3>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-[#F8F5F2] p-3 rounded-xl text-center border border-[#D9A3AA]/10">
                  <span className="text-[10px] block text-[#4A4A4A]/60 mb-1">صور 4x6</span>
                  <span className="font-black text-xl text-[#4A4A4A]">{o.photo_4x6_qty || 0}</span>
                </div>
                <div className="bg-[#F8F5F2] p-3 rounded-xl text-center border border-[#D9A3AA]/10">
                  <span className="text-[10px] block text-[#4A4A4A]/60 mb-1">صور A4</span>
                  <span className="font-black text-xl text-[#4A4A4A]">{o.a4_qty || 0}</span>
                </div>
              </div>
              {o.album_qty > 0 && (
                <div className="bg-[#C5A059]/5 p-3 rounded-xl border border-[#C5A059]/20 flex gap-2 text-center text-sm">
                  <div className="flex-1 border-l border-[#C5A059]/10 pl-2">
                    <span className="block text-[10px] text-[#4A4A4A]/60 mb-1 flex items-center justify-center gap-1"><BookOpen size={10}/> ألبومات</span>
                    <span className="font-bold text-[#C5A059] text-lg">{o.album_qty}</span>
                  </div>
                  <div className="flex-1">
                    <span className="block text-[10px] text-[#4A4A4A]/60 mb-1">سعر الألبوم</span>
                    <span className="font-bold text-[#4A4A4A]">{o.album_price}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* الحسابات المالية */}
          <div className="bg-white rounded-2xl border border-[#D9A3AA]/20 p-4 space-y-2.5">
            <h3 className="text-xs font-bold text-[#4A4A4A]/60 flex items-center gap-1 mb-3">
              <Banknote size={14}/> الحسابات المالية
            </h3>

            {o.order_type === 'store' ? (
              <>
                <div className="flex justify-between text-sm px-1">
                  <span>إجمالي المنتجات</span>
                  <span className="font-bold">{Number(o.total_amount || 0).toFixed(2)} ر.س</span>
                </div>
                {Number(o.delivery_fee || 0) > 0 && (
                  <div className="flex justify-between text-sm px-1">
                    <span className="flex items-center gap-1"><MapPin size={11}/> رسوم التوصيل</span>
                    <span className="font-bold">{Number(o.delivery_fee).toFixed(2)} ر.س</span>
                  </div>
                )}
                {Number(o.amount_paid || 0) > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 px-2 bg-emerald-50 py-1.5 rounded-lg border border-emerald-100/50">
                    <span className="font-bold">المبلغ المدفوع</span>
                    <span className="font-bold">-{Number(o.amount_paid).toFixed(2)} ر.س</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm px-1">
                  <span>قيمة المنتجات</span>
                  <span className="font-bold">{Number(o.subtotal || 0).toFixed(2)} ر.س</span>
                </div>
                {Number(o.delivery_fee || 0) > 0 && (
                  <div className="flex justify-between text-sm px-1">
                    <span className="flex items-center gap-1"><MapPin size={11}/> توصيل</span>
                    <span className="font-bold">{Number(o.delivery_fee).toFixed(2)} ر.س</span>
                  </div>
                )}
                {Number(o.discount || 0) > 0 && (
                  <div className="flex justify-between text-sm text-red-500 px-2 bg-red-50 py-1.5 rounded-lg border border-red-100/50">
                    <span className="font-bold">الخصم</span>
                    <span className="font-bold">-{Number(o.discount).toFixed(2)} ر.س</span>
                  </div>
                )}
                {Number(o.wallet_used || 0) > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 px-2 bg-emerald-50 py-1.5 rounded-lg border border-emerald-100/50">
                    <span className="font-bold">دفع من المحفظة</span>
                    <span className="font-bold">-{Number(o.wallet_used).toFixed(2)} ر.س</span>
                  </div>
                )}
                {orderPayments.length > 0 && (
                  <div className="bg-[#F8F5F2] p-3 rounded-xl border border-[#D9A3AA]/10">
                    <p className="text-[10px] text-[#4A4A4A]/50 font-bold mb-2 flex justify-between">
                      <span>سجل الدفعات</span>
                      <span className="text-[#D9A3AA]">مجموع: {Number(o.deposit || 0).toFixed(2)} ر.س</span>
                    </p>
                    <div className="space-y-1">
                      {orderPayments.map((p) => (
                        <div key={p.id} className="flex justify-between text-xs border-b border-white last:border-0 pb-1 pt-1">
                          <span className="flex items-center gap-1"><Calendar size={9} className="text-[#C5A059]"/> {formatDate(p.payment_date)}</span>
                          <span className="font-bold text-emerald-600">+{Number(p.amount).toFixed(2)} ر.س</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="border-t border-[#D9A3AA]/20 pt-3">
              <div className="flex justify-between items-center mb-3 px-1">
                <span className="font-bold text-sm">الإجمالي</span>
                <span className="font-black text-lg">{Number(o.total_amount || 0).toFixed(2)} ر.س</span>
              </div>
              <div className={`p-4 rounded-xl flex justify-between items-center ${rem > 0.5 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-[#D9A3AA] text-white shadow-lg shadow-[#D9A3AA]/30'}`}>
                <span className="text-xs font-bold flex items-center gap-2">
                  <Wallet size={15}/> {rem > 0.5 ? 'المبلغ المتبقي' : 'حالة الدفع'}
                </span>
                <span className="text-xl font-black">
                  {rem > 0.5 ? `${rem.toFixed(2)} ر.س` : 'خالص ✅'}
                </span>
              </div>
            </div>
          </div>

          {o.status === 'done' && o.order_type === 'print' && (
            <div className="mt-4 p-4 bg-[#C5A059]/10 text-[#C5A059] text-center rounded-xl text-sm font-bold border border-[#C5A059]/20 animate-pulse">
              🎉 طلبك جاهز! تفضل بزيارتنا للاستلام.
            </div>
          )}
        </div>
      </div>
    );
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

      <div className="text-center mb-8 mt-8 relative z-10">
        <img src={logo} alt="Art Moment" className="w-20 h-20 mx-auto mb-4 object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300" />
        <h1 className="text-3xl font-black text-[#4A4A4A] mb-1">تتبع طلبك</h1>
        <p className="text-[#4A4A4A]/60 text-sm">أدخل رقم الطلب لمعرفة الحالة والمبلغ المتبقي</p>
      </div>

      <div className="w-full max-w-md relative z-10">

        {/* التبويبات */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-[#D9A3AA]/10 mb-6">
          <button
            onClick={() => { setActiveTab('id'); setOrdersList([]); setWalletInfo(null); }}
            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'id' ? 'bg-[#D9A3AA]/40 text-[#4A4A4A]' : 'text-[#4A4A4A]/50 hover:bg-[#F8F5F2]'
            }`}
          >
            <Hash size={16} /> رقم الطلب
          </button>
          <button
            onClick={() => { setActiveTab('history'); setOrdersList([]); setWalletInfo(null); }}
            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'history' ? 'bg-[#C5A059]/40 text-[#4A4A4A]' : 'text-[#4A4A4A]/50 hover:bg-[#F8F5F2]'
            }`}
          >
            <History size={16} /> سجل طلباتي
          </button>
        </div>

        {/* فورم تبويب 1 — رقم الطلب */}
        {activeTab === 'id' && (
          <form onSubmit={handleIdSearch} className="relative mb-6">
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="مثال: acac69..."
              className="w-full h-14 pl-14 pr-6 rounded-2xl border-2 border-[#D9A3AA]/20 bg-white shadow-sm focus:border-[#D9A3AA] focus:ring-4 focus:ring-[#D9A3AA]/10 outline-none text-lg text-center font-mono placeholder:font-sans transition-all"
              dir="ltr"
            />
            <button type="submit" disabled={isSearching}
              className="absolute left-2 top-2 bottom-2 aspect-square bg-[#D9A3AA] text-white rounded-xl flex items-center justify-center hover:bg-[#C5A059] transition-colors disabled:opacity-70 shadow-md">
              {isSearching
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Search size={22} />}
            </button>
          </form>
        )}

        {/* فورم تبويب 2 — سجل الطلبات */}
        {activeTab === 'history' && (
          <form onSubmit={handleHistorySearch} className="space-y-3 mb-6">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="رقم الجوال (05XXXXXXXX)"
              className="w-full py-3.5 px-5 rounded-2xl border-2 border-[#D9A3AA]/20 bg-white shadow-sm focus:border-[#D9A3AA] focus:ring-4 focus:ring-[#D9A3AA]/10 outline-none text-base transition-all"
              dir="ltr"
            />
            <input
              type="text"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="رمز الاشتراك — 4 أرقام"
              className="w-full py-3.5 px-5 rounded-2xl border-2 border-[#C5A059]/20 bg-white shadow-sm focus:border-[#C5A059] focus:ring-4 focus:ring-[#C5A059]/10 outline-none text-base text-center font-mono tracking-widest transition-all"
              maxLength={4}
              dir="ltr"
            />
            <button type="submit" disabled={isSearching}
              className="w-full py-3.5 bg-[#C5A059] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A4A] transition-colors shadow-md disabled:opacity-70">
              {isSearching
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><History size={18} /> عرض سجل طلباتي</>}
            </button>
          </form>
        )}

        {/* معلومات المحفظة */}
        {walletInfo && (
          <div className="bg-white rounded-2xl border border-[#C5A059]/20 p-4 mb-6 shadow-sm">
            <h3 className="text-xs font-bold text-[#4A4A4A] mb-3 flex items-center gap-2">
              <UserCheck size={15} className="text-[#C5A059]"/> ملخص حسابك
            </h3>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-[#F8F5F2] rounded-xl p-3 border border-[#C5A059]/10">
                <span className="block text-[10px] text-[#4A4A4A]/60 mb-1">رصيد النقاط</span>
                <span className="font-black text-[#C5A059] text-lg">{Number(walletInfo.points_balance || 0).toFixed(2)}</span>
              </div>
              <div className="bg-[#F8F5F2] rounded-xl p-3 border border-[#C5A059]/10">
                <span className="block text-[10px] text-[#4A4A4A]/60 mb-1">إجمالي المشتريات</span>
                <span className="font-black text-[#4A4A4A] text-lg">{Number(walletInfo.total_spent || 0).toFixed(2)}</span>
              </div>
            </div>
            {ordersList.length > 0 && (
              <p className="text-center text-xs text-[#4A4A4A]/50 mt-3">{ordersList.length} طلب مسجل</p>
            )}
          </div>
        )}

        {/* قائمة البطاقات */}
        {ordersList.map((o) => <OrderCard key={o.id} o={o} />)}

      </div>

      <Link to="/admin/login" className="mt-auto pt-10 text-[#4A4A4A]/20 text-xs hover:text-[#D9A3AA] transition-colors font-mono">
        Art Moment Admin
      </Link>
    </div>
  );
}
