// src/pages/Orders.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Plus, Search, Filter, ChevronRight, Loader2, FileText, 
  ArrowUpDown, ArrowUp, ArrowDown, Wallet, Play 
} from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [isProcessingLoyalty, setIsProcessingLoyalty] = useState(false);

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

  // --- دالة تطبيق النقاط بأثر رجعي (المنطق الجديد) ---
  const processRetroactiveLoyalty = async () => {
    if(!window.confirm('⚠️ تنبيه هام:\n\nسيقوم النظام بفحص جميع الطلبات السابقة.\n- سيتم تخطي أي طلب تمت معالجته سابقاً.\n- سيتم حساب النقاط للصور والألبومات للطلبات غير المعالجة فقط.\n\nهل تود الاستمرار؟')) return;
    
    setIsProcessingLoyalty(true);
    let processedCount = 0;
    let skippedCount = 0; // تم تخطيه لأنه معالج سابقاً
    let zeroRewardCount = 0; // تم تخطيه لأن قيمته 0
    let errorCount = 0;

    try {
      // 1. جلب كل الطلبات
      const { data: allOrders } = await supabase
        .from('orders')
        .select('*');

      // 2. إعداد قيم النقاط
      const RATE_4x6 = 0.05;  // 100 صورة = 5 ريال (يعني الصورة بـ 0.05)
      const RATE_A4 = 1.00;   // الصورة بـ 1 ريال
      const RATE_ALBUM = 1.00; // الألبوم بـ 1 ريال

      for (const order of allOrders) {
        // [خطوة مهمة جداً] التحقق الفردي لمنع التكرار نهائياً
        const { data: existingTrans } = await supabase
          .from('wallet_transactions')
          .select('id')
          .eq('order_id', order.id)
          .eq('type', 'loyalty_earn')
          .maybeSingle();

        // إذا وجدنا عملية سابقة لهذا الطلب، نتجاوزه فوراً
        if (existingTrans) {
          skippedCount++;
          continue;
        }

        const cleanPhone = order.phone ? order.phone.replace(/\D/g, '') : '';
        if (!cleanPhone) {
            continue; // تجاوز بدون رقم جوال
        }

        // المعادلة الحسابية الصحيحة
        // نستخدم Number() لضمان أن القيم أرقام وليست نصوص
        const qty4x6 = Number(order.photo_4x6_qty) || 0;
        const qtyA4 = Number(order.a4_qty) || 0;
        const qtyAlbum = Number(order.album_qty) || 0;

        const reward = (qty4x6 * RATE_4x6) + (qtyA4 * RATE_A4) + (qtyAlbum * RATE_ALBUM);
        
        // التحقق أن العميل لم يحصل على خصم يدوي (اختياري حسب سياستك، هنا سأمنح النقاط للجميع ما عدا من أخذ خصماً كبيراً يصفر الفاتورة مثلاً)
        // إذا كنت تريد منع النقاط لمن أخذ خصم، ألغِ التعليق عن السطر التالي:
        // if (order.manual_discount > 0) { zeroRewardCount++; continue; }

        if (reward > 0) {
          try {
            // البحث عن المحفظة
            let { data: wallet } = await supabase.from('wallets').select('id, points_balance').eq('phone', cleanPhone).maybeSingle();
            let walletId = wallet?.id;

            // إنشاء محفظة إن لم توجد
            if (!wallet) {
                const { data: newWallet } = await supabase.from('wallets').insert([{ phone: cleanPhone, points_balance: 0 }]).select().single();
                walletId = newWallet.id;
                wallet = newWallet;
            }

            // تحديث الرصيد
            await supabase.from('wallets').update({ 
                points_balance: (Number(wallet.points_balance) || 0) + reward 
            }).eq('id', walletId);

            // تسجيل العملية لضمان عدم التكرار مستقبلاً
            await supabase.from('wallet_transactions').insert({
                wallet_id: walletId,
                order_id: order.id,
                type: 'loyalty_earn', // هذا النوع هو المفتاح لمنع التكرار
                amount_value: reward,
                points: reward, // نخزن نفس القيمة في النقاط للتوافق
                created_at: new Date().toISOString()
            });
            processedCount++;
          } catch (e) {
            console.error(`Error processing order ${order.id}:`, e);
            errorCount++;
          }
        } else {
            zeroRewardCount++;
        }
      }

      alert(`✅ اكتملت العملية!\n\n- تمت إضافة رصيد لـ: ${processedCount} طلب جديد\n- تم التخطي (معالج سابقاً): ${skippedCount} طلب\n- لا يستحقون نقاط (0): ${zeroRewardCount}\n- أخطاء: ${errorCount}`);

    } catch (err) {
      alert('حدث خطأ غير متوقع: ' + err.message);
    } finally {
      setIsProcessingLoyalty(false);
    }
  };

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
      <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none group text-xs font-bold text-slate-500 uppercase tracking-wider" onClick={() => requestSort(sortKey)}>
        <div className="flex items-center gap-1">
          {label}
          <span className="text-slate-400 group-hover:text-fuchsia-600 transition-colors">
            {isActive ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : (<ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50"/>)}
          </span>
        </div>
      </th>
    );
  };

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
    const map = { 'new': 'جديد', 'printing': 'قيد الطباعة', 'done': 'جاهز', 'delivered': 'تم التسليم' };
    return map[status] || status;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900">الطلبات</h1><p className="text-sm text-slate-500">إدارة ومتابعة طلبات الطباعة</p></div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2"><FileText size={16} className="text-slate-400"/><span>{filteredOrders.length} طلب</span></div>
          <Link to="/app/orders/new" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-fuchsia-500/20 transition-all"><Plus size={18} />طلب جديد</Link>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="بحث باسم العميل، الجوال، أو رقم الطلب..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-4 pr-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 text-sm placeholder:text-slate-400"/>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setSortConfig({ key: 'remaining', direction: 'desc' })} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-xs font-bold ${sortConfig.key === 'remaining' ? 'bg-red-50 text-red-600 border-red-200 ring-2 ring-red-100' : 'text-slate-600 hover:bg-slate-50 border-slate-200'}`}><Filter size={16} /><span>المديونيات</span></button>
            <button onClick={processRetroactiveLoyalty} disabled={isProcessingLoyalty} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all text-xs font-bold" title="تطبيق النقاط على الطلبات القديمة">{isProcessingLoyalty ? <Loader2 className="animate-spin" size={16}/> : <Play size={16}/>}<span>معالجة النقاط</span></button>
        </div>
      </div>

      {loading ? (<div className="flex justify-center py-20"><Loader2 className="animate-spin text-fuchsia-500" size={32} /></div>) : filteredOrders.length === 0 ? (<div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-300"><p className="text-slate-500 mb-2">لا توجد طلبات حتى الآن</p><Link to="/app/orders/new" className="text-fuchsia-600 font-medium hover:underline">أضف أول طلب</Link></div>) : (
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
                      <td className="px-6 py-5"><span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">#{order.id.slice(0, 6)}</span></td>
                      <td className="px-6 py-5"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-100 to-purple-100 flex items-center justify-center text-fuchsia-700 font-bold shadow-sm border border-white shrink-0">{order.customer_name.charAt(0)}</div><div className="flex flex-col"><span className="text-sm font-bold text-slate-900">{order.customer_name}</span><span className="text-[11px] text-slate-400 dir-ltr text-right font-mono">{order.phone}</span></div></div></td>
                      <td className="px-6 py-5 text-sm text-slate-500 font-medium">{order.created_at && format(new Date(order.created_at), 'dd MMM yyyy', { locale: arSA })}</td>
                      <td className="px-6 py-5"><div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)} shadow-sm`}><span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 ml-1.5"></span>{getStatusText(order.status)}</div></td>
                      <td className="px-6 py-5"><div className="flex flex-col"><span className="text-sm font-black text-slate-800">{order.total_amount} <span className="text-[10px] font-normal text-slate-400">ر.س</span></span>{!isPaid ? (<span className="text-[10px] text-red-500 font-bold mt-0.5">متبقي: {remaining.toFixed(2)}</span>) : (<span className="text-[10px] text-emerald-500 font-bold mt-0.5 flex items-center gap-1">مدفوع بالكامل</span>)}</div></td>
                      <td className="px-6 py-5"><Link to={`/app/orders/${order.id}`} className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-fuchsia-600 hover:border-fuchsia-200 hover:bg-fuchsia-50 transition-all shadow-sm group-hover:translate-x-[-4px]"><ChevronRight size={18} className="rotate-180" /></Link></td>
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