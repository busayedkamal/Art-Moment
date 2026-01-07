// src/pages/OrderDetails.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  ArrowRight, Printer, CheckCircle, Truck, Trash2, 
  Banknote, Calendar, Phone, FileText, User, 
  MessageCircle, Save, Edit3, X, MinusCircle, Tag, BookOpen, Share2 
} from 'lucide-react';

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState({ a4: 0, photo4x6: 0 });

  // --- حالات التعديل ---
  
  // 1. المالية
  const [deposit, setDeposit] = useState(0);
  const [isEditingDeposit, setIsEditingDeposit] = useState(false);

  const [manualDiscount, setManualDiscount] = useState(0);
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);

  const [deliveryFee, setDeliveryFee] = useState(0);
  const [isEditingDelivery, setIsEditingDelivery] = useState(false);

  // 2. الملاحظات والكوبون
  const [notes, setNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');

  // 3. بيانات العميل (مع المصدر)
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [customerData, setCustomerData] = useState({ 
    phone: '', 
    delivery_date: '', 
    created_at: '',
    source: [],
    source_other: ''
  });

  // 4. تفاصيل الإنتاج (مع الألبومات)
  const [isEditingProduction, setIsEditingProduction] = useState(false);
  const [productionData, setProductionData] = useState({ 
    a4_qty: 0, 
    photo_4x6_qty: 0,
    album_qty: 0,
    album_price: 0
  });

  // جلب البيانات
  useEffect(() => {
    fetchOrderAndSettings();
  }, [id]);

  async function fetchOrderAndSettings() {
    try {
      const { data: orderData, error: orderError } = await supabase.from('orders').select('*').eq('id', id).single();
      if (orderError) throw orderError;

      const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 1).single();
      
      setOrder(orderData);
      setDeposit(orderData.deposit);
      setManualDiscount(orderData.manual_discount || 0);
      setDeliveryFee(orderData.delivery_fee || 0);
      setNotes(orderData.notes || '');
      
      if (settingsData) {
        setPrices({ a4: Number(settingsData.a4_price), photo4x6: Number(settingsData.photo_4x6_price) });
      }

      setCustomerData({
        phone: orderData.phone || '',
        delivery_date: orderData.delivery_date || '',
        created_at: orderData.created_at ? new Date(orderData.created_at).toISOString().slice(0, 10) : '',
        source: orderData.source || [],
        source_other: orderData.source_other || ''
      });

      setProductionData({ 
        a4_qty: orderData.a4_qty || 0, 
        photo_4x6_qty: orderData.photo_4x6_qty || 0,
        album_qty: orderData.album_qty || 0,
        album_price: orderData.album_price || 0
      });

    } catch (err) {
      toast.error('لم يتم العثور على الطلب');
      navigate('/app/orders');
    } finally { setLoading(false); }
  }

  // --- تحديث الحالة ---
  const updateStatus = async (newStatus) => {
    try {
      await supabase.from('orders').update({ status: newStatus }).eq('id', id);
      setOrder({ ...order, status: newStatus });
      toast.success(`تم تغيير الحالة إلى: ${getStatusLabel(newStatus)}`);
    } catch { toast.error('فشل التحديث'); }
  };

  // --- حفظ بيانات العميل (مع المصدر) ---
  const handleSaveCustomerData = async () => {
    try {
      const updatedData = {
        phone: customerData.phone,
        delivery_date: customerData.delivery_date,
        created_at: new Date(customerData.created_at).toISOString(),
        source: customerData.source,
        source_other: customerData.source_other
      };
      await supabase.from('orders').update(updatedData).eq('id', id);
      setOrder({ ...order, ...updatedData });
      setIsEditingCustomer(false);
      toast.success('تم التحديث');
    } catch { toast.error('فشل الحفظ'); }
  };

  // --- دالة الحسابات الشاملة (القلب النابض) ---
  const recalculateAndSaveTotal = async (overrides = {}) => {
    try {
      // نأخذ القيم الجديدة إذا وجدت، وإلا نستخدم القيم الحالية من الطلب
      const currentA4 = overrides.a4_qty ?? order.a4_qty;
      const current4x6 = overrides.photo_4x6_qty ?? order.photo_4x6_qty;
      const currentAlbumQty = overrides.album_qty ?? order.album_qty;
      const currentAlbumPrice = overrides.album_price ?? order.album_price;
      
      const currentDelivery = overrides.delivery_fee ?? order.delivery_fee;
      const currentDiscount = overrides.manual_discount ?? order.manual_discount;

      // الحسابات
      const productsTotal = (Number(currentA4) * prices.a4) + (Number(current4x6) * prices.photo4x6);
      const albumsTotal = (Number(currentAlbumQty) * Number(currentAlbumPrice));
      
      const newSubtotal = productsTotal + albumsTotal;
      const newTotal = Math.max(0, newSubtotal + Number(currentDelivery) - Number(currentDiscount));

      const updatedData = {
        a4_qty: currentA4,
        photo_4x6_qty: current4x6,
        album_qty: currentAlbumQty,
        album_price: currentAlbumPrice,
        delivery_fee: currentDelivery,
        manual_discount: currentDiscount,
        subtotal: newSubtotal,
        total_amount: newTotal
      };

      await supabase.from('orders').update(updatedData).eq('id', id);
      setOrder({ ...order, ...updatedData });
      
      // تحديث الحالات المحلية لضمان التزامن
      setDeliveryFee(currentDelivery);
      setManualDiscount(currentDiscount);
      
      return true;
    } catch (e) {
      console.error(e);
      toast.error('فشل في إعادة الحساب');
      return false;
    }
  };

  // دوال الحفظ الفرعية (تستدعي الدالة الشاملة)
  const handleSaveProduction = async () => {
    const success = await recalculateAndSaveTotal({
      a4_qty: Number(productionData.a4_qty),
      photo_4x6_qty: Number(productionData.photo_4x6_qty),
      album_qty: Number(productionData.album_qty),
      album_price: Number(productionData.album_price)
    });
    if (success) {
      setIsEditingProduction(false);
      toast.success('تم تحديث الإنتاج والسعر');
    }
  };

  const handleSaveDiscount = async () => {
    const success = await recalculateAndSaveTotal({ manual_discount: Number(manualDiscount) });
    if (success) { setIsEditingDiscount(false); toast.success('تم تحديث الخصم'); }
  };

  const handleSaveDelivery = async () => {
    const success = await recalculateAndSaveTotal({ delivery_fee: Number(deliveryFee) });
    if (success) { setIsEditingDelivery(false); toast.success('تم تحديث التوصيل'); }
  };

  // --- الكوبون ---
  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    const toastId = toast.loading('جاري التحقق...');
    try {
      const { data } = await supabase.from('coupons').select('*').eq('code', couponCode.toUpperCase().trim()).eq('is_active', true).single();
      toast.dismiss(toastId);

      if (data) {
        let discountVal = 0;
        if (data.discount_type === 'percent') {
          discountVal = order.subtotal * (data.discount_amount / 100);
        } else {
          discountVal = Number(data.discount_amount);
        }
        
        const success = await recalculateAndSaveTotal({ manual_discount: discountVal });
        if (success) {
          setManualDiscount(discountVal);
          setCouponCode('');
          toast.success(`تم تطبيق الكوبون! خصم ${discountVal.toFixed(2)} ريال`);
        }
      } else {
        toast.error('كود غير صالح');
      }
    } catch { toast.dismiss(toastId); toast.error('خطأ في الكوبون'); }
  };

  const handleUpdateDeposit = async () => {
    const newDeposit = Number(deposit);
    const isPaid = newDeposit >= order.total_amount;
    try {
      await supabase.from('orders').update({ deposit: newDeposit, payment_status: isPaid ? 'paid' : 'unpaid' }).eq('id', id);
      setOrder({ ...order, deposit: newDeposit, payment_status: isPaid ? 'paid' : 'unpaid' });
      setIsEditingDeposit(false);
      toast.success('تم التحديث');
    } catch { toast.error('فشل العملية'); }
  };

  const markAsFullyPaid = async () => {
    try {
      await supabase.from('orders').update({ deposit: order.total_amount, payment_status: 'paid' }).eq('id', id);
      setOrder({ ...order, deposit: order.total_amount, payment_status: 'paid' });
      setDeposit(order.total_amount);
      toast.success('تم السداد بالكامل ✅');
    } catch { toast.error('فشل العملية'); }
  };

  const saveNotes = async () => {
    try {
      await supabase.from('orders').update({ notes }).eq('id', id);
      setOrder({ ...order, notes });
      toast.success('تم الحفظ');
    } catch { toast.error('فشل الحفظ'); }
  };

  const handleSourceToggle = (src) => {
    const current = customerData.source || [];
    setCustomerData({
      ...customerData,
      source: current.includes(src) ? current.filter(s => s !== src) : [...current, src]
    });
  };

  // باقي الدوال (طباعة، حذف، إلخ)
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) return toast.error('اسمح بالنوافذ المنبثقة');
    const remaining = (order.total_amount - deposit).toFixed(2);
    const invoiceContent = `
      <!DOCTYPE html><html dir="rtl"><head><title>فاتورة #${order.id.slice(0, 6)}</title>
      <style>body{font-family:sans-serif;padding:20px;text-align:right}.header{text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin-bottom:20px}th,td{border-bottom:1px solid #ddd;padding:8px}.total{font-size:20px;font-weight:bold;background:#f0f0f0;padding:10px}@media print{body{-webkit-print-color-adjust:exact}}</style></head><body>
      <div class="header"><h1>Art Moment</h1><p>فاتورة مبيعات</p></div>
      <p><strong>العميل:</strong> ${order.customer_name} | ${order.phone}</p><p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
      <table><thead><tr><th>الوصف</th><th>الكمية</th><th>السعر</th></tr></thead><tbody>
        ${order.a4_qty > 0 ? `<tr><td>طباعة A4</td><td>${order.a4_qty}</td><td>-</td></tr>` : ''}
        ${order.photo_4x6_qty > 0 ? `<tr><td>طباعة 4×6</td><td>${order.photo_4x6_qty}</td><td>-</td></tr>` : ''}
        ${order.album_qty > 0 ? `<tr><td>ألبوم صور</td><td>${order.album_qty}</td><td>${order.album_price}</td></tr>` : ''}
        ${order.delivery_fee > 0 ? `<tr><td>توصيل</td><td>-</td><td>${order.delivery_fee}</td></tr>` : ''}
        ${order.manual_discount > 0 ? `<tr><td>خصم</td><td>-</td><td>-${order.manual_discount}</td></tr>` : ''}
      </tbody></table>
      <div class="total">الإجمالي: ${order.total_amount}<br>المدفوع: ${deposit}<br>المتبقي: ${remaining}</div>
      <script>window.onload=function(){window.print();window.close();}</script></body></html>`;
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
      
      {/* الرأس */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/app/orders')} className="p-2 hover:bg-slate-100 rounded-xl"><ArrowRight /></button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">طلب: {order.customer_name}</h1>
            <p className="text-slate-500 text-sm font-mono">#{order.id.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={handlePrint} className="btn-secondary flex items-center gap-2"><Printer size={16}/> فاتورة</button>
           <button onClick={handleDelete} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"><Trash2 size={18} /></button>
        </div>
      </div>

      {/* المسار */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="flex justify-between min-w-[500px]">
          {steps.map((step, index) => {
            const isActive = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;
            return (
              <button key={step.key} onClick={() => updateStatus(step.key)} className={`flex flex-col items-center gap-2 group flex-1 relative ${index !== steps.length -1 ? 'after:content-[""] after:h-1 after:w-full after:bg-slate-100 after:absolute after:top-5 after:right-[50%] after:-z-10' : ''}`}>
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-110 ${isActive ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'} ${isCurrent ? 'ring-4 ring-emerald-50 scale-110' : ''}`}>
                   <step.icon size={20} />
                 </div>
                 <span className={`text-xs font-bold ${isActive ? 'text-emerald-700' : 'text-slate-400'}`}>{step.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        
        {/* بيانات العميل + المصدر */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><User size={18} className="text-blue-500"/> العميل</h3>
              {!isEditingCustomer ? (
                <button onClick={() => setIsEditingCustomer(true)} className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg flex gap-1"><Edit3 size={12}/> تعديل</button>
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
                {isEditingCustomer ? <input value={customerData.phone} onChange={(e) => setCustomerData({...customerData, phone: e.target.value})} className="w-full bg-slate-50 border rounded px-2 py-1 dir-ltr text-right"/> : <span className="font-mono font-bold dir-ltr block text-right">{order.phone}</span>}
              </div>
              <div className="flex flex-col gap-1 py-2 border-b border-slate-50">
                <span className="text-slate-500 text-xs">تاريخ التسليم</span>
                {isEditingCustomer ? <input type="date" value={customerData.delivery_date} onChange={(e) => setCustomerData({...customerData, delivery_date: e.target.value})} className="w-full bg-slate-50 border rounded px-2 py-1"/> : <span className="text-red-600 font-bold">{order.delivery_date}</span>}
              </div>
              
              {/* قسم المصدر */}
              <div className="pt-2">
                <span className="text-slate-500 text-xs block mb-2 flex items-center gap-1"><Share2 size={12}/> المصدر</span>
                {isEditingCustomer ? (
                  <div className="flex flex-wrap gap-2">
                    {['تيليجرام', 'واتساب', 'إنستقرام', 'سناب', 'مباشر'].map((src) => (
                      <button key={src} onClick={() => handleSourceToggle(src)} className={`px-2 py-1 rounded text-xs border ${customerData.source?.includes(src) ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white'}`}>{src}</button>
                    ))}
                    <input value={customerData.source_other} onChange={(e) => setCustomerData({...customerData, source_other: e.target.value})} placeholder="آخر..." className="w-full mt-2 border rounded px-2 py-1 text-xs"/>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {order.source?.map(s => <span key={s} className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-xs">{s}</span>)}
                    {order.source_other && <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-xs">{order.source_other}</span>}
                  </div>
                )}
              </div>

              {!isEditingCustomer && order.phone && <a href={`https://wa.me/966${order.phone.startsWith('0') ? order.phone.substring(1) : order.phone}`} target="_blank" rel="noreferrer" className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 py-3 rounded-xl hover:bg-emerald-100 font-bold"><MessageCircle size={18} /> واتساب</a>}
            </div>
          </div>
        </div>

        {/* تفاصيل الإنتاج (شامل الألبوم) */}
        <div className="space-y-6">
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 left-0 w-2 h-full bg-orange-500"></div>
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText size={18} className="text-orange-500"/> الإنتاج</h3>
                {!isEditingProduction ? (
                  <button onClick={() => setIsEditingProduction(true)} className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-lg flex gap-1"><Edit3 size={12}/> تعديل</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={handleSaveProduction} className="text-xs bg-green-500 text-white px-2 py-1 rounded-lg">حفظ</button>
                    <button onClick={() => setIsEditingProduction(false)} className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-lg"><X size={12}/></button>
                  </div>
                )}
             </div>
             
             {/* صور A4 و 4x6 */}
             <div className="grid grid-cols-2 gap-3 mb-4">
               <div className="bg-slate-50 p-3 rounded-xl text-center border border-slate-100">
                 <span className="text-xs text-slate-500 block mb-1">صور 4×6</span>
                 {isEditingProduction ? <input type="number" min="0" value={productionData.photo_4x6_qty} onChange={(e) => setProductionData({...productionData, photo_4x6_qty: e.target.value})} className="w-full bg-white border rounded-lg p-1 text-center font-bold text-lg outline-none focus:border-orange-500"/> : <span className="text-3xl font-black text-slate-900">{order.photo_4x6_qty}</span>}
               </div>
               <div className="bg-slate-50 p-3 rounded-xl text-center border border-slate-100">
                 <span className="text-xs text-slate-500 block mb-1">صور A4</span>
                 {isEditingProduction ? <input type="number" min="0" value={productionData.a4_qty} onChange={(e) => setProductionData({...productionData, a4_qty: e.target.value})} className="w-full bg-white border rounded-lg p-1 text-center font-bold text-lg outline-none focus:border-orange-500"/> : <span className="text-3xl font-black text-slate-900">{order.a4_qty}</span>}
               </div>
             </div>

             {/* الألبوم */}
             <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 mb-4">
               <div className="flex items-center gap-2 mb-2 text-orange-600 font-bold text-xs"><BookOpen size={14}/> الألبوم</div>
               <div className="flex gap-2">
                 <div className="flex-1 text-center">
                   <span className="text-[10px] text-slate-400 block">العدد</span>
                   {isEditingProduction ? <input type="number" value={productionData.album_qty} onChange={(e) => setProductionData({...productionData, album_qty: e.target.value})} className="w-full text-center border rounded p-1 text-sm"/> : <span className="font-bold">{order.album_qty}</span>}
                 </div>
                 <div className="flex-1 text-center">
                   <span className="text-[10px] text-slate-400 block">السعر</span>
                   {isEditingProduction ? <input type="number" value={productionData.album_price} onChange={(e) => setProductionData({...productionData, album_price: e.target.value})} className="w-full text-center border rounded p-1 text-sm"/> : <span className="font-bold">{order.album_price}</span>}
                 </div>
               </div>
             </div>

             <div>
               <label className="text-xs font-bold text-slate-500 mb-2 block">ملاحظات:</label>
               <div className="flex gap-2">
                 <textarea className="w-full bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm focus:outline-none min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="..."/>
               </div>
               <button onClick={saveNotes} className="mt-2 text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg hover:bg-yellow-200 flex items-center gap-1 w-fit mr-auto"><Save size={12}/> حفظ</button>
             </div>
           </div>
        </div>

        {/* الحسابات (شامل التوصيل والكوبون) */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            <h3 className="font-bold mb-6 flex items-center gap-2 relative z-10"><Banknote className="text-emerald-400"/> الحسابات</h3>
            
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between text-slate-300">
                <span>الإجمالي</span>
                <span className="text-xl font-bold text-white">{order.total_amount} ر.س</span>
              </div>

              {/* العربون */}
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400">المدفوع</span>
                  <button onClick={() => setIsEditingDeposit(!isEditingDeposit)} className="text-xs text-emerald-400 hover:text-emerald-300"><Edit3 size={12}/></button>
                </div>
                {isEditingDeposit ? (
                  <div className="flex gap-2">
                    <input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="w-full bg-slate-800 border rounded px-2 py-1 text-white text-center font-bold"/>
                    <button onClick={handleUpdateDeposit} className="bg-emerald-500 text-white px-2 rounded text-xs">حفظ</button>
                  </div>
                ) : <div className="text-xl font-bold text-emerald-400 text-center">{deposit} ر.س</div>}
              </div>

              {/* التوصيل (جديد) */}
              <div className="flex justify-between items-center text-slate-300 text-sm">
                <span>التوصيل</span>
                {isEditingDelivery ? (
                  <div className="flex gap-1">
                    <input type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} className="w-16 bg-slate-800 border rounded px-1 text-white text-center"/>
                    <button onClick={handleSaveDelivery} className="text-emerald-400 text-xs">حفظ</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>{deliveryFee} ر.س</span>
                    <button onClick={() => setIsEditingDelivery(true)} className="text-slate-500 hover:text-white"><Edit3 size={12}/></button>
                  </div>
                )}
              </div>

              {/* الخصم */}
              <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-red-300 flex items-center gap-1"><MinusCircle size={10}/> خصم</span>
                  <button onClick={() => setIsEditingDiscount(!isEditingDiscount)} className="text-xs text-red-300 hover:text-red-200"><Edit3 size={12}/></button>
                </div>
                {isEditingDiscount ? (
                  <div className="flex gap-2">
                    <input type="number" value={manualDiscount} onChange={(e) => setManualDiscount(e.target.value)} className="w-full bg-slate-800 border border-red-500/50 rounded px-2 py-1 text-white text-center font-bold"/>
                    <button onClick={handleSaveDiscount} className="bg-red-500 text-white px-2 rounded text-xs">حفظ</button>
                  </div>
                ) : <div className="text-lg font-bold text-red-300 text-center">- {manualDiscount} ر.س</div>}
              </div>

              {/* الكوبون */}
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="كود" className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs outline-none pl-6"/>
                  <Tag size={10} className="absolute left-2 top-2 text-slate-400"/>
                </div>
                <button onClick={applyCoupon} className="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-xs text-white">تطبيق</button>
              </div>

              <div className={`p-4 rounded-xl text-center border ${remaining <= 0 ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
                <span className="text-xs block mb-1">{remaining <= 0 ? 'حالة الدفع' : 'المبلغ المتبقي'}</span>
                <span className="text-2xl font-black">{remaining <= 0 ? 'خالص ✅' : `${remaining.toFixed(2)} ر.س`}</span>
              </div>

              {remaining > 0 && <button onClick={markAsFullyPaid} className="w-full py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 flex items-center justify-center gap-2"><CheckCircle size={18} className="text-emerald-600"/> سداد كامل</button>}
            </div>
          </div>
        </div>
      </div>
      <style>{`.btn-secondary { @apply px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors; }`}</style>
    </div>
  );
}