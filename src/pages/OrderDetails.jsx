// src/pages/OrderDetails.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import {
  ArrowRight, Printer, CheckCircle, Truck, Trash2,
  Banknote, FileText, User,
  MessageCircle, Edit3, X, Tag, BookOpen, MapPin, Receipt, StickyNote, Plus, Wallet, Gift
} from 'lucide-react';
import logo from '../assets/logo-art-moment.svg';

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState({ a4: 0, photo4x6: 0 });

  // --- إعدادات نقاط الولاء ---
  const LOYALTY_RATES = {
    photo4x6: 0.05,
    a4: 1.00,
    album: 1.00
  };

  const CITIES = ['الهفوف', 'المبرز', 'القرى', 'الدمام', 'الخبر', 'الرياض', 'أخرى'];

  const [payments, setPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const [newPayment, setNewPayment] = useState({ amount: '', date: new Date().toISOString().split('T')[0] });

  const [manualDiscount, setManualDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [isEditingDelivery, setIsEditingDelivery] = useState(false);

  // مصدر الخصم: خصم عادي أو خصم من المحفظة
  const [discountSource, setDiscountSource] = useState('discount');

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

  useEffect(() => {
    fetchOrderAndSettings();
  }, [id]);

  async function fetchOrderAndSettings() {
    try {
      const { data: orderData, error: orderError } = await supabase.from('orders').select('*').eq('id', id).single();
      if (orderError) throw orderError;

      const { data: paymentsData } = await supabase.from('order_payments').select('*').eq('order_id', id).order('payment_date', { ascending: true });
      const { data: transData } = await supabase.from('wallet_transactions').select('*').eq('order_id', id);
      const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 1).single();

      setOrder(orderData);
      setPayments(paymentsData || []);
      setTransactions(transData || []);
      setDiscountSource((transData || []).some(t => t.type === 'wallet_spend') ? 'wallet' : 'discount');
      setManualDiscount(orderData.manual_discount || 0);
      setDeliveryFee(orderData.delivery_fee || 0);
      setNotes(orderData.notes || '');

      if (settingsData) {
        setPrices({ a4: Number(settingsData.a4_price), photo4x6: Number(settingsData.photo_4x6_price) });
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
    } finally { setLoading(false); }
  }

  const calculateLoyaltyReward = () => {
    if (!order) return 0;
    const reward4x6 = (order.photo_4x6_qty || 0) * LOYALTY_RATES.photo4x6;
    const rewardA4 = (order.a4_qty || 0) * LOYALTY_RATES.a4;
    const rewardAlbum = (order.album_qty || 0) * LOYALTY_RATES.album;
    return reward4x6 + rewardA4 + rewardAlbum;
  };

  const isLoyaltyAdded = transactions.some(t => t.type === 'loyalty_earn');

  // --- مساعد لتوحيد رقم الجوال (بدون 0 وبدون 966) ---
  const normalizePhone = (raw) => {
    if (!raw) return '';
    let p = String(raw).replace(/\D/g, '');
    if (p.startsWith('966')) p = p.slice(3);
    if (p.startsWith('0')) p = p.slice(1);
    return p;
  };

  // --- خصم من المحفظة: مزامنة محفظة العميل مع خصم الطلب ---
  // يقوم بإنشاء/تحديث/حذف حركة wallet_spend لهذا الطلب، وتعديل رصيد المحفظة بفرق التغيير فقط.
  const syncWalletSpend = async (desiredAmount) => {
    const cleanPhone = normalizePhone(order?.phone);
    if (!cleanPhone) throw new Error('رقم الجوال غير صالح');

    // جلب المحفظة (لا ننشئها هنا لأن الصرف من محفظة غير موجودة غير منطقي)
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('phone', cleanPhone)
      .maybeSingle();
    if (walletError) throw walletError;
    if (!wallet) throw new Error('لا توجد محفظة لهذا العميل');

    // جلب حركة الصرف السابقة لهذا الطلب (إن وجدت)
    const { data: existingSpend, error: spendError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('order_id', id)
      .eq('type', 'wallet_spend')
      .maybeSingle();
    if (spendError) throw spendError;

    const prevAmount = existingSpend ? Number(existingSpend.amount_value || 0) : 0;
    const desired = Math.max(0, Number(desiredAmount || 0));
    const delta = desired - prevAmount; // موجب = صرف إضافي / سالب = استرجاع للمحفظة

    const currentBalance = Number(wallet.points_balance || 0);
    if (delta > 0 && currentBalance + 1e-9 < delta) {
      throw new Error(`رصيد المحفظة غير كافٍ. المتاح: ${currentBalance.toFixed(2)}`);
    }

    // تحديث رصيد المحفظة بفرق التغيير فقط
    if (Math.abs(delta) > 1e-9) {
      const newBalance = currentBalance - delta;
      const { error: updWalletErr } = await supabase
        .from('wallets')
        .update({ points_balance: newBalance })
        .eq('id', wallet.id);
      if (updWalletErr) throw updWalletErr;
    }

    // تحديث/إنشاء/حذف الحركة
    if (desired <= 1e-9) {
      if (existingSpend) {
        const { error: delErr } = await supabase.from('wallet_transactions').delete().eq('id', existingSpend.id);
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

  // --- إضافة نقاط الولاء (محسنة) ---
  const handleAddLoyaltyPoints = async () => {
    const rewardAmount = calculateLoyaltyReward();
    if (rewardAmount <= 0) return toast.error('لا يوجد كميات تستحق النقاط');

    // توحيد تنظيف الرقم
    const cleanPhone = normalizePhone(order.phone);
    if (!cleanPhone) return toast.error('لا يوجد رقم جوال صالح للعميل');

    const toastId = toast.loading('جاري التحقق والإضافة...');
    try {
      // 1. تحقق من التكرار في قاعدة البيانات (حماية إضافية)
      const { data: existing } = await supabase
        .from('wallet_transactions')
        .select('id')
        .eq('order_id', id)
        .eq('type', 'loyalty_earn')
        .maybeSingle();

      if (existing) {
        toast.dismiss(toastId);
        // تحديث الواجهة محلياً فقط في حال كانت البيانات ناقصة
        if (!isLoyaltyAdded) setTransactions(prev => [...prev, existing]);
        return toast.error('تمت إضافة النقاط لهذا الطلب مسبقاً!');
      }

      // 2. البحث عن المحفظة أو إنشاؤها
      let { data: wallet, error: walletError } = await supabase
        .from('wallets').select('*').eq('phone', cleanPhone).maybeSingle();

      if (walletError) throw walletError;

      if (!wallet) {
        const { data: newWallet, error: createError } = await supabase.from('wallets').insert([{
          phone: cleanPhone, points_balance: 0
        }]).select().single();
        if (createError) throw createError;
        wallet = newWallet;
      }

      // 3. التحديث والإضافة
      const { error: updateError } = await supabase.from('wallets').update({
        points_balance: (wallet.points_balance || 0) + rewardAmount
      }).eq('id', wallet.id);
      if (updateError) throw updateError;

      const { data: newTrans, error: transError } = await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        order_id: id,
        type: 'loyalty_earn',
        points: 0,
        amount_value: rewardAmount,
        created_at: new Date().toISOString()
      }).select().single();

      if (transError) throw transError;

      setTransactions(prev => [...prev, newTrans]);
      toast.dismiss(toastId);
      toast.success(`تم إضافة ${rewardAmount.toFixed(2)} ريال رصيد ولاء!`);

    } catch (err) {
      toast.dismiss(toastId);
      toast.error(`فشل العملية: ${err.message}`);
    }
  };

  // --- دالة الحساب والتحديث ---
  const recalculateAndSaveTotal = async (overrides = {}) => {
    try {
      const currentA4 = overrides.a4_qty ?? order.a4_qty;
      const current4x6 = overrides.photo_4x6_qty ?? order.photo_4x6_qty;
      const currentAlbumQty = overrides.album_qty ?? order.album_qty;
      const currentAlbumPrice = overrides.album_price ?? order.album_price;
      const currentDelivery = overrides.delivery_fee ?? deliveryFee;
      const currentDiscount = overrides.manual_discount ?? manualDiscount;

      const productsTotal = (Number(currentA4) * prices.a4) + (Number(current4x6) * prices.photo4x6);
      const albumsTotal = (Number(currentAlbumQty) * Number(currentAlbumPrice));

      const newSubtotal = productsTotal + albumsTotal;
      const newTotal = Math.max(0, newSubtotal + Number(currentDelivery) - Number(currentDiscount));
      const isPaid = order.deposit >= newTotal;

      const updatedData = {
        a4_qty: currentA4, photo_4x6_qty: current4x6,
        album_qty: currentAlbumQty, album_price: currentAlbumPrice,
        delivery_fee: currentDelivery, manual_discount: currentDiscount,
        subtotal: newSubtotal, total_amount: newTotal,
        payment_status: isPaid ? 'paid' : 'unpaid'
      };

      await supabase.from('orders').update(updatedData).eq('id', id);
      setOrder(prev => ({ ...prev, ...updatedData })); // تحديث وظيفي
      setDeliveryFee(currentDelivery);
      setManualDiscount(currentDiscount);
      return true;
    } catch (e) { toast.error('فشل الحساب'); return false; }
  };

  // --- الكوبونات ---
  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    const toastId = toast.loading('التحقق...');
    try {
      const { data: coupon, error } = await supabase
        .from('coupons').select('*').eq('code', couponCode.toUpperCase().trim()).eq('is_active', true).single();

      if (error || !coupon) {
        toast.dismiss(toastId); return toast.error('كود غير صالح');
      }

      // عند تطبيق كوبون: نعامله كخصم عادي، ونلغي أي صرف سابق من المحفظة لهذا الطلب
      try { await syncWalletSpend(0); } catch (_) { /* تجاهل */ }
      setDiscountSource('discount');

      const currentSubtotal = (order.a4_qty * prices.a4) + (order.photo_4x6_qty * prices.photo4x6) + (order.album_qty * order.album_price);
      let discountValue = coupon.discount_type === 'percent' ? Math.ceil(currentSubtotal * (coupon.discount_amount / 100)) : Number(coupon.discount_amount);

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
    } catch (err) { toast.dismiss(toastId); toast.error('خطأ'); }
  };

  // --- تحويل الفائض (محسنة) ---
  const convertExcessToWallet = async () => {
    const excessAmount = order.deposit - order.total_amount;
    if (excessAmount <= 0) return;

    // تنظيف الرقم لتوحيد التعامل
    const cleanPhone = normalizePhone(order.phone);
    if (!cleanPhone) return toast.error('رقم الجوال غير صالح');

    const toastId = toast.loading('تحويل...');
    try {
      // استخدام maybeSingle بدلاً من single لتجنب الخطأ
      let { data: wallet, error } = await supabase.from('wallets').select('*').eq('phone', cleanPhone).maybeSingle();

      if (error) throw error;

      if (!wallet) {
        const { data: newWallet, error: createError } = await supabase.from('wallets').insert([{ phone: cleanPhone, points_balance: 0 }]).select().single();
        if (createError) throw createError;
        wallet = newWallet;
      }

      await supabase.from('wallets').update({ points_balance: wallet.points_balance + excessAmount }).eq('id', wallet.id);

      const { data: newTrans } = await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id, order_id: id, type: 'deposit_excess', amount_value: excessAmount, points: 0
      }).select().single();

      if (newTrans) setTransactions(prev => [...prev, newTrans]);

      toast.dismiss(toastId);
      toast.success('تم التحويل للمحفظة');
    } catch (err) {
      toast.dismiss(toastId);
      console.error(err);
      toast.error('فشل التحويل');
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
    } catch { toast.error('فشل الحفظ'); }
  };

  const handleSaveProduction = async () => {
    const success = await recalculateAndSaveTotal({
      a4_qty: Number(productionData.a4_qty),
      photo_4x6_qty: Number(productionData.photo_4x6_qty),
      album_qty: Number(productionData.album_qty),
      album_price: Number(productionData.album_price)
    });
    if (success) { setIsEditingProduction(false); toast.success('تم التحديث'); }
  };

  const handleSaveDiscount = async () => {
    const theoreticalTotal = (Number(order.subtotal || 0) + Number(deliveryFee || 0));
    const discountValue = Math.min(theoreticalTotal, Math.max(0, Number(manualDiscount || 0)));
    const toastId = toast.loading('تحديث الخصم...');
    try {
      if (discountSource === 'wallet') {
        // خصم من المحفظة: نخصم فعلياً من رصيد المحفظة ونوثق الحركة
        await syncWalletSpend(discountValue);
      } else {
        // خصم عادي: إذا كان هناك صرف سابق من المحفظة لهذا الطلب نقوم بإلغائه وإرجاع الرصيد
        await syncWalletSpend(0);
      }

      const success = await recalculateAndSaveTotal({ manual_discount: discountValue });
      toast.dismiss(toastId);
      if (success) toast.success('تم تحديث الخصم');
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e?.message || 'فشل التحديث');
    }
  };

  const handleSaveDelivery = async () => {
    const success = await recalculateAndSaveTotal({ delivery_fee: Number(deliveryFee) });
    if (success) { setIsEditingDelivery(false); toast.success('تم تحديث التوصيل'); }
  };

  // --- إضافة دفعة (محسنة) ---
  const handleAddPayment = async () => {
    if (!newPayment.amount || Number(newPayment.amount) <= 0) return toast.error('مبلغ غير صحيح');
    try {
      const { data: payData, error } = await supabase.from('order_payments').insert([{
        order_id: id, amount: Number(newPayment.amount), payment_date: newPayment.date
      }]).select().single();

      if (error) throw error;

      const newTotalPaid = payments.reduce((sum, p) => sum + p.amount, 0) + Number(newPayment.amount);
      const isPaid = newTotalPaid >= order.total_amount;

      await supabase.from('orders').update({ deposit: newTotalPaid, payment_status: isPaid ? 'paid' : 'unpaid' }).eq('id', id);

      setPayments(prev => [...prev, payData]);
      setOrder(prev => ({ ...prev, deposit: newTotalPaid, payment_status: isPaid ? 'paid' : 'unpaid' }));
      setShowPaymentInput(false);
      setNewPayment({ amount: '', date: new Date().toISOString().split('T')[0] }); // تفريغ الحقل
      toast.success('تمت الإضافة');
    } catch { toast.error('فشل'); }
  };

  const handleDeletePayment = async (paymentId, amount) => {
    if (!window.confirm('حذف؟')) return;
    try {
      await supabase.from('order_payments').delete().eq('id', paymentId);
      const newTotalPaid = order.deposit - amount;
      await supabase.from('orders').update({ deposit: newTotalPaid, payment_status: newTotalPaid >= order.total_amount ? 'paid' : 'unpaid' }).eq('id', id);
      setPayments(prev => prev.filter(p => p.id !== paymentId));
      setOrder(prev => ({ ...prev, deposit: newTotalPaid, payment_status: newTotalPaid >= order.total_amount ? 'paid' : 'unpaid' }));
      toast.success('تم الحذف');
    } catch { toast.error('فشل'); }
  };

  // --- سداد كامل (محسنة) ---
  const markAsFullyPaid = async () => {
    const remaining = order.total_amount - order.deposit;
    if (remaining <= 0) return;
    try {
      const { data: payData, error } = await supabase.from('order_payments').insert([{
        order_id: id, amount: remaining, payment_date: new Date().toISOString().split('T')[0], note: 'سداد كامل تلقائي'
      }]).select().single();

      if (error) throw error;

      await supabase.from('orders').update({ deposit: order.total_amount, payment_status: 'paid' }).eq('id', id);

      setPayments(prev => [...prev, payData]); // تحديث محلي سريع
      setOrder(prev => ({ ...prev, deposit: order.total_amount, payment_status: 'paid' }));

      toast.success('تم السداد بالكامل');
    } catch (e) {
      toast.error('فشل العملية');
    }
  };

  const sendAutoWhatsAppMessage = async (orderData) => {
    try {
      const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (!settings || !settings.whatsapp_enabled || !settings.whatsapp_instance_id || !settings.whatsapp_token) return;
      if (!orderData.phone) return;

      let phone = orderData.phone.replace(/\D/g, '');
      if (phone.startsWith('0')) phone = '966' + phone.substring(1);

      const msg = `مرحباً ${orderData.customer_name} 🌸\n\nسعدنا بخدمتك في *لحظة فن*.\n\nيسرنا إخبارك بأن طلبك رقم *#${orderData.id.slice(0, 6)}* قد تم تسليمه/شحنه بنجاح! 📦✨`;

      await fetch(`https://api.ultramsg.com/${settings.whatsapp_instance_id}/messages/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: settings.whatsapp_token, to: phone, body: msg })
      });
      toast.success('تم إرسال رسالة واتساب تلقائية 🚀');
    } catch (error) { console.error('WhatsApp Error:', error); }
  };

  const sendWhatsApp = (type) => {
    if (!order.phone) return toast.error('لا يوجد رقم');
    const cleanPhone = order.phone.replace(/\D/g, '');
    const phone = cleanPhone.startsWith('0') ? '966' + cleanPhone.substring(1) : (cleanPhone.startsWith('966') ? cleanPhone : '966' + cleanPhone);
    const remaining = (order.total_amount - order.deposit).toFixed(2);
    let msg = "";
    if (type === 'ready') msg = `يا هلا ${order.customer_name} ✨\nطلبك رقم *${order.id.slice(0, 5)}* جاهز! 🎨\nالمتبقي: ${remaining} ر.س`;
    else if (type === 'invoice') msg = `أهلاً ${order.customer_name} 🌸\nطلب: ${order.id.slice(0, 5)}\nالإجمالي: ${order.total_amount}\nالمدفوع: ${order.deposit}\n*المتبقي: ${remaining}*`;
    else if (type === 'location') msg = `موقعنا: ...`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const updateStatus = async (newStatus) => {
    const dateField = `date_${newStatus}`;
    const now = new Date().toISOString();
    try {
      await supabase.from('orders').update({ status: newStatus, [dateField]: now }).eq('id', id);

      setOrder(prev => {
        const updated = { ...prev, status: newStatus, [dateField]: now };
        if (newStatus === 'delivered') {
          sendAutoWhatsAppMessage(updated);
        }
        return updated;
      });
      toast.success(`تم التحديث`);
    } catch { toast.error('فشل'); }
  };

  const handleDateChange = async (statusKey, newDateVal) => {
    if (!newDateVal) return;
    const dateField = `date_${statusKey}`;
    try {
      await supabase.from('orders').update({ [dateField]: new Date(newDateVal).toISOString() }).eq('id', id);
      setOrder(prev => ({ ...prev, [dateField]: new Date(newDateVal).toISOString() }));
      toast.success('تم التعديل');
    } catch { toast.error('فشل'); }
  };

  const handleDelete = async () => {
    if (!window.confirm('حذف نهائي؟')) return;
    try {
      await supabase.from('wallet_transactions').delete().eq('order_id', id);
      await supabase.from('order_payments').delete().eq('order_id', id);
      await supabase.from('orders').delete().eq('id', id);
      toast.success('تم الحذف');
      navigate('/app/orders');
    } catch { toast.error('فشل'); }
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

  const remaining = order.total_amount - order.deposit;
  const rewardAmount = calculateLoyaltyReward();

  return (
    <>
      <div className="max-w-6xl mx-auto pb-20 space-y-6 print:hidden">

        {/* Header */}
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/app/orders')} className="p-2 hover:bg-slate-100 rounded-xl"><ArrowRight /></button>
            <div><h1 className="text-2xl font-bold text-slate-900 font-mono">الطلب #{order.id.slice(0, 8)}</h1><p className="text-slate-500 text-xs">تفاصيل المعالجة</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrintLabel} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold hover:bg-slate-200 flex items-center gap-2 transition-colors"><StickyNote size={18} /> ملصق</button>
            <button onClick={handlePrint} className="btn-secondary flex items-center gap-2"><Printer size={16} /> فاتورة</button>
            <button onClick={handleDelete} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"><Trash2 size={18} /></button>
          </div>
        </div>

        {/* شريط الحالات */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="flex justify-between min-w-[500px]">
            {steps.map((step, index) => {
              const isActive = index <= currentStepIndex;
              const dateValue = order[`date_${step.key}`] ? new Date(order[`date_${step.key}`]).toISOString().split('T')[0] : '';
              return (
                <div key={step.key} className="flex flex-col items-center gap-3 flex-1 relative group">
                  <button onClick={() => updateStatus(step.key)} className={`flex flex-col items-center gap-2 ${isActive ? 'text-fuchsia-600' : 'text-slate-400'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-fuchsia-100 shadow-md scale-110' : 'bg-slate-100'}`}><step.icon size={20} /></div>
                    <span className="text-xs font-bold">{step.label}</span>
                  </button>
                  <div className="relative"><input type="date" value={dateValue} onChange={(e) => handleDateChange(step.key, e.target.value)} className={`text-[10px] bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-center w-24 focus:border-fuchsia-500 outline-none transition-opacity ${!dateValue && !isActive ? 'opacity-0 group-hover:opacity-50' : 'opacity-100'}`} /></div>
                  {index < steps.length - 1 && (<div className={`absolute top-5 right-[50%] left-[-50%] h-0.5 -z-10 ${index < currentStepIndex ? 'bg-fuchsia-200' : 'bg-slate-100'}`}></div>)}
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* بطاقة العميل */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold flex items-center gap-2"><User size={18} className="text-blue-500" /> العميل</h3>
              <button onClick={() => isEditingCustomer ? handleSaveCustomerData() : setIsEditingCustomer(true)} className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{isEditingCustomer ? 'حفظ' : 'تعديل'}</button>
            </div>
            <div className="space-y-4 text-sm">
              <div><span className="text-slate-500 text-xs block mb-1">الاسم</span>{isEditingCustomer ? (<input value={customerData.customer_name} onChange={e => setCustomerData({ ...customerData, customer_name: e.target.value })} className="w-full border rounded px-2 py-1 font-bold text-slate-900" />) : <div className="font-bold text-slate-900 text-lg">{order.customer_name}</div>}</div>
              <div><span className="text-slate-500 text-xs">الجوال</span>{isEditingCustomer ? <input value={customerData.phone} onChange={e => setCustomerData({ ...customerData, phone: e.target.value })} className="w-full border rounded px-2 py-1" /> : <div className="font-mono dir-ltr text-right">{order.phone}</div>}</div>
              <div><span className="text-slate-500 text-xs">تاريخ الطلب</span>{isEditingCustomer ? <input type="date" value={customerData.created_at} onChange={e => setCustomerData({ ...customerData, created_at: e.target.value })} className="w-full border rounded px-2 py-1" /> : <div className="font-mono text-slate-700">{order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB') : '-'}</div>}</div>
              <div><span className="text-slate-500 text-xs">تاريخ التسليم</span>{isEditingCustomer ? <input type="date" value={customerData.delivery_date} onChange={e => setCustomerData({ ...customerData, delivery_date: e.target.value })} className="w-full border rounded px-2 py-1" /> : <div className="text-red-600 font-bold">{order.delivery_date}</div>}</div>
              <div className="border-t border-slate-100 pt-3"><span className="text-slate-500 text-xs block mb-1">المنطقة / المدينة</span>{isEditingCustomer ? (<div className="flex flex-wrap gap-2">{CITIES.map(city => (<button key={city} onClick={() => setCustomerData({ ...customerData, source: city })} className={`px-2 py-1 text-xs border rounded ${customerData.source === city ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white'}`}>{city}</button>))}</div>) : <div className="flex items-center gap-1 text-slate-700 font-bold"><MapPin size={14} className="text-red-500" /> {order.source || 'غير محدد'}</div>}</div>
              {!isEditingCustomer && order.phone && (
                <div className="pt-4 border-t border-slate-50 space-y-2">
                  <a href={`https://wa.me/966${order.phone.startsWith('0') ? order.phone.substring(1) : order.phone}`} target="_blank" rel="noreferrer" className="block w-full text-center bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"><MessageCircle size={18} /> محادثة واتساب</a>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => sendWhatsApp('ready')} className="bg-fuchsia-50 text-fuchsia-700 text-xs py-2 rounded-lg font-bold hover:bg-fuchsia-100 border border-emerald-100 flex flex-col items-center gap-1"><CheckCircle size={14} /> جاهز للاستلام</button>
                    <button onClick={() => sendWhatsApp('invoice')} className="bg-blue-50 text-blue-700 text-xs py-2 rounded-lg font-bold hover:bg-blue-100 border border-blue-100 flex flex-col items-center gap-1"><Receipt size={14} /> الفاتورة</button>
                    <button onClick={() => sendWhatsApp('location')} className="bg-slate-50 text-slate-700 text-xs py-2 rounded-lg font-bold hover:bg-slate-100 border border-slate-200 flex flex-col items-center gap-1"><MapPin size={14} /> الموقع</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* بطاقة الإنتاج */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2"><FileText size={18} className="text-orange-500" /> الإنتاج</h3>
              <button onClick={() => isEditingProduction ? handleSaveProduction() : setIsEditingProduction(true)} className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">{isEditingProduction ? 'حفظ' : 'تعديل'}</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-50 p-2 rounded text-center"><span className="text-xs block text-slate-400">4x6</span>{isEditingProduction ? <input type="number" value={productionData.photo_4x6_qty} onChange={e => setProductionData({ ...productionData, photo_4x6_qty: e.target.value })} className="w-full text-center" /> : <span className="font-bold text-xl">{order.photo_4x6_qty}</span>}</div>
              <div className="bg-slate-50 p-2 rounded text-center"><span className="text-xs block text-slate-400">A4</span>{isEditingProduction ? <input type="number" value={productionData.a4_qty} onChange={e => setProductionData({ ...productionData, a4_qty: e.target.value })} className="w-full text-center" /> : <span className="font-bold text-xl">{order.a4_qty}</span>}</div>
            </div>
            <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 mb-4 flex gap-2 text-center text-sm">
              <div className="flex-1"><span className="block text-[10px] text-slate-400">عدد الألبومات</span>{isEditingProduction ? <input type="number" value={productionData.album_qty} onChange={e => setProductionData({ ...productionData, album_qty: e.target.value })} className="w-full text-center border rounded" /> : <b>{order.album_qty}</b>}</div>
              <div className="flex-1"><span className="block text-[10px] text-slate-400">سعر الألبوم</span>{isEditingProduction ? <input type="number" value={productionData.album_price} onChange={e => setProductionData({ ...productionData, album_price: e.target.value })} className="w-full text-center border rounded" /> : <b>{order.album_price}</b>}</div>
            </div>
            <textarea className="w-full bg-yellow-50 border border-yellow-200 rounded-xl p-2 text-sm focus:outline-none h-20" value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات..." />
            <button onClick={saveNotes} className="mt-2 text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg w-full">حفظ الملاحظة</button>
          </div>

          {/* بطاقة الحسابات */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg flex flex-col h-full">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Banknote className="text-fuchsia-400" /> الحسابات</h3>
            <div className="space-y-3 text-sm flex-1">
              <div className="flex justify-between text-slate-400"><span>المجموع (منتجات)</span><span>{order.subtotal?.toFixed(2)}</span></div>
              <div className="flex justify-between items-center text-slate-300"><span>التوصيل</span>{isEditingDelivery ? <div className="flex gap-1"><input type="number" value={deliveryFee} onChange={e => setDeliveryFee(Number(e.target.value))} className="w-12 bg-slate-800 border rounded text-center" /><button onClick={handleSaveDelivery} className="text-fuchsia-400 text-xs">ok</button></div> : <button onClick={() => setIsEditingDelivery(true)}>{deliveryFee}</button>}</div>

              {/* === خانة الخصم مع اختيار مصدره (خصم/محفظة) === */}
              <div className="flex justify-between items-center bg-slate-800 p-2 rounded mb-2">
                <div className="flex items-center gap-2 text-fuchsia-300">
                  <span className="flex items-center gap-2"><Tag size={14} /> خصم / محفظة</span>
                  <div className="flex items-center gap-1 bg-slate-900/30 p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setDiscountSource('discount')}
                      className={`px-1.5 py-1 rounded-md text-[10px] flex items-center gap-1 transition-colors ${discountSource === 'discount' ? 'bg-fuchsia-600 text-white' : 'text-slate-300 hover:text-white'}`}
                      title="خصم عادي"
                    >
                      <Tag size={10} /> خصم
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountSource('wallet')}
                      className={`px-1.5 py-1 rounded-md text-[10px] flex items-center gap-1 transition-colors ${discountSource === 'wallet' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:text-white'}`}
                      title="خصم من المحفظة"
                    >
                      <Wallet size={10} /> محفظة
                    </button>
                  </div>
                </div>

                <div className="flex gap-1">
                  <input
                    type="number"
                    value={manualDiscount}
                    onChange={e => setManualDiscount(Number(e.target.value))}
                    onKeyDown={e => e.key === 'Enter' && handleSaveDiscount()}
                    className="w-20 bg-slate-700 border border-slate-600 rounded text-center font-bold text-white focus:border-fuchsia-500 outline-none"
                  />
                  <button onClick={handleSaveDiscount} className="text-xs text-fuchsia-400 hover:text-white bg-fuchsia-900/50 hover:bg-fuchsia-600 px-2 rounded transition-colors">حفظ</button>
                </div>
              </div>
              {/* ========================================= */}

              <div className="border-t border-white/10 my-2"></div>
              <div className="flex justify-between text-white text-lg font-bold mb-4"><span>الإجمالي بعد الخصم</span><span>{order.total_amount.toFixed(2)} ر.س</span></div>

              <div className="bg-white/10 rounded-xl p-3">
                <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                  <span className="text-fuchsia-400 font-bold">سجل المدفوعات</span>
                  <button onClick={() => setShowPaymentInput(!showPaymentInput)} className="text-xs bg-fuchsia-500/20 text-fuchsia-300 px-2 py-1 rounded hover:bg-fuchsia-500/40 flex items-center gap-1"><Plus size={12} /> إضافة</button>
                </div>
                {showPaymentInput && (
                  <div className="flex gap-2 mb-2 animate-in fade-in slide-in-from-top-2">
                    <input type="date" value={newPayment.date} onChange={e => setNewPayment({ ...newPayment, date: e.target.value })} className="w-24 bg-slate-800 border border-slate-600 rounded text-xs px-1 text-white" />
                    <input type="number" placeholder="المبلغ" value={newPayment.amount} onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })} className="flex-1 bg-slate-800 border border-slate-600 rounded text-xs px-2 text-white" />
                    <button onClick={handleAddPayment} className="bg-gradient-to-b from-fuchsia-600 to-purple-600 text-white px-2 rounded text-xs">حفظ</button>
                  </div>
                )}
                <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {payments.length === 0 ? <p className="text-xs text-slate-500 text-center py-2">لا توجد دفعات مسجلة</p> : payments.map((p) => (
                    <div key={p.id} className="flex justify-between items-center text-xs bg-slate-800/50 px-2 py-1.5 rounded group">
                      <span className="font-mono text-slate-400">{new Date(p.payment_date).toLocaleDateString('en-GB')}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{p.amount}</span>
                        <button onClick={() => handleDeletePayment(p.id, p.amount)} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-300"><X size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2 mt-2"><span className="text-xs text-slate-400">إجمالي المدفوع</span><span className="font-bold text-fuchsia-400">{order.deposit}</span></div>
              </div>

              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="كود خصم" className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs outline-none pl-6" />
                  <Tag size={10} className="absolute left-2 top-2 text-slate-400" />
                </div>
                <button onClick={applyCoupon} className="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-xs text-white">تطبيق</button>
              </div>

              {rewardAmount > 0 && (
                <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-amber-400 text-xs font-bold flex items-center gap-1"><Gift size={12} /> نقاط ولاء مستحقة</span>
                    <span className="text-amber-300 font-bold">{rewardAmount.toFixed(2)} ريال</span>
                  </div>
                  {isLoyaltyAdded ? (
                    <div className="text-xs text-center bg-amber-500/20 text-amber-200 py-1 rounded flex items-center justify-center gap-1"><CheckCircle size={10} /> تم الإضافة للمحفظة</div>
                  ) : (
                    <button onClick={handleAddLoyaltyPoints} className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs py-1.5 rounded transition-colors shadow-sm">
                      إضافة لرصيد العميل
                    </button>
                  )}
                </div>
              )}

              <div className={`p-3 rounded-xl text-center border ${remaining <= 0 ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'bg-red-500/20 text-red-300'}`}>
                <span className="text-xs block">المتبقي</span>
                <span className="text-xl font-black">{remaining <= 0 ? 'خالص ✅' : remaining.toFixed(2)}</span>
              </div>
              {remaining > 0 && <button onClick={markAsFullyPaid} className="w-full py-2 bg-white text-slate-900 rounded-lg font-bold text-xs">سداد كامل</button>}

              {remaining < 0 && (
                <button onClick={convertExcessToWallet} className="w-full py-2 bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs mt-2 flex items-center justify-center gap-2 hover:bg-indigo-200 transition-colors">
                  <Wallet size={14} /> تحويل الفائض ({Math.abs(remaining).toFixed(2)}) للمحفظة
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. الفاتورة القابلة للطباعة */}
      <div id="printable-invoice" className="hidden print:block bg-white text-black print-no-extra-space">
        <div className="mx-auto">
          {/* رأس الفاتورة */}
          <div className="no-break flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <img src={logo} alt="Art Moment" className="w-12 h-12 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                <h1 className="text-2xl font-black text-slate-900">Art Moment</h1>
              </div>
              <p className="text-xs text-slate-500">لحظة فن للطباعة</p>
            </div>
            <div className="text-left">
              <h2 className="text-base font-bold font-mono text-slate-700">فاتورة #{order.id.slice(0, 8)}</h2>
              <p className="text-xs text-slate-500 mt-1">التاريخ: {new Date(order.created_at).toLocaleDateString('en-GB')}</p>
            </div>
          </div>

          {/* بيانات العميل */}
          <div className="no-break grid grid-cols-2 gap-6 mb-4">
            <div>
              <h3 className="font-bold text-[10px] text-slate-400 mb-1 uppercase tracking-wider">العميل</h3>
              <p className="text-lg font-bold text-slate-900 leading-tight">{order.customer_name}</p>
              <p className="text-xs text-slate-700 dir-ltr text-right font-mono">{order.phone}</p>
              {order.source && <p className="text-xs text-slate-500 mt-1">{order.source}</p>}
            </div>
            <div className="text-left">
              <h3 className="font-bold text-[10px] text-slate-400 mb-1 uppercase tracking-wider">التسليم</h3>
              <p className="font-bold text-sm text-slate-800">{order.delivery_date || 'غير محدد'}</p>
              {order.status === 'delivered' && (
                <span className="inline-block bg-slate-100 px-2 py-1 rounded text-[10px] mt-2 font-bold">تم التسليم</span>
              )}
            </div>
          </div>

          {/* جدول المنتجات */}
          <table className="w-full mb-4">
            <thead className="bg-slate-50 border-y border-slate-200">
              <tr>
                <th className="py-2 px-2 text-right text-xs font-bold text-slate-600">الوصف</th>
                <th className="py-2 px-2 text-center text-xs font-bold text-slate-600">الكمية</th>
                <th className="py-2 px-2 text-left text-xs font-bold text-slate-600">السعر</th>
                <th className="py-2 px-2 text-left text-xs font-bold text-slate-600">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.photo_4x6_qty > 0 && (
                <tr>
                  <td className="py-2 px-2 text-xs font-medium">طباعة صور 4×6</td>
                  <td className="py-2 px-2 text-center text-xs font-bold">{order.photo_4x6_qty}</td>
                  <td className="py-2 px-2 text-left text-xs text-slate-500">{prices.photo4x6}</td>
                  <td className="py-2 px-2 text-left text-xs font-bold">{(order.photo_4x6_qty * prices.photo4x6).toFixed(2)}</td>
                </tr>
              )}
              {order.a4_qty > 0 && (
                <tr>
                  <td className="py-2 px-2 text-xs font-medium">طباعة صور A4</td>
                  <td className="py-2 px-2 text-center text-xs font-bold">{order.a4_qty}</td>
                  <td className="py-2 px-2 text-left text-xs text-slate-500">{prices.a4}</td>
                  <td className="py-2 px-2 text-left text-xs font-bold">{(order.a4_qty * prices.a4).toFixed(2)}</td>
                </tr>
              )}
              {order.album_qty > 0 && (
                <tr>
                  <td className="py-2 px-2 text-xs font-medium">ألبومات صور</td>
                  <td className="py-2 px-2 text-center text-xs font-bold">{order.album_qty}</td>
                  <td className="py-2 px-2 text-left text-xs text-slate-500">{order.album_price}</td>
                  <td className="py-2 px-2 text-left text-xs font-bold">{(order.album_qty * order.album_price).toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* الملخص المالي */}
          <div className="no-break flex justify-end mb-4">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-xs text-slate-600 border-b border-slate-100 pb-1">
                <span>المجموع الفرعي</span>
                <span className="font-bold">{order.subtotal?.toFixed(2)}</span>
              </div>
              {order.delivery_fee > 0 && (
                <div className="flex justify-between text-xs text-slate-600 border-b border-slate-100 pb-1">
                  <span>التوصيل</span>
                  <span className="font-bold">{order.delivery_fee}</span>
                </div>
              )}
              {(() => {
                const theoreticalTotal = (order.subtotal || 0) + (order.delivery_fee || 0);
                const discount = theoreticalTotal - order.total_amount;
                return discount > 0.01 && (
                  <div className="flex justify-between text-xs text-red-600 border-b border-slate-100 pb-1">
                    <span>خصم / محفظة</span>
                    <span>-{discount.toFixed(2)}</span>
                  </div>
                );
              })()}
              <div className="flex justify-between font-black text-lg pt-1">
                <span>الإجمالي</span>
                <span>{order.total_amount} ر.س</span>
              </div>
              <div className="flex justify-between text-xs pt-1 text-slate-500">
                <span>المدفوع</span>
                <span className="font-bold">{order.deposit}</span>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t-2 border-slate-800 mt-2">
                <span className="font-bold text-slate-900 mt-1">المتبقي</span>
                <span className={`font-black text-base mt-1 ${remaining > 0 ? 'text-red-600' : 'text-slate-900'}`}>{remaining.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* التذييل */}
          <div className="no-break text-center border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-800 mb-1">شكراً لاختياركم لحظة فن ✨</p>
            <p className="text-[10px] text-slate-400">نسعد بخدمتكم دائماً | تواصل معنا للاستفسار</p>
          </div>
        </div>
      </div>
    </>
  );
}
