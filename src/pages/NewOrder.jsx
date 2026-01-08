// src/pages/NewOrder.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  Loader2, Tag, BookOpen, Percent, MinusCircle, 
  Crown, AlertTriangle, Package 
} from 'lucide-react';

export default function NewOrder() {
  const navigate = useNavigate();
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [prices, setPrices] = useState({ a4: 2, photo4x6: 1, delivery: 0 });
  const [couponCode, setCouponCode] = useState('');
  const [couponData, setCouponData] = useState(null); 
  
  // حالة المخزون (جديد)
  const [inventory, setInventory] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);

  // حالة بيانات الولاء للعميل
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [checkingLoyalty, setCheckingLoyalty] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      customerName: '', phone: '', deliveryDate: new Date().toISOString().slice(0, 10),
      source: ['واتساب'], sourceOther: '',
      a4Qty: 0, photo4x6Qty: 0, deliveryFee: 0, deposit: 0, notes: '',
      albumQty: 0, albumPrice: 0, manualDiscount: 0
    }
  });

  const phoneWatcher = watch('phone');

  // 1. جلب الإعدادات والمخزون
  useEffect(() => {
    async function fetchData() {
      try {
        // جلب الأسعار
        const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
        if (settings) {
          setPrices({
            a4: Number(settings.a4_price),
            photo4x6: Number(settings.photo_4x6_price),
            delivery: Number(settings.delivery_fee_default)
          });
          setValue('deliveryFee', settings.delivery_fee_default);
        }

        // جلب المخزون (جديد)
        const { data: invData } = await supabase.from('inventory').select('*');
        if (invData) {
          setInventory(invData);
          // فلترة المواد التي وصلت للحد الأدنى
          const low = invData.filter(item => item.quantity <= item.threshold);
          setLowStockItems(low);
        }

      } catch { toast.error('فشل جلب البيانات'); } finally { setLoadingSettings(false); }
    }
    fetchData();
  }, [setValue]);

  // 2. فحص الولاء (Mini CRM)
  useEffect(() => {
    const checkCustomerHistory = async () => {
      if (!phoneWatcher || phoneWatcher.length < 9) {
        setLoyaltyData(null);
        return;
      }
      setCheckingLoyalty(true);
      try {
        const { data, error } = await supabase.from('orders').select('id, total_amount, created_at').eq('phone', phoneWatcher);
        if (!error && data && data.length > 0) {
          const totalSpent = data.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
          setLoyaltyData({
            count: data.length,
            totalSpent: totalSpent,
            lastOrderDate: new Date(data[data.length - 1].created_at).toLocaleDateString('ar-EG')
          });
        } else { setLoyaltyData(null); }
      } catch (err) { console.error(err); } finally { setCheckingLoyalty(false); }
    };
    const timeoutId = setTimeout(checkCustomerHistory, 800);
    return () => clearTimeout(timeoutId);
  }, [phoneWatcher]);

  // الحسابات
  const [a4Qty, photo4x6Qty, albumQty, albumPrice, deliveryFee, deposit, manualDiscount] = watch(['a4Qty', 'photo4x6Qty', 'albumQty', 'albumPrice', 'deliveryFee', 'deposit', 'manualDiscount']);
  const subtotal = (Number(a4Qty || 0) * prices.a4) + (Number(photo4x6Qty || 0) * prices.photo4x6) + (Number(albumQty || 0) * Number(albumPrice || 0));
  
  let couponDiscountValue = 0;
  if (couponData) {
    couponDiscountValue = couponData.discount_type === 'percent' ? subtotal * (couponData.discount_amount / 100) : Number(couponData.discount_amount);
  }
  
  const total = Math.max(0, subtotal + Number(deliveryFee || 0) - couponDiscountValue - Number(manualDiscount || 0));
  const remaining = Math.max(0, total - Number(deposit || 0));

  const checkCoupon = async () => {
    if (!couponCode.trim()) return;
    const toastId = toast.loading('جاري التحقق...');
    try {
      const { data } = await supabase.from('coupons').select('*').eq('code', couponCode.toUpperCase().trim()).eq('is_active', true).single();
      toast.dismiss(toastId);
      if (data) { setCouponData(data); toast.success(`تم تطبيق كوبون: ${data.code}`); } 
      else { setCouponData(null); toast.error('كود غير صالح'); }
    } catch { toast.dismiss(toastId); setCouponData(null); toast.error('خطأ'); }
  };

  const onSubmit = async (data) => {
    try {
      // 1. إنشاء الطلب
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

      // 2. تحديث المخزون (خصم الكميات)
      // ملاحظة: نستخدم الأسماء المخزنة في قاعدة البيانات ('ورق A4', 'ورق 4x6', 'ألبومات')
      
      const updates = [];
      
      // خصم A4
      if (cleanData.a4_qty > 0) {
        const item = inventory.find(i => i.item_name === 'ورق A4');
        if (item) updates.push(supabase.from('inventory').update({ quantity: item.quantity - cleanData.a4_qty }).eq('id', item.id));
      }
      
      // خصم 4x6
      if (cleanData.photo_4x6_qty > 0) {
        const item = inventory.find(i => i.item_name === 'ورق 4x6');
        if (item) updates.push(supabase.from('inventory').update({ quantity: item.quantity - cleanData.photo_4x6_qty }).eq('id', item.id));
      }

      // خصم الألبومات
      if (cleanData.album_qty > 0) {
        const item = inventory.find(i => i.item_name === 'ألبومات');
        if (item) updates.push(supabase.from('inventory').update({ quantity: item.quantity - cleanData.album_qty }).eq('id', item.id));
      }

      // تنفيذ التحديثات في الخلفية
      if (updates.length > 0) await Promise.all(updates);

      toast.success('تم إنشاء الطلب وتحديث المخزون! 🎉');
      navigate('/app/orders');
    } catch (error) { toast.error(`خطأ: ${error.message}`); }
  };

  const handleSourceToggle = (src) => {
    const current = watch('source');
    setValue('source', current.includes(src) ? current.filter(s => s !== src) : [...current, src]);
  };

  if (loadingSettings) return <div className="p-10 text-center flex justify-center gap-2"><Loader2 className="animate-spin" /> جاري التحميل...</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      
      {/* --- قسم تنبيهات المخزون (جديد) --- */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 animate-pulse">
          <AlertTriangle className="text-amber-600 shrink-0" />
          <div>
            <h4 className="font-bold text-amber-800">تنبيه مخزون منخفض!</h4>
            <ul className="text-sm text-amber-700 mt-1 list-disc list-inside">
              {lowStockItems.map(item => (
                <li key={item.id}>
                  المادة <b>{item.item_name}</b> متبقي منها <b>{item.quantity}</b> فقط (الحد الأدنى: {item.threshold})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

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
            
            {/* بطاقة الولاء */}
            {loyaltyData && (
              <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white rounded-full shadow-sm text-indigo-600"><Crown size={24}/></div>
                  <div>
                    <h4 className="font-bold text-indigo-900">عميل مميز (سابق)</h4>
                    <p className="text-xs text-indigo-600 font-medium mt-1">لديه <span className="font-bold">{loyaltyData.count}</span> طلبات سابقة بإجمالي <span className="font-bold">{loyaltyData.totalSpent}</span> ر.س</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">اسم العميل <span className="text-red-500">*</span></label>
                <input {...register('customerName', { required: 'مطلوب' })} className="input-field" placeholder="الاسم" />
                {errors.customerName && <p className="text-xs text-red-500">{errors.customerName.message}</p>}
              </div>
              <div className="space-y-1 relative">
                <label className="text-sm font-medium">الجوال</label>
                <input {...register('phone')} className="input-field dir-ltr text-right" placeholder="05xxxxxxxx" />
                {checkingLoyalty && <div className="absolute left-3 top-9"><Loader2 size={16} className="animate-spin text-slate-400"/></div>}
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
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600 block text-center">عدد 4×6</label>
                <input type="number" min="0" {...register('photo4x6Qty')} className="qty-input" placeholder="0"/>
                {/* عرض المخزون المتبقي */}
                <span className="text-[10px] text-center block text-slate-400">
                   مخزون: {inventory.find(i => i.item_name === 'ورق 4x6')?.quantity || '-'}
                </span>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600 block text-center">عدد A4</label>
                <input type="number" min="0" {...register('a4Qty')} className="qty-input" placeholder="0"/>
                <span className="text-[10px] text-center block text-slate-400">
                   مخزون: {inventory.find(i => i.item_name === 'ورق A4')?.quantity || '-'}
                </span>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600">ملاحظات</label>
                <textarea {...register('notes')} rows="3" className="w-full bg-yellow-50 border-2 border-yellow-200 rounded-2xl px-4 py-3 text-sm focus:border-yellow-400 focus:bg-white outline-none resize-none" placeholder="اكتب ملاحظاتك هنا..."/>
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
                <div className="flex items-center justify-between mb-2">
                   <div className="flex items-center gap-2 text-orange-400 font-bold"><BookOpen size={14} /> <span>إضافة ألبوم</span></div>
                   <span className="text-[10px] text-slate-400">مخزون: {inventory.find(i => i.item_name === 'ألبومات')?.quantity || '-'}</span>
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
              </div>
              
              <div className="flex justify-between items-center text-slate-300 pt-2">
                <span>تكاليف إضافية</span>
                <input type="number" min="0" {...register('deliveryFee')} className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-right text-white focus:border-emerald-500 outline-none" />
              </div>

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
                   <span className="flex items-center gap-1">{couponData?.discount_type === 'percent' && <Percent size={12}/>} خصم الكوبون</span>
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
      <style>{`
        .input-field { @apply w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none; }
        .qty-input { @apply w-full bg-slate-50 border-2 border-slate-300 rounded-2xl px-2 py-4 text-center font-black text-2xl text-slate-800 focus:border-emerald-500 focus:bg-white transition-all outline-none shadow-sm; }
      `}</style>
    </div>
  );
}