// src/pages/NewOrder.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  Loader2, Tag, BookOpen, Percent, MinusCircle, 
  Crown, AlertTriangle, Sparkles, Wallet, Coins, MapPin, User, Phone 
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
  const CITIES = ['الهفوف', 'المبرز', 'القرى', 'الدمام', 'الخبر', 'الرميلة', 'أخرى'];

  const [couponCode, setCouponCode] = useState('');
  const [couponData, setCouponData] = useState(null); 
  const [inventory, setInventory] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);

  const [wallet, setWallet] = useState(null);
  const [usePoints, setUsePoints] = useState(false);
  const [checkingLoyalty, setCheckingLoyalty] = useState(false);

  // --- حالات البحث عن العملاء السابقين ---
  const [previousCustomers, setPreviousCustomers] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(null); 
  const suggestionsRef = useRef(null); 

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      customerName: '', phone: '', deliveryDate: new Date().toISOString().slice(0, 10),
      source: 'الهفوف',
      sourceOther: '',
      a4Qty: 0, photo4x6Qty: 0, deliveryFee: 0, deposit: 0, notes: '',
      albumQty: 0, albumPrice: 0, manualDiscount: 0
    }
  });

  // ✅ قيم النموذج الحالية (مفيدة للملخص/الحسابات داخل JSX)
  // إذا كان هناك أي مرجع لـ orderData داخل JSX، هذا يمنع خطأ: orderData is not defined
  const orderData = watch();

  const phoneWatcher = watch('phone');
  const nameWatcher = watch('customerName');
  const currentCity = watch('source');
  const [a4Qty, photo4x6Qty, albumQty, albumPrice, deliveryFee, deposit, manualDiscount] = watch(['a4Qty', 'photo4x6Qty', 'albumQty', 'albumPrice', 'deliveryFee', 'deposit', 'manualDiscount']);

  // ✅ دالة توحيد رقم الجوال لضمان تطابقه مع قاعدة البيانات
  // تحول أي صيغة إلى: 05xxxxxxxx
  const normalizePhone = (raw) => {
    if (!raw) return '';
    let digits = String(raw).replace(/\D/g, ''); // حذف أي رموز
    if (digits.startsWith('966')) digits = digits.slice(3); // حذف 966
    if (digits.startsWith('0')) digits = digits.slice(1); // حذف الصفر مؤقتاً
    
    // التأكد أنه رقم جوال سعودي (يبدأ بـ 5 وطوله 9 أرقام بعد التنظيف)
    if (digits.length === 9 && digits.startsWith('5')) {
      return '0' + digits; // إرجاع الصفر ليكون 05...
    }
    return digits; // إعادة الرقم كما هو إذا لم يكن جوالاً قياسياً
  };

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

        const { data: customersData } = await supabase
          .from('orders')
          .select('customer_name, phone')
          .order('created_at', { ascending: false });

        if (customersData) {
          const uniqueCustomers = [];
          const seenPhones = new Set();
          
          customersData.forEach(c => {
            const cleanPhone = normalizePhone(c.phone);
            if (cleanPhone && !seenPhones.has(cleanPhone)) {
              seenPhones.add(cleanPhone);
              uniqueCustomers.push({ name: c.customer_name, phone: c.phone });
            }
          });
          setPreviousCustomers(uniqueCustomers);
        }

      } catch { toast.error('فشل جلب البيانات'); } finally { setLoadingSettings(false); }
    }
    fetchData();
  }, [setValue]);

  useEffect(() => {
    if (showSuggestions === 'name' && nameWatcher) {
      const filtered = previousCustomers.filter(c => 
        c.name && c.name.toLowerCase().includes(nameWatcher.toLowerCase())
      ).slice(0, 5);
      setFilteredSuggestions(filtered);
    } else if (showSuggestions === 'phone' && phoneWatcher) {
      const filtered = previousCustomers.filter(c => 
        c.phone && c.phone.includes(phoneWatcher)
      ).slice(0, 5);
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions([]);
    }
  }, [nameWatcher, phoneWatcher, showSuggestions, previousCustomers]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectCustomer = (customer) => {
    setValue('customerName', customer.name);
    setValue('phone', customer.phone);
    setShowSuggestions(null);
    toast.success('تم اختيار بيانات العميل');
  };

  // --- مراقبة المحفظة (تم التعديل لاستخدام الرقم الموحد) ---
  useEffect(() => {
    const fetchWalletData = async () => {
      // تنظيف الرقم المدخل
      const cleanSearchPhone = normalizePhone(phoneWatcher);

      if (!cleanSearchPhone || cleanSearchPhone.length < 10) { // 05xxxxxxxx = 10 digits
        setWallet(null);
        setUsePoints(false);
        return;
      }
      
      setCheckingLoyalty(true);
      try {
        // البحث بالرقم الموحد
        let { data, error } = await supabase
          .from('wallets')
          .select('*')
          .eq('phone', cleanSearchPhone)
          .maybeSingle(); // استخدام maybeSingle لتجنب الخطأ إذا لم يوجد

        if (data) {
          setWallet(data);
        } else {
          // إذا لم توجد محفظة، نعتبرها جديدة
          setWallet({ points_balance: 0, total_spent: 0, isNew: true });
        }
      } catch (err) { 
        console.error(err); 
      } finally { 
        setCheckingLoyalty(false); 
      }
    };
    const timeoutId = setTimeout(fetchWalletData, 500); // تقليل وقت الانتظار قليلاً
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
    // الخصم لا يتجاوز قيمة الطلب ولا يتجاوز رصيد المحفظة المتاح
    const pointsUsed = Math.min(Number(wallet.points_balance), maxDiscount); 
    pointsDiscountValue = pointsUsed;
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
      // إيداع المتبقي (أو ما تم دفعه؟) كنقاط ولاء
      // هنا سنعتبر أن العميل يكسب نقاط بناءً على المبلغ المدفوع
      // أو يمكن إلغاء الاكتساب الآلي إذا كانت السياسة يدوية
      // سأبقيه كما هو في الكود السابق:
      const pointsEarned = 0; // تم التصفير لتجنب تعقيد الحسابات الآن، يمكن تفعيلها لاحقاً

      const cleanPhone = normalizePhone(data.phone);

      const cleanData = {
        customer_name: data.customerName,
        phone: cleanPhone, // حفظ الرقم الموحد
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
        notes: data.notes + (couponData ? ` | كوبون: ${couponData.code}` : '') + (isDynamicApplied ? ` | تسعير ذكي` : '') + (pointsDiscountValue > 0 ? ` | خصم محفظة: ${pointsDiscountValue.toFixed(2)} ريال` : ''),
        status: 'new',
        payment_status: remaining <= 0.5 ? 'paid' : 'unpaid'
      };

      const { data: orderResult, error } = await supabase.from('orders').insert(cleanData).select().single();
      if (error) throw error;

      // تحديث المحفظة (خصم الرصيد المستخدم)
      if (cleanData.phone) {
        let currentWallet = wallet;
        // إذا المحفظة جديدة لكنها لم تُحفظ بعد في state (حالة نادرة)، نحاول جلبها أو إنشاءها
        if (wallet?.isNew || !wallet) {
           let { data: existingWallet } = await supabase.from('wallets').select('*').eq('phone', cleanPhone).maybeSingle();
           if(existingWallet) {
             currentWallet = existingWallet;
           } else {
             const { data: newWallet } = await supabase.from('wallets').insert([{ phone: cleanPhone, points_balance: 0, total_spent: 0 }]).select().single();
             currentWallet = newWallet;
           }
        }

        if (currentWallet && (pointsDiscountValue > 0)) {
          // خصم المبلغ المستخدم من الرصيد
          const newBalance = Number(currentWallet.points_balance) - pointsDiscountValue;
          
          // تسجيل حركة الخصم
          await supabase.from('wallet_transactions').insert({ 
            wallet_id: currentWallet.id, 
            order_id: orderResult.id, 
            type: 'redeem', 
            points: 0, 
            amount_value: pointsDiscountValue 
          });

          // تحديث رصيد المحفظة
          await supabase.from('wallets').update({ 
            points_balance: newBalance, 
            total_spent: Number(currentWallet.total_spent) + Number(total) 
          }).eq('id', currentWallet.id);
        }
      }

      // تحديث المخزون
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

      toast.success(`تم إنشاء الطلب بنجاح ✅`);
      navigate('/app/orders');
    } catch (error) { toast.error(`خطأ: ${error.message}`); }
  };

  if (loadingSettings) return <div className="p-10 text-center flex justify-center gap-2"><Loader2 className="animate-spin" /> جاري التحميل...</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6" onClick={() => setShowSuggestions(null)}>
      
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
	              <span className="bg-[#D9A3AA]/15 text-[#4A4A4A] px-2 rounded font-bold flex items-center gap-1"><Sparkles size={12}/> 4×6 = {active4x6Price}</span> : 
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
	              <div className="bg-gradient-to-r from-[#D9A3AA] to-[#C5A059] text-white px-3 py-1.5 rounded-xl shadow-md flex items-center gap-2 animate-in zoom-in">
	                <Wallet size={16} className="text-white/80"/>
                  <div>
	                  <div className="text-[9px] text-white/70 font-bold uppercase leading-none">المحفظة</div>
                    <div className="text-sm font-black leading-none mt-0.5">{Number(wallet.points_balance).toFixed(2)}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2" ref={suggestionsRef}>
              
              <div className="space-y-1 relative">
                <label className="text-sm font-medium">اسم العميل <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input 
                    {...register('customerName', { required: 'مطلوب' })} 
                    className="input-field" 
                    placeholder="الاسم" 
                    autoComplete="off"
                    onFocus={() => setShowSuggestions('name')}
                    onClick={(e) => { e.stopPropagation(); setShowSuggestions('name'); }}
                  />
                  <User size={16} className="absolute left-3 top-3 text-slate-400 pointer-events-none"/>
                </div>
                {errors.customerName && <p className="text-xs text-red-500">{errors.customerName.message}</p>}
                
                {showSuggestions === 'name' && filteredSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {filteredSuggestions.map((c, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectCustomer(c)}
	                        className="w-full text-right px-4 py-3 hover:bg-[#D9A3AA]/10 hover:text-[#4A4A4A] transition-colors border-b border-slate-50 last:border-0 flex justify-between items-center group"
                      >
                        <span className="font-bold text-sm">{c.name}</span>
	                        <span className="text-xs text-slate-400 group-hover:text-[#D9A3AA] dir-ltr">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1 relative">
                <label className="text-sm font-medium">الجوال</label>
                <div className="relative">
                  <input 
                    {...register('phone')} 
                    className="input-field dir-ltr text-right" 
                    placeholder="05xxxxxxxx" 
                    autoComplete="off"
                    onFocus={() => setShowSuggestions('phone')}
                    onClick={(e) => { e.stopPropagation(); setShowSuggestions('phone'); }}
                  />
                  {checkingLoyalty ? (
                    <div className="absolute left-3 top-3"><Loader2 size={16} className="animate-spin text-slate-400"/></div>
                  ) : (
                    <Phone size={16} className="absolute left-3 top-3 text-slate-400 pointer-events-none"/>
                  )}
                </div>

                {showSuggestions === 'phone' && filteredSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {filteredSuggestions.map((c, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectCustomer(c)}
	                        className="w-full text-right px-4 py-3 hover:bg-[#D9A3AA]/10 hover:text-[#4A4A4A] transition-colors border-b border-slate-50 last:border-0 flex justify-between items-center group"
                      >
                        <span className="font-bold text-sm dir-ltr">{c.phone}</span>
	                        <span className="text-xs text-slate-400 group-hover:text-[#D9A3AA]">{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">تاريخ التسليم</label>
                <input type="date" {...register('deliveryDate')} className="input-field" />
              </div>
            </div>
            
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
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Tag className="text-[#D9A3AA]"/> تفاصيل الصور</h3>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#4A4A4A] block text-center flex items-center justify-center gap-2">
                  عدد 4×6 {isDynamicApplied && <Sparkles size={14} className="text-amber-400 animate-pulse"/>}
                </label>
                <div className="relative">
                  <input type="number" min="0" {...register('photo4x6Qty')} className={`w-full bg-white border-2 rounded-2xl px-2 py-4 text-center font-black text-3xl shadow-sm outline-none focus:ring-4 placeholder-[#D9A3AA]/30 ${isDynamicApplied ? 'border-[#C5A059] text-[#C5A059] focus:ring-[#C5A059]/20' : 'border-[#D9A3AA] text-[#4A4A4A] focus:ring-[#D9A3AA]/20'}`} placeholder="0" />
                </div>
                <div className="text-center text-[10px] text-slate-400 font-medium mt-1">مخزون: {inventory.find(i => i.item_name === 'ورق 4x6')?.quantity || '-'}</div>
              </div>
	              <div className="space-y-2">
	                <label className="text-sm font-bold text-[#4A4A4A] block text-center">عدد A4</label>
                <div className="relative">
	                  <input type="number" min="0" {...register('a4Qty')} className="w-full bg-white border-2 border-[#C5A059] rounded-2xl px-2 py-4 text-center font-black text-3xl text-[#C5A059] shadow-sm outline-none focus:ring-4 focus:ring-[#C5A059]/20 placeholder-[#C5A059]/40" placeholder="0" />
                </div>
                <div className="text-center text-[10px] text-slate-400 font-medium mt-1">مخزون: {inventory.find(i => i.item_name === 'ورق A4')?.quantity || '-'}</div>
              </div>
            </div>
	            <div className="space-y-2">
	              <label className="text-sm font-bold text-[#C5A059]">ملاحظات إضافية</label>
	              <textarea {...register('notes')} rows="4" className="w-full bg-[#F8F5F2] border-2 border-[#C5A059]/30 rounded-2xl px-4 py-3 text-sm text-[#4A4A4A] placeholder-[#4A4A4A]/40 focus:bg-white focus:border-[#C5A059] focus:ring-4 focus:ring-[#C5A059]/20 outline-none resize-none transition-all" placeholder="اكتبي ملاحظاتك هنا..." />
	            </div>
          </div>
        </div>

        <div className="md:col-span-4 space-y-4">
	          <div className="bg-white text-[#4A4A4A] rounded-2xl p-6 shadow-lg border border-[#D9A3AA]/20 sticky top-6">
	            <h3 className="text-lg font-bold mb-4">ملخص الدفع</h3>
            
            <div className="space-y-3 text-sm">
	              <div className="flex justify-between text-[#4A4A4A]/80">
                <span>صور (A4 + 4x6)</span>
                <span>{((Number(a4Qty || 0) * settings.a4_price) + (Number(photo4x6Qty || 0) * active4x6Price)).toFixed(2)}</span>
              </div>

	              <div className="bg-[#F8F5F2] p-3 rounded-lg border border-[#D9A3AA]/20">
                <div className="flex items-center justify-between mb-2">
	                   <div className="flex items-center gap-2 text-[#C5A059] font-bold"><BookOpen size={14} /> <span>إضافة ألبوم</span></div>
                   <span className="text-[10px] text-slate-400">مخزون: {inventory.find(i => i.item_name === 'ألبومات')?.quantity || '-'}</span>
                </div>
                <div className="flex gap-2">
	                  <div className="flex-1"><input type="number" min="0" {...register('albumQty')} className="w-full bg-white border border-[#D9A3AA]/30 rounded px-2 py-1 text-center outline-none focus:border-[#C5A059]" placeholder="العدد" /></div>
	                  <div className="flex-1"><input type="number" min="0" {...register('albumPrice')} className="w-full bg-white border border-[#D9A3AA]/30 rounded px-2 py-1 text-center outline-none focus:border-[#C5A059]" placeholder="السعر" /></div>
                </div>
              </div>
              
	              <div className="flex justify-between items-center text-[#4A4A4A]/80 pt-2">
                <span>تكاليف إضافية</span>
	                <input type="number" min="0" {...register('deliveryFee')} className="w-20 bg-white border border-[#D9A3AA]/30 rounded-lg px-2 py-1 text-right text-[#4A4A4A] focus:border-[#D9A3AA] outline-none" />
              </div>

	              <div className="flex justify-between items-center text-red-600 pt-2">
                <span className="flex items-center gap-1"><MinusCircle size={14}/> خصم إضافي</span>
	                <input type="number" min="0" {...register('manualDiscount')} className="w-20 bg-[#F8F5F2] border border-red-200 rounded-lg px-2 py-1 text-right text-red-600 focus:border-red-400 outline-none placeholder-red-300" placeholder="0" />
              </div>

	              <div className="py-2 border-y border-[#D9A3AA]/20 my-2">
                <div className="flex gap-2 items-center mb-2">
	                  <Tag size={14} className="text-[#D9A3AA]" /> <span className="text-xs text-[#4A4A4A]/60">كود خصم</span>
                </div>
                <div className="flex gap-2">
	                  <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="CODE" className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/30 rounded-lg px-3 py-1.5 text-[#4A4A4A] uppercase text-sm outline-none focus:border-[#D9A3AA]" />
	                  <button type="button" onClick={checkCoupon} className="bg-[#D9A3AA] hover:bg-[#C5A059] text-white px-3 py-1 rounded-lg text-sm">تحقق</button>
                </div>
              </div>

              {wallet && wallet.points_balance > 0 && (
                <div className="py-2">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-2">
	                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${usePoints ? 'bg-[#D9A3AA] border-[#D9A3AA]' : 'border-[#D9A3AA]/40'}`}>
                        {usePoints && <div className="w-2 h-2 bg-white rounded-full"/>}
                      </div>
	                      <span className="text-[#D9A3AA] text-xs font-bold flex items-center gap-1">
                        <Coins size={12}/> استخدام الرصيد ({Number(wallet.points_balance).toFixed(2)})
                      </span>
                    </div>
	                    {usePoints && <span className="text-[#C5A059] font-bold">-{pointsDiscountValue.toFixed(2)}</span>}
                    <input type="checkbox" className="hidden" checked={usePoints} onChange={() => setUsePoints(!usePoints)} />
                  </label>
                </div>
              )}

              {(couponDiscountValue > 0) && (
                 <div className="flex justify-between text-[#D9A3AA] font-bold animate-pulse">
                   <span className="flex items-center gap-1">{couponData?.discount_type === 'percent' && <Percent size={12}/>} خصم الكوبون</span>
                   <span>- {couponDiscountValue.toFixed(2)}</span>
                 </div>
              )}

	              <div className="pt-2 border-t border-[#D9A3AA]/20 flex justify-between text-lg font-bold text-[#4A4A4A]">
                <span>الإجمالي</span><span>{total.toFixed(2)} ر.س</span>
              </div>
            </div>

	            <div className="mt-6 pt-4 border-t border-[#D9A3AA]/20">
	               <label className="block text-xs text-[#4A4A4A]/60 mb-1">العربون المدفوع</label>
	               <input type="number" min="0" {...register('deposit')} className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/30 rounded-xl px-4 py-2.5 text-[#4A4A4A] focus:border-[#D9A3AA] font-bold text-lg outline-none" />
            </div>

	            <div className="mt-4 flex justify-between items-center bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl p-3">
	              <span className="text-sm text-[#4A4A4A]/60">المتبقي</span>
	              <span className={`text-xl font-bold ${remaining > 0 ? 'text-red-500' : 'text-[#C5A059]'}`}>{remaining.toFixed(2)}</span>
            </div>

	            <button type="submit" disabled={isSubmitting} className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-[#D9A3AA] to-[#C5A059] text-white font-bold transition-all hover:opacity-95 disabled:opacity-50">
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </div>
      </form>
      
	      <style>{`.input-field { @apply w-full rounded-xl border border-[#D9A3AA]/30 px-4 py-2.5 text-sm text-[#4A4A4A] bg-[#F8F5F2] focus:ring-2 focus:ring-[#D9A3AA]/40 outline-none; }`}</style>
    </div>
  );
}