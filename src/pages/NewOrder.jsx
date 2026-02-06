// src/pages/NewOrder.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  Loader2, Tag, BookOpen, Percent, MinusCircle, 
  Crown, AlertTriangle, Sparkles, Wallet, Coins, MapPin 
} from 'lucide-react';

export default function NewOrder() {
  const navigate = useNavigate();
  const [loadingSettings, setLoadingSettings] = useState(true);
  
  const [settings, setSettings] = useState({ 
    a4_price: 2, photo_4x6_price: 1, delivery_fee_default: 0,
    is_dynamic_pricing_enabled: false,
    tier_1_limit: 20, tier_1_price: 2,
    tier_2_limit: 50, tier_2_price: 1.5,
    tier_3_price: 1
  });

  const POINTS_EXCHANGE_RATE = 10; 
  // قائمة المدن للاختيار السريع
  const CITIES = ['الهفوف', 'المبرز', 'القرى', 'الدمام', 'الخبر', 'الرميلة', 'أخرى'];

  const [couponCode, setCouponCode] = useState('');
  const [couponData, setCouponData] = useState(null); 
  const [inventory, setInventory] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);

  const [wallet, setWallet] = useState(null);
  const [usePoints, setUsePoints] = useState(false);
  const [checkingLoyalty, setCheckingLoyalty] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      customerName: '', phone: '', deliveryDate: new Date().toISOString().slice(0, 10),
      source: 'الهفوف', // الافتراضي أصبح مدينة
      sourceOther: '',
      a4Qty: 0, photo4x6Qty: 0, deliveryFee: 0, deposit: 0, notes: '',
      albumQty: 0, albumPrice: 0, manualDiscount: 0
    }
  });

  const phoneWatcher = watch('phone');
  const currentCity = watch('source'); // مراقبة المدينة المختارة
  const [a4Qty, photo4x6Qty, albumQty, albumPrice, deliveryFee, deposit, manualDiscount] = watch(['a4Qty', 'photo4x6Qty', 'albumQty', 'albumPrice', 'deliveryFee', 'deposit', 'manualDiscount']);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 1).single();
        if (settingsData) {
          setSettings(settingsData);
          setValue('deliveryFee', settingsData.delivery_fee_default);
        }
        const { data: invData } = await supabase.from('inventory').select('*');
        if (invData) {
          setInventory(invData);
          setLowStockItems(invData.filter(item => item.quantity <= item.threshold));
        }
      } catch { toast.error('فشل جلب البيانات'); } finally { setLoadingSettings(false); }
    }
    fetchData();
  }, [setValue]);

  useEffect(() => {
    const fetchWalletData = async () => {
      if (!phoneWatcher || phoneWatcher.length < 9) {
        setWallet(null);
        setUsePoints(false);
        return;
      }
      setCheckingLoyalty(true);
      try {
        let { data, error } = await supabase.from('wallets').select('*').eq('phone', phoneWatcher).single();
        if (error && error.code === 'PGRST116') {
          setWallet({ points_balance: 0, total_spent: 0, isNew: true });
        } else if (data) {
          setWallet(data);
        }
      } catch (err) { console.error(err); } finally { setCheckingLoyalty(false); }
    };
    const timeoutId = setTimeout(fetchWalletData, 800);
    return () => clearTimeout(timeoutId);
  }, [phoneWatcher]);

  let active4x6Price = settings.photo_4x6_price;
  let isDynamicApplied = false;

  if (settings.is_dynamic_pricing_enabled) {
    const qty = Number(photo4x6Qty || 0);
    if (qty > 0) {
      isDynamicApplied = true;
      if (qty <= settings.tier_1_limit) active4x6Price = settings.tier_1_price;
      else if (qty <= settings.tier_2_limit) active4x6Price = settings.tier_2_price;
      else active4x6Price = settings.tier_3_price;
    }
  }

  const subtotal = (Number(a4Qty || 0) * settings.a4_price) + (Number(photo4x6Qty || 0) * active4x6Price) + (Number(albumQty || 0) * Number(albumPrice || 0));
  
  let couponDiscountValue = 0;
  if (couponData) {
    couponDiscountValue = couponData.discount_type === 'percent' ? subtotal * (couponData.discount_amount / 100) : Number(couponData.discount_amount);
  }

  let pointsDiscountValue = 0;
  if (usePoints && wallet && wallet.points_balance > 0) {
    const maxDiscount = subtotal + Number(deliveryFee || 0) - couponDiscountValue - Number(manualDiscount || 0);
    const maxPointsNeeded = maxDiscount * POINTS_EXCHANGE_RATE;
    const pointsUsed = Math.min(wallet.points_balance, maxPointsNeeded);
    pointsDiscountValue = pointsUsed / POINTS_EXCHANGE_RATE;
  }

  const total = Math.max(0, subtotal + Number(deliveryFee || 0) - couponDiscountValue - Number(manualDiscount || 0) - pointsDiscountValue);
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
      const pointsEarned = Math.floor(total); 
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
        notes: data.notes + (couponData ? ` | كوبون: ${couponData.code}` : '') + (isDynamicApplied ? ` | تسعير ذكي` : '') + (pointsDiscountValue > 0 ? ` | خصم ولاء: ${pointsDiscountValue} ريال` : ''),
        status: 'new',
        payment_status: remaining <= 0.5 ? 'paid' : 'unpaid'
      };

      const { data: orderResult, error } = await supabase.from('orders').insert(cleanData).select().single();
      if (error) throw error;

      if (data.phone) {
        let currentWallet = wallet;
        if (wallet?.isNew) {
          const { data: newWallet } = await supabase.from('wallets').insert([{ phone: data.phone, points_balance: 0, total_spent: 0 }]).select().single();
          currentWallet = newWallet;
        }

        if (currentWallet) {
          let newBalance = currentWallet.points_balance;
          if (pointsDiscountValue > 0) {
            const usedPoints = Math.floor(pointsDiscountValue * POINTS_EXCHANGE_RATE);
            newBalance -= usedPoints;
            await supabase.from('wallet_transactions').insert({ wallet_id: currentWallet.id, order_id: orderResult.id, type: 'redeem', points: usedPoints, amount_value: pointsDiscountValue });
          }
          if (pointsEarned > 0) {
            newBalance += pointsEarned;
            await supabase.from('wallet_transactions').insert({ wallet_id: currentWallet.id, order_id: orderResult.id, type: 'earn', points: pointsEarned, amount_value: pointsEarned });
          }
          await supabase.from('wallets').update({ points_balance: newBalance, total_spent: Number(currentWallet.total_spent) + Number(total) }).eq('id', currentWallet.id);
        }
      }

      const updates = [];
      if (cleanData.a4_qty > 0) {
        const item = inventory.find(i => i.item_name === 'ورق A4');
        if (item) updates.push(supabase.from('inventory').update({ quantity: item.quantity - cleanData.a4_qty }).eq('id', item.id));
      }
      if (cleanData.photo_4x6_qty > 0) {
        const item = inventory.find(i => i.item_name === 'ورق 4x6');
        if (item) updates.push(supabase.from('inventory').update({ quantity: item.quantity - cleanData.photo_4x6_qty }).eq('id', item.id));
      }
      if (cleanData.album_qty > 0) {
        const item = inventory.find(i => i.item_name === 'ألبومات');
        if (item) updates.push(supabase.from('inventory').update({ quantity: item.quantity - cleanData.album_qty }).eq('id', item.id));
      }
      if (updates.length > 0) await Promise.all(updates);

      toast.success(`تم الطلب! كسب العميل ${pointsEarned} نقطة 🌟`);
      navigate('/app/orders');
    } catch (error) { toast.error(`خطأ: ${error.message}`); }
  };

  if (loadingSettings) return <div className="p-10 text-center flex justify-center gap-2"><Loader2 className="animate-spin" /> جاري التحميل...</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 animate-pulse">
          <AlertTriangle className="text-amber-600 shrink-0" />
          <div>
            <h4 className="font-bold text-amber-800">تنبيه مخزون منخفض!</h4>
            <ul className="text-sm text-amber-700 mt-1 list-disc list-inside">
              {lowStockItems.map(item => (
                <li key={item.id}>مخزون <b>{item.item_name}</b> متبقي منها <b>{item.quantity}</b> فقط</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">طلب جديد</h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
            الأسعار: <span className="bg-slate-100 px-2 rounded">A4 = {settings.a4_price}</span>
            {isDynamicApplied ? 
              <span className="bg-fuchsia-100 text-fuchsia-700 px-2 rounded font-bold flex items-center gap-1"><Sparkles size={12}/> 4×6 = {active4x6Price}</span> : 
              <span className="bg-slate-100 px-2 rounded">4×6 = {settings.photo_4x6_price}</span>
            }
          </p>
        </div>
        <button type="button" onClick={() => navigate('/app/orders')} className="px-4 py-2 bg-white border rounded-xl hover:bg-slate-50">إلغاء</button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-8 space-y-6">
          
          {/* قسم بيانات العميل */}
          <div className="bg-white rounded-2xl border p-6 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-bold text-slate-800">بيانات العميل</h3>
              {wallet && !wallet.isNew && (
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-3 py-1.5 rounded-xl shadow-md flex items-center gap-2 animate-in zoom-in">
                  <Wallet size={16} className="text-violet-200"/>
                  <div>
                    <div className="text-[9px] text-violet-200 font-bold uppercase leading-none">المحفظة</div>
                    <div className="text-sm font-black leading-none mt-0.5">{wallet.points_balance}</div>
                  </div>
                </div>
              )}
            </div>

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
            
            {/* قسم المدينة / المنطقة */}
            <div className="mt-6">
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <MapPin size={16} className="text-red-500"/> المنطقة / المدينة
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {CITIES.map((city) => (
                  <button 
                    key={city} 
                    type="button" 
                    onClick={() => setValue('source', city)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${currentCity === city ? 'bg-red-50 border-red-500 text-red-700 font-bold' : 'bg-white text-slate-600'}`}
                  >
                    {city}
                  </button>
                ))}
              </div>
              {currentCity === 'أخرى' && (
                <input {...register('sourceOther')} className="input-field mt-2" placeholder="اكتب اسم المنطقة..." />
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Tag className="text-fuchsia-500"/> تفاصيل الصور</h3>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-fuchsia-800 block text-center flex items-center justify-center gap-2">
                  عدد 4×6 {isDynamicApplied && <Sparkles size={14} className="text-amber-400 animate-pulse"/>}
                </label>
                <div className="relative">
                  <input type="number" min="0" {...register('photo4x6Qty')} className={`w-full bg-white border-2 rounded-2xl px-2 py-4 text-center font-black text-3xl shadow-sm outline-none focus:ring-4 placeholder-fuchsia-200 ${isDynamicApplied ? 'border-amber-400 text-amber-600 focus:ring-amber-100' : 'border-fuchsia-500 text-fuchsia-700 focus:ring-fuchsia-100'}`} placeholder="0" />
                </div>
                <div className="text-center text-[10px] text-slate-400 font-medium mt-1">مخزون: {inventory.find(i => i.item_name === 'ورق 4x6')?.quantity || '-'}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-blue-800 block text-center">عدد A4</label>
                <div className="relative">
                  <input type="number" min="0" {...register('a4Qty')} className="w-full bg-white border-2 border-blue-500 rounded-2xl px-2 py-4 text-center font-black text-3xl text-blue-700 shadow-sm outline-none focus:ring-4 focus:ring-blue-100 placeholder-blue-200" placeholder="0" />
                </div>
                <div className="text-center text-[10px] text-slate-400 font-medium mt-1">مخزون: {inventory.find(i => i.item_name === 'ورق A4')?.quantity || '-'}</div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-amber-700">ملاحظات إضافية</label>
              <textarea {...register('notes')} rows="4" className="w-full bg-amber-50 border-2 border-amber-300 rounded-2xl px-4 py-3 text-sm text-slate-700 placeholder-amber-300/70 focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none resize-none transition-all" placeholder="اكتبي ملاحظاتك هنا..." />
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
                <span>{((Number(a4Qty || 0) * settings.a4_price) + (Number(photo4x6Qty || 0) * active4x6Price)).toFixed(2)}</span>
              </div>

              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                   <div className="flex items-center gap-2 text-orange-400 font-bold"><BookOpen size={14} /> <span>إضافة ألبوم</span></div>
                   <span className="text-[10px] text-slate-400">مخزون: {inventory.find(i => i.item_name === 'ألبومات')?.quantity || '-'}</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1"><input type="number" min="0" {...register('albumQty')} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center outline-none focus:border-orange-500" placeholder="العدد" /></div>
                  <div className="flex-1"><input type="number" min="0" {...register('albumPrice')} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center outline-none focus:border-orange-500" placeholder="السعر" /></div>
                </div>
              </div>
              
              <div className="flex justify-between items-center text-slate-300 pt-2">
                <span>تكاليف إضافية</span>
                <input type="number" min="0" {...register('deliveryFee')} className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-right text-white focus:border-fuchsia-500 outline-none" />
              </div>

              <div className="flex justify-between items-center text-red-300 pt-2">
                <span className="flex items-center gap-1"><MinusCircle size={14}/> خصم إضافي</span>
                <input type="number" min="0" {...register('manualDiscount')} className="w-20 bg-slate-800 border border-red-900/50 rounded-lg px-2 py-1 text-right text-red-300 focus:border-red-500 outline-none placeholder-red-900" placeholder="0" />
              </div>

              <div className="py-2 border-y border-slate-700 my-2">
                <div className="flex gap-2 items-center mb-2">
                  <Tag size={14} className="text-fuchsia-400" /> <span className="text-xs text-slate-400">كود خصم</span>
                </div>
                <div className="flex gap-2">
                  <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="CODE" className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white uppercase text-sm outline-none" />
                  <button type="button" onClick={checkCoupon} className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-lg text-sm">تحقق</button>
                </div>
              </div>

              {wallet && wallet.points_balance > 0 && (
                <div className="py-2">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${usePoints ? 'bg-violet-500 border-violet-500' : 'border-slate-500'}`}>
                        {usePoints && <div className="w-2 h-2 bg-white rounded-full"/>}
                      </div>
                      <span className="text-violet-300 text-xs font-bold flex items-center gap-1">
                        <Coins size={12}/> استخدام الرصيد ({wallet.points_balance})
                      </span>
                    </div>
                    {usePoints && <span className="text-violet-400 font-bold">-{pointsDiscountValue.toFixed(2)}</span>}
                    <input type="checkbox" className="hidden" checked={usePoints} onChange={() => setUsePoints(!usePoints)} />
                  </label>
                </div>
              )}

              {(couponDiscountValue > 0) && (
                 <div className="flex justify-between text-fuchsia-400 font-bold animate-pulse">
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
               <input type="number" min="0" {...register('deposit')} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-fuchsia-500 font-bold text-lg outline-none" />
            </div>

            <div className="mt-4 flex justify-between items-center bg-slate-800 rounded-xl p-3">
              <span className="text-sm text-slate-400">المتبقي</span>
              <span className={`text-xl font-bold ${remaining > 0 ? 'text-red-400' : 'text-fuchsia-400'}`}>{remaining.toFixed(2)}</span>
            </div>

            <button type="submit" disabled={isSubmitting} className="mt-6 w-full py-3 rounded-xl bg-fuchsia-500 hover:bg-gradient-to-b from-fuchsia-600 to-purple-600 text-white font-bold transition-all disabled:opacity-50">
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ + كسب النقاط'}
            </button>
          </div>
        </div>
      </form>
      
      <style>{`.input-field { @apply w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-fuchsia-500 outline-none; }`}</style>
    </div>
  );
}