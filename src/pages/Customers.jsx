// src/pages/Customers.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Search, User, ShoppingBag, Banknote, Calendar, MessageCircle, 
  Crown, Filter
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
      const key = order.phone ? order.phone.replace(/\D/g, '') : order.customer_name;
      
      if (!map[key]) {
        map[key] = {
          id: key,
          name: order.customer_name,
          phone: order.phone,
          totalOrders: 0,
          totalSpent: 0,
          lastOrderDate: order.created_at,
          isVip: false
        };
      }

      const customer = map[key];
      customer.totalOrders += 1;
      customer.totalSpent += Number(order.total_amount || 0);
      
      if (new Date(order.created_at) > new Date(customer.lastOrderDate)) {
        customer.lastOrderDate = order.created_at;
      }
    });

    return Object.values(map).map(c => ({
      ...c,
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
            <User className="text-fuchsia-600"/> سجل ولاء العملاء
          </h1>
          <p className="text-sm text-slate-500 mt-1">قائمة بجميع عملائك مع تحليل مشترياتهم</p>
        </div>
        
        <div className="flex gap-3">
          <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-center shadow-sm flex items-center gap-3">
            <div className="bg-slate-50 p-2 rounded-lg text-slate-500"><User size={16}/></div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">إجمالي العملاء</span>
              <span className="font-bold text-lg text-slate-800">{customers.length}</span>
            </div>
          </div>
          <div className="bg-white border border-amber-100 px-4 py-2.5 rounded-xl text-center shadow-sm flex items-center gap-3">
            <div className="bg-amber-50 p-2 rounded-lg text-amber-500"><Crown size={16}/></div>
            <div className="text-right">
              <span className="text-[10px] text-amber-400 block font-bold uppercase">عملاء VIP</span>
              <span className="font-bold text-lg text-amber-600">{vipCount}</span>
            </div>
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
            className="w-full pr-12 pl-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-slate-700 text-sm placeholder:text-slate-400"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
          <button 
            onClick={() => setSortBy('spent')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${sortBy === 'spent' ? 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Banknote size={14}/> الأكثر دفعاً
          </button>
          <button 
            onClick={() => setSortBy('orders')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${sortBy === 'orders' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <ShoppingBag size={14}/> الأكثر طلباً
          </button>
          <button 
            onClick={() => setSortBy('recent')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${sortBy === 'recent' ? 'bg-slate-100 text-slate-800 border border-slate-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Calendar size={14}/> الأحدث
          </button>
        </div>
      </div>

      {/* الجدول المحسن */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400">جاري تحميل قاعدة العملاء...</div>
        ) : filteredAndSortedCustomers.length === 0 ? (
          <div className="p-10 text-center text-slate-400">لا يوجد نتائج</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">العميل</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">الطلبات</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">إجمالي الدفع</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">آخر زيارة</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">تواصل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredAndSortedCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-fuchsia-50/30 transition-colors duration-200 group">
                    
                    {/* العميل: أفاتار + اسم */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm border border-white shrink-0 ${customer.isVip ? 'bg-gradient-to-br from-amber-100 to-orange-200 text-amber-700' : 'bg-gradient-to-br from-fuchsia-100 to-purple-100 text-fuchsia-700'}`}>
                          {customer.isVip ? <Crown size={16} /> : customer.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-900">{customer.name}</span>
                            {customer.isVip && <span className="bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0.5 rounded-full border border-amber-200 font-bold">VIP</span>}
                          </div>
                          <span className="text-[11px] text-slate-400 dir-ltr text-right font-mono">{customer.phone || '-'}</span>
                        </div>
                      </div>
                    </td>

                    {/* عدد الطلبات */}
                    <td className="px-6 py-5">
                      <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-xs font-bold text-slate-600">
                        <ShoppingBag size={12} className="ml-1.5 text-slate-400"/> {customer.totalOrders}
                      </div>
                    </td>

                    {/* إجمالي الدفع */}
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-emerald-600">
                          {customer.totalSpent.toLocaleString()} <span className="text-[10px] font-normal text-emerald-400">ر.س</span>
                        </span>
                        {customer.totalSpent > 1000 && <span className="text-[9px] text-slate-300">عميل ممتاز</span>}
                      </div>
                    </td>

                    {/* آخر زيارة */}
                    <td className="px-6 py-5 text-sm text-slate-500 font-medium">
                      {format(new Date(customer.lastOrderDate), 'dd MMM yyyy', { locale: arSA })}
                    </td>

                    {/* زر التواصل */}
                    <td className="px-6 py-5">
                      {customer.phone && (
                        <a 
                          href={`https://wa.me/${customer.phone.replace(/^0/, '966').replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all shadow-sm group-hover:translate-x-[-4px]"
                          title="تواصل عبر واتساب"
                        >
                          <MessageCircle size={18}/>
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