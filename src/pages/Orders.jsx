// src/pages/Orders.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Plus, Search, Filter, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // جلب البيانات عند تحميل الصفحة
  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    try {
      setLoading(true);
      // جلب كل الطلبات مرتبة بالأحدث
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }

  // تصفية البحث
  const filteredOrders = orders.filter((order) => {
    const term = searchTerm.toLowerCase();
    return (
      order.customer_name?.toLowerCase().includes(term) ||
      order.phone?.includes(term) ||
      order.id?.slice(0, 8).includes(term)
    );
  });

  // دالة مساعدة لألوان الحالة
  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'printing': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'done': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'delivered': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status) => {
    const map = {
      'new': 'جديد',
      'printing': 'قيد الطباعة',
      'done': 'جاهز',
      'delivered': 'تم التسليم'
    };
    return map[status] || status;
  };

  return (
    <div className="space-y-6">
      {/* الرأس */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">الطلبات</h1>
          <p className="text-sm text-slate-500">إدارة ومتابعة طلبات الطباعة</p>
        </div>
        <Link
          to="/app/orders/new"
          className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <Plus size={18} />
          طلب جديد
        </Link>
      </div>

      {/* شريط البحث */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="بحث باسم العميل، الجوال..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
        </div>
        <button className="p-2 text-slate-600 hover:bg-slate-50 rounded-xl border border-slate-200">
          <Filter size={18} />
        </button>
      </div>

      {/* المحتوى */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-emerald-500" size={32} />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
          <p className="text-slate-500 mb-2">لا توجد طلبات حتى الآن</p>
          <Link to="/app/orders/new" className="text-emerald-600 font-medium hover:underline">
            أضف أول طلب
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-medium">
                <tr>
                  <th className="px-6 py-4">رقم الطلب</th>
                  <th className="px-6 py-4">العميل</th>
                  <th className="px-6 py-4">التاريخ</th>
                  <th className="px-6 py-4">الحالة</th>
                  <th className="px-6 py-4">المبلغ</th>
                  <th className="px-6 py-4">المتبقي</th> {/* 👈 العمود الجديد */}
                  <th className="px-6 py-4">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  // حساب المتبقي لكل سطر
                  const remaining = (order.total_amount || 0) - (order.deposit || 0);
                  const isPaid = remaining <= 0.5; // هامش بسيط للكسور العشرية

                  return (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        #{order.id.slice(0, 6)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{order.customer_name}</div>
                        <div className="text-xs text-slate-500">{order.phone}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {order.created_at && format(new Date(order.created_at), 'dd MMM yyyy', { locale: arSA })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                          {getStatusText(order.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{order.total_amount} ر.س</div>
                      </td>
                      {/* عمود المتبقي الجديد */}
                      <td className="px-6 py-4">
                        {isPaid ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            تم الدفع
                          </span>
                        ) : (
                          <span className="font-bold text-red-500 text-sm">
                            {remaining.toFixed(2)} ر.س
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Link 
                          to={`/app/orders/${order.id}`}
                          className="p-2 rounded-full hover:bg-slate-200 inline-block text-slate-400 hover:text-slate-700"
                        >
                          <ChevronRight size={18} className="rotate-180" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}