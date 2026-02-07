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

        // --- الحسابات العامة ---
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((acc, order) => acc + (order.total_amount || 0), 0);
        const totalCashReceived = orders.reduce((acc, order) => acc + (order.deposit || 0), 0);
        const totalDebt = totalRevenue - totalCashReceived;
        const totalExpenses = expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);
        
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
          (o.total_amount - (o.deposit || 0)) > 0.5 // هامش بسيط للكسور
        );

        setStats({ 
          totalOrders, totalRevenue, totalCashReceived, totalDebt, totalExpenses, 
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

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline-block ml-2"/> جاري تحميل البيانات...</div>;

  const realNetProfit = stats.totalCashReceived - stats.totalExpenses;

  return (
    <div className="space-y-8 pb-10 text-[#4A4A4A]">
      
      {/* البطاقة العلوية (المالية) */}
      <div className="relative overflow-hidden bg-[#4A4A4A] rounded-3xl p-6 text-white shadow-xl">
        <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div className="mb-2 xl:mb-0">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">لوحة القيادة 🚀</h1>
            <p className="text-white/70 text-sm">
              ملخص الأداء المالي والتشغيلي لمتجرك اليوم.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3 w-full xl:w-auto justify-start xl:justify-end">
            <div className="bg-[#4A4A4A]/95/80 backdrop-blur-md px-5 py-3 rounded-2xl border border-[#D9A3AA]/25 text-center min-w-[140px] flex-1 xl:flex-none">
               <span className="text-[10px] text-[#4A4A4A]/50 block mb-1 font-bold">المصروفات</span>
               <span className="text-xl font-bold dir-ltr text-white/80">
                 {stats.totalExpenses.toLocaleString()} <span className="text-xs opacity-60">ر.س</span>
               </span>
            </div>
            <div className="bg-red-500/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-red-500/20 text-center min-w-[140px] flex-1 xl:flex-none">
               <span className="text-[10px] text-red-200 block mb-1 font-bold">المديونية</span>
               <span className="text-xl font-bold dir-ltr text-red-400">
                 {stats.totalDebt.toLocaleString()} <span className="text-xs opacity-60">ر.س</span>
               </span>
            </div>
            <div className="bg-[#D9A3AA]/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-[#D9A3AA]/30 text-center min-w-[140px] flex-1 xl:flex-none">
               <span className="text-[10px] text-white/70 block mb-1 font-bold">صافي الربح </span>
               <span className={`text-xl font-bold dir-ltr ${realNetProfit >= 0 ? 'text-[#D9A3AA]' : 'text-red-400'}`}>
                 {realNetProfit.toLocaleString()} <span className="text-xs opacity-60">ر.س</span>
               </span>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D9A3AA]/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
      </div>

      {/* الصف الأول: الإحصائيات التشغيلية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#D9A3AA]/20 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-[#4A4A4A]/60 font-bold mb-1">طلبات جديدة</p>
            <p className="text-2xl font-black text-[#D9A3AA]">{stats.newOrders}</p>
          </div>
          <div className="p-3 bg-[#D9A3AA]/10 text-[#D9A3AA] rounded-xl"><ShoppingBag size={20} /></div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#D9A3AA]/20 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-[#4A4A4A]/60 font-bold mb-1">قيد التنفيذ</p>
            <p className="text-2xl font-black text-[#4A4A4A]">{stats.pendingOrders}</p>
          </div>
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Clock size={20} /></div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#D9A3AA]/20 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-[#4A4A4A]/60 font-bold mb-1">متأخرة</p>
            <p className="text-2xl font-black text-red-600">{stats.lateOrders}</p>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl"><AlertCircle size={20} /></div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#D9A3AA]/20 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-[#4A4A4A]/60 font-bold mb-1">مجموع الطلبات</p>
            <p className="text-2xl font-black text-[#D9A3AA]">{stats.totalOrders}</p>
          </div>
          <div className="p-3 bg-[#D9A3AA]/10 text-[#C5A059] rounded-xl"><FileText size={20} /></div>
        </div>
      </div>

      {/* الصف الثاني: الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* رسم المبيعات */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-[#D9A3AA]/20 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-[#4A4A4A] flex items-center gap-2">
              <TrendingUp size={18} className="text-[#D9A3AA]"/> حركة المبيعات والمصروفات (7 أيام)
            </h3>
          </div>
          <div className="h-64 w-full dir-ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Legend verticalAlign="top" height={36} iconType="circle"/>
                <Bar dataKey="sales" name="المبيعات" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="expenses" name="المصروفات" fill="#C5A059" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* --- البطاقة الجديدة: مديونيات (تم التسليم) --- */}
        <div className="bg-white p-6 rounded-2xl border border-[#D9A3AA]/20 shadow-sm flex flex-col max-h-[350px]">
          <h3 className="font-bold text-[#4A4A4A] w-full mb-4 text-center flex items-center justify-center gap-2">
            <Wallet className="text-red-500" size={20}/> مستحقات (تم التسليم)
          </h3>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
            {unpaidDelivered.length > 0 ? (
              unpaidDelivered.map((order) => {
                const remaining = order.total_amount - (order.deposit || 0);
                const phone = order.phone?.replace(/^0/, '966') || '';
                const msg = `مرحباً ${order.customer_name} 🌸\n\nنود تذكيرك بأن طلبك رقم *#${order.id.slice(0, 6)}* قد تم تسليمه.\n\nالمبلغ المتبقي: *${remaining} ريال*.\n\nنرجو التحويل وشكراً لتعاملك معنا ✨`;

                return (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100 group hover:border-red-200 transition-colors">
                    <div>
                      <div className="font-bold text-[#4A4A4A] text-sm">{order.customer_name}</div>
                      <div className="text-[10px] text-[#4A4A4A]/60">#{order.id.slice(0, 6)}</div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className="text-red-600 font-black text-sm">{remaining} ر.س</span>
                      {order.phone && (
                        <a 
                          href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="bg-white p-1.5 rounded-lg border border-red-200 text-[#D9A3AA] hover:bg-[#D9A3AA]/10 hover:border-[#D9A3AA]/40 transition-colors"
                          title="مطالبة عبر واتساب"
                        >
                          <MessageCircle size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-white/70">
                <span className="text-4xl mb-2">🎉</span>
                <span className="text-sm">لا توجد مديونيات مستحقة</span>
              </div>
            )}
          </div>
          
          {unpaidDelivered.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[#D9A3AA]/15 text-center">
              <span className="text-xs text-[#4A4A4A]/50">إجمالي المستحقات: </span>
              <span className="font-bold text-red-600">
                {unpaidDelivered.reduce((sum, o) => sum + (o.total_amount - (o.deposit || 0)), 0).toLocaleString()} ر.س
              </span>
            </div>
          )}
        </div>

      </div>

      {/* الصف الثالث: الطلبات الجديدة */}
      <div className="bg-white rounded-2xl border border-[#D9A3AA]/20 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#D9A3AA]/15 flex justify-between items-center">
          <h3 className="font-bold text-[#4A4A4A] flex items-center gap-2">
            <ShoppingBag className="text-[#D9A3AA]" size={20}/> أحدث الطلبات الجديدة
          </h3>
          <Link to="/app/orders" className="text-sm text-[#D9A3AA] font-bold hover:underline flex items-center gap-1">
            عرض الكل <ChevronRight size={16} className="rotate-180"/>
          </Link>
        </div>
        
        <div className="overflow-x-auto">
          {recentNewOrders.length > 0 ? (
            <table className="w-full text-right text-sm">
              <thead className="bg-[#F8F5F2] text-[#4A4A4A]/60 font-medium">
                <tr>
                  <th className="px-6 py-4">رقم الطلب</th>
                  <th className="px-6 py-4">العميل</th>
                  <th className="px-6 py-4">تاريخ التسليم</th>
                  <th className="px-6 py-4">الإجمالي</th>
                  <th className="px-6 py-4">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9A3AA]/10">
                {recentNewOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#F8F5F2] transition-colors">
                    <td className="px-6 py-4 font-mono text-[#4A4A4A]/60">#{order.id.slice(0, 6)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#D9A3AA]/15 flex items-center justify-center text-[#D9A3AA] font-bold">
                          <User size={14}/>
                        </div>
                        <div>
                          <span className="block font-bold text-[#4A4A4A]">{order.customer_name}</span>
                          <span className="text-xs text-[#4A4A4A]/50">{order.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2 text-[#4A4A4A]/70 bg-[#F8F5F2] px-3 py-1 rounded-lg w-fit">
                        <Calendar size={14}/> {order.delivery_date || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-[#4A4A4A]">{order.total_amount} ر.س</td>
                    <td className="px-6 py-4">
                      <Link to={`/app/orders/${order.id}`} className="px-4 py-2 bg-[#D9A3AA] text-white rounded-xl text-xs font-bold hover:bg-[#C5A059] transition-colors">
                        معالجة
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center text-[#4A4A4A]/50">لا توجد طلبات جديدة حالياً 🎉</div>
          )}
        </div>
      </div>

    </div>
  );
}