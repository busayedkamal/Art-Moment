import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Trash2, Plus, Minus, ShoppingBag, AlertCircle, Image as ImageIcon, CheckCircle, Loader2, Wallet, TicketPercent, X, MapPin, LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import CustomerAuthModal from '../components/CustomerAuthModal';
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
import { getCartLineKey, getSelectedOptionLabels } from '../utils/productOptions';
import { getStoreAnonymousId, trackStoreEvent } from '../utils/storeAnalytics';

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
  const [rewardSummary, setRewardSummary] = useState(null);
  const [useRewardPoints, setUseRewardPoints] = useState(false);
  const [rewardPointsInput, setRewardPointsInput] = useState('');
  const [cartHydrated, setCartHydrated] = useState(false);
  const [remoteRestoreChecked, setRemoteRestoreChecked] = useState(false);
  const [customerSession, setCustomerSession] = useState(() => getCustomerSession());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState('login');

  const openCustomerAuth = (nextMode = 'login') => {
    setAuthInitialMode(nextMode);
    setIsAuthModalOpen(true);
  };

  useEffect(() => {
    let cancelled = false;

    const loadCartWithStock = async () => {
      const savedCart = JSON.parse(localStorage.getItem('art_moment_cart')) || [];
      let nextCart = savedCart.map((item) => ({
        ...item,
        cartKey: item.cartKey || getCartLineKey(item.id, item.selectedOptions),
      }));

      const productIds = [...new Set(savedCart.map(item => item.id).filter(Boolean))];
      if (productIds.length > 0) {
        try {
          const { data, error } = await supabase
            .from('products')
            .select('id, stock_quantity, in_stock')
            .in('id', productIds);
          if (error) throw error;

          const stockById = new Map((data || []).map(product => [product.id, product]));
          nextCart = nextCart
            .map(item => {
              const productStock = stockById.get(item.id);
              const stockQuantity = normalizeStockQuantity(productStock?.stock_quantity ?? item.stockQuantity);
              const inStock = (productStock?.in_stock ?? item.inStock ?? true) && (stockQuantity === null || stockQuantity > 0);
              const hydratedItem = {
                ...item,
                cartKey: item.cartKey || getCartLineKey(item.id, item.selectedOptions),
                stockQuantity,
                inStock,
              };
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

      if (!cancelled) {
        setCart(nextCart);
        setCartHydrated(true);
      }
      trackStoreEvent('cart_view', {
        itemCount: nextCart.reduce((sum, item) => sum + Number(item.qty || 0), 0),
        value: nextCart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0),
      });
    };

    loadCartWithStock();

    const customer = getCustomerSession();
    if (customer) {
      setCustomerSession(customer);
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
          setRewardSummary(data?.rewards || null);

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

  useEffect(() => {
    const customerSession = getCustomerSession();
    if (!customerSession?.sessionToken) {
      setRemoteRestoreChecked(true);
      return undefined;
    }
    let cancelled = false;

    supabase.functions.invoke('abandoned-cart', {
      body: { action: 'get', sessionToken: customerSession.sessionToken },
    }).then(({ data, error }) => {
      if (cancelled || error || !Array.isArray(data?.cart?.items) || data.cart.items.length === 0) return;
      const localCart = JSON.parse(localStorage.getItem('art_moment_cart') || '[]');
      if (localCart.length > 0) return;

      const restored = data.cart.items.map((item) => ({
        ...item,
        cartKey: item.cartKey || getCartLineKey(item.id, item.selectedOptions),
      }));
      localStorage.setItem('art_moment_cart', JSON.stringify(restored));
      setCart(restored);
      toast.success('تمت استعادة سلتك المحفوظة');
    }).finally(() => {
      if (!cancelled) setRemoteRestoreChecked(true);
    });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!cartHydrated || !remoteRestoreChecked) return undefined;
    const customerSession = getCustomerSession();
    if (!customerSession?.sessionToken) return undefined;

    const timeoutId = window.setTimeout(() => {
      void supabase.functions.invoke('abandoned-cart', {
        body: {
          action: 'sync',
          sessionToken: customerSession.sessionToken,
          anonymousId: getStoreAnonymousId(),
          items: cart.map((item) => ({
            id: item.id,
            qty: Number(item.qty || 0),
            selectedOptions: item.selectedOptions || {},
          })),
        },
      });
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [cart, cartHydrated, remoteRestoreChecked]);

  const saveCart = (newCart) => {
    setCart(newCart);
    localStorage.setItem('art_moment_cart', JSON.stringify(newCart));
    if (appliedCoupon) setAppliedCoupon(null);
  };

  const getItemKey = (item) => String(item.cartKey || getCartLineKey(item.id, item.selectedOptions));

  const updateQty = (itemKey, delta) => {
    let reachedLimit = false;
    const updated = cart.map(item => {
      if (getItemKey(item) === String(itemKey)) {
        const currentQty = Number(item.qty) || 1;
        const availableStock = getAvailableStock(item);
        const otherQuantity = cart
          .filter((other) => String(other.id) === String(item.id) && getItemKey(other) !== String(itemKey))
          .reduce((sum, other) => sum + Number(other.qty || 0), 0);
        const lineStock = availableStock === null ? null : Math.max(0, availableStock - otherQuantity);
        const nextQty = clampCartQuantity({ ...item, stockQuantity: lineStock }, currentQty + delta);
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

  const removeItem = (itemKey) => saveCart(cart.filter(item => getItemKey(item) !== String(itemKey)));

  const setExactQty = (itemKey, val) => {
    let reachedLimit = false;
    const updated = cart.map(item => {
      if (getItemKey(item) !== String(itemKey)) return item;
      if (val === '') return { ...item, qty: '' };
      const num = parseInt(val, 10);
      const availableStock = getAvailableStock(item);
      const otherQuantity = cart
        .filter((other) => String(other.id) === String(item.id) && getItemKey(other) !== String(itemKey))
        .reduce((sum, other) => sum + Number(other.qty || 0), 0);
      const lineStock = availableStock === null ? null : Math.max(0, availableStock - otherQuantity);
      const nextQty = clampCartQuantity({ ...item, stockQuantity: lineStock }, isNaN(num) ? 1 : num);
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
  const rewardPointValue = Number(rewardSummary?.pointValue || 0.01);
  const availableRewardPoints = Math.max(0, Number(rewardSummary?.points || 0));
  const minimumRewardPoints = Math.max(0, Number(rewardSummary?.minimumRedemptionPoints || 500));
  const maximumRewardPercent = Math.max(0, Number(rewardSummary?.maximumRedemptionPercent || 25));
  const maximumRewardPoints = Math.max(0, Math.min(
    availableRewardPoints,
    Math.floor((finalTotal * maximumRewardPercent / 100) / rewardPointValue),
  ));
  const requestedRewardPoints = useRewardPoints
    ? Math.max(0, Math.floor(Number(rewardPointsInput) || 0))
    : 0;
  const displayedRewardPoints = Math.min(requestedRewardPoints, maximumRewardPoints);
  const rewardDiscountValue = Number((displayedRewardPoints * rewardPointValue).toFixed(2));
  const payableTotal = Math.max(0, Number((finalTotal - rewardDiscountValue).toFixed(2)));
  const canUseRewardPoints = rewardSummary?.enabled !== false
    && availableRewardPoints >= minimumRewardPoints
    && maximumRewardPoints >= minimumRewardPoints;

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
    const activeCustomerSession = getCustomerSession();
    if (!activeCustomerSession?.sessionToken) {
      openCustomerAuth('login');
      toast('سجّلي الدخول أو أنشئي حساباً لإتمام الطلب مع حفظ سلتك.');
      return;
    }

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
    if (useRewardPoints) {
      if (!getCustomerSession()?.sessionToken) {
        toast.error('سجّلي الدخول أولاً لاستخدام النقاط');
        return;
      }
      if (requestedRewardPoints < minimumRewardPoints) {
        toast.error(`الحد الأدنى للاستبدال ${minimumRewardPoints.toLocaleString()} نقطة`);
        return;
      }
      if (requestedRewardPoints > maximumRewardPoints) {
        toast.error(`الحد الأعلى لهذا الطلب ${maximumRewardPoints.toLocaleString()} نقطة`);
        return;
      }
    }

    setIsSubmitting(true);
    const toastId = toast.loading('جاري إرسال الطلب...');

    try {
      const customerSession = getCustomerSession();
      trackStoreEvent('checkout_started', {
        itemCount: cart.reduce((sum, item) => sum + Number(item.qty || 0), 0),
        value: payableTotal,
        paymentMethod,
      });

      const { data, error } = await supabase.functions.invoke('store-checkout', {
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
            selectedOptions: item.selectedOptions || {},
          })),
          payment: {
            method: paymentMethod,
          },
          couponCode: appliedCoupon?.code || null,
          rewardPoints: requestedRewardPoints,
        },
      });

      if (error) {
        throw new Error(await getFunctionError(error));
      }

      saveCart([]);
      if (customerSession?.sessionToken) {
        void supabase.functions.invoke('abandoned-cart', {
          body: {
            action: 'complete',
            sessionToken: customerSession.sessionToken,
            orderId: data?.order?.id || null,
          },
        });
      }
      trackStoreEvent('order_created', {
        orderId: data?.order?.id || null,
        value: Number(data?.order?.total_amount || payableTotal),
        paymentMethod,
      });
      toast.success('تم استلام طلبك بنجاح!', { id: toastId });
      setIsSubmitted(true);
    } catch (error) {
      console.error('Checkout Error:', error);
      const checkoutMessages = {
        reward_points_balance_insufficient: 'رصيد النقاط غير كافٍ. حدّثي الصفحة ثم حاولي مجدداً.',
        reward_redemption_limit_exceeded: `الحد الأعلى لهذا الطلب ${maximumRewardPoints.toLocaleString()} نقطة.`,
        reward_minimum_redemption_not_met: `الحد الأدنى للاستبدال ${minimumRewardPoints.toLocaleString()} نقطة.`,
        reward_program_disabled: 'استخدام النقاط متوقف مؤقتاً.',
        reward_points_migration_required: 'نظام النقاط قيد التحديث. حاولي بعد قليل.',
        invalid_product_options: 'تحققي من اختيار المقاس أو اللون أو الخامة لكل منتج.',
      };
      toast.error(checkoutMessages[error.message] || 'حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="art-page min-h-screen font-[Tajawal] flex flex-col items-center justify-center p-4 text-[#171717]" dir="rtl">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center shadow-sm mb-6 animate-in zoom-in duration-500">
          <CheckCircle size={40} />
        </div>
        <h2 className="text-2xl md:text-3xl font-black mb-3 text-center">تم استلام طلبك بنجاح! 🎉</h2>
        <p className="text-[#171717]/60 text-sm md:text-base mb-8 text-center max-w-md leading-relaxed">
          طلبك الآن في حالة <strong className="text-[#E8B4BC]">"بانتظار التأكيد"</strong>.<br />
          وحالة الدفع <strong className="text-red-500">بانتظار الدفع</strong>. يمكنك متابعة التفاصيل من صفحة طلباتي.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/store/orders"
            className="bg-[#171717] text-white px-8 py-3.5 rounded-full font-bold shadow-md hover:bg-[#E8B4BC] transition-all hover:-translate-y-1"
          >
            عرض طلباتي
          </Link>
          <Link
            to="/store"
            className="bg-white text-[#171717] border border-[#E8B4BC]/20 px-8 py-3.5 rounded-full font-bold shadow-sm hover:bg-[#FAF9F7] transition-all"
          >
            العودة للمتجر
          </Link>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="art-page min-h-screen font-[Tajawal] flex flex-col items-center justify-center p-4 text-[#171717]" dir="rtl">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6 text-[#E8B4BC]/30">
          <ShoppingBag size={40} />
        </div>
        <h2 className="text-2xl font-black mb-2">سلة المشتريات فارغة</h2>
        <p className="text-[#171717]/50 text-sm mb-8">لم تقم بإضافة أي منتجات للسلة بعد.</p>
        <Link to="/store" className="bg-[#171717] text-white px-8 py-3.5 rounded-full font-bold shadow-md hover:bg-[#E8B4BC] transition-colors">
          تصفح المتجر
        </Link>
      </div>
    );
  }

  return (
    <div className="art-page min-h-screen font-[Tajawal] text-[#171717] pb-24" dir="rtl">
      {/* Header */}
      <header className="art-nav art-nav-scrolled sticky top-0 z-40 px-4 h-16 flex items-center justify-between">
        <Link to="/store" className="flex items-center gap-2 text-[#171717]/60 hover:text-[#E8B4BC] text-sm font-bold transition-colors">
          <ArrowRight size={18} /> متابعة التسوق
        </Link>
        <h1 className="text-lg font-black">سلة المشتريات</h1>
        <span className="bg-[#E8B4BC] text-white text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>
      </header>

      <main className="art-shell py-8 grid lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)] gap-5 lg:gap-8">

        {/* قائمة المنتجات */}
        <div className="space-y-4 min-w-0">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-black text-[#171717]">منتجاتك</h2>
            <button onClick={clearCart} className="text-xs text-red-400 font-bold hover:text-red-500 transition-colors">
              مسح السلة
            </button>
          </div>

          {cart.map(item => {
            const availableStock = getAvailableStock(item);
            const reachedMax = availableStock !== null && Number(item.qty || 0) >= availableStock;
            const itemKey = getItemKey(item);
            const optionLabels = Array.isArray(item.selectedOptionLabels) && item.selectedOptionLabels.length > 0
              ? item.selectedOptionLabels
              : getSelectedOptionLabels(item.productOptions, item.selectedOptions);

            return (
            <div key={itemKey} className="bg-white p-4 sm:p-5 rounded-3xl border border-[#E8B4BC]/15 flex items-center gap-4 sm:gap-5 shadow-sm">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#FAF9F7] rounded-2xl flex items-center justify-center shrink-0 overflow-hidden">
                {item.image
                  ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  : <ImageIcon size={20} className="text-[#E8B4BC]/30" />
                }
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm line-clamp-1">{item.name}</h3>
                {optionLabels.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {optionLabels.map((option) => (
                      <span key={option.id} className="rounded-full bg-[#FAF9F7] px-2 py-0.5 text-[9px] font-black text-[#171717]/60">
                        {option.name}: {option.label}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-[#171717]/50 mt-1">{item.price} ر.س × {item.qty}</p>
                <p className={`text-[10px] font-bold mt-1 ${reachedMax ? 'text-amber-600' : 'text-[#171717]/45'}`}>
                  {availableStock === null ? 'الكمية متاحة' : `المتوفر: ${availableStock}`}
                </p>
                <div className="font-black text-[#C6A56B] text-sm mt-1">{item.price * item.qty} ر.س</div>
              </div>

              <div className="flex flex-col items-center gap-2 shrink-0">
                <button
                  onClick={() => removeItem(itemKey)}
                  className="text-red-300 hover:text-red-500 bg-red-50 p-1.5 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                </button>
                <div className="flex items-center gap-2 bg-[#FAF9F7] rounded-xl border border-[#E8B4BC]/20 p-1">
                  <button
                    onClick={() => updateQty(itemKey, 1)}
                    disabled={reachedMax}
                    className={`w-6 h-6 bg-white rounded flex items-center justify-center shadow-sm transition-colors ${
                      reachedMax ? 'text-[#171717]/25 cursor-not-allowed' : 'text-[#171717]'
                    }`}
                  >
                    <Plus size={12} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={availableStock ?? undefined}
                    value={item.qty}
                    onChange={e => setExactQty(itemKey, e.target.value)}
                    onBlur={() => handleBlurQty(itemKey, item.qty)}
                    className="w-10 text-center font-black text-sm text-[#171717] bg-transparent outline-none focus:bg-white rounded-md transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    dir="ltr"
                  />
                  <button onClick={() => updateQty(itemKey, -1)} className="w-6 h-6 bg-white rounded flex items-center justify-center shadow-sm text-[#171717]">
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
            <h2 className="font-black text-[#171717] mb-4">ملخص الطلب</h2>
            <div className="space-y-3 mb-6 border-b border-[#FAF9F7] pb-4">
              <div className="flex justify-between text-sm">
                <span className="text-[#171717]/60">المجموع الفرعي</span>
                <span className="font-bold">{subtotal} ر.س</span>
              </div>
              <div className="rounded-2xl bg-[#FAF9F7] border border-[#E8B4BC]/15 p-3">
                <label className="mb-2 flex items-center gap-2 text-xs font-black text-[#171717]/60">
                  <TicketPercent size={14} className="text-[#C6A56B]" /> كوبون خصم
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
                    className="min-w-0 flex-1 rounded-xl border border-[#E8B4BC]/15 bg-white px-3 py-2 text-sm font-black outline-none focus:border-[#E8B4BC]"
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
                      className="px-4 rounded-xl bg-[#171717] text-white text-xs font-black disabled:opacity-45 flex items-center gap-2"
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
              {rewardSummary && (
                <div className="rounded-2xl border border-[#E8B4BC]/20 bg-[#E8B4BC]/[0.06] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-black text-[#171717]">
                        <Wallet size={14} className="text-[#E8B4BC]" /> نقاط لحظة فن
                      </p>
                      <p className="mt-1 text-[10px] text-[#171717]/55">
                        {availableRewardPoints.toLocaleString()} نقطة = {Number(rewardSummary.valueSar || 0).toFixed(2)} ر.س
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!canUseRewardPoints}
                      onClick={() => {
                        const next = !useRewardPoints;
                        setUseRewardPoints(next);
                        setRewardPointsInput(next ? String(maximumRewardPoints) : '');
                      }}
                      className={`h-8 rounded-lg px-3 text-[11px] font-black transition-colors ${
                        useRewardPoints
                          ? 'bg-[#E8B4BC] text-white'
                          : canUseRewardPoints
                            ? 'bg-white text-[#B97882] border border-[#E8B4BC]/25'
                            : 'bg-white/70 text-[#171717]/30 cursor-not-allowed'
                      }`}
                    >
                      {useRewardPoints ? 'إلغاء الاستخدام' : 'استخدام النقاط'}
                    </button>
                  </div>
                  {useRewardPoints ? (
                    <div className="mt-3">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={minimumRewardPoints}
                          max={maximumRewardPoints}
                          step="1"
                          value={rewardPointsInput}
                          onChange={(event) => setRewardPointsInput(event.target.value.replace(/\D/g, ''))}
                          className="min-w-0 flex-1 rounded-xl border border-[#E8B4BC]/20 bg-white px-3 py-2 text-center text-sm font-black outline-none focus:border-[#E8B4BC]"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => setRewardPointsInput(String(maximumRewardPoints))}
                          className="rounded-xl bg-white px-3 text-[11px] font-black text-[#B97882] border border-[#E8B4BC]/20"
                        >
                          الحد الأعلى
                        </button>
                      </div>
                      <div className="mt-2 flex justify-between text-[10px] text-[#171717]/50">
                        <span>الحد الأدنى {minimumRewardPoints.toLocaleString()} نقطة</span>
                        <span>خصم {rewardDiscountValue.toFixed(2)} ر.س</span>
                      </div>
                    </div>
                  ) : !canUseRewardPoints ? (
                    <p className="mt-2 text-[10px] text-[#171717]/45">
                      يبدأ الاستخدام من {minimumRewardPoints.toLocaleString()} نقطة وبحد أقصى {maximumRewardPercent}% من الطلب.
                    </p>
                  ) : null}
                </div>
              )}
              {rewardDiscountValue > 0 && (
                <div className="flex justify-between text-sm text-[#B97882]">
                  <span>مدفوع بالنقاط ({displayedRewardPoints.toLocaleString()})</span>
                  <span className="font-bold">-{rewardDiscountValue.toFixed(2)} ر.س</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-[#171717]/60">تكلفة الشحن</span>
                <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-bold">تُحدد عبر واتساب</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-black text-lg">المتبقي للدفع</span>
              <span className="font-black text-2xl text-[#E8B4BC]">{payableTotal.toFixed(2)} <span className="text-sm">ر.س</span></span>
            </div>
          </div>

          <div className={`rounded-[1.5rem] border p-5 sm:p-6 shadow-sm ${customerSession?.sessionToken ? 'border-emerald-200 bg-emerald-50/70' : 'border-[#E8B4BC]/20 bg-white'}`}>
            {customerSession?.sessionToken ? (
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-black text-[#171717]">
                    <ShieldCheck size={18} className="text-emerald-600" /> حسابك مرتبط بالطلب
                  </p>
                  <p className="mt-1 truncate text-xs text-[#171717]/55">
                    {customerSession.name || customerSession.email || customerSession.phone}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-700">مسجل الدخول</span>
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <h2 className="flex items-center gap-2 font-black text-[#171717]">
                    <LogIn size={18} className="text-[#C6A56B]" /> الحساب وإتمام الطلب
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-[#171717]/55">
                    سجّلي الدخول إن كان لديك حساب، أو أنشئي حساباً جديداً. ستبقى المنتجات في سلتك وتُربط بطلباتك تلقائياً.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => openCustomerAuth('login')}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 text-sm font-black text-white transition-colors hover:bg-[#E8B4BC]"
                  >
                    <LogIn size={17} /> تسجيل الدخول
                  </button>
                  <button
                    type="button"
                    onClick={() => openCustomerAuth('signup')}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#C6A56B]/30 bg-[#C6A56B]/10 px-4 text-sm font-black text-[#8A6A2F] transition-colors hover:bg-[#C6A56B]/20"
                  >
                    <UserPlus size={17} /> إنشاء حساب جديد
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* بيانات التواصل والشحن */}
          <div className="art-panel p-6 rounded-[1.5rem]">
            <h2 className="font-black text-[#171717] mb-4">بيانات التواصل والشحن</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#171717]">
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
                      : 'border-[#E8B4BC]/20 focus:border-[#E8B4BC]'
                  }`}
                />
                {phoneError && (
                  <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={10} /> يرجى إدخال رقم جوال صحيح
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#171717]/70">الاسم (اختياري)</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="art-input w-full rounded-xl px-4 py-2.5 outline-none"
                />
              </div>

              {savedAddresses.length > 0 ? (
                <div className="rounded-2xl border border-[#E8B4BC]/15 bg-[#FAF9F7] p-3">
                  <label className="mb-2 flex items-center gap-2 text-xs font-black text-[#171717]/65">
                    <MapPin size={14} className="text-[#C6A56B]" /> العناوين المحفوظة
                  </label>
                  <select
                    value={selectedAddressId}
                    onChange={e => applySavedAddress(e.target.value)}
                    className="w-full rounded-xl border border-[#E8B4BC]/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-[#E8B4BC]"
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
                  className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[#E8B4BC]/25 bg-[#FAF9F7] px-4 py-3 text-xs font-black text-[#171717]/65 hover:border-[#E8B4BC] hover:text-[#E8B4BC] transition-colors"
                >
                  <span className="flex items-center gap-2"><MapPin size={14} /> لا توجد عناوين محفوظة</span>
                  <span>إضافة عنوان</span>
                </Link>
              ) : null}

              {/* حقول الشحن */}
              <div className="pt-4 mt-2 border-t border-[#E8B4BC]/20 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold mb-1.5 text-[#171717]">
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
                  <label className="block text-xs font-bold mb-1.5 text-[#171717]">
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
                  <label className="block text-xs font-bold mb-1.5 text-[#171717]">
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
                <label className="block text-xs font-bold mb-1.5 text-[#171717]/70">ملاحظات الطلب (اختياري)</label>
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
            <h2 className="font-black text-[#171717] mb-4 flex items-center gap-2">
              <Wallet size={18} className="text-[#C6A56B]" /> طريقة الدفع
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
                      ? 'border-[#C6A56B] bg-[#C6A56B]/10 shadow-sm'
                      : 'border-[#E8B4BC]/15 bg-white hover:border-[#E8B4BC]/35'
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-black text-[#171717]">{method.title}</span>
                    <span className={`h-4 w-4 rounded-full border-2 ${
                      paymentMethod === method.value ? 'border-[#C6A56B] bg-[#C6A56B]' : 'border-[#E8B4BC]/30'
                    }`} />
                  </span>
                  <span className="block mt-1 text-xs leading-relaxed text-[#171717]/55">{method.description}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={customerSession?.sessionToken ? (!phone || !city || !district || !street || isSubmitting) : isSubmitting}
            className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg ${
              (!customerSession?.sessionToken || (phone && city && district && street)) && !isSubmitting
                ? 'art-cta'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed pointer-events-none'
            }`}
          >
            {isSubmitting
              ? <><Loader2 size={18} className="animate-spin" /> جاري تسجيل الطلب...</>
              : customerSession?.sessionToken
                ? <><ShoppingBag size={18} /> إتمام الطلب الآن</>
                : <><LogIn size={18} /> تسجيل الدخول لإتمام الطلب</>
            }
          </button>
        </div>
      </main>

      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        initialMode={authInitialMode}
        redirectTo="/store/cart"
        onClose={() => {
          setIsAuthModalOpen(false);
          const nextSession = getCustomerSession();
          setCustomerSession(nextSession);
          if (nextSession?.name) setName(nextSession.name);
          if (nextSession?.phone) setPhone(nextSession.phone);
        }}
      />
    </div>
  );
}
