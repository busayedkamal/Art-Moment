// src/pages/NewOrder.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Loader2, Tag, BookOpen, Percent, MinusCircle } from 'lucide-react';

export default function NewOrder() {
  const navigate = useNavigate();
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [prices, setPrices] = useState({ a4: 2, photo4x6: 1, delivery: 0 });
  const [couponCode, setCouponCode] = useState('');
  const [couponData, setCouponData] = useState(null); 

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      customerName: '', phone: '', deliveryDate: new Date().toISOString().slice(0, 10),
      source: ['واتساب'], sourceOther: '',
      a4Qty: 0, photo4x6Qty: 0, deliveryFee: 0, deposit: 0, notes: '',
      albumQty: 0, albumPrice: 0, manualDiscount: 0
    }
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
        if (data) {
          setPrices({
            a4: Number(data.a4_price),
            photo4x6: Number(data.photo_4x6_price),
            delivery: Number(data.delivery_fee_default)
          });
          setValue('deliveryFee', data.delivery_fee_default);
        }
      } catch { toast.error('فشل جلب الأسعار'); } finally { setLoadingSettings(false); }
    }
    fetchSettings();
  }, [setValue]);

  // مراقبة القيم للحساب
  const [a4Qty, photo4x6Qty, albumQty, albumPrice, deliveryFee, deposit, manualDiscount] = watch(['a4Qty', 'photo4x6Qty', 'albumQty', 'albumPrice', 'deliveryFee', 'deposit', 'manualDiscount']);

  // 1. حساب المجموع الفرعي
  const subtotal = (Number(a4Qty || 0) * prices.a4) + (Number(photo4x6Qty || 0) * prices.photo4x6) + (Number(albumQty || 0) * Number(albumPrice || 0));

  // 2. حساب خصم الكوبون
  let couponDiscountValue = 0;
  if (couponData) {
    if (couponData.discount_type === 'percent') {
      couponDiscountValue = subtotal * (couponData.discount_amount / 100);
    } else {
      couponDiscountValue = Number(couponData.discount_amount);
    }
  }

  // 3. الإجمالي
  const total = Math.max(0, subtotal + Number(deliveryFee || 0) - couponDiscountValue - Number(manualDiscount || 0));
  const remaining = Math.max(0, total - Number(deposit || 0));

  const checkCoupon = async () => {
    if (!couponCode.trim()) return;
    const toastId = toast.loading('جاري التحقق...');
    try {
      const { data } = await supabase.from('coupons').select('*').eq('code', couponCode.toUpperCase().trim()).eq('is_active', true).single();
      toast.dismiss(toastId);
      if (data) {
        setCouponData(data);
        toast.success(`تم تطبيق كوبون: ${data.code}`);
      } else {
        setCouponData(null);
        toast.error('كود غير صالح');
      }
    } catch { toast.dismiss(toastId); setCouponData(null); toast.error('خطأ في الكوبون'); }
  };

  const onSubmit = async (data) => {
    try {
      const cleanData = {
        customer_name: data.customerName,
        phone: data.phone,
        delivery_date: data.deliveryDate,
        source: data.source,
        source_other: data.sourceOther,
        a4_qty: Number(data.a4Qty) || 0,
        photo_4x6_qty: Number(data.photo4x6Qty) || 0,
        album_qty: Number(data.albumQty) || 0,
        album_price: Number(data.albumPrice) || 0,
        delivery_fee: Number(data.deliveryFee) || 0,
        manual_discount: Number(data.manualDiscount) || 0,
        subtotal: subtotal,
        total_amount: total,
        deposit: Number(data.deposit) || 0,
        notes: data.notes + (couponData ? ` (كوبون: ${couponData.code})` : ''),
        status: 'new',
        payment_status: remaining <= 0.5 ? 'paid' : 'unpaid'
      };

      const { error } = await supabase.from('orders').insert(cleanData);
      if (error) throw error;

      toast.success('تم إنشاء الطلب بنجاح! 🎉');
      navigate('/app/orders');
    } catch (error) { toast.error(`خطأ في الحفظ: ${error.message}`); }
  };

  const handleSourceToggle = (src) => {
    const current = watch('source');
    setValue('source', current.includes(src) ? current.filter(s => s !== src) : [...current, src]);
  };

  if (loadingSettings) return <div className="p-10 text-center flex justify-center gap-2"><Loader2 className="animate-spin" /> جاري التحميل...</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">طلب جديد</h1>
          <p className="text-sm text-slate-500 mt-1">الأسعار: A4 = {prices.a4} ريال | 4×6 = {prices.photo4x6} ريال</p>
        </div>
        <button type="button" onClick={() => navigate('/app/orders')} className="px-4 py-2 bg-white border rounded-xl hover:bg-slate-50">إلغاء</button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 md:grid-cols-12">
        
        <div className="md:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">بيانات العميل</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">اسم العميل <span className="text-red-500">*</span></label>
                <input {...register('customerName', { required: 'مطلوب' })} className="input-field" placeholder="الاسم" />
                {errors.customerName && <p className="text-xs text-red-500">{errors.customerName.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">الجوال</label>
                <input {...register('phone')} className="input-field dir-ltr text-right" placeholder="05xxxxxxxx" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">تاريخ التسليم</label>
                <input type="date" {...register('deliveryDate')} className="input-field" />
              </div>
            </div>
            <div className="mt-6">
              <label className="block text-sm font-medium mb-2">المصدر</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {['تيليجرام', 'واتساب', 'إنستقرام', 'سناب', 'مباشر'].map((src) => (
                  <button key={src} type="button" onClick={() => handleSourceToggle(src)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${watch('source').includes(src) ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-medium' : 'bg-white text-slate-600'}`}>
                    {src}
                  </button>
                ))}
              </div>
              <input {...register('sourceOther')} className="input-field" placeholder="مصدر آخر..." />
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">تفاصيل الصور</h3>
            <div className="grid gap-6 md:grid-cols-3">
              {/* تعديل تصميم الخانات هنا لتكون مربعات واضحة */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600 block text-center">عدد 4×6</label>
                <input 
                  type="number" 
                  min="0" 
                  {...register('photo4x6Qty')} 
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-2xl px-2 py-4 text-center font-black text-2xl text-slate-800 focus:border-emerald-500 focus:bg-white transition-all outline-none shadow-sm"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600 block text-center">عدد A4</label>
                <input 
                  type="number" 
                  min="0" 
                  {...register('a4Qty')} 
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-2xl px-2 py-4 text-center font-black text-2xl text-slate-800 focus:border-emerald-500 focus:bg-white transition-all outline-none shadow-sm" 
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600">ملاحظات</label>
                <textarea 
                  {...register('notes')} 
                  rows="3" 
                  className="w-full bg-yellow-50 border-2 border-yellow-200 rounded-2xl px-4 py-3 text-sm focus:border-yellow-400 focus:bg-white transition-all outline-none resize-none shadow-sm"
                  placeholder="اكتب ملاحظاتك هنا..."
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
                <span>صور (A4 + 4x6)</span>
                <span>{((Number(a4Qty || 0) * prices.a4) + (Number(photo4x6Qty || 0) * prices.photo4x6)).toFixed(2)}</span>
              </div>

              {/* خانة الألبوم */}
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-2 mb-2 text-orange-400 font-bold">
                  <BookOpen size={14} /> <span>إضافة ألبوم</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-1">العدد</label>
                    <input type="number" min="0" {...register('albumQty')} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center outline-none focus:border-orange-500" placeholder="0" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-1">السعر</label>
                    <input type="number" min="0" {...register('albumPrice')} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center outline-none focus:border-orange-500" placeholder="0" />
                  </div>
                </div>
                {Number(albumQty) > 0 && (
                   <div className="text-right text-xs text-orange-400 mt-1 font-mono">
                     المجموع: {(Number(albumQty) * Number(albumPrice)).toFixed(2)}
                   </div>
                )}
              </div>
              
              <div className="flex justify-between items-center text-slate-300 pt-2">
                <span>تكاليف إضافية</span>
                <input type="number" min="0" {...register('deliveryFee')} className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-right text-white focus:border-emerald-500 outline-none" />
              </div>

              {/* خانة الخصم اليدوي */}
              <div className="flex justify-between items-center text-red-300 pt-2">
                <span className="flex items-center gap-1"><MinusCircle size={14}/> خصم إضافي</span>
                <input type="number" min="0" {...register('manualDiscount')} className="w-20 bg-slate-800 border border-red-900/50 rounded-lg px-2 py-1 text-right text-red-300 focus:border-red-500 outline-none placeholder-red-900" placeholder="0" />
              </div>

              {/* الكوبون */}
              <div className="py-2 border-y border-slate-700 my-2">
                <div className="flex gap-2 items-center mb-2">
                  <Tag size={14} className="text-emerald-400" /> <span className="text-xs text-slate-400">كود خصم</span>
                </div>
                <div className="flex gap-2">
                  <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="CODE" className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white uppercase text-sm outline-none" />
                  <button type="button" onClick={checkCoupon} className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-lg text-sm">تحقق</button>
                </div>
              </div>

              {(couponDiscountValue > 0) && (
                 <div className="flex justify-between text-emerald-400 font-bold animate-pulse">
                   <span className="flex items-center gap-1">
                      {couponData?.discount_type === 'percent' && <Percent size={12}/>} 
                      خصم الكوبون
                   </span>
                   <span>- {couponDiscountValue.toFixed(2)}</span>
                 </div>
              )}

              <div className="pt-2 border-t border-slate-700 flex justify-between text-lg font-bold text-white">
                <span>الإجمالي</span><span>{total.toFixed(2)} ر.س</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-700">
               <label className="block text-xs text-slate-400 mb-1">العربون المدفوع</label>
               <input type="number" min="0" {...register('deposit')} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-emerald-500 font-bold text-lg outline-none" />
            </div>

            <div className="mt-4 flex justify-between items-center bg-slate-800 rounded-xl p-3">
              <span className="text-sm text-slate-400">المتبقي</span>
              <span className={`text-xl font-bold ${remaining > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{remaining.toFixed(2)}</span>
            </div>

            <button type="submit" disabled={isSubmitting} className="mt-6 w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all disabled:opacity-50">
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ وإنشاء الطلب'}
            </button>
          </div>
        </div>
      </form>
      <style>{`.input-field { @apply w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none; }`}</style>
    </div>
  );
}