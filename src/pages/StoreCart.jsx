import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Trash2, Plus, Minus, ShoppingBag, AlertCircle, Image as ImageIcon, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

export default function StoreCart() {
  const [cart, setCart] = useState([]);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [phoneError, setPhoneError] = useState(false);
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [street, setStreet] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem('art_moment_cart')) || [];
    setCart(savedCart);
  }, []);

  const saveCart = (newCart) => {
    setCart(newCart);
    localStorage.setItem('art_moment_cart', JSON.stringify(newCart));
  };

  const updateQty = (id, delta) => {
    const updated = cart.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    });
    saveCart(updated);
  };

  const removeItem = (id) => saveCart(cart.filter(item => item.id !== id));

  const clearCart = () => {
    if (window.confirm('هل أنت متأكدة من مسح جميع المنتجات؟')) saveCart([]);
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);

  const sendAutoConfirmationWhatsApp = async (orderId, customerName, customerPhone, totalAmount) => {
    try {
      const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (!settings || !settings.whatsapp_enabled || !settings.whatsapp_instance_id || !settings.whatsapp_token) return;

      let formattedPhone = String(customerPhone).replace(/\D/g, '');
      if (formattedPhone.startsWith('0')) formattedPhone = '966' + formattedPhone.substring(1);

      const msg =
        `مرحباً *${customerName || 'عميلنا العزيز'}* 🌸\n\n` +
        `تم استلام طلبك من متجر لحظة فن بنجاح! 🎉\n` +
        `رقم الطلب: *#${String(orderId).slice(0, 8)}*\n` +
        `الإجمالي: *${totalAmount} ريال*\n\n` +
        `طلبك الآن (بانتظار التأكيد) ⏳.\n` +
        `لتأكيد الطلب والبدء بتجهيزه، يرجى الرد على هذه الرسالة بكلمة *"تأكيد"*. وفي حال الرغبة بالإلغاء يرجى الرد بكلمة *"إلغاء"*.\n\n` +
        `شكراً لاختيارك لحظة فن ✨`;

      await fetch(`https://api.ultramsg.com/${settings.whatsapp_instance_id}/messages/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: settings.whatsapp_token, to: formattedPhone, body: msg })
      });
    } catch (error) {
      console.error('WhatsApp Auto-Message Error:', error);
    }
  };

  const handleCheckout = async () => {
    const isValidPhone = /^(05|9665|\+9665)[0-9]{8}$/.test(phone.trim());
    if (!isValidPhone) { setPhoneError(true); return; }
    setPhoneError(false);

    setIsSubmitting(true);
    const toastId = toast.loading('جاري إرسال الطلب...');

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('store_orders')
        .insert({
          customer_name: name || 'عميل المتجر',
          phone: phone,
          total_amount: subtotal,
          delivery_fee: 0,
          notes: notes || null,
          city: city,
          district: district,
          street: street
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      const orderItems = cart.map(item => ({
        store_order_id: orderData.id,
        product_id: item.id,
        quantity: item.qty,
        price_at_time: item.price
      }));

      const { error: itemsError } = await supabase
        .from('store_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      saveCart([]);
      await sendAutoConfirmationWhatsApp(orderData.id, name, phone, subtotal);
      toast.success('تم استلام طلبك بنجاح!', { id: toastId });
      setIsSubmitted(true);
    } catch (error) {
      console.error('Checkout Error:', error);
      toast.error('حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#F8F5F2] font-sans flex flex-col items-center justify-center p-4 text-[#4A4A4A]" dir="rtl">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center shadow-sm mb-6 animate-in zoom-in duration-500">
          <CheckCircle size={40} />
        </div>
        <h2 className="text-2xl md:text-3xl font-black mb-3 text-center">تم استلام طلبك بنجاح! 🎉</h2>
        <p className="text-[#4A4A4A]/60 text-sm md:text-base mb-8 text-center max-w-md leading-relaxed">
          طلبك الآن في حالة <strong className="text-[#D9A3AA]">"بانتظار التأكيد"</strong>.<br />
          ستصلك رسالة عبر الواتساب قريباً تحتوي على تفاصيل فاتورتك.
        </p>
        <Link
          to="/store"
          className="bg-[#4A4A4A] text-white px-8 py-3.5 rounded-full font-bold shadow-md hover:bg-[#D9A3AA] transition-all hover:-translate-y-1"
        >
          العودة للمتجر
        </Link>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8F5F2] font-sans flex flex-col items-center justify-center p-4 text-[#4A4A4A]" dir="rtl">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6 text-[#D9A3AA]/30">
          <ShoppingBag size={40} />
        </div>
        <h2 className="text-2xl font-black mb-2">سلة المشتريات فارغة</h2>
        <p className="text-[#4A4A4A]/50 text-sm mb-8">لم تقومي بإضافة أي منتجات للسلة بعد.</p>
        <Link to="/store" className="bg-[#4A4A4A] text-white px-8 py-3.5 rounded-full font-bold shadow-md hover:bg-[#D9A3AA] transition-colors">
          تصفحي المتجر
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5F2] font-sans text-[#4A4A4A] pb-24" dir="rtl">
      {/* Header */}
      <header className="bg-white sticky top-0 z-40 border-b border-[#D9A3AA]/20 shadow-sm px-4 h-16 flex items-center justify-between">
        <Link to="/store" className="flex items-center gap-2 text-[#4A4A4A]/60 hover:text-[#D9A3AA] text-sm font-bold transition-colors">
          <ArrowRight size={18} /> متابعة التسوق
        </Link>
        <h1 className="text-lg font-black">سلة المشتريات</h1>
        <span className="bg-[#D9A3AA] text-white text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-8">

        {/* قائمة المنتجات */}
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-black text-[#4A4A4A]">منتجاتك</h2>
            <button onClick={clearCart} className="text-xs text-red-400 font-bold hover:text-red-500 transition-colors">
              مسح السلة
            </button>
          </div>

          {cart.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-3xl border border-[#D9A3AA]/15 flex items-center gap-4 shadow-sm">
              <div className="w-16 h-16 bg-[#F8F5F2] rounded-2xl flex items-center justify-center shrink-0 overflow-hidden">
                {item.image
                  ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  : <ImageIcon size={20} className="text-[#D9A3AA]/30" />
                }
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm line-clamp-1">{item.name}</h3>
                <p className="text-[10px] text-[#4A4A4A]/50 mt-1">{item.price} ر.س × {item.qty}</p>
                <div className="font-black text-[#C5A059] text-sm mt-1">{item.price * item.qty} ر.س</div>
              </div>

              <div className="flex flex-col items-center gap-2 shrink-0">
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-red-300 hover:text-red-500 bg-red-50 p-1.5 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                </button>
                <div className="flex items-center gap-2 bg-[#F8F5F2] rounded-xl border border-[#D9A3AA]/20 p-1">
                  <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 bg-white rounded flex items-center justify-center shadow-sm text-[#4A4A4A]">
                    <Plus size={12} />
                  </button>
                  <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                  <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 bg-white rounded flex items-center justify-center shadow-sm text-[#4A4A4A]">
                    <Minus size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ملخص الطلب وبيانات العميل */}
        <div className="space-y-6">
          {/* ملخص */}
          <div className="bg-white p-6 rounded-3xl border border-[#D9A3AA]/20 shadow-sm">
            <h2 className="font-black text-[#4A4A4A] mb-4">ملخص الطلب</h2>
            <div className="space-y-3 mb-6 border-b border-[#F8F5F2] pb-4">
              <div className="flex justify-between text-sm">
                <span className="text-[#4A4A4A]/60">المجموع الفرعي</span>
                <span className="font-bold">{subtotal} ر.س</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#4A4A4A]/60">تكلفة الشحن</span>
                <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-bold">تُحدد عبر واتساب</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-black text-lg">الإجمالي</span>
              <span className="font-black text-2xl text-[#D9A3AA]">{subtotal} <span className="text-sm">ر.س</span></span>
            </div>
          </div>

          {/* بيانات التواصل والشحن */}
          <div className="bg-white p-6 rounded-3xl border border-[#D9A3AA]/20 shadow-sm">
            <h2 className="font-black text-[#4A4A4A] mb-4">بيانات التواصل والشحن</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#4A4A4A]">
                  رقم الجوال <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setPhoneError(false); }}
                  placeholder="05XXXXXXXX"
                  className={`w-full bg-[#F8F5F2] border rounded-xl px-4 py-2.5 outline-none text-right transition-colors ${
                    phoneError
                      ? 'border-red-400 focus:border-red-500 bg-red-50'
                      : 'border-[#D9A3AA]/20 focus:border-[#D9A3AA]'
                  }`}
                />
                {phoneError && (
                  <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={10} /> يرجى إدخال رقم جوال سعودي صحيح
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#4A4A4A]/70">الاسم (اختياري)</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl px-4 py-2.5 outline-none focus:border-[#D9A3AA]"
                />
              </div>

              {/* حقول الشحن */}
              <div className="pt-4 mt-2 border-t border-[#D9A3AA]/20 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold mb-1.5 text-[#4A4A4A]">
                    المدينة <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl px-4 py-2.5 outline-none focus:border-[#D9A3AA] appearance-none"
                  >
                    <option value="">اختر المدينة...</option>
                    <option value="الأحساء">الأحساء</option>
                    <option value="الدمام">الدمام</option>
                    <option value="الخبر">الخبر</option>
                    <option value="الرياض">الرياض</option>
                    <option value="جدة">جدة</option>
                    <option value="مكة المكرمة">مكة المكرمة</option>
                    <option value="أخرى">مدينة أخرى (سيتم التواصل معك)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-[#4A4A4A]">
                    الحي <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={e => setDistrict(e.target.value)}
                    placeholder="اسم الحي"
                    className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl px-4 py-2.5 outline-none focus:border-[#D9A3AA]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-[#4A4A4A]">
                    الشارع / وصف البيت <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={street}
                    onChange={e => setStreet(e.target.value)}
                    placeholder="اسم الشارع أو رقم المبنى"
                    className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl px-4 py-2.5 outline-none focus:border-[#D9A3AA]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#4A4A4A]/70">ملاحظات الطلب (اختياري)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="مثال: طريقة التوصيل المرتجاة..."
                  className="w-full h-20 resize-none bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl px-4 py-2 outline-none focus:border-[#D9A3AA]"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={!phone || !city || !district || !street || isSubmitting}
            className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg ${
              phone && city && district && street && !isSubmitting
                ? 'bg-[#4A4A4A] text-white hover:bg-[#D9A3AA] hover:-translate-y-1'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed pointer-events-none'
            }`}
          >
            {isSubmitting
              ? <><Loader2 size={18} className="animate-spin" /> جاري تسجيل الطلب...</>
              : <><ShoppingBag size={18} /> إتمام الطلب الآن</>
            }
          </button>
        </div>
      </main>
    </div>
  );
}
