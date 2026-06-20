// src/pages/TrackOrderPage.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, Package, Clock, CheckCircle, Truck,
  AlertCircle, Banknote, Wallet, FileText,
  MapPin, Calendar, UserCheck, Home,
  Image, BookOpen, Phone, ChevronDown, ChevronUp,
  Star, TrendingUp, Gift, History,
  ShieldCheck, MessageCircle, Copy, CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo-art-moment.svg';
import RiyalSign from '../components/RiyalSign';
import instagramIcon from '../assets/instagram icon.svg';
import snapchatIcon from '../assets/SnapChat icon.svg';
import tiktokIcon from '../assets/tiktok icon.svg';
import linktreeIcon from '../assets/linktree_icon.svg';
import whatsappIcon from '../assets/whatsapp icon.svg';
import telegramIcon from '../assets/telegram icon.svg';
import gmailIcon from '../assets/gmail icon.svg';

/* ─── مساعدات ─────────────────────────────────────── */
const normalizePhone = (raw) => {
  if (!raw) return '';
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('966')) d = d.slice(3);
  if (d.startsWith('0'))   d = d.slice(1);
  return d; // 9 أرقام
};

const allPhoneForms = (digits) => {
  const w = '0' + digits;
  return [w, digits, '966' + digits, '+966' + digits, '00966' + digits];
};

const formatDate = (s) =>
  s ? new Date(s).toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' }) : null;

