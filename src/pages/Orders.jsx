// src/pages/Orders.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Plus, Search, Filter, ChevronRight, Loader2, FileText, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // حالة الفرز (الافتراضي: التاريخ تنازلي - الأحدث أولاً)
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  // جلب البيانات عند تحميل الصفحة
  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    try {
      setLoading(true);
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
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const term = searchTerm.toLowerCase();
      return (
        order.customer_name?.toLowerCase().includes(term) ||
        order.phone?.includes(term) ||
        order.id?.slice(0, 8).includes(term)
      );
    });
  }, [orders, searchTerm]);

  // منطق الفرز
  const sortedOrders = useMemo(() => {
    let sortableItems = [...filteredOrders];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;

        // معالجة خاصة لعمود "المتبقي" لأنه حسابي
        if (sortConfig.key === 'remaining') {
          aValue = (a.total_amount || 0) - (a.deposit || 0);
          bValue = (b.total_amount || 0) - (b.deposit || 0);
        } else {
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
        }

        // معالجة النصوص والأرقام
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredOrders, sortConfig]);

  // دالة لتغيير ترتيب الفرز عند الضغط على الرأس
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // مكون مساعد لرأس الجدول القابل للفرز
  const SortableHeader = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th 
        className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none group text-xs font-bold text-slate-500 uppercase tracking-wider"
        onClick={() => requestSort(sortKey)}
      >
        <div className="flex items-center gap-1">
          {label}
          <span className="text-slate-400 group-hover:text-fuchsia-600 transition-colors">
            {isActive ? (
              sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>
            ) : (
              <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50"/>
            )}
          </span>
        </div>
      </th>
    );
  };

  // دالة مساعدة لألوان الحالة (بتصميم "الحبة" الحديث)
  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'printing': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'done': return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100';
      case 'delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
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
        
        {/* القسم الأيسر: زر الإضافة + عداد الطلبات */}
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2">
            <FileText size={16} className="text-slate-400"/>
            <span>{filteredOrders.length} طلب</span>
          </div>

          <Link
            to="/app/orders/new"
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-fuchsia-500/20 transition-all"
          >
            <Plus size={18} />
            طلب جديد
          </Link>
        </div>
      </div>

      {/* شريط البحث */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="بحث باسم العميل، الجوال، أو رقم الطلب..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-sm placeholder:text-slate-400"
          />
        </div>
        <button className="p-2 text-slate-600 hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors">
          <Filter size={18} />
        </button>
      </div>

      {/* المحتوى */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-fuchsia-500" size={32} />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
          <p className="text-slate-500 mb-2">لا توجد طلبات حتى الآن</p>
          <Link to="/app/orders/new" className="text-fuchsia-600 font-medium hover:underline">
            أضف أول طلب
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <SortableHeader label="رقم الطلب" sortKey="id" />
                  <SortableHeader label="العميل" sortKey="customer_name" />
                  <SortableHeader label="التاريخ" sortKey="created_at" />
                  <SortableHeader label="الحالة" sortKey="status" />
                  <SortableHeader label="المبلغ" sortKey="total_amount" />
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedOrders.map((order) => {
                  const remaining = (order.total_amount || 0) - (order.deposit || 0);
                  const isPaid = remaining <= 0.5; 

                  return (
                    <tr key={order.id} className="hover:bg-fuchsia-50/30 transition-colors duration-200 group">
                      
                      {/* رقم الطلب */}
                      <td className="px-6 py-5">
                        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          #{order.id.slice(0, 6)}
                        </span>
                      </td>

                      {/* العميل (مع أفاتار) */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-100 to-purple-100 flex items-center justify-center text-fuchsia-700 font-bold shadow-sm border border-white shrink-0">
                            {order.customer_name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900">{order.customer_name}</span>
                            <span className="text-[11px] text-slate-400 dir-ltr text-right font-mono">{order.phone}</span>
                          </div>
                        </div>
                      </td>

                      {/* التاريخ */}
                      <td className="px-6 py-5 text-sm text-slate-500 font-medium">
                        {order.created_at && format(new Date(order.created_at), 'dd MMM yyyy', { locale: arSA })}
                      </td>

                      {/* الحالة (Pill Design) */}
                      <td className="px-6 py-5">
                        <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)} shadow-sm`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 ml-1.5"></span>
                          {getStatusText(order.status)}
                        </div>
                      </td>

                      {/* المبلغ والمالية */}
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-800">
                            {order.total_amount} <span className="text-[10px] font-normal text-slate-400">ر.س</span>
                          </span>
                          {!isPaid ? (
                            <span className="text-[10px] text-red-500 font-bold mt-0.5">
                              متبقي: {remaining.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-500 font-bold mt-0.5 flex items-center gap-1">
                              مدفوع بالكامل
                            </span>
                          )}
                        </div>
                      </td>

                      {/* الإجراء */}
                      <td className="px-6 py-5">
                        <Link 
                          to={`/app/orders/${order.id}`}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-fuchsia-600 hover:border-fuchsia-200 hover:bg-fuchsia-50 transition-all shadow-sm group-hover:translate-x-[-4px]"
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