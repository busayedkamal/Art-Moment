// src/pages/Orders.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Plus, Search, Filter, ChevronRight, Loader2, FileText,
  ArrowUpDown, ArrowUp, ArrowDown, Calendar, Banknote
} from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import toast from 'react-hot-toast';

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
          aValue = (a.total_amount || 0) - (a.deposit || 0) - Number(a.wallet_used || 0);
          bValue = (b.total_amount || 0) - (b.deposit || 0) - Number(b.wallet_used || 0);
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
        return 'bg-[#FDECEC] text-[#C0392B] border border-[#F5B7B1]';
      case 'printing':
        return 'bg-[#EAF2FF] text-[#1F5FBF] border border-[#BBD4FF]';
      case 'done':
        return 'bg-[#F7E9EB] text-[#B46C78] border border-[#E9C7CC]';
      case 'delivered':
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
    <div className="w-full space-y-6 pb-12 text-[#4A4A4A]">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-2xl font-black text-[#4A4A4A] tracking-tight">الطلبات</h1>
          <p className="text-sm text-[#4A4A4A]/50 mt-0.5">إدارة ومتابعة طلبات الطباعة</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-white border border-slate-200 text-[#4A4A4A]/80 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2">
            <FileText size={16} className="text-[#4A4A4A]/55"/>
            <span>{filteredOrders.length} طلب</span>
          </div>
          <Link to="/app/orders/new" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#D9A3AA] to-[#C5A059] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-[#D9A3AA]/25 transition-all">
            <Plus size={17} /> طلب جديد
          </Link>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A4A4A]/40" size={17} />
          <input
            type="text"
            placeholder="بحث باسم العميل، الجوال، أو رقم الطلب..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#D9A3AA]/40 text-sm placeholder:text-[#4A4A4A]/40 bg-[#F8F5F2]/50"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSortConfig({ key: 'remaining', direction: 'desc' })}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-xs font-bold ${sortConfig.key === 'remaining' ? 'bg-red-50 text-red-600 border-red-200 ring-2 ring-red-100' : 'text-[#4A4A4A]/70 hover:bg-[#F8F5F2] border-slate-200'}`}
          >
            <Filter size={15} /> المديونيات
          </button>
          {sortConfig.key === 'remaining' && (
            <button
              onClick={() => setSortConfig({ key: 'created_at', direction: 'desc' })}
              className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-[#4A4A4A]/60 hover:bg-[#F8F5F2] transition-all"
            >
              ✕ إلغاء
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="animate-spin text-[#D9A3AA] mb-3" size={36} />
          <p className="text-sm text-[#4A4A4A]/50">جاري تحميل الطلبات...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-[#4A4A4A]/60 font-medium mb-3">لا توجد طلبات مطابقة</p>
          <Link to="/app/orders/new" className="inline-flex items-center gap-2 bg-gradient-to-r from-[#D9A3AA] to-[#C5A059] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow hover:shadow-lg transition-all">
            <Plus size={16} /> إضافة طلب جديد
          </Link>
        </div>
      ) : (
        <>
          {/* ══ بطاقات الجوال (أقل من md) ══ */}
          <div className="md:hidden space-y-3">
            {sortedOrders.map((order) => {
              const remaining = (order.total_amount || 0) - (order.deposit || 0) - Number(order.wallet_used || 0);
              const isPaid = remaining <= 0.5;
              return (
                <Link
                  key={order.id}
                  to={`/app/orders/${order.id}`}
                  className="block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden active:scale-[0.99] transition-transform"
                >
                  <div className="p-4 flex items-center gap-3">
                    {/* أفاتار العميل */}
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#D9A3AA]/20 to-[#C5A059]/20 flex items-center justify-center text-[#C5A059] font-black text-base shrink-0 border border-white shadow-sm">
                      {order.customer_name.charAt(0)}
                    </div>

                    {/* بيانات الطلب */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-[#4A4A4A] text-sm truncate">{order.customer_name}</span>
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${getStatusColor(order.status)}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 ml-1"></span>
                          {getStatusText(order.status)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[11px] font-bold text-[#4A4A4A]/50 bg-[#F8F5F2] px-1.5 py-0.5 rounded border border-slate-200">
                            #{order.id.slice(0, 6)}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-[#4A4A4A]/40">
                            <Calendar size={10} />
                            {order.created_at && format(new Date(order.created_at), 'dd MMM yyyy', { locale: arSA })}
                          </span>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-sm font-black text-[#4A4A4A]">
                            {order.total_amount} <span className="text-[10px] font-normal text-[#4A4A4A]/40">ر.س</span>
                          </span>
                          {!isPaid ? (
                            <span className="text-[10px] text-red-500 font-bold">متبقي {remaining.toFixed(1)}</span>
                          ) : (
                            <span className="text-[10px] text-emerald-500 font-bold">✓ مدفوع</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <ChevronRight size={16} className="text-[#4A4A4A]/25 shrink-0 rotate-180" />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* ══ جدول الديسكتوب (md فأعلى) ══ */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-[#F8F5F2] border-b border-slate-100">
                  <tr>
                    <SortableHeader label="رقم الطلب" sortKey="id" />
                    <SortableHeader label="العميل" sortKey="customer_name" />
                    <SortableHeader label="التاريخ" sortKey="created_at" />
                    <SortableHeader label="الحالة" sortKey="status" />
                    <SortableHeader label="المبلغ" sortKey="total_amount" />
                    <th className="px-6 py-4 text-xs font-bold text-[#4A4A4A]/50 uppercase tracking-wider">عرض</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedOrders.map((order) => {
                    const remaining = (order.total_amount || 0) - (order.deposit || 0) - Number(order.wallet_used || 0);
                    const isPaid = remaining <= 0.5;
                    return (
                      <tr key={order.id} className="hover:bg-[#F8F5F2]/60 transition-colors duration-150 group">
                        <td className="px-6 py-5">
                          <span className="font-mono text-xs font-bold text-[#4A4A4A]/60 bg-[#F8F5F2] px-2 py-1 rounded-lg border border-slate-200">
                            #{order.id.slice(0, 6)}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#D9A3AA]/20 to-[#C5A059]/20 flex items-center justify-center text-[#C5A059] font-black text-sm shrink-0 border border-white shadow-sm">
                              {order.customer_name.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-[#4A4A4A]">{order.customer_name}</span>
                              <span className="text-[11px] text-[#4A4A4A]/40 dir-ltr text-right font-mono">{order.phone}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-sm text-[#4A4A4A]/60 font-medium">
                          {order.created_at && format(new Date(order.created_at), 'dd MMM yyyy', { locale: arSA })}
                        </td>
                        <td className="px-6 py-5">
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)} shadow-sm`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 ml-1.5"></span>
                            {getStatusText(order.status)}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-[#4A4A4A]">
                              {order.total_amount} <span className="text-[10px] font-normal text-[#4A4A4A]/40">ر.س</span>
                            </span>
                            {!isPaid ? (
                              <span className="text-[11px] text-red-500 font-bold mt-0.5">متبقي: {remaining.toFixed(2)} ر.س</span>
                            ) : (
                              <span className="text-[11px] text-emerald-500 font-bold mt-0.5">✓ مدفوع بالكامل</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <Link
                            to={`/app/orders/${order.id}`}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-slate-200 text-[#4A4A4A]/40 hover:text-[#D9A3AA] hover:border-[#D9A3AA]/40 hover:bg-[#D9A3AA]/5 transition-all shadow-sm"
                          >
                            <ChevronRight size={17} className="rotate-180" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}