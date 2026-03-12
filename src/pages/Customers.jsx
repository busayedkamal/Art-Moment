// src/pages/Customers.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";
import {
  Search, Users, Wallet, ShoppingBag, Sparkles, Crown, ArrowLeft,
  Phone, Calendar, Gift, X, Loader2
} from "lucide-react";

export default function Customers() {
  const [customersData, setCustomersData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | vip
  const [sortBy, setSortBy] = useState("netBalance"); // netBalance | walletBalance | totalOrders | totalRequired | lastOrderDate

  // --- حالات نافذة المكافآت (Referral Bonus) ---
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [bonusAmount, setBonusAmount] = useState(10); // الافتراضي 10 ريال
  const [bonusReason, setBonusReason] = useState("مكافأة إحالة (شارك الفن)");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // معيار VIP
  const VIP_THRESHOLD = 500;

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

      // 2) المحافظ
      const { data: walletsData, error: walletsError } = await supabase
        .from('wallets')
        .select('phone, points_balance');

      if (walletsError) throw walletsError;

      const walletMap = new Map();
      (walletsData || []).forEach(w => {
        const key = normalizePhone(w.phone);
        if (!key) return;
        walletMap.set(key, Number(w.points_balance || 0));
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
        const walletBalance = c.cleanPhone ? (walletMap.get(c.cleanPhone) || 0) : 0;
        const debt = Number(c.debt || 0);
        const netBalance = walletBalance - debt;

        return {
          ...c,
          walletBalance,
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

  // --- دالة إضافة المكافأة للمحفظة وتسجيلها كمصروف ---
  const handleGiveBonus = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !bonusAmount || bonusAmount <= 0 || !bonusReason) {
      toast.error("يرجى تعبئة جميع الحقول بشكل صحيح");
      return;
    }

    setIsSubmitting(true);
    try {
      const amountNum = Number(bonusAmount);
      const phone = selectedCustomer.cleanPhone;

      if (!phone) throw new Error("لا يوجد رقم هاتف صالح للعميل لربط المحفظة");

      // 1. فحص هل للعميل محفظة سابقة
      const { data: existingWallet, error: fetchErr } = await supabase
        .from('wallets')
        .select('id, points_balance')
        .eq('phone', phone)
        .maybeSingle(); // maybeSingle بدل single لتجنب الخطأ إذا لم تكن موجودة

      if (fetchErr) throw fetchErr;

      // 2. تحديث أو إنشاء المحفظة
      if (existingWallet) {
        const { error: updateErr } = await supabase
          .from('wallets')
          .update({ points_balance: Number(existingWallet.points_balance || 0) + amountNum })
          .eq('id', existingWallet.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('wallets')
          .insert([{ phone: phone, points_balance: amountNum }]);
        if (insertErr) throw insertErr;
      }

      // 3. إضافة المبلغ في جدول المصروفات
      const expenseTitle = `${bonusReason} - للعميل: ${selectedCustomer.name}`;
      const { error: expError } = await supabase
        .from('expenses')
        .insert([{
          title: expenseTitle,
          amount: amountNum,
          date: new Date().toISOString().split('T')[0] // تاريخ اليوم
        }]);
      
      if (expError) throw expError;

      // 4. الإغلاق والتحديث
      toast.success(`تمت إضافة ${amountNum} ريال لمحفظة ${selectedCustomer.name} وتم تقييدها كمصروف بنجاح 🎁`);
      setIsBonusModalOpen(false);
      fetchData(); // إعادة جلب البيانات لتحديث الجدول

    } catch (error) {
      console.error('Error adding bonus:', error);
      toast.error(error.message || 'حدث خطأ أثناء تنفيذ العملية');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openBonusModal = (customer) => {
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
      data = data.filter(c =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q)
      );
    }

    data = [...data].sort((a, b) => {
      if (sortBy === "lastOrderDate") {
        return (b.lastOrderDate?.getTime() || 0) - (a.lastOrderDate?.getTime() || 0);
      }
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
          <p className="text-[#4A4A4A]/70 text-sm">قائمة تجمع العملاء مع تحليل مالي دقيق</p>
        </div>
        <Link to="/app/orders" className="text-sm font-bold text-[#4A4A4A]/70 hover:text-[#4A4A4A] flex items-center gap-1">
          <ArrowLeft size={16} /> العودة للطلبات
        </Link>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl p-4 shadow-sm">
          <div className="text-[#4A4A4A]/70 text-xs">العملاء</div>
          <div className="text-2xl font-black text-[#4A4A4A] mt-1">{stats.totalCustomers}</div>
        </div>
        <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl p-4 shadow-sm">
          <div className="text-[#4A4A4A]/70 text-xs flex items-center gap-1"><Crown size={14} className="text-amber-500" /> VIP</div>
          <div className="text-2xl font-black text-[#4A4A4A] mt-1">{stats.vipCustomers}</div>
        </div>
        <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl p-4 shadow-sm">
          <div className="text-[#4A4A4A]/70 text-xs flex items-center gap-1"><Wallet size={14} className="text-violet-600" /> الصافي (محفظة - دين)</div>
          <div className="text-2xl font-black text-[#4A4A4A] mt-1">
            {customersData.reduce((sum, c) => sum + (Number(c.netBalance || 0)), 0).toFixed(1)}
          </div>
        </div>
        <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl p-4 shadow-sm">
          <div className="text-[#4A4A4A]/70 text-xs flex items-center gap-1"><ShoppingBag size={14} className="text-blue-600" /> إجمالي المبيعات</div>
          <div className="text-2xl font-black text-[#4A4A4A] mt-1">
            {customersData.reduce((sum, c) => sum + (Number(c.totalRequired || 0)), 0).toFixed(0)} ر.س
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute right-3 top-3 text-[#4A4A4A]/50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الجوال..."
              className="w-full border border-[#D9A3AA]/20 rounded-xl px-4 py-2 pr-9 outline-none focus:border-[#D9A3AA]"
            />
          </div>

          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-2 rounded-xl text-sm font-bold border ${filter === "all" ? "bg-[#4A4A4A] text-white border-[#4A4A4A]" : "bg-white text-[#4A4A4A]/80 border-[#D9A3AA]/20"}`}
          >
            الكل
          </button>
          <button
            onClick={() => setFilter("vip")}
            className={`px-3 py-2 rounded-xl text-sm font-bold border flex items-center gap-1 ${filter === "vip" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-[#4A4A4A]/80 border-[#D9A3AA]/20"}`}
          >
            <Crown size={14} /> VIP
          </button>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-[#4A4A4A]/70">ترتيب:</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border border-[#D9A3AA]/20 rounded-xl px-3 py-2 text-sm">
            <option value="netBalance">الصافي</option>
            <option value="walletBalance">رصيد المحفظة</option>
            <option value="debt">الدين</option>
            <option value="totalRequired">إجمالي المبيعات</option>
            <option value="totalOrders">عدد الطلبات</option>
            <option value="lastOrderDate">آخر زيارة</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#D9A3AA]/20 rounded-2xl shadow-sm overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-[#F8F5F2] border-b border-[#D9A3AA]/20">
            <tr className="text-xs text-[#4A4A4A]/70">
              <th className="px-6 py-3 text-right">العميل</th>
              <th className="px-6 py-3 text-right">الهاتف</th>
              <th className="px-6 py-3 text-center">الطلبات</th>
              <th className="px-6 py-3 text-right">المبيعات</th>
              <th className="px-6 py-3 text-right">رصيد المحفظة</th>
              <th className="px-6 py-3 text-right">آخر زيارة</th>
              <th className="px-6 py-3 text-right">إجراءات وتواصل</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#D9A3AA]/10">
            {loading ? (
              <tr>
                <td className="p-8 text-center text-[#4A4A4A]/70" colSpan={7}>جاري التحميل...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="p-8 text-center text-[#4A4A4A]/70" colSpan={7}>لا يوجد عملاء</td>
              </tr>
            ) : (
              filtered.map((customer) => (
                <tr key={customer.id} className="hover:bg-[#D9A3AA]/5 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-[#D9A3AA]/10 text-[#D9A3AA] flex items-center justify-center font-black">
                        {(customer.name || "؟").slice(0, 1)}
                      </div>
                      <div>
                        <div className="font-bold text-[#4A4A4A] flex items-center gap-2">
                          {customer.name}
                          {customer.isVip && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <Crown size={12} /> VIP
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#4A4A4A]/50">#{customer.id.slice(0, 8)}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-5 font-mono text-sm text-[#4A4A4A]/80 dir-ltr text-right">
                    {customer.phone || "-"}
                  </td>

                  <td className="px-6 py-5 text-center">
                    <span className="inline-flex items-center gap-1 bg-[#F8F5F2] text-[#4A4A4A]/80 px-3 py-1 rounded-lg text-xs font-bold">
                      <ShoppingBag size={14} /> {customer.orderIds.size}
                    </span>
                  </td>

                  <td className="px-6 py-5">
                    <span className="font-bold text-[#4A4A4A]">{Number(customer.totalRequired || 0).toFixed(0)} ر.س</span>
                  </td>

                  <td className="px-6 py-5">
                    <div className="space-y-1">
                      {customer.netBalance > 0.5 ? (
                        <span className="bg-violet-50 text-violet-700 px-3 py-1 rounded-lg text-xs font-bold flex items-center w-fit gap-1">
                          <Wallet size={12} /> {customer.netBalance.toFixed(1)} ريال
                        </span>
                      ) : customer.netBalance < -0.5 ? (
                        <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-xs font-bold flex items-center w-fit gap-1 dir-ltr">
                          {Math.abs(customer.netBalance).toFixed(1)}- ريال
                        </span>
                      ) : (
                        <span className="text-[#4A4A4A]/30 text-xs font-bold px-2">0.00</span>
                      )}
                      <div className="text-[10px] text-[#4A4A4A]/50">
                        محفظة {Number(customer.walletBalance || 0).toFixed(1)} − دين {Number(customer.debt || 0).toFixed(1)}
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <span className="text-[#4A4A4A]/70 text-sm flex items-center gap-1">
                      <Calendar size={14} className="text-[#4A4A4A]/50" />
                      {customer.lastOrderDate ? customer.lastOrderDate.toLocaleDateString("en-GB") : "-"}
                    </span>
                  </td>

                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      {customer.phone ? (
                        <a
                          href={`https://wa.me/966${String(customer.phone).startsWith("0") ? String(customer.phone).slice(1) : customer.phone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors border border-emerald-100"
                          title="مراسلة واتساب"
                        >
                          <Phone size={16} />
                        </a>
                      ) : (
                        <span className="text-xs text-[#4A4A4A]/50">-</span>
                      )}
                      
                      {/* زر إضافة المكافأة الجديد */}
                      {customer.cleanPhone && (
                        <button 
                          onClick={() => openBonusModal(customer)}
                          className="inline-flex items-center justify-center p-2 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition-colors border border-amber-100"
                          title="إضافة مكافأة إحالة"
                        >
                          <Gift size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- نافذة إضافة المكافأة (Modal) --- */}
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