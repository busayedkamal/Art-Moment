// src/pages/Reports.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, TrendingUp, Calendar, Download } from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

export default function Reports() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // جلب الطلبات المكتملة فقط (التي تهمنا في التقارير المالية)
  useEffect(() => {
    async function fetchData() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          // .eq('status', 'delivered') // يمكنك تفعيل هذا السطر إذا أردت حساب الطلبات المسلمة فقط
          .order('created_at', { ascending: true });

        if (error) throw error;
        setOrders(data || []);
      } catch (error) {
        console.error('Error fetching reports:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // تجميع البيانات حسب الشهر
  const monthlyStats = useMemo(() => {
    const stats = {};

    orders.forEach((order) => {
      // مفتاح التجميع: السنة-الشهر (مثلاً: 2025-01)
      const date = new Date(order.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!stats[key]) {
        stats[key] = {
          monthKey: key,
          dateObj: date,
          count: 0,
          totalRevenue: 0,
          totalDelivery: 0,
        };
      }

      stats[key].count += 1;
      stats[key].totalRevenue += Number(order.total_amount || 0);
      stats[key].totalDelivery += Number(order.delivery_fee || 0);
    });

    // تحويلها لمصفوفة وترتيبها من الأحدث للأقدم
    return Object.values(stats).sort((a, b) => b.dateObj - a.dateObj);
  }, [orders]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">التقارير الشهرية</h1>
          <p className="text-sm text-slate-500">ملخص الأداء المالي لكل شهر.</p>
        </div>
        
        {/* زر تصدير (شكلي حالياً) */}
        <button 
          onClick={() => alert('ميزة التصدير إلى Excel قادمة قريباً!')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
        >
          <Download size={18} />
          تصدير التقرير
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10">جاري حساب التقارير...</div>
      ) : (
        <div className="grid gap-6">
          {/* عرض البطاقات لكل شهر */}
          {monthlyStats.length > 0 ? (
            monthlyStats.map((stat) => (
              <div key={stat.monthKey} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  
                  {/* عنوان الشهر */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                      <Calendar size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {format(stat.dateObj, 'MMMM yyyy', { locale: arSA })}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono">{stat.monthKey}</p>
                    </div>
                  </div>

                  {/* ملخص سريع */}
                  <div className="flex gap-4">
                    <div className="px-4 py-2 bg-slate-50 rounded-xl text-center">
                      <span className="block text-xs text-slate-500 mb-1">عدد الطلبات</span>
                      <span className="font-bold text-slate-900">{stat.count}</span>
                    </div>
                    <div className="px-4 py-2 bg-emerald-50 rounded-xl text-center">
                      <span className="block text-xs text-emerald-600 mb-1">صافي الدخل</span>
                      <span className="font-bold text-emerald-700">
                        {(stat.totalRevenue - stat.totalDelivery).toLocaleString()} ر.س
                      </span>
                    </div>
                  </div>
                </div>

                {/* شريط بياني بسيط */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>الإيرادات</span>
                    <span className="font-bold">{stat.totalRevenue.toLocaleString()} ر.س</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: '100%' }} // هنا يمكن جعلها نسبية مقارنة بأعلى شهر
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>تشمل رسوم التوصيل: {stat.totalDelivery} ر.س</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
              <BarChart3 className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-slate-500">لا توجد بيانات كافية لإنشاء تقارير بعد.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}