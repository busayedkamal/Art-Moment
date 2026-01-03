// src/pages/OrderDetails.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  ArrowRight, Printer, CheckCircle, Truck, Trash2, 
  Banknote, Calendar, Phone, FileText, User, 
  MessageCircle, Save, Edit3, X 
} from 'lucide-react';

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // تخزين أسعار الطباعة للحساب
  const [prices, setPrices] = useState({ a4: 0, photo4x6: 0 });

  // --- حالات التعديل ---
  // 1. المالية
  const [deposit, setDeposit] = useState(0);
  const [isEditingDeposit, setIsEditingDeposit] = useState(false);
  
  // 2. الملاحظات
  const [notes, setNotes] = useState('');

  // 3. بيانات العميل
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [customerData, setCustomerData] = useState({
    phone: '',
    delivery_date: '',
    created_at: ''
  });

  // 4. تفاصيل الإنتاج
  const [isEditingProduction, setIsEditingProduction] = useState(false);
  const [productionData, setProductionData] = useState({
    a4_qty: 0,
    photo_4x6_qty: 0
  });

  // جلب البيانات
  useEffect(() => {
    fetchOrderAndSettings();
  }, [id]);

  async function fetchOrderAndSettings() {
    try {
      // 1. جلب بيانات الطلب
      const { data: orderData, error: orderError } = await supabase.from('orders').select('*').eq('id', id).single();
      if (orderError) throw orderError;

      // 2. جلب إعدادات الأسعار الحالية (لإعادة الحساب عند التعديل)
      const { data: settingsData, error: settingsError } = await supabase.from('settings').select('*').eq('id', 1).single();
      
      // تعيين البيانات
      setOrder(orderData);
      setDeposit(orderData.deposit);
      setNotes(orderData.notes || '');
      
      if (settingsData) {
        setPrices({
          a4: Number(settingsData.a4_price),
          photo4x6: Number(settingsData.photo_4x6_price)
        });
      }

      // تهيئة بيانات العميل
      setCustomerData({
        phone: orderData.phone || '',
        delivery_date: orderData.delivery_date || '',
        created_at: orderData.created_at ? new Date(orderData.created_at).toISOString().slice(0, 10) : ''
      });

      // تهيئة بيانات الإنتاج
      setProductionData({
        a4_qty: orderData.a4_qty || 0,
        photo_4x6_qty: orderData.photo_4x6_qty || 0
      });

    } catch (err) {
      toast.error('لم يتم العثور على الطلب');
      navigate('/app/orders');
    } finally {
      setLoading(false);
    }
  }

  // --- تحديث الحالة (Status) ---
  const updateStatus = async (newStatus) => {
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      setOrder({ ...order, status: newStatus });
      toast.success(`تم تغيير الحالة إلى: ${getStatusLabel(newStatus)}`);
    } catch (err) { toast.error('فشل تحديث الحالة'); }
  };

  // --- حفظ بيانات العميل ---
  const handleSaveCustomerData = async () => {
    try {
      const updatedData = {
        phone: customerData.phone,
        delivery_date: customerData.delivery_date,
        created_at: new Date(customerData.created_at).toISOString() 
      };

      const { error } = await supabase.from('orders').update(updatedData).eq('id', id);
      if (error) throw error;

      setOrder({ ...order, ...updatedData });
      setIsEditingCustomer(false);
      toast.success('تم تحديث بيانات العميل');
    } catch (err) { toast.error('فشل حفظ التعديلات'); }
  };

  // --- حفظ تفاصيل الإنتاج (مع إعادة حساب السعر) ---
  const handleSaveProduction = async () => {
    try {
      const newA4Qty = Number(productionData.a4_qty);
      const new4x6Qty = Number(productionData.photo_4x6_qty);

      // 1. حساب المبالغ الجديدة
      const newSubtotal = (newA4Qty * prices.a4) + (new4x6Qty * prices.photo4x6);
      const newTotal = newSubtotal + Number(order.delivery_fee || 0); // نضيف سعر التوصيل الموجود مسبقاً

      const updatedData = {
        a4_qty: newA4Qty,
        photo_4x6_qty: new4x6Qty,
        subtotal: newSubtotal,     // تحديث المجموع الفرعي
        total_amount: newTotal     // تحديث الإجمالي
      };

      // 2. التحديث في قاعدة البيانات
      const { error } = await supabase.from('orders').update(updatedData).eq('id', id);
      if (error) throw error;

      // 3. تحديث الواجهة
      setOrder({ ...order, ...updatedData });
      setIsEditingProduction(false);
      
      toast.success(`تم تحديث الكميات والسعر الإجمالي (${newTotal} ريال)`);
    } catch (err) { 
      console.error(err);
      toast.error('فشل تحديث الكميات'); 
    }
  };

  // --- تحديث المالية ---
  const handleUpdateDeposit = async () => {
    const newDeposit = Number(deposit);
    const isPaid = newDeposit >= order.total_amount;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ deposit: newDeposit, payment_status: isPaid ? 'paid' : 'unpaid' })
        .eq('id', id);
      if (error) throw error;
      setOrder({ ...order, deposit: newDeposit, payment_status: isPaid ? 'paid' : 'unpaid' });
      setIsEditingDeposit(false);
      toast.success('تم تحديث المبلغ');
    } catch (err) { toast.error('فشل العملية'); }
  };

  const markAsFullyPaid = () => {
    saveDirectDeposit(order.total_amount);
  };

  const saveDirectDeposit = async (amount) => {
    try {
      await supabase.from('orders').update({ deposit: amount, payment_status: 'paid' }).eq('id', id);
      setOrder({ ...order, deposit: amount, payment_status: 'paid' });
      setDeposit(amount);
      toast.success('تم تسديد كامل المبلغ ✅');
    } catch (err) { toast.error('فشل العملية'); }
  };

  const saveNotes = async () => {
    try {
      await supabase.from('orders').update({ notes }).eq('id', id);
      setOrder({ ...order, notes });
      toast.success('تم حفظ الملاحظات');
    } catch (err) { toast.error('فشل حفظ الملاحظات'); }
  };

  // --- طباعة الفاتورة ---
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) return toast.error('اسمح بالنوافذ المنبثقة');

    const remaining = (order.total_amount - deposit).toFixed(2);
    const invoiceContent = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <title>فاتورة #${order.id.slice(0, 6)}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; text-align: right; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border-bottom: 1px solid #ddd; padding: 8px; }
          .total { font-size: 20px; font-weight: bold; background: #f0f0f0; padding: 10px; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header"><h1>Art Moment</h1><p>فاتورة مبيعات</p></div>
        <p><strong>العميل:</strong> ${order.customer_name} | ${order.phone}</p>
        <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
        <table>
          <thead><tr><th>الوصف</th><th>الكمية</th><th>السعر</th></tr></thead>
          <tbody>
            ${order.a4_qty > 0 ? `<tr><td>طباعة A4</td><td>${order.a4_qty}</td><td>-</td></tr>` : ''}
            ${order.photo_4x6_qty > 0 ? `<tr><td>طباعة 4×6</td><td>${order.photo_4x6_qty}</td><td>-</td></tr>` : ''}
            ${order.delivery_fee > 0 ? `<tr><td>توصيل</td><td>-</td><td>${order.delivery_fee}</td></tr>` : ''}
          </tbody>
        </table>
        <div class="total">الإجمالي: ${order.total_amount}<br>المدفوع: ${deposit}<br>المتبقي: ${remaining}</div>
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body></html>`;
    printWindow.document.write(invoiceContent);
    printWindow.document.close();
  };

  const handleDelete = async () => {
    if (!window.confirm('حذف نهائي؟')) return;
    await supabase.from('orders').delete().eq('id', id);
    navigate('/app/orders');
  };

  const getStatusLabel = (s) => ({ new: 'جديد', printing: 'قيد الطباعة', done: 'جاهز', delivered: 'تم التسليم' }[s] || s);
  
  const steps = [
    { key: 'new', label: 'طلب جديد', icon: FileText },
    { key: 'printing', label: 'قيد الطباعة', icon: Printer },
    { key: 'done', label: 'جاهز للاستلام', icon: CheckCircle },
    { key: 'delivered', label: 'تم التسليم', icon: Truck },
  ];
  
  const currentStepIndex = steps.findIndex(s => s.key === order?.status);

  if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;
  if (!order) return null;

  const remaining = order.total_amount - deposit;

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      
      {/* 1. الرأس والأزرار */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/app/orders')} className="p-2 hover:bg-slate-100 rounded-xl"><ArrowRight /></button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">طلب: {order.customer_name}</h1>
            <p className="text-slate-500 text-sm font-mono">#{order.id.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={handlePrint} className="btn-secondary flex items-center gap-2"><Printer size={16}/> طباعة فاتورة</button>
           <button onClick={handleDelete} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"><Trash2 size={18} /></button>
        </div>
      </div>

      {/* 2. شريط مسار الطلب */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="flex justify-between min-w-[500px]">
          {steps.map((step, index) => {
            const isActive = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;
            return (
              <button 
                key={step.key} 
                onClick={() => updateStatus(step.key)}
                className={`flex flex-col items-center gap-2 group flex-1 relative ${index !== steps.length -1 ? 'after:content-[""] after:h-1 after:w-full after:bg-slate-100 after:absolute after:top-5 after:right-[50%] after:-z-10' : ''}`}
              >
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-110 ${
                   isActive ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                 } ${isCurrent ? 'ring-4 ring-emerald-50 scale-110' : ''}`}>
                   <step.icon size={20} />
                 </div>
                 <span className={`text-xs font-bold ${isActive ? 'text-emerald-700' : 'text-slate-400'}`}>{step.label}</span>
                 {isActive && index !== steps.length -1 && (
                   <div className="absolute top-5 right-[50%] w-full h-1 bg-emerald-500 -z-10"></div>
                 )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        
        {/* 3. العمود الأول: بيانات العميل */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><User size={18} className="text-blue-500"/> بيانات العميل</h3>
              {!isEditingCustomer ? (
                <button onClick={() => setIsEditingCustomer(true)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg">
                  <Edit3 size={12}/> تعديل
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleSaveCustomerData} className="text-xs bg-green-500 text-white px-2 py-1 rounded-lg">حفظ</button>
                  <button onClick={() => setIsEditingCustomer(false)} className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-lg"><X size={12}/></button>
                </div>
              )}
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex flex-col gap-1 py-2 border-b border-slate-50">
                <span className="text-slate-500 text-xs">الجوال</span>
                {isEditingCustomer ? (
                  <input 
                    value={customerData.phone}
                    onChange={(e) => setCustomerData({...customerData, phone: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 dir-ltr text-right"
                  />
                ) : (
                  <span className="font-mono font-bold dir-ltr block text-right">{order.phone}</span>
                )}
              </div>

              <div className="flex flex-col gap-1 py-2 border-b border-slate-50">
                <span className="text-slate-500 text-xs">أنشئ في</span>
                {isEditingCustomer ? (
                  <input 
                    type="date"
                    value={customerData.created_at}
                    onChange={(e) => setCustomerData({...customerData, created_at: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1"
                  />
                ) : (
                  <span>{new Date(order.created_at).toLocaleDateString('en-GB')}</span>
                )}
              </div>

              <div className="flex flex-col gap-1 py-2 border-b border-slate-50">
                <span className="text-slate-500 text-xs">تاريخ التسليم</span>
                {isEditingCustomer ? (
                  <input 
                    type="date"
                    value={customerData.delivery_date}
                    onChange={(e) => setCustomerData({...customerData, delivery_date: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1"
                  />
                ) : (
                  <span className="text-red-600 font-bold">{order.delivery_date}</span>
                )}
              </div>
              
              {!isEditingCustomer && order.phone && (
                <a 
                  href={`https://wa.me/966${order.phone.startsWith('0') ? order.phone.substring(1) : order.phone}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 py-3 rounded-xl hover:bg-emerald-100 transition-colors font-bold"
                >
                  <MessageCircle size={18} /> محادثة واتساب
                </a>
              )}
            </div>
          </div>
        </div>

        {/* 4. العمود الثاني: تفاصيل الإنتاج */}
        <div className="space-y-6">
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 left-0 w-2 h-full bg-orange-500"></div>
             
             {/* رأس القسم مع زر التعديل */}
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText size={18} className="text-orange-500"/> تفاصيل الإنتاج</h3>
                {!isEditingProduction ? (
                  <button onClick={() => setIsEditingProduction(true)} className="text-xs text-orange-600 hover:text-orange-800 flex items-center gap-1 bg-orange-50 px-2 py-1 rounded-lg">
                    <Edit3 size={12}/> تعديل
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={handleSaveProduction} className="text-xs bg-green-500 text-white px-2 py-1 rounded-lg">حفظ</button>
                    <button onClick={() => setIsEditingProduction(false)} className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-lg"><X size={12}/></button>
                  </div>
                )}
             </div>
             
             <div className="grid grid-cols-2 gap-4 mb-6">
               {/* 1. خانة صور 4x6 */}
               <div className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-100">
                 <span className="text-xs text-slate-500 block mb-1">صور 4×6</span>
                 {isEditingProduction ? (
                   <input 
                     type="number"
                     min="0"
                     value={productionData.photo_4x6_qty}
                     onChange={(e) => setProductionData({...productionData, photo_4x6_qty: e.target.value})}
                     className="w-full bg-white border border-slate-300 rounded-lg p-1 text-center font-bold text-xl outline-none focus:border-orange-500"
                   />
                 ) : (
                   <span className="text-4xl font-black text-slate-900">{order.photo_4x6_qty}</span>
                 )}
               </div>

               {/* 2. خانة صور A4 */}
               <div className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-100">
                 <span className="text-xs text-slate-500 block mb-1">صور A4</span>
                 {isEditingProduction ? (
                    <input 
                      type="number"
                      min="0"
                      value={productionData.a4_qty}
                      onChange={(e) => setProductionData({...productionData, a4_qty: e.target.value})}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1 text-center font-bold text-xl outline-none focus:border-orange-500"
                    />
                 ) : (
                    <span className="text-4xl font-black text-slate-900">{order.a4_qty}</span>
                 )}
               </div>
             </div>

             <div>
               <label className="text-xs font-bold text-slate-500 mb-2 block">ملاحظات الطباعة:</label>
               <div className="flex gap-2">
                 <textarea 
                   className="w-full bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm focus:outline-none focus:border-yellow-400 min-h-[80px]"
                   value={notes}
                   onChange={(e) => setNotes(e.target.value)}
                   placeholder="لا توجد ملاحظات..."
                 />
               </div>
               <button onClick={saveNotes} className="mt-2 text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg hover:bg-yellow-200 flex items-center gap-1 w-fit mr-auto">
                 <Save size={12}/> حفظ الملاحظة
               </button>
             </div>
           </div>
        </div>

        {/* 5. العمود الثالث: الإدارة المالية */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            <h3 className="font-bold mb-6 flex items-center gap-2 relative z-10"><Banknote className="text-emerald-400"/> الحسابات</h3>
            
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between text-slate-300">
                <span>الإجمالي</span>
                <span className="text-xl font-bold text-white">{order.total_amount} ر.س</span>
              </div>
              
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-400">المدفوع (العربون)</span>
                  <button onClick={() => setIsEditingDeposit(!isEditingDeposit)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                    <Edit3 size={12}/> تعديل
                  </button>
                </div>
                
                {isEditingDeposit ? (
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      value={deposit}
                      onChange={(e) => setDeposit(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-white text-center font-bold outline-none focus:border-emerald-500"
                    />
                    <button onClick={handleUpdateDeposit} className="bg-emerald-500 text-white px-3 rounded-lg text-xs font-bold hover:bg-emerald-600">حفظ</button>
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-emerald-400 text-center">{deposit} ر.س</div>
                )}
              </div>

              <div className={`p-4 rounded-xl text-center border ${remaining <= 0 ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
                <span className="text-xs block mb-1">{remaining <= 0 ? 'حالة الدفع' : 'المبلغ المتبقي'}</span>
                <span className="text-2xl font-black">
                  {remaining <= 0 ? 'خالص ✅' : `${remaining.toFixed(2)} ر.س`}
                </span>
              </div>

              {remaining > 0 && (
                <button 
                  onClick={markAsFullyPaid}
                  className="w-full py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} className="text-emerald-600"/> سداد كامل المبلغ
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      <style>{`
        .btn-secondary { @apply px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors; }
      `}</style>
    </div>
  );
}