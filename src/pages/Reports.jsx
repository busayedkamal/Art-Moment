// src/pages/Reports.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  BarChart3, Calendar, Download, TrendingDown, TrendingUp,
  PieChart as PieIcon, Activity, CheckCircle2, MapPin, Crown, Users, Copy, ChevronDown, Wallet,
  ShoppingBag, Banknote
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { format, isValid, subMonths, isBefore } from 'date-fns';
import RiyalSign from '../components/RiyalSign';
import { arSA } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [storeOrders, setStoreOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [packageTransactions, setPackageTransactions] = useState([]);
  const [settings, setSettings] = useState({ a4_price: 0, photo_4x6_price: 0 });
  const [expandedMonth, setExpandedMonth] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const { data: paymentsData } = await supabase.from('order_payments').select('*');
        const { data: ordersData } = await supabase.from('orders').select('*');
        const { data: expensesData } = await supabase.from('expenses').select('*');
        const { data: walletsData } = await supabase.from('wallets').select('phone, points_balance').order('id', { ascending: true });
        // نجلب شحن الباقات واستخدامها
        const { data: packageTransactionsData } = await supabase.from('wallet_transactions').select('*').in('type', ['package_charge', 'package_add', 'package_redeem']);
        const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 1).single();

        const { data: storeOrdersData } = await supabase.from('store_orders').select('total_amount, amount_paid');
        setStoreOrders(storeOrdersData || []);
        setPayments(paymentsData || []);
        setOrders(ordersData || []);
        setExpenses(expensesData || []);
        setWallets(walletsData || []);
        setPackageTransactions(packageTransactionsData || []);
        if (settingsData) setSettings(settingsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const analytics = useMemo(() => {
    const monthlyMap = {};
    const expenseCategoryMap = {};
    const sourceMap = {};
    const citiesMap = { 'الهفوف': 0, 'المبرز': 0, 'الدمام': 0, 'الخبر': 0, 'الرياض': 0, 'أخرى': 0 };
    const productsStats = {
      '4x6': { name: 'صور 4x6', sales: 0, revenue: 0, profit: 0 },
      'A4': { name: 'صور A4', sales: 0, revenue: 0, profit: 0 },
      'Albums': { name: 'ألبومات', sales: 0, revenue: 0, profit: 0 }
    };
    const customerLastOrder = {};
    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalPointsBalance = 0;

    const getMonthKey = (dateString) => {
      const date = new Date(dateString);
      if (!isValid(date)) return null;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return { key, date };
    };

    payments.forEach(p => {
      const dateInfo = getMonthKey(p.payment_date || p.created_at);
      if (!dateInfo) return;
      const { key, date } = dateInfo;
      const amount = Number(p.amount) || 0;
      if (!monthlyMap[key]) monthlyMap[key] = { name: key, date, revenue: 0, expenses: 0, orders: 0, packagesTotal: 0 };
      monthlyMap[key].revenue += amount;
      totalRevenue += amount;
    });

    expenses.forEach(e => {
      const dateInfo = getMonthKey(e.date || e.created_at);
      if (!dateInfo) return;
      const { key, date } = dateInfo;
      const amount = Number(e.amount) || 0;
      if (!monthlyMap[key]) monthlyMap[key] = { name: key, date, revenue: 0, expenses: 0, orders: 0, packagesTotal: 0 };
      monthlyMap[key].expenses += amount;
      totalExpenses += amount;
      const cat = e.title || 'غير مصنف';
      expenseCategoryMap[cat] = (expenseCategoryMap[cat] || 0) + amount;
    });

    orders.forEach(o => {
      const dateInfo = getMonthKey(o.created_at);
      if (dateInfo && monthlyMap[dateInfo.key]) monthlyMap[dateInfo.key].orders += 1;

      const city = o.source ? o.source.trim() : 'أخرى';
      if (Object.prototype.hasOwnProperty.call(citiesMap, city)) {
        citiesMap[city]++;
      } else {
        citiesMap['أخرى']++;
      }

      const q4x6 = Number(o.photo_4x6_qty) || 0;
      const qA4 = Number(o.a4_qty) || 0;
      const qAlbum = Number(o.album_qty) || 0;
      const pAlbum = Number(o.album_price) || 0;

      productsStats['4x6'].sales += q4x6;
      const rev4x6 = q4x6 * (settings.photo_4x6_price || 1);
      productsStats['4x6'].revenue += rev4x6;
      productsStats['4x6'].profit += (rev4x6 * 0.70);

      productsStats['A4'].sales += qA4;
      const revA4 = qA4 * (settings.a4_price || 2);
      productsStats['A4'].revenue += revA4;
      productsStats['A4'].profit += (revA4 * 0.65);

      productsStats['Albums'].sales += qAlbum;
      const revAlbum = qAlbum * pAlbum;
      productsStats['Albums'].revenue += revAlbum;
      productsStats['Albums'].profit += (revAlbum * 0.40);

      const phone = o.phone?.replace(/\D/g, '');
      if (phone) {
        const orderDate = new Date(o.created_at);
        if (!customerLastOrder[phone] || orderDate > customerLastOrder[phone].date) {
          customerLastOrder[phone] = { name: o.customer_name, phone, date: orderDate };
        }
      }
    });

    // حساب الباقات المشحونة شهرياً
    packageTransactions.forEach(pt => {
      const dateInfo = getMonthKey(pt.created_at);
      if (!dateInfo) return;
      const { key } = dateInfo;
      if (monthlyMap[key]) {
        monthlyMap[key].packagesTotal += Number(pt.amount_value || 0);
      }
    });

    // حساب الربح الشهري لكل شهر
    Object.keys(monthlyMap).forEach(monthKey => {
      const monthData = monthlyMap[monthKey];
      monthData.profit = (monthData.revenue + monthData.packagesTotal) - monthData.expenses;
    });

    const monthlyData = Object.values(monthlyMap).sort((a, b) => a.date - b.date);

    // حساب دخل الشهر الحالي والشهر الماضي لشريط النمو
    const currentMonthKey = new Date().toISOString().substring(0, 7);
    const lastMonthDate = subMonths(new Date(), 1);
    const lastMonthKey = lastMonthDate.toISOString().substring(0, 7);
    const currentMonthRevenue = monthlyMap[currentMonthKey]?.revenue || 0;
    const lastMonthRevenue = monthlyMap[lastMonthKey]?.revenue || 0;
    const expenseData = Object.entries(expenseCategoryMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
    
    const profitabilityData = Object.values(productsStats).sort((a, b) => b.profit - a.profit);
    const geoData = Object.entries(citiesMap).filter(([_, val]) => val > 0).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const threeMonthsAgo = subMonths(new Date(), 3);
    const churnedList = Object.values(customerLastOrder).filter(c => isBefore(c.date, threeMonthsAgo)).slice(0, 5);

    // حساب أرصدة المحافظ — نُطبّع رقم الهاتف ونُزيل التكرار (نفس منطق صفحة العملاء)
    const normalizePhone = (raw) => {
      if (!raw) return '';
      let p = String(raw).replace(/\D/g, '');
      if (p.startsWith('966')) p = p.slice(3);
      if (p.startsWith('0')) p = p.slice(1);
      return p;
    };
    // إذا وُجدت محفظتان لنفس الرقم، نختار صاحبة أعلى رصيد (نفس منطق صفحة العملاء)
    const walletByPhone = {};
    wallets.forEach(w => {
      const key = normalizePhone(w.phone);
      if (!key) return;
      const bal = Number(w.points_balance || 0);
      if (walletByPhone[key] === undefined || bal > walletByPhone[key]) {
        walletByPhone[key] = bal;
      }
    });
    totalPointsBalance = Object.values(walletByPhone).reduce((acc, v) => acc + v, 0);
    
    // إجمالي مبالغ الباقات المشحونة (المبلغ المدفوع الفعلي = ربح مباشر فوري)
    const packagesCharged = packageTransactions
      .filter(pt => pt.type === 'package_charge' || pt.type === 'package_add')
      .reduce((acc, pt) => acc + Number(pt.amount_value || 0), 0);

    // إجمالي الرصيد المُضاف للعملاء (يشمل المكافأة) — يُستخدم لحساب الرصيد المتبقي الصحيح
    const packagesCreditsAdded = packageTransactions
      .filter(pt => pt.type === 'package_charge' || pt.type === 'package_add')
      .reduce((acc, pt) => acc + Number(pt.points || 0), 0);

    // إجمالي ما تم استخدامه من رصيد الباقات في الطلبات أو التعديلات
    const packagesRedeemed = packageTransactions
      .filter(pt => pt.type === 'package_redeem')
      .reduce((acc, pt) => acc + Number(pt.amount_value || 0), 0);

    // الرصيد المتبقي في باقات العملاء:
    // نستخدم points (الرصيد الكامل مع المكافأة) للمقارنة مع ما تم استخدامه
    const packagesTotal = Math.max(0, packagesCreditsAdded - packagesRedeemed);
    
    const totalWalletBalance = totalPointsBalance;

    // ✅ النقد الفعلي = deposit مسقوف بـ (total - wallet_used)
    // يمنع احتساب مبالغ النقاط ضمن الإيرادات النقدية في حال سُجّل الدفع قبل تطبيق النقاط
    const totalDepositReceived = orders.reduce((sum, o) => {
      const dep    = Number(o.deposit     || 0);
      const wallet = Number(o.wallet_used || 0);
      const total  = Number(o.total_amount|| 0);
      const realCash = Math.min(dep, Math.max(0, total - wallet));
      return sum + realCash;
    }, 0);

    // ✅ الديون المستحقة للطلبات المُسلَّمة فعلاً (نفس منطق Dashboard)
    const outstandingDeliveredDebts = orders
      .filter(o => o.status === 'delivered' &&
        (Number(o.total_amount||0) - Number(o.deposit||0) - Number(o.wallet_used||0)) > 0.5)
      .reduce((sum, o) => sum + (Number(o.total_amount||0) - Number(o.deposit||0) - Number(o.wallet_used||0)), 0);

    // صافي الربح الفعلي = ما قُبض فعلاً + ما شُحن للباقات - المصروفات
    const netProfit = (totalDepositReceived + packagesCharged) - totalExpenses;

    // الربح الكامل مع الديون = صافي الربح + الديون المستحقة (لو تم تحصيلها)
    const netProfitWithDebts = netProfit + outstandingDeliveredDebts;

    const profitMargin = (totalDepositReceived + packagesCharged) > 0
      ? ((netProfit / (totalDepositReceived + packagesCharged)) * 100).toFixed(1)
      : 0;
    const avgOrderValue = orders.length > 0
      ? (orders.reduce((sum, o) => sum + Number(o.total_amount||0), 0) / orders.length).toFixed(0)
      : 0;

    return {
      monthlyData, expenseData, profitabilityData, geoData, churnedList,
      currentMonthRevenue, lastMonthRevenue,
      totals: { totalRevenue, totalExpenses, totalWalletBalance, totalPointsBalance, packagesTotal, packagesCharged, packagesCreditsAdded, packagesRedeemed, netProfit, netProfitWithDebts, outstandingDeliveredDebts, profitMargin, avgOrderValue, totalOrders: orders.length }
    };
  }, [payments, expenses, orders, wallets, packageTransactions, settings]);

  const storeStats = useMemo(() => {
    return storeOrders.reduce((acc, order) => {
      const total = Number(order.total_amount || 0);
      const paid  = Number(order.amount_paid  || 0);
      return {
        sales: acc.sales + total,
        paid:  acc.paid  + paid,
        debt:  acc.debt  + Math.max(0, total - paid),
      };
    }, { sales: 0, paid: 0, debt: 0 });
  }, [storeOrders]);

  // ألوان الرسوم البيانية — متوافقة مع هوية لحظة فن
  const CHART_COLORS = ['#D9A3AA', '#C5A059', '#4A4A4A', '#ef4444', '#C48A92'];

  const generateReturnOfferMsg = () => {
    const customersMap = {};

    orders.forEach(o => {
        if (o.status === 'delivered' && o.phone) {
            if (!customersMap[o.phone]) {
                customersMap[o.phone] = {
                    name: o.customer_name,
                    phone: o.phone,
                    totalPhotos: 0,
                    totalA4: 0,
                    lastOrderDate: new Date(o.created_at)
                };
            }
            
            customersMap[o.phone].totalPhotos += Number(o.photo_4x6_qty || 0);
            customersMap[o.phone].totalA4 += Number(o.a4_qty || 0);
            
            const orderDate = new Date(o.created_at);
            if (orderDate > customersMap[o.phone].lastOrderDate) {
                customersMap[o.phone].lastOrderDate = orderDate;
            }
        }
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const eligibleCustomers = Object.values(customersMap).filter(c => c.lastOrderDate < thirtyDaysAgo);

    if (eligibleCustomers.length === 0) {
        toast.error('لا يوجد عملاء مطابقين لشروط الحملة (مر أكثر من شهر على آخر طلب).');
        return;
    }

    const targetCustomer = eligibleCustomers[0];
    const savings = ((targetCustomer.totalPhotos * settings.photo_4x6_price) + (targetCustomer.totalA4 * settings.a4_price)).toFixed(0);

    const msg = `أهلاً بك عميلنا العزيز ${targetCustomer.name} 👋\nنفتقدك في لحظة فن! 🎨\n\nلقد طبعنا لك مسبقاً أكثر من ${targetCustomer.totalPhotos} صورة، ووفرت معنا أكثر من ${savings} ريال.\n\nرجعنا لك بعرض خاص لفترة محدودة:\nاطبع 50 صورة بـ 49 ريال فقط بدلاً من 100 ريال! 🎁\n\nللطلب أرسل صورك الآن:\nhttps://wa.me/966569663697`;
    
    navigator.clipboard.writeText(msg);
    toast.success(`تم نسخ رسالة العرض للعميل ${targetCustomer.name}! يمكنك لصقها في الواتساب.`);
  };

  const customerInsights = useMemo(() => {
    let totalA4 = 0; let total4x6 = 0; let totalAlbums = 0;
    orders.forEach(order => {
      totalA4 += Number(order.a4_qty || 0);
      total4x6 += Number(order.photo_4x6_qty || 0);
      totalAlbums += Number(order.album_qty || 0);
    });
    return { totalA4, total4x6, totalAlbums };
  }, [orders]);

  const PIE_COLORS = ['#D9A3AA', '#C5A059', '#4A4A4A'];
  const pieData = useMemo(() => [
    { name: 'صور 4x6', value: customerInsights.total4x6 },
    { name: 'صور A4', value: customerInsights.totalA4 },
    { name: 'الألبومات', value: customerInsights.totalAlbums }
  ].filter(d => d.value > 0), [customerInsights]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32">
      <div className="w-10 h-10 border-4 border-[#D9A3AA]/20 border-t-[#D9A3AA] rounded-full animate-spin mb-4"></div>
      <p className="text-sm text-[#4A4A4A]/50 font-medium">جاري تحليل البيانات...</p>
    </div>
  );

  return (
    <div className="w-full space-y-8 pb-20 text-[#4A4A4A]">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 pt-1">
        <div>
          <h1 className="text-2xl font-black text-[#4A4A4A] tracking-tight">التقرير المالي الذكي</h1>
          <p className="text-sm text-[#4A4A4A]/50 mt-0.5">نظرة شاملة على الأداء المالي مع تحليلات ذكية</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4A4A4A] text-white rounded-xl hover:bg-[#333] transition-colors shadow-lg shadow-[#4A4A4A]/20 text-sm font-bold shrink-0"
        >
          <Download size={16} /> طباعة التقرير
        </button>
      </div>

      {/* KPI Cards — 3 across on md, 6 on lg */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">

        {/* إجمالي الدخل */}
        <div className="bg-white p-5 rounded-2xl border border-[#D9A3AA]/15 shadow-sm col-span-1">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs text-[#4A4A4A]/50 font-bold uppercase tracking-wide">إجمالي الدخل</p>
            <div className="w-8 h-8 bg-[#D9A3AA]/15 text-[#D9A3AA] rounded-xl flex items-center justify-center shrink-0">
              <TrendingUp size={15}/>
            </div>
          </div>
          <h3 className="text-2xl font-black text-[#4A4A4A]">{analytics.totals.totalRevenue.toLocaleString()}</h3>
          <span className="text-xs text-[#4A4A4A]/40">ريال</span>
        </div>

        {/* إجمالي المصروفات */}
        <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm col-span-1">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs text-[#4A4A4A]/50 font-bold uppercase tracking-wide">المصروفات</p>
            <div className="w-8 h-8 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shrink-0">
              <TrendingDown size={15}/>
            </div>
          </div>
          <h3 className="text-2xl font-black text-red-500">{analytics.totals.totalExpenses.toLocaleString()}</h3>
          <span className="text-xs text-[#4A4A4A]/40">ريال</span>
        </div>

        {/* رصيد الباقات */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm col-span-1">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs text-amber-600/70 font-bold uppercase tracking-wide">رصيد الباقات</p>
            <div className="w-8 h-8 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
              <Wallet size={15}/>
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-600">{(analytics.totals.packagesTotal || 0).toLocaleString()}</h3>
          <div className="flex gap-2 mt-1">
            <span className="text-[10px] text-emerald-600 font-medium">↑ {(analytics.totals.packagesCreditsAdded || 0).toFixed(0)}</span>
            <span className="text-[10px] text-red-400 font-medium">↓ {(analytics.totals.packagesRedeemed || 0).toFixed(0)}</span>
          </div>
        </div>

        {/* رصيد النقاط */}
        <div className="bg-white p-5 rounded-2xl border border-orange-100 shadow-sm col-span-1">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs text-[#4A4A4A]/50 font-bold uppercase tracking-wide">رصيد النقاط</p>
            <div className="w-8 h-8 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center shrink-0">
              <Wallet size={15}/>
            </div>
          </div>
          <h3 className="text-2xl font-black text-orange-500">{analytics.totals.totalPointsBalance.toLocaleString()}</h3>
          <span className="text-xs text-[#4A4A4A]/40">ريال (خصم مستقبلي)</span>
        </div>

        {/* الربح الكامل مع الديون */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 rounded-2xl shadow-lg shadow-emerald-500/20 col-span-1">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs text-white/70 font-bold uppercase tracking-wide">الربح الكامل</p>
            <div className="w-8 h-8 bg-white/20 text-white rounded-xl flex items-center justify-center shrink-0">
              <Activity size={15}/>
            </div>
          </div>
          <h3 className={`text-2xl font-black text-white`}>{analytics.totals.netProfitWithDebts.toLocaleString()}</h3>
          <div className="flex gap-2 mt-1">
            <span className="text-[10px] text-white/70">✓ {analytics.totals.netProfit.toFixed(0)}</span>
            <span className="text-[10px] text-white/50">+ ديون {analytics.totals.outstandingDeliveredDebts.toFixed(0)}</span>
          </div>
        </div>

        {/* هامش الربح */}
        <div className="bg-white p-5 rounded-2xl border border-[#C5A059]/20 shadow-sm col-span-1">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs text-[#4A4A4A]/50 font-bold uppercase tracking-wide">هامش الربح</p>
            <div className="w-8 h-8 bg-[#C5A059]/10 text-[#C5A059] rounded-xl flex items-center justify-center shrink-0">
              <PieIcon size={15}/>
            </div>
          </div>
          <h3 className="text-2xl font-black text-[#C5A059]">{analytics.totals.profitMargin}%</h3>
          <span className="text-xs text-[#4A4A4A]/40">من إجمالي الإيرادات</span>
        </div>

      </div>

      {/* --- Store Financials Section --- */}
      <div className="mt-8 mb-4">
        <h3 className="text-lg font-black text-[#4A4A4A] flex items-center gap-2 mb-4">
          <ShoppingBag className="text-[#C5A059]" size={20} /> أداء المتجر (المنتجات الجاهزة)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#D9A3AA]/20 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-[#4A4A4A]/60 font-bold mb-1">مبيعات المتجر</p>
              <h3 className="text-xl font-black text-[#4A4A4A]">{storeStats.sales.toFixed(2)} <span className="text-xs">ر.س</span></h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#D9A3AA]/10 flex items-center justify-center text-[#D9A3AA]"><ShoppingBag size={20} /></div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-600/60 font-bold mb-1">المُحصّل من المتجر</p>
              <h3 className="text-xl font-black text-emerald-600">{storeStats.paid.toFixed(2)} <span className="text-xs">ر.س</span></h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500"><Banknote size={20} /></div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-red-500/60 font-bold mb-1">مديونيات المتجر</p>
              <h3 className="text-xl font-black text-red-500">{storeStats.debt.toFixed(2)} <span className="text-xs">ر.س</span></h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-400"><Wallet size={20} /></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-[#D9A3AA]/15 shadow-sm">
          <h3 className="font-bold text-[#4A4A4A] mb-6">📈 اتجاهات الدخل والمصروفات</h3>
          <div className="h-72 w-full dir-ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.monthlyData}>
                <defs>
                  {/* تدرج الأخضر للإيرادات */}
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.18}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  {/* تدرج الأحمر للمصروفات */}
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.12}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(74,74,74,0.08)"/>
                <XAxis dataKey="name" tick={{fontSize: 11, fill: 'rgba(74,74,74,0.60)'}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize: 11, fill: 'rgba(74,74,74,0.60)'}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(74,74,74,0.12)', fontFamily: 'Cairo, sans-serif'}}/>
                <Area type="monotone" dataKey="revenue"  name="الدخل"       stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2.5} dot={false}/>
                <Area type="monotone" dataKey="expenses" name="المصروفات"   stroke="#ef4444" fillOpacity={1} fill="url(#colorExp)" strokeWidth={2}   dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-[#D9A3AA]/15 shadow-sm">
          <h3 className="font-bold text-[#4A4A4A] mb-2">💸 توزيع المصروفات</h3>
          <div style={{ width: '100%', height: 300, direction: 'ltr' }}>
            {analytics.expenseData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analytics.expenseData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {(() => {
                      const maxVal = Math.max(...analytics.expenseData.map(d => d.value));
                      return analytics.expenseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.value === maxVal ? '#ef4444' : CHART_COLORS[index % CHART_COLORS.length]} />
                      ));
                    })()}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-full text-[#4A4A4A]/50">لا توجد بيانات</div>}
          </div>
        </div>
      </div>

      {/* بطاقة دراسة الجدوى */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-[#D9A3AA]/15 shadow-sm overflow-hidden relative">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-[#4A4A4A] flex items-center gap-2">
              <Activity size={18} className="text-[#C5A059]"/> دراسة الجدوى الحية
            </h3>
            <span className="text-[10px] bg-[#D9A3AA]/12 text-[#C5A059] px-2 py-1 rounded-lg border border-[#D9A3AA]/20">
              تحليل فوري
            </span>
          </div>

          <div className="space-y-6">
            {/* 1. كفاءة التشغيل */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-[#F8F5F2] rounded-xl border border-[#D9A3AA]/10">
                <p className="text-[10px] text-[#4A4A4A]/60 mb-1">متوسط قيمة الطلب (AOV)</p>
                <p className="text-lg font-bold text-[#4A4A4A]/80">
                  {analytics.totals.avgOrderValue} <RiyalSign size="0.65em" />
                </p>
              </div>
              <div className="p-3 bg-[#F8F5F2] rounded-xl border border-[#D9A3AA]/10">
                <p className="text-[10px] text-[#4A4A4A]/60 mb-1">صافي الربح لكل طلب</p>
                <p className={`text-lg font-bold ${analytics.totals.netProfit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {Math.round(analytics.totals.netProfit / (analytics.totals.totalOrders || 1))} <RiyalSign size="0.65em" />
                </p>
              </div>
            </div>

            {/* 2. مؤشر الاستدامة (نقطة التعادل) */}
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-[#4A4A4A]/70 font-bold">تغطية المصروفات</span>
                <span className="text-[#4A4A4A]/50">
                  {Math.round((analytics.totals.totalRevenue / (analytics.totals.totalExpenses || 1)) * 100)}%
                </span>
              </div>
              <div className="w-full bg-[#D9A3AA]/15 rounded-full h-2.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${
                    analytics.totals.netProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, (analytics.totals.totalRevenue / (analytics.totals.totalExpenses || 1)) * 100)}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-[#4A4A4A]/50 mt-1.5">
                {analytics.totals.netProfit >= 0 
                  ? "✅ المشروع يغطي تكاليفه ويحقق أرباحاً." 
                  : "⚠️ الدخل الحالي لا يغطي كامل المصروفات."}
              </p>
            </div>

            {/* 3. معدل النمو */}
            <div className="pt-4 border-t border-[#D9A3AA]/10">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  analytics.monthlyData.length > 1 && 
                  analytics.monthlyData[analytics.monthlyData.length-1].revenue >= analytics.monthlyData[analytics.monthlyData.length-2].revenue 
                    ? 'bg-emerald-100 text-emerald-600' 
                    : 'bg-red-100 text-red-600'
                }`}>
                  {analytics.monthlyData.length > 1 && 
                   analytics.monthlyData[analytics.monthlyData.length-1].revenue >= analytics.monthlyData[analytics.monthlyData.length-2].revenue 
                    ? <TrendingUp size={16}/> 
                    : <TrendingDown size={16}/>
                  }
                </div>
                <div>
                  <p className="text-xs font-bold text-[#4A4A4A]/80">مؤشر النمو الشهري</p>
                  <p className="text-[10px] text-[#4A4A4A]/50">
                    {analytics.monthlyData.length > 1 
                      ? `مقارنة بالشهر السابق (${analytics.monthlyData[analytics.monthlyData.length-2].name})`
                      : "لا توجد بيانات كافية للمقارنة"
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-[#D9A3AA]/10 rounded-full blur-2xl"></div>
        </div>

{/* بطاقة محفز النمو وفرص المبيعات (كبديل للمناطق الجغرافية) */}
        <div className="bg-white p-6 rounded-2xl border border-[#D9A3AA]/15 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-[#4A4A4A] flex items-center gap-2">
              <TrendingUp size={18} className="text-[#C5A059]"/> محفز النمو الشهري
            </h3>
            <span className="text-[10px] bg-[#C5A059]/10 text-[#C5A059] px-2 py-1 rounded-lg font-bold">
              الهدف: +20%
            </span>
          </div>

          {(() => {
            // 1. حساب الهدف الشهري (زيادة 20% عن الشهر الماضي)
            const target = analytics.lastMonthRevenue > 0 ? analytics.lastMonthRevenue * 1.2 : 1000;
            const current = analytics.currentMonthRevenue;
            const progress = Math.min(100, (current / target) * 100);
            const remaining = Math.max(0, target - current);
            
            // 2. اكتشاف فرص البيع الضائعة (طلبات صور كثيرة بدون ألبوم)
            const currentMonthPrefix = new Date().toISOString().substring(0, 7);
            const upsellOrders = orders.filter(o => 
              o.created_at?.startsWith(currentMonthPrefix) && 
              (Number(o.photo_4x6_qty) > 20) && // طلب أكثر من 20 صورة
              (Number(o.album_qty) === 0)       // ولم يشترِ ألبوم
            );
            // بافتراض متوسط سعر الألبوم 35 ريال
            const potentialRevenue = upsellOrders.length * 35; 

            return (
              <div className="space-y-6 mt-2">
                {/* شريط تقدم الهدف المالي */}
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-[#4A4A4A]/70 font-bold">تخطي مبيعات الشهر الماضي</span>
                    <span className="font-bold text-[#C5A059]">{target.toLocaleString(undefined, {maximumFractionDigits: 0})} <RiyalSign /></span>
                  </div>
                  <div className="w-full bg-[#F8F5F2] rounded-full h-3 mb-2 overflow-hidden border border-[#D9A3AA]/10 relative">
                    <div className="bg-gradient-to-r from-[#D9A3AA] to-[#C5A059] h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                  </div>
                  <p className="text-[10px] text-[#4A4A4A]/60 text-center">
                    {remaining > 0 
                      ? <span>باقي {remaining.toLocaleString(undefined, {maximumFractionDigits: 0})} <RiyalSign /> لتحطيم الرقم القياسي 💪</span>
                      : '🎉 بطل! لقد حققت هدف النمو بنجاح!'}
                  </p>
                </div>

                {/* نصيحة زيادة الدخل (البيع المتقاطع) */}
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-400"></div>
                  <h4 className="text-xs font-bold text-amber-800 mb-1.5 flex items-center gap-1">
                    💡 فرصة ذكية لزيادة الدخل!
                  </h4>
                  <p className="text-[11px] text-amber-700/80 leading-relaxed">
                    هذا الشهر، يوجد <span className="font-bold text-amber-900 bg-amber-200/50 px-1 rounded">{upsellOrders.length} طلبات</span> تحتوي على كمية صور كبيرة بدون ألبومات لحفظها.
                  </p>
                  
                  <div className="mt-3 pt-3 border-t border-amber-200/50 flex justify-between items-center text-xs font-bold text-amber-800">
                    <span>اقترح عليهم ألبوماً واكسب:</span>
                    <span className="bg-amber-200 px-2 py-1 rounded-md text-amber-900">+{potentialRevenue} <RiyalSign /></span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="bg-gradient-to-r from-[#4A4A4A] to-[#343434] rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex-1">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><Users className="text-[#C5A059]"/> استعادة العملاء (Churn)</h3>
          <p className="text-sm text-white/80 mb-4">هؤلاء العملاء لم يطلبوا منذ 3 أشهر. انسخ كود الخصم وأرسله لهم!</p>
          <div className="flex flex-wrap gap-2">
            {analytics.churnedList.length > 0 ? analytics.churnedList.map(c => (
              <div key={c.phone} className="bg-white/10 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                <span>{c.name}</span>
                <span className="text-[#4A4A4A]/50">|</span>
                <span className="font-mono">{format(c.date, 'MM/yy')}</span>
              </div>
            )) : <span className="text-sm text-emerald-400 font-bold">رائع! جميع عملائك نشطون 👏</span>}
          </div>
        </div>
        <button 
          onClick={() => { navigator.clipboard.writeText("اشتقنا لك! استخدم كود WELCOMEBACK لخصم 15% على طلبك القادم."); toast.success("تم نسخ الرسالة"); }}
          className="bg-white text-[#4A4A4A] px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#D9A3AA]/10 transition-colors flex items-center gap-2 shadow-lg"
        >
          <Copy size={16}/> نسخ عرض العودة
        </button>
      </div>

      {/* ✅ جدول التفاصيل الشهرية الديناميكي ✅ */}
      <div className="bg-white rounded-2xl border border-[#D9A3AA]/15 overflow-hidden">
        <div className="p-4 border-b border-[#D9A3AA]/10 bg-[#F8F5F2]/50"><h3 className="font-bold text-[#4A4A4A]/80 text-sm">التفاصيل الشهرية</h3></div>
        <div className="overflow-x-auto">
        <table className="w-full text-right text-sm min-w-[500px]">
          <thead className="bg-[#F8F5F2] text-[#4A4A4A]/60">
            <tr>
              <th className="px-6 py-4">الشهر</th>
              <th className="px-6 py-4">الدخل</th>
              <th className="px-6 py-4">المصروفات</th>
              <th className="px-6 py-4">الصافي</th>
              <th className="px-6 py-4">الطلبات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D9A3AA]/10">
            {analytics.monthlyData.slice().reverse().map((row) => {
              
              const monthPayments = payments.filter(p => p.payment_date?.startsWith(row.name));
              const monthExpenses = expenses.filter(e => e.date?.startsWith(row.name));

              const incomeByCustomer = monthPayments.reduce((acc, curr) => {
                const order = orders.find(o => o.id === curr.order_id);
                const customerName = order ? order.customer_name : 'عميل غير معروف';
                acc[customerName] = (acc[customerName] || 0) + Number(curr.amount);
                return acc;
              }, {});

              // ✅ التعديل هنا: قراءة 'title' بدلاً من 'category'
              const expensesByCategory = monthExpenses.reduce((acc, curr) => {
                const cat = curr.title || 'غير مصنف';
                acc[cat] = (acc[cat] || 0) + Number(curr.amount);
                return acc;
              }, {});

              const isExpanded = expandedMonth === row.name;

              return (
                <React.Fragment key={row.name}>
                  <tr 
                    onClick={() => setExpandedMonth(isExpanded ? null : row.name)}
                    className="hover:bg-[#F8F5F2] cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-4 font-bold flex items-center gap-2">
                      <div className={`p-1 rounded-full transition-colors ${isExpanded ? 'bg-[#D9A3AA] text-white' : 'bg-[#D9A3AA]/10 text-[#D9A3AA] group-hover:bg-[#D9A3AA] group-hover:text-white'}`}>
                         <ChevronDown size={14} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                      {isValid(row.date) ? format(row.date, 'MMMM yyyy', { locale: arSA }) : row.name}
                    </td>
                    <td className="px-6 py-4 text-emerald-600">{row.revenue.toLocaleString()}</td>
                    <td className="px-6 py-4 text-red-500">{row.expenses.toLocaleString()}</td>
                    <td className={`px-6 py-4 font-bold ${(row.profit || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{(row.profit || 0).toLocaleString()}</td>
                    <td className="px-6 py-4">{row.orders}</td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-[#F8F5F2]/40 border-b-2 border-[#D9A3AA]/20">
                      <td colSpan="5" className="p-0">
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 fade-in duration-300">
                          
                          <div className="bg-white p-5 rounded-xl border border-emerald-100 shadow-sm">
                            <h4 className="font-bold text-emerald-700 mb-4 text-xs flex items-center gap-2 pb-2 border-b border-emerald-50">
                              <TrendingUp size={16}/> مصادر الدخل (العملاء)
                            </h4>
                            {Object.keys(incomeByCustomer).length > 0 ? (
                              <ul className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {Object.entries(incomeByCustomer)
                                  .sort((a, b) => b[1] - a[1]) 
                                  .map(([name, amount], idx) => (
                                  <li key={idx} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                                    <span className="text-[#4A4A4A]/80 font-medium">{name}</span>
                                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{amount.toLocaleString()} <RiyalSign /></span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-[#4A4A4A]/40 text-center py-2">لا توجد دفعات مسجلة</p>
                            )}
                          </div>

                          <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm">
                            <h4 className="font-bold text-red-600 mb-4 text-xs flex items-center gap-2 pb-2 border-b border-red-50">
                              <TrendingDown size={16}/> بنود المصروفات
                            </h4>
                            {Object.keys(expensesByCategory).length > 0 ? (
                              <ul className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {Object.entries(expensesByCategory)
                                  .sort((a, b) => b[1] - a[1])
                                  .map(([category, amount], idx) => (
                                  <li key={idx} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                                    <span className="text-[#4A4A4A]/80 font-medium">{category}</span>
                                    <span className="font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md">{amount.toLocaleString()} <RiyalSign /></span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-[#4A4A4A]/40 text-center py-2">لا توجد مصروفات مسجلة</p>
                            )}
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

    </div>
  );
}
