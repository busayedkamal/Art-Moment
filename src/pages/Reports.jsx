// src/pages/Reports.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BarChart3, Calendar, Download, TrendingDown, TrendingUp, 
  PieChart as PieIcon, Activity, CheckCircle2, MapPin, Crown, Users, Copy 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { format, isValid, subMonths, isBefore } from 'date-fns';
import { arSA } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]); 
  const [orders, setOrders] = useState([]); 
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState({ a4_price: 0, photo_4x6_price: 0 });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const { data: paymentsData } = await supabase.from('order_payments').select('*');
        const { data: ordersData } = await supabase.from('orders').select('*');
        const { data: expensesData } = await supabase.from('expenses').select('*');
        const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 1).single();

        setPayments(paymentsData || []);
        setOrders(ordersData || []);
        setExpenses(expensesData || []);
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
      if (!monthlyMap[key]) monthlyMap[key] = { name: key, date, revenue: 0, expenses: 0, orders: 0 };
      monthlyMap[key].revenue += amount;
      totalRevenue += amount;
    });

    expenses.forEach(e => {
      const dateInfo = getMonthKey(e.date || e.created_at);
      if (!dateInfo) return;
      const { key, date } = dateInfo;
      const amount = Number(e.amount) || 0;
      if (!monthlyMap[key]) monthlyMap[key] = { name: key, date, revenue: 0, expenses: 0, orders: 0 };
      monthlyMap[key].expenses += amount;
      totalExpenses += amount;
      const cat = e.title || 'غير مصنف';
      expenseCategoryMap[cat] = (expenseCategoryMap[cat] || 0) + amount;
    });

    orders.forEach(o => {
      const dateInfo = getMonthKey(o.created_at);
      if (dateInfo && monthlyMap[dateInfo.key]) monthlyMap[dateInfo.key].orders += 1;

      // 1. تحليل المناطق (محدث: يقرأ من حقل source مباشرة)
      const city = o.source ? o.source.trim() : 'أخرى';
      if (citiesMap.hasOwnProperty(city)) {
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

    const monthlyData = Object.values(monthlyMap).sort((a, b) => a.date - b.date);
    const expenseData = Object.entries(expenseCategoryMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
    
    const profitabilityData = Object.values(productsStats).sort((a, b) => b.profit - a.profit);
    const geoData = Object.entries(citiesMap).filter(([_, val]) => val > 0).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const threeMonthsAgo = subMonths(new Date(), 3);
    const churnedList = Object.values(customerLastOrder).filter(c => isBefore(c.date, threeMonthsAgo)).slice(0, 5);

    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;
    const avgOrderValue = orders.length > 0 ? (totalRevenue / orders.length).toFixed(0) : 0;

    return {
      monthlyData, expenseData, profitabilityData, geoData, churnedList,
      totals: { totalRevenue, totalExpenses, netProfit, profitMargin, avgOrderValue, totalOrders: orders.length }
    };
  }, [payments, expenses, orders, settings]);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) return <div className="p-20 text-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-fuchsia-500 rounded-full animate-spin mx-auto"></div><p className="mt-4">جاري تحليل البيانات...</p></div>;

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto">
      
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">التقرير المالي الذكي</h1>
          <p className="text-slate-500 mt-1">نظرة شاملة على الأداء المالي مع تحليلات ذكية.</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20">
          <Download size={18} /> طباعة التقرير
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div><p className="text-sm text-slate-500 font-medium mb-1">إجمالي الدخل</p><h3 className="text-2xl font-black text-slate-600">{analytics.totals.totalRevenue.toLocaleString()} <span className="text-sm font-normal">ر.س</span></h3></div>
            <div className="p-3 bg-fuchsia-50 text-fuchsia-600 rounded-xl"><TrendingUp size={20}/></div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div><p className="text-sm text-slate-500 font-medium mb-1">إجمالي المصروفات</p><h3 className="text-2xl font-black text-red-500">{analytics.totals.totalExpenses.toLocaleString()} <span className="text-sm font-normal">ر.س</span></h3></div>
            <div className="p-3 bg-red-50 text-red-600 rounded-xl"><TrendingDown size={20}/></div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div><p className="text-sm text-slate-500 font-medium mb-1">صافي الربح</p><h3 className={`text-2xl font-black ${analytics.totals.netProfit >= 0 ? 'text-emerald-900' : 'text-red-600'}`}>{analytics.totals.netProfit.toLocaleString()} <span className="text-sm font-normal">ر.س</span></h3></div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Activity size={20}/></div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div><p className="text-sm text-slate-500 font-medium mb-1">هامش الربح</p><h3 className="text-2xl font-black text-purple-600">{analytics.totals.profitMargin}%</h3></div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><PieIcon size={20}/></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6">📈 اتجاهات الدخل والمصروفات</h3>
          <div className="h-72 w-full dir-ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.monthlyData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize: 12}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}/>
                <Area type="monotone" dataKey="revenue" name="الدخل" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" name="المصروفات" stroke="#ef4444" fillOpacity={1} fill="url(#colorExp)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-2">💸 توزيع المصروفات</h3>
          <div style={{ width: '100%', height: 300, direction: 'ltr' }}>
            {analytics.expenseData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analytics.expenseData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {analytics.expenseData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-full text-slate-300">لا توجد بيانات</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Crown size={18} className="text-amber-500"/> المنتجات الأكثر ربحية</h3>
            <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-1 rounded-lg">صافي الربح</span>
          </div>
          <div className="space-y-4">
            {analytics.profitabilityData.map((item, idx) => (
              <div key={item.name}>
                <div className="flex justify-between text-sm font-bold mb-1">
                  <span className="text-slate-700">{item.name}</span>
                  <span className="text-emerald-600">+{item.profit.toFixed(0)} ر.س</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full transition-all duration-1000" style={{ width: `${(item.profit / analytics.profitabilityData[0].profit) * 100}%` }}></div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>المبيعات: {item.sales}</span>
                  <span>الدخل: {item.revenue}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><MapPin size={18} className="text-red-500"/> المناطق الجغرافية</h3>
            <span className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded-lg">من المصدر</span>
          </div>
          <div className="h-48 w-full dir-ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.geoData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false}/>
                <XAxis type="number" hide/>
                <YAxis dataKey="name" type="category" width={60} tick={{fontSize: 11}} axisLine={false} tickLine={false}/>
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={15} name="الطلبات" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex-1">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><Users className="text-indigo-400"/> استعادة العملاء (Churn)</h3>
          <p className="text-sm text-slate-300 mb-4">هؤلاء العملاء لم يطلبوا منذ 3 أشهر. انسخ كود الخصم وأرسله لهم!</p>
          <div className="flex flex-wrap gap-2">
            {analytics.churnedList.length > 0 ? analytics.churnedList.map(c => (
              <div key={c.phone} className="bg-white/10 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                <span>{c.name}</span>
                <span className="text-slate-400">|</span>
                <span className="font-mono">{format(c.date, 'MM/yy')}</span>
              </div>
            )) : <span className="text-sm text-emerald-400 font-bold">رائع! جميع عملائك نشطون 👏</span>}
          </div>
        </div>
        <button 
          onClick={() => { navigator.clipboard.writeText("اشتقنا لك! استخدم كود WELCOMEBACK لخصم 15% على طلبك القادم."); toast.success("تم نسخ الرسالة"); }}
          className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors flex items-center gap-2 shadow-lg"
        >
          <Copy size={16}/> نسخ عرض العودة
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50"><h3 className="font-bold text-slate-700 text-sm">التفاصيل الشهرية</h3></div>
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr><th className="px-6 py-4">الشهر</th><th className="px-6 py-4">الدخل</th><th className="px-6 py-4">المصروفات</th><th className="px-6 py-4">الصافي</th><th className="px-6 py-4">الطلبات</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {analytics.monthlyData.slice().reverse().map((row) => (
              <tr key={row.name} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-bold">{isValid(row.date) ? format(row.date, 'MMMM yyyy', { locale: arSA }) : row.name}</td>
                <td className="px-6 py-4 text-emerald-600">{row.revenue.toLocaleString()}</td>
                <td className="px-6 py-4 text-red-500">{row.expenses.toLocaleString()}</td>
                <td className="px-6 py-4 font-bold">{(row.revenue - row.expenses).toLocaleString()}</td>
                <td className="px-6 py-4">{row.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}