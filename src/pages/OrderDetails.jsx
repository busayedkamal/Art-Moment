// src/pages/OrderDetails.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  ArrowRight, Printer, CheckCircle, Truck, Trash2, 
  Banknote, Phone, FileText, User, 
  MessageCircle, Save, Edit3, X, MinusCircle, Tag, BookOpen, Share2 
} from 'lucide-react';

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState({ a4: 0, photo4x6: 0 });

  // --- حالات التعديل ---
  const [deposit, setDeposit] = useState(0);
  const [isEditingDeposit, setIsEditingDeposit] = useState(false);

  const [manualDiscount, setManualDiscount] = useState(0);
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);

  const [deliveryFee, setDeliveryFee] = useState(0);
  const [isEditingDelivery, setIsEditingDelivery] = useState(false);

  const [notes, setNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');

  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [customerData, setCustomerData] = useState({ 
    phone: '', delivery_date: '', created_at: '', source: [], source_other: '' 
  });

  const [isEditingProduction, setIsEditingProduction] = useState(false);
  const [productionData, setProductionData] = useState({ 
    a4_qty: 0, photo_4x6_qty: 0, album_qty: 0, album_price: 0 
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
      setDeposit(orderData.deposit || 0);
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
        source: Array.isArray(orderData.source) ? orderData.source : [], // حماية من الخطأ
        source_other: orderData.source_other || ''
      });

      setProductionData({ 
        a4_qty: orderData.a4_qty || 0, 
        photo_4x6_qty: orderData.photo_4x6_qty || 0,
        album_qty: orderData.album_qty || 0,
        album_price: orderData.album_price || 0
      });

    } catch (err) {
      console.error(err);
      toast.error('لم يتم العثور على الطلب');
      navigate('/app/orders');
    } finally { setLoading(false); }
  }

  const handleSaveCustomerData = async () => {
    try {
      const updatedData = {
        phone: customerData.phone,
        delivery_date: customerData.delivery_date,
        source: customerData.source,
        source_other: customerData.source_other
      };
      await supabase.from('orders').update(updatedData).eq('id', id);
      setOrder({ ...order, ...updatedData });
      setIsEditingCustomer(false);
      toast.success('تم التحديث');
    } catch { toast.error('فشل الحفظ'); }
  };

  const recalculateAndSaveTotal = async (overrides = {}) => {
    try {
      const currentA4 = overrides.a4_qty ?? order.a4_qty;
      const current4x6 = overrides.photo_4x6_qty ?? order.photo_4x6_qty;
      const currentAlbumQty = overrides.album_qty ?? order.album_qty;
      const currentAlbumPrice = overrides.album_price ?? order.album_price;
      const currentDelivery = overrides.delivery_fee ?? deliveryFee;
      const currentDiscount = overrides.manual_discount ?? manualDiscount;

      const productsTotal = (Number(currentA4) * prices.a4) + (Number(current4x6) * prices.photo4x6);
      const albumsTotal = (Number(currentAlbumQty) * Number(currentAlbumPrice));
      
      const newSubtotal = productsTotal + albumsTotal;
      const newTotal = Math.max(0, newSubtotal + Number(currentDelivery) - Number(currentDiscount));

      const updatedData = {
        a4_qty: currentA4, photo_4x6_qty: current4x6,
        album_qty: currentAlbumQty, album_price: currentAlbumPrice,
        delivery_fee: currentDelivery, manual_discount: currentDiscount,
        subtotal: newSubtotal, total_amount: newTotal
      };

      await supabase.from('orders').update(updatedData).eq('id', id);
      setOrder({ ...order, ...updatedData });
      setDeliveryFee(currentDelivery);
      setManualDiscount(currentDiscount);
      return true;
    } catch (e) { toast.error('فشل الحساب'); return false; }
  };

  const handleSaveProduction = async () => {
    const success = await recalculateAndSaveTotal({
      a4_qty: Number(productionData.a4_qty),
      photo_4x6_qty: Number(productionData.photo_4x6_qty),
      album_qty: Number(productionData.album_qty),
      album_price: Number(productionData.album_price)
    });
    if (success) { setIsEditingProduction(false); toast.success('تم التحديث'); }
  };

  const handleSaveDiscount = async () => {
    const success = await recalculateAndSaveTotal({ manual_discount: Number(manualDiscount) });
    if (success) { setIsEditingDiscount(false); toast.success('تم تحديث الخصم'); }
  };

  const handleSaveDelivery = async () => {
    const success = await recalculateAndSaveTotal({ delivery_fee: Number(deliveryFee) });
    if (success) { setIsEditingDelivery(false); toast.success('تم تحديث التوصيل'); }
  };

  const updateStatus = async (newStatus) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    setOrder({ ...order, status: newStatus });
    toast.success('تم تحديث الحالة');
  };

  const handleUpdateDeposit = async () => {
    const newDeposit = Number(deposit);
    const isPaid = newDeposit >= order.total_amount;
    await supabase.from('orders').update({ deposit: newDeposit, payment_status: isPaid ? 'paid' : 'unpaid' }).eq('id', id);
    setOrder({ ...order, deposit: newDeposit, payment_status: isPaid ? 'paid' : 'unpaid' });
    setIsEditingDeposit(false);
    toast.success('تم تحديث العربون');
  };

  const handleSourceToggle = (src) => {
    const current = Array.isArray(customerData.source) ? customerData.source : [];
    setCustomerData({
      ...customerData,
      source: current.includes(src) ? current.filter(s => s !== src) : [...current, src]
    });
  };

  const markAsFullyPaid = async () => {
    await supabase.from('orders').update({ deposit: order.total_amount, payment_status: 'paid' }).eq('id', id);
    setOrder({ ...order, deposit: order.total_amount, payment_status: 'paid' });
    setDeposit(order.total_amount);
    toast.success('تم السداد');
  };

  const saveNotes = async () => {
    await supabase.from('orders').update({ notes }).eq('id', id);
    setOrder({ ...order, notes });
    toast.success('تم الحفظ');
  };

  const handleDelete = async () => {
    if (!window.confirm('حذف نهائي؟')) return;
    await supabase.from('orders').delete().eq('id', id);
    navigate('/app/orders');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) return toast.error('اسمح بالنوافذ');
    printWindow.document.write(`
      <html dir="rtl"><body style="font-family:sans-serif;text-align:right;padding:20px">
      <h2 style="text-align:center">Art Moment - فاتورة #${order.id.slice(0,6)}</h2>
      <p>العميل: ${order.customer_name} | ${order.phone}</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0" border="1">
        <tr><th>الوصف</th><th>الكمية</th><th>السعر</th></tr>
        ${order.a4_qty > 0 ? `<tr><td>A4</td><td>${order.a4_qty}</td><td>-</td></tr>` : ''}
        ${order.photo_4x6_qty > 0 ? `<tr><td>4x6</td><td>${order.photo_4x6_qty}</td><td>-</td></tr>` : ''}
        ${order.delivery_fee > 0 ? `<tr><td>توصيل</td><td>-</td><td>${order.delivery_fee}</td></tr>` : ''}
        ${order.manual_discount > 0 ? `<tr><td>خصم</td><td>-</td><td>-${order.manual_discount}</td></tr>` : ''}
      </table>
      <h3>الإجمالي: ${order.total_amount} | المدفوع: ${deposit}</h3>
      <script>window.print();window.close();</script></body></html>
    `);
    printWindow.document.close();
  };

  const steps = [
    { key: 'new', label: 'جديد', icon: FileText },
    { key: 'printing', label: 'طباعة', icon: Printer },
    { key: 'done', label: 'جاهز', icon: CheckCircle },
    { key: 'delivered', label: 'تسليم', icon: Truck },
  ];
  const currentStepIndex = steps.findIndex(s => s.key === order?.status);

  if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;
  if (!order) return <div className="p-10 text-center text-red-500">حدث خطأ في تحميل الطلب</div>;
  
  const remaining = order.total_amount - deposit;

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      {/* الرأس */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
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
            return (
              <button key={step.key} onClick={() => updateStatus(step.key)} className={`flex flex-col items-center gap-2 flex-1 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-emerald-100' : 'bg-slate-100'}`}><step.icon size={20} /></div>
                 <span className="text-xs font-bold">{step.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* العميل */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2"><User size={18} className="text-blue-500"/> العميل</h3>
            <button onClick={() => isEditingCustomer ? handleSaveCustomerData() : setIsEditingCustomer(true)} className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{isEditingCustomer ? 'حفظ' : 'تعديل'}</button>
          </div>
          <div className="space-y-4 text-sm">
            <div>
              <span className="text-slate-500 text-xs">الجوال</span>
              {isEditingCustomer ? <input value={customerData.phone} onChange={e => setCustomerData({...customerData, phone: e.target.value})} className="w-full border rounded px-2 py-1"/> : <div className="font-mono dir-ltr text-right">{order.phone}</div>}
            </div>
            <div>
              <span className="text-slate-500 text-xs">المصدر</span>
              {isEditingCustomer ? (
                <div className="flex flex-wrap gap-2 mt-1">
                  {['واتساب', 'إنستقرام', 'سناب'].map(src => (
                    <button key={src} onClick={() => handleSourceToggle(src)} className={`px-2 py-1 rounded text-xs border ${customerData.source.includes(src) ? 'bg-emerald-50 border-emerald-500' : ''}`}>{src}</button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1 mt-1">
                  {(Array.isArray(order.source) ? order.source : []).map(s => <span key={s} className="bg-slate-100 px-2 py-1 rounded text-xs">{s}</span>)}
                </div>
              )}
            </div>
            {!isEditingCustomer && order.phone && <a href={`https://wa.me/966${order.phone}`} target="_blank" className="block w-full text-center bg-emerald-50 text-emerald-600 py-2 rounded-xl text-sm font-bold">محادثة واتساب</a>}
          </div>
        </div>

        {/* الإنتاج */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2"><FileText size={18} className="text-orange-500"/> الإنتاج</h3>
            <button onClick={() => isEditingProduction ? handleSaveProduction() : setIsEditingProduction(true)} className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">{isEditingProduction ? 'حفظ' : 'تعديل'}</button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-50 p-2 rounded text-center"><span className="text-xs block text-slate-400">4x6</span>{isEditingProduction ? <input type="number" value={productionData.photo_4x6_qty} onChange={e => setProductionData({...productionData, photo_4x6_qty: e.target.value})} className="w-full text-center"/> : <span className="font-bold text-xl">{order.photo_4x6_qty}</span>}</div>
            <div className="bg-slate-50 p-2 rounded text-center"><span className="text-xs block text-slate-400">A4</span>{isEditingProduction ? <input type="number" value={productionData.a4_qty} onChange={e => setProductionData({...productionData, a4_qty: e.target.value})} className="w-full text-center"/> : <span className="font-bold text-xl">{order.a4_qty}</span>}</div>
          </div>
          
          <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 mb-4 flex gap-2 text-center text-sm">
             <div className="flex-1">
               <span className="block text-[10px] text-slate-400">عدد الألبومات</span>
               {isEditingProduction ? <input type="number" value={productionData.album_qty} onChange={e => setProductionData({...productionData, album_qty: e.target.value})} className="w-full text-center border rounded"/> : <b>{order.album_qty}</b>}
             </div>
             <div className="flex-1">
               <span className="block text-[10px] text-slate-400">سعر الألبوم</span>
               {isEditingProduction ? <input type="number" value={productionData.album_price} onChange={e => setProductionData({...productionData, album_price: e.target.value})} className="w-full text-center border rounded"/> : <b>{order.album_price}</b>}
             </div>
          </div>

          <textarea className="w-full bg-yellow-50 border border-yellow-200 rounded-xl p-2 text-sm focus:outline-none h-20" value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات..."/>
          <button onClick={saveNotes} className="mt-2 text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg w-full">حفظ الملاحظة</button>
        </div>

        {/* الحسابات */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
          <h3 className="font-bold mb-4 flex items-center gap-2"><Banknote className="text-emerald-400"/> الحسابات</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-slate-300"><span>الإجمالي</span><span className="font-bold text-white text-lg">{order.total_amount}</span></div>
            
            <div className="flex justify-between items-center text-slate-300">
              <span>التوصيل</span>
              {isEditingDelivery ? <div className="flex gap-1"><input type="number" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} className="w-12 bg-slate-800 border rounded text-center"/><button onClick={handleSaveDelivery} className="text-emerald-400 text-xs">ok</button></div> : <button onClick={() => setIsEditingDelivery(true)}>{deliveryFee}</button>}
            </div>

            <div className="bg-white/10 p-3 rounded-xl flex justify-between items-center">
              <span>المدفوع</span>
              {isEditingDeposit ? <div className="flex gap-1"><input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} className="w-16 bg-slate-800 border rounded text-center font-bold"/><button onClick={handleUpdateDeposit} className="text-emerald-400 text-xs">ok</button></div> : <div className="flex gap-2 items-center"><span className="text-xl font-bold text-emerald-400">{deposit}</span><button onClick={() => setIsEditingDeposit(true)}><Edit3 size={12}/></button></div>}
            </div>

            <div className="bg-red-500/20 p-3 rounded-xl flex justify-between items-center">
              <span>الخصم</span>
              {isEditingDiscount ? <div className="flex gap-1"><input type="number" value={manualDiscount} onChange={e => setManualDiscount(e.target.value)} className="w-16 bg-slate-800 border rounded text-center font-bold"/><button onClick={handleSaveDiscount} className="text-emerald-400 text-xs">ok</button></div> : <div className="flex gap-2 items-center"><span className="text-lg font-bold text-red-300">-{manualDiscount}</span><button onClick={() => setIsEditingDiscount(true)}><Edit3 size={12}/></button></div>}
            </div>

            <div className={`p-3 rounded-xl text-center border ${remaining <= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
              <span className="text-xs block">المتبقي</span>
              <span className="text-xl font-black">{remaining <= 0 ? 'خالص ✅' : remaining.toFixed(2)}</span>
            </div>
            {remaining > 0 && <button onClick={markAsFullyPaid} className="w-full py-2 bg-white text-slate-900 rounded-lg font-bold text-xs">سداد كامل</button>}
          </div>
        </div>
      </div>
      <style>{`.btn-secondary { @apply px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors; }`}</style>
    </div>
  );
}