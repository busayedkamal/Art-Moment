// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ShoppingBag, Banknote, Clock, Loader2, TrendingDown, 
  AlertCircle, Wallet, TrendingUp 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    pendingOrders: 0,
    newOrders: 0,
    lateOrders: 0,
  });
  const [salesData, setSalesData] = useState([]);
  const [productsData, setProductsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const today = new Date().toISOString().slice(0, 10);

        // 1. جلب الطلبات
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('*');
        
        if (ordersError) throw ordersError;

        // 2. جلب المصروفات
        const { data: expenses, error: expensesError } = await supabase
          .from('expenses')
          .select('amount');
        
        if (expensesError) throw expensesError;

        // --- الحسابات الأساسية ---
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((acc, order) => acc + (order.total_amount || 0), 0);
        const totalExpenses = expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);
        
        // حالات الطلبات
        const pendingOrders = orders.filter(o => o.status === 'printing' || o.status === 'new').length;
        const newOrders = orders.filter(o => o.status === 'new').length;
        
        // الطلبات المتأخرة (تاريخ التسليم فات ولم يتم التسليم)
        const lateOrders = orders.filter(o => 
          o.delivery_date && 
          o.delivery_date < today && 
          o.status !== 'delivered'
        ).length;

        setStats({ 
          totalOrders, totalRevenue, totalExpenses, 
          pendingOrders, newOrders, lateOrders 
        });

        // --- تجهيز بيانات الرسم البياني (المبيعات آخر 7 أيام) ---
        const last7Days = [...Array(7)].map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return d.toISOString().slice(0, 10);
        }).reverse();

        const salesChart = last7Days.map(date => {
          const dayRevenue = orders
            .filter(o => o.created_at.startsWith(date))
            .reduce((acc, o) => acc + o.total_amount, 0);
          return { name: date.slice(5), sales: dayRevenue }; // name: '01-20'
        });
        setSalesData(salesChart);

        // --- تجهيز بيانات الدائرة (A4 vs 4x6) ---
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

  // ألوان الرسم البياني الدائري
  const COLORS = ['#10b981', '#3b82f6']; // Emerald & Blue

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline-block ml-2"/> جاري تحميل البيانات...</div>;

  const netProfit = stats.totalRevenue - stats.totalExpenses;

  return (
    <div className="space-y-8 pb-10">
      
      {/* بطاقة الترحيب */}
      <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">لوحة القيادة 🚀</h1>
            <p className="text-slate-300">
              لديك <strong className="text-emerald-400">{stats.newOrders}</strong> طلبات جديدة اليوم، و <strong className="text-red-400">{stats.lateOrders}</strong> طلبات متأخرة.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 text-center">
             <span className="text-xs text-slate-300 block mb-1">صافي الربح</span>
             <span className={`text-2xl font-bold dir-ltr ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
               {netProfit.toLocaleString()} <span className="text-sm">ر.س</span>
             </span>
          </div>
        </div>
        {/* زخرفة */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
      </div>

      {/* الصف الأول: الإحصائيات السريعة */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. الطلبات الجديدة */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-blue-300 transition-colors">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">طلبات جديدة</p>
            <p className="text-2xl font-black text-slate-900">{stats.newOrders}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <ShoppingBag size={20} />
          </div>
        </div>

        {/* 2. قيد التنفيذ */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-orange-300 transition-colors">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">قيد التنفيذ</p>
            <p className="text-2xl font-black text-slate-900">{stats.pendingOrders}</p>
          </div>
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl group-hover:bg-orange-600 group-hover:text-white transition-colors">
            <Clock size={20} />
          </div>
        </div>

        {/* 3. المتأخرة */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-red-300 transition-colors">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">متأخرة</p>
            <p className="text-2xl font-black text-red-600">{stats.lateOrders}</p>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl group-hover:bg-red-600 group-hover:text-white transition-colors">
            <AlertCircle size={20} />
          </div>
        </div>

        {/* 4. المصروفات */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-slate-400 transition-colors">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">المصروفات</p>
            <p className="text-2xl font-black text-slate-700">{stats.totalExpenses.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl group-hover:bg-slate-700 group-hover:text-white transition-colors">
            <TrendingDown size={20} />
          </div>
        </div>
      </div>

      {/* الصف الثاني: الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 1. رسم المبيعات (يأخذ مساحة أكبر) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-500"/> حركة المبيعات (7 أيام)
            </h3>
          </div>
          <div className="h-64 w-full dir-ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <RechartsTooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. رسم المنتجات (دائرة) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
          <h3 className="font-bold text-slate-800 w-full mb-4 text-center">المنتجات الأكثر طلباً</h3>
          <div className="h-48 w-full dir-ltr relative">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {productsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
            {/* إجمالي الصور في الوسط */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <span className="block text-2xl font-bold text-slate-800">
                  {productsData.reduce((a, b) => a + b.value, 0)}
                </span>
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
    </div>
  );
}