const statusMap = {
  new:       { label: 'جديد',            color: 'bg-blue-100 text-blue-700 border-blue-200' },
  printing:  { label: 'قيد الطباعة',     color: 'bg-amber-100 text-amber-700 border-amber-200' },
  done:      { label: 'جاهز للاستلام',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  delivered: { label: 'تم التسليم',      color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const storeStatusMap = {
  pending_verification: { label: 'بانتظار التأكيد', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  confirmed:            { label: 'مؤكد',            color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  processing:           { label: 'قيد التجهيز',     color: 'bg-amber-100 text-amber-700 border-amber-200' },
  ready_for_delivery:   { label: 'جاهز للتسليم',   color: 'bg-teal-100 text-teal-700 border-teal-200' },
  shipped:              { label: 'تم الشحن',        color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  delivered:            { label: 'تم الاستلام',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled:            { label: 'ملغي',            color: 'bg-red-100 text-red-700 border-red-200' },
  returned:             { label: 'مرتجع',           color: 'bg-orange-100 text-orange-700 border-orange-200' },
};

const stepsDef = [
  { id: 1, key: 'new',       icon: Package,     label: 'جديد' },
  { id: 2, key: 'printing',  icon: Clock,       label: 'طباعة' },
  { id: 3, key: 'done',      icon: CheckCircle, label: 'جاهز' },
  { id: 4, key: 'delivered', icon: Truck,       label: 'تسليم' },
];

/* ─── جلب إحصاء العميل ──────────────────────────── */
async function fetchStats(digits) {
  const forms = allPhoneForms(digits);

  const { data: wallets } = await supabase
    .from('wallets').select('id, points_balance').in('phone', forms);

  const walletIds = (wallets || []).map(w => w.id);
  const points = (wallets || []).reduce((s, w) => s + Number(w.points_balance || 0), 0);

  let packages = 0;
  if (walletIds.length > 0) {
    const { data: tx } = await supabase
      .from('wallet_transactions').select('type, points, amount_value')
      .in('wallet_id', walletIds).in('type', ['package_charge', 'package_redeem']);
    (tx || []).forEach(t => {
      if (t.type === 'package_charge') packages += Number(t.points || 0);
      if (t.type === 'package_redeem') packages -= Number(t.amount_value || 0);
    });
    packages = Math.max(0, packages);
  }

  // الديون من الطلبات
  const { data: allOrders } = await supabase
    .from('orders').select('total_amount, deposit, wallet_used, phone');

  let debt = 0;
  (allOrders || []).forEach(o => {
    if (normalizePhone(o.phone) === digits) {
      const rem = Number(o.total_amount || 0) - Number(o.deposit || 0) - Number(o.wallet_used || 0);
      if (rem > 0.5) debt += rem;
    }
  });

  return { points, packages, debt, net: points - debt };
}

/* ═══════════════════════════════════════════════════ */
export default function TrackOrderPage() {
  const [mode, setMode]       = useState('order'); // 'order' | 'phone'
  const [input, setInput]     = useState('');
  const [pin, setPin]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // وضع رقم الطلب
  const [order, setOrder]         = useState(null);
  const [payments, setPayments]   = useState([]);
  const [stats, setStats]         = useState(null);

  // نسخ الرابط
  const [isCopied, setIsCopied] = useState(false);
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // وضع الجوال
  const [customerOrders, setCustomerOrders] = useState([]);
  const [customerStats,  setCustomerStats]  = useState(null);
  const [expandedId,     setExpandedId]     = useState(null);

  /* ── بحث بـ رقم الطلب ── */
  const searchByOrder = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true); setError(null); setOrder(null); setStats(null);
    try {
      const { data: o, error: oErr } = await supabase
        .from('orders').select('*').ilike('id', `${input.trim()}%`).limit(1).single();
      if (oErr) throw oErr;

      const { data: pmts } = await supabase
        .from('order_payments').select('*').eq('order_id', o.id)
        .order('payment_date', { ascending: true });

      setOrder(o);
      setPayments(pmts || []);
      if (o.phone) setStats(await fetchStats(normalizePhone(o.phone)));
    } catch {
      setError('لم يتم العثور على طلب بهذا الرقم، تأكد من الرقم وحاول مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  /* ── بحث بـ الجوال + كود الاشتراك ── */
  const searchByPhone = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const digits = normalizePhone(input.trim());
    if (!digits) { setError('رقم الجوال غير صحيح'); return; }
    if (!pin.trim() || pin.trim().length !== 4) { setError('رقم الاشتراك يجب أن يكون 4 أرقام'); return; }

    setLoading(true); setError(null); setCustomerOrders([]); setCustomerStats(null);
    try {
      // 1. تحقق من رقم الاشتراك أولاً
      const forms = allPhoneForms(digits);
      const { data: wallets } = await supabase
        .from('wallets')
        .select('subscription_code')
        .in('phone', forms)
        .not('subscription_code', 'is', null);

      const matched = (wallets || []).find(w => w.subscription_code === pin.trim());
      if (!matched) {
        setError('رقم الجوال أو رقم الاشتراك غير صحيح. تواصل معنا للحصول على رقم اشتراكك.');
        setLoading(false); return;
      }

      // 2. جلب الطلبات من الجدولين بعد التحقق
      const [printRes, storeRes] = await Promise.all([
        supabase.from('orders').select('*').in('phone', forms),
        supabase.from('store_orders').select('*').in('phone', forms),
      ]);

      const printOrders = (printRes.data || []).map(o => ({ ...o, order_type: 'print' }));
      const storeOrders = (storeRes.data || []).map(o => ({ ...o, order_type: 'store' }));
      const allOrders = [...printOrders, ...storeOrders].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      if (allOrders.length === 0) {
        setError('لا توجد طلبات مسجلة بهذا الرقم.');
        setLoading(false); return;
      }

      setCustomerOrders(allOrders);
      setCustomerStats(await fetchStats(digits));
    } catch {
      setError('حدث خطأ، يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = mode === 'order' ? searchByOrder : searchByPhone;

  /* ── مسح النتائج عند تبديل الوضع ── */
  const switchMode = (m) => {
    setMode(m); setInput(''); setPin(''); setError(null);
    setOrder(null); setStats(null);
    setCustomerOrders([]); setCustomerStats(null);
  };

  /* ── حساب المتبقي لطلب ── */
  const remaining = (o) => {
    if (o.order_type === 'store')
      return Number(o.total_amount || 0) - Number(o.amount_paid || 0);
    return Number(o.total_amount || 0) - Number(o.deposit || 0) - Number(o.wallet_used || 0);
  };

  const currentStep = order ? ({ new: 1, printing: 2, done: 3, delivered: 4 }[order.status] || 1) : 0;

  /* ═══ JSX ═════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#F8F5F2] flex flex-col relative font-sans text-[#4A4A4A]" dir="rtl">

      {/* خلفية ضبابية */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[30rem] h-[30rem] bg-[#D9A3AA]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-[#C5A059]/10 rounded-full blur-3xl"></div>
      </div>

      <Link to="/" className="absolute top-6 right-6 flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-[#D9A3AA]/20 shadow-sm text-[#4A4A4A] hover:text-[#D9A3AA] transition-colors font-bold text-sm z-10">
        <Home size={16} /> الرئيسية
      </Link>

      {/* ── محتوى الصفحة المركزي ── */}
      <div className="flex flex-col items-center w-full px-4 pt-10 pb-20 flex-1">

      {/* شعار + عنوان */}
      <div className="text-center mb-8 mt-8 relative z-10">
        <img src={logo} alt="Art Moment" className="w-20 h-20 mx-auto mb-4 object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300"/>
        <h1 className="text-3xl font-black text-[#4A4A4A] mb-1">
          {mode === 'order' ? 'تتبع طلبك' : 'سجل طلباتي'}
        </h1>
        <p className="text-[#4A4A4A]/50 text-sm">
          {mode === 'order' ? 'أدخل رقم الطلب لمعرفة الحالة والمبلغ المتبقي' : 'أدخل رقم جوالك لعرض جميع طلباتك'}
        </p>
      </div>

      <div className="w-full max-w-xl relative z-10">

        {/* تبويبات الوضع */}
        <div className="flex bg-white rounded-2xl border border-[#D9A3AA]/20 p-1 mb-6 shadow-sm gap-1">
          <button
            onClick={() => switchMode('order')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === 'order' ? 'bg-[#D9A3AA] text-white shadow-md' : 'text-[#4A4A4A]/60 hover:text-[#4A4A4A]'}`}
          >
            <Package size={16} /> رقم الطلب
          </button>
          <button
            onClick={() => switchMode('phone')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === 'phone' ? 'bg-gradient-to-r from-[#D9A3AA] to-[#C5A059] text-white shadow-md' : 'text-[#4A4A4A]/60 hover:text-[#4A4A4A]'}`}
          >
            <History size={16} /> سجل طلباتي
          </button>
        </div>

        {/* حقل البحث */}
        <form onSubmit={handleSubmit} className="space-y-3 mb-6">
          {/* حقل الجوال أو رقم الطلب */}
          <div className="relative">
            <input
              type={mode === 'phone' ? 'tel' : 'text'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === 'order' ? 'مثال: bf0177...' : '05xxxxxxxx — رقم الجوال'}
              className="w-full h-14 pl-14 pr-5 rounded-2xl border-2 border-[#D9A3AA]/20 bg-white shadow-sm focus:border-[#D9A3AA] focus:ring-4 focus:ring-[#D9A3AA]/10 outline-none text-lg text-center font-mono placeholder:font-sans transition-all"
              dir="ltr"
            />
            {mode !== 'phone' && (
              <button
                type="submit" disabled={loading}
                className="absolute left-2 top-2 bottom-2 aspect-square bg-[#D9A3AA] text-white rounded-xl flex items-center justify-center hover:bg-[#C5A059] transition-colors disabled:opacity-70 shadow-md"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Search size={22}/>}
              </button>
            )}
            {mode === 'phone' && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#D9A3AA]">
                <Phone size={20}/>
              </div>
            )}
          </div>

          {/* حقل رقم الاشتراك (وضع الجوال فقط) */}
          {mode === 'phone' && (
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="رقم الاشتراك (4 أرقام)"
                className="w-full h-14 pl-14 pr-5 rounded-2xl border-2 border-[#D9A3AA]/20 bg-white shadow-sm focus:border-[#D9A3AA] focus:ring-4 focus:ring-[#D9A3AA]/10 outline-none text-2xl text-center font-black tracking-[0.5em] placeholder:text-base placeholder:tracking-normal placeholder:font-sans transition-all"
                dir="ltr"
              />
              <button
                type="submit" disabled={loading}
                className="absolute left-2 top-2 bottom-2 aspect-square bg-gradient-to-br from-[#D9A3AA] to-[#C5A059] text-white rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-70 shadow-md"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Search size={22}/>}
              </button>
            </div>
          )}

          {/* تلميح */}
          {mode === 'phone' && (
            <p className="text-center text-[11px] text-[#4A4A4A]/40">
              رقم الاشتراك يُرسل لك من فريق لحظة فن
            </p>
          )}
        </form>

        {/* خطأ */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 mb-6 border border-red-100 animate-in slide-in-from-top-2">
            <AlertCircle size={20}/>
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        {/* ══════════════════════════════════════════
            وضع رقم الطلب — البطاقة التفصيلية
        ══════════════════════════════════════════ */}
        {mode === 'order' && order && (
          <div className="bg-white rounded-[2rem] border border-[#D9A3AA]/20 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* رأس الحالة */}
            {(() => {
              const cfg = {
                new:       { bg: 'from-slate-600 to-slate-700',   icon: '📋', text: 'جديد — قيد المراجعة',      sub: 'سيبدأ العمل على طلبك قريباً' },
                printing:  { bg: 'from-amber-500 to-amber-600',   icon: '🖨️', text: 'جاري الطباعة والتجهيز',   sub: 'طلبك في مرحلة الإنتاج الآن' },
                done:      { bg: 'from-[#D9A3AA] to-[#C5A059]',   icon: '🎉', text: 'جاهز للاستلام!',           sub: 'تفضل بزيارتنا في أقرب وقت' },
                delivered: { bg: 'from-emerald-500 to-emerald-600', icon: '✅', text: 'تم التسليم بنجاح',       sub: 'شكراً لثقتك في لحظة فن' },
              }[order.status] || { bg: 'from-slate-600 to-slate-700', icon: '📋', text: order.status, sub: '' };
              return (
                <div className={`bg-gradient-to-br ${cfg.bg} text-white px-6 py-7 text-center relative overflow-hidden`}>
                  <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full blur-2xl"></div>
                  <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-black/10 rounded-full blur-xl"></div>
                  <div className="relative z-10">
                    <div className="text-4xl mb-3 leading-none">{cfg.icon}</div>
                    <h2 className="text-xl font-black tracking-tight mb-1">{cfg.text}</h2>
                    <p className="text-white/70 text-xs font-medium">{cfg.sub}</p>
                  </div>
                </div>
              );
            })()}

            <div className="p-5">

              {/* بيانات أساسية */}
              <div className="flex items-center justify-between bg-[#F8F5F2] rounded-2xl px-5 py-4 mb-5 border border-[#D9A3AA]/10">
                <div>
                  <p className="text-[10px] text-[#4A4A4A]/50 font-bold uppercase tracking-wide mb-0.5">العميل</p>
                  <p className="font-black text-[#4A4A4A] text-base">{order.customer_name}</p>
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-[#4A4A4A]/50 font-bold uppercase tracking-wide mb-0.5">رقم الطلب</p>
                  <p className="font-mono font-black text-[#4A4A4A]/70 text-sm">#{order.id.slice(0, 8)}</p>
                </div>
              </div>

              {/* تايم لاين عمودي */}
              <div className="space-y-0 mb-5">
                {stepsDef.map((step, idx) => {
                  // الخطوة الأخيرة (تسليم) تُعدّ مكتملة عند الوصول إليها، لا عند تجاوزها
                  const isLastStep = step.id === stepsDef.length;
                  const done      = currentStep > step.id || (isLastStep && currentStep === step.id);
                  const active    = currentStep === step.id && !done;
                  const pending   = currentStep < step.id;
                  const isLast    = idx === stepsDef.length - 1;
                  const stepDate  = order[`date_${step.key}`];
                  const dateStr   = stepDate
                    ? new Date(stepDate).toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
                    : null;

                  return (
                    <div key={step.id} className="flex gap-4">
                      {/* خط + أيقونة */}
                      <div className="flex flex-col items-center">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
                          done   ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' :
                          active ? 'bg-white border-2 border-[#D9A3AA] text-[#D9A3AA] shadow-md shadow-[#D9A3AA]/20' :
                                   'bg-[#F8F5F2] text-[#4A4A4A]/25 border border-slate-200'
                        }`}>
                          {done
                            ? <CheckCircle size={20}/>
                            : <step.icon size={18}/>
                          }
                        </div>
                        {!isLast && (
                          <div className={`w-0.5 flex-1 my-1 min-h-[20px] rounded-full transition-colors duration-500 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`}/>
                        )}
                      </div>

                      {/* النص */}
                      <div className={`pb-5 flex-1 flex items-start justify-between ${isLast ? 'pb-1' : ''}`}>
                        <div>
                          <p className={`font-black text-sm leading-tight ${
                            done   ? 'text-emerald-600' :
                            active ? 'text-[#4A4A4A]' :
                                     'text-[#4A4A4A]/35'
                          }`}>{step.label}</p>
                          {active && !done && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#D9A3AA] bg-[#D9A3AA]/10 px-2 py-0.5 rounded-full mt-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#D9A3AA] animate-pulse inline-block"></span>
                              الحالة الحالية
                            </span>
                          )}
                        </div>
                        {dateStr ? (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-xl shrink-0 ${
                            done   ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            active ? 'bg-[#D9A3AA]/10 text-[#D9A3AA] border border-[#D9A3AA]/20' :
                                     'text-[#4A4A4A]/30'
                          }`}>{dateStr}</span>
                        ) : (
                          <span className="text-[10px] text-[#4A4A4A]/20 font-medium">لم يتم بعد</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {order.notes && (
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 mb-4">
                  <h3 className="text-xs font-bold text-amber-600 mb-2 flex items-center gap-1"><FileText size={13}/> ملاحظات</h3>
                  <p className="text-sm text-[#4A4A4A] leading-relaxed">{order.notes}</p>
                </div>
              )}

              {/* تفاصيل المنتجات */}
              <div className="bg-white rounded-2xl border border-[#D9A3AA]/20 p-5 mb-4 shadow-sm">
                <h3 className="text-xs font-bold text-[#4A4A4A] mb-4 flex items-center gap-2"><Image size={15} className="text-[#D9A3AA]"/> محتويات الطلب</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-[#F8F5F2] p-3 rounded-xl text-center border border-[#D9A3AA]/10">
                    <span className="text-[10px] block text-[#4A4A4A]/60 mb-1">صور 4×6</span>
                    <span className="font-black text-2xl text-[#4A4A4A]">{order.photo_4x6_qty || 0}</span>
                  </div>
                  <div className="bg-[#F8F5F2] p-3 rounded-xl text-center border border-[#D9A3AA]/10">
                    <span className="text-[10px] block text-[#4A4A4A]/60 mb-1">صور A4</span>
                    <span className="font-black text-2xl text-[#4A4A4A]">{order.a4_qty || 0}</span>
                  </div>
                </div>
                {order.album_qty > 0 && (
                  <div className="bg-[#C5A059]/5 p-3 rounded-xl border border-[#C5A059]/20 grid grid-cols-2 gap-2 text-center text-sm">
                    <div>
                      <span className="block text-[10px] text-[#4A4A4A]/60 mb-1 flex items-center justify-center gap-1"><BookOpen size={10}/> الألبومات</span>
                      <span className="font-bold text-[#C5A059] text-lg">{order.album_qty}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-[#4A4A4A]/60 mb-1">سعر الألبوم</span>
                      <span className="font-bold text-[#4A4A4A]">{order.album_price} <RiyalSign /></span>
                    </div>
                  </div>
                )}
              </div>

              {/* رصيد العميل */}
              {stats && (
                <div className="bg-[#F8F5F2] rounded-2xl p-4 border border-[#D9A3AA]/10 mb-4">
                  <h3 className="text-xs font-bold text-[#4A4A4A] mb-3 flex items-center gap-1"><UserCheck size={15} className="text-[#D9A3AA]"/> رصيدك الشخصي</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl p-3 border border-amber-200 text-center shadow-sm">
                      <span className="text-[10px] text-amber-600/70 block mb-1 font-bold">رصيد الباقات</span>
                      <span className="font-black text-amber-600 text-xl">{stats.packages.toFixed(0)}</span>
                      <span className="text-[10px] text-amber-500/60 block"><RiyalSign size="0.8em" /></span>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-violet-200 text-center shadow-sm">
                      <span className="text-[10px] text-violet-600/70 block mb-1 font-bold">رصيد النقاط</span>
                      <span className="font-black text-violet-600 text-xl">{stats.points.toFixed(0)}</span>
                      <span className="text-[10px] text-violet-500/60 block"><RiyalSign size="0.8em" /></span>
                    </div>
                  </div>
                </div>
              )}

              {/* الحسابات المالية */}
              <div className="bg-white rounded-2xl border border-[#D9A3AA]/20 p-5">
                <h3 className="text-xs font-bold text-[#4A4A4A]/60 mb-4 flex items-center gap-1"><Banknote size={14}/> الحسابات المالية</h3>
                <div className="space-y-3">
                  {Number(order.subtotal || 0) > 0 && (
                    <div className="flex justify-between text-sm px-1">
                      <span>قيمة المنتجات</span><span className="font-bold">{Number(order.subtotal).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(order.delivery_fee || 0) > 0 && (
                    <div className="flex justify-between text-sm px-1">
                      <span className="flex items-center gap-1"><MapPin size={11}/> رسوم التوصيل</span>
                      <span className="font-bold">{Number(order.delivery_fee).toFixed(2)}</span>
                    </div>
                  )}
                  {/* خصم الكوبون فقط (إن وجد) */}
                  {Number(order.manual_discount || 0) > 0.01 && (
                    <div className="flex justify-between text-sm text-red-500 px-2 bg-red-50 py-1.5 rounded-lg border border-red-100/50">
                      <span className="font-bold">خصم الكوبون</span>
                      <span className="font-bold">-{Number(order.manual_discount || 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-[#D9A3AA]/20 my-4"></div>
                <div className="flex justify-between items-center mb-4 px-1">
                  <span className="font-bold">الإجمالي</span>
                  <span className="font-black text-xl">{Number(order.total_amount || 0).toFixed(2)} <RiyalSign /></span>
                </div>

                {(payments.length > 0 || Number(order.wallet_used || 0) > 0.01) && (
                  <div className="mb-4 bg-[#F8F5F2] p-3 rounded-xl border border-[#D9A3AA]/10">
                    <p className="text-[10px] text-[#4A4A4A]/50 font-bold mb-2 flex justify-between">
                      <span>سجل الدفعات</span>
                      <span className="text-[#D9A3AA]">المدفوع: {(Number(order.deposit || 0) + Number(order.wallet_used || 0)).toFixed(2)} <RiyalSign /></span>
                    </p>
                    <div className="space-y-1.5">
                      {payments.map(p => (
                        <div key={p.id} className="flex justify-between text-xs border-b border-white last:border-0 pb-1.5 last:pb-0 pt-1 first:pt-0">
                          <span className="flex items-center gap-1"><Calendar size={10} className="text-[#C5A059]"/> {formatDate(p.payment_date)}</span>
                          <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">+{Number(p.amount).toFixed(2)} <RiyalSign /></span>
                        </div>
                      ))}
                      {Number(order.wallet_used || 0) > 0.01 && (
                        <div className="flex justify-between text-xs border-t border-white pt-1.5">
                          <span className="flex items-center gap-1 text-violet-600 font-bold">رصيد النقاط</span>
                          <span className="font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded">-{Number(order.wallet_used || 0).toFixed(2)} <RiyalSign /></span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className={`p-4 rounded-xl flex justify-between items-center ${remaining(order) > 0.5 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-[#D9A3AA] text-white shadow-lg shadow-[#D9A3AA]/30'}`}>
                  <span className="text-xs font-bold flex items-center gap-2"><Wallet size={15}/> {remaining(order) > 0.5 ? 'المبلغ المتبقي' : 'حالة الدفع'}</span>
                  <span className="text-xl font-black">{remaining(order) > 0.5 ? <>{remaining(order).toFixed(2)} <RiyalSign light={remaining(order) <= 0.5} /></> : 'خالص ✅'}</span>
                </div>
              </div>

              {order.status === 'done' && (
                <div className="mt-5 p-4 bg-[#C5A059]/10 text-[#C5A059] text-center rounded-xl text-sm font-bold border border-[#C5A059]/20 animate-pulse">
                  🎉 طلبك جاهز! تفضل بزيارتنا للاستلام.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            وضع الجوال — ملف العميل الكامل
        ══════════════════════════════════════════ */}
        {mode === 'phone' && customerOrders.length > 0 && customerStats && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* بطاقة الترحيب + الإحصاء */}
            <div className="bg-gradient-to-br from-[#4A4A4A] to-[#333] text-white rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#D9A3AA]/15 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#C5A059]/15 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#D9A3AA] to-[#C5A059] flex items-center justify-center text-white font-black text-2xl shadow-lg">
                    {customerOrders[0]?.customer_name?.charAt(0) || '؟'}
                  </div>
                  <div>
                    <p className="text-white/60 text-xs mb-0.5">مرحباً بك في</p>
                    <h2 className="text-xl font-black">{customerOrders[0]?.customer_name}</h2>
                    {customerOrders.length >= 3 && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-[#C5A059]/20 text-[#C5A059] px-2 py-0.5 rounded-full font-bold border border-[#C5A059]/30 mt-1">
                        <Star size={10} fill="currentColor"/> عميل مميز VIP
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/10 rounded-2xl p-3 text-center border border-white/10">
                    <span className="text-2xl font-black text-white">{customerOrders.length}</span>
                    <span className="block text-[10px] text-white/60 mt-1">طلب كلي</span>
                  </div>
                  <div className="bg-amber-500/20 rounded-2xl p-3 text-center border border-amber-400/20">
                    <span className="text-2xl font-black text-amber-300">{customerStats.packages.toFixed(0)}</span>
                    <span className="block text-[10px] text-amber-300/70 mt-1">رصيد باقات</span>
                  </div>
                  <div className="bg-violet-500/20 rounded-2xl p-3 text-center border border-violet-400/20">
                    <span className="text-2xl font-black text-violet-300">{customerStats.points.toFixed(0)}</span>
                    <span className="block text-[10px] text-violet-300/70 mt-1">نقاط</span>
                  </div>
                </div>

                {customerStats.debt > 0.5 && (
                  <div className="mt-3 bg-red-500/20 border border-red-400/20 rounded-2xl p-3 flex justify-between items-center">
                    <span className="text-xs font-bold text-red-300">مديونية متبقية</span>
                    <span className="font-black text-red-300">{customerStats.debt.toFixed(2)} <RiyalSign light /></span>
                  </div>
                )}
              </div>
            </div>

            {/* ملخص المشتريات */}
            <div className="bg-white rounded-2xl border border-[#D9A3AA]/20 shadow-sm p-5">
              <h3 className="text-xs font-bold text-[#4A4A4A]/50 mb-4 flex items-center gap-2 uppercase tracking-wide">
                <TrendingUp size={14} className="text-[#C5A059]"/> ملخص مشترياتك
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#F8F5F2] rounded-xl p-3 border border-[#D9A3AA]/10">
                  <span className="text-[10px] text-[#4A4A4A]/50 block mb-1">طلبات طباعة</span>
                  <span className="font-black text-xl text-[#D9A3AA]">
                    {customerOrders.filter(o => o.order_type === 'print').length}
                  </span>
                  <span className="text-[10px] text-[#4A4A4A]/40">طلب</span>
                </div>
                <div className="bg-[#F8F5F2] rounded-xl p-3 border border-[#D9A3AA]/10">
                  <span className="text-[10px] text-[#4A4A4A]/50 block mb-1">طلبات المتجر</span>
                  <span className="font-black text-xl text-[#4A4A4A]">
                    {customerOrders.filter(o => o.order_type === 'store').length}
                  </span>
                  <span className="text-[10px] text-[#4A4A4A]/40">طلب</span>
                </div>
                <div className="bg-[#F8F5F2] rounded-xl p-3 border border-[#D9A3AA]/10">
                  <span className="text-[10px] text-[#4A4A4A]/50 block mb-1">إجمالي الإنفاق</span>
                  <span className="font-black text-xl text-[#C5A059]">
                    {customerOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0).toFixed(0)}
                  </span>
                  <span className="text-[10px] text-[#4A4A4A]/40"><RiyalSign size="0.8em" /></span>
                </div>
              </div>
            </div>

            {/* قائمة الطلبات */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-[#4A4A4A] flex items-center gap-2">
                <Gift size={16} className="text-[#D9A3AA]"/> سجل طلباتك ({customerOrders.length})
              </h3>

              {customerOrders.map((o, idx) => {
                const rem = remaining(o);
                const st = o.order_type === 'store'
                  ? (storeStatusMap[o.status] || { label: o.status, color: 'bg-gray-100 text-gray-600 border-gray-200' })
                  : (statusMap[o.status] || statusMap.new);
                const isOpen = expandedId === o.id;
                const isLatest = idx === 0;
                const orderId = o.order_type === 'store' ? `#${o.id}` : `#${o.id.slice(0, 6)}`;

                return (
                  <div key={o.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isLatest ? 'border-[#D9A3AA]/40 ring-2 ring-[#D9A3AA]/10' : 'border-[#D9A3AA]/20'}`}>
                    {isLatest && (
                      <div className="bg-gradient-to-r from-[#D9A3AA]/10 to-[#C5A059]/5 px-4 py-1.5 border-b border-[#D9A3AA]/15">
                        <span className="text-[10px] font-black text-[#D9A3AA] uppercase tracking-wider">✦ أحدث طلب</span>
                      </div>
                    )}

                    {/* رأس الطلب (قابل للضغط) */}
                    <button
                      onClick={() => setExpandedId(isOpen ? null : o.id)}
                      className="w-full text-right p-4 flex items-start justify-between gap-3 hover:bg-[#F8F5F2]/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${st.color}`}>
                            {st.label}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${o.order_type === 'store' ? 'bg-[#C5A059]/10 text-[#C5A059]' : 'bg-[#D9A3AA]/10 text-[#D9A3AA]'}`}>
                            {o.order_type === 'store' ? 'متجر' : 'طباعة'}
                          </span>
                          <span className="text-[11px] text-[#4A4A4A]/40 font-mono">{orderId}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm flex-wrap">
                          <span className="flex items-center gap-1 text-[#4A4A4A]/50 text-xs">
                            <Calendar size={11}/> {formatDate(o.created_at)}
                          </span>
                          {o.order_type === 'print' && (o.photo_4x6_qty > 0 || o.a4_qty > 0) && (
                            <span className="text-[#4A4A4A]/40 text-xs">
                              {o.photo_4x6_qty > 0 && `${o.photo_4x6_qty} صورة 4×6`}
                              {o.photo_4x6_qty > 0 && o.a4_qty > 0 && ' · '}
                              {o.a4_qty > 0 && `${o.a4_qty} صورة A4`}
                            </span>
                          )}
                          {o.order_type === 'store' && o.city && (
                            <span className="text-[#4A4A4A]/40 text-xs flex items-center gap-1">
                              <MapPin size={10}/> {o.city}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-black text-[#4A4A4A]">{Number(o.total_amount || 0).toFixed(0)} <RiyalSign size="0.65em" /></span>
                        {rem > 0.5
                          ? <span className="text-[11px] text-red-500 font-bold">متبقي {rem.toFixed(0)} <RiyalSign /></span>
                          : <span className="text-[11px] text-emerald-500 font-bold">✓ مدفوع</span>
                        }
                        {isOpen ? <ChevronUp size={14} className="text-[#D9A3AA] mt-1"/> : <ChevronDown size={14} className="text-[#4A4A4A]/30 mt-1"/>}
                      </div>
                    </button>

                    {/* تفاصيل موسّعة */}
                    {isOpen && (
                      <div className="border-t border-[#D9A3AA]/10 p-4 space-y-3 bg-[#F8F5F2]/40 animate-in slide-in-from-top-2 fade-in duration-200">

                        {o.order_type === 'store' ? (
                          /* ── تفاصيل طلب المتجر ── */
                          <>
                            {/* شريط تقدم طلب المتجر */}
                            {(() => {
                              const storeSteps = [
                                { label: 'انتظار', keys: ['pending_verification'] },
                                { label: 'مؤكد',  keys: ['confirmed'] },
                                { label: 'تجهيز', keys: ['processing'] },
                                { label: 'شحن',   keys: ['ready_for_delivery', 'shipped', 'delivered'] },
                              ];
                              const storeOrder = ['pending_verification','confirmed','processing','ready_for_delivery','shipped','delivered'];
                              const curIdx = storeOrder.indexOf(o.status);
                              return (
                                <div className="flex items-center gap-1">
                                  {storeSteps.map((step, i) => {
                                    const stepMax = Math.max(...step.keys.map(k => storeOrder.indexOf(k)));
                                    const active = curIdx >= 0 && curIdx >= storeOrder.indexOf(step.keys[0]);
                                    return (
                                      <React.Fragment key={i}>
                                        <div className="flex flex-col items-center gap-0.5 flex-1">
                                          <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-[10px] font-bold ${active ? 'bg-[#50C878] border-[#50C878] text-white' : 'bg-white border-slate-200 text-[#4A4A4A]/30'}`}>
                                            {active ? <CheckCircle size={11}/> : <Package size={11}/>}
                                          </div>
                                          <span className={`text-[9px] font-bold ${active ? 'text-[#D9A3AA]' : 'text-[#4A4A4A]/25'}`}>{step.label}</span>
                                        </div>
                                        {i < storeSteps.length - 1 && (
                                          <div className={`flex-1 h-0.5 mb-4 rounded ${active && curIdx > storeOrder.indexOf(step.keys[0]) ? 'bg-[#50C878]' : 'bg-slate-200'}`}/>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            {/* عنوان التوصيل */}
                            {(o.city || o.district) && (
                              <div className="bg-white rounded-xl p-3 border border-[#D9A3AA]/15 text-xs">
                                <span className="text-[#4A4A4A]/50 font-bold flex items-center gap-1 mb-1">
                                  <MapPin size={10}/> عنوان التوصيل
                                </span>
                                <p className="font-bold text-[#4A4A4A]">{o.city}{o.district ? ` — حي ${o.district}` : ''}</p>
                                {o.street && <p className="text-[#4A4A4A]/60 mt-0.5">{o.street}</p>}
                              </div>
                            )}

                            {/* معلومات الشحن والتتبع */}
                            {o.tracking_number && (
                              <div className="bg-white rounded-xl p-3 border border-[#D9A3AA]/20 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-[#4A4A4A]/50 font-bold">شركة الشحن</span>
                                  <span className="font-bold">{o.courier_name}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-[#4A4A4A]/50 font-bold">رقم التتبع</span>
                                  <span className="font-mono font-bold text-[#D9A3AA]">{o.tracking_number}</span>
                                </div>
                                {o.courier_name === 'سمسا' && (
                                  <a
                                    href={`https://www.smsaexpress.com/sa/ar/trackingdetails?tracknumbers=${o.tracking_number}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="w-full flex items-center justify-center gap-2 bg-[#4A4A4A] text-white text-xs font-bold py-2 rounded-xl hover:bg-[#D9A3AA] transition-colors"
                                  >
                                    <Truck size={14}/> تتبع الشحنة (سمسا)
                                  </a>
                                )}
                                {o.courier_name === 'أرامكس' && (
                                  <a
                                    href={`https://www.aramex.com/sa/ar/track/results?mode=0&ShipmentNumber=${o.tracking_number}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="w-full flex items-center justify-center gap-2 bg-[#4A4A4A] text-white text-xs font-bold py-2 rounded-xl hover:bg-[#D9A3AA] transition-colors"
                                  >
                                    <Truck size={14}/> تتبع الشحنة (أرامكس)
                                  </a>
                                )}
                              </div>
                            )}

                            {o.notes && (
                              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 text-xs text-amber-800">
                                <span className="font-bold">📝 ملاحظات: </span>{o.notes}
                              </div>
                            )}

                            <div className={`p-3 rounded-xl flex justify-between items-center text-sm font-bold ${rem > 0.5 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                              <span>{rem > 0.5 ? '💳 المتبقي للسداد' : '✅ الطلب مدفوع بالكامل'}</span>
                              {rem > 0.5 && <span>{rem.toFixed(2)} <RiyalSign /></span>}
                            </div>
                          </>
                        ) : (
                          /* ── تفاصيل طلب الطباعة ── */
                          <>
                            {/* شريط التقدم مصغّر */}
                            <div className="flex items-center gap-1">
                              {stepsDef.map((step, i) => {
                                const active = ({ new: 1, printing: 2, done: 3, delivered: 4 }[o.status] || 1) >= step.id;
                                return (
                                  <React.Fragment key={step.id}>
                                    <div className={`flex flex-col items-center gap-0.5 flex-1`}>
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${active ? 'bg-[#50C878] border-[#50C878] text-white' : 'bg-white border-slate-200 text-[#4A4A4A]/30'}`}>
                                        <step.icon size={11}/>
                                      </div>
                                      <span className={`text-[9px] font-bold ${active ? 'text-[#D9A3AA]' : 'text-[#4A4A4A]/25'}`}>{step.label}</span>
                                    </div>
                                    {i < 3 && <div className={`flex-1 h-0.5 mb-4 rounded ${active && ({ new: 1, printing: 2, done: 3, delivered: 4 }[o.status] || 1) > step.id ? 'bg-[#50C878]' : 'bg-slate-200'}`}></div>}
                                  </React.Fragment>
                                );
                              })}
                            </div>

                            {/* تفاصيل المنتجات */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {o.photo_4x6_qty > 0 && (
                                <div className="bg-white rounded-xl p-2.5 border border-[#D9A3AA]/15 text-center">
                                  <span className="text-[#4A4A4A]/50 block">صور 4×6</span>
                                  <span className="font-black text-base text-[#4A4A4A]">{o.photo_4x6_qty}</span>
                                </div>
                              )}
                              {o.a4_qty > 0 && (
                                <div className="bg-white rounded-xl p-2.5 border border-[#D9A3AA]/15 text-center">
                                  <span className="text-[#4A4A4A]/50 block">صور A4</span>
                                  <span className="font-black text-base text-[#4A4A4A]">{o.a4_qty}</span>
                                </div>
                              )}
                              {o.album_qty > 0 && (
                                <div className="bg-white rounded-xl p-2.5 border border-[#C5A059]/20 text-center col-span-2">
                                  <span className="text-[#C5A059]/70 block">ألبوم × {o.album_qty}</span>
                                  <span className="font-black text-base text-[#C5A059]">{o.album_price} <RiyalSign /></span>
                                </div>
                              )}
                            </div>

                            {o.notes && (
                              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 text-xs text-amber-800">
                                <span className="font-bold">📝 ملاحظات: </span>{o.notes}
                              </div>
                            )}

                            {/* المبلغ المتبقي */}
                            <div className={`p-3 rounded-xl flex justify-between items-center text-sm font-bold ${rem > 0.5 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                              <span>{rem > 0.5 ? '💳 المتبقي للسداد' : '✅ الطلب مدفوع بالكامل'}</span>
                              {rem > 0.5 && <span>{rem.toFixed(2)} <RiyalSign /></span>}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* ── أقسام دائمة الظهور ── */}
        <div className="w-full max-w-xl mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">

          {/* 1. الخصوصية */}
          <div className="bg-white rounded-2xl p-5 border border-[#D9A3AA]/30 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#D9A3AA]/10 rounded-full blur-xl -mr-4 -mt-4"></div>
            <h3 className="text-sm font-black text-[#4A4A4A] mb-2 flex items-center gap-2">
              <ShieldCheck size={18} className="text-[#D9A3AA]" /> خصوصيتك في أيدٍ أمينة 🌸
            </h3>
            <p className="text-xs text-[#4A4A4A]/80 leading-relaxed mb-4">
              جميع طلباتكم تُعالج وتُطبع وتُغلف بأيدي <span className="font-bold text-[#D9A3AA]">كادر نسائي 100%</span> لضمان السرية التامة لصوركم وذكرياتكم.
            </p>
            <Link to="/privacy" className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C5A059] bg-[#C5A059]/10 px-3 py-1.5 rounded-lg hover:bg-[#C5A059]/20 transition-colors">
              <FileText size={12} /> اقرأ سياسة الخصوصية
            </Link>
          </div>

          {/* 2. برنامج الإحالة */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-200/50 shadow-sm">
            <h3 className="text-sm font-black text-amber-800 mb-2 flex items-center gap-2">
              <Gift size={18} className="text-amber-500" /> شارك الفن واكسب! 🎁
            </h3>
            <p className="text-xs text-amber-700/80 leading-relaxed mb-4">
              عجبتك خدمتنا؟ شارك (لحظة فن) مع أصدقائك وعائلتك، وعند طلبهم عن طريقك، تستحق خصم خاص في محفظتك!
            </p>
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 bg-white border border-amber-200 text-amber-700 text-xs font-bold py-2.5 rounded-xl hover:bg-amber-100 transition-colors shadow-sm"
            >
              {isCopied ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
              {isCopied ? 'تم نسخ الرابط بنجاح!' : 'انسخ رابط المتجر للمشاركة'}
            </button>
          </div>

          {/* 3. الدعم الفني */}
          <a
            href={`https://api.whatsapp.com/send?phone=966569663697&text=${encodeURIComponent(
              order ? `مرحباً لحظة فن، لدي استفسار بخصوص طلبي رقم #${order.id.slice(0, 8)}` : `مرحباً لحظة فن، لدي استفسار`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-[#F8F5F2] border border-[#D9A3AA]/20 text-[#4A4A4A] text-sm font-bold py-3.5 rounded-2xl hover:bg-[#D9A3AA]/10 hover:border-[#D9A3AA]/30 transition-all shadow-sm"
          >
            <MessageCircle size={18} className="text-emerald-500" /> هل تحتاج إلى مساعدة؟ تواصل معنا
          </a>

        </div>

      </div>

      </div>{/* end centering wrapper */}

      {/* ── فوتر كامل ── */}
      <footer className="w-full mt-auto bg-[#4A4A4A] text-white py-16 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute -top-1/2 -right-1/2 w-[100rem] h-[100rem] bg-[#D9A3AA] rounded-full blur-3xl"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 relative z-10">

          <div className="bg-white/80 backdrop-blur-sm w-fit mx-auto p-3 rounded-2xl mb-6 border border-white/20">
            <img src={logo} alt="Art Moment" className="h-16 w-auto object-contain" />
          </div>

          <p className="mb-8 max-w-md mx-auto text-white/60">
            خدمة طباعة منظمة من أول رسالة حتى الاستلام. هدفنا أن تكون تجربتك بسيطة وواضحة، ونجهز لك صورك بأفضل جودة.
          </p>

          <div className="flex justify-center gap-6 text-sm font-bold mb-8">
            <Link to="/track" className="hover:text-[#D9A3AA] transition-colors">تتبع الطلب</Link>
            <Link to="/privacy" className="hover:text-[#D9A3AA] transition-colors">الخصوصية والشروط</Link>
            <Link to="/admin/login" className="hover:text-[#D9A3AA] transition-colors">دخول الموظفين</Link>
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap mb-8">
            {[
              { id: 'whatsapp',  icon: whatsappIcon,  url: 'https://wa.me/966569663697',                alt: 'WhatsApp' },
              { id: 'telegram',  icon: telegramIcon,  url: 'https://t.me/+966569663697',                alt: 'Telegram' },
              { id: 'instagram', icon: instagramIcon, url: 'https://www.instagram.com/art.moment__/',   alt: 'Instagram' },
              { id: 'snapchat',  icon: snapchatIcon,  url: 'https://www.snapchat.com/add/omsayedkamal', alt: 'Snapchat' },
              { id: 'tiktok',    icon: tiktokIcon,    url: 'https://www.tiktok.com/@ayatalshaqaq',      alt: 'TikTok' },
              { id: 'linktree',  icon: linktreeIcon,  url: 'https://linktr.ee/Art_Moment',              alt: 'Linktree' },
              { id: 'gmail',     icon: gmailIcon,     url: 'mailto:art.moment26@gmail.com',             alt: 'Gmail' },
            ].map((social) => (
              <a
                key={social.id}
                href={social.url}
                target={social.url.startsWith('mailto') ? '_self' : '_blank'}
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/5 border border-[#D9A3AA]/20 flex items-center justify-center hover:bg-white/10 hover:-translate-y-1 hover:border-[#D9A3AA]/50 transition-all duration-300"
              >
                <img src={social.icon} alt={social.alt} className="w-5 h-5 object-contain" />
              </a>
            ))}
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-white/30">
            <p>© 2026 Art Moment. جميع الحقوق محفوظة.</p>
            <span className="hidden sm:inline text-white/15">·</span>
            <Link to="/privacy" className="hover:text-[#D9A3AA] transition-colors font-semibold">
              سياسة الخصوصية وشروط الاستخدام
            </Link>
          </div>
        </div>
      </footer>

      {/* زر واتساب العائم */}
      <a
        href="https://wa.me/966569663697"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 left-6 z-40 bg-[#25D366] hover:bg-[#128C7E] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center gap-2 group border-4 border-white"
      >
        <MessageCircle size={28} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap font-bold">تواصل معنا</span>
      </a>

    </div>
  );
}
