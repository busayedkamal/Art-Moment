import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Copy,
  Mail,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  User,
  WalletCards,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const CUSTOMER_INITIAL = {
  name: '',
  phone: '',
  email: '',
  preferredContactMethod: 'whatsapp',
  marketingOptIn: false,
};

const ORDER_INITIAL = {
  source: 'whatsapp',
  status: 'pending_verification',
  paymentStatus: 'pending_payment',
  paymentMethod: 'bank_transfer',
  amountPaid: '0',
  deliveryFee: '0',
  manualDiscountAmount: '0',
  manualDiscountReason: '',
  city: '',
  district: '',
  street: '',
  notes: '',
  saveAddress: true,
};

const CATEGORY_LABELS = {
  albums: 'ألبومات',
  frames: 'إطارات',
  printing: 'طباعة',
  accessories: 'ملحقات',
};

const ERROR_MESSAGES = {
  not_authorized: 'لا تملك صلاحية إنشاء طلب إداري.',
  invalid_manual_order: 'بيانات الطلب غير مكتملة.',
  invalid_phone: 'رقم الجوال غير صحيح. استخدم رقماً سعودياً يبدأ بـ 05.',
  invalid_email: 'البريد الإلكتروني غير صحيح.',
  customer_not_found: 'تعذر العثور على العميل المحدد.',
  customer_phone_exists: 'رقم الجوال مرتبط بعميل آخر. ابحث عنه واختره أولاً.',
  customer_email_exists: 'البريد الإلكتروني مرتبط بعميل آخر. ابحث عنه واختره أولاً.',
  customer_identity_conflict: 'الجوال والبريد يعودان إلى حسابين مختلفين. راجع بيانات العميل.',
  customer_name_required: 'اسم العميل مطلوب.',
  invalid_order_items: 'راجع كميات المنتجات المختارة.',
  product_unavailable: 'أحد المنتجات لم يعد متاحاً.',
  product_out_of_stock: 'تغير المخزون ولا تكفي الكمية لأحد المنتجات.',
  discount_reason_required: 'اكتب سبب الخصم اليدوي.',
  discount_exceeds_subtotal: 'الخصم أكبر من قيمة المنتجات.',
  amount_paid_exceeds_total: 'المبلغ المدفوع أكبر من إجمالي الطلب.',
  invalid_order_status: 'حالة الطلب غير متاحة عند الإنشاء.',
  invalid_payment_status: 'حالة الدفع غير صحيحة.',
  manual_order_setup_required: 'إعداد قاعدة بيانات الطلب اليدوي غير مكتمل. شغّل ملف SQL الخاص بتوحيد العملاء والطلبات اليدوية.',
  manual_order_schema_outdated: 'بنية جداول الطلب اليدوي قديمة وتحتاج تشغيل آخر ملف ترحيل SQL.',
  manual_order_constraint_failed: 'تعارضت بيانات الطلب مع أحد قيود قاعدة البيانات. راجع بيانات العميل وحالة الطلب.',
  manual_order_failed: 'تعذر إنشاء الطلب اليدوي. لم يتم حفظ أي جزء منه.',
};

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^009665\d{8}$/.test(digits)) return `0${digits.slice(-9)}`;
  if (/^9665\d{8}$/.test(digits)) return `0${digits.slice(-9)}`;
  if (/^5\d{8}$/.test(digits)) return `0${digits}`;
  return digits;
}

function money(value) {
  const numericValue = Number(value || 0);
  return (Number.isFinite(numericValue) ? numericValue : 0).toFixed(2);
}

function nonNegativeNumber(value) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
}

