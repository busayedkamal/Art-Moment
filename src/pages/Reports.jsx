// src/pages/Reports.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BarChart3, Calendar, Download, TrendingDown, TrendingUp, 
  PieChart as PieIcon, Activity, CheckCircle2 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { format, isValid } from 'date-fns'; // استيراد isValid للتحقق من صحة التاريخ
import { arSA } from 'date-fns/locale';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]); 
  const [orders, setOrders] = useState([]); 
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // 1. الدفعات (الدخل الحقيقي) - تأكد من وجود جدول order_payments
        const { data: paymentsData, error: payError } = await supabase.from('order_payments').select('*');
        if (payError) console.error("خطأ في جلب المدفوعات:", payError);

        // 2. الطلبات
        const { data: ordersData } = await supabase.from('orders').select('*');
        
        // 3. المصروفات
        const { data: expensesData } = await supabase.from('expenses').select('*');

        setPayments(paymentsData || []);
        setOrders(ordersData || []);
        setExpenses(expensesData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // --- معالجة البيانات المركزية ---
  const analytics = useMemo(() => {
    const monthlyMap = {};
    const expenseCategoryMap = {};
    const sourceMap = {};
    
    let totalRevenue = 0;
    let totalExpenses = 0;

    // دالة مساعدة لإنشاء مفتاح الشهر بأمان
    const getMonthKey = (dateString) => {
      const date = new Date(dateString);
      if (!isValid(date)) return null; // حماية ضد التواريخ الفاسدة
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return { key, date };
    };

    // أ) معالجة الدخل (من الدفعات)
    payments.forEach(p => {
      const dateInfo = getMonthKey(p.payment_date || p.created_at);
      if (!dateInfo) return;

      const { key, date } = dateInfo;
      const amount = Number(p.amount) || 0;

      if (!monthlyMap[key]) monthlyMap[key] = { name: key, date, revenue: 0, expenses: 0, orders: 0 };
      monthlyMap[key].revenue += amount;
      totalRevenue += amount;
    });

    // ب) معالجة المصروفات
    expenses.forEach(e => {
      const dateInfo = getMonthKey(e.date || e.created_at);
      if (!dateInfo) return;

      const { key, date } = dateInfo;
      const amount = Number(e.amount) || 0;

      if (!monthlyMap[key]) monthlyMap[key] = { name: key, date, revenue: 0, expenses: 0, orders: 0 };
      monthlyMap[key].expenses += amount;
      totalExpenses += amount;

      // تصنيف المصروفات
      const cat = e.title || 'غير مصنف';
      expenseCategoryMap[cat] = (expenseCategoryMap[cat] || 0) + amount;
    });

    // ج) معالجة الطلبات
    orders.forEach(o => {
      const dateInfo = getMonthKey(o.created_at);
      if (!dateInfo) return;
      
      const { key } = dateInfo;
      if (monthlyMap[key]) monthlyMap[key].orders += 1;

      // تحليل المصدر
      const sources = o.source || ['غير محدد'];
      // التأكد من أن المصدر مصفوفة
      const sourceArray = Array.isArray(sources) ? sources : [sources];
      sourceArray.forEach(src => {
        sourceMap[src] = (sourceMap[src] || 0) + 1;
      });
    });

    // تحويل البيانات لمصفوفات للرسوم البيانية
    const monthlyData = Object.values(monthlyMap).sort((a, b) => a.date - b.date);
    
    const expenseData = Object.entries(expenseCategoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const sourceData = Object.entries(sourceMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // حسابات KPI
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;
    const avgOrderValue = orders.length > 0 ? (totalRevenue / orders.length).toFixed(0) : 0;

    return {
      monthlyData,
      expenseData,
      sourceData,
      totals: { totalRevenue, totalExpenses, netProfit, profitMargin, avgOrderValue, totalOrders: orders.length }
    };
  }, [payments, expenses, orders]);

  // ألوان المخططات
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) return <div className="p-20 text-center flex flex-col items-center gap-4"><div className="w-8 h-8 border-4 border-slate-200 border-t-fuchsia-500 rounded-full animate-spin"></div><p>جاري تحليل البيانات...</p></div>;

  // حماية إضافية: إذا لم تكن هناك بيانات
  if (analytics.monthlyData.length === 0 && payments.length === 0 && expenses.length === 0) {
    return (
      <div className="p-20 text-center bg-white rounded-3xl border border-dashed border-slate-300 mt-10">
        <BarChart3 className="mx-auto text-slate-300 mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-700">لا توجد بيانات مالية كافية</h2>
        <p className="text-slate-500 mt-2">ابدأ بإضافة طلبات ومصروفات لتظهر التقارير هنا.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto">
      
      {/* الرأس */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">التقرير المالي الشامل</h1>
          <p className="text-slate-500 mt-1">نظرة عميقة على أداء مشروعك المالي والتشغيلي.</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20">
          <Download size={18} /> طباعة التقرير
        </button>
      </div>

      {/* 1. مؤشرات الأداء الرئيسية (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-slate-500 font-medium mb-1">إجمالي الدخل </p>
              <h3 className="text-2xl font-black text-slate-600">{analytics.totals.totalRevenue.toLocaleString()} <span className="text-sm font-normal">ر.س</span></h3>
            </div>
            <div className="p-3 bg-fuchsia-50 text-fuchsia-600 rounded-xl"><TrendingUp size={20}/></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-slate-500 font-medium mb-1">إجمالي المصروفات</p>
              <h3 className="text-2xl font-black text-red-500">{analytics.totals.totalExpenses.toLocaleString()} <span className="text-sm font-normal">ر.س</span></h3>
            </div>
            <div className="p-3 bg-red-50 text-red-600 rounded-xl"><TrendingDown size={20}/></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-slate-500 font-medium mb-1">صافي الربح</p>
              <h3 className={`text-2xl font-black ${analytics.totals.netProfit >= 0 ? 'text-emerald-900' : 'text-red-600'}`}>
                {analytics.totals.netProfit.toLocaleString()} <span className="text-sm font-normal">ر.س</span>
              </h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Activity size={20}/></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-slate-500 font-medium mb-1">هامش الربح</p>
              <h3 className="text-2xl font-black text-purple-600">{analytics.totals.profitMargin}%</h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><PieIcon size={20}/></div>
          </div>
        </div>
      </div>

      {/* 2. الرسوم البيانية (التمثيل البصري) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* الرسم البياني الرئيسي: الدخل vs المصروفات */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6">📈 اتجاهات الدخل والمصروفات</h3>
          <div className="h-72 w-full dir-ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.monthlyData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
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

        {/* رسم دائري: تحليل المصروفات */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-2">💸 أين تذهب أموالك؟</h3>
          <p className="text-xs text-slate-400 mb-4">أعلى بنود الصرف</p>
          <div className="h-64 w-full dir-ltr">
            {analytics.expenseData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.expenseData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {analytics.expenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-300">لا توجد مصروفات</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* مؤشرات الطلبات */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">🛒 مصادر الدخل والطلبات</h3>
          <div className="flex gap-4 mb-6">
            <div className="flex-1 bg-slate-50 p-4 rounded-xl text-center">
              <span className="text-xs text-slate-500 block">إجمالي الطلبات</span>
              <span className="text-xl font-bold text-slate-800">{analytics.totals.totalOrders}</span>
            </div>
            <div className="flex-1 bg-slate-50 p-4 rounded-xl text-center">
              <span className="text-xs text-slate-500 block">متوسط قيمة الطلب</span>
              <span className="text-xl font-bold text-blue-600">{analytics.totals.avgOrderValue} ر.س</span>
            </div>
          </div>
          <div className="h-48 w-full dir-ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.sourceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false}/>
                <XAxis type="number" hide/>
                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} axisLine={false} tickLine={false}/>
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} name="عدد الطلبات"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. الخلاصة والتوصيات (الذكية) */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-lg">
          <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
            <CheckCircle2 className="text-fuchsia-400"/> الخلاصة والوضع المالي
          </h3>
          
          <div className="space-y-4 text-sm leading-relaxed text-slate-300">
            <p>
              بناءً على البيانات الحالية، الوضع المالي للمشروع 
              {analytics.totals.netProfit > 0 ? <span className="text-fuchsia-400 font-bold"> مستقر ورابح ✅</span> : <span className="text-red-400 font-bold"> يحتاج لانتباه ⚠️</span>}.
            </p>

            <ul className="space-y-3 mt-4">
              <li className="flex gap-2">
                <span className="bg-white/10 p-1 rounded h-fit mt-0.5"><Activity size={14}/></span>
                <div>
                  <strong className="text-white block">هامش الربح ({analytics.totals.profitMargin}%)</strong>
                  {analytics.totals.profitMargin > 20 
                    ? "نسبة ممتازة! حاولي الحفاظ على هذا المستوى." 
                    : "النسبة منخفضة قليلاً، حاولي تقليل المصروفات التشغيلية أو زيادة سعر المنتجات قليلاً."}
                </div>
              </li>

              <li className="flex gap-2">
                <span className="bg-white/10 p-1 rounded h-fit mt-0.5"><TrendingDown size={14}/></span>
                <div>
                  <strong className="text-white block">المصروفات</strong>
                  أكبر بند للمصروفات هو 
                  <span className="text-red-300 mx-1">"{analytics.expenseData[0]?.name || 'غير محدد'}"</span>.
                  هل يمكن إيجاد بديل أو مورد أرخص؟
                </div>
              </li>

              <li className="flex gap-2">
                <span className="bg-white/10 p-1 rounded h-fit mt-0.5"><TrendingUp size={14}/></span>
                <div>
                  <strong className="text-white block">تنمية الدخل</strong>
                  متوسط الطلب الحالي هو {analytics.totals.avgOrderValue} ريال. قدمي عروض "ألبومات مجمعة" لرفع هذا الرقم.
                </div>
              </li>
            </ul>
          </div>
        </div>

      </div>

      {/* الجدول التفصيلي الشهري (مع حماية التواريخ) */}
      <div className="mt-10">
        <h3 className="font-bold text-slate-800 mb-4">🗓️ التفصيل الشهري</h3>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4">الشهر</th>
                <th className="px-6 py-4">الدخل</th>
                <th className="px-6 py-4">المصروفات</th>
                <th className="px-6 py-4">الصافي</th>
                <th className="px-6 py-4">الطلبات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics.monthlyData.slice().reverse().map((row) => (
                <tr key={row.name} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-bold">
                    {/* حماية إضافية عند عرض التاريخ */}
                    {isValid(row.date) ? format(row.date, 'MMMM yyyy', { locale: arSA }) : row.name}
                  </td>
                  <td className="px-6 py-4 text-black-600">{row.revenue.toLocaleString()}</td>
                  <td className="px-6 py-4 text-red-500">{row.expenses.toLocaleString()}</td>
                  <td className="px-6 py-4 text-emerald-500">{(row.revenue - row.expenses).toLocaleString()}</td>
                  <td className="px-6 py-4">{row.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}