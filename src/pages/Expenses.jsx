// src/pages/Expenses.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import {
  TrendingDown, Wallet, Plus, Trash2,
  FileText, Calendar, Edit2, Check, X, Filter, ArrowUpDown, PieChart
} from 'lucide-react';
import RiyalSign from '../components/RiyalSign';

export default function Expenses() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'amount' | 'title'
  
  // حالة المصروف الجديد
  const [newExpense, setNewExpense] = useState({ 
    title: '', 
    amount: '', 
    date: new Date().toISOString().split('T')[0] 
  });

  // حالات التعديل
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({ title: '', amount: '', date: '' });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      // جلب المصروفات فقط (حذفنا جلب الطلبات لتسريع الصفحة)
      const { data: expensesData, error: expError } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });
        
      if (expError) throw expError;
      setExpenses(expensesData || []);
    } catch (err) {
      toast.error('حدث خطأ في جلب البيانات');
    } finally {
      setLoading(false);
    }
  }

  // --- حساب إحصائيات المصروفات ديناميكياً ---
  const stats = useMemo(() => {
    let total = 0;
    let currentMonth = 0;
    const categoryMap = {};

    const currentMonthPrefix = new Date().toISOString().substring(0, 7); // يمثل "YYYY-MM"

    expenses.forEach(exp => {
      const amt = Number(exp.amount) || 0;
      total += amt;

      // حساب مصروفات الشهر الحالي
      const expDate = exp.date || exp.created_at;
      if (expDate && expDate.startsWith(currentMonthPrefix)) {
        currentMonth += amt;
      }

      // تجميع المصروفات لمعرفة أكثر بند مكلف
      const title = exp.title ? exp.title.trim() : 'غير مصنف';
      categoryMap[title] = (categoryMap[title] || 0) + amt;
    });

    // استخراج أعلى بند
    let highestTitle = 'لا يوجد';
    let highestAmount = 0;
    Object.entries(categoryMap).forEach(([title, amt]) => {
      if (amt > highestAmount) {
        highestAmount = amt;
        highestTitle = title;
      }
    });

    return { total, currentMonth, highestTitle, highestAmount };
  }, [expenses]);

  // --- استخراج الأصناف المحفوظة مسبقاً للاقتراحات ---
  const savedTitles = useMemo(() => {
    const titles = expenses.map(e => e.title?.trim()).filter(Boolean);
    return [...new Set(titles)]; 
  }, [expenses]);

  // --- دوال الإضافة ---
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.title || !newExpense.amount || !newExpense.date) return;

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert([{ 
          title: newExpense.title, 
          amount: Number(newExpense.amount),
          date: newExpense.date 
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('تم تسجيل المصروف');
      setExpenses([data, ...expenses]); 
      setNewExpense({ title: '', amount: '', date: new Date().toISOString().split('T')[0] });
    } catch (err) {
      toast.error('فشل الإضافة');
    }
  };

  // --- دوال التعديل ---
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditFormData({ 
      title: item.title, 
      amount: item.amount, 
      date: item.date || item.created_at.split('T')[0]
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFormData({ title: '', amount: '', date: '' });
  };

  const saveEdit = async (id) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          title: editFormData.title,
          amount: Number(editFormData.amount),
          date: editFormData.date
        })
        .eq('id', id);

      if (error) throw error;

      const updatedExpenses = expenses.map(item => 
        item.id === id ? { ...item, ...editFormData, amount: Number(editFormData.amount) } : item
      );
      setExpenses(updatedExpenses);
      setEditingId(null);
      toast.success('تم التعديل بنجاح');
    } catch (err) {
      toast.error('فشل حفظ التعديل');
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    try {
      await supabase.from('expenses').delete().eq('id', id);
      setExpenses(expenses.filter(e => e.id !== id));
      toast.success('تم الحذف');
    } catch {
      toast.error('فشل الحذف');
    }
  };

  // --- ترتيب القائمة ---
  const sortedExpenses = useMemo(() => {
    let sorted = [...expenses];
    if (sortBy === 'date') {
      sorted.sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
    } else if (sortBy === 'amount') {
      sorted.sort((a, b) => b.amount - a.amount); 
    } else if (sortBy === 'title') {
      sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }
    return sorted;
  }, [expenses, sortBy]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32">
      <div className="w-9 h-9 border-4 border-[#E8B4BC]/20 border-t-[#E8B4BC] rounded-full animate-spin mb-4"></div>
      <p className="text-sm text-[#171717]/50 font-medium">جاري تحميل سجل المصروفات...</p>
    </div>
  );

  return (
    <div className="w-full space-y-8 pb-10 text-[#171717]">

      <div className="flex items-center gap-3 pt-1">
        <div className="p-3 bg-[#171717] text-white rounded-xl shadow-lg shadow-[#171717]/20">
          <Wallet size={22}/>
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#171717] tracking-tight">سجل المصروفات</h1>
          <p className="text-sm text-[#171717]/50">إدارة وتتبع التكاليف التشغيلية للمشروع</p>
        </div>
      </div>

      {/* --- البطاقات التحليلية الجديدة --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 1. إجمالي المصروفات (طوال الوقت) */}
        <div className="bg-red-50 p-6 rounded-2xl border border-red-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-red-400"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-100 rounded-xl text-red-600"><TrendingDown size={24}/></div>
            <span className="text-xs font-bold bg-red-200 text-red-800 px-2 py-1 rounded-lg">طوال الوقت</span>
          </div>
          <p className="text-red-900/70 text-sm mb-1 font-bold">إجمالي المصروفات التراكمي</p>
          <h3 className="text-3xl font-black text-red-600">{stats.total.toLocaleString()} <RiyalSign size="0.7em" /></h3>
        </div>

        {/* 2. مصروفات الشهر الحالي */}
        <div className="bg-white p-6 rounded-2xl border border-[#E8B4BC]/20 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600"><Calendar size={24}/></div>
            <span className="text-xs font-bold bg-[#FAF9F7] text-[#171717] px-2 py-1 rounded-lg">الشهر الحالي</span>
          </div>
          <p className="text-[#171717]/70 text-sm mb-1 font-bold">ما تم صرفه هذا الشهر</p>
          <h3 className="text-3xl font-black text-[#171717]">{stats.currentMonth.toLocaleString()} <RiyalSign size="0.7em" /></h3>
        </div>

        {/* 3. أعلى بند مكلف */}
        <div className="bg-[#171717] p-6 rounded-2xl border border-[#171717] shadow-sm text-white relative overflow-hidden">
          <div className="absolute -left-6 -bottom-6 opacity-10"><PieChart size={120}/></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-white/10 rounded-xl text-[#C6A56B]"><PieChart size={24}/></div>
            <span className="text-xs font-bold bg-[#C6A56B]/20 text-[#C6A56B] border border-[#C6A56B]/30 px-2 py-1 rounded-lg">تنبيه تكاليف</span>
          </div>
          <p className="text-white/70 text-sm mb-1 font-bold">أكثر بند يستنزف الميزانية</p>
          <h3 className="text-xl font-black text-white relative z-10 truncate" title={stats.highestTitle}>{stats.highestTitle}</h3>
          <p className="text-[#E8B4BC] font-bold text-sm mt-1">{stats.highestAmount.toLocaleString()} <RiyalSign /></p>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-6">
        
        {/* نموذج الإضافة */}
        <div className="md:col-span-4 h-fit">
          <div className="bg-white p-6 rounded-2xl border border-[#E8B4BC]/20 shadow-sm sticky top-6">
            <h3 className="font-bold text-[#171717] mb-4 flex items-center gap-2">
              <Plus className="text-[#C6A56B]"/> تسجيل مصروف جديد
            </h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#171717]/70 block mb-1">تاريخ المصروف</label>
                <input 
                  type="date" 
                  className="w-full bg-[#FAF9F7] border border-[#E8B4BC]/20 rounded-xl px-4 py-3 outline-none focus:border-[#E8B4BC]"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#171717]/70 block mb-1">بيان المصروف</label>
                <input 
                  type="text" 
                  list="expense-titles" 
                  placeholder="مثلاً: حبر طابعة، إيجار..." 
                  className="w-full bg-[#FAF9F7] border border-[#E8B4BC]/20 rounded-xl px-4 py-3 outline-none focus:border-[#E8B4BC]"
                  value={newExpense.title}
                  onChange={(e) => setNewExpense({...newExpense, title: e.target.value})}
                />
                <datalist id="expense-titles">
                  {savedTitles.map((title, index) => (
                    <option key={index} value={title} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-bold text-[#171717]/70 block mb-1">المبلغ (<RiyalSign />)</label>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  className="w-full bg-[#FAF9F7] border border-[#E8B4BC]/20 rounded-xl px-4 py-3 outline-none focus:border-[#E8B4BC] font-bold text-[#171717]"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                />
              </div>
              <button type="submit" className="w-full bg-[#171717] text-white py-3 rounded-xl font-bold hover:bg-[#3F3F3F] flex justify-center items-center gap-2">
                تسجيل المصروف
              </button>
            </form>
          </div>
        </div>

        {/* السجل والقائمة */}
        <div className="md:col-span-8">
          <div className="bg-white rounded-2xl border border-[#E8B4BC]/20 shadow-sm overflow-hidden">
            
            {/* شريط الأدوات والفرز */}
            <div className="p-4 border-b border-[#E8B4BC]/10 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[#171717] flex items-center gap-2"><FileText className="text-[#E8B4BC]" size={20}/> القائمة المفصلة</h3>
                <span className="text-xs text-[#171717]/55 font-mono bg-[#FAF9F7] px-2 py-1 rounded">{expenses.length} عملية</span>
              </div>
              
              <div className="flex items-center gap-2 bg-[#FAF9F7] p-1 rounded-xl">
                <button 
                  onClick={() => setSortBy('date')} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${sortBy === 'date' ? 'bg-white shadow text-[#171717]' : 'text-[#171717]/70 hover:text-[#171717]/80'}`}
                >
                  <Calendar size={12}/> التاريخ
                </button>
                <button 
                  onClick={() => setSortBy('amount')} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${sortBy === 'amount' ? 'bg-white shadow text-[#171717]' : 'text-[#171717]/70 hover:text-[#171717]/80'}`}
                >
                  <ArrowUpDown size={12}/> المبلغ
                </button>
                <button 
                  onClick={() => setSortBy('title')} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${sortBy === 'title' ? 'bg-white shadow text-[#171717]' : 'text-[#171717]/70 hover:text-[#171717]/80'}`}
                >
                  <Filter size={12}/> الاسم
                </button>
              </div>
            </div>
            
            <div className="divide-y divide-[#E8B4BC]/10 max-h-[600px] overflow-y-auto custom-scrollbar">
              {sortedExpenses.length === 0 ? (
                <div className="p-10 text-center text-[#171717]/55">لا توجد مصروفات مسجلة</div>
              ) : (
                sortedExpenses.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-[#FAF9F7] transition-colors group">
                    
                    {/* وضع التعديل */}
                    {editingId === item.id ? (
                      <div className="flex flex-col sm:flex-row gap-3 items-center w-full animate-in fade-in">
                        <input 
                          type="date" 
                          value={editFormData.date} 
                          onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                          className="w-full sm:w-32 bg-white border border-[#E8B4BC]/40 rounded-lg px-2 py-1.5 text-sm outline-none"
                        />
                        <input 
                          type="text" 
                          value={editFormData.title} 
                          list="expense-titles" 
                          onChange={(e) => setEditFormData({...editFormData, title: e.target.value})}
                          className="flex-1 w-full bg-white border border-[#E8B4BC]/40 rounded-lg px-2 py-1.5 text-sm outline-none text-[#171717]"
                          placeholder="البيان"
                        />
                        <input 
                          type="number" 
                          value={editFormData.amount} 
                          onChange={(e) => setEditFormData({...editFormData, amount: e.target.value})}
                          className="w-full sm:w-24 bg-white border border-[#E8B4BC]/40 rounded-lg px-2 py-1.5 text-sm font-bold text-left outline-none text-[#171717]"
                          placeholder="المبلغ"
                        />
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(item.id)} className="p-2 bg-[#E8B4BC] text-white rounded-lg hover:bg-[#C6A56B]"><Check size={16}/></button>
                          <button onClick={cancelEdit} className="p-2 bg-[#FAF9F7] text-[#171717]/75 rounded-lg hover:bg-white/80"><X size={16}/></button>
                        </div>
                      </div>
                    ) : (
                      /* وضع العرض العادي */
                      <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                            <TrendingDown size={18}/>
                          </div>
                          <div>
                            <p className="font-bold text-[#171717]">{item.title}</p>
                            <p className="text-xs text-[#171717]/55 flex items-center gap-1 font-mono">
                              <Calendar size={10}/> {new Date(item.date || item.created_at).toLocaleDateString('en-GB')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-lg text-red-500">-{item.amount}</span>
                          
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => startEdit(item)}
                              className="p-2 text-[#171717]/55 hover:text-[#E8B4BC] hover:bg-[#E8B4BC]/10 rounded-lg transition-colors"
                              title="تعديل"
                            >
                              <Edit2 size={16}/>
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-[#171717]/55 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}