import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle,
  Clock,
  Home,
  Loader2,
  LogIn,
  MapPin,
  MessageCircle,
  Package,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import CustomerAuthModal from '../components/CustomerAuthModal';
import { supabase } from '../lib/supabase';
import { getCustomerSession } from '../utils/customerSession';
import {
  getPaymentState,
  getStorePaymentMethod,
  getStoreOrderStatus,
  getStoreOrderStepIndex,
  getStoreReturnStatus,
  STORE_ORDER_STEPS,
} from '../utils/storeOrderStatus';
import logo from '../assets/logo-art-moment.svg';

async function getFunctionError(error) {
  try {
    const body = await error?.context?.clone?.().json?.();
    return body?.error || error?.message;
  } catch {
    return error?.message;
  }
}

function formatCurrency(value) {
  return `${Number(value || 0).toFixed(2)} ر.س`;
}

function formatDate(value) {
  if (!value) return 'غير محدد';
  return new Date(value).toLocaleDateString('ar-SA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getTrackingUrl(order) {
  const tracking = order?.trackingNumber;
  const courier = String(order?.courierName || '').toLowerCase();
  if (!tracking) return null;
  if (courier.includes('aramex') || courier.includes('أرامكس')) {
    return `https://www.aramex.com/track/results?ShipmentNumber=${encodeURIComponent(tracking)}`;
  }
  if (courier.includes('smsa') || courier.includes('سمسا')) {
    return `https://www.smsaexpress.com/sa/ar/trackingdetails?tracknumbers=${encodeURIComponent(tracking)}`;
  }
  return null;
}

function StatusBadge({ status }) {
  const info = getStoreOrderStatus(status);
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${info.tone}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {info.label}
    </span>
  );
}

function PaymentBadge({ order }) {
  const payment = getPaymentState(order);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${payment.tone}`}>
      <Wallet size={13} />
      {payment.label}
    </span>
  );
}

function ReturnStatusBadge({ status }) {
  const info = getStoreReturnStatus(status);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${info.tone}`}>
      <RotateCcw size={13} />
      {info.label}
    </span>
  );
}

