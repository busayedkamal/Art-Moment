// src/pages/Expenses.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  TrendingUp, TrendingDown, Wallet, Plus, Trash2, 
  DollarSign, FileText, Calendar 
} from 'lucide-react';

export default function Expenses() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState({ totalSales: 0, totalExpenses: 0, netProfit: 0 });
  
  // حالة المصروف الجديد
  const [newExpense, setNewExpense] = useState({ title: '', amount: '' });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      
      // 1. جلب المصروفات
      const { data: expensesData, error: expError } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (expError) throw expError;

      // 2. جلب إجمالي المبيعات (من الطلبات المكتملة أو المدفوعة)
      // ملاحظة: هنا نجمع كل الطلبات، يمكنك فلترتها حسب الشهر لاحقاً
      const { data: ordersData, error: ordError } = await supabase
        .from('orders')
        .select('total_amount');

      if (ordError) throw ordError;

      // الحسابات
      const totalExp = expensesData.reduce((sum, item) => sum + Number(item.amount), 0);
      const totalSale = ordersData.reduce((sum, item) => sum + Number(item.total_amount), 0);

      setExpenses(expensesData);
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

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.title || !newExpense.amount) return;

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert([{ title: newExpense.title, amount: Number(newExpense.amount) }])
        .select()
        .single();

      if (error) throw error;

      toast.success('تم تسجيل المصروف');
      setNewExpense({ title: '', amount: '' });
      fetchData(); // تحديث الأرقام
    } catch (err) {
      toast.error('فشل الإضافة');
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    await supabase.from('expenses').delete().eq('id', id);
    fetchData();
    toast.success('تم الحذف');
  };

  if (loading) return <div className="p-10 text-center">جاري حساب الأرباح...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      
      <div className="flex items-center gap-3">
        <div className="p-3 bg-slate-900 text-white rounded-xl"><Wallet size={24}/></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">التقارير المالية</h1>
          <p className="text-sm text-slate-500">متابعة الأرباح والمصروفات.</p>
        </div>
      </div>

      {/* 1. بطاقات الملخص المالي */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* المبيعات */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600"><TrendingUp size={24}/></div>
            <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg">دخل</span>
          </div>
          <p className="text-slate-500 text-sm mb-1">إجمالي المبيعات</p>
          <h3 className="text-3xl font-black text-slate-900">{stats.totalSales.toFixed(2)} <span className="text-sm font-medium text-slate-400">ر.س</span></h3>
        </div>

        {/* المصروفات */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-50 rounded-xl text-red-600"><TrendingDown size={24}/></div>
            <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded-lg">خروج</span>
          </div>
          <p className="text-slate-500 text-sm mb-1">إجمالي المصروفات</p>
          <h3 className="text-3xl font-black text-slate-900">{stats.totalExpenses.toFixed(2)} <span className="text-sm font-medium text-slate-400">ر.س</span></h3>
        </div>

        {/* صافي الربح */}
        <div className={`p-6 rounded-2xl border shadow-sm text-white ${stats.netProfit >= 0 ? 'bg-slate-900 border-slate-800' : 'bg-red-600 border-red-700'}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/10 rounded-xl"><DollarSign size={24}/></div>
            <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-lg">الصافي</span>
          </div>
          <p className="text-slate-300 text-sm mb-1">صافي الربح الفعلي</p>
          <h3 className="text-3xl font-black">{stats.netProfit.toFixed(2)} <span className="text-sm font-medium opacity-60">ر.س</span></h3>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-6">
        
        {/* 2. نموذج إضافة مصروف */}
        <div className="md:col-span-4 h-fit">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="text-orange-500"/> تسجيل مصروف جديد
            </h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">بيان المصروف</label>
                <input 
                  type="text" 
                  placeholder="مثلاً: حبر طابعة، ورق A4، صيانة..." 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-orange-500"
                  value={newExpense.title}
                  onChange={(e) => setNewExpense({...newExpense, title: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">المبلغ (ر.س)</label>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-orange-500 font-bold"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                />
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 flex justify-center items-center gap-2">
                تسجيل
              </button>
            </form>
          </div>
        </div>

        {/* 3. سجل المصروفات */}
        <div className="md:col-span-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText className="text-blue-500"/> سجل المصروفات</h3>
              <span className="text-xs text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded">{expenses.length} عملية</span>
            </div>
            
            <div className="divide-y divide-slate-50">
              {expenses.length === 0 ? (
                <div className="p-10 text-center text-slate-400">لا توجد مصروفات مسجلة</div>
              ) : (
                expenses.map((item) => (
                  <div key={item.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                        <TrendingDown size={18}/>
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{item.title}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar size={10}/> {new Date(item.created_at).toLocaleDateString('ar-EG')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-lg text-slate-900">-{item.amount}</span>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
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