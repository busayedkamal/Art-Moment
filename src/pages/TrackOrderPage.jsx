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
  const [customerStats, setCustomerStats] = useState({ wallet: 0, debt: 0, net: 0 });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
    const cleanPhone = normalizePhone(phone); // سيصبح الآن 05xxxxxxxx

    try {
      // 1. جلب المحفظة (بحث مباشر بالرقم الصحيح)
      const { data: walletData } = await supabase
        .from('wallets')
        .select('points_balance')
        .eq('phone', cleanPhone)
        .maybeSingle();

      const walletBalance = Number(walletData?.points_balance || 0);

      // 2. جلب الديون (نجلب كل الطلبات ونفلترها للتأكد)
      const { data: allOrders } = await supabase
        .from('orders')
        .select('total_amount, deposit, phone');

      let totalDebt = 0;
      if (allOrders) {
        allOrders.forEach(o => {
          // نقارن الأرقام بعد التوحيد
          if (normalizePhone(o.phone) === cleanPhone) {
            const debt = Number(o.total_amount || 0) - Number(o.deposit || 0);
            if (debt > 0.5) totalDebt += debt; 
          }
        });
      }

      const netBalance = walletBalance - totalDebt;

      setCustomerStats({
        wallet: walletBalance,
        debt: totalDebt,
        net: netBalance
      });

    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!orderId.trim()) return;

    setLoading(true);
    setError(null);
    setOrder(null);
    setCustomerStats({ wallet: 0, debt: 0, net: 0 });

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .ilike('id', `${orderId}%`)
        .limit(1)
        .single();

      if (orderError) throw orderError;

      const { data: paymentsData } = await supabase
        .from('order_payments')
        .select('*')
        .eq('order_id', orderData.id)
        .order('payment_date', { ascending: true });

      setOrder(orderData);
      setPayments(paymentsData || []);

      if (orderData.phone) {
        await fetchCustomerStats(orderData.phone);
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
  const remaining = order ? (Number(order.total_amount || 0) - Number(order.deposit || 0)) : 0;

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
            
            <div className="bg-[#4A4A4A] text-white p-6 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#C5A059]/20 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <p className="text-[#C5A059] text-xs mb-1 font-bold uppercase tracking-wider">حالة الطلب</p>
                <h2 className="text-2xl font-black">
                  {order.status === 'new' && 'جديد / قيد المراجعة'}
                  {order.status === 'printing' && 'جاري الطباعة والتجهيز'}
                  {order.status === 'done' && 'جاهز للاستلام'}
                  {order.status === 'delivered' && 'تم التسليم بنجاح'}
                </h2>
              </div>
            </div>

            <div className="p-6">
              
              <div className="relative flex justify-between mb-8 px-2">
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-[#F8F5F2] -translate-y-1/2 z-0"></div>
                <div 
                  className="absolute top-1/2 right-0 h-1 bg-[#50C878] -translate-y-1/2 z-0 transition-all duration-1000"
                  style={{ left: `${100 - ((currentStep - 1) / 3 * 100)}%` }}
                ></div>

                {[
                  { id: 1, key: 'new', icon: Package, label: 'جديد' },
                  { id: 2, key: 'printing', icon: Clock, label: 'طباعة' },
                  { id: 3, key: 'done', icon: CheckCircle, label: 'جاهز' },
                  { id: 4, key: 'delivered', icon: Truck, label: 'تسليم' },
                ].map((step) => {
                  const stepDate = formatDate(order[`date_${step.key}`]);
                  return (
                    <div key={step.id} className="relative z-10 flex flex-col items-center gap-1">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500
                        ${currentStep >= step.id 
                          ? 'bg-[#50C878] border-[#50C878] text-white shadow-md scale-110' 
                          : 'bg-white border-[#F8F5F2] text-[#4A4A4A]/30'}
                      `}>
                        <step.icon size={14} />
                      </div>
                      <span className={`text-[10px] font-bold ${currentStep >= step.id ? 'text-[#D9A3AA]' : 'text-[#4A4A4A]/30'}`}>
                        {step.label}
                      </span>
                      {stepDate && (
                        <span className="text-[9px] text-[#4A4A4A]/60 font-mono bg-[#F8F5F2] px-1.5 py-0.5 rounded border border-[#D9A3AA]/10 mt-1 min-w-[60px] text-center">
                          {stepDate}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="bg-[#F8F5F2] rounded-2xl p-5 border border-[#D9A3AA]/10 space-y-3 mb-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#4A4A4A]/60">رقم الطلب</span>
                  <span className="font-mono font-bold text-[#4A4A4A]">#{order.id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#4A4A4A]/60">العميل</span>
                  <span className="font-bold text-[#4A4A4A]">{order.customer_name}</span>
                </div>
              </div>

              {order.notes && (
                <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 mb-4">
                  <h3 className="text-xs font-bold text-amber-600 mb-2 flex items-center gap-1">
                    <FileText size={14}/> ملاحظات
                  </h3>
                  <p className="text-sm text-[#4A4A4A] leading-relaxed">
                    {order.notes}
                  </p>
                </div>
              )}

              {/* بطاقة تفاصيل الإنتاج */}
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

                {(order.album_qty > 0) && (
                  <div className="bg-[#C5A059]/5 p-3 rounded-xl border border-[#C5A059]/20 flex gap-2 text-center text-sm">
                    <div className="flex-1 border-l border-[#C5A059]/10 pl-2">
                      <span className="block text-[10px] text-[#4A4A4A]/60 mb-1 flex items-center justify-center gap-1">
                         <BookOpen size={10}/> عدد الألبومات
                      </span>
                      <span className="font-bold text-[#C5A059] text-lg">{order.album_qty}</span>
                    </div>
                    <div className="flex-1">
                      <span className="block text-[10px] text-[#4A4A4A]/60 mb-1">سعر الألبوم</span>
                      <span className="font-bold text-[#4A4A4A]">{order.album_price}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-[#D9A3AA]/20 p-1">
                
                {/* ✅ ملخص الحساب (تم إرجاعه للتصميم المفصل: رصيد + ديون + صافي) */}
                <div className="mb-1 bg-[#F8F5F2] rounded-xl p-4">
                  <h3 className="text-xs font-bold text-[#4A4A4A] mb-3 flex items-center gap-2">
                    <UserCheck size={16} className="text-[#D9A3AA]"/> ملخص حسابك
                  </h3>
                  
                  {/* صف الرصيد والديون */}
                  <div className="grid grid-cols-2 gap-3 text-center mb-3">
                    <div className="bg-white rounded-lg p-2 border border-[#D9A3AA]/10">
                      <span className="font-black text-emerald-600/50 block mb-1">رصيد المحفظة</span>
                      <span className="font-black text-emerald-600 dir-ltr text-lg">{customerStats.wallet.toFixed(2)}</span>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-[#D9A3AA]/10">
                      <span className="font-black text-red-600/50 block mb-1">إجمالي الديون</span>
                      <span className={`font-black dir-ltr text-lg ${customerStats.debt > 0 ? 'text-red-600' : 'text-red-600'}`}>{customerStats.debt.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* صف الصافي */}
                  <div className={`pt-3 border-t border-[#D9A3AA]/10 flex justify-between items-center text-sm font-bold ${customerStats.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    <span>الصافي (لك/عليك):</span>
                    <span className="dir-ltr">{customerStats.net.toFixed(2)} ر.س</span>
                  </div>
                </div>
                {/* ---------------------------------------------------------------- */}

                <div className="p-4">
                    <h3 className="text-xs font-bold text-[#4A4A4A]/60 mb-4 flex items-center gap-1">
                    <Banknote size={14}/> الحسابات المالية للطلب
                    </h3>

                    <div className="flex justify-between items-center text-sm text-[#4A4A4A] mb-2 px-1">
                    <span>قيمة المنتجات</span>
                    <span className="font-bold">{Number(order.subtotal || 0).toFixed(2)}</span>
                    </div>

                    {order.delivery_fee > 0 && (
                    <div className="flex justify-between items-center text-sm text-[#4A4A4A] mb-2 px-1">
                        <span className="flex items-center gap-1"><MapPin size={12}/> رسوم التوصيل</span>
                        <span className="font-bold">{order.delivery_fee}</span>
                    </div>
                    )}

                    <div className="border-t border-[#D9A3AA]/20 my-3"></div>

                    <div className="flex justify-between items-center mb-4 px-1">
                    <span className="font-bold text-[#4A4A4A]">الإجمالي النهائي</span>
                    <span className="font-black text-xl text-[#4A4A4A]">{order.total_amount} ر.س</span>
                    </div>

                    {payments.length > 0 && (
                    <div className="mb-4 bg-[#F8F5F2] p-3 rounded-xl border border-[#D9A3AA]/10">
                        <p className="text-[10px] text-[#4A4A4A]/50 font-bold mb-2 flex justify-between">
                        <span>سجل الدفعات</span>
                        <span className="text-[#D9A3AA]">مجموع المدفوع: {order.deposit}</span>
                        </p>
                        <div className="space-y-1">
                        {payments.map((p) => (
                            <div key={p.id} className="flex justify-between items-center text-xs text-[#4A4A4A] border-b border-white last:border-0 pb-1 last:pb-0">
                            <span className="flex items-center gap-1">
                                <Calendar size={10}/> {formatDate(p.payment_date)}
                            </span>
                            <span className="font-bold">{p.amount} ر.س</span>
                            </div>
                        ))}
                        </div>
                    </div>
                    )}

                    <div className={`p-4 rounded-xl flex justify-between items-center ${remaining > 0 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-[#D9A3AA] text-white shadow-lg shadow-[#D9A3AA]/30'}`}>
                    <span className="text-xs font-bold flex items-center gap-2">
                        <Wallet size={16}/> {remaining > 0 ? 'المبلغ المتبقي عليك' : 'حالة الدفع'}
                    </span>
                    <span className="text-xl font-black">
                        {remaining > 0 ? `${remaining.toFixed(2)} ر.س` : 'خالص ✅'}
                    </span>
                    </div>
                </div>
              </div>

              {order.status === 'done' && (
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