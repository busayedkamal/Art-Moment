// src/pages/Customers.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Search, User, Phone, ShoppingBag, Banknote, Calendar, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

export default function Customers() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // جلب كل الطلبات لتحليلها
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
        console.error('Error fetching customers:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // معادلة ذكية لتجميع العملاء حسب رقم الجوال (أو الاسم)
  const customers = useMemo(() => {
    const map = {};

    orders.forEach((order) => {
      // المفتاح هو رقم الجوال، إذا لم يوجد نستخدم الاسم
      const key = order.phone ? order.phone.replace(/\s/g, '') : order.customer_name;

      if (!map[key]) {
        map[key] = {
          id: key,
          name: order.customer_name,
          phone: order.phone,
          totalOrders: 0,
          totalSpent: 0,
          lastOrderDate: order.created_at,
          source: order.source?.[0] || 'غير محدد'
        };
      }

      // تحديث بيانات العميل
      map[key].totalOrders += 1;
      map[key].totalSpent += Number(order.total_amount || 0);
      
      // التأكد من الاحتفاظ بآخر تاريخ طلب
      if (new Date(order.created_at) > new Date(map[key].lastOrderDate)) {
        map[key].lastOrderDate = order.created_at;
      }
    });

    // تحويل الكائن إلى مصفوفة للبحث والترتيب
    return Object.values(map);
  }, [orders]);

  // تصفية النتائج حسب البحث
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">قاعدة العملاء</h1>
          <p className="text-sm text-slate-500">لديك {customers.length} عميل فريد قاموا بالطلب.</p>
        </div>
      </div>

      {/* شريط البحث */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative">
        <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="ابحث باسم العميل أو رقم الجوال..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pr-10 pl-4 py-2 rounded-xl border-none focus:ring-0 text-slate-700 placeholder:text-slate-400"
        />
      </div>

      {loading ? (
        <div className="text-center py-10">جاري تحليل بيانات العملاء...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                    {customer.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{customer.name}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar size={12} />
                      آخر ظهور: {format(new Date(customer.lastOrderDate), 'dd MMM yyyy', { locale: arSA })}
                    </p>
                  </div>
                </div>
                {/* زر واتساب سريع */}
                {customer.phone && (
                   <a 
                     href={`https://wa.me/${customer.phone.replace(/^0/, '966')}`} 
                     target="_blank" 
                     rel="noreferrer"
                     className="p-2 bg-emerald-50 text-emerald-600 rounded-full hover:bg-emerald-100"
                     title="مراسلة عبر واتساب"
                   >
                     <MessageCircle size={18} />
                   </a>
                )}
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Phone size={14} /> الجوال
                  </span>
                  <span className="font-mono dir-ltr">{customer.phone || '-'}</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-2">
                    <ShoppingBag size={14} /> عدد الطلبات
                  </span>
                  <span className="font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">{customer.totalOrders}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Banknote size={14} /> إجمالي المدفوعات
                  </span>
                  <span className="font-bold text-emerald-600">{customer.totalSpent.toLocaleString()} ر.س</span>
                </div>
              </div>
            </div>
          ))}
          
          {filteredCustomers.length === 0 && (
             <div className="col-span-full text-center py-10 text-slate-400">
               لا يوجد عملاء يطابقون بحثك
             </div>
          )}
        </div>
      )}
    </div>
  );
}