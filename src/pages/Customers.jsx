// src/pages/Customers.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Search, User, ShoppingBag, Banknote, Calendar, MessageCircle, 
  Crown, Wallet, ArrowUp, ArrowDown, ArrowUpDown 
} from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

export default function Customers() {
  const [customersData, setCustomersData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [sortConfig, setSortConfig] = useState({ key: 'lastOrderDate', direction: 'desc' });

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const SortableHeader = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th 
        onClick={() => handleSort(sortKey)}
        className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:bg-slate-100 transition-colors group"
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

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // 1. جلب الطلبات (بما فيها العربون deposit)
        const { data: orders } = await supabase
          .from('orders')
          .select('id, customer_name, phone, total_amount, deposit, created_at')
          .order('created_at', { ascending: false });

        // ملاحظة: لم نعد بحاجة لجدول wallets للعرض، سنحسب الرصيد الفعلي من العمليات
        
        const map = {};
        const normalizePhone = (p) => {
          if (!p) return 'unknown';
          let clean = p.replace(/\D/g, ''); 
          if (clean.startsWith('966')) clean = clean.substring(3);
          if (clean.startsWith('0')) clean = clean.substring(1);
          return clean || 'unknown';
        };

        orders?.forEach((order) => {
          const cleanPhone = normalizePhone(order.phone);
          const key = cleanPhone !== 'unknown' ? cleanPhone : `name-${order.customer_name}`;

          if (!map[key]) {
            map[key] = {
              id: key,
              name: order.customer_name,
              phone: order.phone,
              cleanPhone: cleanPhone,
              orderIds: new Set(),
              totalSpent: 0, // إجمالي المطلوب
              totalPaid: 0,  // إجمالي المدفوع
              lastOrderDate: order.created_at,
              isVip: false
            };
          }

          if (!map[key].orderIds.has(order.id)) {
            map[key].orderIds.add(order.id);
            map[key].totalSpent += Number(order.total_amount || 0);
            map[key].totalPaid += Number(order.deposit || 0); // جمع المدفوعات
            
            if (new Date(order.created_at) > new Date(map[key].lastOrderDate)) {
              map[key].lastOrderDate = order.created_at;
            }
          }
        });

        const result = Object.values(map).map(c => {
          // الحساب الديناميكي للرصيد: (المدفوع - المطلوب)
          const rawBalance = c.totalPaid - c.totalSpent;
          
          return {
            ...c,
            // إذا كان الناتج موجباً فهو رصيد له، وإذا سالب فهو مديونية عليه
            walletBalance: rawBalance, 
            totalOrders: c.orderIds.size,
            isVip: c.orderIds.size >= 3 || c.totalSpent >= 500 
          };
        });

        setCustomersData(result);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredCustomers = useMemo(() => {
    let result = customersData.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm))
    );

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'lastOrderDate') {
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [customersData, searchTerm, sortConfig]);

  const vipCount = customersData.filter(c => c.isVip).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <User className="text-fuchsia-600"/> سجل ولاء العملاء
          </h1>
          <p className="text-sm text-slate-500 mt-1">قائمة بجميع العملاء مع تحليل مالي دقيق</p>
        </div>
        
        <div className="flex gap-3">
          <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-center shadow-sm">
            <span className="text-[10px] text-slate-400 block font-bold uppercase">العملاء</span>
            <span className="font-bold text-lg text-slate-800">{customersData.length}</span>
          </div>
          <div className="bg-white border border-amber-100 px-4 py-2.5 rounded-xl text-center shadow-sm">
            <span className="text-[10px] text-amber-400 block font-bold uppercase">VIP</span>
            <span className="font-bold text-lg text-amber-600">{vipCount}</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="بحث بالاسم أو الجوال..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
          />
        </div>
        
        <div className="flex gap-2">
          <button onClick={() => setSortConfig({ key: 'totalSpent', direction: 'desc' })} className={`px-4 py-2 rounded-xl text-xs font-bold ${sortConfig.key === 'totalSpent' ? 'bg-fuchsia-50 text-fuchsia-700' : 'bg-slate-50'}`}>
            <Banknote size={14} className="inline ml-1"/> الأكثر دفعاً
          </button>
          <button onClick={() => setSortConfig({ key: 'totalOrders', direction: 'desc' })} className={`px-4 py-2 rounded-xl text-xs font-bold ${sortConfig.key === 'totalOrders' ? 'bg-blue-50 text-blue-700' : 'bg-slate-50'}`}>
            <ShoppingBag size={14} className="inline ml-1"/> الأكثر طلباً
          </button>
          <button onClick={() => setSortConfig({ key: 'walletBalance', direction: 'desc' })} className={`px-4 py-2 rounded-xl text-xs font-bold ${sortConfig.key === 'walletBalance' ? 'bg-violet-50 text-violet-700' : 'bg-slate-50'}`}>
            <Wallet size={14} className="inline ml-1"/> أعلى رصيد
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400">جاري التحليل...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-10 text-center text-slate-400">لا يوجد نتائج</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <SortableHeader label="العميل" sortKey="name" />
                  <SortableHeader label="رصيد المحفظة" sortKey="walletBalance" />
                  <SortableHeader label="الطلبات" sortKey="totalOrders" />
                  <SortableHeader label="الإجمالي" sortKey="totalSpent" />
                  <SortableHeader label="آخر زيارة" sortKey="lastOrderDate" />
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">تواصل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                    
                    {/* العميل */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${customer.isVip ? 'bg-amber-400' : 'bg-slate-400'}`}>
                          {customer.isVip ? <Crown size={16} /> : customer.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{customer.name}</span>
                            {customer.isVip && <span className="bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0.5 rounded-full border border-amber-200 font-bold">VIP</span>}
                          </div>
                          <div className="text-xs text-slate-400 dir-ltr text-right">{customer.phone}</div>
                        </div>
                      </div>
                    </td>

                    {/* رصيد المحفظة (محسوب ديناميكياً) */}
                    <td className="px-6 py-5">
                      {customer.walletBalance > 0 ? (
                        <span className="bg-violet-50 text-violet-700 px-3 py-1 rounded-lg text-xs font-bold flex items-center w-fit gap-1">
                          <Wallet size={12}/> {customer.walletBalance.toFixed(1)} ريال
                        </span>
                      ) : customer.walletBalance < 0 ? (
                        <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-xs font-bold flex items-center w-fit gap-1 dir-ltr">
                           {Math.abs(customer.walletBalance).toFixed(1)}- ريال
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs font-bold px-2">-</span>
                      )}
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
                    <td className="px-6 py-5 text-sm text-slate-500">
                      {format(new Date(customer.lastOrderDate), 'dd MMM yyyy', { locale: arSA })}
                    </td>

                    {/* زر التواصل */}
                    <td className="px-6 py-5">
                      {customer.cleanPhone !== 'unknown' && (
                        <a href={`https://wa.me/966${customer.cleanPhone}`} target="_blank" className="text-emerald-500 hover:text-emerald-600">
                          <MessageCircle size={20}/>
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