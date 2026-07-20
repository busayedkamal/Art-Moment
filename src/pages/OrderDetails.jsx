// src/pages/OrderDetails.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import {
  ArrowRight, Printer, CheckCircle, Truck, Trash2,
  Banknote, FileText, User, Download,
  MessageCircle, X, Tag, Receipt, StickyNote, Plus, Wallet, Gift, Package,
  Clock, RotateCcw, AlertCircle, Pencil, Save, Loader2
} from 'lucide-react';
import logo from '../assets/logo-art-moment.svg';
import logoPng from '../assets/logo.png';
import RiyalSign from '../components/RiyalSign';
import OrderFinancialBreakdown from '../components/OrderFinancialBreakdown';
import { getPrintOrderFinancials, roundMoney } from '../utils/orderFinancials';
import { choosePreferredWallet } from '../utils/walletBalances';
import {
  calculateEarnedRewardPoints,
  getRewardRedemptionLimit,
  getWalletRewardPoints,
  normalizeRewardRules,
  pointsToRewardValue,
  rewardValueToPoints,
} from '../utils/rewardPoints';

const STATUS_CONFIG = {
  pending_verification: { label: 'انتظار التحقق', bgClass: 'bg-blue-100',    textClass: 'text-blue-700',    btnClass: 'bg-blue-600 hover:bg-blue-500 text-white',     icon: Clock },
  confirmed:            { label: 'مؤكد',          bgClass: 'bg-indigo-100',  textClass: 'text-indigo-700',  btnClass: 'bg-indigo-600 hover:bg-indigo-500 text-white',  icon: CheckCircle },
  processing:           { label: 'قيد الإنتاج',   bgClass: 'bg-amber-100',   textClass: 'text-amber-700',   btnClass: 'bg-amber-500 hover:bg-amber-400 text-white',    icon: Printer },
  ready_for_delivery:   { label: 'جاهز للتسليم',  bgClass: 'bg-teal-100',    textClass: 'text-teal-700',    btnClass: 'bg-teal-600 hover:bg-teal-500 text-white',      icon: Package },
  shipped:              { label: 'تم الشحن',       bgClass: 'bg-cyan-100',    textClass: 'text-cyan-700',    btnClass: 'bg-cyan-600 hover:bg-cyan-500 text-white',      icon: Truck },
  delivered:            { label: 'تم الاستلام',    bgClass: 'bg-emerald-100', textClass: 'text-emerald-700', btnClass: 'bg-emerald-600 hover:bg-emerald-500 text-white', icon: CheckCircle },
  cancelled:            { label: 'ملغي',           bgClass: 'bg-red-100',     textClass: 'text-red-700',     btnClass: 'bg-red-600 hover:bg-red-500 text-white',        icon: X },
  returned:             { label: 'مرتجع',          bgClass: 'bg-orange-100',  textClass: 'text-orange-700',  btnClass: 'bg-orange-500 hover:bg-orange-400 text-white',  icon: RotateCcw },
  // حالات النظام القديم
  new:      { label: 'جديد',   bgClass: 'bg-blue-100',  textClass: 'text-blue-700',  btnClass: 'bg-blue-600 hover:bg-blue-500 text-white',   icon: FileText },
  printing: { label: 'طباعة',  bgClass: 'bg-amber-100', textClass: 'text-amber-700', btnClass: 'bg-amber-500 hover:bg-amber-400 text-white',  icon: Printer },
  done:     { label: 'جاهز',   bgClass: 'bg-purple-50',  textClass: 'text-purple-700',  btnClass: 'bg-purple-600 hover:bg-purple-500 text-white',    icon: CheckCircle },
};

const VALID_TRANSITIONS = {
  pending_verification: ['confirmed', 'cancelled'],
  confirmed:            ['processing', 'cancelled'],
  processing:           ['ready_for_delivery', 'cancelled'],
  ready_for_delivery:   ['shipped', 'delivered', 'cancelled'],
  shipped:              ['delivered', 'returned'],
  delivered:            ['returned'],
  cancelled:            ['confirmed'],
  returned:             [],
  // حالات النظام القديم
  new:      ['printing', 'done', 'delivered', 'confirmed', 'processing'],
  printing: ['done', 'ready_for_delivery', 'delivered'],
  done:     ['delivered', 'ready_for_delivery'],
};

const paymentAmountFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function escapeLabelHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [appSettings, setAppSettings] = useState(null);
  const [prices, setPrices] = useState({ a4: 0, photo4x6: 0 });

  const CITIES = ['الرميلة', 'المبرز', 'الهفوف', 'الدمام', 'الخبر', 'العمران', 'أخرى'];

  const [payments, setPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const [newPayment, setNewPayment] = useState({ amount: '', date: new Date().toISOString().split('T')[0] });

  const [manualDiscount, setManualDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [isEditingDelivery, setIsEditingDelivery] = useState(false);

  // مصدر الخصم ومبالغ منفصلة لكل نظام
  const [discountSource, setDiscountSource] = useState('discount'); // 'discount' | 'wallet' | 'package'
  const [customerPackageBalance, setCustomerPackageBalance] = useState(0);
  const [packageDiscountInput, setPackageDiscountInput] = useState('');
  const [pointsDiscountInput, setPointsDiscountInput] = useState('');
  const [customerPointsBalance, setCustomerPointsBalance] = useState(0);
  const [customerRewardPoints, setCustomerRewardPoints] = useState(0);
  const [walletSubscriptionId, setWalletSubscriptionId] = useState(''); // رقم الاشتراك (wallet id)
  const [showFinancialEditor, setShowFinancialEditor] = useState(false);
  const [savingFinancialEditor, setSavingFinancialEditor] = useState(false);
  const [financialEdit, setFinancialEdit] = useState({
    directDiscount: '', couponDiscount: '', couponCode: '', packageDiscount: '', pointsUsed: ''
  });

  const [notes, setNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [activeCoupons, setActiveCoupons] = useState([]);

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

  const [statusHistory, setStatusHistory] = useState([]);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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

  // ✅ يُرجع المحفظة الفعلية عند وجود سجلات قديمة مكررة لنفس الجوال.
  const findWalletByPhone = async (rawPhone) => {
    const wallets = await findAllWalletsByPhone(rawPhone);
    return choosePreferredWallet(wallets);
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

      const { data: couponsData } = await supabase.from('coupons').select('*').eq('is_active', true);
      if (couponsData) setActiveCoupons(couponsData);

      const { data: historyData } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: false });
      setStatusHistory(historyData || []);

      setOrder(orderData);
      setPayments(paymentsData || []);
      setTransactions(transData || []);

      // تحديد مصدر الخصم الحالي
      const hasWalletSpend = (transData || []).some(t => ['redeem', 'reward_points_redeem'].includes(t.type));
      const hasPkgRedeem = (transData || []).some(t => t.type === 'package_redeem');
      setDiscountSource(hasPkgRedeem ? 'package' : hasWalletSpend ? 'wallet' : 'discount');

      // جلب رصيد الباقات والنقاط للعميل مع عدم جمع المحافظ القديمة المكررة.
      if (orderData.phone) {
        const allWallets = await findAllWalletsByPhone(orderData.phone);
        const allWalletIds = allWallets.map(w => w.id);
        const preferredWallet = choosePreferredWallet(allWallets);

        const activeRewardRules = normalizeRewardRules(settingsData || {});
        const availableRewardPoints = getWalletRewardPoints(preferredWallet, activeRewardRules);
        setCustomerRewardPoints(availableRewardPoints);
        setCustomerPointsBalance(pointsToRewardValue(availableRewardPoints, activeRewardRules));

        // رقم الاشتراك من حقل subscription_code في جدول wallets
        setWalletSubscriptionId(preferredWallet?.subscription_code || '');

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
          const existPts = (transData || []).find(t => ['redeem', 'reward_points_redeem'].includes(t.type));
          if (existPkg) setPackageDiscountInput(existPkg.amount_value?.toString() || '');
          if (existPts) {
            const usedPoints = Math.abs(Number(existPts.reward_points_delta || 0))
              || rewardValueToPoints(existPts.amount_value, activeRewardRules);
            setPointsDiscountInput(String(usedPoints));
          }
      }

      const initialFinancials = getPrintOrderFinancials(orderData, transData || []);
      setManualDiscount(initialFinancials.directDiscount);
      setDeliveryFee(Number(orderData.delivery_fee || 0));
      setNotes(orderData.notes || '');
      setCouponCode(initialFinancials.couponCode || '');

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
    const rewardRules = normalizeRewardRules(appSettings || {});
    if (!order || !rewardRules.enabled) return { points: 0, value: 0, eligibleAmount: 0 };
    const currentFinancials = getPrintOrderFinancials(order, transactions);
    const eligibleAmount = Math.max(0, Math.min(
      currentFinancials.cashPaid,
      currentFinancials.totalAmount - currentFinancials.deliveryFee - currentFinancials.pointsUsed,
    ));
    const points = calculateEarnedRewardPoints(eligibleAmount, rewardRules);
    return {
      points,
      value: pointsToRewardValue(points, rewardRules),
      eligibleAmount: roundMoney(eligibleAmount),
    };
  };

  const isLoyaltyAdded = transactions.some(t => ['loyalty_earn', 'reward_points_earn'].includes(t.type))
    || Number(order?.reward_points_earned || 0) > 0;

  // ✅ مزامنة خصم المحفظة (redeem) مع رصيد العميل — فرق التغيير فقط
  const syncWalletSpend = async (desiredAmount) => {
    const allWallets = await findAllWalletsByPhone(order?.phone);
    if (allWallets.length === 0) throw new Error('لا توجد محفظة لهذا العميل');
    const rewardRules = normalizeRewardRules(appSettings || {});
    const wallet = choosePreferredWallet(allWallets, rewardRules);
    const desired = Math.max(0, Number(desiredAmount || 0));
    const requestedPoints = rewardValueToPoints(desired, rewardRules);
    const currentFinancials = getPrintOrderFinancials(order, transactions);
    const orderValue = Math.max(0, currentFinancials.totalAmount - currentFinancials.deliveryFee);

    const { data: result, error } = await supabase.rpc('set_reward_points_redemption', {
      p_wallet_id: wallet.id,
      p_source_type: 'print_order',
      p_source_id: id,
      p_requested_points: requestedPoints,
      p_order_value: orderValue,
    });
    if (error) throw error;

    const { data: refreshedTransactions, error: refreshError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('order_id', id);
    if (refreshError) throw refreshError;
    setTransactions(refreshedTransactions || []);
    setCustomerRewardPoints(Number(result?.balancePoints || 0));
    setCustomerPointsBalance(Number(result?.balanceValue || 0));
    return result;
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

    const availablePackageBalance = Object.values(balanceByWallet)
      .reduce((sum, balance) => sum + Math.max(0, Number(balance || 0)), 0);

    if (delta > 0 && availablePackageBalance + 1e-9 < delta) {
      throw new Error(`رصيد الباقات غير كافٍ. المتاح: ${availablePackageBalance.toFixed(2)}`);
    }

    if (desired <= 1e-9) {
      if (existingSpend) {
        await supabase.from('wallet_transactions').delete().eq('id', existingSpend.id);
        setTransactions(prev => prev.filter(t => t.id !== existingSpend.id));
        setCustomerPackageBalance(prev => prev + prevAmount);
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
    const reward = calculateLoyaltyReward();
    if (order.status !== 'delivered' || order.payment_status !== 'paid') {
      return toast.error('تُضاف النقاط بعد اكتمال الدفع وتسليم الطلب');
    }
    if (reward.points <= 0) return toast.error('لا يوجد مبلغ مدفوع مؤهل للنقاط');

    const cleanPhone = normalizePhone(order.phone);
    if (!cleanPhone) return toast.error('لا يوجد رقم جوال صالح للعميل');

    const toastId = toast.loading('جاري التحقق والإضافة...');
    try {
      const rewardRules = normalizeRewardRules(appSettings || {});
      const existingWallets = await findAllWalletsByPhone(cleanPhone);
      let wallet = choosePreferredWallet(existingWallets, rewardRules);

      if (!wallet) {
        const { data: newWallet, error: createError } = await supabase
          .from('wallets')
          .insert([{ phone: cleanPhone, points_balance: 0, reward_points_balance: 0 }])
          .select()
          .single();
        if (createError) throw createError;
        wallet = newWallet;
      }

      const { data: result, error: rewardError } = await supabase.rpc('reconcile_reward_points_award', {
        p_wallet_id: wallet.id,
        p_source_type: 'print_order',
        p_source_id: id,
        p_eligible_amount: reward.eligibleAmount,
        p_description: 'طلب طباعة مدفوع ومكتمل',
      });
      if (rewardError) throw rewardError;

      const { data: refreshedTransactions } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('order_id', id);
      setTransactions(refreshedTransactions || []);
      setCustomerRewardPoints(Number(result?.balancePoints || 0));
      setCustomerPointsBalance(Number(result?.balanceValue || 0));
      setOrder((current) => ({ ...current, reward_points_earned: reward.points }));
      toast.dismiss(toastId);
      toast.success(`تم احتساب ${reward.points.toLocaleString()} نقطة`);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(`فشل العملية: ${err.message}`);
    }
  };

  // ✅ تعديل كبير: دالة الحساب الآن تستخدم Subtotal الموجود إذا لم يتم تعديل الكميات
  const recalculateAndSaveTotal = async (overrides = {}) => {
    try {
      let newSubtotal = Number(order.subtotal || 0);
      let active4x6Price = Number(order.photo_4x6_unit_price || prices.photo4x6 || 0);
      const activeA4Price = Number(order.a4_unit_price || prices.a4 || 0);

      // نحسب من جديد فقط إذا قمنا بتعديل محتويات الطلب (A4, 4x6, الخ)
      if ('a4_qty' in overrides || 'photo_4x6_qty' in overrides || 'album_qty' in overrides || 'album_price' in overrides) {
        const currentA4 = overrides.a4_qty ?? order.a4_qty;
        const current4x6 = overrides.photo_4x6_qty ?? order.photo_4x6_qty;
        const currentAlbumQty = overrides.album_qty ?? order.album_qty;
        const currentAlbumPrice = overrides.album_price ?? order.album_price;
        
        active4x6Price = prices.photo4x6;
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

      const currentFinancials = getPrintOrderFinancials(order, transactions);
      const currentDelivery = Number(overrides.delivery_fee ?? deliveryFee ?? 0);
      const theoreticalTotal = Math.max(0, newSubtotal + currentDelivery);
      const safeDirectDiscount = Math.min(
        theoreticalTotal,
        Math.max(0, Number(overrides.direct_discount_amount ?? currentFinancials.directDiscount ?? 0)),
      );
      const safeCouponDiscount = Math.min(
        Math.max(0, theoreticalTotal - safeDirectDiscount),
        Math.max(0, Number(overrides.coupon_discount_amount ?? currentFinancials.couponDiscount ?? 0)),
      );
      const safePackageDiscount = Math.min(
        Math.max(0, theoreticalTotal - safeDirectDiscount - safeCouponDiscount),
        Math.max(0, Number(overrides.package_discount_amount ?? currentFinancials.packageDiscount ?? 0)),
      );
      const totalPriceDiscount = roundMoney(safeDirectDiscount + safeCouponDiscount + safePackageDiscount);
      const newTotal = Math.max(0, roundMoney(theoreticalTotal - totalPriceDiscount));
      const safePointsUsed = Math.min(
        newTotal,
        Math.max(0, Number(overrides.points_used_amount ?? overrides.wallet_used ?? currentFinancials.pointsUsed ?? 0)),
      );
      const isPaid = (Number(order.deposit || 0) + safePointsUsed) >= newTotal;

      const updatedData = {
        financial_schema_version: 2,
        a4_qty: overrides.a4_qty ?? order.a4_qty,
        photo_4x6_qty: overrides.photo_4x6_qty ?? order.photo_4x6_qty,
        album_qty: overrides.album_qty ?? order.album_qty,
        album_price: overrides.album_price ?? order.album_price,
        photo_4x6_unit_price: active4x6Price,
        a4_unit_price: activeA4Price,
        delivery_fee: currentDelivery,
        direct_discount_amount: safeDirectDiscount,
        coupon_discount_amount: safeCouponDiscount,
        coupon_code: overrides.coupon_code ?? currentFinancials.couponCode,
        package_discount_amount: safePackageDiscount,
        points_used_amount: safePointsUsed,
        manual_discount: totalPriceDiscount,
        subtotal: newSubtotal,
        total_amount: newTotal,
        wallet_used: safePointsUsed,
        payment_status: isPaid ? 'paid' : 'unpaid'
      };

      const { error: updateError } = await supabase.from('orders').update(updatedData).eq('id', id);
      if (updateError) throw updateError;
      setOrder(prev => ({ ...prev, ...updatedData }));
      setDeliveryFee(currentDelivery);
      setManualDiscount(safeDirectDiscount);
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

      setDiscountSource('discount');

      const currentSubtotal = Number(order.subtotal || 0);

      let discountValue =
        coupon.discount_type === 'percent'
          ? Math.ceil(currentSubtotal * (Number(coupon.discount_amount || 0) / 100))
          : Number(coupon.discount_amount || 0);

      const success = await recalculateAndSaveTotal({
        coupon_discount_amount: discountValue,
        coupon_code: coupon.code,
      });

      toast.dismiss(toastId);
      if (success) {
        setCouponCode(coupon.code);

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

    const excessAmount = getPrintOrderFinancials(order, transactions).overpaidAmount;
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
          .insert([{ phone: cleanPhone, points_balance: 0, reward_points_balance: 0, store_credit_balance: 0 }])
          .select()
          .single();
        if (createError) throw createError;
        wallet = newWallet;
      }

      const { error: creditError } = await supabase.rpc('adjust_store_credit', {
        p_wallet_id: wallet.id,
        p_amount_delta: excessAmount,
        p_reason: 'فائض دفعة طلب طباعة',
        p_source_type: 'print_order',
        p_source_id: id,
      });
      if (creditError) throw creditError;

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
      toast.success('تم تحويل الفائض إلى رصيد متجر مستقل وتصفير حساب الطلب');
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
      const success = await recalculateAndSaveTotal({ direct_discount_amount: discountValue });
      toast.dismiss(toastId);
      if (success) toast.success('تم تحديث الخصم');
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e?.message || 'فشل التحديث');
    }
  };

  const openFinancialEditor = () => {
    const current = getPrintOrderFinancials(order, transactions);
    setFinancialEdit({
      directDiscount: current.directDiscount.toFixed(2),
      couponDiscount: current.couponDiscount.toFixed(2),
      couponCode: current.couponCode || '',
      packageDiscount: current.packageDiscount.toFixed(2),
      pointsUsed: current.pointsUsed.toFixed(2),
    });
    setShowFinancialEditor(true);
  };

  const handleSaveFinancialBreakdown = async () => {
    if (savingFinancialEditor) return;

    const current = getPrintOrderFinancials(order, transactions);
    const next = {
      directDiscount: Number(financialEdit.directDiscount || 0),
      couponDiscount: Number(financialEdit.couponDiscount || 0),
      couponCode: financialEdit.couponCode.trim().toUpperCase(),
      packageDiscount: Number(financialEdit.packageDiscount || 0),
      pointsUsed: Number(financialEdit.pointsUsed || 0),
    };
    const numericValues = [next.directDiscount, next.couponDiscount, next.packageDiscount, next.pointsUsed];

    if (numericValues.some(value => !Number.isFinite(value) || value < 0)) {
      return toast.error('أدخل مبالغ صحيحة لا تقل عن صفر');
    }

    const priceDiscounts = roundMoney(next.directDiscount + next.couponDiscount + next.packageDiscount);
    if (priceDiscounts > current.grossAmount + 0.01) {
      return toast.error('مجموع خصومات السعر أكبر من إجمالي الطلب');
    }

    const totalAfterDiscounts = roundMoney(current.grossAmount - priceDiscounts);
    if (next.pointsUsed > totalAfterDiscounts + 0.01) {
      return toast.error('المبلغ المدفوع بالنقاط أكبر من قيمة الطلب بعد الخصومات');
    }

    const packageChanged = Math.abs(next.packageDiscount - current.packageDiscount) > 0.009;
    const pointsChanged = Math.abs(next.pointsUsed - current.pointsUsed) > 0.009;
    const toastId = toast.loading('جاري تصحيح الحساب...');
    setSavingFinancialEditor(true);

    try {
      if (packageChanged) await syncPackageSpend(next.packageDiscount);
      if (pointsChanged) await syncWalletSpend(next.pointsUsed);

      const success = await recalculateAndSaveTotal({
        direct_discount_amount: next.directDiscount,
        coupon_discount_amount: next.couponDiscount,
        coupon_code: next.couponCode,
        package_discount_amount: next.packageDiscount,
        points_used_amount: next.pointsUsed,
        wallet_used: next.pointsUsed,
      });
      if (!success) throw new Error('تعذر حفظ تفاصيل الحساب');

      setManualDiscount(next.directDiscount);
      setCouponCode(next.couponCode);
      setPackageDiscountInput(next.packageDiscount ? next.packageDiscount.toFixed(2) : '');
      setPointsDiscountInput(next.pointsUsed ? next.pointsUsed.toFixed(2) : '');
      if (pointsChanged) {
        setCustomerPointsBalance(prev => Math.max(0, prev + current.pointsUsed - next.pointsUsed));
      }
      setShowFinancialEditor(false);
      toast.dismiss(toastId);
      toast.success('تم تصحيح تفصيل الحساب');
    } catch (error) {
      if (pointsChanged) await syncWalletSpend(current.pointsUsed).catch(() => {});
      if (packageChanged) await syncPackageSpend(current.packageDiscount).catch(() => {});
      toast.dismiss(toastId);
      toast.error(error?.message || 'فشل تصحيح الحساب');
    } finally {
      setSavingFinancialEditor(false);
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
      const success = await recalculateAndSaveTotal({ package_discount_amount: discountValue });
      toast.dismiss(toastId);
      if (success) { toast.success('تم خصم من رصيد الباقات ✅'); setDiscountSource('package'); }
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e?.message || 'فشل التحديث');
    }
  };

  const handleSavePointsDiscount = async () => {
    const requestedPoints = Math.floor(Number(pointsDiscountInput) || 0);
    if (requestedPoints <= 0) return toast.error('أدخل عدد نقاط صحيحاً');
    const rewardRules = normalizeRewardRules(appSettings || {});
    const currentFinancials = getPrintOrderFinancials(order, transactions);
    const existingUsedPoints = rewardValueToPoints(currentFinancials.pointsUsed, rewardRules);
    const availableForThisOrder = customerRewardPoints + existingUsedPoints;
    const eligibleOrderValue = Math.max(0, currentFinancials.totalAmount - currentFinancials.deliveryFee);
    const redemptionLimit = getRewardRedemptionLimit(eligibleOrderValue, availableForThisOrder, rewardRules);
    if (requestedPoints < rewardRules.minimumRedemptionPoints) {
      return toast.error(`الحد الأدنى للاستبدال ${rewardRules.minimumRedemptionPoints.toLocaleString()} نقطة`);
    }
    if (requestedPoints > availableForThisOrder) {
      return toast.error(`رصيد النقاط غير كافٍ. المتاح للطلب: ${availableForThisOrder.toLocaleString()} نقطة`);
    }
    if (requestedPoints > redemptionLimit.maximumPoints) {
      return toast.error(`الحد الأعلى لهذا الطلب ${redemptionLimit.maximumPoints.toLocaleString()} نقطة`);
    }
    const newWalletTotal = pointsToRewardValue(requestedPoints, rewardRules);

    const toastId = toast.loading('تحديث الخصم...');
    try {
      await syncWalletSpend(newWalletTotal);
      const success = await recalculateAndSaveTotal({
        points_used_amount: newWalletTotal,
        wallet_used: newWalletTotal,
      });
      toast.dismiss(toastId);
      if (success) {
        toast.success(`تم استخدام ${requestedPoints.toLocaleString()} نقطة`);
        setDiscountSource('wallet');
      }
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
    const paymentAmount = roundMoney(Number(newPayment.amount));
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return toast.error('مبلغ غير صحيح');

    try {
      const { data: payData, error } = await supabase
        .from('order_payments')
        .insert([{
          order_id: id,
          amount: paymentAmount,
          payment_date: newPayment.date
        }])
        .select()
        .single();

      if (error) throw error;

      const newTotalPaid = roundMoney(
        payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) + paymentAmount,
      );
      const pointsPaid = getPrintOrderFinancials(order, transactions).pointsUsed;
      const isPaid = newTotalPaid + pointsPaid >= Number(order.total_amount || 0);

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

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('حذف؟')) return;
    try {
      await supabase.from('order_payments').delete().eq('id', paymentId);

      const newTotalPaid = Math.max(0, roundMoney(
        payments
          .filter((payment) => payment.id !== paymentId)
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      ));
      const pointsPaid = getPrintOrderFinancials(order, transactions).pointsUsed;
      await supabase
        .from('orders')
        .update({ deposit: newTotalPaid, payment_status: newTotalPaid + pointsPaid >= Number(order.total_amount || 0) ? 'paid' : 'unpaid' })
        .eq('id', id);

      setPayments(prev => prev.filter(p => p.id !== paymentId));
      setOrder(prev => ({ ...prev, deposit: newTotalPaid, payment_status: newTotalPaid + pointsPaid >= Number(order.total_amount || 0) ? 'paid' : 'unpaid' }));
      toast.success('تم الحذف');
    } catch {
      toast.error('فشل');
    }
  };

  const markAsFullyPaid = async () => {
    const currentFinancials = getPrintOrderFinancials(order, transactions);
    const remaining = currentFinancials.remainingAmount;
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
        .update({ deposit: Number(order.deposit || 0) + remaining, payment_status: 'paid' })
        .eq('id', id);

      setPayments(prev => [...prev, payData]);
      setOrder(prev => ({ ...prev, deposit: Number(order.deposit || 0) + remaining, payment_status: 'paid' }));
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

    const currentFinancials = getPrintOrderFinancials(order, transactions);
    const remaining = currentFinancials.remainingAmount.toFixed(2);

    const siteLink = 'https://www.art-moment.com/track';

    let msg = '';
    if (type === 'ready') {
      msg =
        `يا هلا ${order.customer_name} ✨\n` +
        `طلبك رقم *${order.id.slice(0, 5)}* جاهز للاستلام!\n` +
        (Number(remaining) > 0 ? `المتبقي: *${remaining} ريال*\n` : `الحساب: *خالص*\n`) +
        `\nتابع طلبك وسجل طلباتك من هنا:\n${siteLink}`;
    } else if (type === 'invoice') {
      // المدفوع: "كامل" إذا المتبقي = 0، وإلا مجموع الدفعات النقدية
      const totalPaidCash = currentFinancials.cashPaid;
      const remainingNum = currentFinancials.remainingAmount;
      const paidDisplay = remainingNum <= 0.01
        ? 'كامل'
        : `${totalPaidCash.toFixed(2)} ريال`;

      msg =
        `اهلاً بكِ *${order.customer_name}* 🌸\n` +
        `رقم الطلب: *${order.id.slice(0, 8)}*\n\n` +
        `🧾 *تفاصيل الفاتورة:*\n` +
        `الاجمالي: *${Number(order.total_amount || 0).toFixed(2)}* ريال\n` +
        `المدفوع: *${paidDisplay}*\n` +
        `المتبقي: *${Math.max(0, remainingNum).toFixed(2)}* ريال\n\n` +
        `🎁 *تفاصيل حسابك:*\n` +
        `رقم الاشتراك: *${walletSubscriptionId || 'غير مسجل'}*\n` +
        `رصيد النقاط: *${customerRewardPoints.toLocaleString()}* نقطة (${customerPointsBalance.toFixed(2)} ريال)\n` +
        `رصيد الباقات: *${customerPackageBalance.toFixed(2)}* ريال\n\n` +
        `تابع طلبكِ من هنا:\n${siteLink}`;
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

  const handleStatusChange = async (newStatus) => {
    if (!newStatus || newStatus === order.status || isUpdatingStatus) return;

    const oldStatus = order.status;
    const toastId = toast.loading('جاري تحديث الحالة...');
    setIsUpdatingStatus(true);
    try {
      const now = new Date().toISOString();
      const dateField = `date_${newStatus}`;

      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: newStatus, [dateField]: now })
        .eq('id', id);
      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from('order_status_history')
        .insert({ order_id: id, old_status: oldStatus, new_status: newStatus, created_at: now });
      if (historyError) console.error('Order status history insert failed:', historyError);

      setOrder(prev => {
        const updated = { ...prev, status: newStatus, [dateField]: now };
        if (newStatus === 'delivered') sendAutoWhatsAppMessage(updated);
        return updated;
      });

      const { data: historyData } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: false });
      setStatusHistory(historyData || []);
      setPendingStatus(null);

      toast.dismiss(toastId);
      toast.success(`تم تغيير الحالة إلى: ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error('فشل تحديث الحالة');
      console.error(err);
    } finally {
      setIsUpdatingStatus(false);
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
  const handlePrintLabel = () => {
    const labelWindow = window.open('', 'art-moment-order-label', 'width=760,height=900');
    if (!labelWindow) {
      toast.error('تعذر فتح الملصق. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.');
      return;
    }

    const orderNumber = String(order?.id || id || '').slice(0, 8);
    const statusLabel = STATUS_CONFIG[order?.status]?.label || order?.status || 'غير محدد';
    const deliveryDate = order?.delivery_date
      ? new Date(order.delivery_date).toLocaleDateString('ar-SA')
      : 'غير محدد';
    const logoUrl = new URL(logo, window.location.href).href;

    labelWindow.document.write(`<!doctype html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>ملصق الطلب ${escapeLabelHtml(orderNumber)}</title>
          <style>
            @page { size: 100mm 150mm; margin: 7mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #4A4A4A; font-family: Tajawal, Arial, sans-serif; }
            .label { min-height: 136mm; border: 2px solid #D9A3AA; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 14px; }
            .brand { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #E9D7D9; padding-bottom: 12px; }
            .brand img { width: 54px; height: 54px; object-fit: contain; }
            h1 { margin: 0; font-size: 23px; }
            .order-number { color: #B0873F; font-size: 25px; font-weight: 900; direction: ltr; text-align: right; }
            .customer { background: #F8F5F2; border-radius: 12px; padding: 14px; }
            .customer strong { display: block; font-size: 23px; margin-bottom: 5px; }
            .phone { font-size: 18px; font-weight: 800; direction: ltr; text-align: right; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .field { border: 1px solid #E9D7D9; border-radius: 10px; padding: 10px; }
            .field span { display: block; color: #8F8585; font-size: 11px; margin-bottom: 4px; }
            .field b { font-size: 15px; }
            .notes { flex: 1; white-space: pre-wrap; }
            .footer { text-align: center; color: #9A8F8F; font-size: 11px; border-top: 1px dashed #D9A3AA; padding-top: 8px; }
            @media print { .label { break-inside: avoid; } }
          </style>
        </head>
        <body>
          <main class="label">
            <div class="brand">
              <div><h1>لحظة فن</h1><div>ملصق تسليم الطلب</div></div>
              <img src="${escapeLabelHtml(logoUrl)}" alt="لحظة فن" />
            </div>
            <div>
              <div>رقم الطلب</div>
              <div class="order-number">#${escapeLabelHtml(orderNumber)}</div>
            </div>
            <section class="customer">
              <strong>${escapeLabelHtml(order?.customer_name || 'عميل لحظة فن')}</strong>
              <div class="phone">${escapeLabelHtml(order?.phone || 'بدون رقم جوال')}</div>
            </section>
            <div class="grid">
              <div class="field"><span>موعد التسليم</span><b>${escapeLabelHtml(deliveryDate)}</b></div>
              <div class="field"><span>حالة الطلب</span><b>${escapeLabelHtml(statusLabel)}</b></div>
              <div class="field"><span>صور 4×6</span><b>${escapeLabelHtml(order?.photo_4x6_qty || 0)}</b></div>
              <div class="field"><span>صور A4</span><b>${escapeLabelHtml(order?.a4_qty || 0)}</b></div>
            </div>
            <div class="field notes"><span>ملاحظات الطلب</span><b>${escapeLabelHtml(order?.notes || 'لا توجد ملاحظات')}</b></div>
            <div class="footer">Art Moment · art-moment.com</div>
          </main>
        </body>
      </html>`);
    labelWindow.document.close();
    labelWindow.focus();
    window.setTimeout(() => labelWindow.print(), 350);
  };

  // ✅ تصدير الفاتورة PDF بحجم A5
  const handleExportPDF = async () => {
    const toastId = toast.loading('جاري إنشاء الفاتورة PDF...');
    try {
      // انتظر تحميل خط Tajawal قبل الالتقاط
      await document.fonts.ready;

      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const el = document.getElementById('printable-invoice');
      if (!el) throw new Error('element not found');

      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 10000,
        // نعدّل نسخة الكابچر الداخلية دون لمس الـ DOM الأصلي
        onclone: (clonedDoc) => {
          // حقن override يضمن الخط العربي والاتجاه في نسخة html2canvas
          const s = clonedDoc.createElement('style');
          s.textContent = `
            #printable-invoice, #printable-invoice * {
              font-family: 'Tajawal', system-ui, -apple-system, "Segoe UI", sans-serif !important;
              direction: rtl !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          `;
          clonedDoc.head.appendChild(s);

          const clone = clonedDoc.getElementById('printable-invoice');
          if (!clone) return;
          clone.style.display = 'block';
          clone.style.position = 'static';
          clone.style.visibility = 'visible';
          clone.style.width = '556px';
          clone.style.padding = '28px 32px';
          clone.style.backgroundColor = '#ffffff';
          clone.style.color = '#000000';
        },
      });

      // PNG بدلاً من JPEG → نص حاد بدون ضغط يشوّه الحروف
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });

      const pw = pdf.internal.pageSize.getWidth();   // 148mm
      const ph = pdf.internal.pageSize.getHeight();  // 210mm
      const margin = 5;
      const usableW = pw - margin * 2;
      const imgH = (canvas.height * usableW) / canvas.width;

      if (imgH <= ph - margin * 2) {
        pdf.addImage(imgData, 'PNG', margin, margin, usableW, imgH);
      } else {
        // صفحات متعددة إن طالت الفاتورة
        const pxPerMm = canvas.width / usableW;
        const pageHpx = (ph - margin * 2) * pxPerMm;
        let srcY = 0, page = 0;
        while (srcY < canvas.height) {
          const sliceH = Math.min(pageHpx, canvas.height - srcY);
          const tmp = document.createElement('canvas');
          tmp.width = canvas.width;
          tmp.height = Math.ceil(sliceH);
          tmp.getContext('2d').drawImage(canvas, 0, -srcY);
          const sliceMmH = (tmp.height * usableW) / canvas.width;
          if (page > 0) pdf.addPage();
          pdf.addImage(tmp.toDataURL('image/png'), 'PNG', margin, margin, usableW, sliceMmH);
          srcY += sliceH;
          page++;
        }
      }

      const name = (order.customer_name || 'عميل').replace(/\s+/g, '-');
      pdf.save(`فاتورة-${name}-${order.id.slice(0, 6)}.pdf`);
      toast.dismiss(toastId);
      toast.success('تم تحميل الفاتورة PDF ✅');
    } catch (err) {
      console.error('PDF Error:', err);
      toast.dismiss(toastId);
      toast.error('فشل إنشاء الفاتورة');
    }
  };

  const steps = [
    { key: 'new', label: 'جديد', icon: FileText },
    { key: 'printing', label: 'طباعة', icon: Printer },
    { key: 'done', label: 'جاهز', icon: CheckCircle },
    { key: 'delivered', label: 'تسليم', icon: Truck }
  ];
  const currentStepIndex = steps.findIndex(s => s.key === order?.status);

  if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;
  if (!order) return <div className="p-10 text-center text-red-500">حدث خطأ</div>;

  const financials = getPrintOrderFinancials(order, transactions);
  const remaining = roundMoney(financials.totalAmount - financials.paidAmount);
  const rewardRules = normalizeRewardRules(appSettings || {});
  const rewardPreview = calculateLoyaltyReward();
  const existingRewardPointsUsed = rewardValueToPoints(financials.pointsUsed, rewardRules);
  const availableRewardPointsForOrder = customerRewardPoints + existingRewardPointsUsed;
  const rewardRedemptionLimit = getRewardRedemptionLimit(
    Math.max(0, financials.totalAmount - financials.deliveryFee),
    availableRewardPointsForOrder,
    rewardRules,
  );
  const earnedRewardTransaction = transactions.find((transaction) => transaction.type === 'reward_points_earn');
  const hasLegacyAlbum = Number(order.album_qty || 0) > 0;
  const hasPotentialDuplicateDiscount = financials.directDiscount > 0
    && financials.pointsUsed > 0
    && Math.abs(financials.directDiscount - financials.pointsUsed) < 0.01;

  return (
    <>
      <div className="text-[#4A4A4A]">
        <div className="w-full pb-20 space-y-6 print:hidden">

          {/* Header */}
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-[#D9A3AA]/25 shadow-sm gap-3">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button onClick={() => navigate('/app/orders')} className="p-2 hover:bg-[#D9A3AA]/10 rounded-xl shrink-0"><ArrowRight /></button>
              <div className="min-w-0">
                {/* اسم العميل */}
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="text-base sm:text-lg font-black text-[#4A4A4A] truncate leading-tight">
                    {order.customer_name || 'عميل'}
                  </h1>
                  {order.status && (
                    <span className={`hidden sm:inline-flex shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                      order.status === 'done'      ? 'bg-purple-50 text-purple-700' :
                      order.status === 'printing'  ? 'bg-amber-100 text-amber-700' :
                                                     'bg-blue-100 text-blue-700'
                    }`}>
                      { order.status === 'new'       ? 'جديد'      :
                        order.status === 'printing'  ? 'طباعة'     :
                        order.status === 'done'      ? 'جاهز'      :
                        order.status === 'delivered' ? 'تم التسليم': order.status }
                    </span>
                  )}
                </div>
                {/* رقم الطلب */}
                <p className="text-[10px] sm:text-xs text-[#4A4A4A]/45 font-mono tracking-wide">
                  # {order.id.slice(0, 8)}
                </p>
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={handlePrintLabel} className="bg-[#D9A3AA]/10 text-[#4A4A4A] px-2 sm:px-4 py-2 rounded-xl font-bold hover:bg-[#D9A3AA]/15 flex items-center gap-1.5 transition-colors text-sm">
                <StickyNote size={16} /> <span className="hidden sm:inline">ملصق</span>
              </button>
              <button onClick={handleExportPDF} className="btn-secondary flex items-center gap-1.5 px-2 sm:px-4 text-sm">
                <Download size={16} /> <span className="hidden sm:inline">PDF</span>
              </button>
              <button onClick={handlePrint} title="طباعة مباشرة" className="bg-[#D9A3AA]/10 text-[#4A4A4A] px-2.5 py-2 rounded-xl hover:bg-[#D9A3AA]/20 transition-colors">
                <Printer size={16} />
              </button>
              <button onClick={handleDelete} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"><Trash2 size={17} /></button>
            </div>
          </div>

          {/* شريط الحالة — FSM */}
          <div className="bg-white p-6 rounded-2xl border border-[#D9A3AA]/25 shadow-sm">
            {/* الحالة الحالية */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-sm text-[#4A4A4A]/55 flex items-center gap-2">
                <AlertCircle size={16} className="text-[#D9A3AA]" /> حالة الطلب
              </h3>
              {(() => {
                const cfg = STATUS_CONFIG[order.status] || { label: order.status, bgClass: 'bg-gray-100', textClass: 'text-gray-600' };
                const Icon = cfg.icon;
                return (
                  <span className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm border ${cfg.bgClass} ${cfg.textClass}`}>
                    {Icon && <Icon size={14} />} {cfg.label}
                  </span>
                );
              })()}
            </div>

            {/* أزرار الانتقال المسموحة */}
            {(VALID_TRANSITIONS[order.status] || []).length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] text-[#4A4A4A]/40 mb-3 font-medium">الانتقال إلى:</p>
                <div className="flex flex-wrap gap-2">
                  {(VALID_TRANSITIONS[order.status] || []).map(nextStatus => {
                    const cfg = STATUS_CONFIG[nextStatus] || { label: nextStatus, btnClass: 'bg-gray-500 text-white' };
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={nextStatus}
                        type="button"
                        onClick={() => setPendingStatus(nextStatus)}
                        disabled={isUpdatingStatus}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all hover:scale-105 shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${cfg.btnClass} ${pendingStatus === nextStatus ? 'ring-2 ring-offset-2 ring-[#C5A059]' : ''}`}
                      >
                        {Icon && <Icon size={14} />} {cfg.label}
                      </button>
                    );
                  })}
                </div>
                {pendingStatus && (() => {
                  const currentConfig = STATUS_CONFIG[order.status] || { label: order.status };
                  const nextConfig = STATUS_CONFIG[pendingStatus] || { label: pendingStatus };
                  return (
                    <div className="mt-4 rounded-xl border border-[#C5A059]/35 bg-[#F8F5F2] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-bold text-[#4A4A4A]">تأكيد تغيير حالة الطلب</p>
                          <p className="mt-1 text-xs text-[#4A4A4A]/60">
                            من <span className="font-bold">{currentConfig.label}</span> إلى <span className="font-bold text-[#C5A059]">{nextConfig.label}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPendingStatus(null)}
                            disabled={isUpdatingStatus}
                            className="min-h-10 rounded-lg border border-[#D9A3AA]/30 bg-white px-4 text-xs font-bold text-[#4A4A4A] disabled:opacity-50"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(pendingStatus)}
                            disabled={isUpdatingStatus}
                            className="flex min-h-10 items-center gap-2 rounded-lg bg-[#4A4A4A] px-4 text-xs font-bold text-white transition-colors hover:bg-[#C5A059] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isUpdatingStatus ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                            {isUpdatingStatus ? 'جاري الحفظ' : 'تأكيد التغيير'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* سجل التدقيق */}
            {statusHistory.length > 0 && (
              <div className="pt-4 border-t border-[#D9A3AA]/15">
                <p className="text-[11px] font-bold text-[#4A4A4A]/40 mb-3">سجل التغييرات</p>
                <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar">
                  {statusHistory.map((entry, idx) => {
                    const newCfg = STATUS_CONFIG[entry.new_status] || { label: entry.new_status, textClass: 'text-gray-600' };
                    const oldCfg = STATUS_CONFIG[entry.old_status] || { label: entry.old_status, textClass: 'text-gray-400' };
                    return (
                      <div key={entry.id || idx} className="flex items-center gap-2 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#D9A3AA] shrink-0" />
                        <span className={`font-bold ${newCfg.textClass}`}>{newCfg.label}</span>
                        <span className="text-[#4A4A4A]/30 text-[10px]">←</span>
                        <span className={`${oldCfg.textClass} opacity-60 text-[11px]`}>{oldCfg.label}</span>
                        <span className="text-[#4A4A4A]/35 mr-auto font-mono text-[10px] shrink-0">
                          {new Date(entry.created_at).toLocaleDateString('en-GB')}{' '}
                          {new Date(entry.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ══ بطاقتا العميل والإنتاج ══════════════════════════════════════ */}
          <div className="grid md:grid-cols-2 gap-6">
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

                    <div className="grid grid-cols-2 gap-2">
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

              {hasLegacyAlbum && (
                <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 mb-4 flex gap-2 text-center text-sm">
                  <div className="flex-1">
                    <span className="block text-[10px] text-[#4A4A4A]/55">عدد الألبومات (طلب سابق)</span>
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
              )}

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

          </div>

          {/* ══ بطاقة الحسابات ══════════════════════════════════════════════ */}
          <div className="bg-white text-[#4A4A4A] p-5 sm:p-6 rounded-2xl border border-[#D9A3AA]/25 shadow-[0_12px_35px_rgba(74,74,74,0.08)] w-full flex flex-col mt-6">

            {/* ── عنوان البطاقة ── */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#D9A3AA]/20 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D9A3AA]/15 text-[#B97882]">
                  <Banknote size={19} />
                </span>
                <div>
                  <h3 className="font-black text-[#393737]">الحسابات</h3>
                  <p className="mt-0.5 text-[11px] text-[#4A4A4A]/55">تفصيل السعر والخصومات والمدفوعات</p>
                </div>
              </div>
              <button
                type="button"
                onClick={showFinancialEditor ? () => setShowFinancialEditor(false) : openFinancialEditor}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#C5A059]/35 bg-[#C5A059]/10 px-3 py-2 text-xs font-bold text-[#9E7D35] transition-colors hover:bg-[#C5A059]/20"
              >
                {showFinancialEditor ? <X size={14} /> : <Pencil size={14} />}
                {showFinancialEditor ? 'إلغاء التعديل' : 'تعديل تفصيل الحساب'}
              </button>
            </div>

            {hasPotentialDuplicateDiscount && !showFinancialEditor && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
                <div className="flex items-start gap-2 text-xs">
                  <AlertCircle size={17} className="mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-black">تنبيه: قد يكون مبلغ الخصم مكررًا</p>
                    <p className="mt-0.5 text-amber-800/75">الخصم المباشر والنقاط يحملان المبلغ نفسه. راجع المصدر الصحيح قبل اعتماد الحساب.</p>
                  </div>
                </div>
                <button type="button" onClick={openFinancialEditor} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700">
                  تصحيح الآن
                </button>
              </div>
            )}

            {showFinancialEditor && (
              <div className="mb-6 rounded-2xl border border-[#C5A059]/30 bg-[#F8F5F2] p-4">
                <div className="mb-4 flex items-start gap-2">
                  <Pencil size={16} className="mt-0.5 shrink-0 text-[#C5A059]" />
                  <div>
                    <h4 className="text-sm font-black text-[#393737]">تصحيح مصادر الخصم والدفع</h4>
                    <p className="mt-1 text-[11px] leading-5 text-[#4A4A4A]/60">ضع صفرًا لإزالة المصدر الخاطئ. عند تخفيض النقاط أو الباقة يُعاد الفرق إلى رصيد العميل تلقائيًا.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    ['directDiscount', 'خصم مباشر'],
                    ['couponDiscount', 'قيمة خصم الكود'],
                    ['packageDiscount', 'خصم الباقة'],
                    ['pointsUsed', 'مدفوع بالنقاط'],
                  ].map(([key, label]) => (
                    <label key={key} className="block">
                      <span className="mb-1.5 block text-[11px] font-bold text-[#4A4A4A]/70">{label}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={financialEdit[key]}
                        onChange={event => setFinancialEdit(prev => ({ ...prev, [key]: event.target.value }))}
                        className="w-full rounded-xl border border-[#D9A3AA]/30 bg-white px-3 py-2 text-center text-sm font-bold text-[#393737] outline-none transition focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/15"
                      />
                    </label>
                  ))}
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-bold text-[#4A4A4A]/70">اسم كود الخصم</span>
                    <input
                      type="text"
                      value={financialEdit.couponCode}
                      onChange={event => setFinancialEdit(prev => ({ ...prev, couponCode: event.target.value }))}
                      placeholder="بدون كود"
                      className="w-full rounded-xl border border-[#D9A3AA]/30 bg-white px-3 py-2 text-center text-sm font-bold uppercase text-[#393737] outline-none transition focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/15"
                    />
                  </label>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowFinancialEditor(false)} className="rounded-xl border border-[#D9A3AA]/25 bg-white px-4 py-2 text-xs font-bold text-[#4A4A4A] hover:bg-[#D9A3AA]/10">
                    إلغاء
                  </button>
                  <button type="button" onClick={handleSaveFinancialBreakdown} disabled={savingFinancialEditor} className="inline-flex items-center gap-1.5 rounded-xl bg-[#4A4A4A] px-4 py-2 text-xs font-bold text-white hover:bg-[#393737] disabled:opacity-50">
                    <Save size={14} /> {savingFinancialEditor ? 'جارٍ الحفظ...' : 'حفظ التصحيح'}
                  </button>
                </div>
              </div>
            )}

            {/* ── المحتوى في عمودين ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-6 items-start">

              {/* ════ العمود الأيمن: المدخلات والخصومات ════════════════════════ */}
              <div className="space-y-3 text-sm border-b border-[#D9A3AA]/20 pb-6 lg:border-b-0 lg:pb-0 lg:border-l lg:border-[#D9A3AA]/20 lg:pl-6">

                {/* الإجمالي قبل الخصم */}
                <div className="flex justify-between rounded-lg bg-[#F8F5F2] px-3 py-2 text-[#4A4A4A]/65 text-xs">
                  <span>الإجمالي قبل الخصم والتوصيل</span>
                  <span>{Number(order.subtotal || 0).toFixed(2)}</span>
                </div>

                {/* التوصيل */}
                <div className="flex justify-between items-center text-[#4A4A4A]/75 text-xs px-1">
                  <span>التوصيل</span>
                  {isEditingDelivery ? (
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={deliveryFee}
                        onChange={e => setDeliveryFee(Number(e.target.value))}
                        className="w-16 rounded-lg border border-[#D9A3AA]/30 bg-[#F8F5F2] px-2 py-1 text-center text-xs text-[#393737] outline-none focus:border-[#C5A059]"
                      />
                      <button onClick={handleSaveDelivery} className="text-[#D9A3AA] text-xs">ok</button>
                    </div>
                  ) : (
                    <button onClick={() => setIsEditingDelivery(true)} className="text-xs">{deliveryFee}</button>
                  )}
                </div>

                {/* خصم إضافي */}
                <div className="flex justify-between items-center text-[#4A4A4A]/75 text-xs px-1">
                  <span className="flex items-center gap-1"><Tag size={11} /> خصم مباشر</span>
                  <div className="flex gap-1 items-center">
                    <input
                      type="number" min="0"
                      value={manualDiscount}
                      onChange={e => setManualDiscount(Number(e.target.value))}
                      onKeyDown={e => e.key === 'Enter' && handleSaveDiscount()}
                      className="w-16 bg-[#F8F5F2] border border-[#D9A3AA]/30 rounded-lg text-center text-xs font-bold text-[#393737] focus:border-[#C5A059] outline-none py-1"
                    />
                    <button onClick={handleSaveDiscount}
                      className="text-[10px] text-[#D9A3AA] bg-[#D9A3AA]/15 hover:bg-[#D9A3AA]/30 px-2 py-0.5 rounded-lg transition-colors">
                      حفظ
                    </button>
                  </div>
                </div>

                {/* خصم من رصيد الباقات */}
                <div className={`rounded-xl border overflow-hidden transition-all ${customerPackageBalance <= 0 ? 'opacity-55' : ''} ${discountSource === 'package' ? 'border-[#C5A059]/55' : 'border-[#D9A3AA]/20'}`}>
                  <button type="button"
                    disabled={customerPackageBalance <= 0}
                    onClick={() => customerPackageBalance > 0 && setDiscountSource(discountSource === 'package' ? 'discount' : 'package')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-right transition-colors ${customerPackageBalance <= 0 ? 'cursor-not-allowed' : ''} ${discountSource === 'package' ? 'bg-[#C5A059]/12' : 'bg-[#F8F5F2] hover:bg-[#C5A059]/10'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${discountSource === 'package' ? 'bg-[#C5A059] border-[#C5A059]' : 'border-[#C5A059]/45'}`}>
                        {discountSource === 'package' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-bold text-[#9E7D35] flex items-center gap-1">
                          <Package size={10} /> رصيد الباقات
                        </span>
                        <span className="text-[10px] text-[#4A4A4A]/55">المتاح: {customerPackageBalance.toFixed(2)} <RiyalSign /></span>
                      </div>
                    </div>
                    {discountSource === 'package' && Number(packageDiscountInput) > 0 && (
                      <span className="text-[#9E7D35] font-black text-xs bg-[#C5A059]/15 px-1.5 py-0.5 rounded">
                        -{Number(packageDiscountInput).toFixed(2)} <RiyalSign />
                      </span>
                    )}
                  </button>
                  {discountSource === 'package' && (
                    <div className="bg-[#C5A059]/8 border-t border-[#C5A059]/20 px-3 py-1.5 flex items-center gap-2">
                      <span className="text-[11px] text-[#9E7D35] shrink-0">المبلغ:</span>
                      <input
                        type="number" min="0.01" max={customerPackageBalance} step="0.01"
                        value={packageDiscountInput}
                        onChange={e => setPackageDiscountInput(e.target.value)}
                        className="flex-1 text-center border border-[#C5A059]/35 rounded-lg px-2 py-1 text-xs font-bold text-[#393737] bg-white outline-none focus:ring-2 ring-[#C5A059]/20"
                      />
                      <button type="button"
                        onClick={() => setPackageDiscountInput(Math.min(customerPackageBalance, Number(order.subtotal || 0) + Number(deliveryFee || 0)).toFixed(2))}
                        className="text-[10px] text-[#9E7D35] bg-[#C5A059]/15 hover:bg-[#C5A059]/25 px-2 py-1 rounded-lg shrink-0 transition-colors">الكل</button>
                      <button onClick={handleSavePackageDiscount}
                        className="text-[10px] text-white bg-[#C5A059] hover:bg-[#A8893C] px-2 py-1 rounded-lg shrink-0 transition-colors font-bold">حفظ</button>
                    </div>
                  )}
                </div>

                {/* خصم من رصيد النقاط */}
                <div className={`rounded-xl border overflow-hidden transition-all ${availableRewardPointsForOrder <= 0 ? 'opacity-55' : ''} ${discountSource === 'wallet' ? 'border-[#D9A3AA]/70' : 'border-[#D9A3AA]/20'}`}>
                  <button type="button"
                    disabled={availableRewardPointsForOrder <= 0}
                    onClick={() => availableRewardPointsForOrder > 0 && setDiscountSource(discountSource === 'wallet' ? 'discount' : 'wallet')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-right transition-colors ${availableRewardPointsForOrder <= 0 ? 'cursor-not-allowed' : ''} ${discountSource === 'wallet' ? 'bg-[#D9A3AA]/15' : 'bg-[#F8F5F2] hover:bg-[#D9A3AA]/10'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${discountSource === 'wallet' ? 'bg-[#D9A3AA] border-[#D9A3AA]' : 'border-[#D9A3AA]/55'}`}>
                        {discountSource === 'wallet' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-bold text-[#B97882] flex items-center gap-1">
                          <Wallet size={10} /> رصيد النقاط
                        </span>
                        <span className="text-[10px] text-[#4A4A4A]/55">
                          المتاح: {customerRewardPoints.toLocaleString()} نقطة = {customerPointsBalance.toFixed(2)} <RiyalSign />
                        </span>
                      </div>
                    </div>
                    {discountSource === 'wallet' && Number(pointsDiscountInput) > 0 && (
                      <span className="text-[#B97882] font-black text-xs bg-[#D9A3AA]/15 px-1.5 py-0.5 rounded">
                        -{Number(pointsDiscountInput || 0).toLocaleString()} نقطة
                      </span>
                    )}
                  </button>
                  {discountSource === 'wallet' && (
                    <div className="bg-[#D9A3AA]/8 border-t border-[#D9A3AA]/20 px-3 py-1.5 flex items-center gap-2">
                      <span className="text-[11px] text-[#B97882] shrink-0">النقاط:</span>
                      <input
                        type="number" min="0" max={rewardRedemptionLimit.maximumPoints} step="1"
                        value={pointsDiscountInput}
                        onChange={e => setPointsDiscountInput(e.target.value.replace(/\D/g, ''))}
                        className="flex-1 text-center border border-[#D9A3AA]/40 rounded-lg px-2 py-1 text-xs font-bold text-[#393737] bg-white outline-none focus:ring-2 ring-[#D9A3AA]/20"
                      />
                      <button type="button"
                        onClick={() => {
                          setPointsDiscountInput(String(rewardRedemptionLimit.maximumPoints));
                        }}
                        className="text-[10px] text-[#B97882] bg-[#D9A3AA]/15 hover:bg-[#D9A3AA]/25 px-2 py-1 rounded-lg shrink-0 transition-colors">الكل</button>
                      <button onClick={handleSavePointsDiscount}
                        className="text-[10px] text-white bg-[#D9A3AA] hover:bg-[#C48A92] px-2 py-1 rounded-lg shrink-0 transition-colors font-bold">حفظ</button>
                    </div>
                  )}
                  {discountSource === 'wallet' && (
                    <div className="flex flex-wrap justify-between gap-1 border-t border-[#D9A3AA]/15 bg-white px-3 py-1.5 text-[9px] text-[#4A4A4A]/50">
                      <span>الحد الأدنى {rewardRules.minimumRedemptionPoints.toLocaleString()} نقطة</span>
                      <span>الحد الأعلى {rewardRedemptionLimit.maximumPoints.toLocaleString()} نقطة ({rewardRedemptionLimit.maximumValue.toFixed(2)} ريال)</span>
                    </div>
                  )}
                </div>

                {/* كود خصم */}
                <div className="flex gap-2 items-center">
                  <select
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="flex-1 bg-[#F8F5F2] border border-[#D9A3AA]/30 rounded-lg px-2 py-1.5 text-[#393737] text-xs outline-none appearance-none focus:border-[#C5A059]"
                  >
                    <option value="">كود خصم</option>
                    {activeCoupons.map((coupon) => (
                      <option key={coupon.id} value={coupon.code}>
                        {coupon.code} - (خصم: {coupon.discount_amount}{coupon.discount_type === 'percent' ? '%' : ' ر.س'})
                      </option>
                    ))}
                  </select>
                  <button onClick={applyCoupon} className="bg-[#4A4A4A] hover:bg-[#393737] px-3 py-1.5 rounded-lg text-xs text-white">
                    تطبيق
                  </button>
                </div>
              </div>

              {/* ════ العمود الأيسر: الإجماليات والدفع والإجراءات ══════════════ */}
              <div className="space-y-2 text-sm">

                <OrderFinancialBreakdown financials={financials} variant="light" />

                {/* سجل المدفوعات */}
                <div className="bg-[#F8F5F2] border border-[#D9A3AA]/15 rounded-xl p-3">
                  <div className="flex justify-between items-center mb-2 border-b border-[#D9A3AA]/20 pb-2">
                    <span className="text-[#B97882] font-bold text-xs">سجل المدفوعات</span>
                    <button
                      onClick={() => {
                        if (showPaymentInput) {
                          setNewPayment({ amount: '', date: new Date().toISOString().split('T')[0] });
                        }
                        setShowPaymentInput(!showPaymentInput);
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${showPaymentInput ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-[#D9A3AA]/20 text-[#D9A3AA]/85 hover:bg-[#D9A3AA]/40'}`}
                    >
                      {showPaymentInput ? <X size={10} /> : <Plus size={10} />}
                      {showPaymentInput ? 'إلغاء' : 'إضافة'}
                    </button>
                  </div>

                  {showPaymentInput && (
                    <div className="flex gap-1.5 mb-2 animate-in fade-in slide-in-from-top-2">
                      <input
                        type="date"
                        value={newPayment.date}
                        onChange={e => setNewPayment({ ...newPayment, date: e.target.value })}
                        className="w-28 bg-white border border-[#D9A3AA]/25 rounded-lg text-xs px-2 py-1 text-[#393737]"
                      />
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="المبلغ"
                        value={newPayment.amount}
                        onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })}
                        className="flex-1 bg-white border border-[#D9A3AA]/25 rounded-lg text-xs px-2 py-1 text-[#393737]"
                      />
                      <button onClick={handleAddPayment} className="bg-gradient-to-b from-[#D9A3AA] to-[#C5A059] text-white px-2 rounded text-xs">
                        حفظ
                      </button>
                    </div>
                  )}

                  <div className="space-y-1 max-h-20 overflow-y-auto custom-scrollbar">
                    {payments.length === 0 ? (
                      <p className="text-[10px] text-[#4A4A4A]/70 text-center py-1">لا توجد دفعات مسجلة</p>
                    ) : (
                      payments.map((p) => (
                        <div key={p.id} className="flex justify-between items-center text-xs bg-white border border-[#D9A3AA]/10 px-2 py-1.5 rounded-lg group">
                          <span className="font-mono text-[#4A4A4A]/55 text-[10px]">{new Date(p.payment_date).toLocaleDateString('en-GB')}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#393737]">{paymentAmountFormatter.format(Number(p.amount || 0))}</span>
                            <button
                              onClick={() => handleDeletePayment(p.id)}
                              className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-300"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {financials.pointsUsed > 0.01 ? (
                    <>
                      <div className="flex justify-between border-t border-[#D9A3AA]/15 pt-1.5 mt-1.5">
                        <span className="text-[10px] text-[#4A4A4A]/55">مدفوع نقداً</span>
                        <span className="font-bold text-[#D9A3AA] text-xs">{financials.cashPaid.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[10px] text-[#B97882]">مدفوع من النقاط</span>
                        <span className="font-bold text-[#B97882] text-xs">{financials.pointsUsed.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between mt-0.5 border-t border-[#D9A3AA]/15 pt-1">
                        <span className="text-[10px] text-[#4A4A4A]/70">إجمالي المدفوع</span>
                        <span className="font-bold text-[#393737] text-xs">{financials.paidAmount.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between border-t border-[#D9A3AA]/15 pt-1.5 mt-1.5">
                      <span className="text-[10px] text-[#4A4A4A]/55">إجمالي المدفوع</span>
                      <span className="font-bold text-[#D9A3AA] text-xs">{financials.cashPaid.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* كاش باك */}
                {rewardPreview.points > 0 && (
                  <div className="p-2.5 bg-[#C5A059]/10 border border-[#C5A059]/30 rounded-xl">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[#9E7D35] text-[11px] font-bold flex items-center gap-1"><Gift size={11} /> نقاط الطلب</span>
                      <span className="text-[#9E7D35] font-bold text-xs">{rewardPreview.points.toLocaleString()} نقطة</span>
                    </div>
                    <div className="mb-1.5 flex justify-between text-[9px] text-[#4A4A4A]/55">
                      <span>على مبلغ مؤهل {rewardPreview.eligibleAmount.toFixed(2)} ريال</span>
                      <span>القيمة {rewardPreview.value.toFixed(2)} ريال</span>
                    </div>
                    {isLoyaltyAdded ? (
                      <div className="text-[10px] text-center bg-[#C5A059]/15 text-[#9E7D35] py-1 rounded flex items-center justify-center gap-1">
                        <CheckCircle size={9} /> أضيفت للنقاط{earnedRewardTransaction?.reward_expires_at ? ` حتى ${new Date(earnedRewardTransaction.reward_expires_at).toLocaleDateString('ar-SA')}` : ''}
                      </div>
                    ) : (
                      <button
                        onClick={handleAddLoyaltyPoints}
                        disabled={order.status !== 'delivered' || order.payment_status !== 'paid'}
                        className="w-full bg-[#C5A059] hover:bg-[#A8893C] text-white text-[11px] py-1 rounded transition-colors"
                      >
                        {order.status === 'delivered' && order.payment_status === 'paid'
                          ? 'احتساب نقاط الطلب'
                          : 'تُضاف بعد الدفع والتسليم'}
                      </button>
                    )}
                  </div>
                )}

                {/* المتبقي + أزرار الإجراء */}
                <div className="flex items-center gap-2">
                  <div className={`flex-1 p-2 rounded-xl text-center border ${remaining <= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    <span className="text-[10px] block">المتبقي</span>
                    <span className="text-base font-black leading-none">{remaining <= 0 ? 'خالص ✅' : remaining.toFixed(2)}</span>
                  </div>

                  {remaining > 0 && (
                    <button onClick={markAsFullyPaid} className="flex-1 py-2 bg-[#4A4A4A] text-white rounded-xl font-bold text-xs hover:bg-[#393737] transition-colors">
                      سداد كامل
                    </button>
                  )}

                  {remaining < 0 && (
                    <button
                      onClick={convertExcessToWallet}
                      disabled={isConvertingExcess}
                      className="flex-1 py-2 bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1 hover:bg-indigo-200 transition-colors disabled:opacity-50"
                    >
                      <Wallet size={12} /> تحويل الفائض ({Math.abs(remaining).toFixed(2)})
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
          {/* نهاية بطاقة الحسابات */}
        </div>

        {/* الفاتورة القابلة للطباعة */}
        <div id="printable-invoice" className="hidden print:block bg-white text-black print-no-extra-space">
          <div className="mx-auto">
            <div className="no-break flex justify-between items-start border-b-2 border-[#4A4A4A]/35 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <img src={logoPng} alt="Art Moment" className="h-12 w-auto object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  <h1 className="text-2xl font-black text-[#4A4A4A]">Art Moment</h1>
                </div>
                <p className="text-xs text-[#4A4A4A]/70">لحظة فن للطباعة</p>
              </div>
              <div className="text-left">
                <h2 className="text-base font-bold font-mono text-[#4A4A4A]">فاتورة #{order.id.slice(0, 8)}</h2>
                <p className="text-xs text-[#4A4A4A]/70 mt-1">التاريخ: {new Date(order.created_at).toLocaleDateString('en-GB')}</p>
              </div>
            </div>

            <div className="no-break mb-4">
              <h3 className="font-bold text-[10px] text-[#4A4A4A]/55 mb-1">بيانات العميل</h3>
              <p className="text-lg font-bold text-[#4A4A4A] leading-tight">{order.customer_name}</p>
              <p className="text-xs text-[#4A4A4A] dir-ltr text-right font-mono">{order.phone}</p>
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
                {financials.lineItems.map((item) => (
                  <tr key={item.key}>
                    <td className="py-2 px-2 text-xs font-medium">{item.label}</td>
                    <td className="py-2 px-2 text-center text-xs font-bold">{item.quantity}</td>
                    <td className="py-2 px-2 text-left text-xs text-[#4A4A4A]/70">
                      {item.unitPrice != null ? item.unitPrice.toFixed(2) : 'غير محفوظ'}
                    </td>
                    <td className="py-2 px-2 text-left text-xs font-bold">
                      {item.lineTotal != null ? item.lineTotal.toFixed(2) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="no-break flex justify-end mb-4">
              <OrderFinancialBreakdown
                financials={financials}
                variant="print"
                showItems={false}
                showTitle={false}
                className="w-72"
              />
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
