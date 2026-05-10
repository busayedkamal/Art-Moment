// src/pages/OrderDetails.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import {
  ArrowRight, Printer, CheckCircle, Truck, Trash2,
  Banknote, FileText, User,
  MessageCircle, X, Tag, MapPin, Receipt, StickyNote, Plus, Wallet, Gift, Package
} from 'lucide-react';
import logo from '../assets/logo-art-moment.svg';

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [appSettings, setAppSettings] = useState(null);
  const [prices, setPrices] = useState({ a4: 0, photo4x6: 0 });

  // --- إعدادات نقاط الولاء ---
  const LOYALTY_RATES = {
    photo4x6: 0.05,
    a4: 1.00,
    album: 1.00
  };

  const CITIES = ['الرميلة', 'المبرز', 'الهفوف', 'الدمام', 'الخبر', 'العمران', 'أخرى'];

  const [payments, setPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const [newPayment, setNewPayment] = useState({ amount: '', date: new Date().toISOString().split('T')[0] });
  const [walletUsed, setWalletUsed] = useState(0);

  const [manualDiscount, setManualDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [isEditingDelivery, setIsEditingDelivery] = useState(false);

  // مصدر الخصم ومبالغ منفصلة لكل نظام
  const [discountSource, setDiscountSource] = useState('discount'); // 'discount' | 'wallet' | 'package'
  const [customerPackageBalance, setCustomerPackageBalance] = useState(0);
  const [packageDiscountInput, setPackageDiscountInput] = useState('');   // مبلغ الخصم من الباقات
  const [pointsDiscountInput, setPointsDiscountInput] = useState('');     // مبلغ الخصم من النقاط
  const [customerPointsBalance, setCustomerPointsBalance] = useState(0); // رصيد نقاط العميل

  const [notes, setNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');

  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [customerData, setCustomerData] = useState({
    customer_name: '', phone: '', delivery_date: '', created_at: '', source: '', source_other: ''
  });

  const [isEditingProduction, setIsEditingProduction] = useState(false);
  const [productionData, setProductionData] = useState({
    a4_qty: 0, photo_4x6_qty: 0, album_qty: 0, album_price: 0
  });

  // لمنع تكرار ضغط زر التحويل
  const [isConvertingExcess, setIsConvertingExcess] = useState(false);

  useEffect(() => {
    fetchOrderAndSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ✅ توحيد رقم الجوال
  const normalizePhone = (raw = '') => {
    let digits = String(raw).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('966') && digits.length >= 12) digits = '0' + digits.slice(3);
    if (digits.startsWith('5') && digits.length === 9) digits = '0' + digits;
    return digits;
  };

  // ✅ يجلب كل المحافظ المطابقة لكل أشكال الرقم
  const findAllWalletsByPhone = async (rawPhone) => {
    let digits = String(rawPhone || '').replace(/\D/g, '');
    if (digits.startsWith('966')) digits = digits.slice(3);
    if (digits.startsWith('0')) digits = digits.slice(1);
    const withZero = digits.length === 9 ? '0' + digits : digits;
    const allFormats = [withZero, digits, '966' + digits, '+966' + digits, '00966' + digits];
    const { data } = await supabase.from('wallets').select('*').in('phone', allFormats);
    return data || [];
  };

  // ✅ يُرجع أول محفظة (للاستخدام في عمليات النقاط التي تحتاج wallet واحدة)
  const findWalletByPhone = async (rawPhone) => {
    const wallets = await findAllWalletsByPhone(rawPhone);
    return wallets.length > 0 ? wallets[0] : null;
  };

  async function fetchOrderAndSettings() {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();
      if (orderError) throw orderError;

      const { data: paymentsData } = await supabase
        .from('order_payments')
        .select('*')
        .eq('order_id', id)
        .order('payment_date', { ascending: true });

      const { data: transData } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('order_id', id);

      const { data: settingsData } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single();

      setOrder(orderData);
      setPayments(paymentsData || []);
      setTransactions(transData || []);

      // تحديد مصدر الخصم الحالي
      const hasWalletSpend = (transData || []).some(t => t.type === 'wallet_spend');
      const hasPkgRedeem = (transData || []).some(t => t.type === 'package_redeem');
      setDiscountSource(hasPkgRedeem ? 'package' : hasWalletSpend ? 'wallet' : 'discount');

      // جلب رصيد الباقات والنقاط للعميل — نجمع من كل المحافظ المطابقة
      if (orderData.phone) {
        const allWallets = await findAllWalletsByPhone(orderData.phone);
        const allWalletIds = allWallets.map(w => w.id);

        // رصيد النقاط = مجموع points_balance من كل المحافظ
        const totalPoints = allWallets.reduce((sum, w) => sum + Number(w.points_balance || 0), 0);
        setCustomerPointsBalance(totalPoints);

        // رصيد الباقات = من wallet_transactions لكل المحافظ
        if (allWalletIds.length > 0) {
          const { data: pkgTx } = await supabase
            .from('wallet_transactions')
            .select('type, points, amount_value')
            .in('wallet_id', allWalletIds)
            .in('type', ['package_charge', 'package_redeem']);
          let pkgBal = 0;
          (pkgTx || []).forEach(tx => {
            if (tx.type === 'package_charge') pkgBal += Number(tx.points || 0);
            if (tx.type === 'package_redeem') pkgBal -= Number(tx.amount_value || 0);
          });
          setCustomerPackageBalance(Math.max(0, pkgBal));
        }

          // تعيين المبالغ الأولية من الحركات الموجودة على هذا الطلب
          const existPkg = (transData || []).find(t => t.type === 'package_redeem');
          const existPts = (transData || []).find(t => t.type === 'wallet_spend');
          if (existPkg) setPackageDiscountInput(existPkg.amount_value?.toString() || '');
          if (existPts) setPointsDiscountInput(existPts.amount_value?.toString() || '');
      }

      setManualDiscount(Number(orderData.manual_discount || 0));
      setDeliveryFee(Number(orderData.delivery_fee || 0));
      setNotes(orderData.notes || '');
      setWalletUsed(Number(orderData.wallet_used || 0));

      if (settingsData) {
        setAppSettings(settingsData);
        setPrices({
          a4: Number(settingsData.a4_price || 0),
          photo4x6: Number(settingsData.photo_4x6_price || 0)
        });
      }

      setCustomerData({
        customer_name: orderData.customer_name || '',
        phone: orderData.phone || '',
        delivery_date: orderData.delivery_date || '',
        created_at: orderData.created_at ? new Date(orderData.created_at).toISOString().slice(0, 10) : '',
        source: orderData.source || '',
        source_other: orderData.source_other || ''
      });

      setProductionData({
        a4_qty: orderData.a4_qty || 0,
        photo_4x6_qty: orderData.photo_4x6_qty || 0,
        album_qty: orderData.album_qty || 0,
        album_price: orderData.album_price || 0
      });

    } catch (err) {
      console.error(err);
      toast.error('لم يتم العثور على الطلب');
      navigate('/app/orders');
    } finally {
      setLoading(false);
    }
  }

  const calculateLoyaltyReward = () => {
    if (!order) return 0;
    const reward4x6 = (order.photo_4x6_qty || 0) * LOYALTY_RATES.photo4x6;
    const rewardA4 = (order.a4_qty || 0) * LOYALTY_RATES.a4;
    const rewardAlbum = (order.album_qty || 0) * LOYALTY_RATES.album;
    return reward4x6 + rewardA4 + rewardAlbum;
  };

  const isLoyaltyAdded = transactions.some(t => t.type === 'loyalty_earn');

  // ✅ مزامنة خصم المحفظة (wallet_spend) مع رصيد العميل — فرق التغيير فقط
  const syncWalletSpend = async (desiredAmount) => {
    const wallet = await findWalletByPhone(order?.phone);
    if (!wallet) throw new Error('لا توجد محفظة لهذا العميل');

    const { data: existingSpend, error: spendError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('order_id', id)
      .eq('type', 'wallet_spend')
      .maybeSingle();

    if (spendError) throw spendError;

    const prevAmount = existingSpend ? Number(existingSpend.amount_value || 0) : 0;
    const desired = Math.max(0, Number(desiredAmount || 0));
    const delta = desired - prevAmount; 

    const currentBalance = Number(wallet.points_balance || 0);

    if (delta > 0 && currentBalance + 1e-9 < delta) {
      throw new Error(`رصيد المحفظة غير كافٍ. المتاح: ${currentBalance.toFixed(2)}`);
    }

    if (Math.abs(delta) > 1e-9) {
      const newBalance = currentBalance - delta;
      const { error: updWalletErr } = await supabase
        .from('wallets')
        .update({ points_balance: newBalance })
        .eq('id', wallet.id);
      if (updWalletErr) throw updWalletErr;
    }

    if (desired <= 1e-9) {
      if (existingSpend) {
        const { error: delErr } = await supabase
          .from('wallet_transactions')
          .delete()
          .eq('id', existingSpend.id);

        if (delErr) throw delErr;
        setTransactions(prev => prev.filter(t => t.id !== existingSpend.id));
      }
      return;
    }

    if (existingSpend) {
      const { data: updated, error: updErr } = await supabase
        .from('wallet_transactions')
        .update({ amount_value: desired, created_at: new Date().toISOString() })
        .eq('id', existingSpend.id)
        .select()
        .single();

      if (updErr) throw updErr;
      setTransactions(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      return;
    }

    const { data: created, error: insErr } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        order_id: id,
        type: 'wallet_spend',
        points: 0,
        amount_value: desired,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insErr) throw insErr;
    setTransactions(prev => [...prev, created]);
  };

  // ✅ مزامنة خصم رصيد الباقات (package_redeem)
  const syncPackageSpend = async (desiredAmount) => {
    // نجلب كل المحافظ ونختار التي تحتوي رصيد الباقات
    const allWallets = await findAllWalletsByPhone(order?.phone);
    if (allWallets.length === 0) throw new Error('لا توجد محفظة لهذا العميل');

    const allWalletIds = allWallets.map(w => w.id);

    // نجلب حركات الباقات من كل المحافظ لنعرف أين الرصيد
    const { data: allPkgTx } = await supabase
      .from('wallet_transactions')
      .select('wallet_id, type, points, amount_value')
      .in('wallet_id', allWalletIds)
      .in('type', ['package_charge', 'package_redeem']);

    // نحسب رصيد كل محفظة
    const balanceByWallet = {};
    allWallets.forEach(w => { balanceByWallet[w.id] = 0; });
    (allPkgTx || []).forEach(tx => {
      if (tx.type === 'package_charge') balanceByWallet[tx.wallet_id] = (balanceByWallet[tx.wallet_id] || 0) + Number(tx.points || 0);
      if (tx.type === 'package_redeem') balanceByWallet[tx.wallet_id] = (balanceByWallet[tx.wallet_id] || 0) - Number(tx.amount_value || 0);
    });

    // نختار المحفظة التي تحتوي أعلى رصيد باقات
    const wallet = allWallets.reduce((best, w) =>
      (balanceByWallet[w.id] || 0) > (balanceByWallet[best.id] || 0) ? w : best
    , allWallets[0]);

    const { data: existingSpend } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('order_id', id)
      .eq('type', 'package_redeem')
      .maybeSingle();

    const prevAmount = existingSpend ? Number(existingSpend.amount_value || 0) : 0;
    const desired = Math.max(0, Number(desiredAmount || 0));
    const delta = desired - prevAmount;

    if (delta > 0 && customerPackageBalance + 1e-9 < delta) {
      throw new Error(`رصيد الباقات غير كافٍ. المتاح: ${customerPackageBalance.toFixed(2)}`);
    }

    if (desired <= 1e-9) {
      if (existingSpend) {
        await supabase.from('wallet_transactions').delete().eq('id', existingSpend.id);
        setTransactions(prev => prev.filter(t => t.id !== existingSpend.id));
      }
      return;
    }

    if (existingSpend) {
      const { data: updated, error: updErr } = await supabase
        .from('wallet_transactions')
        .update({ amount_value: desired, created_at: new Date().toISOString() })
        .eq('id', existingSpend.id)
        .select()
        .single();
      if (updErr) throw updErr;
      setTransactions(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      setCustomerPackageBalance(prev => Math.max(0, prev - delta));
      return;
    }

    const { data: created, error: insErr } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id, order_id: id,
        type: 'package_redeem', points: 0, amount_value: desired,
        created_at: new Date().toISOString()
      })
      .select().single();
    if (insErr) throw insErr;
    setTransactions(prev => [...prev, created]);
    setCustomerPackageBalance(prev => Math.max(0, prev - desired));
  };

  // --- إضافة نقاط الولاء ---
  const handleAddLoyaltyPoints = async () => {
    const rewardAmount = Number(calculateLoyaltyReward() || 0);
    if (rewardAmount <= 0) return toast.error('لا يوجد كميات تستحق النقاط');

    const cleanPhone = normalizePhone(order.phone);
    if (!cleanPhone) return toast.error('لا يوجد رقم جوال صالح للعميل');

    const toastId = toast.loading('جاري التحقق والإضافة...');
    try {
      const { data: existing } = await supabase
        .from('wallet_transactions')
        .select('id')
        .eq('order_id', id)
        .eq('type', 'loyalty_earn')
        .maybeSingle();

      if (existing) {
        toast.dismiss(toastId);
        return toast.error('تمت إضافة النقاط لهذا الطلب مسبقاً!');
      }

      let { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (walletError) throw walletError;

      if (!wallet) {
        const { data: newWallet, error: createError } = await supabase
          .from('wallets')
          .insert([{ phone: cleanPhone, points_balance: 0 }])
          .select()
          .single();
        if (createError) throw createError;
        wallet = newWallet;
      }

      const newBalance = Number(wallet.points_balance || 0) + rewardAmount;

      const { error: updateError } = await supabase
        .from('wallets')
        .update({ points_balance: newBalance })
        .eq('id', wallet.id);

      if (updateError) throw updateError;

      const { data: newTrans, error: transError } = await supabase
        .from('wallet_transactions')
        .insert({
          wallet_id: wallet.id,
          order_id: id,
          type: 'loyalty_earn',
          points: 0,
          amount_value: rewardAmount,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (transError) throw transError;

      setTransactions(prev => [...prev, newTrans]);
      toast.dismiss(toastId);
      toast.success(`تم إضافة ${rewardAmount.toFixed(2)} ريال رصيد ولاء!`);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(`فشل العملية: ${err.message}`);
    }
  };

  // ✅ تعديل كبير: دالة الحساب الآن تستخدم Subtotal الموجود إذا لم يتم تعديل الكميات
  const recalculateAndSaveTotal = async (overrides = {}) => {
    try {
      let newSubtotal = Number(order.subtotal || 0);

      // نحسب من جديد فقط إذا قمنا بتعديل محتويات الطلب (A4, 4x6, الخ)
      if ('a4_qty' in overrides || 'photo_4x6_qty' in overrides || 'album_qty' in overrides || 'album_price' in overrides) {
        const currentA4 = overrides.a4_qty ?? order.a4_qty;
        const current4x6 = overrides.photo_4x6_qty ?? order.photo_4x6_qty;
        const currentAlbumQty = overrides.album_qty ?? order.album_qty;
        const currentAlbumPrice = overrides.album_price ?? order.album_price;
        
        let active4x6Price = prices.photo4x6;
        if (appSettings?.is_dynamic_pricing_enabled) {
           const qty = Number(current4x6);
           if (qty > 0) {
             if (qty <= appSettings.tier_1_limit) active4x6Price = appSettings.tier_1_price;
             else if (qty <= appSettings.tier_2_limit) active4x6Price = appSettings.tier_2_price;
             else active4x6Price = appSettings.tier_3_price;
           }
        }
        
        const productsTotal = (Number(currentA4) * prices.a4) + (Number(current4x6) * active4x6Price);
        const albumsTotal = (Number(currentAlbumQty) * Number(currentAlbumPrice));
        newSubtotal = productsTotal + albumsTotal;
      }

      const currentDelivery = Number(overrides.delivery_fee ?? deliveryFee ?? 0);
      const currentDiscount = Number(overrides.manual_discount ?? manualDiscount ?? 0);

      // إجمالي قبل الخصم
      const theoreticalTotal = Math.max(0, newSubtotal + currentDelivery);
      // نضمن عدم تجاوز الخصم للحد
      const safeDiscount = Math.min(theoreticalTotal, Math.max(0, currentDiscount));

      const newTotal = Math.max(0, theoreticalTotal - safeDiscount);
      const isPaid = (Number(order.deposit || 0) + Number(overrides.wallet_used ?? walletUsed ?? 0)) >= newTotal;

      const updatedData = {
        a4_qty: overrides.a4_qty ?? order.a4_qty,
        photo_4x6_qty: overrides.photo_4x6_qty ?? order.photo_4x6_qty,
        album_qty: overrides.album_qty ?? order.album_qty,
        album_price: overrides.album_price ?? order.album_price,
        delivery_fee: currentDelivery,
        manual_discount: safeDiscount,
        subtotal: newSubtotal,
        total_amount: newTotal,
        wallet_used: overrides.wallet_used ?? walletUsed,
        payment_status: isPaid ? 'paid' : 'unpaid'
      };

      await supabase.from('orders').update(updatedData).eq('id', id);
      setOrder(prev => ({ ...prev, ...updatedData }));
      setDeliveryFee(currentDelivery);
      setManualDiscount(safeDiscount);
      return true;
    } catch (e) {
      toast.error('فشل الحساب');
      return false;
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;

    const toastId = toast.loading('التحقق...');
    try {
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase().trim())
        .eq('is_active', true)
        .single();

      if (error || !coupon) {
        toast.dismiss(toastId);
        return toast.error('كود غير صالح');
      }

      try { await syncWalletSpend(0); } catch (_) {}
      setDiscountSource('discount');

      const currentSubtotal = Number(order.subtotal || 0);

      let discountValue =
        coupon.discount_type === 'percent'
          ? Math.ceil(currentSubtotal * (Number(coupon.discount_amount || 0) / 100))
          : Number(coupon.discount_amount || 0);

      const success = await recalculateAndSaveTotal({ manual_discount: discountValue });

      toast.dismiss(toastId);
      if (success) {
        setManualDiscount(discountValue);
        setCouponCode('');

        const noteMsg = `تم استخدام كوبون: ${coupon.code}`;
        if (!notes.includes(noteMsg)) {
          const newNotes = notes ? `${notes} | ${noteMsg}` : noteMsg;
          await supabase.from('orders').update({ notes: newNotes }).eq('id', id);
          setNotes(newNotes);
        }

        toast.success(`تم خصم ${discountValue} ريال`);
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error('خطأ');
    }
  };

  // ✅ تعديل: تحويل الفائض للمحفظة لمرة واحدة وموازنة الطلب
  const convertExcessToWallet = async () => {
    if (isConvertingExcess) return; // منع النقر المزدوج
    
    const excessAmount = Number(order.deposit || 0) + Number(order.wallet_used || 0) - Number(order.total_amount || 0);
    if (excessAmount <= 0) return;

    const cleanPhone = normalizePhone(order.phone);
    if (!cleanPhone) return toast.error('رقم الجوال غير صالح');

    setIsConvertingExcess(true);
    const toastId = toast.loading('جاري التحويل...');
    
    try {
      // 1. إضافة الفائض للمحفظة
      let { data: wallet, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (error) throw error;

      if (!wallet) {
        const { data: newWallet, error: createError } = await supabase
          .from('wallets')
          .insert([{ phone: cleanPhone, points_balance: 0 }])
          .select()
          .single();
        if (createError) throw createError;
        wallet = newWallet;
      }

      await supabase
        .from('wallets')
        .update({ points_balance: Number(wallet.points_balance || 0) + excessAmount })
        .eq('id', wallet.id);

      const { data: newTrans } = await supabase
        .from('wallet_transactions')
        .insert({
          wallet_id: wallet.id,
          order_id: id,
          type: 'deposit_excess',
          amount_value: excessAmount,
          points: 0
        })
        .select()
        .single();

      if (newTrans) setTransactions(prev => [...prev, newTrans]);

      // 2. إضافة دفعة سالبة للطلب لضبط المتبقي ليكون 0 (حتى يختفي الزر)
      const { data: payData, error: payError } = await supabase
        .from('order_payments')
        .insert([{
          order_id: id,
          amount: -excessAmount,
          payment_date: new Date().toISOString().split('T')[0],
          note: 'تحويل الفائض للمحفظة'
        }])
        .select()
        .single();

      if (payError) throw payError;

      const newTotalPaid = Number(order.deposit || 0) - excessAmount;
      await supabase
        .from('orders')
        .update({ deposit: newTotalPaid })
        .eq('id', id);

      setPayments(prev => [...prev, payData]);
      setOrder(prev => ({ ...prev, deposit: newTotalPaid }));

      toast.dismiss(toastId);
      toast.success('تم تحويل الفائض للمحفظة وتصفير حساب الطلب');
    } catch (err) {
      toast.dismiss(toastId);
      console.error(err);
      toast.error('فشل التحويل');
    } finally {
      setIsConvertingExcess(false);
    }
  };

  const handleSaveCustomerData = async () => {
    try {
      const updatedData = {
        customer_name: customerData.customer_name,
        phone: customerData.phone,
        delivery_date: customerData.delivery_date,
        created_at: new Date(customerData.created_at).toISOString(),
        source: customerData.source,
        source_other: customerData.source_other
      };
      await supabase.from('orders').update(updatedData).eq('id', id);
      setOrder(prev => ({ ...prev, ...updatedData }));
      setIsEditingCustomer(false);
      toast.success('تم التحديث');
    } catch {
      toast.error('فشل الحفظ');
    }
  };

  const handleSaveProduction = async () => {
    const success = await recalculateAndSaveTotal({
      a4_qty: Number(productionData.a4_qty),
      photo_4x6_qty: Number(productionData.photo_4x6_qty),
      album_qty: Number(productionData.album_qty),
      album_price: Number(productionData.album_price)
    });

    if (success) {
      setIsEditingProduction(false);
      toast.success('تم التحديث');
    }
  };

  const handleSaveDiscount = async () => {
    const theoreticalTotal = Number(order.subtotal || 0) + Number(deliveryFee || 0);
    const discountValue = Math.min(theoreticalTotal, Math.max(0, Number(manualDiscount || 0)));

    const toastId = toast.loading('تحديث الخصم...');
    try {
      // الخصم العادي فقط — لا يمس المحافظ
      await syncWalletSpend(0);
      await syncPackageSpend(0);
      const success = await recalculateAndSaveTotal({ manual_discount: discountValue });
      toast.dismiss(toastId);
      if (success) toast.success('تم تحديث الخصم');
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e?.message || 'فشل التحديث');
    }
  };

  const handleSavePackageDiscount = async () => {
    const inputVal = Number(packageDiscountInput) || 0;
    if (inputVal <= 0) return toast.error('أدخل مبلغاً صحيحاً');
    if (inputVal > customerPackageBalance + 0.01) return toast.error(`رصيد الباقات غير كافٍ. المتاح: ${customerPackageBalance.toFixed(2)}`);
    const theoreticalTotal = Number(order.subtotal || 0) + Number(deliveryFee || 0);
    const discountValue = Math.min(inputVal, theoreticalTotal);

    const toastId = toast.loading('تحديث الخصم...');
    try {
      await syncPackageSpend(discountValue);
      await syncWalletSpend(0);
      const success = await recalculateAndSaveTotal({ manual_discount: discountValue, wallet_used: 0 });
      toast.dismiss(toastId);
      if (success) { toast.success('تم خصم من رصيد الباقات ✅'); setDiscountSource('package'); }
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e?.message || 'فشل التحديث');
    }
  };

  const handleSavePointsDiscount = async () => {
    const inputVal = Number(pointsDiscountInput) || 0;
    if (inputVal <= 0) return toast.error('أدخل مبلغاً صحيحاً');
    if (inputVal > customerPointsBalance + 0.01) return toast.error(`رصيد النقاط غير كافٍ. المتاح: ${customerPointsBalance.toFixed(2)}`);
    const theoreticalTotal = Number(order.subtotal || 0) + Number(deliveryFee || 0);
    const discountValue = Math.min(inputVal, theoreticalTotal);

    const toastId = toast.loading('تحديث الخصم...');
    try {
      await syncWalletSpend(discountValue);
      await syncPackageSpend(0);
      const success = await recalculateAndSaveTotal({ manual_discount: discountValue, wallet_used: discountValue });
      toast.dismiss(toastId);
      if (success) { toast.success('تم خصم من رصيد النقاط ✅'); setDiscountSource('wallet'); }
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e?.message || 'فشل التحديث');
    }
  };

  const handleSaveDelivery = async () => {
    const success = await recalculateAndSaveTotal({ delivery_fee: Number(deliveryFee) });
    if (success) {
      setIsEditingDelivery(false);
      toast.success('تم تحديث التوصيل');
    }
  };

  // --- إضافة دفعة ---
  const handleAddPayment = async () => {
    if (!newPayment.amount || Number(newPayment.amount) <= 0) return toast.error('مبلغ غير صحيح');

    try {
      const { data: payData, error } = await supabase
        .from('order_payments')
        .insert([{
          order_id: id,
          amount: Number(newPayment.amount),
          payment_date: newPayment.date
        }])
        .select()
        .single();

      if (error) throw error;

      const newTotalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0) + Number(newPayment.amount);
      const isPaid = newTotalPaid >= Number(order.total_amount || 0);

      await supabase
        .from('orders')
        .update({ deposit: newTotalPaid, payment_status: isPaid ? 'paid' : 'unpaid' })
        .eq('id', id);

      setPayments(prev => [...prev, payData]);
      setOrder(prev => ({ ...prev, deposit: newTotalPaid, payment_status: isPaid ? 'paid' : 'unpaid' }));
      setShowPaymentInput(false);
      setNewPayment({ amount: '', date: new Date().toISOString().split('T')[0] });
      toast.success('تمت الإضافة');
    } catch {
      toast.error('فشل');
    }
  };

  const handleDeletePayment = async (paymentId, amount) => {
    if (!window.confirm('حذف؟')) return;
    try {
      await supabase.from('order_payments').delete().eq('id', paymentId);

      const newTotalPaid = Number(order.deposit || 0) - Number(amount || 0);
      await supabase
        .from('orders')
        .update({ deposit: newTotalPaid, payment_status: newTotalPaid >= Number(order.total_amount || 0) ? 'paid' : 'unpaid' })
        .eq('id', id);

      setPayments(prev => prev.filter(p => p.id !== paymentId));
      setOrder(prev => ({ ...prev, deposit: newTotalPaid, payment_status: newTotalPaid >= Number(order.total_amount || 0) ? 'paid' : 'unpaid' }));
      toast.success('تم الحذف');
    } catch {
      toast.error('فشل');
    }
  };

  const markAsFullyPaid = async () => {
    const remaining = Number(order.total_amount || 0) - Number(order.deposit || 0) - Number(order.wallet_used || 0);
    if (remaining <= 0) return;

    try {
      const { data: payData, error } = await supabase
        .from('order_payments')
        .insert([{
          order_id: id,
          amount: remaining,
          payment_date: new Date().toISOString().split('T')[0],
          note: 'سداد كامل تلقائي'
        }])
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('orders')
        .update({ deposit: Number(order.total_amount || 0) + remaining, payment_status: 'paid' })
        .eq('id', id);

      setPayments(prev => [...prev, payData]);
      setOrder(prev => ({ ...prev, deposit: Number(order.total_amount || 0) + remaining, payment_status: 'paid' }));
      toast.success('تم السداد بالكامل');
    } catch {
      toast.error('فشل العملية');
    }
  };

  const sendAutoWhatsAppMessage = async (orderData) => {
    try {
      const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (!settings || !settings.whatsapp_enabled || !settings.whatsapp_instance_id || !settings.whatsapp_token) return;
      if (!orderData.phone) return;

      let phone = String(orderData.phone).replace(/\D/g, '');
      if (phone.startsWith('0')) phone = '966' + phone.substring(1);

      const msg =
        `مرحباً ${orderData.customer_name} 🌸\n\n` +
        `سعدنا بخدمتك في *لحظة فن*.\n\n` +
        `يسرنا إخبارك بأن طلبك رقم *#${orderData.id.slice(0, 6)}* قد تم تسليمه/شحنه بنجاح! 📦✨`;

      await fetch(`https://api.ultramsg.com/${settings.whatsapp_instance_id}/messages/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: settings.whatsapp_token, to: phone, body: msg })
      });

      toast.success('تم إرسال رسالة واتساب تلقائية 🚀');
    } catch (error) {
      console.error('WhatsApp Error:', error);
    }
  };

  const sendWhatsApp = (type) => {
    if (!order.phone) return toast.error('لا يوجد رقم');
    const cleanPhone = String(order.phone).replace(/\D/g, '');
    const phone = cleanPhone.startsWith('0')
      ? '966' + cleanPhone.substring(1)
      : (cleanPhone.startsWith('966') ? cleanPhone : '966' + cleanPhone);

    const remaining = (
      Number(order.total_amount || 0) -
      Number(order.deposit || 0) -
      Number(order.wallet_used || 0)
    ).toFixed(2);

    const siteLink = 'https://www.art-moment.com/track';

    let msg = '';
    if (type === 'ready') {
      msg =
        `يا هلا ${order.customer_name} ✨\n` +
        `طلبك رقم *${order.id.slice(0, 5)}* جاهز للاستلام!\n` +
        (Number(remaining) > 0 ? `المتبقي: *${remaining} ر.س*\n` : `الحساب: *خالص*\n`) +
        `\nتابع طلبك وسجل طلباتك من هنا:\n${siteLink}`;
    } else if (type === 'invoice') {
      msg =
        `اهلاً ${order.customer_name}\n` +
        `رقم الطلب: *${order.id.slice(0, 5)}*\n` +
        `الاجمالي: *${order.total_amount} ر.س*\n` +
        `المدفوع: *${order.deposit} ر.س*\n` +
        `المتبقي: *${remaining} ر.س*\n` +
        `\nتابع طلبك من هنا:\n${siteLink}`;
    } else if (type === 'location') {
      msg =
        `موقعنا على خرائط جوجل:\nhttps://maps.app.goo.gl/...\n` +
        `\nاو تابع طلبك اونلاين:\n${siteLink}`;
    }

    // استخدام api.whatsapp.com بدلاً من wa.me لتجنب مشاكل الترميز على iOS
    window.open(
      `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`,
      '_blank'
    );
  };

  const updateStatus = async (newStatus) => {
    const dateField = `date_${newStatus}`;
    const now = new Date().toISOString();
    try {
      await supabase.from('orders').update({ status: newStatus, [dateField]: now }).eq('id', id);

      setOrder(prev => {
        const updated = { ...prev, status: newStatus, [dateField]: now };
        if (newStatus === 'delivered') sendAutoWhatsAppMessage(updated);
        return updated;
      });

      toast.success('تم التحديث');
    } catch {
      toast.error('فشل');
    }
  };

  const handleDateChange = async (statusKey, newDateVal) => {
    if (!newDateVal) return;
    const dateField = `date_${statusKey}`;
    try {
      await supabase.from('orders').update({ [dateField]: new Date(newDateVal).toISOString() }).eq('id', id);
      setOrder(prev => ({ ...prev, [dateField]: new Date(newDateVal).toISOString() }));
      toast.success('تم التعديل');
    } catch {
      toast.error('فشل');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('حذف نهائي؟')) return;
    try {
      await supabase.from('wallet_transactions').delete().eq('order_id', id);
      await supabase.from('order_payments').delete().eq('order_id', id);
      await supabase.from('orders').delete().eq('id', id);
      toast.success('تم الحذف');
      navigate('/app/orders');
    } catch {
      toast.error('فشل');
    }
  };

  const saveNotes = async () => {
    await supabase.from('orders').update({ notes }).eq('id', id);
    setOrder(prev => ({ ...prev, notes }));
    toast.success('تم الحفظ');
  };

  const handlePrint = () => { setTimeout(() => window.print(), 100); };
  const handlePrintLabel = () => { };

  const steps = [
    { key: 'new', label: 'جديد', icon: FileText },
    { key: 'printing', label: 'طباعة', icon: Printer },
    { key: 'done', label: 'جاهز', icon: CheckCircle },
    { key: 'delivered', label: 'تسليم', icon: Truck }
  ];
  const currentStepIndex = steps.findIndex(s => s.key === order?.status);

  if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;
  if (!order) return <div className="p-10 text-center text-red-500">حدث خطأ</div>;

  const remaining = Number(order.total_amount || 0) - Number(order.deposit || 0) - Number(order.wallet_used || 0);
  const rewardAmount = calculateLoyaltyReward();

  return (
    <>
      <div className="min-h-screen bg-[#F8F5F2] text-[#4A4A4A]">
        <div className="w-full px-4 sm:px-6 lg:px-8 pb-20 space-y-6 print:hidden">

          {/* Header */}
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-[#D9A3AA]/25 shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/app/orders')} className="p-2 hover:bg-[#D9A3AA]/10 rounded-xl"><ArrowRight /></button>
              <div>
                <h1 className="text-2xl font-bold text-[#4A4A4A] font-mono">الطلب #{order.id.slice(0, 8)}</h1>
                <p className="text-[#4A4A4A]/70 text-xs">تفاصيل المعالجة</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handlePrintLabel} className="bg-[#D9A3AA]/10 text-[#4A4A4A] px-4 py-2 rounded-xl font-bold hover:bg-[#D9A3AA]/15 flex items-center gap-2 transition-colors">
                <StickyNote size={18} /> ملصق
              </button>
              <button onClick={handlePrint} className="btn-secondary flex items-center gap-2"><Printer size={16} /> فاتورة</button>
              <button onClick={handleDelete} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"><Trash2 size={18} /></button>
            </div>
          </div>

          {/* شريط الحالات */}
          <div className="bg-white p-6 rounded-2xl border border-[#D9A3AA]/25 shadow-sm overflow-x-auto">
            <div className="flex justify-between min-w-[500px]">
              {steps.map((step, index) => {
                const isActive = index <= currentStepIndex;
                const dateValue = order[`date_${step.key}`] ? new Date(order[`date_${step.key}`]).toISOString().split('T')[0] : '';
                return (
                  <div key={step.key} className="flex flex-col items-center gap-3 flex-1 relative group">
                    <button onClick={() => updateStatus(step.key)} className={`flex flex-col items-center gap-2 ${isActive ? 'text-[#D9A3AA]' : 'text-[#4A4A4A]/55'}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-[#D9A3AA]/15 shadow-md scale-110' : 'bg-[#D9A3AA]/10'}`}>
                        <step.icon size={20} />
                      </div>
                      <span className="text-xs font-bold">{step.label}</span>
                    </button>
                    <div className="relative">
                      <input
                        type="date"
                        value={dateValue}
                        onChange={(e) => handleDateChange(step.key, e.target.value)}
                        className={`text-[10px] bg-[#F8F5F2] border border-[#D9A3AA]/25 rounded px-1 py-0.5 text-center w-24 focus:border-[#D9A3AA] outline-none transition-opacity ${!dateValue && !isActive ? 'opacity-0 group-hover:opacity-50' : 'opacity-100'}`}
                      />
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`absolute top-5 right-[50%] left-[-50%] h-0.5 -z-10 ${index < currentStepIndex ? 'bg-[#C5A059]' : 'bg-[#D9A3AA]/10'}`}></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* بطاقة العميل */}
            <div className="bg-white p-6 rounded-2xl border border-[#D9A3AA]/25 shadow-sm h-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold flex items-center gap-2"><User size={18} className="text-blue-500" /> العميل</h3>
                <button
                  onClick={() => isEditingCustomer ? handleSaveCustomerData() : setIsEditingCustomer(true)}
                  className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg"
                >
                  {isEditingCustomer ? 'حفظ' : 'تعديل'}
                </button>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-[#4A4A4A]/70 text-xs block mb-1">الاسم</span>
                  {isEditingCustomer ? (
                    <input
                      value={customerData.customer_name}
                      onChange={e => setCustomerData({ ...customerData, customer_name: e.target.value })}
                      className="w-full border rounded px-2 py-1 font-bold text-[#4A4A4A]"
                    />
                  ) : (
                    <div className="font-bold text-[#4A4A4A] text-lg">{order.customer_name}</div>
                  )}
                </div>

                <div>
                  <span className="text-[#4A4A4A]/70 text-xs">الجوال</span>
                  {isEditingCustomer ? (
                    <input
                      value={customerData.phone}
                      onChange={e => setCustomerData({ ...customerData, phone: e.target.value })}
                      className="w-full border rounded px-2 py-1"
                    />
                  ) : (
                    <div className="font-mono dir-ltr text-right">{order.phone}</div>
                  )}
                </div>

                <div>
                  <span className="text-[#4A4A4A]/70 text-xs">تاريخ الطلب</span>
                  {isEditingCustomer ? (
                    <input
                      type="date"
                      value={customerData.created_at}
                      onChange={e => setCustomerData({ ...customerData, created_at: e.target.value })}
                      className="w-full border rounded px-2 py-1"
                    />
                  ) : (
                    <div className="font-mono text-[#4A4A4A]">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB') : '-'}
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[#4A4A4A]/70 text-xs">تاريخ التسليم</span>
                  {isEditingCustomer ? (
                    <input
                      type="date"
                      value={customerData.delivery_date}
                      onChange={e => setCustomerData({ ...customerData, delivery_date: e.target.value })}
                      className="w-full border rounded px-2 py-1"
                    />
                  ) : (
                    <div className="text-red-600 font-bold">{order.delivery_date}</div>
                  )}
                </div>

                <div className="border-t border-[#D9A3AA]/15 pt-3">
                  <span className="text-[#4A4A4A]/70 text-xs block mb-1">المنطقة / المدينة</span>
                  {isEditingCustomer ? (
                    <div className="flex flex-wrap gap-2">
                      {CITIES.map(city => (
                        <button
                          key={city}
                          onClick={() => setCustomerData({ ...customerData, source: city })}
                          className={`px-2 py-1 text-xs border rounded ${customerData.source === city ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white'}`}
                          type="button"
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[#4A4A4A] font-bold">
                      <MapPin size={14} className="text-red-500" /> {order.source || 'غير محدد'}
                    </div>
                  )}
                </div>

                {!isEditingCustomer && order.phone && (
                  <div className="pt-4 border-t border-[#D9A3AA]/10 space-y-2">
                    <a
                      href={`https://api.whatsapp.com/send?phone=966${String(order.phone).startsWith('0') ? String(order.phone).substring(1) : order.phone}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-full text-center bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageCircle size={18} /> محادثة واتساب
                    </a>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => sendWhatsApp('ready')}
                        className="bg-[#D9A3AA]/10 text-[#C5A059] text-xs py-2 rounded-lg font-bold hover:bg-[#D9A3AA]/15 border border-emerald-100 flex flex-col items-center gap-1"
                      >
                        <CheckCircle size={14} /> جاهز للاستلام
                      </button>
                      <button
                        onClick={() => sendWhatsApp('invoice')}
                        className="bg-blue-50 text-blue-700 text-xs py-2 rounded-lg font-bold hover:bg-blue-100 border border-blue-100 flex flex-col items-center gap-1"
                      >
                        <Receipt size={14} /> الفاتورة
                      </button>
                      <button
                        onClick={() => sendWhatsApp('location')}
                        className="bg-[#F8F5F2] text-[#4A4A4A] text-xs py-2 rounded-lg font-bold hover:bg-[#D9A3AA]/10 border border-[#D9A3AA]/25 flex flex-col items-center gap-1"
                      >
                        <MapPin size={14} /> الموقع
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* بطاقة الإنتاج */}
            <div className="bg-white p-6 rounded-2xl border border-[#D9A3AA]/25 shadow-sm">
              <div className="flex justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2"><FileText size={18} className="text-orange-500" /> الإنتاج</h3>
                <button
                  onClick={() => isEditingProduction ? handleSaveProduction() : setIsEditingProduction(true)}
                  className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-lg"
                >
                  {isEditingProduction ? 'حفظ' : 'تعديل'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#F8F5F2] p-2 rounded text-center">
                  <span className="text-xs block text-[#4A4A4A]/55">4x6</span>
                  {isEditingProduction ? (
                    <input
                      type="number"
                      value={productionData.photo_4x6_qty}
                      onChange={e => setProductionData({ ...productionData, photo_4x6_qty: e.target.value })}
                      className="w-full text-center"
                    />
                  ) : (
                    <span className="font-bold text-xl">{order.photo_4x6_qty}</span>
                  )}
                </div>

                <div className="bg-[#F8F5F2] p-2 rounded text-center">
                  <span className="text-xs block text-[#4A4A4A]/55">A4</span>
                  {isEditingProduction ? (
                    <input
                      type="number"
                      value={productionData.a4_qty}
                      onChange={e => setProductionData({ ...productionData, a4_qty: e.target.value })}
                      className="w-full text-center"
                    />
                  ) : (
                    <span className="font-bold text-xl">{order.a4_qty}</span>
                  )}
                </div>
              </div>

              <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 mb-4 flex gap-2 text-center text-sm">
                <div className="flex-1">
                  <span className="block text-[10px] text-[#4A4A4A]/55">عدد الألبومات</span>
                  {isEditingProduction ? (
                    <input
                      type="number"
                      value={productionData.album_qty}
                      onChange={e => setProductionData({ ...productionData, album_qty: e.target.value })}
                      className="w-full text-center border rounded"
                    />
                  ) : (
                    <b>{order.album_qty}</b>
                  )}
                </div>

                <div className="flex-1">
                  <span className="block text-[10px] text-[#4A4A4A]/55">سعر الألبوم</span>
                  {isEditingProduction ? (
                    <input
                      type="number"
                      value={productionData.album_price}
                      onChange={e => setProductionData({ ...productionData, album_price: e.target.value })}
                      className="w-full text-center border rounded"
                    />
                  ) : (
                    <b>{order.album_price}</b>
                  )}
                </div>
              </div>

              <textarea
                className="w-full bg-yellow-50 border border-yellow-200 rounded-xl p-2 text-sm focus:outline-none h-20"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="ملاحظات..."
              />
              <button onClick={saveNotes} className="mt-2 text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg w-full">
                حفظ الملاحظة
              </button>
            </div>

            {/* بطاقة الحسابات */}
            <div className="bg-[#4A4A4A] text-white p-6 rounded-2xl shadow-lg flex flex-col h-full">
              <h3 className="font-bold mb-4 flex items-center gap-2"><Banknote className="text-[#D9A3AA]" /> الحسابات</h3>

              <div className="space-y-3 text-sm flex-1">
                <div className="flex justify-between text-[#4A4A4A]/55">
                  <span>الإجمالي قبل الخصم والتوصيل</span>
                  <span>{Number(order.subtotal || 0).toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-white/75">
                  <span>التوصيل</span>
                  {isEditingDelivery ? (
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={deliveryFee}
                        onChange={e => setDeliveryFee(Number(e.target.value))}
                        className="w-12 bg-[#3b3b3b] border rounded text-center"
                      />
                      <button onClick={handleSaveDelivery} className="text-[#D9A3AA] text-xs">ok</button>
                    </div>
                  ) : (
                    <button onClick={() => setIsEditingDelivery(true)}>{deliveryFee}</button>
                  )}
                </div>

                {/* ── خصم إضافي عادي ── */}
                <div className="flex justify-between items-center text-white/70 text-xs">
                  <span className="flex items-center gap-1"><Tag size={12} /> خصم إضافي</span>
                  <div className="flex gap-1 items-center">
                    <input
                      type="number" min="0"
                      value={manualDiscount}
                      onChange={e => setManualDiscount(Number(e.target.value))}
                      onKeyDown={e => e.key === 'Enter' && handleSaveDiscount()}
                      className="w-16 bg-[#3b3b3b] border border-white/15 rounded-lg text-center text-xs font-bold text-white focus:border-[#D9A3AA] outline-none py-1"
                    />
                    <button onClick={handleSaveDiscount}
                      className="text-[10px] text-[#D9A3AA] bg-[#D9A3AA]/15 hover:bg-[#D9A3AA]/30 px-2 py-1 rounded-lg transition-colors">
                      حفظ
                    </button>
                  </div>
                </div>

                {/* ── خصم من رصيد الباقات ── */}
                <div className={`rounded-xl border overflow-hidden transition-all ${discountSource === 'package' ? 'border-orange-400/50' : 'border-white/10'}`}>
                  <button type="button"
                    onClick={() => setDiscountSource(discountSource === 'package' ? 'discount' : 'package')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-right transition-colors ${discountSource === 'package' ? 'bg-orange-500/20' : 'bg-white/5 hover:bg-orange-500/10'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${discountSource === 'package' ? 'bg-orange-400 border-orange-400' : 'border-orange-400/40'}`}>
                        {discountSource === 'package' && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-orange-300 flex items-center gap-1">
                          <Package size={11} /> خصم من رصيد الباقات
                        </span>
                        <span className="text-[10px] text-orange-300/60 block">المتاح: {customerPackageBalance.toFixed(2)} ر.س</span>
                      </div>
                    </div>
                    {discountSource === 'package' && Number(packageDiscountInput) > 0 && (
                      <span className="text-orange-300 font-black text-sm bg-orange-500/20 px-2 py-0.5 rounded-lg">
                        -{Number(packageDiscountInput).toFixed(2)} ر.س
                      </span>
                    )}
                  </button>
                  {discountSource === 'package' && (
                    <div className="bg-orange-500/10 border-t border-orange-400/20 px-3 py-2 flex items-center gap-2">
                      <span className="text-[11px] text-orange-300/80 shrink-0">المبلغ:</span>
                      <input
                        type="number" min="0.01" max={customerPackageBalance} step="0.01"
                        value={packageDiscountInput}
                        onChange={e => setPackageDiscountInput(e.target.value)}
                        className="flex-1 text-center border border-orange-400/40 rounded-lg px-2 py-1.5 text-sm font-bold text-orange-200 bg-[#3b3b3b] outline-none focus:ring-2 ring-orange-400/30"
                      />
                      <button type="button"
                        onClick={() => setPackageDiscountInput(Math.min(customerPackageBalance, Number(order.subtotal || 0) + Number(deliveryFee || 0)).toFixed(2))}
                        className="text-[10px] text-orange-300 bg-orange-500/20 hover:bg-orange-500/30 px-2 py-1 rounded-lg shrink-0 transition-colors">
                        الكل
                      </button>
                      <button onClick={handleSavePackageDiscount}
                        className="text-[10px] text-white bg-orange-500 hover:bg-orange-400 px-2 py-1 rounded-lg shrink-0 transition-colors font-bold">
                        حفظ
                      </button>
                    </div>
                  )}
                </div>

                {/* ── خصم من رصيد النقاط ── */}
                <div className={`rounded-xl border overflow-hidden transition-all ${discountSource === 'wallet' ? 'border-violet-400/50' : 'border-white/10'}`}>
                  <button type="button"
                    onClick={() => setDiscountSource(discountSource === 'wallet' ? 'discount' : 'wallet')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-right transition-colors ${discountSource === 'wallet' ? 'bg-violet-500/20' : 'bg-white/5 hover:bg-violet-500/10'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${discountSource === 'wallet' ? 'bg-violet-400 border-violet-400' : 'border-violet-400/40'}`}>
                        {discountSource === 'wallet' && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-violet-300 flex items-center gap-1">
                          <Wallet size={11} /> خصم من رصيد النقاط
                        </span>
                        <span className="text-[10px] text-violet-300/60 block">المتاح: {customerPointsBalance.toFixed(2)} ر.س</span>
                      </div>
                    </div>
                    {discountSource === 'wallet' && Number(pointsDiscountInput) > 0 && (
                      <span className="text-violet-300 font-black text-sm bg-violet-500/20 px-2 py-0.5 rounded-lg">
                        -{Number(pointsDiscountInput).toFixed(2)} ر.س
                      </span>
                    )}
                  </button>
                  {discountSource === 'wallet' && (
                    <div className="bg-violet-500/10 border-t border-violet-400/20 px-3 py-2 flex items-center gap-2">
                      <span className="text-[11px] text-violet-300/80 shrink-0">المبلغ:</span>
                      <input
                        type="number" min="0.01" max={customerPointsBalance} step="0.01"
                        value={pointsDiscountInput}
                        onChange={e => setPointsDiscountInput(e.target.value)}
                        className="flex-1 text-center border border-violet-400/40 rounded-lg px-2 py-1.5 text-sm font-bold text-violet-200 bg-[#3b3b3b] outline-none focus:ring-2 ring-violet-400/30"
                      />
                      <button type="button"
                        onClick={() => setPointsDiscountInput(Math.min(customerPointsBalance, Number(order.subtotal || 0) + Number(deliveryFee || 0)).toFixed(2))}
                        className="text-[10px] text-violet-300 bg-violet-500/20 hover:bg-violet-500/30 px-2 py-1 rounded-lg shrink-0 transition-colors">
                        الكل
                      </button>
                      <button onClick={handleSavePointsDiscount}
                        className="text-[10px] text-white bg-violet-500 hover:bg-violet-400 px-2 py-1 rounded-lg shrink-0 transition-colors font-bold">
                        حفظ
                      </button>
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 my-2"></div>

                {/* ✅ تم إضافة الإجمالي قبل الخصم لتوضيح الحسبة */}
                <div className="flex justify-between text-white/60 text-xs mb-1">
                  <span>الإجمالي (مع التوصيل)</span>
                  <span className="line-through">{(Number(order.subtotal || 0) + Number(deliveryFee || 0)).toFixed(2)} ر.س</span>
                </div>

                <div className="flex justify-between items-center mb-5 px-1">
                  <span className="font-bold text-white">الإجمالي النهائي</span>
                  <span className="font-black text-xl text-white">
                    {Number(order.total_amount || 0).toFixed(2)} ر.س
                  </span>
                </div>

                <div className="bg-white/10 rounded-xl p-3">
                  <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                    <span className="text-[#D9A3AA] font-bold">سجل المدفوعات</span>
                    <button
                      onClick={() => setShowPaymentInput(!showPaymentInput)}
                      className="text-xs bg-[#D9A3AA]/20 text-[#D9A3AA]/85 px-2 py-1 rounded hover:bg-[#D9A3AA]/40 flex items-center gap-1"
                    >
                      <Plus size={12} /> إضافة
                    </button>
                  </div>

                  {showPaymentInput && (
                    <div className="flex gap-2 mb-2 animate-in fade-in slide-in-from-top-2">
                      <input
                        type="date"
                        value={newPayment.date}
                        onChange={e => setNewPayment({ ...newPayment, date: e.target.value })}
                        className="w-24 bg-[#3b3b3b] border border-white/15 rounded text-xs px-1 text-white"
                      />
                      <input
                        type="number"
                        placeholder="المبلغ"
                        value={newPayment.amount}
                        onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })}
                        className="flex-1 bg-[#3b3b3b] border border-white/15 rounded text-xs px-2 text-white"
                      />
                      <button onClick={handleAddPayment} className="bg-gradient-to-b from-[#D9A3AA] to-[#C5A059] text-white px-2 rounded text-xs">
                        حفظ
                      </button>
                    </div>
                  )}

                  <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                    {payments.length === 0 ? (
                      <p className="text-xs text-[#4A4A4A]/70 text-center py-2">لا توجد دفعات مسجلة</p>
                    ) : (
                      payments.map((p) => (
                        <div key={p.id} className="flex justify-between items-center text-xs bg-[#3b3b3b]/50 px-2 py-1.5 rounded group">
                          <span className="font-mono text-[#4A4A4A]/55">{new Date(p.payment_date).toLocaleDateString('en-GB')}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{p.amount}</span>
                            <button
                              onClick={() => handleDeletePayment(p.id, p.amount)}
                              className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-300"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
                    <span className="text-xs text-[#4A4A4A]/55">إجمالي المدفوع</span>
                    <span className="font-bold text-[#D9A3AA]">{Number(order.deposit || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="كود خصم"
                      className="w-full bg-[#3b3b3b] border border-white/15 rounded px-2 py-1 text-white text-xs outline-none pl-6"
                    />
                    <Tag size={10} className="absolute left-2 top-2 text-[#4A4A4A]/55" />
                  </div>
                  <button onClick={applyCoupon} className="bg-[#4A4A4A]/70 hover:bg-[#4A4A4A]/85 px-2 py-1 rounded text-xs text-white">
                    تطبيق
                  </button>
                </div>

                {rewardAmount > 0 && (
                  <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-amber-400 text-xs font-bold flex items-center gap-1"><Gift size={12} /> كاش باك مستحق للمحفظة</span>
                      <span className="text-amber-300 font-bold">{rewardAmount.toFixed(2)} ريال</span>
                    </div>

                    {isLoyaltyAdded ? (
                      <div className="text-xs text-center bg-amber-500/20 text-amber-200 py-1 rounded flex items-center justify-center gap-1">
                        <CheckCircle size={10} /> تم الإضافة للمحفظة
                      </div>
                    ) : (
                      <button
                        onClick={handleAddLoyaltyPoints}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs py-1.5 rounded transition-colors shadow-sm"
                      >
                        إضافة لرصيد العميل
                      </button>
                    )}
                  </div>
                )}

                <div className={`p-3 rounded-xl text-center border ${remaining <= 0 ? 'bg-[#D9A3AA]/20 text-[#D9A3AA]/85' : 'bg-red-500/20 text-red-300'}`}>
                  <span className="text-xs block">المتبقي</span>
                  <span className="text-xl font-black">{remaining <= 0 ? 'خالص ✅' : remaining.toFixed(2)}</span>
                </div>

                {remaining > 0 && (
                  <button onClick={markAsFullyPaid} className="w-full py-2 bg-white text-[#4A4A4A] rounded-lg font-bold text-xs">
                    سداد كامل
                  </button>
                )}

                {remaining < 0 && (
                  <button
                    onClick={convertExcessToWallet}
                    disabled={isConvertingExcess}
                    className="w-full py-2 bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs mt-2 flex items-center justify-center gap-2 hover:bg-indigo-200 transition-colors disabled:opacity-50"
                  >
                    <Wallet size={14} /> تحويل الفائض ({Math.abs(remaining).toFixed(2)}) للمحفظة
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* الفاتورة القابلة للطباعة */}
        <div id="printable-invoice" className="hidden print:block bg-white text-black print-no-extra-space">
          <div className="mx-auto">
            <div className="no-break flex justify-between items-start border-b-2 border-[#4A4A4A]/35 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <img src={logo} alt="Art Moment" className="w-12 h-12 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  <h1 className="text-2xl font-black text-[#4A4A4A]">Art Moment</h1>
                </div>
                <p className="text-xs text-[#4A4A4A]/70">لحظة فن للطباعة</p>
              </div>
              <div className="text-left">
                <h2 className="text-base font-bold font-mono text-[#4A4A4A]">فاتورة #{order.id.slice(0, 8)}</h2>
                <p className="text-xs text-[#4A4A4A]/70 mt-1">التاريخ: {new Date(order.created_at).toLocaleDateString('en-GB')}</p>
              </div>
            </div>

            <div className="no-break grid grid-cols-2 gap-6 mb-4">
              <div>
                <h3 className="font-bold text-[10px] text-[#4A4A4A]/55 mb-1 uppercase tracking-wider">العميل</h3>
                <p className="text-lg font-bold text-[#4A4A4A] leading-tight">{order.customer_name}</p>
                <p className="text-xs text-[#4A4A4A] dir-ltr text-right font-mono">{order.phone}</p>
                {order.source && <p className="text-xs text-[#4A4A4A]/70 mt-1">{order.source}</p>}
              </div>
              <div className="text-left">
                <h3 className="font-bold text-[10px] text-[#4A4A4A]/55 mb-1 uppercase tracking-wider">التسليم</h3>
                <p className="font-bold text-sm text-[#4A4A4A]">{order.delivery_date || 'غير محدد'}</p>
                {order.status === 'delivered' && (
                  <span className="inline-block bg-[#D9A3AA]/10 px-2 py-1 rounded text-[10px] mt-2 font-bold">تم التسليم</span>
                )}
              </div>
            </div>

            <table className="w-full mb-4">
              <thead className="bg-[#F8F5F2] border-y border-[#D9A3AA]/25">
                <tr>
                  <th className="py-2 px-2 text-right text-xs font-bold text-[#4A4A4A]/75">الوصف</th>
                  <th className="py-2 px-2 text-center text-xs font-bold text-[#4A4A4A]/75">الكمية</th>
                  <th className="py-2 px-2 text-left text-xs font-bold text-[#4A4A4A]/75">السعر</th>
                  <th className="py-2 px-2 text-left text-xs font-bold text-[#4A4A4A]/75">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9A3AA]/15">
                {order.photo_4x6_qty > 0 && (
                  <tr>
                    <td className="py-2 px-2 text-xs font-medium">طباعة صور 4×6</td>
                    <td className="py-2 px-2 text-center text-xs font-bold">{order.photo_4x6_qty}</td>
                    <td className="py-2 px-2 text-left text-xs text-[#4A4A4A]/70">
                       {/* عرض السعر الديناميكي إذا كان مطبقاً */}
                       {Number(order.subtotal) > 0 ? (
                          ((Number(order.photo_4x6_qty) * prices.photo4x6) === Number(order.subtotal) - (Number(order.a4_qty) * prices.a4) - (Number(order.album_qty) * Number(order.album_price))) ? prices.photo4x6 : 'تسعير ذكي'
                       ) : prices.photo4x6}
                    </td>
                    <td className="py-2 px-2 text-left text-xs font-bold">
                       {Number(order.subtotal) > 0 ? (
                          (Number(order.subtotal) - (Number(order.a4_qty) * prices.a4) - (Number(order.album_qty) * Number(order.album_price))).toFixed(2)
                       ) : (order.photo_4x6_qty * prices.photo4x6).toFixed(2)}
                    </td>
                  </tr>
                )}
                {order.a4_qty > 0 && (
                  <tr>
                    <td className="py-2 px-2 text-xs font-medium">طباعة صور A4</td>
                    <td className="py-2 px-2 text-center text-xs font-bold">{order.a4_qty}</td>
                    <td className="py-2 px-2 text-left text-xs text-[#4A4A4A]/70">{prices.a4}</td>
                    <td className="py-2 px-2 text-left text-xs font-bold">{(order.a4_qty * prices.a4).toFixed(2)}</td>
                  </tr>
                )}
                {order.album_qty > 0 && (
                  <tr>
                    <td className="py-2 px-2 text-xs font-medium">ألبومات صور</td>
                    <td className="py-2 px-2 text-center text-xs font-bold">{order.album_qty}</td>
                    <td className="py-2 px-2 text-left text-xs text-[#4A4A4A]/70">{order.album_price}</td>
                    <td className="py-2 px-2 text-left text-xs font-bold">{(order.album_qty * order.album_price).toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="no-break flex justify-end mb-4">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-xs text-[#4A4A4A]/75 border-b border-[#D9A3AA]/15 pb-1">
                  <span>المجموع الفرعي</span>
                  <span className="font-bold">{Number(order.subtotal || 0).toFixed(2)}</span>
                </div>
                {Number(order.delivery_fee || 0) > 0 && (
                  <div className="flex justify-between text-xs text-[#4A4A4A]/75 border-b border-[#D9A3AA]/15 pb-1">
                    <span>التوصيل</span>
                    <span className="font-bold">{Number(order.delivery_fee || 0).toFixed(2)}</span>
                  </div>
                )}
                {(() => {
                  const theoreticalTotal = Number(order.subtotal || 0) + Number(order.delivery_fee || 0);
                  const discount = theoreticalTotal - Number(order.total_amount || 0);
                  return discount > 0.01 && (
                    <div className="flex justify-between text-xs text-red-600 border-b border-[#D9A3AA]/15 pb-1">
                      <span>خصم / محفظة</span>
                      <span>-{discount.toFixed(2)}</span>
                    </div>
                  );
                })()}
                <div className="flex justify-between font-black text-lg pt-1">
                  <span>الإجمالي</span>
                  <span>{Number(order.total_amount || 0).toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-xs pt-1 text-[#4A4A4A]/70">
                  <span>المدفوع</span>
                  <span className="font-bold">{Number(order.deposit || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t-2 border-[#4A4A4A]/35 mt-2">
                  <span className="font-bold text-[#4A4A4A] mt-1">المتبقي</span>
                  <span className={`font-black text-base mt-1 ${remaining > 0 ? 'text-red-600' : 'text-[#4A4A4A]'}`}>
                    {remaining.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="no-break text-center border-t border-[#D9A3AA]/15 pt-4">
              <p className="text-xs font-bold text-[#4A4A4A] mb-1">شكراً لاختياركم لحظة فن ✨</p>
              <p className="text-[10px] text-[#4A4A4A]/55">نسعد بخدمتكم دائماً | تواصل معنا للاستفسار</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}