function ReturnRequestPanel({ order, onSubmitted }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [quantities, setQuantities] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const returnRequests = order.returnRequests || [];
  const latestRequest = returnRequests[0] || null;
  const hasActiveRequest = returnRequests.some((request) => !['rejected', 'refunded'].includes(request.status));
  const canRequestReturn = !hasActiveRequest
    && order.items.length > 0
    && !['cancelled', 'returned'].includes(order.status);

  useEffect(() => {
    setQuantities({});
    setReason('');
    setDetails('');
    setImageUrl('');
    setIsOpen(false);
  }, [order.id]);

  const selectedItems = order.items
    .map((item) => ({
      ...item,
      returnQuantity: Number(quantities[item.id] || 0),
    }))
    .filter((item) => item.returnQuantity > 0);

  const requestedAmount = selectedItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.returnQuantity || 0),
    0,
  );

  const setItemQuantity = (item, value) => {
    const max = Number(item.quantity || 0);
    const next = Math.min(max, Math.max(0, Number(value || 0)));
    setQuantities((current) => ({ ...current, [item.id]: next }));
  };

  const submitReturnRequest = async () => {
    const session = getCustomerSession();
    if (!session?.sessionToken) {
      toast.error('سجلي الدخول أولاً لإرسال طلب الاسترجاع');
      return;
    }
    if (!reason.trim() || selectedItems.length === 0) {
      toast.error('اختاري المنتجات واكتبي سبب الاسترجاع');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading('جاري إرسال طلب الاسترجاع...');
    try {
      const { error } = await supabase.functions.invoke('store-return-requests', {
        body: {
          action: 'create',
          sessionToken: session.sessionToken,
          orderId: order.id,
          reason,
          details,
          imageUrl,
          items: selectedItems.map((item) => ({
            storeOrderItemId: item.id,
            quantity: item.returnQuantity,
          })),
        },
      });

      if (error) throw new Error(await getFunctionError(error));

      toast.success('تم إرسال طلب الاسترجاع للمراجعة', { id: toastId });
      setIsOpen(false);
      onSubmitted?.();
    } catch (err) {
      console.error(err);
      toast.error(
        err.message === 'active_return_request_exists'
          ? 'يوجد طلب استرجاع نشط لهذا الطلب بالفعل'
          : 'تعذر إرسال طلب الاسترجاع حالياً',
        { id: toastId },
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-white rounded-[2rem] border border-[#D9A3AA]/15 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-black text-[#4A4A4A] flex items-center gap-2">
            <RotateCcw size={18} className="text-[#C5A059]" /> الاسترجاع والاسترداد
          </h2>
          <p className="text-xs text-[#4A4A4A]/55 mt-1">
            اختاري المنتجات المراد استرجاعها وسيتم مراجعة الطلب من الإدارة.
          </p>
        </div>
        {latestRequest && <ReturnStatusBadge status={latestRequest.status} />}
      </div>

      {latestRequest && (
        <div className="rounded-2xl bg-[#F8F5F2] border border-[#D9A3AA]/10 p-4 mb-4 space-y-3">
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-[#4A4A4A]/55">قيمة الطلب</span>
            <span className="font-black text-[#C5A059]">{formatCurrency(latestRequest.requestedRefundAmount)}</span>
          </div>
          <p className="text-sm font-bold text-[#4A4A4A]">{latestRequest.reason}</p>
          {latestRequest.adminNote && (
            <p className="rounded-xl bg-white border border-[#D9A3AA]/10 p-3 text-xs text-[#4A4A4A]/70 leading-relaxed">
              {latestRequest.adminNote}
            </p>
          )}
          {latestRequest.items?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {latestRequest.items.map((item) => (
                <span key={item.id} className="rounded-full bg-white border border-[#D9A3AA]/10 px-3 py-1 text-[11px] font-bold">
                  {item.name} × {item.quantity}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {canRequestReturn ? (
        <>
          {!isOpen ? (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="w-full py-3 rounded-2xl bg-[#F8F5F2] border border-[#D9A3AA]/15 text-[#4A4A4A] font-black hover:bg-[#D9A3AA]/10 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={17} /> طلب استرجاع
            </button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-[#F8F5F2] border border-[#D9A3AA]/10 p-3">
                    <div className="w-12 h-12 rounded-xl bg-white overflow-hidden shrink-0">
                      {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <Package className="m-3 text-[#D9A3AA]/35" size={24} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate">{item.name}</p>
                      <p className="text-[11px] text-[#4A4A4A]/45">المتاح للاسترجاع: {item.quantity}</p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={item.quantity}
                      value={quantities[item.id] || 0}
                      onChange={(event) => setItemQuantity(item, event.target.value)}
                      className="w-16 rounded-xl border border-[#D9A3AA]/20 bg-white px-2 py-2 text-center font-black outline-none"
                      dir="ltr"
                    />
                  </div>
                ))}
              </div>

              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="سبب الاسترجاع"
                className="art-input w-full min-h-[80px] resize-none rounded-2xl px-4 py-3 outline-none"
              />
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="تفاصيل إضافية أو ملاحظات"
                className="art-input w-full min-h-[70px] resize-none rounded-2xl px-4 py-3 outline-none"
              />
              <input
                type="url"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="رابط صورة إن وجد"
                className="art-input w-full rounded-2xl px-4 py-3 outline-none"
                dir="ltr"
              />

              <div className="rounded-2xl bg-[#C5A059]/10 border border-[#C5A059]/15 p-3 flex justify-between text-sm font-black">
                <span>المبلغ المتوقع للمراجعة</span>
                <span>{formatCurrency(requestedAmount)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="py-3 rounded-2xl bg-[#F8F5F2] text-[#4A4A4A] font-black border border-[#D9A3AA]/15"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={submitReturnRequest}
                  disabled={submitting || selectedItems.length === 0 || !reason.trim()}
                  className="py-3 rounded-2xl bg-[#4A4A4A] text-white font-black disabled:opacity-45 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  <Send size={16} /> إرسال
                </button>
              </div>
            </div>
          )}
        </>
      ) : !latestRequest ? (
        <p className="rounded-2xl bg-[#F8F5F2] border border-[#D9A3AA]/10 p-4 text-xs font-bold text-[#4A4A4A]/55 leading-relaxed">
          لا يتوفر طلب الاسترجاع لهذا الطلب حالياً. يمكن التواصل مع الدعم عند الحاجة.
        </p>
      ) : null}
    </section>
  );
}

function OrderTimeline({ status }) {
  const activeIndex = getStoreOrderStepIndex(status);
  const isExceptional = activeIndex === -1;

  if (isExceptional) {
    const info = getStoreOrderStatus(status);
    return (
      <div className={`rounded-2xl border p-4 text-sm font-bold ${info.tone}`}>
        {info.description}
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white border border-[#D9A3AA]/15 p-4 sm:p-5 shadow-sm">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {STORE_ORDER_STEPS.map((step, index) => {
          const info = getStoreOrderStatus(step);
          const done = index <= activeIndex;
          const Icon = index === 0 ? ReceiptText : index === 1 ? CheckCircle : index === 2 ? Clock : index === 3 ? Package : index === 4 ? Truck : ShieldCheck;

          return (
            <div key={step} className="flex flex-col items-center text-center gap-2">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-colors ${
                done
                  ? 'bg-[#C5A059] text-white border-[#C5A059] shadow-sm'
                  : 'bg-[#F8F5F2] text-[#4A4A4A]/30 border-[#D9A3AA]/10'
              }`}>
                <Icon size={17} />
              </div>
              <span className={`text-[10px] font-black leading-tight ${done ? 'text-[#4A4A4A]' : 'text-[#4A4A4A]/35'}`}>
                {info.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({ order }) {
  const itemsPreview = order.items?.slice(0, 3) || [];
  const remaining = Math.max(0, Number(order.totalAmount || 0) + Number(order.deliveryFee || 0) - Number(order.amountPaid || 0));

  return (
    <Link
      to={`/store/orders/${order.id}`}
      className="block bg-white rounded-3xl border border-[#D9A3AA]/15 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden"
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <p className="text-[11px] text-[#4A4A4A]/45 font-bold mb-1">رقم الطلب</p>
            <h2 className="font-black text-xl text-[#4A4A4A]" dir="ltr">#{order.shortId}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            <PaymentBadge order={order} />
            {order.returnRequests?.[0] && <ReturnStatusBadge status={order.returnRequests[0].status} />}
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-[#F8F5F2] rounded-2xl px-4 py-3">
            <span className="text-[10px] font-bold text-[#4A4A4A]/45 block mb-1">التاريخ</span>
            <span className="text-sm font-black text-[#4A4A4A]">{formatDate(order.createdAt)}</span>
          </div>
          <div className="bg-[#F8F5F2] rounded-2xl px-4 py-3">
            <span className="text-[10px] font-bold text-[#4A4A4A]/45 block mb-1">الإجمالي</span>
            <span className="text-sm font-black text-[#C5A059]">{formatCurrency(Number(order.totalAmount) + Number(order.deliveryFee || 0))}</span>
          </div>
          <div className="bg-[#F8F5F2] rounded-2xl px-4 py-3">
            <span className="text-[10px] font-bold text-[#4A4A4A]/45 block mb-1">المتبقي</span>
            <span className={`text-sm font-black ${remaining > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {remaining > 0 ? formatCurrency(remaining) : 'لا يوجد'}
            </span>
          </div>
        </div>

        {itemsPreview.length > 0 && (
          <div className="flex items-center gap-2 overflow-hidden">
            {itemsPreview.map((item) => (
              <div key={item.id || item.productId} className="flex items-center gap-2 bg-[#F8F5F2] rounded-2xl p-2 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white overflow-hidden shrink-0 border border-[#D9A3AA]/10">
                  {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <Package className="m-2 text-[#D9A3AA]/35" size={22} />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#4A4A4A] truncate max-w-[9rem]">{item.name}</p>
                  <p className="text-[10px] text-[#4A4A4A]/45">الكمية: {item.quantity}</p>
                </div>
              </div>
            ))}
            {order.items.length > itemsPreview.length && (
              <span className="text-xs font-black text-[#D9A3AA] shrink-0">+{order.items.length - itemsPreview.length}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function OrderDetails({ order, onReturnSubmitted }) {
  const trackingUrl = getTrackingUrl(order);
  const total = Number(order.totalAmount || 0) + Number(order.deliveryFee || 0);
  const remaining = Math.max(0, total - Number(order.amountPaid || 0));
  const refunded = Number(order.refundedAmount || 0);
  const status = getStoreOrderStatus(order.status);
  const payment = getPaymentState(order);

  return (
    <div className="space-y-6">
      <Link to="/store/orders" className="inline-flex items-center gap-2 text-sm font-black text-[#4A4A4A]/60 hover:text-[#D9A3AA]">
        <ArrowRight size={18} /> العودة إلى طلباتي
      </Link>

      <section className="bg-[#4A4A4A] text-white rounded-[2rem] p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-[#C5A059]/20 blur-2xl" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-white/55 text-xs font-bold mb-2">طلب متجر لحظة فن</p>
            <h1 className="text-3xl sm:text-4xl font-black mb-3" dir="ltr">#{order.shortId}</h1>
            <p className="text-white/70 text-sm max-w-xl">{status.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={order.status} />
            <PaymentBadge order={order} />
          </div>
        </div>
      </section>

      <OrderTimeline status={order.status} />

      <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] gap-6">
        <section className="bg-white rounded-[2rem] border border-[#D9A3AA]/15 p-5 sm:p-6 shadow-sm">
          <h2 className="font-black text-lg text-[#4A4A4A] mb-5 flex items-center gap-2">
            <ShoppingBag size={20} className="text-[#C5A059]" /> المنتجات
          </h2>
          <div className="space-y-3">
            {order.items.length === 0 ? (
              <p className="text-sm text-[#4A4A4A]/45">لا توجد منتجات مسجلة لهذا الطلب.</p>
            ) : order.items.map((item) => (
              <div key={item.id || item.productId} className="flex items-center gap-4 bg-[#F8F5F2] rounded-2xl p-3 border border-[#D9A3AA]/10">
                <div className="w-16 h-16 rounded-2xl bg-white overflow-hidden shrink-0 border border-[#D9A3AA]/15">
                  {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <Package className="m-4 text-[#D9A3AA]/35" size={30} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-[#4A4A4A] truncate">{item.name}</h3>
                  <p className="text-xs text-[#4A4A4A]/50 mt-1">الكمية: {item.quantity}</p>
                </div>
                <div className="text-left shrink-0">
                  <p className="font-black text-[#C5A059]">{formatCurrency(item.price * item.quantity)}</p>
                  <p className="text-[10px] text-[#4A4A4A]/40">{formatCurrency(item.price)} للقطعة</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="bg-white rounded-[2rem] border border-[#D9A3AA]/15 p-5 shadow-sm">
            <h2 className="font-black text-[#4A4A4A] mb-4 flex items-center gap-2">
              <ReceiptText size={18} className="text-[#D9A3AA]" /> ملخص الدفع
            </h2>
            <div className={`mb-4 rounded-2xl border p-3 ${payment.tone}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black">حالة الدفع</span>
                <span className="text-sm font-black">{payment.label}</span>
              </div>
              <p className="mt-1 text-xs opacity-75">{payment.description}</p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#4A4A4A]/55">طريقة الدفع</span>
                <span className="font-bold">{getStorePaymentMethod(order.paymentMethod)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4A4A4A]/55">المنتجات</span>
                <span className="font-bold">{formatCurrency(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4A4A4A]/55">الشحن</span>
                <span className="font-bold">{Number(order.deliveryFee || 0) > 0 ? formatCurrency(order.deliveryFee) : 'يحدد لاحقاً'}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>المدفوع</span>
                <span className="font-bold">{formatCurrency(order.amountPaid)}</span>
              </div>
              {refunded > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>المسترد</span>
                  <span className="font-bold">{formatCurrency(refunded)}</span>
                </div>
              )}
              <div className="border-t border-[#D9A3AA]/15 pt-3 flex justify-between font-black text-base">
                <span>المتبقي</span>
                <span className={remaining > 0 ? 'text-red-500' : 'text-emerald-600'}>
                  {remaining > 0 ? formatCurrency(remaining) : 'لا يوجد'}
                </span>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-[2rem] border border-[#D9A3AA]/15 p-5 shadow-sm">
            <h2 className="font-black text-[#4A4A4A] mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-[#C5A059]" /> التوصيل
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2 text-[#4A4A4A]/70">
                <CalendarDays size={16} className="mt-0.5 text-[#D9A3AA]" />
                <span>{formatDate(order.createdAt)}</span>
              </div>
              <div className="flex items-start gap-2 text-[#4A4A4A]/70">
                <MapPin size={16} className="mt-0.5 text-[#D9A3AA]" />
                <span>{[order.city, order.district, order.street].filter(Boolean).join(' - ') || 'لم يتم تسجيل عنوان مفصل'}</span>
              </div>
              {order.trackingNumber && (
                <div className="rounded-2xl bg-[#F8F5F2] p-3 border border-[#D9A3AA]/10">
                  <p className="text-[10px] font-bold text-[#4A4A4A]/45 mb-1">رقم التتبع</p>
                  {trackingUrl ? (
                    <a href={trackingUrl} target="_blank" rel="noreferrer" className="font-black text-[#C5A059] underline" dir="ltr">
                      {order.trackingNumber}
                    </a>
                  ) : (
                    <span className="font-black text-[#C5A059]" dir="ltr">{order.trackingNumber}</span>
                  )}
                  {order.courierName && <p className="text-xs text-[#4A4A4A]/50 mt-1">{order.courierName}</p>}
                </div>
              )}
            </div>
          </section>

          <ReturnRequestPanel order={order} onSubmitted={onReturnSubmitted} />

          <a
            href={`https://wa.me/966569663697?text=${encodeURIComponent(`مرحباً، أحتاج مساعدة بخصوص طلب المتجر #${order.shortId}`)}`}
            target="_blank"
            rel="noreferrer"
            className="w-full py-4 rounded-2xl bg-[#25D366] text-white font-black flex items-center justify-center gap-2 shadow-lg hover:bg-[#128C7E] transition-colors"
          >
            <MessageCircle size={19} /> التواصل بخصوص الطلب
          </a>
        </aside>
      </div>
    </div>
  );
}

export default function CustomerOrdersPage() {
  const { orderId } = useParams();
  const [customer, setCustomer] = useState(() => getCustomerSession());
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const canLoadOrders = Boolean(customer?.sessionToken);

  const loadOrders = useCallback(async () => {
    const session = getCustomerSession();
    setCustomer(session);

    if (!session?.sessionToken) {
      setOrders([]);
      setSelectedOrder(null);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: functionError } = await supabase.functions.invoke('customer-orders', {
        body: {
          sessionToken: session.sessionToken,
          orderId,
        },
      });
      if (functionError) throw new Error(await getFunctionError(functionError));

      setOrders(data?.orders || []);
      setSelectedOrder(orderId ? data?.order || null : null);
      if (orderId && !data?.order) setError('لم يتم العثور على هذا الطلب ضمن حسابك.');
    } catch (err) {
      console.error(err);
      setError(err.message === 'unauthorized'
        ? 'انتهت جلسة الدخول. سجلي الدخول مرة أخرى لعرض طلباتك.'
        : 'تعذر تحميل طلباتك حالياً. حاولي مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const stats = useMemo(() => {
    const total = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0) + Number(order.deliveryFee || 0), 0);
    const active = orders.filter((order) => !['delivered', 'cancelled', 'returned'].includes(order.status)).length;
    return { total, active };
  }, [orders]);

  return (
    <div className="art-page min-h-screen font-sans text-[#4A4A4A] pb-20" dir="rtl">
      <header className="art-nav art-nav-scrolled sticky top-0 z-40">
        <div className="art-shell h-16 flex items-center justify-between">
          <Link to="/store" className="inline-flex items-center gap-2 text-sm font-black text-[#4A4A4A]/65 hover:text-[#D9A3AA]">
            <ArrowRight size={18} /> المتجر
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Art Moment" className="w-9 h-9 object-contain" />
            <span className="font-black">لحظة فن</span>
          </Link>
          <Link to="/" className="w-10 h-10 rounded-full bg-white border border-[#D9A3AA]/15 flex items-center justify-center text-[#4A4A4A]/70 hover:text-[#D9A3AA]">
            <Home size={18} />
          </Link>
        </div>
      </header>

      <main className="art-shell py-8 sm:py-10">
        <div className="mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <p className="text-xs font-black text-[#C5A059] mb-2">حساب العميل</p>
            <h1 className="text-3xl sm:text-4xl font-black text-[#4A4A4A] mb-2">طلباتي</h1>
            <p className="text-[#4A4A4A]/60 text-sm max-w-2xl">
              كل طلبات المتجر المرتبطة بحسابك، مع تفاصيل المنتجات والدفع والتوصيل في مكان واحد.
            </p>
          </div>

          {canLoadOrders && (
            <button
              type="button"
              onClick={loadOrders}
              disabled={loading}
              className="w-fit px-4 py-2.5 rounded-full bg-white border border-[#D9A3AA]/20 text-sm font-black text-[#4A4A4A] hover:bg-[#F8F5F2] flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> تحديث
            </button>
          )}
        </div>

        {!canLoadOrders ? (
          <section className="bg-white rounded-[2rem] border border-[#D9A3AA]/15 shadow-sm p-8 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-[#D9A3AA]/10 text-[#D9A3AA] flex items-center justify-center mx-auto mb-4">
              <LogIn size={30} />
            </div>
            <h2 className="font-black text-2xl mb-2">سجلي الدخول لعرض طلباتك</h2>
            <p className="text-sm text-[#4A4A4A]/60 leading-relaxed mb-6">
              نحتاج جلسة حساب آمنة حتى نعرض طلباتك بدون كشف بيانات العملاء الآخرين.
            </p>
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="art-cta px-8 py-3 rounded-2xl font-black inline-flex items-center gap-2"
            >
              <LogIn size={18} /> تسجيل الدخول
            </button>
          </section>
        ) : loading ? (
          <div className="min-h-[45vh] flex flex-col items-center justify-center text-[#4A4A4A]/55">
            <Loader2 size={34} className="animate-spin text-[#D9A3AA] mb-4" />
            <p className="font-bold">جاري تحميل طلباتك...</p>
          </div>
        ) : error ? (
          <section className="bg-white rounded-[2rem] border border-red-100 shadow-sm p-8 text-center max-w-xl mx-auto">
            <AlertCircle size={38} className="mx-auto mb-4 text-red-500" />
            <h2 className="font-black text-xl mb-2">تعذر عرض الطلبات</h2>
            <p className="text-sm text-[#4A4A4A]/60 mb-5">{error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={loadOrders} className="px-5 py-2.5 rounded-xl bg-[#4A4A4A] text-white font-bold">إعادة المحاولة</button>
              <button onClick={() => setIsAuthModalOpen(true)} className="px-5 py-2.5 rounded-xl bg-[#F8F5F2] text-[#4A4A4A] font-bold border border-[#D9A3AA]/20">تسجيل الدخول</button>
            </div>
          </section>
        ) : orderId ? (
          selectedOrder ? <OrderDetails order={selectedOrder} onReturnSubmitted={loadOrders} /> : null
        ) : (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-3xl border border-[#D9A3AA]/15 p-5 shadow-sm">
                <span className="text-xs font-bold text-[#4A4A4A]/45">عدد الطلبات</span>
                <p className="text-3xl font-black mt-2">{orders.length}</p>
              </div>
              <div className="bg-white rounded-3xl border border-[#D9A3AA]/15 p-5 shadow-sm">
                <span className="text-xs font-bold text-[#4A4A4A]/45">طلبات نشطة</span>
                <p className="text-3xl font-black mt-2 text-[#C5A059]">{stats.active}</p>
              </div>
              <div className="bg-white rounded-3xl border border-[#D9A3AA]/15 p-5 shadow-sm">
                <span className="text-xs font-bold text-[#4A4A4A]/45">إجمالي مشتريات المتجر</span>
                <p className="text-2xl font-black mt-2 text-[#D9A3AA]">{formatCurrency(stats.total)}</p>
              </div>
            </div>

            {orders.length === 0 ? (
              <section className="bg-white rounded-[2rem] border border-[#D9A3AA]/15 shadow-sm p-8 text-center">
                <ShoppingBag size={42} className="mx-auto mb-4 text-[#D9A3AA]/45" />
                <h2 className="font-black text-2xl mb-2">لا توجد طلبات متجر بعد</h2>
                <p className="text-sm text-[#4A4A4A]/55 mb-6">ابدئي من المتجر، وستظهر طلباتك هنا تلقائياً بعد تأكيدها.</p>
                <Link to="/store" className="art-cta px-8 py-3 rounded-2xl font-black inline-flex items-center gap-2">
                  <ShoppingBag size={18} /> تصفح المتجر
                </Link>
              </section>
            ) : (
              <div className="grid xl:grid-cols-2 gap-5">
                {orders.map((order) => <OrderCard key={order.id} order={order} />)}
              </div>
            )}
          </div>
        )}
      </main>

      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setCustomer(getCustomerSession());
          loadOrders();
        }}
      />
    </div>
  );
}
