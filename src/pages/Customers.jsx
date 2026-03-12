// src/pages/Customers.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";
import {
  Search, Users, Wallet, ShoppingBag, Sparkles, Crown, ArrowLeft,
  Phone, Calendar, Gift, X, Loader2, ChevronDown, MapPin, StickyNote, Save
} from "lucide-react";

export default function Customers() {
  const [customersData, setCustomersData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); 
  const [sortBy, setSortBy] = useState("netBalance");

  // --- حالات القائمة المنسدلة ---
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);
  
  // --- حالات تعديل بيانات العميل ---
  const [customerDetails, setCustomerDetails] = useState({ address: '', notes: '' });
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // --- حالات نافذة المكافآت ---
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [bonusAmount, setBonusAmount] = useState(10);
  const [bonusReason, setBonusReason] = useState("مكافأة إحالة (شارك الفن)");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const normalizePhone = (raw) => {
        if (!raw) return '';
        let p = String(raw).replace(/\D/g, '');
        if (p.startsWith('966')) p = p.slice(3);
        if (p.startsWith('0')) p = p.slice(1);
        return p;
      };

      // 1) الطلبات
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, customer_name, phone, total_amount, deposit, created_at')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // 2) المحافظ (تمت إضافة address و notes)
      const { data: walletsData, error: walletsError } = await supabase
        .from('wallets')
        .select('phone, points_balance, address, notes');

      if (walletsError) throw walletsError;

      const walletMap = new Map();
      (walletsData || []).forEach(w => {
        const key = normalizePhone(w.phone);
        if (!key) return;
        walletMap.set(key, { 
          balance: Number(w.points_balance || 0),
          address: w.address || '',
          notes: w.notes || ''
        });
      });

      const map = {};

      (ordersData || []).forEach(order => {
        const clean = normalizePhone(order.phone);
        const key = clean || `unknown_${order.id}`;

        if (!map[key]) {
          map[key] = {
            id: key,
            name: order.customer_name || 'غير معروف',
            phone: order.phone || '',
            cleanPhone: clean,
            totalRequired: 0,
            totalPaid: 0,
            debt: 0,
            orderIds: new Set(),
            lastOrderDate: order.created_at ? new Date(order.created_at) : null
          };
        }

        map[key].orderIds.add(order.id);

        const totalAmount = Number(order.total_amount || 0);
        const paid = Number(order.deposit || 0);
        const remaining = totalAmount - paid;

        map[key].totalRequired += totalAmount;
        map[key].totalPaid += paid;
        if (remaining > 0) map[key].debt += remaining;

        if (order.created_at) {
          const dt = new Date(order.created_at);
          if (!map[key].lastOrderDate || dt > map[key].lastOrderDate) map[key].lastOrderDate = dt;
        }
      });

      const result = Object.values(map).map(c => {
        const walletData = c.cleanPhone ? walletMap.get(c.cleanPhone) : null;
        const walletBalance = walletData ? walletData.balance : 0;
        const address = walletData ? walletData.address : '';
        const notes = walletData ? walletData.notes : '';
        
        const debt = Number(c.debt || 0);
        const netBalance = walletBalance - debt;

        return {
          ...c,
          walletBalance,
          address,
          notes,
          debt,
          netBalance,
          totalOrders: c.orderIds.size,
          isVip: c.orderIds.size >= 3 || c.totalRequired >= 500
        };
      });

      setCustomersData(result);
    } catch (error) {
      console.error("Error:", error);
      toast.error("حدث خطأ في تحميل العملاء");
    } finally {
      setLoading(false);
    }
  }

  // --- دالة حفظ بيانات العميل (العنوان والملاحظات) ---
  const handleSaveCustomerDetails = async (customer) => {
    if (!customer.cleanPhone) {
      toast.error("لا يمكن حفظ البيانات لعميل بدون رقم هاتف");
      return;
    }
    
    setIsSavingDetails(true);
    try {
      // التحقق من وجود محفظة مسبقاً
      const { data: existingWallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('phone', customer.cleanPhone)
        .maybeSingle();

      if (existingWallet) {
        // تحديث
        const { error } = await supabase
          .from('wallets')
          .update({ address: customerDetails.address, notes: customerDetails.notes })
          .eq('id', existingWallet.id);
        if (error) throw error;
      } else {
        // إنشاء محفظة جديدة لحفظ البيانات
        const { error } = await supabase
          .from('wallets')
          .insert([{ 
            phone: customer.cleanPhone, 
            points_balance: 0, 
            address: customerDetails.address, 
            notes: customerDetails.notes 
          }]);
        if (error) throw error;
      }

      toast.success("تم حفظ بيانات العميل بنجاح ✨");
      fetchData(); // تحديث الجدول
    } catch (error) {
      console.error('Error saving details:', error);
      toast.error("حدث خطأ أثناء الحفظ");
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleExpandRow = (customer) => {
    if (expandedCustomerId === customer.id) {
      setExpandedCustomerId(null);
    } else {
      setExpandedCustomerId(customer.id);
      setCustomerDetails({ address: customer.address || '', notes: customer.notes || '' });
    }
  };

  // --- دالة إضافة المكافأة (كما هي) ---
  const handleGiveBonus = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !bonusAmount || bonusAmount <= 0 || !bonusReason) {
      toast.error("يرجى تعبئة جميع الحقول"); return;
    }
    setIsSubmitting(true);
    try {
      const amountNum = Number(bonusAmount);
      const phone = selectedCustomer.cleanPhone;
      if (!phone) throw new Error("لا يوجد رقم هاتف صالح");

      const { data: existingWallet, error: fetchErr } = await supabase
        .from('wallets').select('id, points_balance').eq('phone', phone).maybeSingle();
      if (fetchErr) throw fetchErr;

      if (existingWallet) {
        const { error: updateErr } = await supabase
          .from('wallets').update({ points_balance: Number(existingWallet.points_balance || 0) + amountNum }).eq('id', existingWallet.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('wallets').insert([{ phone: phone, points_balance: amountNum }]);
        if (insertErr) throw insertErr;
      }

      const { error: expError } = await supabase
        .from('expenses').insert([{ title: `${bonusReason} - للعميل: ${selectedCustomer.name}`, amount: amountNum, date: new Date().toISOString().split('T')[0] }]);
      if (expError) throw expError;

      toast.success(`تمت إضافة ${amountNum} ريال لمحفظة العميل 🎁`);
      setIsBonusModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.message || 'حدث خطأ أثناء تنفيذ العملية');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openBonusModal = (customer, e) => {
    e.stopPropagation(); // لمنع فتح القائمة المنسدلة عند الضغط على الزر
    setSelectedCustomer(customer);
    setBonusAmount(10);
    setBonusReason("مكافأة إحالة (شارك الفن)");
    setIsBonusModalOpen(true);
  };


  const filtered = useMemo(() => {
    let data = customersData;
    if (filter === "vip") data = data.filter(c => c.isVip);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(c => (c.name || "").toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q));
    }
    data = [...data].sort((a, b) => {
      if (sortBy === "lastOrderDate") return (b.lastOrderDate?.getTime() || 0) - (a.lastOrderDate?.getTime() || 0);
      return (Number(b[sortBy] || 0) - Number(a[sortBy] || 0));
    });
    return data;
  }, [customersData, search, filter, sortBy]);

  const stats = useMemo(() => {
    const totalCustomers = customersData.length;
    const vipCustomers = customersData.filter(c => c.isVip).length;
    return { totalCustomers, vipCustomers };
  }, [customersData]);

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-[#4A4A4A] flex items-center gap-2">
            <Users className="text-[#D9A3AA]" /> سجل ولاء العملاء
          </h1>
          <p className="text-[#4A4A4A]/70 text-sm">إدارة متقدمة لبيانات ومحافظ العملاء</p>
        </div>
        <Link to="/app/orders" className="text-sm font-bold text-[#4A4A4A]/70 hover:text-[#4A4A4A] flex items-center gap-1">
          <ArrowLeft size={16} /> العودة للطلبات
        </Link>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl p-4 shadow-sm">
          <div className="text-[#4A4A4A]/70 text-xs font-bold">العملاء</div>
          <div className="text-2xl font-black text-[#4A4A4A] mt-1">{stats.totalCustomers}</div>
        </div>
        <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl p-4 shadow-sm">
          <div className="text-[#4A4A4A]/70 text-xs font-bold flex items-center gap-1"><Crown size={14} className="text-amber-500" /> كبار العملاء VIP</div>
          <div className="text-2xl font-black text-[#4A4A4A] mt-1">{stats.vipCustomers}</div>
        </div>
        <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl p-4 shadow-sm">
          <div className="text-[#4A4A4A]/70 text-xs font-bold flex items-center gap-1"><Wallet size={14} className="text-violet-600" /> إجمالي المحافظ (صافي)</div>
          <div className="text-2xl font-black text-[#4A4A4A] mt-1">
            {customersData.reduce((sum, c) => sum + (Number(c.netBalance || 0)), 0).toFixed(1)} <span className="text-xs">ر.س</span>
          </div>
        </div>
        <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl p-4 shadow-sm">
          <div className="text-[#4A4A4A]/70 text-xs font-bold flex items-center gap-1"><ShoppingBag size={14} className="text-blue-600" /> المبيعات التراكمية</div>
          <div className="text-2xl font-black text-[#4A4A4A] mt-1">
            {customersData.reduce((sum, c) => sum + (Number(c.totalRequired || 0)), 0).toFixed(0)} <span className="text-xs">ر.س</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute right-3 top-3 text-[#4A4A4A]/50" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الجوال..." className="w-full border border-[#D9A3AA]/20 rounded-xl px-4 py-2 pr-9 outline-none focus:border-[#D9A3AA]" />
          </div>
          <button onClick={() => setFilter("all")} className={`px-3 py-2 rounded-xl text-sm font-bold border ${filter === "all" ? "bg-[#4A4A4A] text-white border-[#4A4A4A]" : "bg-white text-[#4A4A4A]/80 border-[#D9A3AA]/20"}`}>الكل</button>
          <button onClick={() => setFilter("vip")} className={`px-3 py-2 rounded-xl text-sm font-bold border flex items-center gap-1 ${filter === "vip" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-[#4A4A4A]/80 border-[#D9A3AA]/20"}`}><Crown size={14} /> VIP</button>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-[#4A4A4A]/70 font-bold">ترتيب حسب:</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border border-[#D9A3AA]/20 rounded-xl px-3 py-2 text-sm outline-none">
            <option value="netBalance">الرصيد الصافي</option>
            <option value="totalRequired">أعلى المبيعات</option>
            <option value="totalOrders">أكثر الطلبات</option>
            <option value="lastOrderDate">تاريخ آخر زيارة</option>
          </select>
        </div>
      </div>

      {/* Table - النسخة النظيفة والمختصرة */}
      <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl shadow-sm overflow-hidden">
        <table className="min-w-full text-right">
          <thead className="bg-[#F8F5F2] border-b border-[#D9A3AA]/20">
            <tr className="text-sm font-bold text-[#4A4A4A]/70">
              <th className="px-6 py-4">بيانات العميل</th>
              <th className="px-6 py-4 hidden sm:table-cell">رقم الجوال</th>
              <th className="px-6 py-4 text-center">الرصيد الصافي</th>
              <th className="px-6 py-4 text-left">إجراءات</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#D9A3AA]/10">
            {loading ? (
              <tr><td className="p-8 text-center text-[#4A4A4A]/70" colSpan={4}>جاري التحميل...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="p-8 text-center text-[#4A4A4A]/70" colSpan={4}>لا يوجد عملاء</td></tr>
            ) : (
              filtered.map((customer) => {
                const isExpanded = expandedCustomerId === customer.id;

                return (
                  <React.Fragment key={customer.id}>
                    {/* الصف الرئيسي المبسط */}
                    <tr 
                      onClick={() => handleExpandRow(customer)}
                      className={`hover:bg-[#F8F5F2] cursor-pointer transition-colors group ${isExpanded ? 'bg-[#F8F5F2]/50' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg transition-transform ${isExpanded ? 'bg-[#D9A3AA] text-white scale-110' : 'bg-[#D9A3AA]/10 text-[#D9A3AA] group-hover:scale-105'}`}>
                            {(customer.name || "؟").slice(0, 1)}
                          </div>
                          <div>
                            <div className="font-bold text-[#4A4A4A] text-base flex items-center gap-2">
                              {customer.name}
                              {customer.isVip && (
                                <span className="bg-amber-100 text-amber-700 p-1 rounded-full" title="عميل VIP">
                                  <Crown size={12} />
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#4A4A4A]/50 sm:hidden mt-0.5" dir="ltr">{customer.phone || "-"}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 font-mono text-sm text-[#4A4A4A]/80 dir-ltr text-right hidden sm:table-cell">
                        {customer.phone || "-"}
                      </td>

                      <td className="px-6 py-4 text-center">
                        {customer.netBalance > 0.5 ? (
                          <span className="bg-violet-50 border border-violet-100 text-violet-700 px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center justify-center min-w-[80px]">
                            {customer.netBalance.toFixed(1)} ر.س
                          </span>
                        ) : customer.netBalance < -0.5 ? (
                          <span className="bg-red-50 border border-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center justify-center min-w-[80px] dir-ltr">
                            {Math.abs(customer.netBalance).toFixed(1)}- ر.س
                          </span>
                        ) : (
                          <span className="text-[#4A4A4A]/40 text-xs font-bold">0.00</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {customer.phone && (
                            <a
                              href={`https://wa.me/966${String(customer.phone).startsWith("0") ? String(customer.phone).slice(1) : customer.phone}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()} // لمنع فتح القائمة عند ضغط الواتساب
                              className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors border border-emerald-100"
                              title="مراسلة واتساب"
                            >
                              <Phone size={18} />
                            </a>
                          )}
                          
                          {customer.cleanPhone && (
                            <button 
                              onClick={(e) => openBonusModal(customer, e)}
                              className="p-2 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition-colors border border-amber-100"
                              title="إضافة مكافأة إحالة"
                            >
                              <Gift size={18} />
                            </button>
                          )}

                          <button className={`p-2 rounded-xl text-[#4A4A4A]/50 transition-all ${isExpanded ? 'bg-[#D9A3AA]/10 text-[#D9A3AA] rotate-180' : 'group-hover:bg-[#F8F5F2]'}`}>
                             <ChevronDown size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* القائمة المنسدلة (التفاصيل المخفية) */}
                    {isExpanded && (
                      <tr className="bg-[#F8F5F2]/40 border-b-2 border-[#D9A3AA]/20">
                        <td colSpan="4" className="p-0">
                          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-top-2 fade-in duration-300">
                            
                            {/* القسم الأيمن: الإحصائيات والأرقام */}
                            <div className="bg-white p-5 rounded-2xl border border-[#D9A3AA]/20 shadow-sm">
                               <h4 className="font-bold text-[#4A4A4A] mb-4 flex items-center gap-2 border-b border-[#F8F5F2] pb-3">
                                 <ShoppingBag size={18} className="text-[#C5A059]"/> ملخص نشاط العميل
                               </h4>
                               
                               <div className="grid grid-cols-2 gap-4">
                                 <div className="bg-[#F8F5F2] p-3 rounded-xl">
                                    <span className="block text-[10px] text-[#4A4A4A]/60 font-bold mb-1">إجمالي المشتريات</span>
                                    <span className="font-black text-[#4A4A4A] text-lg">{Number(customer.totalRequired || 0).toFixed(0)} <span className="text-xs font-normal">ر.س</span></span>
                                 </div>
                                 <div className="bg-[#F8F5F2] p-3 rounded-xl">
                                    <span className="block text-[10px] text-[#4A4A4A]/60 font-bold mb-1">عدد الطلبات</span>
                                    <span className="font-black text-[#4A4A4A] text-lg">{customer.orderIds.size} <span className="text-xs font-normal">طلبات</span></span>
                                 </div>
                                 <div className="bg-[#F8F5F2] p-3 rounded-xl">
                                    <span className="block text-[10px] text-[#4A4A4A]/60 font-bold mb-1">تاريخ آخر طلب</span>
                                    <span className="font-bold text-[#4A4A4A] text-sm mt-1 block">
                                      {customer.lastOrderDate ? customer.lastOrderDate.toLocaleDateString("en-GB") : "-"}
                                    </span>
                                 </div>
                                 <div className="bg-[#F8F5F2] p-3 rounded-xl">
                                    <span className="block text-[10px] text-[#4A4A4A]/60 font-bold mb-1">تفصيل الرصيد</span>
                                    <span className="font-bold text-[#4A4A4A] text-[11px] mt-1 block leading-tight">
                                      محفظة: <span className="text-violet-600">{Number(customer.walletBalance || 0).toFixed(1)}</span><br/>
                                      مديونية: <span className="text-red-500">{Number(customer.debt || 0).toFixed(1)}</span>
                                    </span>
                                 </div>
                               </div>
                            </div>

                            {/* القسم الأيسر: البيانات القابلة للتعديل (عنوان + ملاحظات) */}
                            <div className="bg-white p-5 rounded-2xl border border-[#D9A3AA]/20 shadow-sm flex flex-col">
                               <h4 className="font-bold text-[#4A4A4A] mb-4 flex items-center gap-2 border-b border-[#F8F5F2] pb-3">
                                 <StickyNote size={18} className="text-[#D9A3AA]"/> تفاصيل وشحن العميل
                               </h4>

                               <div className="space-y-4 flex-1">
                                 <div>
                                   <label className="flex items-center gap-1 text-xs font-bold text-[#4A4A4A]/70 mb-1.5">
                                     <MapPin size={12}/> العنوان / موقع التوصيل
                                   </label>
                                   <input 
                                     type="text" 
                                     placeholder="مثال: الرميلة، العمران، شارع..."
                                     value={customerDetails.address}
                                     onChange={(e) => setCustomerDetails({...customerDetails, address: e.target.value})}
                                     className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#D9A3AA] transition-colors"
                                   />
                                 </div>

                                 <div className="flex-1">
                                   <label className="flex items-center gap-1 text-xs font-bold text-[#4A4A4A]/70 mb-1.5">
                                     <StickyNote size={12}/> ملاحظات خاصة بالعميل
                                   </label>
                                   <textarea 
                                     placeholder="مثال: يفضل التغليف الوردي، يطلب دائماً طباعة مطفية..."
                                     value={customerDetails.notes}
                                     onChange={(e) => setCustomerDetails({...customerDetails, notes: e.target.value})}
                                     className="w-full h-20 resize-none bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#D9A3AA] transition-colors custom-scrollbar"
                                   ></textarea>
                                 </div>
                               </div>

                               <div className="mt-4 pt-4 border-t border-[#F8F5F2] flex justify-end">
                                 <button 
                                   onClick={() => handleSaveCustomerDetails(customer)}
                                   disabled={isSavingDetails}
                                   className="bg-[#4A4A4A] hover:bg-[#333333] text-white text-sm font-bold py-2 px-6 rounded-xl transition-all flex items-center gap-2 disabled:opacity-70"
                                 >
                                   {isSavingDetails ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                                   حفظ التعديلات
                                 </button>
                               </div>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* --- نافذة إضافة المكافأة (Modal) - تبقى كما هي --- */}
      {isBonusModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-amber-50 p-6 border-b border-amber-100 flex justify-between items-center relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-amber-200 opacity-50"><Gift size={80}/></div>
              <div className="relative z-10">
                <h3 className="text-xl font-black text-amber-800 flex items-center gap-2">
                  <Gift size={20}/> إضافة مكافأة للعميل
                </h3>
                <p className="text-amber-700/70 text-sm mt-1">تضاف للمحفظة وتُقيد كمصروف تسويقي</p>
              </div>
              <button onClick={() => setIsBonusModalOpen(false)} className="p-2 bg-white rounded-full text-[#4A4A4A] hover:bg-red-50 hover:text-red-500 transition-colors relative z-10 shadow-sm"><X size={16}/></button>
            </div>
            
            <form onSubmit={handleGiveBonus} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-[#4A4A4A] mb-1">العميل المستفيد:</label>
                <div className="p-3 bg-[#F8F5F2] rounded-xl text-[#4A4A4A] font-medium border border-[#D9A3AA]/20">
                  {selectedCustomer.name} <span className="text-xs text-[#4A4A4A]/50 dir-ltr block">{selectedCustomer.phone}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#4A4A4A] mb-1">المبلغ المضاف (ر.س):</label>
                <input 
                  type="number" 
                  min="1"
                  required
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(e.target.value)}
                  className="w-full border border-[#D9A3AA]/30 rounded-xl px-4 py-3 outline-none focus:border-amber-400 focus:ring-4 ring-amber-400/10 font-bold text-lg text-amber-600"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#4A4A4A] mb-1">سبب المكافأة (يظهر في المصروفات):</label>
                <input 
                  type="text" 
                  required
                  value={bonusReason}
                  onChange={(e) => setBonusReason(e.target.value)}
                  className="w-full border border-[#D9A3AA]/30 rounded-xl px-4 py-3 outline-none focus:border-amber-400 focus:ring-4 ring-amber-400/10 text-sm"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-400 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-amber-500/30 transition-all flex justify-center items-center gap-2 disabled:opacity-70"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>}
                  {isSubmitting ? 'جاري التنفيذ...' : 'اعتماد المكافأة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}