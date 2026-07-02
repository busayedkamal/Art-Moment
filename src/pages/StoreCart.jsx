import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Trash2, Plus, Minus, ShoppingBag, AlertCircle, Image as ImageIcon, CheckCircle, Loader2, Wallet, TicketPercent, X, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import {
  getCustomerSession,
  normalizeCustomerPhone,
} from '../utils/customerSession';
import {
  clampCartQuantity,
  getAvailableStock,
  normalizeStockQuantity,
} from '../utils/productStock';

async function getFunctionError(error) {
  try {
    const body = await error?.context?.clone?.().json?.();
    return body?.error || error?.message;
  } catch {
    return error?.message;
  }
}

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
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadCartWithStock = async () => {
      const savedCart = JSON.parse(localStorage.getItem('art_moment_cart')) || [];
      let nextCart = savedCart;

      const productIds = [...new Set(savedCart.map(item => item.id).filter(Boolean))];
      if (productIds.length > 0) {
        try {
          const { data, error } = await supabase
            .from('products')
            .select('id, stock_quantity, in_stock')
            .in('id', productIds);
          if (error) throw error;

          const stockById = new Map((data || []).map(product => [product.id, product]));
          nextCart = savedCart
            .map(item => {
              const productStock = stockById.get(item.id);
              const stockQuantity = normalizeStockQuantity(productStock?.stock_quantity ?? item.stockQuantity);
              const inStock = (productStock?.in_stock ?? item.inStock ?? true) && (stockQuantity === null || stockQuantity > 0);
              const hydratedItem = { ...item, stockQuantity, inStock };
              return { ...hydratedItem, qty: clampCartQuantity(hydratedItem, item.qty) };
            })
            .filter(item => item.inStock !== false && Number(item.qty) > 0);

          if (nextCart.length !== savedCart.length || nextCart.some((item, index) => item.qty !== savedCart[index]?.qty)) {
            localStorage.setItem('art_moment_cart', JSON.stringify(nextCart));
            toast.success('تم تحديث السلة حسب الكمية المتوفرة');
          }
        } catch (error) {
          console.error('Error refreshing cart stock:', error);
        }
      }

      if (!cancelled) setCart(nextCart);
    };

    loadCartWithStock();

    const customer = getCustomerSession();
    if (customer) {
      setName(customer.name || '');
      setPhone(customer.phone || '');

      if (customer.sessionToken) {
        supabase.functions.invoke('customer-account', {
          body: {
            action: 'get',
            sessionToken: customer.sessionToken,
          },
        }).then(({ data, error }) => {
          if (cancelled || error) return;
          const addresses = Array.isArray(data?.customer?.savedAddresses)
            ? data.customer.savedAddresses
            : [];
          setSavedAddresses(addresses);
          if (data?.customer?.name) setName(data.customer.name);
          if (data?.customer?.phone) setPhone(data.customer.phone);

          const firstAddress = addresses[0];
          if (firstAddress) {
            setSelectedAddressId(firstAddress.id || '');
            setCity(firstAddress.city || '');
            setDistrict(firstAddress.district || '');
            setStreet(firstAddress.street || '');
            if (firstAddress.notes) setNotes(current => current || firstAddress.notes);
          }
        }).catch(error => {
          console.error('Error loading customer profile:', error);
        });
      }
    }

    return () => { cancelled = true; };
  }, []);

  const saveCart = (newCart) => {
    setCart(newCart);
    localStorage.setItem('art_moment_cart', JSON.stringify(newCart));
    if (appliedCoupon) setAppliedCoupon(null);
  };

  const updateQty = (id, delta) => {
    let reachedLimit = false;
    const updated = cart.map(item => {
      if (item.id === id) {
        const currentQty = Number(item.qty) || 1;
        const nextQty = clampCartQuantity(item, currentQty + delta);
        if (delta > 0 && nextQty === currentQty && getAvailableStock(item) !== null) {
          reachedLimit = true;
        }
        return { ...item, qty: nextQty };
      }
      return item;
    });
    saveCart(updated);
    if (reachedLimit) toast.error('لا يمكن تجاوز الكمية المتوفرة');
  };

  const removeItem = (id) => saveCart(cart.filter(item => item.id !== id));

  const setExactQty = (id, val) => {
    let reachedLimit = false;
    const updated = cart.map(item => {
      if (item.id !== id) return item;
      if (val === '') return { ...item, qty: '' };
      const num = parseInt(val, 10);
      const nextQty = clampCartQuantity(item, isNaN(num) ? 1 : num);
      if (!isNaN(num) && getAvailableStock(item) !== null && num > nextQty) {
        reachedLimit = true;
      }
      return { ...item, qty: nextQty };
    });
    saveCart(updated);
    if (reachedLimit) toast.error('تم ضبط الكمية على الحد المتوفر');
  };

  const handleBlurQty = (id, currentQty) => {
    if (currentQty === '' || currentQty < 1) setExactQty(id, 1);
  };

  const clearCart = () => {
    if (window.confirm('هل أنت متأكدة من مسح جميع المنتجات؟')) saveCart([]);
  };

  const applySavedAddress = (addressId) => {
    const address = savedAddresses.find(item => String(item.id || '') === String(addressId || ''));
    setSelectedAddressId(addressId);
    if (!address) return;

    setCity(address.city || '');
    setDistrict(address.district || '');
    setStreet(address.street || '');
    if (address.notes) setNotes(current => current || address.notes);
  };

  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) * (Number(item.qty) || 0)), 0);
  const discountAmount = Math.min(subtotal, Number(appliedCoupon?.discountValue || 0));
  const finalTotal = Math.max(0, subtotal - discountAmount);

  const applyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) {
      toast.error('أدخلي كود الخصم أولاً');
      return;
    }
    if (cart.length === 0) return;

    setIsCheckingCoupon(true);
    const toastId = toast.loading('جاري التحقق من الكوبون...');
    try {
      const { data, error } = await supabase.functions.invoke('store-coupons', {
        body: {
          code,
          items: cart.map(item => ({
            id: item.id,
            qty: Number(item.qty) || 1,
          })),
        },
      });
      if (error) throw new Error(await getFunctionError(error));

      setAppliedCoupon(data.coupon);
      setCouponCode(data.coupon.code);
      toast.success(`تم تطبيق خصم ${Number(data.coupon.discountValue || 0).toFixed(2)} ر.س`, { id: toastId });
    } catch (error) {
      console.error('Coupon Error:', error);
      setAppliedCoupon(null);
      toast.error(
        error.message === 'invalid_coupon'
          ? 'الكوبون غير صالح أو غير نشط'
          : 'تعذر تطبيق الكوبون حالياً',
        { id: toastId },
      );
    } finally {
      setIsCheckingCoupon(false);
    }
  };

  const handleCheckout = async () => {
    const isValidPhone = /^(05|9665|\+9665)[0-9]{8}$/.test(phone.trim());
    if (!isValidPhone) { setPhoneError(true); return; }
    setPhoneError(false);

    const exceededItem = cart.find(item => {
      const stock = getAvailableStock(item);
      return stock !== null && Number(item.qty || 0) > stock;
    });
    if (exceededItem) {
      toast.error(`كمية ${exceededItem.name} أعلى من المتوفر`);
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('جاري إرسال الطلب...');

    try {
      const customerSession = getCustomerSession();
      const { error } = await supabase.functions.invoke('store-checkout', {
        body: {
          customer: {
            id: customerSession?.id,
            sessionToken: customerSession?.sessionToken,
            name: name || customerSession?.name,
            phone: normalizeCustomerPhone(phone),
            notes,
            city,
            district,
            street,
          },
          items: cart.map(item => ({
            id: item.id,
            qty: Number(item.qty) || 1,
          })),
          payment: {
            method: paymentMethod,
          },
          couponCode: appliedCoupon?.code || null,
        },
      });

      if (error) {
        throw new Error(await getFunctionError(error));
      }

      saveCart([]);
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
      <div className="art-page min-h-screen font-sans flex flex-col items-center justify-center p-4 text-[#4A4A4A]" dir="rtl">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center shadow-sm mb-6 animate-in zoom-in duration-500">
          <CheckCircle size={40} />
        </div>
        <h2 className="text-2xl md:text-3xl font-black mb-3 text-center">تم استلام طلبك بنجاح! 🎉</h2>
        <p className="text-[#4A4A4A]/60 text-sm md:text-base mb-8 text-center max-w-md leading-relaxed">
          طلبك الآن في حالة <strong className="text-[#D9A3AA]">"بانتظار التأكيد"</strong>.<br />
          وحالة الدفع <strong className="text-red-500">بانتظار الدفع</strong>. يمكنك متابعة التفاصيل من صفحة طلباتي.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/store/orders"
            className="bg-[#4A4A4A] text-white px-8 py-3.5 rounded-full font-bold shadow-md hover:bg-[#D9A3AA] transition-all hover:-translate-y-1"
          >
            عرض طلباتي
          </Link>
          <Link
            to="/store"
            className="bg-white text-[#4A4A4A] border border-[#D9A3AA]/20 px-8 py-3.5 rounded-full font-bold shadow-sm hover:bg-[#F8F5F2] transition-all"
          >
            العودة للمتجر
          </Link>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="art-page min-h-screen font-sans flex flex-col items-center justify-center p-4 text-[#4A4A4A]" dir="rtl">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6 text-[#D9A3AA]/30">
          <ShoppingBag size={40} />
        </div>
        <h2 className="text-2xl font-black mb-2">سلة المشتريات فارغة</h2>
        <p className="text-[#4A4A4A]/50 text-sm mb-8">لم تقم بإضافة أي منتجات للسلة بعد.</p>
        <Link to="/store" className="bg-[#4A4A4A] text-white px-8 py-3.5 rounded-full font-bold shadow-md hover:bg-[#D9A3AA] transition-colors">
          تصفح المتجر
        </Link>
      </div>
    );
  }

  return (
    <div className="art-page min-h-screen font-sans text-[#4A4A4A] pb-24" dir="rtl">
      {/* Header */}
      <header className="art-nav art-nav-scrolled sticky top-0 z-40 px-4 h-16 flex items-center justify-between">
        <Link to="/store" className="flex items-center gap-2 text-[#4A4A4A]/60 hover:text-[#D9A3AA] text-sm font-bold transition-colors">
          <ArrowRight size={18} /> متابعة التسوق
        </Link>
        <h1 className="text-lg font-black">سلة المشتريات</h1>
        <span className="bg-[#D9A3AA] text-white text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>
      </header>

      <main className="art-shell py-8 grid lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)] gap-5 lg:gap-8">

        {/* قائمة المنتجات */}
        <div className="space-y-4 min-w-0">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-black text-[#4A4A4A]">منتجاتك</h2>
            <button onClick={clearCart} className="text-xs text-red-400 font-bold hover:text-red-500 transition-colors">
              مسح السلة
            </button>
          </div>

          {cart.map(item => {
            const availableStock = getAvailableStock(item);
            const reachedMax = availableStock !== null && Number(item.qty || 0) >= availableStock;

            return (
            <div key={item.id} className="bg-white p-4 sm:p-5 rounded-3xl border border-[#D9A3AA]/15 flex items-center gap-4 sm:gap-5 shadow-sm">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#F8F5F2] rounded-2xl flex items-center justify-center shrink-0 overflow-hidden">
                {item.image
                  ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  : <ImageIcon size={20} className="text-[#D9A3AA]/30" />
                }
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm line-clamp-1">{item.name}</h3>
                <p className="text-[10px] text-[#4A4A4A]/50 mt-1">{item.price} ر.س × {item.qty}</p>
                <p className={`text-[10px] font-bold mt-1 ${reachedMax ? 'text-amber-600' : 'text-[#4A4A4A]/45'}`}>
                  {availableStock === null ? 'الكمية متاحة' : `المتوفر: ${availableStock}`}
                </p>
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
                  <button
                    onClick={() => updateQty(item.id, 1)}
                    disabled={reachedMax}
                    className={`w-6 h-6 bg-white rounded flex items-center justify-center shadow-sm transition-colors ${
                      reachedMax ? 'text-[#4A4A4A]/25 cursor-not-allowed' : 'text-[#4A4A4A]'
                    }`}
                  >
                    <Plus size={12} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={availableStock ?? undefined}
                    value={item.qty}
                    onChange={e => setExactQty(item.id, e.target.value)}
                    onBlur={() => handleBlurQty(item.id, item.qty)}
                    className="w-10 text-center font-black text-sm text-[#4A4A4A] bg-transparent outline-none focus:bg-white rounded-md transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    dir="ltr"
                  />
                  <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 bg-white rounded flex items-center justify-center shadow-sm text-[#4A4A4A]">
                    <Minus size={12} />
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {/* ملخص الطلب وبيانات العميل */}
        <div className="space-y-6 min-w-0">
          {/* ملخص */}
          <div className="art-panel p-6 rounded-[1.5rem]">
            <h2 className="font-black text-[#4A4A4A] mb-4">ملخص الطلب</h2>
            <div className="space-y-3 mb-6 border-b border-[#F8F5F2] pb-4">
              <div className="flex justify-between text-sm">
                <span className="text-[#4A4A4A]/60">المجموع الفرعي</span>
                <span className="font-bold">{subtotal} ر.س</span>
              </div>
              <div className="rounded-2xl bg-[#F8F5F2] border border-[#D9A3AA]/15 p-3">
                <label className="mb-2 flex items-center gap-2 text-xs font-black text-[#4A4A4A]/60">
                  <TicketPercent size={14} className="text-[#C5A059]" /> كوبون خصم
                </label>
                <div className="flex gap-2">
                  <input
                    value={couponCode}
                    onChange={e => {
                      setCouponCode(e.target.value.toUpperCase());
                      if (appliedCoupon) setAppliedCoupon(null);
                    }}
                    onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                    placeholder="مثال: AM10"
                    className="min-w-0 flex-1 rounded-xl border border-[#D9A3AA]/15 bg-white px-3 py-2 text-sm font-black outline-none focus:border-[#D9A3AA]"
                    dir="ltr"
                  />
                  {appliedCoupon ? (
                    <button
                      type="button"
                      onClick={() => { setAppliedCoupon(null); setCouponCode(''); }}
                      className="h-10 w-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                      title="إزالة الكوبون"
                    >
                      <X size={15} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={isCheckingCoupon || !couponCode.trim()}
                      className="px-4 rounded-xl bg-[#4A4A4A] text-white text-xs font-black disabled:opacity-45 flex items-center gap-2"
                    >
                      {isCheckingCoupon && <Loader2 size={13} className="animate-spin" />}
                      تطبيق
                    </button>
                  )}
                </div>
                {appliedCoupon && (
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs font-black text-emerald-600">
                    <span>{appliedCoupon.code}</span>
                    <span>-{discountAmount.toFixed(2)} ر.س</span>
                  </div>
                )}
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>خصم الكوبون</span>
                  <span className="font-bold">-{discountAmount.toFixed(2)} ر.س</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-[#4A4A4A]/60">تكلفة الشحن</span>
                <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-bold">تُحدد عبر واتساب</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-black text-lg">الإجمالي</span>
              <span className="font-black text-2xl text-[#D9A3AA]">{finalTotal.toFixed(2)} <span className="text-sm">ر.س</span></span>
            </div>
          </div>

          {/* بيانات التواصل والشحن */}
          <div className="art-panel p-6 rounded-[1.5rem]">
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
                  className={`art-input w-full rounded-xl px-4 py-2.5 outline-none text-right ${
                    phoneError
                      ? 'border-red-400 focus:border-red-500 bg-red-50'
                      : 'border-[#D9A3AA]/20 focus:border-[#D9A3AA]'
                  }`}
                />
                {phoneError && (
                  <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={10} /> يرجى إدخال رقم جوال صحيح
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#4A4A4A]/70">الاسم (اختياري)</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="art-input w-full rounded-xl px-4 py-2.5 outline-none"
                />
              </div>

              {savedAddresses.length > 0 ? (
                <div className="rounded-2xl border border-[#D9A3AA]/15 bg-[#F8F5F2] p-3">
                  <label className="mb-2 flex items-center gap-2 text-xs font-black text-[#4A4A4A]/65">
                    <MapPin size={14} className="text-[#C5A059]" /> العناوين المحفوظة
                  </label>
                  <select
                    value={selectedAddressId}
                    onChange={e => applySavedAddress(e.target.value)}
                    className="w-full rounded-xl border border-[#D9A3AA]/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-[#D9A3AA]"
                  >
                    {savedAddresses.map((address, index) => (
                      <option key={address.id || index} value={address.id || ''}>
                        {address.label || `عنوان ${index + 1}`} - {[address.city, address.district].filter(Boolean).join(' / ') || 'بدون تفاصيل'}
                      </option>
                    ))}
                  </select>
                </div>
              ) : getCustomerSession()?.sessionToken ? (
                <Link
                  to="/store/account"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[#D9A3AA]/25 bg-[#F8F5F2] px-4 py-3 text-xs font-black text-[#4A4A4A]/65 hover:border-[#D9A3AA] hover:text-[#D9A3AA] transition-colors"
                >
                  <span className="flex items-center gap-2"><MapPin size={14} /> لا توجد عناوين محفوظة</span>
                  <span>إضافة عنوان</span>
                </Link>
              ) : null}

              {/* حقول الشحن */}
              <div className="pt-4 mt-2 border-t border-[#D9A3AA]/20 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold mb-1.5 text-[#4A4A4A]">
                    المدينة <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="art-input w-full rounded-xl px-4 py-2.5 outline-none appearance-none"
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
                    className="art-input w-full rounded-xl px-4 py-2.5 outline-none"
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
                    className="art-input w-full rounded-xl px-4 py-2.5 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#4A4A4A]/70">ملاحظات الطلب (اختياري)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="مثال: طريقة التوصيل المرتجاة..."
                  className="art-input w-full h-20 resize-none rounded-xl px-4 py-2 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="art-panel p-6 rounded-[1.5rem]">
            <h2 className="font-black text-[#4A4A4A] mb-4 flex items-center gap-2">
              <Wallet size={18} className="text-[#C5A059]" /> طريقة الدفع
            </h2>
            <div className="grid gap-3">
              {[
                {
                  value: 'bank_transfer',
                  title: 'تحويل بنكي',
                  description: 'سيظهر الطلب بانتظار الدفع، وبعد التحويل تراجعه الإدارة وتؤكد الدفع.',
                },
                {
                  value: 'cash_on_delivery',
                  title: 'الدفع عند الاستلام',
                  description: 'يتم تنسيق الدفع مع الإدارة حسب توفر خيار الاستلام أو التوصيل.',
                },
              ].map(method => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value)}
                  className={`text-right rounded-2xl border p-4 transition-all ${
                    paymentMethod === method.value
                      ? 'border-[#C5A059] bg-[#C5A059]/10 shadow-sm'
                      : 'border-[#D9A3AA]/15 bg-white hover:border-[#D9A3AA]/35'
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-black text-[#4A4A4A]">{method.title}</span>
                    <span className={`h-4 w-4 rounded-full border-2 ${
                      paymentMethod === method.value ? 'border-[#C5A059] bg-[#C5A059]' : 'border-[#D9A3AA]/30'
                    }`} />
                  </span>
                  <span className="block mt-1 text-xs leading-relaxed text-[#4A4A4A]/55">{method.description}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={!phone || !city || !district || !street || isSubmitting}
            className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg ${
              phone && city && district && street && !isSubmitting
                ? 'art-cta'
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
