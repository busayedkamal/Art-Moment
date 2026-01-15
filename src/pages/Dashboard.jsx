// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { 
  ShoppingBag, Banknote, Clock, Loader2, TrendingDown, 
  AlertCircle, TrendingUp, ChevronRight, User, Calendar, FileText 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

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
  const [chartData, setChartData] = useState([]); // تم توحيد البيانات هنا
  const [productsData, setProductsData] = useState([]);
  const [recentNewOrders, setRecentNewOrders] = useState([]);
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

        // 2. جلب المصروفات (تم تعديل الطلب لجلب التاريخ أيضاً)
        const { data: expenses, error: expensesError } = await supabase
          .from('expenses')
          .select('*'); // نحتاج التاريخ هنا
        
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

        setStats({ 
          totalOrders, totalRevenue, totalCashReceived, totalDebt, totalExpenses, 
          pendingOrders, newOrders: newOrdersCount, lateOrders 
        });
        setRecentNewOrders(recentNew);

        // --- تجهيز بيانات الرسم البياني (مبيعات + مصروفات) ---
        const last7Days = [...Array(7)].map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return d.toISOString().slice(0, 10);
        }).reverse();

        const combinedChartData = last7Days.map(date => {
          // حساب مبيعات اليوم
          const dayRevenue = orders
            .filter(o => o.created_at.startsWith(date))
            .reduce((acc, o) => acc + o.total_amount, 0);

          // حساب مصروفات اليوم (الجديد)
          const dayExpenses = expenses
            .filter(e => {
              // التحقق من تاريخ المصروف سواء كان date أو created_at
              const expDate = e.date || e.created_at;
              return expDate && expDate.startsWith(date);
            })
            .reduce((acc, e) => acc + e.amount, 0);

          return { 
            name: date.slice(5), // الشهر-اليوم
            sales: dayRevenue, 
            expenses: dayExpenses 
          }; 
        });
        setChartData(combinedChartData);

        // --- المنتجات ---
        const totalA4 = orders.reduce((acc, o) => acc + (o.a4_qty || 0), 0);
        const total4x6 = orders.reduce((acc, o) => acc + (o.photo_4x6_qty || 0), 0);
        
        setProductsData([
          { name: 'صور 4×6', value: total4x6 },
          { name: 'صور A4', value: totalA4 },
        ]);

      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const COLORS = ['#10b981', '#3b82f6'];

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline-block ml-2"/> جاري تحميل البيانات...</div>;

  const realNetProfit = stats.totalCashReceived - stats.totalExpenses;

  return (
    <div className="space-y-8 pb-10">
      
      {/* البطاقة العلوية (المالية) */}
      <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
        <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div className="mb-2 xl:mb-0">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">لوحة القيادة 🚀</h1>
            <p className="text-slate-300 text-sm">
              ملخص الأداء المالي والتشغيلي لمتجرك اليوم.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3 w-full xl:w-auto justify-start xl:justify-end">
            <div className="bg-slate-800/80 backdrop-blur-md px-5 py-3 rounded-2xl border border-slate-700 text-center min-w-[140px] flex-1 xl:flex-none">
               <span className="text-[10px] text-slate-400 block mb-1 font-bold">المصروفات</span>
               <span className="text-xl font-bold dir-ltr text-slate-200">
                 {stats.totalExpenses.toLocaleString()} <span className="text-xs opacity-60">ر.س</span>
               </span>
            </div>
            <div className="bg-red-500/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-red-500/20 text-center min-w-[140px] flex-1 xl:flex-none">
               <span className="text-[10px] text-red-200 block mb-1 font-bold">المديونية</span>
               <span className="text-xl font-bold dir-ltr text-red-400">
                 {stats.totalDebt.toLocaleString()} <span className="text-xs opacity-60">ر.س</span>
               </span>
            </div>
            <div className="bg-emerald-500/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-emerald-500/20 text-center min-w-[140px] flex-1 xl:flex-none">
               <span className="text-[10px] text-emerald-200 block mb-1 font-bold">صافي الربح </span>
               <span className={`text-xl font-bold dir-ltr ${realNetProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                 {realNetProfit.toLocaleString()} <span className="text-xs opacity-60">ر.س</span>
               </span>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
      </div>

      {/* الصف الأول: الإحصائيات التشغيلية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">طلبات جديدة</p>
            <p className="text-2xl font-black text-emerald-600">{stats.newOrders}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><ShoppingBag size={20} /></div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">قيد التنفيذ</p>
            <p className="text-2xl font-black text-slate-900">{stats.pendingOrders}</p>
          </div>
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Clock size={20} /></div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">متأخرة</p>
            <p className="text-2xl font-black text-red-600">{stats.lateOrders}</p>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl"><AlertCircle size={20} /></div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">مجموع الطلبات</p>
            <p className="text-2xl font-black text-blue-600">{stats.totalOrders}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><FileText size={20} /></div>
        </div>
      </div>

      {/* الصف الثاني: الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* رسم المبيعات والمصروفات (المحدث) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-500"/> حركة المبيعات والمصروفات (7 أيام)
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
                
                {/* عمود المبيعات */}
                <Bar dataKey="sales" name="المبيعات" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                
                {/* عمود المصروفات (الجديد) */}
                <Bar dataKey="expenses" name="المصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* رسم المنتجات */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
          <h3 className="font-bold text-slate-800 w-full mb-4 text-center">المنتجات الأكثر طلباً</h3>
          <div className="h-48 w-full dir-ltr relative">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={productsData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {productsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <span className="block text-2xl font-bold text-slate-800">{productsData.reduce((a, b) => a + b.value, 0)}</span>
                <span className="text-[10px] text-slate-400">صورة</span>
              </div>
            </div>
          </div>
          <div className="flex gap-4 mt-4">
            {productsData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index]}}></div>
                <span className="text-slate-600">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* الصف الثالث: الطلبات الجديدة */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <ShoppingBag className="text-emerald-500" size={20}/> أحدث الطلبات الجديدة
          </h3>
          <Link to="/app/orders" className="text-sm text-emerald-600 font-bold hover:underline flex items-center gap-1">
            عرض الكل <ChevronRight size={16} className="rotate-180"/>
          </Link>
        </div>
        
        <div className="overflow-x-auto">
          {recentNewOrders.length > 0 ? (
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-6 py-4">رقم الطلب</th>
                  <th className="px-6 py-4">العميل</th>
                  <th className="px-6 py-4">تاريخ التسليم</th>
                  <th className="px-6 py-4">الإجمالي</th>
                  <th className="px-6 py-4">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentNewOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-500">#{order.id.slice(0, 6)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                          <User size={14}/>
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900">{order.customer_name}</span>
                          <span className="text-xs text-slate-400">{order.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2 text-slate-600 bg-slate-50 px-3 py-1 rounded-lg w-fit">
                        <Calendar size={14}/> {order.delivery_date || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">{order.total_amount} ر.س</td>
                    <td className="px-6 py-4">
                      <Link to={`/app/orders/${order.id}`} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-colors">
                        معالجة
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center text-slate-400">لا توجد طلبات جديدة حالياً 🎉</div>
          )}
        </div>
      </div>

    </div>
  );
}