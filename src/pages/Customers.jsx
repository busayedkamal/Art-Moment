// src/pages/Customers.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";
import {
  Search, Users, Wallet, ShoppingBag, Sparkles, Crown,
  Phone, Calendar, Gift, X, Loader2, ChevronDown, MapPin, StickyNote, Save,
  Edit2, Check, Package
} from "lucide-react";

export default function Customers() {
  const [customersData, setCustomersData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("netBalance");

  const [expandedCustomerId, setExpandedCustomerId] = useState(null);
  const [customerDetails, setCustomerDetails] = useState({ address: '', notes: '' });
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  const [editingBalanceId, setEditingBalanceId] = useState(null);
  const [editWalletBalance, setEditWalletBalance] = useState('');
  const [isSavingBalance, setIsSavingBalance] = useState(false);

  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paidAmount, setPaidAmount] = useState(10);
  const [addedAmount, setAddedAmount] = useState(10);
  const [packageNote, setPackageNote] = useState("شحن باقة مسبق");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // حالات شحن عميل جديد
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerPaid, setNewCustomerPaid] = useState('');
  const [isNewSubmitting, setIsNewSubmitting] = useState(false);

  // حالات تعديل رصيد الباقات
  const [isEditPkgModalOpen, setIsEditPkgModalOpen] = useState(false);
  const [editPkgCustomer, setEditPkgCustomer] = useState(null);
  const [editPkgAmount, setEditPkgAmount] = useState('');
  const [isSavingPkg, setIsSavingPkg] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const normalizePhone = (raw) => {
        if (!raw) return '';
        let p = String(raw).replace(/\D/g, '');
        if (p.startsWith('966')) p = p.slice(3);
        if (p.startsWith('0')) p = p.slice(1);
        return p;
      };

      // 1) الطلبات
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, customer_name, phone, total_amount, deposit, wallet_used, created_at')
        .order('created_at', { ascending: false });
      if (ordersError) throw ordersError;

      // 2) المحافظ (رصيد النقاط)
      const { data: walletsData, error: walletsError } = await supabase
        .from('wallets')
        .select('id, phone, points_balance, address, notes');
      if (walletsError) throw walletsError;

      // 3) حركات الباقات لكل محفظة (package_charge = الشحن، package_redeem = الاستخدام)
      const { data: packageTxData } = await supabase
        .from('wallet_transactions')
        .select('wallet_id, type, points, amount_value')
        .in('type', ['package_charge', 'package_redeem']);

      // بناء خريطة رصيد الباقات لكل wallet_id
      // package_charge: points = الرصيد المضاف (مع المكافأة)
      // package_redeem: amount_value = المُخصوم
      const packageBalanceByWalletId = {};
      (packageTxData || []).forEach(tx => {
        if (!packageBalanceByWalletId[tx.wallet_id]) packageBalanceByWalletId[tx.wallet_id] = 0;
        if (tx.type === 'package_charge') {
          packageBalanceByWalletId[tx.wallet_id] += Number(tx.points || 0);
        } else if (tx.type === 'package_redeem') {
          packageBalanceByWalletId[tx.wallet_id] -= Number(tx.amount_value || 0);
        }
      });

      const walletMap = new Map();
      (walletsData || []).forEach(w => {
        const key = normalizePhone(w.phone); // 9 أرقام
        const keyWithZero = key.length === 9 ? '0' + key : key; // 10 أرقام
        const entry = {
          id: w.id,
          balance: Number(w.points_balance || 0),
          packageBalance: Math.max(0, packageBalanceByWalletId[w.id] || 0),
          address: w.address || '',
          notes: w.notes || ''
        };
        if (key) walletMap.set(key, entry);
        if (keyWithZero !== key) walletMap.set(keyWithZero, entry);
      });

      const map = {};

      // أولاً: العملاء من الطلبات
      (ordersData || []).forEach(order => {
        const clean = normalizePhone(order.phone);
        const key = clean || `unknown_${order.id}`;

        if (!map[key]) {
          map[key] = {
            id: key,
            name: order.customer_name || 'غير معروف',
            phone: order.phone || '',
            cleanPhone: clean,
            totalRequired: 0,
            totalPaid: 0,
            debt: 0,
            orderIds: new Set(),
            lastOrderDate: order.created_at ? new Date(order.created_at) : null
          };
        }

        map[key].orderIds.add(order.id);
        const totalAmount = Number(order.total_amount || 0);
        const paid = Number(order.deposit || 0);
        const walletUsed = Number(order.wallet_used || 0);
        const remaining = totalAmount - paid - walletUsed;
        map[key].totalRequired += totalAmount;
        map[key].totalPaid += paid + walletUsed;
        if (remaining > 0) map[key].debt += remaining;

        if (order.created_at) {
          const dt = new Date(order.created_at);
          if (!map[key].lastOrderDate || dt > map[key].lastOrderDate) map[key].lastOrderDate = dt;
        }
      });

      // ثانياً: العملاء الذين لديهم محافظ فقط (شحن باقة بدون طلبات سابقة)
      // نستخرج اسمهم من حقل notes بصيغة "اسم العميل: XXX"
      (walletsData || []).forEach(w => {
        if (!w.phone) return;
        const clean = normalizePhone(w.phone);
        const withZero = clean.length === 9 ? '0' + clean : clean;
        // إذا كان موجوداً مسبقاً في map من الطلبات فلا نضيفه مرة أخرى
        if (map[clean] || map[withZero]) return;

        // استخرج الاسم من notes
        let name = 'عميل باقة';
        if (w.notes && w.notes.includes('اسم العميل:')) {
          name = w.notes.replace('اسم العميل:', '').trim();
        }
        if (!name || name === 'اسم العميل:') name = 'عميل باقة';

        // تحقق أن هذه المحفظة لها رصيد باقات فعلاً (ليست محفظة فارغة)
        const hasPkgBalance = (packageBalanceByWalletId[w.id] || 0) > 0;
        const hasPoints = Number(w.points_balance || 0) > 0;
        if (!hasPkgBalance && !hasPoints) return; // تجاهل المحافظ الفارغة تماماً

        map[clean] = {
          id: clean,
          name,
          phone: withZero,
          cleanPhone: clean,
          totalRequired: 0,
          totalPaid: 0,
          debt: 0,
          orderIds: new Set(),
          lastOrderDate: null,
          isWalletOnly: true // علامة أنه عميل باقة بدون طلبات
        };
      });

      const result = Object.values(map).map(c => {
        // نبحث بالشكلين (مع وبدون الصفر)
        const cleanKey = c.cleanPhone || '';
        const cleanWithZero = cleanKey.length === 9 ? '0' + cleanKey : cleanKey;
        const walletData = walletMap.get(cleanKey) || walletMap.get(cleanWithZero) || null;

        const walletBalance = walletData ? walletData.balance : 0;
        const packageBalance = walletData ? walletData.packageBalance : 0;
        const address = walletData ? walletData.address : '';
        const notes = walletData ? walletData.notes : '';
        const debt = Number(c.debt || 0);
        const netBalance = walletBalance - debt;

        return {
          ...c,
          walletBalance,
          packageBalance,
          address,
          notes,
          debt,
          netBalance,
          totalOrders: c.orderIds.size,
          isVip: c.orderIds.size >= 3 || c.totalRequired >= 500
        };
      });

      setCustomersData(result);
    } catch (error) {
      console.error("Error:", error);
      toast.error("حدث خطأ في تحميل العملاء");
    } finally {
      setLoading(false);
    }
  }

  const handleSaveCustomerDetails = async (customer) => {
    if (!customer.cleanPhone) {
      toast.error("لا يمكن حفظ البيانات لعميل بدون رقم هاتف");
      return;
    }
    setIsSavingDetails(true);
    try {
      const { data: existingWallet } = await supabase
        .from('wallets').select('id').eq('phone', customer.cleanPhone).maybeSingle();

      if (existingWallet) {
        await supabase.from('wallets')
          .update({ address: customerDetails.address, notes: customerDetails.notes })
          .eq('id', existingWallet.id);
      } else {
        await supabase.from('wallets').insert([{
          phone: customer.cleanPhone,
          points_balance: 0,
          address: customerDetails.address,
          notes: customerDetails.notes
        }]);
      }
      toast.success("تم حفظ بيانات العميل بنجاح ✨");
      fetchData();
    } catch (error) {
      toast.error("حدث خطأ أثناء الحفظ");
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleSaveWalletBalance = async (customer) => {
    if (!customer.cleanPhone) return toast.error("لا يمكن تعديل رصيد عميل بدون رقم هاتف");
    setIsSavingBalance(true);
    try {
      const newBalance = Number(editWalletBalance);
      const oldBalance = Number(customer.walletBalance || 0);
      const diff = newBalance - oldBalance;

      if (diff === 0) { setEditingBalanceId(null); setIsSavingBalance(false); return; }

      // نبحث بكل أشكال الرقم
      let digits = customer.cleanPhone;
      const withZero = digits.length === 9 ? '0' + digits : digits;
      const allFormats = [withZero, digits, '966' + digits, '+966' + digits];

      const { data: walletsFound } = await supabase
        .from('wallets').select('id').in('phone', allFormats);

      let walletId;
      if (walletsFound && walletsFound.length > 0) {
        walletId = walletsFound[0].id;
        await supabase.from('wallets').update({ points_balance: newBalance }).eq('id', walletId);
      } else {
        const { data: newW } = await supabase.from('wallets')
          .insert([{ phone: withZero, points_balance: newBalance }]).select().single();
        walletId = newW.id;
      }

      await supabase.from('wallet_transactions').insert({
        wallet_id: walletId, type: 'manual_adjustment',
        amount_value: Math.abs(diff).toString(), points: 0
      });

      toast.success('تم تعديل الرصيد بنجاح');
      setEditingBalanceId(null);
      fetchData();
    } catch {
      toast.error('حدث خطأ أثناء تعديل الرصيد');
    } finally {
      setIsSavingBalance(false);
    }
  };

  const handleExpandRow = (customer) => {
    if (expandedCustomerId === customer.id) {
      setExpandedCustomerId(null);
      setEditingBalanceId(null);
    } else {
      setExpandedCustomerId(customer.id);
      setCustomerDetails({ address: customer.address || '', notes: customer.notes || '' });
    }
  };

  const handleChargePackage = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !paidAmount || paidAmount <= 0 || !packageNote) {
      toast.error("يرجى تعبئة جميع الحقول"); return;
    }
    setIsSubmitting(true);
    try {
      const paidNum = Number(paidAmount);
      
      let creditToAdd;
      if (paidNum >= 999) creditToAdd = paidNum + 203;
      else if (paidNum >= 699) creditToAdd = paidNum + 109;
      else if (paidNum >= 299) creditToAdd = paidNum + 34;
      else creditToAdd = paidNum;
      
      const rawPhone = selectedCustomer.cleanPhone || selectedCustomer.phone || '';
      if (!rawPhone) throw new Error("لا يوجد رقم هاتف صالح");

      // نبني كل أشكال الرقم للبحث
      let digits = rawPhone.replace(/\D/g, '');
      if (digits.startsWith('966')) digits = digits.slice(3);
      if (digits.startsWith('0')) digits = digits.slice(1);
      const withZero = digits.length === 9 ? '0' + digits : digits;
      const allFormats = [withZero, digits, '966' + digits, '+966' + digits];

      // جلب المحفظة بكل الأشكال الممكنة
      let wallet;
      const { data: walletsFound } = await supabase
        .from('wallets').select('id, points_balance').in('phone', allFormats);

      if (walletsFound && walletsFound.length > 0) {
        wallet = walletsFound[0];
      } else {
        // ننشئ محفظة جديدة بالرقم بصيغة 05xxxxxxxx
        const { data: newWallet, error: createErr } = await supabase.from('wallets')
          .insert([{ 
            phone: withZero,
            points_balance: 0,
            notes: `اسم العميل: ${selectedCustomer.name}`
          }]).select('id, points_balance').single();
        if (createErr) throw createErr;
        wallet = newWallet;
      }

      // تسجيل الحركة في wallet_transactions فقط
      const { error: txErr } = await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        type: 'package_charge',
        amount_value: paidNum.toString(),
        points: creditToAdd,
        created_at: new Date().toISOString()
      });
      if (txErr) throw txErr;

      toast.success(`✅ تم شحن الباقة! المدفوع: ${paidNum} ريال | الرصيد المضاف: ${creditToAdd} ريال`);

      setIsBonusModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Package charge error:', error);
      toast.error(error.message || 'حدث خطأ أثناء تنفيذ العملية');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openBonusModal = (customer, e) => {
    e.stopPropagation();
    setSelectedCustomer(customer);
    setPaidAmount('');
    setPackageNote("شحن باقة مسبق");
    setIsBonusModalOpen(true);
  };

  const openEditPkgModal = (customer, e) => {
    e.stopPropagation();
    setEditPkgCustomer(customer);
    setEditPkgAmount(Number(customer.packageBalance || 0).toFixed(2));
    setIsEditPkgModalOpen(true);
  };

  // شحن باقة لعميل جديد (بدون طلبات سابقة)
  const handleNewCustomerCharge = async (e) => {
    e.preventDefault();
    if (!newCustomerName.trim() || !newCustomerPhone.trim() || !newCustomerPaid || Number(newCustomerPaid) <= 0) {
      toast.error("يرجى تعبئة جميع الحقول"); return;
    }
    setIsNewSubmitting(true);
    try {
      const paidNum = Number(newCustomerPaid);
      let creditToAdd;
      if (paidNum >= 999) creditToAdd = paidNum + 203;
      else if (paidNum >= 699) creditToAdd = paidNum + 109;
      else if (paidNum >= 299) creditToAdd = paidNum + 34;
      else creditToAdd = paidNum;

      const normalizeP = (raw) => {
        let p = String(raw || '').replace(/\D/g, '');
        if (p.startsWith('966')) p = p.slice(3);
        if (p.startsWith('0')) p = p.slice(1);
        return p;
      };
      const digits = normalizeP(newCustomerPhone);
      const withZero = digits.length === 9 ? '0' + digits : digits;
      if (!digits) throw new Error("رقم الهاتف غير صالح");

      const { data: found } = await supabase.from('wallets').select('id')
        .in('phone', [withZero, digits, '966' + digits]);

      let walletId;
      if (found && found.length > 0) {
        walletId = found[0].id;
      } else {
        const { data: created, error: cErr } = await supabase.from('wallets')
          .insert([{ phone: withZero, points_balance: 0, notes: `اسم العميل: ${newCustomerName.trim()}` }])
          .select('id').single();
        if (cErr) throw cErr;
        walletId = created.id;
      }

      const { error: txErr } = await supabase.from('wallet_transactions').insert({
        wallet_id: walletId, type: 'package_charge',
        amount_value: paidNum.toString(), points: creditToAdd,
        created_at: new Date().toISOString()
      });
      if (txErr) throw txErr;

      toast.success(`✅ تم شحن الباقة لـ ${newCustomerName.trim()}! المدفوع: ${paidNum} | الرصيد: ${creditToAdd} ريال`);
      setIsNewCustomerModalOpen(false);
      setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerPaid('');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'حدث خطأ');
    } finally {
      setIsNewSubmitting(false);
    }
  };

  // تعديل رصيد الباقات (يُسجَّل كـ package_charge إضافة أو package_redeem خصم)
  const handleEditPkgBalance = async (e) => {
    e.preventDefault();
    const newBalance = Number(editPkgAmount);
    if (isNaN(newBalance) || newBalance < 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    setIsSavingPkg(true);
    try {
      const customer = editPkgCustomer;

      // ✅ جلب أشكال الرقم الممكنة
      const digits = customer.cleanPhone || '';
      const withZero = digits.length === 9 ? '0' + digits : digits;
      const { data: wallets } = await supabase.from('wallets').select('id')
        .in('phone', [withZero, digits, '966' + digits]);
      if (!wallets || wallets.length === 0) throw new Error('لا توجد محفظة لهذا العميل');

      const walletIds = wallets.map(w => w.id);

      // ✅ جلب الرصيد الحقيقي من قاعدة البيانات مباشرةً (ليس من الحالة المخزنة)
      // هذا يحمي من حالة التبادل السريع التي تُنشئ حركات مكررة
      const { data: pkgTx } = await supabase
        .from('wallet_transactions')
        .select('type, points, amount_value, wallet_id')
        .in('wallet_id', walletIds)
        .in('type', ['package_charge', 'package_redeem']);

      const balanceByWallet = {};
      wallets.forEach(w => { balanceByWallet[w.id] = 0; });
      (pkgTx || []).forEach(tx => {
        if (tx.type === 'package_charge') balanceByWallet[tx.wallet_id] = (balanceByWallet[tx.wallet_id] || 0) + Number(tx.points || 0);
        if (tx.type === 'package_redeem') balanceByWallet[tx.wallet_id] = (balanceByWallet[tx.wallet_id] || 0) - Number(tx.amount_value || 0);
      });

      // الرصيد الحقيقي الحالي (قبل أي تعديل)
      const currentBalanceFromDB = Object.values(balanceByWallet).reduce((sum, v) => sum + v, 0);
      const diff = newBalance - currentBalanceFromDB;

      // ✅ إذا كان الرصيد الفعلي مطابقاً للمطلوب → لا حاجة لعمل أي شيء
      if (Math.abs(diff) < 0.01) {
        setIsEditPkgModalOpen(false);
        setIsSavingPkg(false);
        return;
      }

      // ✅ اختيار المحفظة الأنسب (الأعلى رصيداً من جانب الباقات)
      const bestWalletId = wallets.reduce((bestId, w) =>
        (balanceByWallet[w.id] || 0) > (balanceByWallet[bestId] || 0) ? w.id : bestId
      , wallets[0].id);

      if (diff > 0) {
        await supabase.from('wallet_transactions').insert({
          wallet_id: bestWalletId, type: 'package_charge',
          amount_value: diff.toFixed(2), points: diff,
          created_at: new Date().toISOString()
        });
        toast.success(`تمت إضافة ${diff.toFixed(2)} ريال لرصيد الباقات ✅`);
      } else {
        const absAmount = Math.abs(diff);
        // ✅ منع الخصم إذا كان الرصيد الفعلي لا يكفي (حماية من السالب)
        if (absAmount > currentBalanceFromDB + 0.01) {
          throw new Error(`لا يمكن الخصم — الرصيد الفعلي ${currentBalanceFromDB.toFixed(2)} ر.س فقط`);
        }
        await supabase.from('wallet_transactions').insert({
          wallet_id: bestWalletId, type: 'package_redeem',
          amount_value: absAmount.toFixed(2), points: 0,
          created_at: new Date().toISOString()
        });
        toast.success(`تم خصم ${absAmount.toFixed(2)} ريال من رصيد الباقات`);
      }

      setIsEditPkgModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'حدث خطأ');
    } finally {
      setIsSavingPkg(false);
    }
  };

  const filtered = useMemo(() => {
    let data = customersData;
    if (filter === "vip") data = data.filter(c => c.isVip);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(c => (c.name || "").toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q));
    }
    data = [...data].sort((a, b) => {
      if (sortBy === "lastOrderDate") return (b.lastOrderDate?.getTime() || 0) - (a.lastOrderDate?.getTime() || 0);
      return (Number(b[sortBy] || 0) - Number(a[sortBy] || 0));
    });
    return data;
  }, [customersData, search, filter, sortBy]);

  const stats = useMemo(() => {
    const totalCustomers = customersData.length;
    const vipCustomers = customersData.filter(c => c.isVip).length;
    const totalPackageBalance = customersData.reduce((sum, c) => sum + (Number(c.packageBalance || 0)), 0);
    return { totalCustomers, vipCustomers, totalPackageBalance };
  }, [customersData]);

  return (
    <div className="w-full pb-20 space-y-6 text-[#4A4A4A]">

      {/* Header */}
      <div className="flex justify-between items-start pt-1 gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#4A4A4A] tracking-tight flex items-center gap-2">
            <Users size={22} className="text-[#D9A3AA]" /> سجل ولاء العملاء
          </h1>
          <p className="text-sm text-[#4A4A4A]/50 mt-0.5">إدارة متقدمة لبيانات ومحافظ العملاء</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setIsNewCustomerModalOpen(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow hover:shadow-amber-500/30 transition-all"
          >
            <Package size={16} /> شحن باقة / عميل جديد
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[#4A4A4A]/50 text-xs font-bold mb-2">
            <Users size={13} /> إجمالي العملاء
          </div>
          <div className="text-3xl font-black text-[#4A4A4A]">{stats.totalCustomers}</div>
        </div>
        <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600/80 text-xs font-bold mb-2">
            <Crown size={13} /> كبار العملاء VIP
          </div>
          <div className="text-3xl font-black text-amber-600">{stats.vipCustomers}</div>
        </div>
        <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-violet-500/80 text-xs font-bold mb-2">
            <Wallet size={13} /> صافي المحافظ
          </div>
          <div className="text-3xl font-black text-[#4A4A4A]">
            {customersData.reduce((sum, c) => sum + (Number(c.netBalance || 0)), 0).toFixed(1)}
            <span className="text-sm font-normal text-[#4A4A4A]/40 mr-1">ر.س</span>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-400 rounded-2xl p-5 shadow-lg shadow-amber-500/20">
          <div className="flex items-center gap-2 text-white/70 text-xs font-bold mb-2">
            <Package size={13} /> رصيد الباقات الكلي
          </div>
          <div className="text-3xl font-black text-white">
            {stats.totalPackageBalance.toFixed(1)}
            <span className="text-sm font-normal text-white/70 mr-1">ر.س</span>
          </div>
          <div className="text-[10px] text-white/60 mt-1">ربح مشحون مسبقاً</div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <div className="relative w-full md:w-80">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A4A4A]/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الجوال..."
              className="w-full border border-[#D9A3AA]/20 rounded-xl px-4 py-2.5 pr-9 outline-none focus:border-[#D9A3AA] focus:ring-2 focus:ring-[#D9A3AA]/20 text-sm bg-[#F8F5F2]/40"
            />
          </div>
          <button onClick={() => setFilter("all")} className={`px-3 py-2.5 rounded-xl text-sm font-bold border transition-all ${filter === "all" ? "bg-[#4A4A4A] text-white border-[#4A4A4A]" : "bg-white text-[#4A4A4A]/70 border-[#D9A3AA]/20 hover:border-[#4A4A4A]/30"}`}>
            الكل
          </button>
          <button onClick={() => setFilter("vip")} className={`px-3 py-2.5 rounded-xl text-sm font-bold border flex items-center gap-1.5 transition-all ${filter === "vip" ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-white text-[#4A4A4A]/70 border-[#D9A3AA]/20 hover:border-amber-300"}`}>
            <Crown size={13} /> VIP
          </button>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-[#4A4A4A]/50 font-bold shrink-0">ترتيب حسب:</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border border-[#D9A3AA]/20 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#D9A3AA] bg-[#F8F5F2]/40 flex-1 md:flex-none">
            <option value="netBalance">الرصيد الصافي</option>
            <option value="packageBalance">رصيد الباقات</option>
            <option value="totalRequired">أعلى المبيعات</option>
            <option value="totalOrders">أكثر الطلبات</option>
            <option value="lastOrderDate">تاريخ آخر زيارة</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl shadow-sm overflow-hidden">
        <table className="min-w-full text-right">
          <thead className="bg-[#F8F5F2] border-b border-[#D9A3AA]/20">
            <tr className="text-sm font-bold text-[#4A4A4A]/70">
              <th className="px-6 py-4">بيانات العميل</th>
              <th className="px-6 py-4 hidden sm:table-cell">رقم الجوال</th>
              <th className="px-6 py-4 text-center">رصيد الباقات</th>
              <th className="px-6 py-4 text-center">رصيد النقاط</th>
              <th className="px-6 py-4 text-center">الرصيد الصافي</th>
              <th className="px-6 py-4 text-left">إجراءات</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#D9A3AA]/10">
            {loading ? (
              <tr><td className="p-8 text-center text-[#4A4A4A]/70" colSpan={6}>جاري التحميل...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="p-8 text-center text-[#4A4A4A]/70" colSpan={6}>لا يوجد عملاء</td></tr>
            ) : (
              filtered.map((customer) => {
                const isExpanded = expandedCustomerId === customer.id;
                return (
                  <React.Fragment key={customer.id}>
                    <tr
                      onClick={() => handleExpandRow(customer)}
                      className={`hover:bg-[#F8F5F2] cursor-pointer transition-colors group ${isExpanded ? 'bg-[#F8F5F2]/50' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg transition-transform ${isExpanded ? 'bg-[#D9A3AA] text-white scale-110' : 'bg-[#D9A3AA]/10 text-[#D9A3AA] group-hover:scale-105'}`}>
                            {(customer.name || "؟").slice(0, 1)}
                          </div>
                          <div>
                            <div className="font-bold text-[#4A4A4A] text-base flex items-center gap-2">
                              {customer.name}
                              {customer.isVip && (
                                <span className="bg-amber-100 text-amber-700 p-1 rounded-full" title="عميل VIP">
                                  <Crown size={12} />
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#4A4A4A]/50 sm:hidden mt-0.5" dir="ltr">{customer.phone || "-"}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 font-mono text-sm text-[#4A4A4A]/80 dir-ltr text-right hidden sm:table-cell">
                        {customer.phone || "-"}
                      </td>

                      {/* عمود رصيد الباقات */}
                      <td className="px-6 py-4 text-center">
                        {customer.packageBalance > 0.5 ? (
                          <span className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1 min-w-[80px]">
                            <Package size={11} />
                            {customer.packageBalance.toFixed(1)} ر.س
                          </span>
                        ) : (
                          <span className="text-[#4A4A4A]/30 text-xs font-bold">—</span>
                        )}
                      </td>

                      {/* عمود رصيد النقاط */}
                      <td className="px-6 py-4 text-center">
                        {customer.walletBalance > 0.5 ? (
                          <span className="bg-violet-50 border border-violet-100 text-violet-700 px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center justify-center min-w-[80px]">
                            {customer.walletBalance.toFixed(1)} ر.س
                          </span>
                        ) : (
                          <span className="text-[#4A4A4A]/30 text-xs font-bold">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center">
                        {customer.netBalance > 0.5 ? (
                          <span className="bg-violet-50 border border-violet-100 text-violet-700 px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center justify-center min-w-[80px]">
                            {customer.netBalance.toFixed(1)} ر.س
                          </span>
                        ) : customer.netBalance < -0.5 ? (
                          <span className="bg-red-50 border border-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center justify-center min-w-[80px] dir-ltr">
                            {Math.abs(customer.netBalance).toFixed(1)}- ر.س
                          </span>
                        ) : (
                          <span className="text-[#4A4A4A]/40 text-xs font-bold">0.00</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {customer.phone && (
                            <a
                              href={`https://wa.me/966${String(customer.phone).startsWith("0") ? String(customer.phone).slice(1) : customer.phone}`}
                              target="_blank" rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors border border-emerald-100"
                              title="مراسلة واتساب"
                            >
                              <Phone size={18} />
                            </a>
                          )}
                          {customer.cleanPhone && (
                            <button
                              onClick={(e) => openBonusModal(customer, e)}
                              className="p-2 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition-colors border border-amber-100"
                              title="شحن باقة للعميل"
                            >
                              <Gift size={18} />
                            </button>
                          )}
                          {customer.packageBalance > 0 && (
                            <button
                              onClick={(e) => openEditPkgModal(customer, e)}
                              className="p-2 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white transition-colors border border-orange-100"
                              title="تعديل رصيد الباقات"
                            >
                              <Package size={18} />
                            </button>
                          )}
                          <button className={`p-2 rounded-xl text-[#4A4A4A]/50 transition-all ${isExpanded ? 'bg-[#D9A3AA]/10 text-[#D9A3AA] rotate-180' : 'group-hover:bg-[#F8F5F2]'}`}>
                            <ChevronDown size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* القائمة المنسدلة */}
                    {isExpanded && (
                      <tr className="bg-[#F8F5F2]/40 border-b-2 border-[#D9A3AA]/20">
                        <td colSpan="6" className="p-0">
                          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-top-2 fade-in duration-300">

                            {/* القسم الأيمن */}
                            <div className="bg-white p-5 rounded-2xl border border-[#D9A3AA]/20 shadow-sm">
                              <h4 className="font-bold text-[#4A4A4A] mb-4 flex items-center gap-2 border-b border-[#F8F5F2] pb-3">
                                <ShoppingBag size={18} className="text-[#C5A059]" /> ملخص نشاط العميل
                              </h4>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="bg-[#F8F5F2] p-3 rounded-xl">
                                  <span className="block text-[10px] text-[#4A4A4A]/60 font-bold mb-1">إجمالي المشتريات</span>
                                  <span className="font-black text-[#4A4A4A] text-lg">{Number(customer.totalRequired || 0).toFixed(0)} <span className="text-xs font-normal">ر.س</span></span>
                                </div>
                                <div className="bg-[#F8F5F2] p-3 rounded-xl">
                                  <span className="block text-[10px] text-[#4A4A4A]/60 font-bold mb-1">عدد الطلبات</span>
                                  <span className="font-black text-[#4A4A4A] text-lg">{customer.orderIds.size} <span className="text-xs font-normal">طلبات</span></span>
                                </div>
                                <div className="bg-[#F8F5F2] p-3 rounded-xl">
                                  <span className="block text-[10px] text-[#4A4A4A]/60 font-bold mb-1">تاريخ آخر طلب</span>
                                  <span className="font-bold text-[#4A4A4A] text-sm mt-1 block">
                                    {customer.lastOrderDate ? customer.lastOrderDate.toLocaleDateString("en-GB") : "-"}
                                  </span>
                                </div>

                                {/* تفصيل الرصيد */}
                                <div className="bg-[#F8F5F2] p-3 rounded-xl relative group">
                                  <span className="block text-[10px] text-[#4A4A4A]/60 font-bold mb-1">تفصيل الرصيد</span>

                                  {editingBalanceId === customer.id ? (
                                    <div className="mt-1 animate-in fade-in">
                                      <div className="flex items-center gap-1 mb-1">
                                        <span className="text-[10px] font-bold text-[#4A4A4A]">المحفظة:</span>
                                        <input
                                          type="number"
                                          value={editWalletBalance}
                                          onChange={(e) => setEditWalletBalance(e.target.value)}
                                          className="w-full h-6 text-xs text-center border border-[#D9A3AA]/40 rounded outline-none font-bold text-violet-600 bg-white"
                                        />
                                      </div>
                                      <div className="flex items-center gap-1 mt-2">
                                        <button onClick={() => handleSaveWalletBalance(customer)} disabled={isSavingBalance} className="flex-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded py-0.5 text-[10px] font-bold hover:bg-emerald-100 flex justify-center items-center gap-1">
                                          {isSavingBalance ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} حفظ
                                        </button>
                                        <button onClick={() => setEditingBalanceId(null)} className="flex-1 bg-red-50 text-red-600 border border-red-200 rounded py-0.5 text-[10px] font-bold hover:bg-red-100 flex justify-center items-center gap-1">
                                          <X size={10} /> إلغاء
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="font-bold text-[#4A4A4A] text-[11px] mt-1 block leading-tight">
                                        نقاط: <span className="text-violet-600">{Number(customer.walletBalance || 0).toFixed(1)}</span><br />
                                        باقات: <span className="text-amber-600">{Number(customer.packageBalance || 0).toFixed(1)}</span><br />
                                        مديونية: <span className="text-red-500">{Number(customer.debt || 0).toFixed(1)}</span>
                                      </span>
                                      <button
                                        onClick={() => { setEditingBalanceId(customer.id); setEditWalletBalance(customer.walletBalance || 0); }}
                                        className="absolute top-2 left-2 p-1 bg-white border border-[#D9A3AA]/20 rounded shadow-sm text-[#4A4A4A]/50 hover:text-[#D9A3AA] opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="تعديل رصيد النقاط"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* بطاقة رصيد الباقات المفصّلة */}
                              {customer.packageBalance > 0 && (
                                <div className="mt-4 bg-gradient-to-r from-amber-50 to-amber-100/30 border border-amber-200/60 rounded-xl p-3 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Package size={16} className="text-amber-600" />
                                    <div>
                                      <div className="text-[10px] font-bold text-amber-700">رصيد الباقات المتاح</div>
                                      <div className="text-xs text-amber-600/70">يُخصم من الطلبات القادمة</div>
                                    </div>
                                  </div>
                                  <span className="text-lg font-black text-amber-700">{Number(customer.packageBalance).toFixed(1)} <span className="text-xs font-normal">ر.س</span></span>
                                </div>
                              )}
                            </div>

                            {/* القسم الأيسر: التفاصيل القابلة للتعديل */}
                            <div className="bg-white p-5 rounded-2xl border border-[#D9A3AA]/20 shadow-sm flex flex-col">
                              <h4 className="font-bold text-[#4A4A4A] mb-4 flex items-center gap-2 border-b border-[#F8F5F2] pb-3">
                                <StickyNote size={18} className="text-[#D9A3AA]" /> تفاصيل وشحن العميل
                              </h4>
                              <div className="space-y-4 flex-1">
                                <div>
                                  <label className="flex items-center gap-1 text-xs font-bold text-[#4A4A4A]/70 mb-1.5">
                                    <MapPin size={12} /> العنوان / موقع التوصيل
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="مثال: الرميلة، العمران، شارع..."
                                    value={customerDetails.address}
                                    onChange={(e) => setCustomerDetails({ ...customerDetails, address: e.target.value })}
                                    className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#D9A3AA] transition-colors"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="flex items-center gap-1 text-xs font-bold text-[#4A4A4A]/70 mb-1.5">
                                    <StickyNote size={12} /> ملاحظات خاصة بالعميل
                                  </label>
                                  <textarea
                                    placeholder="مثال: يفضل التغليف الوردي، يطلب دائماً طباعة مطفية..."
                                    value={customerDetails.notes}
                                    onChange={(e) => setCustomerDetails({ ...customerDetails, notes: e.target.value })}
                                    className="w-full h-20 resize-none bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#D9A3AA] transition-colors"
                                  ></textarea>
                                </div>
                              </div>
                              <div className="mt-4 pt-4 border-t border-[#F8F5F2] flex justify-end">
                                <button
                                  onClick={() => handleSaveCustomerDetails(customer)}
                                  disabled={isSavingDetails}
                                  className="bg-[#4A4A4A] hover:bg-[#333333] text-white text-sm font-bold py-2 px-6 rounded-xl transition-all flex items-center gap-2 disabled:opacity-70"
                                >
                                  {isSavingDetails ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                  حفظ التعديلات
                                </button>
                              </div>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal إضافة رصيد */}
      {isBonusModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-amber-50 p-6 border-b border-amber-100 flex justify-between items-center relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-amber-200 opacity-50"><Gift size={80} /></div>
              <div className="relative z-10">
                <h3 className="text-xl font-black text-amber-800 flex items-center gap-2">
                  <Gift size={20} /> إضافة رصيد للباقات (دفع مسبق)
                </h3>
                <p className="text-amber-700/70 text-sm mt-1">{selectedCustomer.name}</p>
              </div>
              <button onClick={() => setIsBonusModalOpen(false)} className="p-2 bg-white rounded-full text-[#4A4A4A] hover:bg-red-50 hover:text-red-500 transition-colors relative z-10 shadow-sm"><X size={16} /></button>
            </div>

            <form onSubmit={handleChargePackage} className="p-6 space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
                <Package size={14} className="shrink-0 mt-0.5" />
                <span>شحن الباقة: المبلغ المدفوع يُحفظ كسجل، والرصيد المضاف يُضاف للمحفظة للاستخدام في الطلبات القادمة.</span>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#4A4A4A] mb-1">المبلغ المدفوع (ر.س):</label>
                <input
                  type="number" min="1" required
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full border border-[#D9A3AA]/30 rounded-xl px-4 py-3 outline-none focus:border-amber-400 focus:ring-4 ring-amber-400/10 font-bold text-lg text-amber-600"
                  placeholder="0"
                />
                {paidAmount && Number(paidAmount) > 0 && (
                  <div className="mt-2 text-xs text-amber-600 font-medium">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                      💰 الرصيد الذي سيتم إضافته: 
                      {Number(paidAmount) >= 999 && ` ${Number(paidAmount) + 203} ريال (+203 مكافأة)`}
                      {Number(paidAmount) >= 699 && Number(paidAmount) < 999 && ` ${Number(paidAmount) + 109} ريال (+109 مكافأة)`}
                      {Number(paidAmount) >= 299 && Number(paidAmount) < 699 && ` ${Number(paidAmount) + 34} ريال (+34 مكافأة)`}
                      {Number(paidAmount) < 299 && ` ${Number(paidAmount)} ريال (لا توجد مكافأة)`}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-[#4A4A4A] mb-1">ملاحظة / اسم الباقة:</label>
                <input
                  type="text" required
                  value={packageNote}
                  onChange={(e) => setPackageNote(e.target.value)}
                  className="w-full border border-[#D9A3AA]/30 rounded-xl px-4 py-3 outline-none focus:border-amber-400 focus:ring-4 ring-amber-400/10 text-sm"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit" disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-400 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-amber-500/30 transition-all flex justify-center items-center gap-2 disabled:opacity-70"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  {isSubmitting ? 'جاري التنفيذ...' : 'شحن الباقة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal شحن باقة / عميل جديد */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-amber-50 p-5 border-b border-amber-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-amber-800 flex items-center gap-2"><Package size={18} /> شحن باقة / عميل جديد</h3>
                <p className="text-amber-700/70 text-xs mt-0.5">إضافة رصيد باقات لعميل جديد</p>
              </div>
              <button onClick={() => setIsNewCustomerModalOpen(false)} className="p-2 bg-white rounded-full text-[#4A4A4A] hover:bg-red-50 hover:text-red-500 transition-colors shadow-sm"><X size={16} /></button>
            </div>
            <form onSubmit={handleNewCustomerCharge} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#4A4A4A] mb-1">اسم العميل:</label>
                <input type="text" required value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)}
                  className="w-full border border-[#D9A3AA]/30 rounded-xl px-4 py-2.5 outline-none focus:border-amber-400 text-sm"
                  placeholder="أدخل اسم العميل" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#4A4A4A] mb-1">رقم الجوال:</label>
                <input type="tel" required dir="ltr" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)}
                  className="w-full border border-[#D9A3AA]/30 rounded-xl px-4 py-2.5 outline-none focus:border-amber-400 text-sm text-right"
                  placeholder="05xxxxxxxx" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#4A4A4A] mb-1">المبلغ المدفوع (ر.س):</label>
                <input type="number" min="1" required value={newCustomerPaid} onChange={e => setNewCustomerPaid(e.target.value)}
                  className="w-full border border-[#D9A3AA]/30 rounded-xl px-4 py-3 outline-none focus:border-amber-400 font-bold text-lg text-amber-600" />
                {newCustomerPaid && Number(newCustomerPaid) > 0 && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700 font-medium">
                    💰 الرصيد المضاف:
                    {Number(newCustomerPaid) >= 999 && ` ${Number(newCustomerPaid) + 203} ريال (+203 مكافأة)`}
                    {Number(newCustomerPaid) >= 699 && Number(newCustomerPaid) < 999 && ` ${Number(newCustomerPaid) + 109} ريال (+109 مكافأة)`}
                    {Number(newCustomerPaid) >= 299 && Number(newCustomerPaid) < 699 && ` ${Number(newCustomerPaid) + 34} ريال (+34 مكافأة)`}
                    {Number(newCustomerPaid) < 299 && ` ${Number(newCustomerPaid)} ريال (بدون مكافأة)`}
                  </div>
                )}
              </div>
              <button type="submit" disabled={isNewSubmitting}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-400 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 disabled:opacity-70">
                {isNewSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                {isNewSubmitting ? 'جاري الشحن...' : 'شحن الباقة'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal تعديل رصيد الباقات */}
      {isEditPkgModalOpen && editPkgCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-orange-50 p-5 border-b border-orange-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-orange-800 flex items-center gap-2"><Package size={18} /> تعديل رصيد الباقات</h3>
                <p className="text-orange-700/70 text-xs mt-0.5">{editPkgCustomer.name}</p>
              </div>
              <button onClick={() => setIsEditPkgModalOpen(false)} className="p-2 bg-white rounded-full hover:bg-red-50 hover:text-red-500 transition-colors shadow-sm"><X size={16} /></button>
            </div>
            <form onSubmit={handleEditPkgBalance} className="p-5 space-y-4">
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm text-orange-700">الرصيد الحالي</span>
                <span className="font-black text-orange-600">{Number(editPkgCustomer.packageBalance || 0).toFixed(2)} ر.س</span>
              </div>
              <div>
                <label className="block text-sm font-bold text-[#4A4A4A] mb-1">الرصيد الجديد (ر.س):</label>
                <input type="number" min="0" step="0.01" required value={editPkgAmount} onChange={e => setEditPkgAmount(e.target.value)}
                  className="w-full border border-orange-200 rounded-xl px-4 py-3 outline-none focus:border-orange-400 font-bold text-lg text-orange-600 text-center" />
              </div>
              {editPkgAmount !== '' && Math.abs(Number(editPkgAmount) - Number(editPkgCustomer.packageBalance || 0)) > 0.01 && (
                <div className={`text-xs font-bold rounded-lg p-2 text-center ${Number(editPkgAmount) > Number(editPkgCustomer.packageBalance || 0) ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {Number(editPkgAmount) > Number(editPkgCustomer.packageBalance || 0)
                    ? `↑ إضافة ${(Number(editPkgAmount) - Number(editPkgCustomer.packageBalance || 0)).toFixed(2)} ريال`
                    : `↓ خصم ${(Number(editPkgCustomer.packageBalance || 0) - Number(editPkgAmount)).toFixed(2)} ريال`}
                </div>
              )}
              <button type="submit" disabled={isSavingPkg}
                className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 disabled:opacity-70">
                {isSavingPkg ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                {isSavingPkg ? 'جاري الحفظ...' : 'حفظ التعديل'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