function getStockQuantity(product) {
  if (product?.stock_quantity === null || product?.stock_quantity === undefined) return null;
  const value = Number(product.stock_quantity);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function isProductAvailable(product) {
  const stock = getStockQuantity(product);
  return product?.in_stock !== false && (stock === null || stock > 0);
}

function getFirstAddress(customer) {
  const addresses = Array.isArray(customer?.saved_addresses) ? customer.saved_addresses : [];
  return addresses[0] || null;
}

function getWalletCustomerName(notes) {
  const value = String(notes || '').trim();
  const match = value.match(/اسم العميل\s*:\s*(.+)/i);
  return match?.[1]?.trim() || '';
}

function buildUnifiedCustomerDirectory(storeCustomers, printOrders, wallets) {
  const directory = new Map();

  (storeCustomers || []).forEach((customer) => {
    const phone = normalizePhone(customer.phone);
    if (!/^05\d{8}$/.test(phone)) return;
    directory.set(phone, {
      ...customer,
      phone,
      customer_key: `store_${customer.id}`,
      customer_source: 'store',
    });
  });

  (printOrders || []).forEach((order) => {
    const phone = normalizePhone(order.phone);
    if (!/^05\d{8}$/.test(phone)) return;
    const existing = directory.get(phone);
    if (existing) {
      if (!existing.name && order.customer_name) existing.name = order.customer_name;
      return;
    }
    directory.set(phone, {
      id: null,
      name: order.customer_name || 'عميل طباعة',
      phone,
      email: '',
      preferred_contact_method: 'whatsapp',
      marketing_opt_in: false,
      saved_addresses: [],
      admin_tags: ['عميل طباعة'],
      customer_key: `print_${phone}`,
      customer_source: 'printing',
    });
  });

  (wallets || []).forEach((wallet) => {
    const phone = normalizePhone(wallet.phone);
    if (!/^05\d{8}$/.test(phone)) return;
    const existing = directory.get(phone);
    const walletName = getWalletCustomerName(wallet.notes);
    if (existing) {
      existing.subscription_code = wallet.subscription_code || existing.subscription_code || null;
      if ((!existing.name || existing.name === 'عميل طباعة') && walletName) existing.name = walletName;
      if ((!existing.saved_addresses || existing.saved_addresses.length === 0) && wallet.address) {
        existing.saved_addresses = [{ city: '', district: '', street: wallet.address }];
      }
      return;
    }
    directory.set(phone, {
      id: null,
      name: walletName || 'عميل محفظة',
      phone,
      email: '',
      preferred_contact_method: 'whatsapp',
      marketing_opt_in: false,
      saved_addresses: wallet.address ? [{ city: '', district: '', street: wallet.address }] : [],
      admin_tags: ['عميل محفظة'],
      subscription_code: wallet.subscription_code || null,
      customer_key: `wallet_${phone}`,
      customer_source: 'wallet',
    });
  });

  return [...directory.values()].sort((left, right) => (
    String(left.name || '').localeCompare(String(right.name || ''), 'ar')
  ));
}

async function getFunctionErrorCode(error) {
  try {
    const body = await error?.context?.clone?.().json?.();
    return body?.error || error?.message || 'manual_order_failed';
  } catch {
    return error?.message || 'manual_order_failed';
  }
}

export default function ManualStoreOrder() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadErrors, setLoadErrors] = useState({ customers: '', products: '' });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerForm, setCustomerForm] = useState(CUSTOMER_INITIAL);
  const [productSearch, setProductSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedItems, setSelectedItems] = useState([]);
  const [orderForm, setOrderForm] = useState(ORDER_INITIAL);
  const [createdResult, setCreatedResult] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setLoadErrors({ customers: '', products: '' });
    const [customersResult, productsResult, printOrdersResult, walletsResult] = await Promise.all([
      supabase
        .from('customers')
        .select('id, name, email, phone, preferred_contact_method, marketing_opt_in, saved_addresses, admin_tags')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('products')
        .select('id, name, description, price, category, image, in_stock, stock_quantity')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('orders')
        .select('id, customer_name, phone, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('wallets')
        .select('id, phone, address, notes, subscription_code'),
    ]);

    const customerSourceErrors = [
      customersResult.error,
      printOrdersResult.error,
      walletsResult.error,
    ].filter(Boolean);
    const nextErrors = {
      customers: customerSourceErrors.length === 3 ? 'تعذر تحميل بيانات العملاء.' : '',
      products: productsResult.error ? 'تعذر تحميل منتجات المتجر.' : '',
    };

    if (customerSourceErrors.length < 3) {
      setCustomers(buildUnifiedCustomerDirectory(
        customersResult.data || [],
        printOrdersResult.data || [],
        walletsResult.data || [],
      ));
    }
    if (customersResult.error) console.error('Store customers load failed:', customersResult.error);
    if (printOrdersResult.error) console.error('Print customers load failed:', printOrdersResult.error);
    if (walletsResult.error) console.error('Wallet customers load failed:', walletsResult.error);

    if (!productsResult.error) {
      setProducts(productsResult.data || []);
    } else {
      console.error('Manual store order products load failed:', productsResult.error);
    }

    setLoadErrors(nextErrors);
    if (nextErrors.customers || nextErrors.products) {
      toast.error([nextErrors.customers, nextErrors.products].filter(Boolean).join(' '));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const customerResults = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    const phoneQuery = normalizePhone(customerSearch);
    if (query.length < 2 && phoneQuery.length < 3) return [];

    return customers.filter((customer) => {
      const haystack = `${customer.name || ''} ${customer.email || ''} ${customer.subscription_code || ''}`.toLowerCase();
      const matchesPhone = phoneQuery.length >= 3 && normalizePhone(customer.phone).includes(phoneQuery);
      return haystack.includes(query) || matchesPhone;
    }).slice(0, 6);
  }, [customerSearch, customers]);

  const categories = useMemo(() => (
    [...new Set(products.map((product) => product.category).filter(Boolean))]
  ), [products]);

  const visibleProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = activeCategory === 'all' || product.category === activeCategory;
      const matchesSearch = !query || `${product.name || ''} ${product.description || ''}`.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, productSearch, products]);

  const productMap = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products]);

  const orderLines = useMemo(() => selectedItems.map((item) => ({
    ...item,
    product: productMap.get(String(item.productId)),
  })).filter((item) => item.product), [productMap, selectedItems]);

  const subtotal = useMemo(() => orderLines.reduce((sum, item) => (
    sum + Number(item.product.price || 0) * Number(item.quantity || 0)
  ), 0), [orderLines]);

  const discount = nonNegativeNumber(orderForm.manualDiscountAmount);
  const deliveryFee = nonNegativeNumber(orderForm.deliveryFee);
  const productsTotal = Math.max(0, subtotal - discount);
  const grandTotal = productsTotal + deliveryFee;

  useEffect(() => {
    if (orderForm.paymentStatus !== 'paid') return;
    const paid = grandTotal.toFixed(2);
    setOrderForm((current) => current.amountPaid === paid ? current : { ...current, amountPaid: paid });
  }, [grandTotal, orderForm.paymentStatus]);

  const selectCustomer = (customer) => {
    const address = getFirstAddress(customer);
    setSelectedCustomer(customer);
    setCustomerSearch('');
    setCustomerForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      preferredContactMethod: customer.preferred_contact_method || 'whatsapp',
      marketingOptIn: Boolean(customer.marketing_opt_in),
    });
    if (address) {
      setOrderForm((current) => ({
        ...current,
        city: address.city || current.city,
        district: address.district || current.district,
        street: address.street || current.street,
        saveAddress: false,
      }));
    } else {
      setOrderForm((current) => ({ ...current, saveAddress: true }));
    }
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setCustomerForm(CUSTOMER_INITIAL);
    setOrderForm((current) => ({ ...current, city: '', district: '', street: '' }));
  };

  const addProduct = (product) => {
    if (!isProductAvailable(product)) return;
    const stock = getStockQuantity(product);
    setSelectedItems((current) => {
      const existing = current.find((item) => String(item.productId) === String(product.id));
      if (existing) {
        if (stock !== null && existing.quantity >= stock) {
          toast.error(`المتاح من ${product.name}: ${stock}`);
          return current;
        }
        return current.map((item) => String(item.productId) === String(product.id)
          ? { ...item, quantity: item.quantity + 1 }
          : item);
      }
      return [...current, { productId: product.id, quantity: 1 }];
    });
  };

  const changeQuantity = (productId, nextQuantity) => {
    const product = productMap.get(String(productId));
    if (!product) return;
    const stock = getStockQuantity(product);
    const quantity = Math.max(1, Math.floor(Number(nextQuantity || 1)));
    if (stock !== null && quantity > stock) {
      toast.error(`الكمية المتاحة من ${product.name}: ${stock}`);
      return;
    }
    setSelectedItems((current) => current.map((item) => String(item.productId) === String(productId)
      ? { ...item, quantity }
      : item));
  };

  const removeProduct = (productId) => {
    setSelectedItems((current) => current.filter((item) => String(item.productId) !== String(productId)));
  };

  const validateForm = () => {
    const normalizedPhone = normalizePhone(customerForm.phone);
    if (!customerForm.name.trim()) return 'اكتب اسم العميل.';
    if (!/^05\d{8}$/.test(normalizedPhone)) return 'اكتب رقم جوال سعودي صحيحاً يبدأ بـ 05.';
    if (customerForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerForm.email.trim())) {
      return 'راجع البريد الإلكتروني.';
    }
    if (selectedItems.length === 0) return 'أضف منتجاً واحداً على الأقل.';
    if (discount > subtotal) return 'الخصم أكبر من قيمة المنتجات.';
    if (discount > 0 && !orderForm.manualDiscountReason.trim()) return 'اكتب سبب الخصم اليدوي.';
    if (nonNegativeNumber(orderForm.amountPaid) > grandTotal) return 'المبلغ المدفوع أكبر من الإجمالي.';
    return '';
  };

  const createOrder = async () => {
    const validationMessage = validateForm();
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-store-order', {
        body: {
          customer: {
            id: selectedCustomer?.id || null,
            name: customerForm.name.trim(),
            phone: normalizePhone(customerForm.phone),
            email: customerForm.email.trim().toLowerCase() || null,
            preferred_contact_method: customerForm.preferredContactMethod,
            marketing_opt_in: Boolean(customerForm.marketingOptIn),
            save_address: Boolean(orderForm.saveAddress),
          },
          items: selectedItems.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
          })),
          order: {
            source: orderForm.source,
            status: orderForm.status,
            payment_status: orderForm.paymentStatus,
            payment_method: orderForm.paymentMethod,
            amount_paid: nonNegativeNumber(orderForm.amountPaid),
            delivery_fee: deliveryFee,
            manual_discount_amount: discount,
            manual_discount_reason: orderForm.manualDiscountReason.trim() || null,
            city: orderForm.city.trim() || null,
            district: orderForm.district.trim() || null,
            street: orderForm.street.trim() || null,
            notes: orderForm.notes.trim() || null,
          },
        },
      });

      if (error) throw error;
      setCreatedResult(data);
      toast.success('تم إنشاء طلب المتجر وحجز المخزون');
    } catch (error) {
      console.error(error);
      const code = await getFunctionErrorCode(error);
      toast.error(ERROR_MESSAGES[code] || ERROR_MESSAGES.manual_order_failed);
    } finally {
      setSubmitting(false);
    }
  };

  const resetPage = () => {
    setCreatedResult(null);
    setSelectedCustomer(null);
    setCustomerSearch('');
    setCustomerForm(CUSTOMER_INITIAL);
    setSelectedItems([]);
    setProductSearch('');
    setActiveCategory('all');
    setOrderForm(ORDER_INITIAL);
    fetchData();
  };

  const copyValue = async (value, label) => {
    try {
      await navigator.clipboard.writeText(String(value || ''));
      toast.success(`تم نسخ ${label}`);
    } catch {
      toast.error('تعذر النسخ');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 rounded-full border-4 border-[#E8B4BC]/25 border-t-[#E8B4BC] animate-spin" />
          <p className="mt-3 text-sm font-bold text-[#171717]/55">جاري تجهيز الطلب اليدوي...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-[#171717]" dir="rtl">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs font-black text-[#C6A56B]">
            <ClipboardCheck size={14} /> طلب وارد خارج الموقع
          </p>
          <h1 className="text-2xl font-black sm:text-3xl">إنشاء طلب متجر يدوي</h1>
          <p className="mt-1 text-sm text-[#171717]/55">اربط العميل، اختر المنتجات، وراجع الحساب قبل حجز المخزون.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/app/store-orders')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E8B4BC]/25 bg-white px-4 py-2.5 text-sm font-black shadow-sm transition-colors hover:bg-[#E8B4BC]/5"
        >
          <ArrowRight size={16} /> طلبات المتجر
        </button>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-[#E8B4BC]/15 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8B4BC]/10 text-[#E8B4BC]">
                <User size={20} />
              </div>
              <div>
                <h2 className="font-black">1. العميل</h2>
                <p className="text-xs text-[#171717]/50">ابحث أولاً لتجنب تكرار الحساب، أو أدخل عميلاً جديداً.</p>
              </div>
            </div>

            {!selectedCustomer && (
              <div className="relative mb-5">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#171717]/35" size={17} />
                <input
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  placeholder="ابحث بالاسم أو الجوال أو البريد..."
                  className="w-full rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] py-3 pr-10 pl-4 text-sm outline-none transition-colors focus:border-[#E8B4BC]"
                />
                {customerResults.length > 0 && (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-[#E8B4BC]/20 bg-white shadow-xl">
                    {customerResults.map((customer) => (
                      <button
                        key={customer.id || customer.customer_key}
                        type="button"
                        onClick={() => selectCustomer(customer)}
                        className="flex w-full items-center justify-between gap-3 border-b border-[#E8B4BC]/10 px-4 py-3 text-right transition-colors last:border-0 hover:bg-[#FAF9F7]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black">{customer.name || 'بدون اسم'}</span>
                          <span className="mt-0.5 block truncate text-xs text-[#171717]/50">{customer.phone} {customer.email ? `• ${customer.email}` : ''}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-[#C6A56B]/10 px-3 py-1 text-[10px] font-black text-[#C6A56B]">استخدام</span>
                      </button>
                    ))}
                  </div>
                )}
                {loadErrors.customers && (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                    <span>{loadErrors.customers}</span>
                    <button type="button" onClick={fetchData} className="inline-flex shrink-0 items-center gap-1 font-black">
                      <RefreshCw size={13} /> إعادة المحاولة
                    </button>
                  </div>
                )}
                {!loadErrors.customers && customerSearch.trim().length >= 2 && customerResults.length === 0 && (
                  <p className="mt-2 text-xs font-bold text-[#171717]/45">
                    لا يوجد عميل مطابق. يمكنك إدخال بياناته كعميل جديد في الحقول أدناه.
                  </p>
                )}
              </div>
            )}

            {selectedCustomer && (
              <div className="mb-5 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-black text-emerald-800">تم ربط عميل موجود</p>
                    <p className="text-xs text-emerald-700/70">ستُستكمل بياناته الناقصة عند حفظ الطلب.</p>
                  </div>
                </div>
                <button type="button" onClick={clearSelectedCustomer} className="text-xs font-black text-emerald-800 underline underline-offset-4">اختيار عميل آخر</button>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#171717]/60">اسم العميل *</span>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 text-[#E8B4BC]" size={15} />
                  <input value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} className="w-full rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] py-3 pr-9 pl-3 text-sm outline-none focus:border-[#E8B4BC]" />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#171717]/60">رقم الجوال *</span>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-[#E8B4BC]" size={15} />
                  <input value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} inputMode="tel" dir="ltr" placeholder="05xxxxxxxx" className="w-full rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] py-3 pr-9 pl-3 text-left text-sm outline-none focus:border-[#E8B4BC]" />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#171717]/60">البريد الإلكتروني</span>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-[#E8B4BC]" size={15} />
                  <input value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} type="email" dir="ltr" className="w-full rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] py-3 pr-9 pl-3 text-left text-sm outline-none focus:border-[#E8B4BC]" />
                </div>
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#171717]/60">وسيلة التواصل المفضلة</span>
                <div className="relative">
                  <select value={customerForm.preferredContactMethod} onChange={(event) => setCustomerForm({ ...customerForm, preferredContactMethod: event.target.value })} className="w-full appearance-none rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] px-4 py-3 text-sm font-bold outline-none focus:border-[#E8B4BC]">
                    <option value="whatsapp">واتساب</option>
                    <option value="phone">اتصال</option>
                    <option value="email">بريد إلكتروني</option>
                    <option value="sms">رسالة نصية</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/40" size={15} />
                </div>
              </label>
              <label className={`flex items-start gap-3 rounded-xl border p-3.5 ${customerForm.marketingOptIn ? 'border-emerald-200 bg-emerald-50' : 'border-[#E8B4BC]/15 bg-[#FAF9F7]'}`}>
                <input
                  type="checkbox"
                  checked={customerForm.marketingOptIn}
                  disabled={Boolean(selectedCustomer?.marketing_opt_in)}
                  onChange={(event) => setCustomerForm({ ...customerForm, marketingOptIn: event.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-[#C6A56B]"
                />
                <span>
                  <span className="block text-xs font-black">موافقة تسويقية صريحة</span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-[#171717]/50">
                    {selectedCustomer?.marketing_opt_in ? 'العميل مشترك مسبقاً ولن تتغير موافقته.' : 'فعّلها فقط بعد موافقة العميل على استقبال العروض.'}
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E8B4BC]/15 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C6A56B]/10 text-[#C6A56B]">
                <Package size={20} />
              </div>
              <div>
                <h2 className="font-black">2. منتجات المتجر</h2>
                <p className="text-xs text-[#171717]/50">السعر والمخزون يُراجعان مرة أخرى داخل قاعدة البيانات.</p>
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#171717]/35" size={17} />
                <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="ابحث عن منتج..." className="w-full rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] py-3 pr-10 pl-4 text-sm outline-none focus:border-[#E8B4BC]" />
              </div>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                <button type="button" onClick={() => setActiveCategory('all')} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black ${activeCategory === 'all' ? 'bg-[#171717] text-white' : 'bg-[#FAF9F7] text-[#171717]/65'}`}>الكل</button>
                {categories.map((category) => (
                  <button key={category} type="button" onClick={() => setActiveCategory(category)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black ${activeCategory === category ? 'bg-[#171717] text-white' : 'bg-[#FAF9F7] text-[#171717]/65'}`}>
                    {CATEGORY_LABELS[category] || category}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleProducts.map((product) => {
                const available = isProductAvailable(product);
                const stock = getStockQuantity(product);
                const selected = selectedItems.find((item) => String(item.productId) === String(product.id));
                return (
                  <div key={product.id} className={`flex min-h-28 gap-3 rounded-xl border p-3 ${available ? 'border-[#E8B4BC]/15 bg-[#FAF9F7]' : 'border-red-100 bg-red-50/60'}`}>
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-black/5 bg-white">
                      {product.image ? <img src={product.image} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[#E8B4BC]/40"><Package size={20} /></div>}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="line-clamp-2 text-xs font-black leading-relaxed">{product.name}</p>
                      <p className="mt-1 text-xs font-black text-[#C6A56B]">{money(product.price)} ر.س</p>
                      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                        <span className={`text-[10px] font-bold ${available ? 'text-emerald-600' : 'text-red-500'}`}>
                          {available ? (stock === null ? 'متاح' : `المخزون ${stock}`) : 'نفد المخزون'}
                        </span>
                        <button type="button" disabled={!available} onClick={() => addProduct(product)} title="إضافة المنتج" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#171717] text-white transition-colors hover:bg-[#C6A56B] disabled:bg-[#171717]/20">
                          {selected ? <span className="text-xs font-black">{selected.quantity}</span> : <Plus size={15} />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {visibleProducts.length === 0 && (
              <div className="py-10 text-center text-sm font-bold text-[#171717]/40">
                {loadErrors.products ? (
                  <>
                    <p className="text-red-500">{loadErrors.products}</p>
                    <button type="button" onClick={fetchData} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#E8B4BC]/20 bg-white px-3 py-2 text-xs font-black text-[#171717]">
                      <RefreshCw size={14} /> إعادة المحاولة
                    </button>
                  </>
                ) : (
                  'لا توجد منتجات مطابقة.'
                )}
              </div>
            )}

            {orderLines.length > 0 && (
              <div className="mt-6 border-t border-[#E8B4BC]/15 pt-5">
                <h3 className="mb-3 text-sm font-black">المنتجات المختارة</h3>
                <div className="space-y-2">
                  {orderLines.map((item) => {
                    const stock = getStockQuantity(item.product);
                    return (
                      <div key={item.productId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-[#FAF9F7] p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">{item.product.name}</p>
                          <p className="mt-0.5 text-xs text-[#171717]/50">{money(item.product.price)} ر.س للوحدة</p>
                        </div>
                        <div className="flex h-9 items-center overflow-hidden rounded-lg border border-[#E8B4BC]/20 bg-white">
                          <button type="button" onClick={() => changeQuantity(item.productId, item.quantity - 1)} className="flex h-full w-9 items-center justify-center text-[#171717]/60 hover:bg-[#E8B4BC]/10"><Minus size={13} /></button>
                          <input value={item.quantity} onChange={(event) => changeQuantity(item.productId, event.target.value)} type="number" min="1" max={stock ?? 999} className="h-full w-12 border-x border-[#E8B4BC]/15 bg-transparent text-center text-xs font-black outline-none" />
                          <button type="button" onClick={() => changeQuantity(item.productId, item.quantity + 1)} className="flex h-full w-9 items-center justify-center text-[#171717]/60 hover:bg-[#E8B4BC]/10"><Plus size={13} /></button>
                        </div>
                        <div className="col-span-2 flex items-center justify-between gap-3 border-t border-[#E8B4BC]/10 pt-2 sm:col-span-1 sm:border-0 sm:pt-0">
                          <span className="min-w-20 text-left text-sm font-black text-[#C6A56B]">{money(item.product.price * item.quantity)} ر.س</span>
                          <button type="button" onClick={() => removeProduct(item.productId)} title="حذف المنتج" className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[#E8B4BC]/15 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8B4BC]/10 text-[#E8B4BC]">
                <MapPin size={20} />
              </div>
              <div>
                <h2 className="font-black">3. التوصيل والدفع</h2>
                <p className="text-xs text-[#171717]/50">سجّل مصدر الطلب وحالته كما تم الاتفاق مع العميل.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#171717]/60">مصدر الطلب</span>
                <select value={orderForm.source} onChange={(event) => setOrderForm({ ...orderForm, source: event.target.value })} className="w-full rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] px-3 py-3 text-sm font-bold outline-none focus:border-[#E8B4BC]">
                  <option value="whatsapp">واتساب</option>
                  <option value="phone">اتصال</option>
                  <option value="instagram">انستغرام</option>
                  <option value="walk_in">زيارة مباشرة</option>
                  <option value="other">أخرى</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#171717]/60">حالة الطلب</span>
                <select value={orderForm.status} onChange={(event) => setOrderForm({ ...orderForm, status: event.target.value })} className="w-full rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] px-3 py-3 text-sm font-bold outline-none focus:border-[#E8B4BC]">
                  <option value="pending_verification">بانتظار التأكيد</option>
                  <option value="confirmed">مؤكد</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#171717]/60">طريقة الدفع</span>
                <select value={orderForm.paymentMethod} onChange={(event) => setOrderForm({ ...orderForm, paymentMethod: event.target.value })} className="w-full rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] px-3 py-3 text-sm font-bold outline-none focus:border-[#E8B4BC]">
                  <option value="bank_transfer">تحويل بنكي</option>
                  <option value="cash_on_delivery">الدفع عند الاستلام</option>
                  <option value="card">بطاقة</option>
                  <option value="wallet">محفظة</option>
                  <option value="manual">تسجيل يدوي</option>
                  <option value="other">أخرى</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#171717]/60">حالة الدفع</span>
                <select
                  value={orderForm.paymentStatus}
                  onChange={(event) => setOrderForm({
                    ...orderForm,
                    paymentStatus: event.target.value,
                    amountPaid: event.target.value === 'paid' ? grandTotal.toFixed(2) : '0',
                  })}
                  className="w-full rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] px-3 py-3 text-sm font-bold outline-none focus:border-[#E8B4BC]"
                >
                  <option value="pending_payment">بانتظار الدفع</option>
                  <option value="awaiting_review">بانتظار المراجعة</option>
                  <option value="paid">مدفوع</option>
                  <option value="payment_failed">فشل الدفع</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#171717]/60">المبلغ المدفوع</span>
                <input value={orderForm.amountPaid} onChange={(event) => setOrderForm({ ...orderForm, amountPaid: event.target.value })} disabled={orderForm.paymentStatus === 'paid'} type="number" min="0" step="0.01" dir="ltr" className="w-full rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] px-3 py-3 text-left text-sm font-bold outline-none focus:border-[#E8B4BC] disabled:opacity-60" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#171717]/60">رسوم التوصيل</span>
                <input value={orderForm.deliveryFee} onChange={(event) => setOrderForm({ ...orderForm, deliveryFee: event.target.value })} type="number" min="0" step="0.01" dir="ltr" className="w-full rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] px-3 py-3 text-left text-sm font-bold outline-none focus:border-[#E8B4BC]" />
              </label>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <input value={orderForm.city} onChange={(event) => setOrderForm({ ...orderForm, city: event.target.value })} placeholder="المدينة" className="w-full rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] px-3 py-3 text-sm outline-none focus:border-[#E8B4BC]" />
              <input value={orderForm.district} onChange={(event) => setOrderForm({ ...orderForm, district: event.target.value })} placeholder="الحي" className="w-full rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] px-3 py-3 text-sm outline-none focus:border-[#E8B4BC]" />
              <input value={orderForm.street} onChange={(event) => setOrderForm({ ...orderForm, street: event.target.value })} placeholder="الشارع أو وصف الموقع" className="w-full rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] px-3 py-3 text-sm outline-none focus:border-[#E8B4BC]" />
            </div>

            <label className="mt-3 flex items-center gap-2 text-xs font-bold text-[#171717]/60">
              <input type="checkbox" checked={orderForm.saveAddress} onChange={(event) => setOrderForm({ ...orderForm, saveAddress: event.target.checked })} className="h-4 w-4 accent-[#C6A56B]" />
              حفظ العنوان داخل حساب العميل
            </label>

            <div className="mt-5 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#171717]/60">خصم يدوي</span>
                <input value={orderForm.manualDiscountAmount} onChange={(event) => setOrderForm({ ...orderForm, manualDiscountAmount: event.target.value })} type="number" min="0" step="0.01" dir="ltr" className="w-full rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] px-3 py-3 text-left text-sm font-bold outline-none focus:border-[#E8B4BC]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#171717]/60">سبب الخصم {discount > 0 && '*'}</span>
                <input value={orderForm.manualDiscountReason} onChange={(event) => setOrderForm({ ...orderForm, manualDiscountReason: event.target.value })} placeholder="مثال: تعويض عميل أو عرض واتساب" className="w-full rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] px-3 py-3 text-sm outline-none focus:border-[#E8B4BC]" />
              </label>
            </div>

            <label className="mt-5 block">
              <span className="mb-1.5 block text-xs font-bold text-[#171717]/60">ملاحظات الطلب</span>
              <textarea value={orderForm.notes} onChange={(event) => setOrderForm({ ...orderForm, notes: event.target.value })} rows="3" placeholder="تفاصيل الاتفاق مع العميل أو متطلبات التجهيز..." className="w-full resize-y rounded-xl border border-[#E8B4BC]/20 bg-[#FAF9F7] px-3 py-3 text-sm leading-relaxed outline-none focus:border-[#E8B4BC]" />
            </label>
          </section>
        </div>

        <aside className="xl:sticky xl:top-6">
          <div className="overflow-hidden rounded-2xl border border-[#E8B4BC]/20 bg-white shadow-sm">
            <div className="border-b border-[#E8B4BC]/15 bg-[#171717] p-5 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><ShoppingBag size={20} /></div>
                <div>
                  <h2 className="font-black">ملخص الطلب</h2>
                  <p className="text-xs text-white/60">{orderLines.length} منتجات مختارة</p>
                </div>
              </div>
            </div>

            <div className="p-5">
              {orderLines.length === 0 ? (
                <div className="py-8 text-center">
                  <Package className="mx-auto text-[#E8B4BC]/30" size={32} />
                  <p className="mt-2 text-xs font-bold text-[#171717]/40">أضف منتجات ليظهر الحساب.</p>
                </div>
              ) : (
                <div className="mb-5 max-h-52 space-y-2 overflow-y-auto pl-1">
                  {orderLines.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-bold">{item.product.name} × {item.quantity}</span>
                      <span className="shrink-0 font-black">{money(item.product.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 border-t border-[#E8B4BC]/15 pt-4 text-sm">
                <div className="flex justify-between gap-3"><span className="text-[#171717]/55">قيمة المنتجات</span><span className="font-black">{money(subtotal)} ر.س</span></div>
                {discount > 0 && <div className="flex justify-between gap-3 text-emerald-600"><span>خصم يدوي</span><span className="font-black">-{money(discount)} ر.س</span></div>}
                <div className="flex justify-between gap-3"><span className="text-[#171717]/55">التوصيل</span><span className="font-black">{money(deliveryFee)} ر.س</span></div>
                <div className="flex items-end justify-between gap-3 border-t border-[#E8B4BC]/15 pt-4">
                  <span className="font-black">الإجمالي</span>
                  <span className="text-2xl font-black text-[#E8B4BC]">{money(grandTotal)} <small className="text-xs">ر.س</small></span>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-[#FAF9F7] p-3 text-xs leading-relaxed text-[#171717]/60">
                <p className="flex items-center gap-2 font-black text-[#171717]"><AlertCircle size={14} className="text-[#C6A56B]" /> عملية واحدة آمنة</p>
                <p className="mt-1">لن يُنشأ العميل أو الطلب ولن يتغير المخزون إذا فشلت أي خطوة.</p>
              </div>

              <button
                type="button"
                disabled={submitting || selectedItems.length === 0}
                onClick={createOrder}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 py-3 text-sm font-black text-white shadow-lg transition-colors hover:bg-[#C6A56B] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? <><RefreshCw size={17} className="animate-spin" /> جاري إنشاء الطلب</> : <><Check size={17} /> إنشاء الطلب وحجز المخزون</>}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {createdResult && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-emerald-600 px-6 py-7 text-center text-white">
              <CheckCircle2 className="mx-auto" size={42} />
              <h2 className="mt-3 text-xl font-black">تم إنشاء الطلب بنجاح</h2>
              <p className="mt-1 text-sm text-white/75">حُجز المخزون وربط الطلب بالعميل.</p>
            </div>
            <div className="space-y-3 p-6">
              <button type="button" onClick={() => copyValue(createdResult.order?.short_id || String(createdResult.order?.id || '').slice(0, 6), 'رقم الطلب')} className="flex w-full items-center justify-between rounded-xl bg-[#FAF9F7] p-4 text-right">
                <span><span className="block text-[10px] text-[#171717]/45">رقم الطلب</span><span className="mt-1 block font-mono text-lg font-black">#{createdResult.order?.short_id || String(createdResult.order?.id || '').slice(0, 6)}</span></span>
                <Copy size={17} className="text-[#C6A56B]" />
              </button>
              <button type="button" onClick={() => copyValue(createdResult.customer_pin, 'رمز التتبع')} className="flex w-full items-center justify-between rounded-xl bg-[#FAF9F7] p-4 text-right">
                <span><span className="block text-[10px] text-[#171717]/45">رمز تتبع العميل</span><span className="mt-1 block font-mono text-lg font-black">{createdResult.customer_pin}</span></span>
                <Copy size={17} className="text-[#C6A56B]" />
              </button>
              <div className="flex items-center gap-3 rounded-xl border border-[#E8B4BC]/15 p-4">
                <WalletCards size={18} className="text-[#E8B4BC]" />
                <div>
                  <p className="text-sm font-black">{createdResult.customer?.name}</p>
                  <p className="text-xs text-[#171717]/50">{createdResult.customer?.created ? 'تم إنشاء حساب عميل غير مفعّل' : 'تم استخدام حساب العميل الموجود'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={resetPage} className="rounded-xl border border-[#E8B4BC]/20 px-4 py-3 text-sm font-black">طلب جديد</button>
                <button type="button" onClick={() => navigate(`/app/store-orders?order=${createdResult.order?.id}`)} className="rounded-xl bg-[#171717] px-4 py-3 text-sm font-black text-white">فتح الطلب</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
