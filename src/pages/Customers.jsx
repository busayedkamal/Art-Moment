// src/pages/Customers.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Search, User, Phone, ShoppingBag, Banknote, Calendar, MessageCircle, 
  Crown, ArrowUpDown, Filter, Star 
} from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

export default function Customers() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('spent'); // 'spent' | 'orders' | 'recent'

  // جلب البيانات
  useEffect(() => {
    async function fetchData() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders(data || []);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // معالجة البيانات وتجميعها
  const customers = useMemo(() => {
    const map = {};

    orders.forEach((order) => {
      // تنظيف رقم الجوال لاستخدامه كمفتاح
      const key = order.phone ? order.phone.replace(/\D/g, '') : order.customer_name;
      
      if (!map[key]) {
        map[key] = {
          id: key,
          name: order.customer_name,
          phone: order.phone,
          totalOrders: 0,
          totalSpent: 0,
          lastOrderDate: order.created_at,
          isVip: false // سيتم حسابه
        };
      }

      const customer = map[key];
      customer.totalOrders += 1;
      customer.totalSpent += Number(order.total_amount || 0);
      
      if (new Date(order.created_at) > new Date(customer.lastOrderDate)) {
        customer.lastOrderDate = order.created_at;
      }
    });

    // تحويل لكائن وتحديد الـ VIP
    return Object.values(map).map(c => ({
      ...c,
      // قاعدة الـ VIP: أكثر من 3 طلبات أو صرف أكثر من 500 ريال
      isVip: c.totalOrders >= 3 || c.totalSpent >= 500
    }));
  }, [orders]);

  // الفلترة والترتيب
  const filteredAndSortedCustomers = useMemo(() => {
    let result = customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm))
    );

    result.sort((a, b) => {
      if (sortBy === 'spent') return b.totalSpent - a.totalSpent;
      if (sortBy === 'orders') return b.totalOrders - a.totalOrders;
      if (sortBy === 'recent') return new Date(b.lastOrderDate) - new Date(a.lastOrderDate);
      return 0;
    });

    return result;
  }, [customers, searchTerm, sortBy]);

  const vipCount = customers.filter(c => c.isVip).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      
      {/* رأس الصفحة والإحصائيات */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <User className="text-blue-600"/> سجل ولاء العملاء
          </h1>
          <p className="text-sm text-slate-500 mt-1">قائمة بجميع عملائك مع تحليل مشترياتهم</p>
        </div>
        
        <div className="flex gap-3">
          <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-center shadow-sm">
            <span className="text-[10px] text-slate-400 block font-bold">إجمالي العملاء</span>
            <span className="font-bold text-lg text-slate-700">{customers.length}</span>
          </div>
          <div className="bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl text-center shadow-sm">
            <span className="text-[10px] text-amber-600 block font-bold">عملاء VIP</span>
            <span className="font-bold text-lg text-amber-700 flex items-center justify-center gap-1">
              {vipCount} <Crown size={14} fill="currentColor"/>
            </span>
          </div>
        </div>
      </div>

      {/* شريط الأدوات */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="بحث بالاسم أو الجوال..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-700"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
          <button 
            onClick={() => setSortBy('spent')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${sortBy === 'spent' ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          >
            <Banknote size={16}/> الأكثر دفعاً
          </button>
          <button 
            onClick={() => setSortBy('orders')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${sortBy === 'orders' ? 'bg-blue-100 text-blue-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          >
            <ShoppingBag size={16}/> الأكثر طلباً
          </button>
          <button 
            onClick={() => setSortBy('recent')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${sortBy === 'recent' ? 'bg-slate-200 text-slate-800' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          >
            <Calendar size={16}/> الأحدث
          </button>
        </div>
      </div>

      {/* الجدول */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400">جاري تحميل قاعدة العملاء...</div>
        ) : filteredAndSortedCustomers.length === 0 ? (
          <div className="p-10 text-center text-slate-400">لا يوجد نتائج</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase">
                <tr>
                  <th className="px-6 py-4">العميل</th>
                  <th className="px-6 py-4">مجموع الطلبات</th>
                  <th className="px-6 py-4">إجمالي الدفع</th>
                  <th className="px-6 py-4">آخر زيارة</th>
                  <th className="px-6 py-4">تواصل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedCustomers.map((customer) => (
                  <tr key={customer.id} className={`hover:bg-slate-50 transition-colors ${customer.isVip ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${customer.isVip ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-200 ring-offset-2' : 'bg-slate-100 text-slate-500'}`}>
                          {customer.isVip ? <Crown size={18} fill="currentColor"/> : customer.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1">
                            {customer.name}
                            {customer.isVip && <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-md">VIP</span>}
                          </div>
                          <div className="text-xs text-slate-400 font-mono dir-ltr text-right">{customer.phone || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700">{customer.totalOrders}</span>
                        <span className="text-xs text-slate-400">طلب</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-emerald-600">
                        {customer.totalSpent.toLocaleString()} <span className="text-xs text-emerald-400">ر.س</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-500">
                        {format(new Date(customer.lastOrderDate), 'dd MMM yyyy', { locale: arSA })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {customer.phone && (
                        <a 
                          href={`https://wa.me/${customer.phone.replace(/^0/, '966').replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                        >
                          <MessageCircle size={14}/> واتساب
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}