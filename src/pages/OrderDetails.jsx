// src/pages/OrderDetails.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { ArrowRight, Printer, CheckCircle, Truck, Trash2, Banknote, Calendar, Phone } from 'lucide-react';

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // جلب البيانات
  useEffect(() => {
    async function fetchOrder() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setOrder(data);
      } catch (err) {
        console.error(err);
        toast.error('لم يتم العثور على الطلب');
        navigate('/app/orders');
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [id, navigate]);

  // تحديث الحالة
  const updateStatus = async (newStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      setOrder({ ...order, status: newStatus });
      toast.success(`تم تغيير الحالة إلى: ${getStatusText(newStatus)}`);
    } catch (err) {
      toast.error('فشل تحديث الحالة');
    }
  };

  // حذف الطلب
  const handleDelete = async () => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟')) return;
    try {
      await supabase.from('orders').delete().eq('id', id);
      toast.success('تم حذف الطلب');
      navigate('/app/orders');
    } catch (err) {
      toast.error('فشل الحذف');
    }
  };

  // نصوص الحالات
  const getStatusText = (s) => {
    if (s === 'new') return 'جديد';
    if (s === 'printing') return 'قيد الطباعة';
    if (s === 'done') return 'جاهز للتسليم';
    if (s === 'delivered') return 'تم التسليم';
    return s;
  };

  if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;
  if (!order) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* الرأس */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/app/orders')} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            <ArrowRight size={20} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              طلب: {order.customer_name}
              <span className={`text-sm font-normal px-3 py-1 rounded-full border ${
                order.status === 'done' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                order.status === 'printing' ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {getStatusText(order.status)}
              </span>
            </h1>
            <p className="text-sm text-slate-500 font-mono mt-1">#{order.id.slice(0, 8)}</p>
          </div>
        </div>

        {/* أزرار التحكم */}
        <div className="flex flex-wrap gap-2">
          {order.status === 'new' && (
            <button onClick={() => updateStatus('printing')} className="btn-action bg-blue-600 hover:bg-blue-700 text-white">
              <Printer size={18} /> بدء الطباعة
            </button>
          )}
          {order.status === 'printing' && (
            <button onClick={() => updateStatus('done')} className="btn-action bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle size={18} /> تم الانتهاء
            </button>
          )}
          {order.status === 'done' && (
            <button onClick={() => updateStatus('delivered')} className="btn-action bg-slate-800 hover:bg-slate-900 text-white">
              <Truck size={18} /> تسليم للعميل
            </button>
          )}
          <button onClick={handleDelete} className="btn-action bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* العمود الأيمن: التفاصيل */}
        <div className="md:col-span-2 space-y-6">
          {/* بطاقة العميل */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span> بيانات العميل
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-500"><Phone size={20} /></div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-bold">الجوال</p>
                  <p className="text-lg font-mono font-medium dir-ltr text-right text-slate-900">{order.phone || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-500"><Calendar size={20} /></div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-bold">تاريخ التسليم</p>
                  <p className="text-lg font-medium text-slate-900">{order.delivery_date || '-'}</p>
                </div>
              </div>
            </div>
            {order.notes && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-100 rounded-xl">
                <p className="text-xs text-yellow-600 font-bold mb-1">ملاحظات:</p>
                <p className="text-sm text-yellow-800">{order.notes}</p>
              </div>
            )}
          </div>

          {/* بطاقة الكميات */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span> تفاصيل الطلب
            </h3>
            <div className="flex gap-4">
              <div className="flex-1 bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                <span className="block text-slate-500 text-xs font-bold mb-1">صور A4</span>
                <span className="block text-3xl font-bold text-slate-900">{order.a4_qty || 0}</span>
              </div>
              <div className="flex-1 bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                <span className="block text-slate-500 text-xs font-bold mb-1">صور 4×6</span>
                <span className="block text-3xl font-bold text-slate-900">{order.photo_4x6_qty || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* العمود الأيسر: المالي */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl h-fit">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Banknote className="text-emerald-400" /> الملخص المالي
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between text-slate-300 text-sm">
              <span>المجموع الفرعي</span>
              <span>{order.subtotal} ر.س</span>
            </div>
            <div className="flex justify-between text-slate-300 text-sm">
              <span>التوصيل</span>
              <span>{order.delivery_fee} ر.س</span>
            </div>
            <div className="h-px bg-slate-700 my-2"></div>
            <div className="flex justify-between text-xl font-bold text-white">
              <span>الإجمالي</span>
              <span>{order.total_amount} ر.س</span>
            </div>
            <div className="flex justify-between text-emerald-400 font-medium">
              <span>المدفوع (عربون)</span>
              <span>- {order.deposit} ر.س</span>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 mt-4 flex justify-between items-center">
              <span className="text-sm text-slate-400">المتبقي</span>
              <span className="text-2xl font-bold text-white">
                {(order.total_amount - order.deposit).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* تنسيق الأزرار المشترك */}
      <style>{`
        .btn-action {
          @apply flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm active:scale-95;
        }
      `}</style>
    </div>
  );
}