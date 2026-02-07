// src/pages/Orders.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Plus, Search, Filter, ChevronRight, Loader2, FileText, 
  ArrowUpDown, ArrowUp, ArrowDown 
} from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

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

  const sortedOrders = useMemo(() => {
    let sortableItems = [...filteredOrders];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;
        if (sortConfig.key === 'remaining') {
          aValue = (a.total_amount || 0) - (a.deposit || 0);
          bValue = (b.total_amount || 0) - (b.deposit || 0);
        } else {
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
        }
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredOrders, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const SortableHeader = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th className="px-6 py-4 cursor-pointer hover:bg-[#F8F5F2] transition-colors select-none group text-xs font-bold text-[#4A4A4A]/70 uppercase tracking-wider" onClick={() => requestSort(sortKey)}>
        <div className="flex items-center gap-1">
          {label}
          <span className="text-[#4A4A4A]/55 group-hover:text-[#D9A3AA] transition-colors">
            {isActive ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : (<ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50"/>)}
          </span>
        </div>
      </th>
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'new':
        // أحمر ناعم (متناسق مع الهوية)
        return 'bg-[#FDECEC] text-[#C0392B] border border-[#F5B7B1]';
      case 'printing':
        // أزرق ناعم
        return 'bg-[#EAF2FF] text-[#1F5FBF] border border-[#BBD4FF]';
      case 'done':
        // وردي الهوية
        return 'bg-[#F7E9EB] text-[#B46C78] border border-[#E9C7CC]';
      case 'delivered':
        // أخضر ناعم
        return 'bg-[#E9F7EF] text-[#1E7F4D] border border-[#BFE8D0]';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  const getStatusText = (status) => {
    const map = { 'new': 'جديد', 'printing': 'قيد الطباعة', 'done': 'جاهز', 'delivered': 'تم التسليم' };
    return map[status] || status;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-[#4A4A4A]">الطلبات</h1><p className="text-sm text-[#4A4A4A]/70">إدارة ومتابعة طلبات الطباعة</p></div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 text-[#4A4A4A]/80 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2"><FileText size={16} className="text-[#4A4A4A]/55"/><span>{filteredOrders.length} طلب</span></div>
          <Link to="/app/orders/new" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#D9A3AA] to-[#C5A059] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-[#D9A3AA]/25 transition-all"><Plus size={18} />طلب جديد</Link>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A4A4A]/55" size={18} />
          <input type="text" placeholder="بحث باسم العميل، الجوال، أو رقم الطلب..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-4 pr-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#D9A3AA] text-sm placeholder:text-[#4A4A4A]/55"/>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setSortConfig({ key: 'remaining', direction: 'desc' })} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-xs font-bold ${sortConfig.key === 'remaining' ? 'bg-red-50 text-red-600 border-red-200 ring-2 ring-red-100' : 'text-[#4A4A4A]/80 hover:bg-[#F8F5F2] border-slate-200'}`}><Filter size={16} /><span>المديونيات</span></button>
        </div>
      </div>

      {loading ? (<div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#D9A3AA]" size={32} /></div>) : filteredOrders.length === 0 ? (<div className="text-center py-20 bg-[#F8F5F2] rounded-3xl border border-dashed border-slate-300"><p className="text-[#4A4A4A]/70 mb-2">لا توجد طلبات حتى الآن</p><Link to="/app/orders/new" className="text-[#D9A3AA] font-medium hover:underline">أضف أول طلب</Link></div>) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-[#F8F5F2]/80 border-b border-slate-100">
                <tr>
                  <SortableHeader label="رقم الطلب" sortKey="id" />
                  <SortableHeader label="العميل" sortKey="customer_name" />
                  <SortableHeader label="التاريخ" sortKey="created_at" />
                  <SortableHeader label="الحالة" sortKey="status" />
                  <SortableHeader label="المبلغ" sortKey="total_amount" />
                  <th className="px-6 py-4 text-xs font-bold text-[#4A4A4A]/70 uppercase tracking-wider">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedOrders.map((order) => {
                  const remaining = (order.total_amount || 0) - (order.deposit || 0);
                  const isPaid = remaining <= 0.5; 
                  return (
                    <tr key={order.id} className="hover:bg-[#D9A3AA]/10/30 transition-colors duration-200 group">
                      <td className="px-6 py-5"><span className="font-mono text-xs font-bold text-[#4A4A4A]/70 bg-[#F8F5F2] px-2 py-1 rounded-md border border-slate-200">#{order.id.slice(0, 6)}</span></td>
                      <td className="px-6 py-5"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D9A3AA]/15 to-[#C5A059]/15 flex items-center justify-center text-[#C5A059] font-bold shadow-sm border border-white shrink-0">{order.customer_name.charAt(0)}</div><div className="flex flex-col"><span className="text-sm font-bold text-[#4A4A4A]">{order.customer_name}</span><span className="text-[11px] text-[#4A4A4A]/55 dir-ltr text-right font-mono">{order.phone}</span></div></div></td>
                      <td className="px-6 py-5 text-sm text-[#4A4A4A]/70 font-medium">{order.created_at && format(new Date(order.created_at), 'dd MMM yyyy', { locale: arSA })}</td>
                      <td className="px-6 py-5"><div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)} shadow-sm`}><span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 ml-1.5"></span>{getStatusText(order.status)}</div></td>
                      <td className="px-6 py-5"><div className="flex flex-col"><span className="text-sm font-black text-[#4A4A4A]">{order.total_amount} <span className="text-[10px] font-normal text-[#4A4A4A]/55">ر.س</span></span>{!isPaid ? (<span className="text-[10px] text-red-500 font-bold mt-0.5">متبقي: {remaining.toFixed(2)}</span>) : (<span className="text-[10px] text-[#50C878] font-bold mt-0.5 flex items-center gap-1">مدفوع بالكامل</span>)}</div></td>
                      <td className="px-6 py-5"><Link to={`/app/orders/${order.id}`} className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white border border-slate-200 text-[#4A4A4A]/55 hover:text-[#D9A3AA] hover:border-[#D9A3AA]/25 hover:bg-[#D9A3AA]/10 transition-all shadow-sm group-hover:translate-x-[-4px]"><ChevronRight size={18} className="rotate-180" /></Link></td>
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