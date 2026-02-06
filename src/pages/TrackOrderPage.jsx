// src/pages/TrackOrderPage.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Search, Package, Clock, CheckCircle, Truck, 
  AlertCircle, Banknote, Wallet, Image, Home, FileText, 
  BookOpen, Tag, MapPin, Calendar, UserCheck 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo-art-moment.svg';

export default function TrackOrderPage() {
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState(null);
  const [payments, setPayments] = useState([]); 
  // حالة جديدة لبيانات العميل المالية
  const [customerStats, setCustomerStats] = useState({ wallet: 0, debt: 0, net: 0 });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // دالة توحيد رقم الجوال (مطابقة لما في النظام)
  const normalizePhone = (raw) => {
    if (!raw) return '';
    let p = String(raw).replace(/\D/g, '');
    if (p.startsWith('966')) p = p.slice(3);
    if (p.startsWith('0')) p = p.slice(1);
    return p;
  };

  // دالة جلب البيانات المالية للعميل (محفظة + ديون سابقة)
  const fetchCustomerStats = async (phone) => {
    if (!phone) return;
    const cleanPhone = normalizePhone(phone);

    try {
      // 1. جلب رصيد المحفظة الفعلي
      const { data: wallet } = await supabase
        .from('wallets')
        .select('points_balance')
        .eq('phone', cleanPhone)
        .maybeSingle();

      const walletBalance = Number(wallet?.points_balance || 0);

      // 2. جلب كل طلبات العميل لحساب إجمالي الديون (وليس فقط الطلب الحالي)
      // نبحث بالرقم النظيف لضمان الدقة
      const { data: allOrders } = await supabase
        .from('orders')
        .select('total_amount, deposit, phone')
        .order('created_at', { ascending: false });

      // تصفية الطلبات الخاصة بهذا العميل يدوياً لضمان تطابق الرقم
      let totalDebt = 0;
      if (allOrders) {
        allOrders.forEach(o => {
          if (normalizePhone(o.phone) === cleanPhone) {
            const debt = Number(o.total_amount || 0) - Number(o.deposit || 0);
            if (debt > 0) totalDebt += debt;
          }
        });
      }

      // 3. حساب الصافي (نفس منطق صفحة العملاء)
      setCustomerStats({
        wallet: walletBalance,
        debt: totalDebt,
        net: walletBalance - totalDebt
      });

    } catch (e) {
      console.error("Error fetching customer stats:", e);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!orderId.trim()) return;

    setLoading(true);
    setError(null);
    setOrder(null);
    setCustomerStats({ wallet: 0, debt: 0, net: 0 }); // تصفير الحالة

    try {
      // 1. جلب الطلب
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .ilike('id', `${orderId}%`)
        .limit(1)
        .single();

      if (orderError) throw orderError;

      // 2. جلب المدفوعات
      const { data: paymentsData } = await supabase
        .from('order_payments')
        .select('*')
        .eq('order_id', orderData.id)
        .order('payment_date', { ascending: true });

      setOrder(orderData);
      setPayments(paymentsData || []);

      // 3. جلب بيانات المحفظة والديون لهذا العميل
      if (orderData.phone) {
        await fetchCustomerStats(orderData.phone);
      }

    } catch (err) {
      setError('لم يتم العثور على طلب بهذا الرقم، يرجى التأكد والمحاولة مجدداً.');
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
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  let deliveryDuration = null;
  if (order?.status === 'delivered' && order.date_new && order.date_delivered) {
    const start = new Date(order.date_new);
    const end = new Date(order.date_delivered);
    if (end >= start) {
      const diffTime = end - start;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      deliveryDuration = diffDays > 0 ? diffDays : 1;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4 relative" dir="rtl">
      
      <Link to="/" className="absolute top-6 right-6 flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm text-slate-600 hover:text-slate-900 transition-colors font-bold text-sm">
        <Home size={16} /> الرئيسية
      </Link>

      <div className="text-center mb-10 mt-8">
        <img 
          src={logo} 
          alt="Art Moment" 
          className="w-24 h-24 mx-auto mb-4 object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300"
        />
        <h1 className="text-3xl font-bold text-slate-900 mb-2">تتبع طلبك</h1>
        <p className="text-slate-500">أدخل رقم الطلب لمعرفة الحالة والمبلغ المتبقي</p>
      </div>

      <div className="w-full max-w-md">
        <form onSubmit={handleSearch} className="relative mb-8">
          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="مثال: bf0177..."
            className="w-full h-14 pl-14 pr-6 rounded-2xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-fuchsia-500 outline-none text-lg text-center font-mono placeholder:font-sans"
            dir="ltr"
          />
          <button 
            type="submit"
            disabled={loading}
            className="absolute left-2 top-2 bottom-2 aspect-square bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-slate-800 transition-colors disabled:opacity-70"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={24} />}
          </button>
        </form>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 mb-6 border border-red-100">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {order && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* الشريط الأسود العلوي */}
            <div className="bg-slate-900 text-white p-6 text-center relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-slate-400 text-xs mb-1 font-bold uppercase tracking-wider">حالة الطلب الحالي</p>
                <h2 className="text-2xl font-bold">
                  {order.status === 'new' && 'جديد / قيد المراجعة'}
                  {order.status === 'printing' && 'جاري الطباعة والتجهيز'}
                  {order.status === 'done' && 'جاهز للاستلام'}
                  {order.status === 'delivered' && (
                    <span className="flex flex-col items-center gap-1">
                      <span>تم التسليم</span>
                      {deliveryDuration && (
                        <span className="text-sm font-medium text-emerald-400 bg-emerald-400/10 px-3 py-0.5 rounded-full mt-1">
                          (خلال {deliveryDuration} أيام)
                        </span>
                      )}
                    </span>
                  )}
                </h2>
              </div>
            </div>

            <div className="p-6">
              
              <div className="relative flex justify-between mb-8 px-2">
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0"></div>
                <div 
                  className="absolute top-1/2 right-0 h-1 bg-emerald-500 -translate-y-1/2 z-0 transition-all duration-1000"
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
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' 
                          : 'bg-white border-slate-200 text-slate-300'}
                      `}>
                        <step.icon size={14} />
                      </div>
                      <span className={`text-[10px] font-bold ${currentStep >= step.id ? 'text-fuchsia-600' : 'text-slate-300'}`}>
                        {step.label}
                      </span>
                      {stepDate && (
                        <span className="text-[9px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mt-1 min-w-[60px] text-center">
                          {stepDate}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* تفاصيل الطلب */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3 mb-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">رقم الطلب</span>
                  <span className="font-mono font-bold text-slate-900">#{order.id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">العميل</span>
                  <span className="font-bold text-slate-900">{order.customer_name}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">تاريخ التسليم المتوقع</span>
                  <span className="font-bold text-slate-900">{order.delivery_date || 'غير محدد'}</span>
                </div>
              </div>

              {/* ملاحظات */}
              {order.notes && (
                <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-100 mb-4">
                  <h3 className="text-xs font-bold text-yellow-600 mb-2 flex items-center gap-1">
                    <FileText size={14}/> ملاحظات
                  </h3>
                  <p className="text-sm text-slate-700 bg-white p-3 rounded-xl border border-yellow-100 leading-relaxed shadow-sm">
                    {order.notes}
                  </p>
                </div>
              )}

              {/* القسم المالي */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                
                {/* --- الجديد: ملخص حساب العميل (محفظة + ديون) --- */}
                <div className="mb-6 bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <UserCheck size={16} className="text-fuchsia-600"/> ملخص حسابك (لكل الطلبات)
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-slate-50 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 block mb-1">رصيد المحفظة</span>
                      <span className="font-bold text-emerald-600 dir-ltr">{customerStats.wallet.toFixed(2)}</span>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 block mb-1">إجمالي الديون</span>
                      <span className="font-bold text-red-600 dir-ltr">{customerStats.debt.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className={`mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-sm font-bold ${customerStats.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    <span>الصافي النهائي:</span>
                    <span className="dir-ltr">{customerStats.net.toFixed(2)} ر.س</span>
                  </div>
                </div>
                {/* ----------------------------------------------- */}

                <h3 className="text-xs font-bold text-slate-400 mb-4 flex items-center gap-1">
                  <Banknote size={14}/> تفاصيل هذا الطلب
                </h3>

                <div className="flex justify-between items-center text-sm text-slate-600 mb-2 px-1">
                  <span>قيمة المنتجات</span>
                  <span className="font-bold">{Number(order.subtotal || 0).toFixed(2)}</span>
                </div>

                {order.delivery_fee > 0 && (
                  <div className="flex justify-between items-center text-sm text-slate-600 mb-2 px-1">
                    <span className="flex items-center gap-1"><MapPin size={12}/> رسوم التوصيل</span>
                    <span className="font-bold">{order.delivery_fee}</span>
                  </div>
                )}

                {(() => {
                    const theoreticalTotal = Number(order.subtotal || 0) + Number(order.delivery_fee || 0);
                    const impliedDiscount = theoreticalTotal - Number(order.total_amount || 0);
                    if (impliedDiscount > 0.01) return (
                        <div className="flex justify-between items-center text-sm text-red-500 mb-2 px-1">
                            <span className="flex items-center gap-1"><Tag size={12}/> خصم / محفظة</span>
                            <span className="font-bold">-{impliedDiscount.toFixed(2)}</span>
                        </div>
                    );
                })()}

                <div className="border-t border-slate-200 my-3"></div>

                <div className="flex justify-between items-center mb-4 px-1">
                  <span className="font-bold text-slate-900">الإجمالي النهائي</span>
                  <span className="font-black text-xl text-slate-900">{order.total_amount} ر.س</span>
                </div>

                {payments.length > 0 && (
                  <div className="mb-4 bg-white p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold mb-2 flex justify-between">
                      <span>سجل الدفعات</span>
                      <span className="text-fuchsia-600">مجموع المدفوع: {order.deposit}</span>
                    </p>
                    <div className="space-y-1">
                      {payments.map((p) => (
                        <div key={p.id} className="flex justify-between items-center text-xs text-slate-600 border-b border-slate-50 last:border-0 pb-1 last:pb-0">
                          <span className="flex items-center gap-1">
                            <Calendar size={10}/> {formatDate(p.payment_date)}
                          </span>
                          <span className="font-bold">{p.amount} ر.س</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={`p-4 rounded-xl flex justify-between items-center ${remaining > 0 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100'}`}>
                  <span className="text-xs font-bold flex items-center gap-2">
                    <Wallet size={16}/> {remaining > 0 ? 'المبلغ المتبقي عليك' : 'حالة الدفع'}
                  </span>
                  <span className="text-xl font-black">
                    {remaining > 0 ? `${remaining.toFixed(2)} ر.س` : 'خالص ✅'}
                  </span>
                </div>
              </div>

              {order.status === 'done' && (
                <div className="mt-6 p-4 bg-fuchsia-50 text-fuchsia-800 text-center rounded-xl text-sm font-medium border border-fuchsia-100 animate-pulse">
                  🎉 طلبك جاهز! تفضل بزيارتنا للاستلام.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <Link to="/admin/login" className="mt-auto pt-10 text-slate-300 text-xs hover:text-slate-500 transition-colors">
        Art Moment Admin
      </Link>
    </div>
  );
}