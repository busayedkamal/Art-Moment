// src/pages/NewOrder.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Calculator, Loader2 } from 'lucide-react';

export default function NewOrder() {
  const navigate = useNavigate();
  const [loadingSettings, setLoadingSettings] = useState(true);
  
  // حالة لتخزين الأسعار القادمة من الإعدادات
  const [prices, setPrices] = useState({
    a4: 2,         // قيمة احتياطية
    photo4x6: 1,   // قيمة احتياطية
    delivery: 0
  });

  // إعداد النموذج
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      customerName: '',
      phone: '',
      deliveryDate: new Date().toISOString().slice(0, 10),
      source: ['واتساب'],
      sourceOther: '',
      a4Qty: 0,
      photo4x6Qty: 0,
      deliveryFee: 0,
      deposit: 0,
      notes: '',
    }
  });

  // 1. جلب الأسعار من قاعدة البيانات عند فتح الصفحة
  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 1)
          .single();

        if (error) throw error;

        if (data) {
          // تحديث الأسعار بالقيم الحقيقية من قاعدة البيانات
          setPrices({
            a4: Number(data.a4_price),
            photo4x6: Number(data.photo_4x6_price),
            delivery: Number(data.delivery_fee_default)
          });
          
          // وضع سعر التوصيل الافتراضي في النموذج
          setValue('deliveryFee', data.delivery_fee_default);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        toast.error('فشل جلب الأسعار، سيتم استخدام الافتراضي');
      } finally {
        setLoadingSettings(false);
      }
    }
    fetchSettings();
  }, [setValue]);

  // مراقبة القيم للحساب الفوري
  const [a4Qty, photo4x6Qty, deliveryFee, deposit] = watch(['a4Qty', 'photo4x6Qty', 'deliveryFee', 'deposit']);

  // 2. حساب الإجمالي باستخدام الأسعار الديناميكية (prices)
  const subtotal = (Number(a4Qty || 0) * prices.a4) + (Number(photo4x6Qty || 0) * prices.photo4x6);
  const total = subtotal + Number(deliveryFee || 0);
  const remaining = Math.max(0, total - Number(deposit || 0));

  // الحفظ
  const onSubmit = async (data) => {
    try {
      const { error } = await supabase
        .from('orders')
        .insert({
          customer_name: data.customerName,
          phone: data.phone,
          delivery_date: data.deliveryDate,
          source: data.source,
          source_other: data.sourceOther,
          a4_qty: data.a4Qty,
          photo_4x6_qty: data.photo4x6Qty,
          delivery_fee: data.deliveryFee,
          subtotal: subtotal,
          total_amount: total,
          deposit: data.deposit,
          notes: data.notes,
          status: 'new',
          payment_status: remaining === 0 ? 'paid' : 'unpaid'
        });

      if (error) throw error;

      toast.success('تم إنشاء الطلب بنجاح!');
      navigate('/app/orders');

    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  const handleSourceToggle = (sourceValue) => {
    const currentSources = watch('source');
    if (currentSources.includes(sourceValue)) {
      setValue('source', currentSources.filter(s => s !== sourceValue));
    } else {
      setValue('source', [...currentSources, sourceValue]);
    }
  };

  if (loadingSettings) return <div className="p-10 text-center flex justify-center items-center gap-2"><Loader2 className="animate-spin" /> جاري جلب الأسعار...</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">طلب جديد</h1>
          <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
            <Calculator size={16} className="text-emerald-600" /> 
            الأسعار الحالية: 
            <span className="font-bold text-slate-900 mx-1">A4 = {prices.a4} ريال</span> | 
            <span className="font-bold text-slate-900 mx-1">4×6 = {prices.photo4x6} ريال</span>
          </p>
        </div>
        <button 
          type="button" 
          onClick={() => navigate('/app/orders')} 
          className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium"
        >
          إلغاء
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 md:grid-cols-12">
        
        {/* القسم الأيمن: المدخلات */}
        <div className="md:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">بيانات العميل</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">اسم العميل <span className="text-red-500">*</span></label>
                <input
                  {...register('customerName', { required: 'مطلوب' })}
                  className="input-field"
                  placeholder="الاسم"
                />
                {errors.customerName && <p className="text-xs text-red-500">{errors.customerName.message}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">الجوال</label>
                <input
                  {...register('phone')}
                  className="input-field dir-ltr text-right"
                  placeholder="05xxxxxxxx"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">تاريخ التسليم</label>
                <input
                  type="date"
                  {...register('deliveryDate')}
                  className="input-field"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">المصدر</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {['واتساب', 'إنستقرام', 'سناب', 'مباشر'].map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => handleSourceToggle(src)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                      watch('source').includes(src) 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-medium' 
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    {src}
                  </button>
                ))}
              </div>
              <input
                  {...register('sourceOther')}
                  className="input-field"
                  placeholder="مصدر آخر (اختياري)..."
                />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">تفاصيل الطلب</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  عدد A4 <span className="text-xs text-emerald-600 font-bold">({prices.a4} ر.س)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  {...register('a4Qty')}
                  className="input-field font-bold text-slate-900 text-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  عدد 4×6 <span className="text-xs text-emerald-600 font-bold">({prices.photo4x6} ر.س)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  {...register('photo4x6Qty')}
                  className="input-field font-bold text-slate-900 text-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">ملاحظات</label>
                <textarea
                  {...register('notes')}
                  rows="1"
                  className="input-field resize-none"
                  placeholder="..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* القسم الأيسر: الحسابات */}
        <div className="md:col-span-4 space-y-4">
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg sticky top-6">
            <h3 className="text-lg font-bold mb-4">ملخص الدفع</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>المجموع الفرعي</span>
                <span>{subtotal.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center text-slate-300">
                <span>التوصيل</span>
                <input
                  type="number"
                  min="0"
                  {...register('deliveryFee')}
                  className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-right text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-700 flex justify-between text-lg font-bold text-white">
                <span>الإجمالي</span>
                <span>{total.toFixed(2)} ر.س</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-700">
               <label className="block text-xs text-slate-400 mb-1">العربون المدفوع</label>
               <input
                  type="number"
                  min="0"
                  {...register('deposit')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-emerald-500 font-bold text-lg outline-none"
                />
            </div>

            <div className="mt-4 flex justify-between items-center bg-slate-800 rounded-xl p-3">
              <span className="text-sm text-slate-400">المتبقي</span>
              <span className={`text-xl font-bold ${remaining > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {remaining.toFixed(2)}
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ وإنشاء الطلب'}
            </button>
          </div>
        </div>
      </form>
      
      {/* تنسيق الحقول */}
      <style>{`
        .input-field {
          @apply w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all;
        }
      `}</style>
    </div>
  );
}