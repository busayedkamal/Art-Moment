// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { 
  ShoppingBag, Banknote, Clock, Loader2, TrendingDown, 
  AlertCircle, TrendingUp, ChevronRight, User, Calendar, FileText, MessageCircle, Wallet 
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import RiyalSign from '../components/RiyalSign';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalCashReceived: 0,
    totalDebt: 0,
    totalExpenses: 0,
    pendingOrders: 0,
    newOrders: 0,
    lateOrders: 0,
  });
  const [chartData, setChartData] = useState([]);
  const [recentNewOrders, setRecentNewOrders] = useState([]);
  
  // حالة جديدة للمديونيات المستحقة (تم التسليم)
  const [unpaidDelivered, setUnpaidDelivered] = useState([]); 
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const today = new Date().toISOString().slice(0, 10);

        // 1. جلب الطلبات
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (ordersError) throw ordersError;

        // 2. جلب المصروفات
        const { data: expenses, error: expensesError } = await supabase
          .from('expenses')
          .select('*');
        
        if (expensesError) throw expensesError;

        // 3. جلب رصيد المحافظ
        const { data: wallets, error: walletsError } = await supabase
          .from('wallets')
          .select('phone, points_balance')
          .order('id', { ascending: true }); // الأحدث (id أعلى) يفوز عند التكرار

        // 4. جلب معاملات الباقات لحساب رصيد الباقات بشكل منفصل
        const { data: packageTransactions, error: transactionsError } = await supabase
          .from('wallet_transactions')
          .select('*')
          .in('type', ['package_charge', 'package_add', 'package_redeem']);

        if (walletsError) throw walletsError;
        if (transactionsError) throw transactionsError;

        // دالة تطبيع رقم الهاتف (نفس منطق صفحة العملاء)
        const normalizePhone = (raw) => {
          if (!raw) return '';
          let p = String(raw).replace(/\D/g, '');
          if (p.startsWith('966')) p = p.slice(3);
          if (p.startsWith('0')) p = p.slice(1);
          return p;
        };

        // --- الحسابات العامة ---
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((acc, order) => acc + (order.total_amount || 0), 0);

        // ✅ النقد الفعلي = deposit مسقوف بـ (total - wallet_used)
        // يمنع احتساب مبالغ النقاط ضمن الإيرادات النقدية في حال سُجّل الدفع قبل تطبيق النقاط
        const totalCashReceived = orders.reduce((acc, order) => {
          const dep    = Number(order.deposit     || 0);
          const wallet = Number(order.wallet_used || 0);
          const total  = Number(order.total_amount|| 0);
          // أقصى نقد ممكن = total − wallet (ما تبقى بعد حسم النقاط)
          const realCash = Math.min(dep, Math.max(0, total - wallet));
          return acc + realCash;
        }, 0);
        // ✅ المديونيات الفعلية: المتبقي الإيجابي فقط (لا نطرح الحالات السالبة "الدفع الزائد")
        const totalDebt = orders
          .filter(o => ((o.total_amount || 0) - (o.deposit || 0) - Number(o.wallet_used || 0)) > 0.5)
          .reduce((sum, o) => sum + ((o.total_amount || 0) - (o.deposit || 0) - Number(o.wallet_used || 0)), 0);
        const totalExpenses = expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);

        // إزالة التكرار: نحسب رصيداً واحداً لكل رقم هاتف (الأحدث يفوز)
        // نتجاهل المحافظ بدون رقم هاتف (مثل المحفظة الإدارية)
        const walletByPhone = {};
        (wallets || []).forEach(w => {
          const key = normalizePhone(w.phone);
          if (!key) return;
          walletByPhone[key] = Number(w.points_balance || 0);
        });
        const totalPointsBalance = Object.values(walletByPhone).reduce((acc, v) => acc + v, 0);
        const packagesCreditsAdded = (packageTransactions || [])
          .filter(pt => pt.type === 'package_charge' || pt.type === 'package_add')
          .reduce((acc, pt) => acc + Number(pt.points || 0), 0);
        const packagesRedeemed = (packageTransactions || [])
          .filter(pt => pt.type === 'package_redeem')
          .reduce((acc, pt) => acc + Number(pt.amount_value || 0), 0);
        const packagesTotal = Math.max(0, packagesCreditsAdded - packagesRedeemed);
        const totalPackageBalance = packagesTotal;
        const totalWalletBalance = totalPointsBalance;
        
        const pendingOrders = orders.filter(o => o.status === 'printing' || o.status === 'new').length;
        const newOrdersCount = orders.filter(o => o.status === 'new').length;
        const lateOrders = orders.filter(o => 
          o.delivery_date && 
          o.delivery_date < today && 
          o.status !== 'delivered'
        ).length;

        const recentNew = orders.filter(o => o.status === 'new').slice(0, 5);

        // --- فلترة المديونيات المستحقة (تم التسليم + باقي مبلغ) ---
        const debts = orders.filter(o =>
          o.status === 'delivered' &&
          (o.total_amount - (o.deposit || 0) - Number(o.wallet_used || 0)) > 0.5
        );

        setStats({ 
          totalOrders, totalRevenue, totalCashReceived, totalDebt, totalExpenses, 
          totalWalletBalance, totalPointsBalance, totalPackageBalance, packagesTotal,
          pendingOrders, newOrders: newOrdersCount, lateOrders 
        });
        setRecentNewOrders(recentNew);
        setUnpaidDelivered(debts); // حفظ القائمة

        // --- تجهيز بيانات الرسم البياني ---
        const last7Days = [...Array(7)].map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return d.toISOString().slice(0, 10);
        }).reverse();

        const combinedChartData = last7Days.map(date => {
          const dayRevenue = orders
            .filter(o => o.created_at.startsWith(date))
            .reduce((acc, o) => acc + o.total_amount, 0);

          const dayExpenses = expenses
            .filter(e => {
              const expDate = e.date || e.created_at;
              return expDate && expDate.startsWith(date);
            })
            .reduce((acc, e) => acc + e.amount, 0);

          return { 
            name: date.slice(5), 
            sales: dayRevenue, 
            expenses: dayExpenses 
          }; 
        });
        setChartData(combinedChartData);

      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Loader2 className="animate-spin text-[#D9A3AA] mx-auto mb-3" size={36}/>
        <p className="text-[#4A4A4A]/60 text-sm">جاري تحميل البيانات...</p>
      </div>
    </div>
  );

  const realNetProfit = stats.totalCashReceived + (stats.packagesTotal || 0) - stats.totalExpenses;

  return (
    <div className="w-full px-6 xl:px-10 space-y-6 pb-12 text-[#4A4A4A]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-black text-[#4A4A4A] tracking-tight">لوحة القيادة</h1>
          <p className="text-sm text-[#4A4A4A]/50 mt-0.5">ملخص الأداء المالي والتشغيلي</p>
        </div>
        <div className="text-3xl select-none">🚀</div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* إجمالي المبيعات */}
        <div className="col-span-2 lg:col-span-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#4A4A4A]/50 uppercase tracking-wide">إجمالي المبيعات</span>
            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
              <TrendingUp size={15} className="text-slate-400"/>
            </div>
          </div>
          <p className="text-2xl font-black text-[#4A4A4A]">{stats.totalRevenue.toLocaleString()}</p>
          <span className="text-xs text-[#4A4A4A]/40">ريال </span>
        </div>

        {/* رصيد الباقات */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl shadow-lg shadow-amber-500/20 p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/70 uppercase tracking-wide">رصيد الباقات</span>
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Wallet size={15} className="text-white"/>
            </div>
          </div>
          <p className="text-2xl font-black text-white">{(stats.totalPackageBalance || 0).toLocaleString()}</p>
          <span className="text-xs text-white/60">ريال مشحون مسبقاً</span>
        </div>

        {/* رصيد النقاط */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#4A4A4A]/50 uppercase tracking-wide">رصيد النقاط</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
              <Banknote size={15} className="text-orange-400"/>
            </div>
          </div>
          <p className="text-2xl font-black text-orange-500">{stats.totalPointsBalance.toLocaleString()}</p>
          <span className="text-xs text-[#4A4A4A]/40">ريال (خصومات مكتسبة)</span>
        </div>

        {/* المديونية */}
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-400/80 uppercase tracking-wide">المديونية</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
              <TrendingDown size={15} className="text-red-400"/>
            </div>
          </div>
          <p className="text-2xl font-black text-red-500">{stats.totalDebt.toLocaleString()}</p>
          <span className="text-xs text-red-400/60">ريال غير محصّل</span>
        </div>

        {/* صافي الربح */}
        <div className={`rounded-2xl shadow-lg p-5 flex flex-col gap-2 ${realNetProfit >= 0 ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/20' : 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/20'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/70 uppercase tracking-wide">صافي الربح</span>
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <TrendingUp size={15} className="text-white"/>
            </div>
          </div>
          <p className="text-2xl font-black text-white">{realNetProfit.toLocaleString()}</p>
          <span className="text-xs text-white/60">ريال (محصّل - مصروفات)</span>
        </div>
      </div>

      {/* ── Operational Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'طلبات جديدة', value: stats.newOrders, color: 'text-[#D9A3AA]', bg: 'bg-[#D9A3AA]/8', icon: <ShoppingBag size={18}/>, iconColor: 'text-[#D9A3AA]' },
          { label: 'قيد التنفيذ', value: stats.pendingOrders, color: 'text-orange-500', bg: 'bg-orange-50', icon: <Clock size={18}/>, iconColor: 'text-orange-500' },
          { label: 'متأخرة', value: stats.lateOrders, color: 'text-red-500', bg: 'bg-red-50', icon: <AlertCircle size={18}/>, iconColor: 'text-red-500' },
          { label: 'مجموع الطلبات', value: stats.totalOrders, color: 'text-[#4A4A4A]', bg: 'bg-slate-50', icon: <FileText size={18}/>, iconColor: 'text-slate-400' },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#4A4A4A]/50 font-bold mb-2">{item.label}</p>
              <p className={`text-3xl font-black ${item.color}`}>{item.value}</p>
            </div>
            <div className={`w-11 h-11 ${item.bg} rounded-xl flex items-center justify-center ${item.iconColor}`}>
              {item.icon}
            </div>
          </div>
        ))}
      </div>

      {/* ── Chart + Debts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* رسم المبيعات */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-black text-[#4A4A4A]">حركة المبيعات والمصروفات</h3>
              <p className="text-xs text-[#4A4A4A]/40 mt-0.5">آخر 7 أيام</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#4A4A4A]/50">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>مبيعات</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#C5A059] inline-block"></span>مصروفات</span>
            </div>
          </div>
          <div className="h-64 w-full dir-ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#94a3b8'}}/>
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#94a3b8'}} width={40}/>
                <RechartsTooltip cursor={{fill: '#f8fafc', radius: 8}} contentStyle={{borderRadius: '14px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: '10px 16px'}}/>
                <Bar dataKey="sales" name="المبيعات" fill="#10b981" radius={[6, 6, 0, 0]} barSize={22}/>
                <Bar dataKey="expenses" name="المصروفات" fill="#C5A059" radius={[6, 6, 0, 0]} barSize={22}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* مستحقات تم التسليم */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center">
                <Wallet size={16} className="text-red-500"/>
              </div>
              <div>
                <h3 className="font-black text-[#4A4A4A] text-sm">مستحقات التسليم</h3>
                <p className="text-[10px] text-[#4A4A4A]/40">مُسلَّمة ولم تُدفع</p>
              </div>
            </div>
            {unpaidDelivered.length > 0 && (
              <span className="bg-red-100 text-red-600 text-xs font-black px-2 py-0.5 rounded-full">
                {unpaidDelivered.length}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5" style={{maxHeight: 280}}>
            {unpaidDelivered.length > 0 ? (
              unpaidDelivered.map((order) => {
                const remaining = order.total_amount - (order.deposit || 0) - Number(order.wallet_used || 0);
                const phone = order.phone?.replace(/^0/, '966') || '';
                const msg = `مرحباً ${order.customer_name}\n\nنود تذكيرك بأن طلبك رقم *#${order.id.slice(0, 6)}* قد تم تسليمه.\n\nالمبلغ المتبقي: *${remaining} ريال*.\n\nنرجو التحويل وشكراً لتعاملك معنا\n\nhttps://www.art-moment.com/track`;
                return (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-red-50/60 hover:bg-red-50 rounded-xl border border-red-100/80 transition-colors group">
                    <div>
                      <p className="font-bold text-[#4A4A4A] text-sm leading-tight">{order.customer_name}</p>
                      <p className="text-[10px] text-[#4A4A4A]/40 mt-0.5 font-mono">#{order.id.slice(0, 6)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-600 font-black text-sm">{remaining.toFixed(0)} <RiyalSign /></span>
                      {order.phone && (
                        <a href={`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"
                          className="w-7 h-7 bg-white rounded-lg border border-red-100 flex items-center justify-center text-[#D9A3AA] hover:text-emerald-600 hover:border-emerald-200 transition-colors opacity-0 group-hover:opacity-100"
                          title="مطالبة واتساب">
                          <MessageCircle size={13}/>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-10 text-center">
                <span className="text-4xl mb-2">🎉</span>
                <p className="text-sm text-[#4A4A4A]/40 font-medium">لا توجد مديونيات</p>
              </div>
            )}
          </div>

          {unpaidDelivered.length > 0 && (
            <div className="px-5 py-3 bg-red-50/50 border-t border-red-100/60 flex justify-between items-center">
              <span className="text-xs text-[#4A4A4A]/50 font-medium">المستحقات المسلّمة</span>
              <span className="font-black text-red-600 text-sm">
                {unpaidDelivered.reduce((sum, o) => sum + (o.total_amount - (o.deposit||0) - Number(o.wallet_used||0)), 0).toFixed(2)} <RiyalSign />
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Latest New Orders ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#D9A3AA]/10 rounded-xl flex items-center justify-center">
              <ShoppingBag size={16} className="text-[#D9A3AA]"/>
            </div>
            <div>
              <h3 className="font-black text-[#4A4A4A] text-sm">أحدث الطلبات الجديدة</h3>
              <p className="text-[10px] text-[#4A4A4A]/40">بانتظار المعالجة</p>
            </div>
          </div>
          <Link to="/app/orders" className="text-xs text-[#D9A3AA] font-bold hover:text-[#C5A059] transition-colors flex items-center gap-1">
            عرض الكل <ChevronRight size={14} className="rotate-180"/>
          </Link>
        </div>

        {recentNewOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-slate-50/60 text-[#4A4A4A]/40 text-xs font-bold uppercase tracking-wide">
                  <th className="px-6 py-3.5">رقم الطلب</th>
                  <th className="px-6 py-3.5">العميل</th>
                  <th className="px-6 py-3.5">موعد التسليم</th>
                  <th className="px-6 py-3.5">الإجمالي</th>
                  <th className="px-6 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentNewOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-[#4A4A4A]/50 bg-slate-100 px-2 py-1 rounded-md">#{order.id.slice(0, 6)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D9A3AA]/20 to-[#C5A059]/20 flex items-center justify-center text-[#C5A059] font-black text-base shrink-0">
                          {order.customer_name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-[#4A4A4A] text-sm leading-tight">{order.customer_name}</p>
                          <p className="text-[11px] text-[#4A4A4A]/40 font-mono mt-0.5 dir-ltr text-right">{order.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#4A4A4A]/60 bg-slate-100 px-3 py-1.5 rounded-lg font-medium">
                        <Calendar size={12}/> {order.delivery_date || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-black text-[#4A4A4A]">{order.total_amount}</span>
                      <span className="text-[11px] text-[#4A4A4A]/40 mr-1"><RiyalSign /></span>
                    </td>
                    <td className="px-6 py-4 text-left">
                      <Link to={`/app/orders/${order.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#D9A3AA] hover:bg-[#C5A059] text-white rounded-xl text-xs font-bold transition-colors shadow-sm shadow-[#D9A3AA]/30">
                        معالجة <ChevronRight size={13} className="rotate-180"/>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <p className="text-5xl mb-3">🎉</p>
            <p className="text-[#4A4A4A]/40 font-medium">لا توجد طلبات جديدة حالياً</p>
          </div>
        )}
      </div>

    </div>
  );
}