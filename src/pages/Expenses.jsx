// src/pages/Expenses.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  TrendingDown, Wallet, Plus, Trash2, 
  FileText, Calendar, Edit2, Check, X, Filter, ArrowUpDown, PieChart
} from 'lucide-react';

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

  if (loading) return <div className="p-10 text-center">جاري تحميل سجل المصروفات...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#4A4A4A] text-white rounded-xl"><Wallet size={24}/></div>
        <div>
          <h1 className="text-2xl font-bold text-[#4A4A4A]">سجل المصروفات</h1>
          <p className="text-sm text-[#4A4A4A]/70">إدارة وتتبع التكاليف التشغيلية للمشروع.</p>
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
          <h3 className="text-3xl font-black text-red-600">{stats.total.toLocaleString()} <span className="text-sm font-medium opacity-70">ر.س</span></h3>
        </div>

        {/* 2. مصروفات الشهر الحالي */}
        <div className="bg-white p-6 rounded-2xl border border-[#D9A3AA]/20 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600"><Calendar size={24}/></div>
            <span className="text-xs font-bold bg-[#F8F5F2] text-[#4A4A4A] px-2 py-1 rounded-lg">الشهر الحالي</span>
          </div>
          <p className="text-[#4A4A4A]/70 text-sm mb-1 font-bold">ما تم صرفه هذا الشهر</p>
          <h3 className="text-3xl font-black text-[#4A4A4A]">{stats.currentMonth.toLocaleString()} <span className="text-sm font-medium opacity-50">ر.س</span></h3>
        </div>

        {/* 3. أعلى بند مكلف */}
        <div className="bg-[#4A4A4A] p-6 rounded-2xl border border-[#4A4A4A] shadow-sm text-white relative overflow-hidden">
          <div className="absolute -left-6 -bottom-6 opacity-10"><PieChart size={120}/></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-white/10 rounded-xl text-[#C5A059]"><PieChart size={24}/></div>
            <span className="text-xs font-bold bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30 px-2 py-1 rounded-lg">تنبيه تكاليف</span>
          </div>
          <p className="text-white/70 text-sm mb-1 font-bold">أكثر بند يستنزف الميزانية</p>
          <h3 className="text-xl font-black text-white relative z-10 truncate" title={stats.highestTitle}>{stats.highestTitle}</h3>
          <p className="text-[#D9A3AA] font-bold text-sm mt-1">{stats.highestAmount.toLocaleString()} ر.س</p>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-6">
        
        {/* نموذج الإضافة */}
        <div className="md:col-span-4 h-fit">
          <div className="bg-white p-6 rounded-2xl border border-[#D9A3AA]/20 shadow-sm sticky top-6">
            <h3 className="font-bold text-[#4A4A4A] mb-4 flex items-center gap-2">
              <Plus className="text-[#C5A059]"/> تسجيل مصروف جديد
            </h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#4A4A4A]/70 block mb-1">تاريخ المصروف</label>
                <input 
                  type="date" 
                  className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl px-4 py-3 outline-none focus:border-[#D9A3AA]"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#4A4A4A]/70 block mb-1">بيان المصروف</label>
                <input 
                  type="text" 
                  list="expense-titles" 
                  placeholder="مثلاً: حبر طابعة، إيجار..." 
                  className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl px-4 py-3 outline-none focus:border-[#D9A3AA]"
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
                <label className="text-xs font-bold text-[#4A4A4A]/70 block mb-1">المبلغ (ر.س)</label>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl px-4 py-3 outline-none focus:border-[#D9A3AA] font-bold text-[#4A4A4A]"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                />
              </div>
              <button type="submit" className="w-full bg-[#4A4A4A] text-white py-3 rounded-xl font-bold hover:bg-[#3F3F3F] flex justify-center items-center gap-2">
                تسجيل المصروف
              </button>
            </form>
          </div>
        </div>

        {/* السجل والقائمة */}
        <div className="md:col-span-8">
          <div className="bg-white rounded-2xl border border-[#D9A3AA]/20 shadow-sm overflow-hidden">
            
            {/* شريط الأدوات والفرز */}
            <div className="p-4 border-b border-[#D9A3AA]/10 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[#4A4A4A] flex items-center gap-2"><FileText className="text-[#D9A3AA]" size={20}/> القائمة المفصلة</h3>
                <span className="text-xs text-[#4A4A4A]/55 font-mono bg-[#F8F5F2] px-2 py-1 rounded">{expenses.length} عملية</span>
              </div>
              
              <div className="flex items-center gap-2 bg-[#F8F5F2] p-1 rounded-xl">
                <button 
                  onClick={() => setSortBy('date')} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${sortBy === 'date' ? 'bg-white shadow text-[#4A4A4A]' : 'text-[#4A4A4A]/70 hover:text-[#4A4A4A]/80'}`}
                >
                  <Calendar size={12}/> التاريخ
                </button>
                <button 
                  onClick={() => setSortBy('amount')} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${sortBy === 'amount' ? 'bg-white shadow text-[#4A4A4A]' : 'text-[#4A4A4A]/70 hover:text-[#4A4A4A]/80'}`}
                >
                  <ArrowUpDown size={12}/> المبلغ
                </button>
                <button 
                  onClick={() => setSortBy('title')} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${sortBy === 'title' ? 'bg-white shadow text-[#4A4A4A]' : 'text-[#4A4A4A]/70 hover:text-[#4A4A4A]/80'}`}
                >
                  <Filter size={12}/> الاسم
                </button>
              </div>
            </div>
            
            <div className="divide-y divide-[#D9A3AA]/10 max-h-[600px] overflow-y-auto custom-scrollbar">
              {sortedExpenses.length === 0 ? (
                <div className="p-10 text-center text-[#4A4A4A]/55">لا توجد مصروفات مسجلة</div>
              ) : (
                sortedExpenses.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-[#F8F5F2] transition-colors group">
                    
                    {/* وضع التعديل */}
                    {editingId === item.id ? (
                      <div className="flex flex-col sm:flex-row gap-3 items-center w-full animate-in fade-in">
                        <input 
                          type="date" 
                          value={editFormData.date} 
                          onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                          className="w-full sm:w-32 bg-white border border-[#D9A3AA]/40 rounded-lg px-2 py-1.5 text-sm outline-none"
                        />
                        <input 
                          type="text" 
                          value={editFormData.title} 
                          list="expense-titles" 
                          onChange={(e) => setEditFormData({...editFormData, title: e.target.value})}
                          className="flex-1 w-full bg-white border border-[#D9A3AA]/40 rounded-lg px-2 py-1.5 text-sm outline-none text-[#4A4A4A]"
                          placeholder="البيان"
                        />
                        <input 
                          type="number" 
                          value={editFormData.amount} 
                          onChange={(e) => setEditFormData({...editFormData, amount: e.target.value})}
                          className="w-full sm:w-24 bg-white border border-[#D9A3AA]/40 rounded-lg px-2 py-1.5 text-sm font-bold text-left outline-none text-[#4A4A4A]"
                          placeholder="المبلغ"
                        />
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(item.id)} className="p-2 bg-[#D9A3AA] text-white rounded-lg hover:bg-[#C5A059]"><Check size={16}/></button>
                          <button onClick={cancelEdit} className="p-2 bg-[#F8F5F2] text-[#4A4A4A]/75 rounded-lg hover:bg-white/80"><X size={16}/></button>
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
                            <p className="font-bold text-[#4A4A4A]">{item.title}</p>
                            <p className="text-xs text-[#4A4A4A]/55 flex items-center gap-1 font-mono">
                              <Calendar size={10}/> {new Date(item.date || item.created_at).toLocaleDateString('en-GB')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-lg text-red-500">-{item.amount}</span>
                          
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => startEdit(item)}
                              className="p-2 text-[#4A4A4A]/55 hover:text-[#D9A3AA] hover:bg-[#D9A3AA]/10 rounded-lg transition-colors"
                              title="تعديل"
                            >
                              <Edit2 size={16}/>
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-[#4A4A4A]/55 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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