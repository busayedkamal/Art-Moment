import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Trash2, Plus, Minus, ShoppingBag, AlertCircle, Image as ImageIcon, CheckCircle, Loader2, Wallet, TicketPercent, X, MapPin, LogIn, UserPlus, ShieldCheck, Pencil, Files, Package, ChevronLeft } from 'lucide-react';
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
import { formatPrintOptionSummary } from '../utils/printOptions';
import { getStoreAnonymousId, trackStoreEvent } from '../utils/storeAnalytics';

async function getFunctionError(error) {
  try {
    const body = await error?.context?.clone?.().json?.();
    return body?.error || error?.message;
  } catch {
    return error?.message;
  }
}

function cartForStorage(items) {
  return items.map((item) => {
    const storedItem = { ...item };
    delete storedItem.previewUrls;
    delete storedItem.availabilityIssue;
    delete storedItem.availabilityMessage;
    delete storedItem.availabilityChecked;
    return storedItem;
  });
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

export default function StoreCart() {
  const navigate = useNavigate();
  const checkoutRef = useRef(null);
  const idempotencyKeyRef = useRef(globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  const submittingRef = useRef(false);
  const [cart, setCart] = useState([]);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [phoneError, setPhoneError] = useState(false);
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [street, setStreet] = useState('');
  const [buildingNumber, setBuildingNumber] = useState('');
  const [postalCode, setPostalCode] = useState('');
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
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [printDeleteItem, setPrintDeleteItem] = useState(null);
  const [isCloningPrint, setIsCloningPrint] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

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

      const productIds = [...new Set(savedCart.filter(item => item.itemType !== 'print').map(item => item.id).filter(Boolean))];
      if (productIds.length > 0) {
        try {
          const { data, error } = await supabase
            .from('products')
            .select('id, stock_quantity, in_stock')
            .in('id', productIds);
          if (error) throw error;

          const stockById = new Map((data || []).map(product => [product.id, product]));
          nextCart = nextCart.map(item => {
            if (item.itemType === 'print') return item;
            const productStock = stockById.get(item.id);
            const stockQuantity = normalizeStockQuantity(productStock?.stock_quantity ?? item.stockQuantity);
            const inStock = Boolean(productStock)
              && productStock?.in_stock !== false
              && (stockQuantity === null || stockQuantity > 0);
            const requestedQuantity = Math.max(1, Number(item.qty || 1));
            const availabilityIssue = !inStock || (stockQuantity !== null && requestedQuantity > stockQuantity);
            return {
              ...item,
              cartKey: item.cartKey || getCartLineKey(item.id, item.selectedOptions),
              stockQuantity,
              inStock,
              availabilityChecked: true,
              availabilityIssue,
              availabilityMessage: !inStock
                ? 'هذا المنتج غير متوفر حاليًا'
                : availabilityIssue
                  ? `المتوفر الآن ${stockQuantity} فقط`
                  : '',
            };
          });
        } catch (error) {
          console.error('Error refreshing cart stock:', error);
        }
      }

      const printLines = nextCart.filter(item => item.itemType === 'print' && item.printDraftId && item.printDraftToken);
      if (printLines.length > 0) {
        const printDetails = await Promise.all(printLines.map(async (item) => {
          try {
            const { data, error } = await supabase.functions.invoke('print-builder', {
              body: {
                action: 'get_draft',
                draftId: item.printDraftId,
                accessToken: item.printDraftToken,
              },
            });
            if (error) throw error;
            const draft = data?.draft || {};
            return [getItemKey(item), {
              previewUrls: (data?.files || []).map(file => file.preview_url).filter(Boolean).slice(0, 4),
              availabilityChecked: true,
              availabilityIssue: data?.variantAvailable === false || draft.status !== 'ready',
              availabilityMessage: data?.variantAvailable === false
                ? 'تركيبة الطباعة هذه متوقفة مؤقتًا'
                : draft.status !== 'ready'
                  ? 'طلب الطباعة يحتاج إلى مراجعة قبل الإتمام'
                  : '',
            }];
          } catch (error) {
            console.error('Error loading print cart preview:', error);
            return [getItemKey(item), {
              previewUrls: [],
              availabilityChecked: true,
              availabilityIssue: true,
              availabilityMessage: 'تعذر التحقق من طلب الطباعة. افتحيه للتعديل أو أعيدي المحاولة.',
            }];
          }
        }));
        const detailsByKey = new Map(printDetails);
        nextCart = nextCart.map(item => ({ ...item, ...(detailsByKey.get(getItemKey(item)) || {}) }));
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
      setEmail(customer.email || '');

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
          if (data?.customer?.email) setEmail(data.customer.email);
          setRewardSummary(data?.rewards || null);

          const firstAddress = addresses[0];
          if (firstAddress) {
            setSelectedAddressId(firstAddress.id || '');
            setCity(firstAddress.city || '');
            setDistrict(firstAddress.district || '');
            setStreet(firstAddress.street || '');
            setBuildingNumber(firstAddress.buildingNumber || firstAddress.building_number || '');
            setPostalCode(firstAddress.postalCode || firstAddress.postal_code || '');
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
      localStorage.setItem('art_moment_cart', JSON.stringify(cartForStorage(restored)));
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
          items: cart.filter((item) => item.itemType !== 'print').map((item) => ({
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
    localStorage.setItem('art_moment_cart', JSON.stringify(cartForStorage(newCart)));
    if (appliedCoupon) setAppliedCoupon(null);
  };

  const getItemKey = (item) => String(item.cartKey || getCartLineKey(item.id, item.selectedOptions));

  const updateQty = (itemKey, delta) => {
    let reachedLimit = false;
    const updated = cart.map(item => {
      if (getItemKey(item) === String(itemKey)) {
        if (item.fixedQuantity) return item;
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

  const requestRemoveItem = (item) => {
    if (item.itemType === 'print') {
      setPrintDeleteItem(item);
      return;
    }

    const itemKey = getItemKey(item);
    const removedIndex = cart.findIndex(line => getItemKey(line) === itemKey);
    removeItem(itemKey);
    toast((toastItem) => (
      <div className="flex min-w-[250px] items-center justify-between gap-4 font-[Tajawal]" dir="rtl">
        <span className="text-sm font-bold">تم حذف المنتج من السلة</span>
        <button
          type="button"
          onClick={() => {
            const current = JSON.parse(localStorage.getItem('art_moment_cart') || '[]');
            const restored = [...current];
            restored.splice(Math.max(0, removedIndex), 0, cartForStorage([item])[0]);
            saveCart(restored);
            toast.dismiss(toastItem.id);
          }}
          className="text-xs font-black text-[#B97882]"
        >
          تراجع
        </button>
      </div>
    ), { duration: 5000 });
  };

  const editPrintItem = async (item) => {
    setIsCloningPrint(true);
    const toastId = toast.loading('جاري تجهيز نسخة قابلة للتعديل...');
    try {
      const { data, error } = await supabase.functions.invoke('print-builder', {
        body: {
          action: 'clone_draft',
          draftId: item.printDraftId,
          accessToken: item.printDraftToken,
        },
      });
      if (error) throw new Error(await getFunctionError(error));
      localStorage.setItem('art_moment_print_draft', JSON.stringify({
        draftId: data.draft.id,
        accessToken: data.accessToken,
        replaceCartKey: getItemKey(item),
      }));
      toast.success('تم فتح نسخة جديدة للتعديل', { id: toastId });
      navigate('/print');
    } catch (error) {
      console.error('Clone print draft error:', error);
      toast.error('تعذر فتح طلب الطباعة للتعديل حاليًا', { id: toastId });
    } finally {
      setIsCloningPrint(false);
    }
  };

  const setExactQty = (itemKey, val) => {
    let reachedLimit = false;
    const updated = cart.map(item => {
      if (getItemKey(item) !== String(itemKey)) return item;
      if (item.fixedQuantity) return item;
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
    setBuildingNumber(address.buildingNumber || address.building_number || '');
    setPostalCode(address.postalCode || address.postal_code || '');
    if (address.notes) setNotes(current => current || address.notes);
  };

  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) * (Number(item.qty) || 0)), 0);
  const productsSubtotal = cart
    .filter(item => item.itemType !== 'print')
    .reduce((sum, item) => sum + (Number(item.price) * (Number(item.qty) || 0)), 0);
  const printsSubtotal = cart
    .filter(item => item.itemType === 'print')
    .reduce((sum, item) => sum + (Number(item.price) * (Number(item.qty) || 0)), 0);
  const hasAvailabilityIssues = cart.some(item => item.availabilityIssue);
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
            itemType: item.itemType,
            printDraftId: item.printDraftId,
            printDraftToken: item.printDraftToken,
            selectedOptions: item.selectedOptions || {},
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
          : error.message === 'coupon_scope_empty'
            ? 'هذا الكوبون لا يشمل العناصر الموجودة في السلة'
          : 'تعذر تطبيق الكوبون حالياً',
        { id: toastId },
      );
    } finally {
      setIsCheckingCoupon(false);
    }
  };

  const handleCheckout = async () => {
    if (hasAvailabilityIssues) {
      toast.error('راجعي العناصر غير المتوفرة قبل إتمام الطلب');
      return;
    }
    const isValidPhone = /^(05|9665|\+9665)[0-9]{8}$/.test(phone.trim());
    if (!isValidPhone) { setPhoneError(true); return; }
    setPhoneError(false);
    if (!name.trim()) {
      toast.error('أدخلي الاسم لإتمام الطلب');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('أدخلي بريدًا إلكترونيًا صحيحًا');
      return;
    }

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

    if (submittingRef.current) return;
    submittingRef.current = true;
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
            email: email || customerSession?.email,
            phone: normalizeCustomerPhone(phone),
            notes,
            city,
            district,
            street,
            buildingNumber,
            postalCode,
          },
          items: cart.map(item => ({
            id: item.id,
            qty: Number(item.qty) || 1,
            itemType: item.itemType,
            printDraftId: item.printDraftId,
            printDraftToken: item.printDraftToken,
            selectedOptions: item.selectedOptions || {},
          })),
          payment: {
            method: paymentMethod,
          },
          couponCode: appliedCoupon?.code || null,
          rewardPoints: requestedRewardPoints,
          idempotencyKey: idempotencyKeyRef.current,
        },
      });

      if (error) {
        throw new Error(await getFunctionError(error));
      }

      const completedSummary = {
        ...data?.order,
        printCopies: cart
          .filter(item => item.itemType === 'print')
          .reduce((sum, item) => sum + Number(item.printDetails?.totalCopies || 0), 0),
        productCount: cart
          .filter(item => item.itemType !== 'print')
          .reduce((sum, item) => sum + Number(item.qty || 0), 0),
        paymentMethod,
        customerPin: data?.customer_pin || null,
        isGuest: !customerSession?.sessionToken,
      };
      setOrderResult(completedSummary);
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
        reward_points_balance_insufficient: 'رصيد النقاط غير كافٍ. حدّث الصفحة ثم حاول مجدداً.',
        reward_redemption_limit_exceeded: `الحد الأعلى لهذا الطلب ${maximumRewardPoints.toLocaleString()} نقطة.`,
        reward_minimum_redemption_not_met: `الحد الأدنى للاستبدال ${minimumRewardPoints.toLocaleString()} نقطة.`,
        reward_program_disabled: 'استخدام النقاط متوقف مؤقتاً.',
        reward_points_migration_required: 'نظام النقاط قيد التحديث. حاول بعد قليل.',
        invalid_product_options: 'تحقق من اختيار المقاس أو اللون أو الخامة لكل منتج.',
        product_unavailable: 'أحد منتجات السلة لم يعد متوفرًا. راجع السلة ثم حاول مجددًا.',
        product_out_of_stock: 'الكمية المطلوبة لأحد المنتجات لم تعد متوفرة.',
        print_variant_unavailable: 'تركيبة الطباعة المختارة متوقفة مؤقتًا. افتح طلب الطباعة لتعديله.',
        print_draft_not_ready: 'طلب الطباعة يحتاج إلى مراجعة قبل إتمام الطلب.',
        coupon_scope_empty: 'الكوبون لا يشمل العناصر الموجودة في السلة.',
        guest_customer_exists_login_required: 'هذه البيانات مرتبطة بحساب قائم. سجّل الدخول لحماية الحساب وإتمام الطلب.',
        customer_identity_conflict: 'الجوال والبريد مرتبطان بحسابين مختلفين. راجع البيانات أو سجّل الدخول.',
      };
      toast.error(checkoutMessages[error.message] || 'حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.', { id: toastId });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="art-page min-h-screen font-[Tajawal] flex flex-col items-center justify-center p-4 text-[#171717]" dir="rtl">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center shadow-sm mb-6 animate-in zoom-in duration-500">
          <CheckCircle size={40} />
        </div>
        <h2 className="text-2xl md:text-3xl font-black mb-3 text-center">شكرًا، تم استلام طلبك</h2>
        <p className="text-[#171717]/60 text-sm md:text-base mb-8 text-center max-w-md leading-relaxed">
          رقم الطلب <strong className="text-[#171717]">#{String(orderResult?.short_id || orderResult?.id || '').slice(0, 6)}</strong>
        </p>
        <div className="mb-8 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="border border-black/10 bg-white p-4 text-center"><span className="block text-xs text-black/50">نسخ الطباعة</span><strong>{orderResult?.printCopies || 0}</strong></div>
          <div className="border border-black/10 bg-white p-4 text-center"><span className="block text-xs text-black/50">المنتجات</span><strong>{orderResult?.productCount || 0}</strong></div>
          <div className="border border-black/10 bg-white p-4 text-center"><span className="block text-xs text-black/50">حالة الدفع</span><strong className="text-amber-700">بانتظار الدفع</strong></div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to={orderResult?.isGuest ? '/track' : (orderResult?.id ? `/store/orders/${orderResult.id}` : '/store/orders')}
            className="bg-[#171717] text-white px-8 py-3.5 rounded-full font-bold shadow-md hover:bg-[#E8B4BC] transition-all hover:-translate-y-1"
          >
            تتبع الطلب
          </Link>
          <Link
            to="/"
            className="bg-white text-[#171717] border border-[#E8B4BC]/20 px-8 py-3.5 rounded-full font-bold shadow-sm hover:bg-[#FAF9F7] transition-all"
          >
            العودة للرئيسية
          </Link>
        </div>
        {orderResult?.isGuest && orderResult?.customerPin && (
          <p className="mt-5 max-w-md border-s-4 border-[#C6A56B] bg-white px-4 py-3 text-center text-xs leading-6 text-black/60">
            احتفظ برمز التتبع <strong className="text-base text-[#171717]">{orderResult.customerPin}</strong> مع رقم الطلب، أو أنشئي حسابًا لاحقًا بنفس الجوال والبريد لربط طلباتك.
          </p>
        )}
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="art-page min-h-screen font-[Tajawal] flex flex-col items-center justify-center p-4 text-[#171717]" dir="rtl">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6 text-[#E8B4BC]/30">
          <ShoppingBag size={40} />
        </div>
        <h1 className="art-page-title mb-2">سلة التسوق</h1>
        <p className="text-[#171717]/50 text-sm mb-8">سلة المشتريات فارغة. لم تقم بإضافة أي منتجات بعد.</p>
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
        <h1 className="text-lg font-black">سلة التسوق</h1>
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

            if (item.itemType === 'print') {
              const details = item.printDetails || {};
              const printOptions = formatPrintOptionSummary({
                material: details.material,
                surface: details.surface,
                border_style: details.borderStyle,
                fit_mode: details.fitMode,
              });
              return (
                <article key={itemKey} className="border border-[#C6A56B]/35 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center bg-[#171717] text-white"><Files size={19} /></span>
                      <div><p className="text-[10px] font-black text-[#C6A56B]">خدمة طباعة خاصة</p><h3 className="font-black">طلب طباعة صور</h3></div>
                    </div>
                    <strong className="text-lg text-[#B97882]">{formatMoney(item.price)} ر.س</strong>
                  </div>

                  <div className="grid gap-5 p-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:p-5">
                    <div className="grid h-fit grid-cols-2 gap-1.5" aria-label="معاينات صور الطباعة">
                      {(item.previewUrls || []).length > 0 ? (item.previewUrls || []).map((url, index) => (
                        <img key={url} src={url} alt={`معاينة ${index + 1}`} className="aspect-square w-full object-cover" />
                      )) : (
                        <div className="col-span-2 flex aspect-[2/1] items-center justify-center bg-[#FAF9F7] text-[#E8B4BC]"><ImageIcon size={26} /></div>
                      )}
                    </div>

                    <div>
                      <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-xs sm:grid-cols-3">
                        {[
                          ['المقاس', details.printSize || '—'],
                          ['الملفات', `${details.fileCount || 0} ملف`],
                          ['إجمالي النسخ', `${details.totalCopies || 0} نسخة`],
                          ['سعر النسخة', `${formatMoney(details.unitPrice)} ر.س`],
                          ['الإعدادات', printOptions || '—'],
                        ].map(([label, value]) => (
                          <div key={label} className={label === 'الإعدادات' ? 'col-span-2 sm:col-span-2' : ''}>
                            <dt className="text-black/45">{label}</dt><dd className="mt-1 font-black text-black/80">{value}</dd>
                          </div>
                        ))}
                      </dl>
                      {item.availabilityIssue && (
                        <div className="mt-4 flex items-start gap-2 border-s-4 border-red-500 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {item.availabilityMessage}
                        </div>
                      )}
                      <div className="mt-5 flex flex-wrap gap-2 border-t border-black/[0.06] pt-4">
                        <button type="button" onClick={() => editPrintItem(item)} disabled={isCloningPrint} className="inline-flex min-h-11 items-center gap-2 bg-[#171717] px-4 text-xs font-black text-white disabled:opacity-50">
                          {isCloningPrint ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />} تعديل الطلب
                        </button>
                        <button type="button" onClick={() => requestRemoveItem(item)} className="inline-flex min-h-11 items-center gap-2 border border-red-200 px-4 text-xs font-black text-red-600">
                          <Trash2 size={15} /> حذف
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            }

            return (
              <article key={itemKey} className={`grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 border bg-white p-4 shadow-sm sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center sm:p-5 ${item.availabilityIssue ? 'border-red-200' : 'border-black/[0.08]'}`}>
                <div className="aspect-square overflow-hidden bg-[#FAF9F7]">
                  {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" /> : <ImageIcon size={22} className="m-auto h-full text-[#E8B4BC]" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black text-[#C6A56B]">منتج من المتجر</p><h3 className="mt-0.5 font-black">{item.name}</h3></div><strong className="shrink-0 text-[#B97882] sm:hidden">{formatMoney(item.price * item.qty)} ر.س</strong></div>
                  {optionLabels.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{optionLabels.map(option => <span key={option.id} className="bg-[#FAF9F7] px-2 py-1 text-[10px] font-bold text-black/55">{option.name}: {option.label}</span>)}</div>}
                  {item.availabilityIssue ? (
                    <p className="mt-2 flex items-center gap-1 text-xs font-black text-red-600"><AlertCircle size={14} /> {item.availabilityMessage}</p>
                  ) : (
                    <p className="mt-2 text-[10px] font-bold text-black/45">{availableStock === null ? 'متوفر' : `المتوفر: ${availableStock}`}</p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="flex min-h-11 items-center border border-black/10 bg-[#FAF9F7]">
                      <button type="button" aria-label="زيادة الكمية" onClick={() => updateQty(itemKey, 1)} disabled={reachedMax} className="flex h-11 w-11 items-center justify-center disabled:opacity-25"><Plus size={15} /></button>
                      <input type="number" min="1" max={availableStock ?? undefined} value={item.qty} onChange={e => setExactQty(itemKey, e.target.value)} onBlur={() => handleBlurQty(itemKey, item.qty)} className="w-12 bg-transparent text-center text-sm font-black outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" dir="ltr" />
                      <button type="button" aria-label="تقليل الكمية" onClick={() => updateQty(itemKey, -1)} className="flex h-11 w-11 items-center justify-center"><Minus size={15} /></button>
                    </div>
                    <button type="button" onClick={() => requestRemoveItem(item)} className="inline-flex min-h-11 items-center gap-2 px-2 text-xs font-black text-red-500"><Trash2 size={15} /> حذف</button>
                  </div>
                </div>
                <div className="hidden min-w-24 text-left sm:block"><span className="block text-[10px] text-black/40">الإجمالي</span><strong className="text-lg text-[#B97882]">{formatMoney(item.price * item.qty)} ر.س</strong></div>
              </article>
            );
          })}
          {cart.some((item) => item.itemType === 'print') && (
            <div className="border-s-4 border-[#C6A56B] bg-white p-5 shadow-sm">
              <h3 className="font-black text-[#171717]">أكملي مجموعة ذكرياتك</h3>
              <p className="mt-1 text-xs leading-6 text-[#171717]/55">اختر ألبومًا أو إطارًا مناسبًا لمقاس الصور الموجودة في السلة.</p>
              <div className="mt-3 flex gap-2">
                <Link to="/store/albums" className="min-h-11 flex-1 border border-[#E8B4BC]/25 bg-[#FAF9F7] px-4 py-3 text-center text-xs font-black">عرض الألبومات</Link>
                <Link to="/store/frames" className="min-h-11 flex-1 border border-[#E8B4BC]/25 bg-[#FAF9F7] px-4 py-3 text-center text-xs font-black">عرض الإطارات</Link>
              </div>
            </div>
          )}
        </div>

        {/* ملخص الطلب وبيانات العميل */}
        <div className="contents">
          {/* ملخص */}
          <div className="art-panel p-6 rounded-[1.5rem] lg:sticky lg:top-24 lg:z-10 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start">
            <h2 className="font-black text-[#171717] mb-4">ملخص السلة</h2>
            <div className="space-y-3 mb-6 border-b border-[#FAF9F7] pb-4">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2 text-[#171717]/60"><Package size={14} /> المنتجات</span>
                <span className="font-bold">{formatMoney(productsSubtotal)} ر.س</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2 text-[#171717]/60"><Files size={14} /> طلبات الطباعة</span>
                <span className="font-bold">{formatMoney(printsSubtotal)} ر.س</span>
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
                    <span>{appliedCoupon.code}{appliedCoupon.scopeLabel ? ` · ${appliedCoupon.scopeLabel}` : ''}</span>
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
              <span className="font-black text-lg">الإجمالي الحالي</span>
              <span className="font-black text-2xl text-[#E8B4BC]">{payableTotal.toFixed(2)} <span className="text-sm">ر.س</span></span>
            </div>
            {hasAvailabilityIssues && (
              <div className="mt-4 flex items-start gap-2 bg-red-50 p-3 text-xs font-black text-red-700">
                <AlertCircle size={16} className="shrink-0" /> يوجد عنصر يحتاج تعديلًا قبل إتمام الطلب.
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              disabled={hasAvailabilityIssues}
              className="art-cta mt-5 flex min-h-12 w-full items-center justify-center gap-2 px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              متابعة لإتمام الطلب <ChevronLeft size={17} />
            </button>
            <Link to="/store" className="mt-3 flex min-h-11 items-center justify-center text-xs font-black text-black/55 hover:text-black">متابعة التسوق</Link>
          </div>

          <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-2">
          <div ref={checkoutRef} className="scroll-mt-24 border border-black/[0.08] bg-white p-4 shadow-sm sm:p-5">
            <div className="grid grid-cols-3 gap-2" aria-label="خطوات إتمام الطلب">
              {[
                [1, 'بيانات العميل'],
                [2, 'التوصيل'],
                [3, 'الدفع والمراجعة'],
              ].map(([stepNumber, label]) => (
                <button key={stepNumber} type="button" onClick={() => setCheckoutStep(stepNumber)} className={`min-h-12 border-b-2 px-1 text-[10px] font-black sm:text-xs ${checkoutStep === stepNumber ? 'border-[#171717] text-[#171717]' : 'border-black/10 text-black/35'}`}>
                  <span className="me-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#FAF9F7]">{stepNumber}</span>{label}
                </button>
              ))}
            </div>
          </div>

          {checkoutStep === 1 && <div className="space-y-4">
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
                    <LogIn size={18} className="text-[#C6A56B]" /> الإتمام كزائر أو عبر الحساب
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-[#171717]/55">
                    يمكنك إتمام الطلب الآن دون إنشاء حساب. سجّلي الدخول فقط لاستخدام النقاط والعناوين المحفوظة ومشاهدة الطلب داخل «طلباتي».
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

          <div className="art-panel p-6 rounded-[1.5rem]">
            <h2 className="mb-4 font-black text-[#171717]">بيانات العميل</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold">الاسم <span className="text-red-500">*</span></label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="art-input w-full rounded-xl px-4 py-2.5 outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold">رقم الجوال <span className="text-red-500">*</span></label>
                <input type="tel" dir="ltr" value={phone} onChange={e => { setPhone(e.target.value); setPhoneError(false); }} placeholder="05XXXXXXXX" className={`art-input w-full rounded-xl px-4 py-2.5 text-right outline-none ${phoneError ? 'border-red-400 bg-red-50' : ''}`} />
                {phoneError && <span className="mt-1 flex items-center gap-1 text-[10px] text-red-500"><AlertCircle size={10} /> يرجى إدخال رقم جوال صحيح</span>}
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-bold">البريد الإلكتروني <span className="text-red-500">*</span></label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} readOnly={Boolean(customerSession?.sessionToken)} placeholder="name@example.com" className={`art-input w-full rounded-xl px-4 py-2.5 outline-none ${customerSession?.sessionToken ? 'bg-[#FAF9F7]' : 'bg-white'}`} dir="ltr" />
              </div>
            </div>
          </div>
          <button type="button" onClick={() => {
            if (!/^(05|9665|\+9665)[0-9]{8}$/.test(phone.trim())) { setPhoneError(true); return; }
            if (!name.trim()) return toast.error('أدخلي الاسم أولًا');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast.error('أدخلي بريدًا إلكترونيًا صحيحًا');
            setCheckoutStep(2);
            checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }} className="art-cta flex min-h-12 w-full items-center justify-center gap-2 px-5 text-sm font-black">
            متابعة إلى التوصيل <ChevronLeft size={17} />
          </button>
          </div>}

          {/* بيانات التواصل والشحن */}
          {checkoutStep === 2 && <div className="space-y-4">
          <div className="art-panel p-6 rounded-[1.5rem]">
            <h2 className="font-black text-[#171717] mb-4">عنوان التوصيل</h2>
            <div className="space-y-4">
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
                    الشارع <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={street}
                    onChange={e => setStreet(e.target.value)}
                    placeholder="اسم الشارع"
                    className="art-input w-full rounded-xl px-4 py-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-[#171717]">رقم المبنى / الوصف</label>
                  <input type="text" value={buildingNumber} onChange={e => setBuildingNumber(e.target.value)} placeholder="رقم المبنى أو وصف الموقع" className="art-input w-full rounded-xl px-4 py-2.5 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-[#171717]">الرمز البريدي</label>
                  <input type="text" inputMode="numeric" dir="ltr" maxLength="5" value={postalCode} onChange={e => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="00000" className="art-input w-full rounded-xl px-4 py-2.5 outline-none" />
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

          <div className="flex gap-3">
            <button type="button" onClick={() => setCheckoutStep(1)} className="min-h-12 flex-1 border border-black/10 bg-white px-4 text-sm font-black">السابق</button>
            <button type="button" onClick={() => {
              if (!city || !district.trim() || !street.trim()) return toast.error('أكملي عنوان التوصيل أولًا');
              setCheckoutStep(3);
              checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }} className="art-cta min-h-12 flex-[2] px-4 text-sm font-black">متابعة إلى الدفع</button>
          </div>
          </div>}

          {checkoutStep === 3 && <div className="space-y-4">
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

          <div className="border border-black/[0.08] bg-white p-5">
            <h3 className="font-black">مراجعة الطلب</h3>
            <div className="mt-4 space-y-3 text-xs">
              {cart.filter(item => item.itemType === 'print').map(item => (
                <div key={getItemKey(item)} className="flex justify-between gap-4"><span><strong>طلب طباعة</strong><span className="block text-black/45">{item.printDetails?.fileCount || 0} ملف · {item.printDetails?.totalCopies || 0} نسخة · {item.printDetails?.printSize}</span></span><strong>{formatMoney(item.price)} ر.س</strong></div>
              ))}
              {cart.filter(item => item.itemType !== 'print').map(item => (
                <div key={getItemKey(item)} className="flex justify-between gap-4"><span><strong>{item.name}</strong><span className="block text-black/45">الكمية: {item.qty}</span></span><strong>{formatMoney(item.price * item.qty)} ر.س</strong></div>
              ))}
              <div className="border-t border-black/10 pt-3"><span className="text-black/45">عنوان التوصيل</span><p className="mt-1 font-bold">{[city, district, street, buildingNumber, postalCode].filter(Boolean).join('، ')}</p></div>
            </div>
          </div>

          <button type="button" onClick={() => setCheckoutStep(2)} className="min-h-11 w-full border border-black/10 bg-white px-4 text-sm font-black">العودة إلى التوصيل</button>
          <button
            onClick={handleCheckout}
            disabled={hasAvailabilityIssues || !name || !phone || !email || !city || !district || !street || isSubmitting}
            className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg ${
              name && phone && email && city && district && street && !isSubmitting
                ? 'art-cta'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed pointer-events-none'
            }`}
          >
            {isSubmitting
              ? <><Loader2 size={18} className="animate-spin" /> جاري تسجيل الطلب...</>
              : <><ShoppingBag size={18} /> تأكيد الطلب وإرساله</>
            }
          </button>
          </div>}
          </div>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(23,23,23,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-24"><span className="block text-[10px] text-black/45">الإجمالي الحالي</span><strong className="text-lg text-[#B97882]">{payableTotal.toFixed(2)} ر.س</strong></div>
          <button type="button" disabled={hasAvailabilityIssues} onClick={() => checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="art-cta min-h-12 flex-1 px-4 text-sm font-black disabled:opacity-40">إتمام الطلب</button>
        </div>
      </div>

      {printDeleteItem && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-print-title" onMouseDown={(event) => event.target === event.currentTarget && setPrintDeleteItem(null)}>
          <div className="w-full max-w-md bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center bg-red-50 text-red-600"><Trash2 size={20} /></div>
            <h2 id="delete-print-title" className="mt-4 text-xl font-black">حذف طلب الطباعة؟</h2>
            <p className="mt-2 text-sm leading-7 text-black/55">سيُزال هذا الطلب من السلة. الصور المرتبطة به ستخضع لسياسة حذف المسودات والملفات.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setPrintDeleteItem(null)} className="min-h-12 border border-black/10 font-black">إلغاء</button>
              <button type="button" onClick={() => { removeItem(getItemKey(printDeleteItem)); setPrintDeleteItem(null); toast.success('تم حذف طلب الطباعة من السلة'); }} className="min-h-12 bg-red-600 font-black text-white">حذف الطلب</button>
            </div>
          </div>
        </div>
      )}

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
          if (nextSession?.email) setEmail(nextSession.email);
        }}
      />
    </div>
  );
}
