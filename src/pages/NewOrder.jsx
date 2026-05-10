// src/pages/NewOrder.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import {
  Loader2, Tag, BookOpen, Percent, MinusCircle,
  Crown, AlertTriangle, Sparkles, Wallet, Coins, MapPin, User, Phone, Package
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
  const [walletId, setWalletId] = useState(null);
  const [packageBalance, setPackageBalance] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [usePackage, setUsePackage] = useState(false);
  const [packageAmountInput, setPackageAmountInput] = useState(''); // مبلغ جزئي من الباقات
  const [pointsAmountInput, setPointsAmountInput] = useState('');   // مبلغ جزئي من النقاط
  const [checkingLoyalty, setCheckingLoyalty] = useState(false);

  const [previousCustomers, setPreviousCustomers] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(null);
  const suggestionsRef = useRef(null);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      customerName: '', phone: '', deliveryDate: new Date().toISOString().slice(0, 10),
      source: 'الهفوف', sourceOther: '',
      a4Qty: 0, photo4x6Qty: 0, deliveryFee: 0, deposit: 0, notes: '',
      albumQty: 0, albumPrice: 0, manualDiscount: 0
    }
  });

  const orderData = watch();
  const phoneWatcher = watch('phone');
  const nameWatcher = watch('customerName');
  const currentCity = watch('source');
  const [a4Qty, photo4x6Qty, albumQty, albumPrice, deliveryFee, deposit, manualDiscount] = watch([
    'a4Qty', 'photo4x6Qty', 'albumQty', 'albumPrice', 'deliveryFee', 'deposit', 'manualDiscount'
  ]);

  const normalizePhone = (raw) => {
    if (!raw) return '';
    let digits = String(raw).replace(/\D/g, '');
    if (digits.startsWith('966')) digits = digits.slice(3);
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length === 9 && digits.startsWith('5')) return '0' + digits;
    return digits;
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 1).single();
        if (settingsData) { setSettings(settingsData); setValue('deliveryFee', settingsData.delivery_fee_default); }

        const { data: invData } = await supabase.from('inventory').select('*');
        if (invData) { setInventory(invData); setLowStockItems(invData.filter(item => item.quantity <= item.threshold)); }

        const { data: customersData } = await supabase.from('orders').select('customer_name, phone').order('created_at', { ascending: false });
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
      setFilteredSuggestions(previousCustomers.filter(c => c.name?.toLowerCase().includes(nameWatcher.toLowerCase())).slice(0, 5));
    } else if (showSuggestions === 'phone' && phoneWatcher) {
      setFilteredSuggestions(previousCustomers.filter(c => c.phone?.includes(phoneWatcher)).slice(0, 5));
    } else {
      setFilteredSuggestions([]);
    }
  }, [nameWatcher, phoneWatcher, showSuggestions, previousCustomers]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) setShowSuggestions(null);
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

  // جلب بيانات المحفظة ورصيد الباقات عند تغيير رقم الجوال
  useEffect(() => {
    const fetchWalletData = async () => {
      const rawPhone = phoneWatcher || '';
      const digits = rawPhone.replace(/\D/g, '');
      // نبني كل الأشكال الممكنة للرقم للبحث في قاعدة البيانات
      let stripped = digits;
      if (stripped.startsWith('966')) stripped = stripped.slice(3);
      if (stripped.startsWith('0')) stripped = stripped.slice(1);
      // stripped = 9 أرقام بدون 0  |  withZero = 10 أرقام بـ 05
      const withZero = stripped.length === 9 ? '0' + stripped : stripped;

      if (stripped.length < 9) {
        setWallet(null); setWalletId(null); setPackageBalance(0);
        setUsePoints(false); setUsePackage(false);
        return;
      }

      setCheckingLoyalty(true);
      try {
        // نبحث بكل الأشكال الممكنة للرقم
        const { data: allWallets } = await supabase
          .from('wallets')
          .select('*')
          .in('phone', [withZero, stripped, '966' + stripped, '+966' + stripped,
            '+966' + withZero, '00966' + stripped]);

        // نجمع كل المحافظ المطابقة
        const data = allWallets && allWallets.length > 0 ? allWallets[0] : null;
        const allWalletIds = (allWallets || []).map(w => w.id);

        if (data) {
          setWallet(data);
          setWalletId(data.id);

          // حساب رصيد الباقات من كل المحافظ المطابقة
          const { data: pkgTx } = await supabase
            .from('wallet_transactions')
            .select('type, points, amount_value')
            .in('wallet_id', allWalletIds.length > 0 ? allWalletIds : [data.id])
            .in('type', ['package_charge', 'package_redeem']);

          let pkgBalance = 0;
          (pkgTx || []).forEach(tx => {
            if (tx.type === 'package_charge') pkgBalance += Number(tx.points || 0);
            if (tx.type === 'package_redeem') pkgBalance -= Number(tx.amount_value || 0);
          });
          setPackageBalance(Math.max(0, pkgBalance));
        } else {
          // عميل جديد: لا محفظة، لكن ممكن يكون له رصيد باقات تم شحنه من Orders
          // نبحث في wallet_transactions عبر الـ wallet الذي قد يكون أُنشئ بشكل مختلف
          setWallet({ points_balance: 0, total_spent: 0, isNew: true });
          setWalletId(null);
          setPackageBalance(0);
        }
      } catch (err) {
        console.error('wallet fetch error:', err);
      } finally {
        setCheckingLoyalty(false);
      }
    };
    const timeoutId = setTimeout(fetchWalletData, 500);
    return () => clearTimeout(timeoutId);
  }, [phoneWatcher]);

  // عند تفعيل أحد الخيارين، يُلغى الآخر تلقائياً
  const toggleUsePoints = () => {
    const next = !usePoints;
    setUsePoints(next);
    setUsePackage(false);
    if (next && wallet?.points_balance > 0) setPointsAmountInput(Math.min(Number(wallet.points_balance), Math.max(0, baseAfterCoupon)).toFixed(2));
    else setPointsAmountInput('');
  };
  const toggleUsePackage = () => {
    const next = !usePackage;
    setUsePackage(next);
    setUsePoints(false);
    if (next && packageBalance > 0) setPackageAmountInput(Math.min(packageBalance, Math.max(0, baseAfterCoupon)).toFixed(2));
    else setPackageAmountInput('');
  };

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

  const subtotal = (Number(a4Qty || 0) * settings.a4_price)
    + (Number(photo4x6Qty || 0) * active4x6Price)
    + (Number(albumQty || 0) * Number(albumPrice || 0));

  let couponDiscountValue = 0;
  if (couponData) {
    couponDiscountValue = couponData.discount_type === 'percent'
      ? subtotal * (couponData.discount_amount / 100)
      : Number(couponData.discount_amount);
  }

  const baseAfterCoupon = subtotal + Number(deliveryFee || 0) - couponDiscountValue - Number(manualDiscount || 0);

  // حساب الخصم من النقاط (يأخذ المبلغ المُدخل أو الحد الأقصى)
  let pointsDiscountValue = 0;
  if (usePoints && wallet && wallet.points_balance > 0) {
    const inputVal = Number(pointsAmountInput) || 0;
    const maxPoints = Math.min(Number(wallet.points_balance), Math.max(0, baseAfterCoupon));
    pointsDiscountValue = inputVal > 0 ? Math.min(inputVal, maxPoints) : maxPoints;
  }

  // حساب الخصم من الباقات (يأخذ المبلغ المُدخل أو الحد الأقصى)
  let packageDiscountValue = 0;
  if (usePackage && packageBalance > 0) {
    const inputVal = Number(packageAmountInput) || 0;
    const maxPkg = Math.min(packageBalance, Math.max(0, baseAfterCoupon));
    packageDiscountValue = inputVal > 0 ? Math.min(inputVal, maxPkg) : maxPkg;
  }

  const total = Math.max(0, baseAfterCoupon - pointsDiscountValue - packageDiscountValue);
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
      const cleanPhone = normalizePhone(data.phone);

      const cleanData = {
        customer_name: data.customerName,
        phone: cleanPhone,
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
        wallet_used: pointsDiscountValue + packageDiscountValue, // إجمالي المبلغ المستخدم من المحفظة
        notes: data.notes
          + (couponData ? ` | كوبون: ${couponData.code}` : '')
          + (isDynamicApplied ? ` | تسعير ذكي` : '')
          + (pointsDiscountValue > 0 ? ` | خصم نقاط: ${pointsDiscountValue.toFixed(2)} ريال` : '')
          + (packageDiscountValue > 0 ? ` | خصم باقات: ${packageDiscountValue.toFixed(2)} ريال` : ''),
        status: 'new',
        payment_status: remaining <= 0.5 ? 'paid' : 'unpaid'
      };

      const { data: orderResult, error } = await supabase.from('orders').insert(cleanData).select().single();
      if (error) throw error;

      // تحديث المحفظة
      if (cleanPhone && (pointsDiscountValue > 0 || packageDiscountValue > 0)) {
        let currentWallet = wallet;
        let currentWalletId = walletId;

        if (wallet?.isNew || !wallet) {
          // نبحث بكل أشكال الرقم
          let cleanDigits = cleanPhone.replace(/\D/g, '');
          if (cleanDigits.startsWith('966')) cleanDigits = cleanDigits.slice(3);
          if (cleanDigits.startsWith('0')) cleanDigits = cleanDigits.slice(1);
          const cleanWithZero = cleanDigits.length === 9 ? '0' + cleanDigits : cleanDigits;

          const { data: foundWallets } = await supabase.from('wallets').select('*')
            .in('phone', [cleanWithZero, cleanDigits, '966' + cleanDigits, '+966' + cleanDigits]);

          if (foundWallets && foundWallets.length > 0) {
            currentWallet = foundWallets[0];
            currentWalletId = foundWallets[0].id;
          } else {
            const { data: newWallet } = await supabase.from('wallets')
              .insert([{ phone: cleanWithZero, points_balance: 0, total_spent: 0 }]).select().single();
            currentWallet = newWallet;
            currentWalletId = newWallet?.id;
          }
        }

        if (currentWallet && currentWalletId) {
          // خصم رصيد النقاط
          if (pointsDiscountValue > 0) {
            const newPointsBalance = Number(currentWallet.points_balance) - pointsDiscountValue;
            await supabase.from('wallet_transactions').insert({
              wallet_id: currentWalletId, order_id: orderResult.id,
              type: 'redeem', points: 0, amount_value: pointsDiscountValue
            });
            await supabase.from('wallets').update({
              points_balance: newPointsBalance,
              total_spent: Number(currentWallet.total_spent) + Number(total)
            }).eq('id', currentWalletId);
          }

          // خصم رصيد الباقات (يُسجّل كـ package_redeem)
          if (packageDiscountValue > 0) {
            await supabase.from('wallet_transactions').insert({
              wallet_id: currentWalletId, order_id: orderResult.id,
              type: 'package_redeem', points: 0, amount_value: packageDiscountValue
            });
            // لا نغيّر points_balance عند خصم الباقات
          }
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
              <span className="bg-[#D9A3AA]/15 text-[#4A4A4A] px-2 rounded font-bold flex items-center gap-1"><Sparkles size={12} /> 4×6 = {active4x6Price}</span> :
              <span className="bg-slate-100 px-2 rounded">4×6 = {settings.photo_4x6_price}</span>
            }
          </p>
        </div>
        <button type="button" onClick={() => navigate('/app/orders')} className="px-4 py-2 bg-white border rounded-xl hover:bg-slate-50">إلغاء</button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-8 space-y-6">

          {/* بيانات العميل */}
          <div className="bg-white rounded-2xl border p-6 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-bold text-slate-800">بيانات العميل</h3>
              {/* بادجات الأرصدة - تظهر حتى للعميل الجديد إذا كان له رصيد */}
              {wallet && (packageBalance > 0 || (wallet.points_balance > 0 && !wallet.isNew)) && (
                <div className="flex items-center gap-2 flex-wrap">
                  {!wallet.isNew && wallet.points_balance > 0 && (
                    <div className="bg-gradient-to-r from-violet-500 to-violet-400 text-white px-3 py-1.5 rounded-xl shadow-md flex items-center gap-2 animate-in zoom-in">
                      <Coins size={14} className="text-white/80" />
                      <div>
                        <div className="text-[9px] text-white/70 font-bold uppercase leading-none">النقاط</div>
                        <div className="text-sm font-black leading-none mt-0.5">{Number(wallet.points_balance).toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                  {packageBalance > 0 && (
                    <div className="bg-gradient-to-r from-amber-500 to-amber-400 text-white px-3 py-1.5 rounded-xl shadow-md flex items-center gap-2 animate-in zoom-in">
                      <Package size={14} className="text-white/80" />
                      <div>
                        <div className="text-[9px] text-white/70 font-bold uppercase leading-none">الباقات</div>
                        <div className="text-sm font-black leading-none mt-0.5">{packageBalance.toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2" ref={suggestionsRef}>
              <div className="space-y-1 relative">
                <label className="text-sm font-medium">اسم العميل <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    {...register('customerName', { required: 'مطلوب' })}
                    className="input-field" placeholder="الاسم" autoComplete="off"
                    onFocus={() => setShowSuggestions('name')}
                    onClick={(e) => { e.stopPropagation(); setShowSuggestions('name'); }}
                  />
                  <User size={16} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                </div>
                {errors.customerName && <p className="text-xs text-red-500">{errors.customerName.message}</p>}
                {showSuggestions === 'name' && filteredSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {filteredSuggestions.map((c, idx) => (
                      <button key={idx} type="button" onClick={() => selectCustomer(c)}
                        className="w-full text-right px-4 py-3 hover:bg-[#D9A3AA]/10 transition-colors border-b border-slate-50 last:border-0 flex justify-between items-center group">
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
                    className="input-field dir-ltr text-right" placeholder="05xxxxxxxx" autoComplete="off"
                    onFocus={() => setShowSuggestions('phone')}
                    onClick={(e) => { e.stopPropagation(); setShowSuggestions('phone'); }}
                  />
                  {checkingLoyalty ? (
                    <div className="absolute left-3 top-3"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
                  ) : (
                    <Phone size={16} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                  )}
                </div>
                {showSuggestions === 'phone' && filteredSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {filteredSuggestions.map((c, idx) => (
                      <button key={idx} type="button" onClick={() => selectCustomer(c)}
                        className="w-full text-right px-4 py-3 hover:bg-[#D9A3AA]/10 transition-colors border-b border-slate-50 last:border-0 flex justify-between items-center group">
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
                <MapPin size={16} className="text-red-500" /> المنطقة / المدينة
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {CITIES.map((city) => (
                  <button key={city} type="button" onClick={() => setValue('source', city)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${currentCity === city ? 'bg-red-50 border-red-500 text-red-700 font-bold' : 'bg-white text-slate-600'}`}>
                    {city}
                  </button>
                ))}
              </div>
              {currentCity === 'أخرى' && (
                <input {...register('sourceOther')} className="input-field mt-2" placeholder="اكتب اسم المنطقة..." />
              )}
            </div>
          </div>

          {/* تفاصيل الصور */}
          <div className="bg-white rounded-2xl border p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Tag className="text-[#D9A3AA]" /> تفاصيل الصور</h3>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#4A4A4A] block text-center flex items-center justify-center gap-2">
                  عدد 4×6 {isDynamicApplied && <Sparkles size={14} className="text-amber-400 animate-pulse" />}
                </label>
                <input type="number" min="0" {...register('photo4x6Qty')}
                  className={`w-full bg-white border-2 rounded-2xl px-2 py-4 text-center font-black text-3xl shadow-sm outline-none focus:ring-4 placeholder-[#D9A3AA]/30 ${isDynamicApplied ? 'border-[#C5A059] text-[#C5A059] focus:ring-[#C5A059]/20' : 'border-[#D9A3AA] text-[#4A4A4A] focus:ring-[#D9A3AA]/20'}`}
                  placeholder="0" />
                <div className="text-center text-[10px] text-slate-400 font-medium mt-1">مخزون: {inventory.find(i => i.item_name === 'ورق 4x6')?.quantity || '-'}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#4A4A4A] block text-center">عدد A4</label>
                <input type="number" min="0" {...register('a4Qty')}
                  className="w-full bg-white border-2 border-[#C5A059] rounded-2xl px-2 py-4 text-center font-black text-3xl text-[#C5A059] shadow-sm outline-none focus:ring-4 focus:ring-[#C5A059]/20 placeholder-[#C5A059]/40"
                  placeholder="0" />
                <div className="text-center text-[10px] text-slate-400 font-medium mt-1">مخزون: {inventory.find(i => i.item_name === 'ورق A4')?.quantity || '-'}</div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#C5A059]">ملاحظات إضافية</label>
              <textarea {...register('notes')} rows="4"
                className="w-full bg-[#F8F5F2] border-2 border-[#C5A059]/30 rounded-2xl px-4 py-3 text-sm text-[#4A4A4A] placeholder-[#4A4A4A]/40 focus:bg-white focus:border-[#C5A059] focus:ring-4 focus:ring-[#C5A059]/20 outline-none resize-none transition-all"
                placeholder="اكتبي ملاحظاتك هنا..." />
            </div>
          </div>
        </div>

        {/* ملخص الدفع */}
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
                <span className="flex items-center gap-1"><MinusCircle size={14} /> خصم إضافي</span>
                <input type="number" min="0" {...register('manualDiscount')} className="w-20 bg-[#F8F5F2] border border-red-200 rounded-lg px-2 py-1 text-right text-red-600 focus:border-red-400 outline-none placeholder-red-300" placeholder="0" />
              </div>

              {/* كوبون */}
              <div className="py-2 border-y border-[#D9A3AA]/20 my-2">
                <div className="flex gap-2 items-center mb-2">
                  <Tag size={14} className="text-[#D9A3AA]" /> <span className="text-xs text-[#4A4A4A]/60">كود خصم</span>
                </div>
                <div className="flex gap-2">
                  <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="CODE"
                    className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/30 rounded-lg px-3 py-1.5 text-[#4A4A4A] uppercase text-sm outline-none focus:border-[#D9A3AA]" />
                  <button type="button" onClick={checkCoupon} className="bg-[#D9A3AA] hover:bg-[#C5A059] text-white px-3 py-1 rounded-lg text-sm">تحقق</button>
                </div>
              </div>

              {/* خيار رصيد الباقات */}
              {packageBalance > 0 && (
                <div className={`rounded-xl border transition-all overflow-hidden ${usePackage ? 'border-amber-300' : 'border-[#D9A3AA]/20'}`}>
                  {/* رأس الخيار */}
                  <button type="button" onClick={toggleUsePackage}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-right transition-colors ${usePackage ? 'bg-amber-50' : 'bg-[#F8F5F2] hover:bg-amber-50/50'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${usePackage ? 'bg-amber-500 border-amber-500' : 'border-amber-300'}`}>
                        {usePackage && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                          <Package size={11} /> خصم من رصيد الباقات
                        </span>
                        <span className="text-[10px] text-amber-600/70 block">المتاح: {packageBalance.toFixed(2)} ﷼</span>
                      </div>
                    </div>
                    {usePackage && (
                      <span className="text-amber-700 font-black text-sm bg-amber-100 px-2 py-0.5 rounded-lg">
                        -{packageDiscountValue.toFixed(2)} ﷼
                      </span>
                    )}
                  </button>
                  {/* حقل المبلغ الجزئي */}
                  {usePackage && (
                    <div className="bg-amber-50/50 border-t border-amber-200/50 px-3 py-2 flex items-center gap-3">
                      <span className="text-[11px] text-amber-700 shrink-0">المبلغ:</span>
                      <input
                        type="number" min="0.01" max={packageBalance} step="0.01"
                        value={packageAmountInput}
                        onChange={e => setPackageAmountInput(e.target.value)}
                        className="flex-1 text-center border border-amber-300 rounded-lg px-2 py-1.5 text-sm font-bold text-amber-700 bg-white outline-none focus:ring-2 ring-amber-300/40"
                      />
                      <button type="button" onClick={() => setPackageAmountInput(Math.min(packageBalance, Math.max(0, baseAfterCoupon)).toFixed(2))}
                        className="text-[10px] text-amber-600 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-lg shrink-0 transition-colors">
                        الكل
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* خيار رصيد النقاط */}
              {wallet && !wallet.isNew && wallet.points_balance > 0 && (
                <div className={`rounded-xl border transition-all overflow-hidden ${usePoints ? 'border-violet-300' : 'border-[#D9A3AA]/20'}`}>
                  <button type="button" onClick={toggleUsePoints}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-right transition-colors ${usePoints ? 'bg-violet-50' : 'bg-[#F8F5F2] hover:bg-violet-50/50'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${usePoints ? 'bg-violet-500 border-violet-500' : 'border-violet-300'}`}>
                        {usePoints && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-violet-800 flex items-center gap-1">
                          <Coins size={11} /> خصم من رصيد النقاط
                        </span>
                        <span className="text-[10px] text-violet-600/70 block">المتاح: {Number(wallet.points_balance).toFixed(2)} ﷼</span>
                      </div>
                    </div>
                    {usePoints && (
                      <span className="text-violet-700 font-black text-sm bg-violet-100 px-2 py-0.5 rounded-lg">
                        -{pointsDiscountValue.toFixed(2)} ﷼
                      </span>
                    )}
                  </button>
                  {usePoints && (
                    <div className="bg-violet-50/50 border-t border-violet-200/50 px-3 py-2 flex items-center gap-3">
                      <span className="text-[11px] text-violet-700 shrink-0">المبلغ:</span>
                      <input
                        type="number" min="0.01" max={wallet.points_balance} step="0.01"
                        value={pointsAmountInput}
                        onChange={e => setPointsAmountInput(e.target.value)}
                        className="flex-1 text-center border border-violet-300 rounded-lg px-2 py-1.5 text-sm font-bold text-violet-700 bg-white outline-none focus:ring-2 ring-violet-300/40"
                      />
                      <button type="button" onClick={() => setPointsAmountInput(Math.min(Number(wallet.points_balance), Math.max(0, baseAfterCoupon)).toFixed(2))}
                        className="text-[10px] text-violet-600 bg-violet-100 hover:bg-violet-200 px-2 py-1 rounded-lg shrink-0 transition-colors">
                        الكل
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* خصم الكوبون */}
              {couponDiscountValue > 0 && (
                <div className="flex justify-between text-[#D9A3AA] font-bold animate-pulse">
                  <span className="flex items-center gap-1">{couponData?.discount_type === 'percent' && <Percent size={12} />} خصم الكوبون</span>
                  <span>- {couponDiscountValue.toFixed(2)}</span>
                </div>
              )}

              <div className="pt-2 border-t border-[#D9A3AA]/20 flex justify-between text-lg font-bold text-[#4A4A4A]">
                <span>الإجمالي</span><span>{total.toFixed(2)} ﷼</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#D9A3AA]/20">
              <label className="block text-xs text-[#4A4A4A]/60 mb-1">العربون المدفوع</label>
              <input type="number" min="0" {...register('deposit')}
                className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/30 rounded-xl px-4 py-2.5 text-[#4A4A4A] focus:border-[#D9A3AA] font-bold text-lg outline-none" />
            </div>

            <div className="mt-4 flex justify-between items-center bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl p-3">
              <span className="text-sm text-[#4A4A4A]/60">المتبقي</span>
              <span className={`text-xl font-bold ${remaining > 0 ? 'text-red-500' : 'text-[#C5A059]'}`}>{remaining.toFixed(2)}</span>
            </div>

            <button type="submit" disabled={isSubmitting}
              className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-[#D9A3AA] to-[#C5A059] text-white font-bold transition-all hover:opacity-95 disabled:opacity-50">
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </div>
      </form>

      <style>{`.input-field { @apply w-full rounded-xl border border-[#D9A3AA]/30 px-4 py-2.5 text-sm text-[#4A4A4A] bg-[#F8F5F2] focus:ring-2 focus:ring-[#D9A3AA]/40 outline-none; }`}</style>
    </div>
  );
}
