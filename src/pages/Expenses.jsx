// src/pages/Expenses.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  TrendingUp, TrendingDown, Wallet, Plus, Trash2, 
  DollarSign, FileText, Calendar, Edit2, Check, X, Filter, ArrowUpDown 
} from 'lucide-react';

export default function Expenses() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState({ totalSales: 0, totalExpenses: 0, netProfit: 0 });
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
      
      // 1. جلب المصروفات
      const { data: expensesData, error: expError } = await supabase
        .from('expenses')
        .select('*');
        
      if (expError) throw expError;

      // 2. جلب إجمالي المبيعات
      const { data: ordersData, error: ordError } = await supabase
        .from('orders')
        .select('total_amount');

      if (ordError) throw ordError;

      const totalExp = expensesData.reduce((sum, item) => sum + Number(item.amount), 0);
      const totalSale = ordersData.reduce((sum, item) => sum + Number(item.total_amount), 0);

      setExpenses(expensesData || []);
      setStats({
        totalSales: totalSale,
        totalExpenses: totalExp,
        netProfit: totalSale - totalExp
      });

    } catch (err) {
      toast.error('حدث خطأ في جلب البيانات');
    } finally {
      setLoading(false);
    }
  }

  // --- استخراج الأصناف المحفوظة مسبقاً للاقتراحات ---
  // هذه القائمة تتحدث تلقائياً بناءً على ما قمت بإدخاله سابقاً
  const savedTitles = useMemo(() => {
    const titles = expenses.map(e => e.title);
    return [...new Set(titles)]; // حذف التكرار
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
      setExpenses([data, ...expenses]); // تحديث محلي سريع
      
      // تحديث الإحصائيات محلياً
      setStats(prev => ({
        ...prev,
        totalExpenses: prev.totalExpenses + Number(newExpense.amount),
        netProfit: prev.netProfit - Number(newExpense.amount)
      }));

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
      // التأكد من تنسيق التاريخ الصحيح للinput
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

      // تحديث القائمة محلياً
      const updatedExpenses = expenses.map(item => 
        item.id === id ? { ...item, ...editFormData, amount: Number(editFormData.amount) } : item
      );
      setExpenses(updatedExpenses);
      
      // إعادة حساب الإجمالي محلياً
      const newTotalExp = updatedExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
      setStats(prev => ({
        ...prev,
        totalExpenses: newTotalExp,
        netProfit: prev.totalSales - newTotalExp
      }));

      setEditingId(null);
      toast.success('تم التعديل بنجاح');
    } catch (err) {
      toast.error('فشل حفظ التعديل');
    }
  };

  const handleDelete = async (id, amount) => {
    if(!window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    try {
      await supabase.from('expenses').delete().eq('id', id);
      
      const updatedExpenses = expenses.filter(e => e.id !== id);
      setExpenses(updatedExpenses);
      
      setStats(prev => ({
        ...prev,
        totalExpenses: prev.totalExpenses - amount,
        netProfit: prev.netProfit + amount
      }));
      
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
      sorted.sort((a, b) => b.amount - a.amount); // الأغلى أولاً
    } else if (sortBy === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    }
    return sorted;
  }, [expenses, sortBy]);

  if (loading) return <div className="p-10 text-center">جاري حساب الأرباح...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#4A4A4A] text-white rounded-xl"><Wallet size={24}/></div>
        <div>
          <h1 className="text-2xl font-bold text-[#4A4A4A]">التقارير المالية</h1>
          <p className="text-sm text-[#4A4A4A]/70">متابعة الأرباح والمصروفات.</p>
        </div>
      </div>

      {/* الملخص المالي */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-[#D9A3AA]/20 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-[#C5A059]/10 rounded-xl text-[#C5A059]"><TrendingUp size={24}/></div>
            <span className="text-xs font-bold bg-[#C5A059]/15 text-[#C5A059] px-2 py-1 rounded-lg">دخل</span>
          </div>
          <p className="text-[#4A4A4A]/70 text-sm mb-1">إجمالي المبيعات</p>
          <h3 className="text-3xl font-black text-[#4A4A4A]">{stats.totalSales.toLocaleString()} <span className="text-sm font-medium text-[#4A4A4A]/55">ر.س</span></h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#D9A3AA]/20 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-50 rounded-xl text-red-600"><TrendingDown size={24}/></div>
            <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded-lg">خروج</span>
          </div>
          <p className="text-[#4A4A4A]/70 text-sm mb-1">إجمالي المصروفات</p>
          <h3 className="text-3xl font-black text-[#4A4A4A]">{stats.totalExpenses.toLocaleString()} <span className="text-sm font-medium text-[#4A4A4A]/55">ر.س</span></h3>
        </div>

        <div className={`p-6 rounded-2xl border shadow-sm text-white ${stats.netProfit >= 0 ? 'bg-[#4A4A4A] border-white/10' : 'bg-red-600 border-red-700'}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/10 rounded-xl"><DollarSign size={24} className="text-[#C5A059]"/></div>
            <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-lg">الصافي</span>
          </div>
          <p className="text-white/70 text-sm mb-1">صافي الربح الفعلي</p>
          <h3 className="text-3xl font-black">{stats.netProfit.toLocaleString()} <span className="text-sm font-medium opacity-60">ر.س</span></h3>
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
                  list="expense-titles" // ربط بالقائمة المقترحة
                  placeholder="مثلاً: حبر طابعة، إيجار..." 
                  className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl px-4 py-3 outline-none focus:border-[#D9A3AA]"
                  value={newExpense.title}
                  onChange={(e) => setNewExpense({...newExpense, title: e.target.value})}
                />
                {/* قائمة الاقتراحات الذكية */}
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
                  className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl px-4 py-3 outline-none focus:border-[#D9A3AA] font-bold"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                />
              </div>
              <button type="submit" className="w-full bg-[#4A4A4A] text-white py-3 rounded-xl font-bold hover:bg-[#3F3F3F] flex justify-center items-center gap-2">
                تسجيل
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
                <h3 className="font-bold text-[#4A4A4A] flex items-center gap-2"><FileText className="text-[#D9A3AA]" size={20}/> سجل المصروفات</h3>
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
            
            <div className="divide-y divide-[#D9A3AA]/10">
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
                          list="expense-titles" // استخدام نفس قائمة الاقتراحات
                          onChange={(e) => setEditFormData({...editFormData, title: e.target.value})}
                          className="flex-1 w-full bg-white border border-[#D9A3AA]/40 rounded-lg px-2 py-1.5 text-sm outline-none"
                          placeholder="البيان"
                        />
                        <input 
                          type="number" 
                          value={editFormData.amount} 
                          onChange={(e) => setEditFormData({...editFormData, amount: e.target.value})}
                          className="w-full sm:w-24 bg-white border border-[#D9A3AA]/40 rounded-lg px-2 py-1.5 text-sm font-bold text-left outline-none"
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
                          <span className="font-bold text-lg text-[#4A4A4A]">-{item.amount}</span>
                          
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => startEdit(item)}
                              className="p-2 text-[#4A4A4A]/55 hover:text-[#D9A3AA] hover:bg-[#D9A3AA]/10 rounded-lg transition-colors"
                              title="تعديل"
                            >
                              <Edit2 size={16}/>
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id, item.amount)}
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