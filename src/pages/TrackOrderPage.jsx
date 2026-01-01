// src/pages/TrackOrderPage.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Package, Clock, CheckCircle, Truck, AlertCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo-art-moment.svg'; // تأكد من مسار الشعار

export default function TrackOrderPage() {
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!orderId.trim()) return;

    setLoading(true);
    setError(null);
    setOrder(null);

    try {
      // البحث عن الطلب بجزء من الآيدي أو الآيدي الكامل
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        // نبحث عن تطابق في بداية الآيدي لنسهل على العميل (أول 6 أرقام مثلاً)
        .ilike('id', `${orderId}%`)
        .limit(1)
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (err) {
      setError('لم يتم العثور على طلب بهذا الرقم، يرجى التأكد والمحاولة مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  // تحديد المرحلة الحالية لشريط التقدم
  const getStepStatus = (status) => {
    const steps = { new: 1, printing: 2, done: 3, delivered: 4 };
    return steps[status] || 1;
  };

  const currentStep = order ? getStepStatus(order.status) : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4">
      {/* الشعار والعنوان */}
      <div className="text-center mb-10">
        <div className="w-20 h-20 bg-white rounded-3xl border border-slate-200 shadow-sm mx-auto flex items-center justify-center mb-4">
           {/* يمكنك وضع صورة الشعار هنا */}
           <span className="text-2xl font-bold text-slate-900">AM</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Art Moment</h1>
        <p className="text-slate-500">أدخل رقم الطلب لمتابعة حالته</p>
      </div>

      {/* صندوق البحث */}
      <div className="w-full max-w-md">
        <form onSubmit={handleSearch} className="relative mb-8">
          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="مثال: 21cbe1..."
            className="w-full h-14 pl-14 pr-6 rounded-2xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none text-lg text-center dir-ltr"
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

        {/* رسالة الخطأ */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 mb-6 border border-red-100">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* بطاقة تفاصيل الطلب */}
        {order && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* رأس البطاقة */}
            <div className="bg-slate-900 text-white p-6 text-center">
              <p className="text-slate-400 text-sm mb-1">حالة الطلب الحالي</p>
              <h2 className="text-2xl font-bold">
                {order.status === 'new' && 'جديد / قيد المراجعة'}
                {order.status === 'printing' && 'جاري الطباعة والتجهيز'}
                {order.status === 'done' && 'جاهز للاستلام'}
                {order.status === 'delivered' && 'تم التسليم'}
              </h2>
            </div>

            {/* محتوى البطاقة */}
            <div className="p-6 md:p-8">
              {/* شريط التقدم */}
              <div className="relative flex justify-between mb-10">
                {/* خط الخلفية */}
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0"></div>
                {/* خط التقدم الملون */}
                <div 
                  className="absolute top-1/2 right-0 h-1 bg-emerald-500 -translate-y-1/2 z-0 transition-all duration-1000"
                  style={{ left: `${100 - ((currentStep - 1) / 3 * 100)}%` }} // معكوس للعربية
                ></div>

                {[
                  { id: 1, icon: Package, label: 'جديد' },
                  { id: 2, icon: Clock, label: 'طباعة' },
                  { id: 3, icon: CheckCircle, label: 'جاهز' },
                  { id: 4, icon: Truck, label: 'تسليم' },
                ].map((step) => (
                  <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-500
                      ${currentStep >= step.id 
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200' 
                        : 'bg-white border-slate-200 text-slate-300'}
                    `}>
                      <step.icon size={18} />
                    </div>
                    <span className={`text-xs font-bold ${currentStep >= step.id ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* التفاصيل */}
              <div className="space-y-4 bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm">رقم الطلب</span>
                  <span className="font-mono font-bold text-slate-900">#{order.id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm">العميل</span>
                  <span className="font-bold text-slate-900">{order.customer_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm">تاريخ التسليم المتوقع</span>
                  <span className="font-bold text-slate-900">{order.delivery_date || 'غير محدد'}</span>
                </div>
              </div>

              {order.status === 'done' && (
                <div className="mt-6 p-4 bg-emerald-50 text-emerald-800 text-center rounded-xl text-sm font-medium border border-emerald-100">
                  🎉 طلبك جاهز! يرجى التوجه للاستلام أو انتظار المندوب.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* رابط الدخول للمسؤول في الأسفل */}
      <Link to="/admin/login" className="mt-auto pt-10 text-slate-400 text-xs hover:text-slate-600 transition-colors">
        دخول الإدارة
      </Link>
    </div>
  );
}