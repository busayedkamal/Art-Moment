// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingBag, Banknote, Clock, Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // 1. جلب كل الطلبات لحساب الإحصائيات
        const { data, error } = await supabase
          .from('orders')
          .select('id, total_amount, status');

        if (error) throw error;

        // حساب الأرقام في المتصفح (Client-side calculation)
        const totalOrders = data.length;
        
        // جمع كل المبالغ
        const totalRevenue = data.reduce((acc, order) => acc + (order.total_amount || 0), 0);
        
        // حساب الطلبات غير المكتملة (جديد أو قيد الطباعة)
        const pendingOrders = data.filter(o => o.status === 'new' || o.status === 'printing').length;

        setStats({ totalOrders, totalRevenue, pendingOrders });
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* بطاقة الترحيب */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">أهلاً بك،بو سيد كمال 👋</h1>
          <p className="text-slate-300">
            لديك <strong className="text-emerald-400">{stats.pendingOrders}</strong> طلبات تحتاج إلى متابعة اليوم.
          </p>
        </div>
        {/* زخرفة خلفية */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* بطاقة إجمالي الطلبات */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ShoppingBag size={28} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">إجمالي الطلبات</p>
            {loading ? (
              <Loader2 className="animate-spin h-6 w-6 text-slate-300 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-slate-900">{stats.totalOrders}</p>
            )}
          </div>
        </div>

        {/* بطاقة الأرباح */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Banknote size={28} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">إجمالي المبالغ</p>
            {loading ? (
              <Loader2 className="animate-spin h-6 w-6 text-slate-300 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-slate-900">{stats.totalRevenue.toLocaleString()} ر.س</p>
            )}
          </div>
        </div>

        {/* بطاقة قيد التنفيذ */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
            <Clock size={28} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">قيد التنفيذ</p>
            {loading ? (
              <Loader2 className="animate-spin h-6 w-6 text-slate-300 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-slate-900">{stats.pendingOrders}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}