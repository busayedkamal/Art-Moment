// src/pages/Reports.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, Calendar, Download, TrendingDown, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

export default function Reports() {
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]); // حالة المصروفات
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. جلب الطلبات
        const { data: ordersData, error: ordError } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: true });
        if (ordError) throw ordError;

        // 2. جلب المصروفات (مهم جداً)
        const { data: expensesData, error: expError } = await supabase
          .from('expenses')
          .select('*');
        if (expError) throw expError;

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

  // دمج البيانات (طلبات + مصروفات) حسب الشهر
  const monthlyStats = useMemo(() => {
    const stats = {};

    // 1. معالجة الطلبات (إيرادات)
    orders.forEach((order) => {
      const date = new Date(order.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!stats[key]) {
        stats[key] = { monthKey: key, dateObj: date, count: 0, revenue: 0, expenses: 0 };
      }
      stats[key].count += 1;
      stats[key].revenue += Number(order.total_amount || 0);
    });

    // 2. معالجة المصروفات (خصم)
    expenses.forEach((expense) => {
      // نستخدم تاريخ المصروف (date) أو تاريخ الإنشاء إذا لم يوجد
      const date = new Date(expense.date || expense.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!stats[key]) {
        // في حال وجود مصروفات لشهر ليس فيه طلبات
        stats[key] = { monthKey: key, dateObj: date, count: 0, revenue: 0, expenses: 0 };
      }
      stats[key].expenses += Number(expense.amount || 0);
    });

    // الترتيب من الأحدث للأقدم
    return Object.values(stats).sort((a, b) => b.dateObj - a.dateObj);
  }, [orders, expenses]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">التقارير الشهرية</h1>
          <p className="text-sm text-slate-500">تحليل صافي الأرباح (الإيرادات - المصروفات).</p>
        </div>
        
        <button 
          onClick={() => alert('قريباً!')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
        >
          <Download size={18} /> تصدير
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10">جاري الحساب...</div>
      ) : (
        <div className="grid gap-6">
          {monthlyStats.length > 0 ? (
            monthlyStats.map((stat) => {
              const netProfit = stat.revenue - stat.expenses;
              return (
                <div key={stat.monthKey} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                  
                  {/* رأس البطاقة */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                        <Calendar size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {format(stat.dateObj, 'MMMM yyyy', { locale: arSA })}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono">{stat.monthKey}</p>
                      </div>
                    </div>

                    {/* صافي الربح الكبير */}
                    <div className="text-center md:text-left">
                      <span className="text-xs text-slate-400 block mb-1">صافي الربح الشهري</span>
                      <span className={`text-2xl font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {netProfit.toLocaleString()} <span className="text-sm">ر.س</span>
                      </span>
                    </div>
                  </div>

                  {/* التفاصيل المالية */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    
                    {/* الإيرادات */}
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <div className="flex items-center justify-center gap-1 text-emerald-600 mb-1">
                        <TrendingUp size={16}/> <span className="text-xs font-bold">الإيرادات</span>
                      </div>
                      <span className="font-bold text-slate-900">{stat.revenue.toLocaleString()}</span>
                    </div>

                    {/* المصروفات */}
                    <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                      <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
                        <TrendingDown size={16}/> <span className="text-xs font-bold">المصروفات</span>
                      </div>
                      <span className="font-bold text-slate-900">{stat.expenses.toLocaleString()}</span>
                    </div>

                    {/* الطلبات */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
                        <span className="text-xs font-bold">الطلبات</span>
                      </div>
                      <span className="font-bold text-slate-900">{stat.count}</span>
                    </div>

                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
              <BarChart3 className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-slate-500">لا توجد بيانات مالية للعرض.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}