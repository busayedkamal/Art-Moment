import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle,
  Clock,
  Copy,
  Download,
  Gift,
  Home,
  Loader2,
  LogIn,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  Plus,
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
import SeoHead from '../components/SeoHead';
import { RewardPointsSummary, RewardRedemptionForm } from '../components/RewardPointsSummary';
import { supabase } from '../lib/supabase';
import { getCustomerSession } from '../utils/customerSession';
import { clampCartQuantity, normalizeStockQuantity } from '../utils/productStock';
import { getCartLineKey, getSelectedOptionLabels } from '../utils/productOptions';
import { formatPrintOptionSummary } from '../utils/printOptions';
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildReceiptHtml(order) {
  const total = Number(order.totalAmount || 0) + Number(order.deliveryFee || 0);
  const pointsUsedAmount = Number(order.pointsUsedAmount || 0);
  const pointsRestoredAmount = Number(order.pointsRestoredAmount || 0);
  const remaining = Math.max(0, total - Number(order.amountPaid || 0) - pointsUsedAmount);
  const discount = Number(order.discountAmount || 0);
  const subtotal = Number(order.subtotalAmount ?? order.totalAmount ?? 0);
  const itemsRows = (order.items || []).map(item => {
    const optionsText = item.itemType === 'print'
      ? formatPrintOptionSummary(item.selectedOptions)
      : getSelectedOptionLabels(item.productOptions, item.selectedOptions)
        .map((option) => `${option.name}: ${option.label}`)
        .join(' • ');
    return `
    <tr>
      <td>${escapeHtml(item.name)}${optionsText ? `<div class="muted">${escapeHtml(optionsText)}</div>` : ''}</td>
      <td>${Number(item.quantity || 0)}</td>
      <td>${formatCurrency(item.price)}</td>
      <td>${formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}</td>
    </tr>
  `;
  }).join('');

  return `<!doctype html>
  <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <title>إيصال طلب #${escapeHtml(order.shortId)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
      <style>
        body { font-family:'Tajawal', Arial, sans-serif; background:#FAF9F7; color:#171717; margin:0; padding:32px; }
        .receipt { max-width:760px; margin:auto; background:#fff; border:1px solid #ead8da; border-radius:24px; padding:28px; }
        h1 { margin:0 0 8px; font-size:28px; }
        .muted { color:#888; font-size:13px; }
        .brand { color:#C6A56B; font-weight:800; margin-bottom:20px; }
        .grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px; margin:22px 0; }
        .box { background:#FAF9F7; border-radius:16px; padding:14px; }
        table { width:100%; border-collapse:collapse; margin:18px 0; }
        th, td { padding:12px; border-bottom:1px solid #f0e3e4; text-align:right; font-size:14px; }
        th { color:#9d6f74; }
        .totals { margin-top:18px; display:grid; gap:10px; }
        .line { display:flex; justify-content:space-between; gap:20px; }
        .final { font-size:20px; font-weight:900; border-top:1px solid #ead8da; padding-top:14px; }
        @media print { body { background:#fff; padding:0; } .receipt { border:0; } }
      </style>
    </head>
    <body>
      <main class="receipt">
        <div class="brand">لحظة فن Art Moment</div>
        <h1>إيصال طلب #${escapeHtml(order.shortId)}</h1>
        <p class="muted">تم إنشاء الإيصال بتاريخ ${escapeHtml(new Date().toLocaleDateString('ar-SA'))}</p>
        <div class="grid">
          <div class="box"><strong>حالة الطلب</strong><br />${escapeHtml(getStoreOrderStatus(order.status).label)}</div>
          <div class="box"><strong>حالة الدفع</strong><br />${escapeHtml(getPaymentState(order).label)}</div>
          <div class="box"><strong>التاريخ</strong><br />${escapeHtml(formatDate(order.createdAt))}</div>
          <div class="box"><strong>العنوان</strong><br />${escapeHtml([order.city, order.district, order.street].filter(Boolean).join(' - ') || 'غير مسجل')}</div>
        </div>
        <table>
          <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
          <tbody>${itemsRows || '<tr><td colspan="4">لا توجد منتجات</td></tr>'}</tbody>
        </table>
        <div class="totals">
          <div class="line"><span>المنتجات قبل الخصم</span><strong>${formatCurrency(subtotal)}</strong></div>
          ${discount > 0 ? `<div class="line"><span>${order.couponCode ? `كوبون ${escapeHtml(order.couponCode)}` : 'خصم'}</span><strong>-${formatCurrency(discount)}</strong></div>` : ''}
          <div class="line"><span>الشحن</span><strong>${Number(order.deliveryFee || 0) > 0 ? formatCurrency(order.deliveryFee) : 'يحدد لاحقاً'}</strong></div>
          <div class="line"><span>المدفوع نقداً</span><strong>${formatCurrency(order.amountPaid)}</strong></div>
          ${pointsUsedAmount > 0 ? `<div class="line"><span>مدفوع بالنقاط (${Number(order.rewardPointsUsed || 0).toLocaleString()} نقطة)</span><strong>${formatCurrency(pointsUsedAmount)}</strong></div>` : ''}
          ${pointsRestoredAmount > 0 ? `<div class="line"><span>نقاط مستعادة (${Number(order.rewardPointsRestored || 0).toLocaleString()} نقطة)</span><strong>+${formatCurrency(pointsRestoredAmount)}</strong></div>` : ''}
          <div class="line final"><span>المتبقي</span><strong>${remaining > 0 ? formatCurrency(remaining) : 'لا يوجد'}</strong></div>
        </div>
      </main>
    </body>
  </html>`;
}

async function downloadReceipt(order) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const frame = document.createElement('iframe');
  frame.setAttribute('title', 'تجهيز إيصال الطلب');
  frame.style.position = 'fixed';
  frame.style.left = '-10000px';
  frame.style.top = '0';
  frame.style.width = '900px';
  frame.style.height = '1200px';
  frame.style.opacity = '0';
  document.body.appendChild(frame);

  try {
    const frameDocument = frame.contentDocument;
    frameDocument.open();
    frameDocument.write(buildReceiptHtml(order));
    frameDocument.close();
    await frameDocument.fonts?.ready;
    await new Promise((resolve) => window.setTimeout(resolve, 250));

    const receipt = frameDocument.querySelector('.receipt');
    if (!receipt) throw new Error('receipt_render_failed');
    const canvas = await html2canvas(receipt, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#FFFFFF',
      logging: false,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const imageWidth = pageWidth - (margin * 2);
    const imageHeight = (canvas.height * imageWidth) / canvas.width;
    let remainingHeight = imageHeight;
    let position = margin;
    const imageData = canvas.toDataURL('image/jpeg', 0.94);

    pdf.addImage(imageData, 'JPEG', margin, position, imageWidth, imageHeight);
    remainingHeight -= pageHeight - (margin * 2);
    while (remainingHeight > 0) {
      position = margin - (imageHeight - remainingHeight);
      pdf.addPage();
      pdf.addImage(imageData, 'JPEG', margin, position, imageWidth, imageHeight);
      remainingHeight -= pageHeight - (margin * 2);
    }
    pdf.save(`art-moment-receipt-${order.shortId || order.id}.pdf`);
  } finally {
    frame.remove();
  }
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

function ReturnRequestPanel({ order, onSubmitted, returnWindowDays }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [quantities, setQuantities] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const returnRequests = order.returnRequests || [];
  const latestRequest = returnRequests[0] || null;
  const hasActiveRequest = returnRequests.some((request) => !['rejected', 'refunded'].includes(request.status));
  const returnWindowTimestamp = order.updatedAt || order.createdAt;
  const returnWindowStartedAt = returnWindowTimestamp
    ? new Date(returnWindowTimestamp).getTime()
    : Number.NaN;
  const returnWindowExpired = Number.isFinite(returnWindowStartedAt)
    && Date.now() - returnWindowStartedAt > Number(returnWindowDays || 7) * 86400000;
  const canRequestReturn = !hasActiveRequest
    && order.items.length > 0
    && !['cancelled', 'returned'].includes(order.status)
    && !returnWindowExpired;

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
    const next = Math.min(max, Math.max(0, Math.floor(Number(value || 0))));
    setQuantities((current) => ({ ...current, [item.id]: next }));
  };

  const openReturnForm = () => {
    if (order.items.length === 1) {
      const [item] = order.items;
      setQuantities({ [item.id]: Math.min(1, Number(item.quantity || 0)) });
    }
    setIsOpen(true);
  };

  const returnValidationMessage = selectedItems.length === 0
    ? 'اختر كمية منتج واحد على الأقل.'
    : reason.trim().length < 3
      ? 'اكتب سبب الاسترجاع بوضوح.'
      : 'الطلب جاهز للإرسال إلى الإدارة.';

  const submitReturnRequest = async () => {
    const session = getCustomerSession();
    if (!session?.sessionToken) {
      toast.error('سجلي الدخول أولاً لإرسال طلب الاسترجاع');
      return;
    }
    if (reason.trim().length < 3 || selectedItems.length === 0) {
      toast.error('اختر المنتجات واكتب سبب الاسترجاع');
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
          : err.message === 'return_window_expired'
            ? `انتهت مهلة الاسترجاع المحددة بـ ${returnWindowDays} أيام`
            : 'تعذر إرسال طلب الاسترجاع حالياً',
        { id: toastId },
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-white rounded-[2rem] border border-[#E8B4BC]/15 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-black text-[#171717] flex items-center gap-2">
            <RotateCcw size={18} className="text-[#C6A56B]" /> الاسترجاع والاسترداد
          </h2>
          <p className="text-xs text-[#171717]/55 mt-1">
            اختر المنتجات المراد استرجاعها وسيتم مراجعة الطلب من الإدارة.
          </p>
        </div>
        {latestRequest && <ReturnStatusBadge status={latestRequest.status} />}
      </div>

      {latestRequest && (
        <div className="rounded-2xl bg-[#FAF9F7] border border-[#E8B4BC]/10 p-4 mb-4 space-y-3">
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-[#171717]/55">قيمة الطلب</span>
            <span className="font-black text-[#C6A56B]">{formatCurrency(latestRequest.requestedRefundAmount)}</span>
          </div>
          <p className="text-sm font-bold text-[#171717]">{latestRequest.reason}</p>
          {latestRequest.adminNote && (
            <p className="rounded-xl bg-white border border-[#E8B4BC]/10 p-3 text-xs text-[#171717]/70 leading-relaxed">
              {latestRequest.adminNote}
            </p>
          )}
          {latestRequest.items?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {latestRequest.items.map((item) => (
                <span key={item.id} className="rounded-full bg-white border border-[#E8B4BC]/10 px-3 py-1 text-[11px] font-bold">
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
              onClick={openReturnForm}
              className="w-full py-3 rounded-2xl bg-[#FAF9F7] border border-[#E8B4BC]/15 text-[#171717] font-black hover:bg-[#E8B4BC]/10 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={17} /> طلب استرجاع
            </button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-black text-[#171717]/60">حددي الكمية المراد استرجاعها من كل منتج</p>
                {order.items.map((item) => {
                  const selectedQuantity = Number(quantities[item.id] || 0);
                  const maxQuantity = Number(item.quantity || 0);

                  return (
                    <div
                      key={item.id}
                      className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 transition-colors ${
                        selectedQuantity > 0
                          ? 'bg-[#C6A56B]/10 border-[#C6A56B]/25'
                          : 'bg-[#FAF9F7] border-[#E8B4BC]/10'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-white overflow-hidden shrink-0">
                        {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <Package className="m-3 text-[#E8B4BC]/35" size={24} />}
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <p className="text-sm font-black truncate">{item.name}</p>
                        <p className="text-[11px] text-[#171717]/45">المتاح للاسترجاع: {maxQuantity}</p>
                      </div>
                      <div className="grid h-10 w-[116px] shrink-0 grid-cols-[36px_1fr_36px] items-center overflow-hidden rounded-xl border border-[#E8B4BC]/20 bg-white" dir="ltr">
                        <button
                          type="button"
                          onClick={() => setItemQuantity(item, selectedQuantity - 1)}
                          disabled={selectedQuantity <= 0}
                          aria-label={`تقليل كمية ${item.name}`}
                          className="flex h-full items-center justify-center text-[#171717] hover:bg-[#E8B4BC]/10 disabled:opacity-25"
                        >
                          <Minus size={15} />
                        </button>
                        <output className="text-center text-sm font-black text-[#171717]" aria-live="polite">
                          {selectedQuantity}
                        </output>
                        <button
                          type="button"
                          onClick={() => setItemQuantity(item, selectedQuantity + 1)}
                          disabled={selectedQuantity >= maxQuantity}
                          aria-label={`زيادة كمية ${item.name}`}
                          className="flex h-full items-center justify-center text-[#171717] hover:bg-[#E8B4BC]/10 disabled:opacity-25"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
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

              <div className="rounded-2xl bg-[#C6A56B]/10 border border-[#C6A56B]/15 p-3 flex justify-between text-sm font-black">
                <span>المبلغ المتوقع للمراجعة</span>
                <span>{formatCurrency(requestedAmount)}</span>
              </div>

              <p
                className={`text-xs font-bold ${selectedItems.length > 0 && reason.trim().length >= 3 ? 'text-emerald-600' : 'text-amber-700'}`}
                aria-live="polite"
              >
                {returnValidationMessage}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="py-3 rounded-2xl bg-[#FAF9F7] text-[#171717] font-black border border-[#E8B4BC]/15"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={submitReturnRequest}
                  disabled={submitting}
                  className="py-3 rounded-2xl bg-[#171717] text-white font-black disabled:opacity-45 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {submitting ? 'جاري الإرسال' : 'إرسال'}
                </button>
              </div>
            </div>
          )}
        </>
      ) : !latestRequest ? (
        <p className="rounded-2xl bg-[#FAF9F7] border border-[#E8B4BC]/10 p-4 text-xs font-bold text-[#171717]/55 leading-relaxed">
          {returnWindowExpired
            ? `انتهت مهلة الاسترجاع لهذا الطلب بعد ${returnWindowDays} أيام من آخر تحديث.`
            : 'لا يتوفر طلب الاسترجاع لهذا الطلب حالياً. يمكن التواصل مع الدعم عند الحاجة.'}
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
    <div className="rounded-3xl bg-white border border-[#E8B4BC]/15 p-4 sm:p-5 shadow-sm">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {STORE_ORDER_STEPS.map((step, index) => {
          const info = getStoreOrderStatus(step);
          const done = index <= activeIndex;
          const Icon = index === 0 ? ReceiptText : index === 1 ? CheckCircle : index === 2 ? Clock : index === 3 ? Package : index === 4 ? Truck : ShieldCheck;

          return (
            <div key={step} className="flex flex-col items-center text-center gap-2">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-colors ${
                done
                  ? 'bg-[#C6A56B] text-white border-[#C6A56B] shadow-sm'
                  : 'bg-[#FAF9F7] text-[#171717]/30 border-[#E8B4BC]/10'
              }`}>
                <Icon size={17} />
              </div>
              <span className={`text-[10px] font-black leading-tight ${done ? 'text-[#171717]' : 'text-[#171717]/35'}`}>
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
  const remaining = Math.max(
    0,
    Number(order.totalAmount || 0)
      + Number(order.deliveryFee || 0)
      - Number(order.amountPaid || 0)
      - Number(order.pointsUsedAmount || 0),
  );

  return (
    <Link
      to={`/store/orders/${order.id}`}
      className="block bg-white rounded-3xl border border-[#E8B4BC]/15 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden"
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <p className="text-[11px] text-[#171717]/45 font-bold mb-1">رقم الطلب</p>
            <h2 className="font-black text-xl text-[#171717]" dir="ltr">#{order.shortId}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            <PaymentBadge order={order} />
            {order.returnRequests?.[0] && <ReturnStatusBadge status={order.returnRequests[0].status} />}
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-[#FAF9F7] rounded-2xl px-4 py-3">
            <span className="text-[10px] font-bold text-[#171717]/45 block mb-1">التاريخ</span>
            <span className="text-sm font-black text-[#171717]">{formatDate(order.createdAt)}</span>
          </div>
          <div className="bg-[#FAF9F7] rounded-2xl px-4 py-3">
            <span className="text-[10px] font-bold text-[#171717]/45 block mb-1">الإجمالي</span>
            <span className="text-sm font-black text-[#C6A56B]">{formatCurrency(Number(order.totalAmount) + Number(order.deliveryFee || 0))}</span>
          </div>
          <div className="bg-[#FAF9F7] rounded-2xl px-4 py-3">
            <span className="text-[10px] font-bold text-[#171717]/45 block mb-1">المتبقي</span>
            <span className={`text-sm font-black ${remaining > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {remaining > 0 ? formatCurrency(remaining) : 'لا يوجد'}
            </span>
          </div>
        </div>

        {itemsPreview.length > 0 && (
          <div className="flex items-center gap-2 overflow-hidden">
            {itemsPreview.map((item) => (
              <div key={item.id || item.productId} className="flex items-center gap-2 bg-[#FAF9F7] rounded-2xl p-2 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white overflow-hidden shrink-0 border border-[#E8B4BC]/10">
                  {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <Package className="m-2 text-[#E8B4BC]/35" size={22} />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#171717] truncate max-w-[9rem]">{item.name}</p>
                  <p className="text-[10px] text-[#171717]/45">الكمية: {item.quantity}</p>
                </div>
              </div>
            ))}
            {order.items.length > itemsPreview.length && (
              <span className="text-xs font-black text-[#E8B4BC] shrink-0">+{order.items.length - itemsPreview.length}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function OrderDetails({ order, rewards, onReturnSubmitted, onReorder, onDownloadReceipt, onApplyRewardPoints, applyingRewardPoints, returnWindowDays }) {
  const trackingUrl = getTrackingUrl(order);
  const total = Number(order.totalAmount || 0) + Number(order.deliveryFee || 0);
  const remaining = Math.max(0, total - Number(order.amountPaid || 0) - Number(order.pointsUsedAmount || 0));
  const refunded = Number(order.refundedAmount || 0);
  const subtotalBeforeDiscount = Number(order.subtotalAmount ?? order.totalAmount ?? 0);
  const discountAmount = Number(order.discountAmount || 0);
  const status = getStoreOrderStatus(order.status);
  const payment = getPaymentState(order);

  return (
    <div className="space-y-6">
      <Link to="/store/orders" className="inline-flex items-center gap-2 text-sm font-black text-[#171717]/60 hover:text-[#E8B4BC]">
        <ArrowRight size={18} /> العودة إلى طلباتي
      </Link>

      <section className="bg-[#171717] text-white rounded-[2rem] p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-[#C6A56B]/20 blur-2xl" />
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

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onReorder?.(order)}
          className="rounded-2xl bg-white border border-[#E8B4BC]/15 px-5 py-4 text-sm font-black text-[#171717] shadow-sm hover:border-[#E8B4BC]/40 hover:bg-[#FAF9F7] transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw size={17} className="text-[#C6A56B]" /> إعادة الطلب
        </button>
        <button
          type="button"
          onClick={() => onDownloadReceipt?.(order)}
          className="rounded-2xl bg-white border border-[#E8B4BC]/15 px-5 py-4 text-sm font-black text-[#171717] shadow-sm hover:border-[#E8B4BC]/40 hover:bg-[#FAF9F7] transition-colors flex items-center justify-center gap-2"
        >
          <Download size={17} className="text-[#E8B4BC]" /> تحميل الإيصال
        </button>
      </div>

      <RewardPointsSummary rewards={rewards} compact />

      <OrderTimeline status={order.status} />

      <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] gap-6">
        <section className="bg-white rounded-[2rem] border border-[#E8B4BC]/15 p-5 sm:p-6 shadow-sm">
          <h2 className="font-black text-lg text-[#171717] mb-5 flex items-center gap-2">
            <ShoppingBag size={20} className="text-[#C6A56B]" /> المنتجات
          </h2>
          <div className="space-y-3">
            {order.items.length === 0 ? (
              <p className="text-sm text-[#171717]/45">لا توجد منتجات مسجلة لهذا الطلب.</p>
            ) : order.items.map((item) => (
              <div key={item.id || item.productId} className="flex items-center gap-4 bg-[#FAF9F7] rounded-2xl p-3 border border-[#E8B4BC]/10">
                <div className="w-16 h-16 rounded-2xl bg-white overflow-hidden shrink-0 border border-[#E8B4BC]/15">
                  {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <Package className="m-4 text-[#E8B4BC]/35" size={30} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-[#171717] truncate">{item.name}</h3>
                  {getSelectedOptionLabels(item.productOptions, item.selectedOptions).length > 0 && (
                    <p className="mt-1 text-[10px] font-bold text-[#B97882]">
                      {getSelectedOptionLabels(item.productOptions, item.selectedOptions)
                        .map((option) => `${option.name}: ${option.label}`)
                        .join(' • ')}
                    </p>
                  )}
                  {item.itemType === 'print' && <p className="mt-1 text-[10px] font-bold text-[#B97882]">{formatPrintOptionSummary(item.selectedOptions)}</p>}
                  <p className="text-xs text-[#171717]/50 mt-1">الكمية: {item.quantity}</p>
                </div>
                <div className="text-left shrink-0">
                  <p className="font-black text-[#C6A56B]">{formatCurrency(item.price * item.quantity)}</p>
                  <p className="text-[10px] text-[#171717]/40">{formatCurrency(item.price)} للقطعة</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="bg-white rounded-[2rem] border border-[#E8B4BC]/15 p-5 shadow-sm">
            <h2 className="font-black text-[#171717] mb-4 flex items-center gap-2">
              <ReceiptText size={18} className="text-[#E8B4BC]" /> ملخص الدفع
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
                <span className="text-[#171717]/55">طريقة الدفع</span>
                <span className="font-bold">{getStorePaymentMethod(order.paymentMethod)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#171717]/55">المنتجات قبل الخصم</span>
                <span className="font-bold">{formatCurrency(subtotalBeforeDiscount)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>{order.couponCode ? `كوبون ${order.couponCode}` : 'خصم'}</span>
                  <span className="font-bold">-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#171717]/55">المنتجات بعد الخصم</span>
                <span className="font-bold">{formatCurrency(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#171717]/55">الشحن</span>
                <span className="font-bold">{Number(order.deliveryFee || 0) > 0 ? formatCurrency(order.deliveryFee) : 'يحدد لاحقاً'}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>المدفوع نقداً</span>
                <span className="font-bold">{formatCurrency(order.amountPaid)}</span>
              </div>
              {Number(order.pointsUsedAmount || 0) > 0 && (
                <div className="flex justify-between text-[#B97882]">
                  <span>مدفوع بالنقاط ({Number(order.rewardPointsUsed || 0).toLocaleString()} نقطة)</span>
                  <span className="font-bold">{formatCurrency(order.pointsUsedAmount)}</span>
                </div>
              )}
              {Number(order.pointsRestoredAmount || 0) > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>نقاط مستعادة ({Number(order.rewardPointsRestored || 0).toLocaleString()} نقطة)</span>
                  <span className="font-bold">+{formatCurrency(order.pointsRestoredAmount)}</span>
                </div>
              )}
              {Number(order.rewardPointsEarned || 0) > 0 && (
                <div className="flex justify-between text-[#9E7D35]">
                  <span>نقاط مكتسبة من الطلب</span>
                  <span className="font-bold">+{Number(order.rewardPointsEarned).toLocaleString()} نقطة</span>
                </div>
              )}
              {refunded > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>المسترد</span>
                  <span className="font-bold">{formatCurrency(refunded)}</span>
                </div>
              )}
              <div className="border-t border-[#E8B4BC]/15 pt-3 flex justify-between font-black text-base">
                <span>المتبقي</span>
                <span className={remaining > 0 ? 'text-red-500' : 'text-emerald-600'}>
                  {remaining > 0 ? formatCurrency(remaining) : 'لا يوجد'}
                </span>
              </div>
            </div>
            <RewardRedemptionForm
              order={order}
              rewards={rewards}
              onApply={onApplyRewardPoints}
              submitting={applyingRewardPoints}
            />
          </section>

          <section className="bg-white rounded-[2rem] border border-[#E8B4BC]/15 p-5 shadow-sm">
            <h2 className="font-black text-[#171717] mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-[#C6A56B]" /> التوصيل
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2 text-[#171717]/70">
                <CalendarDays size={16} className="mt-0.5 text-[#E8B4BC]" />
                <span>{formatDate(order.createdAt)}</span>
              </div>
              <div className="flex items-start gap-2 text-[#171717]/70">
                <MapPin size={16} className="mt-0.5 text-[#E8B4BC]" />
                <span>{[order.city, order.district, order.street].filter(Boolean).join(' - ') || 'لم يتم تسجيل عنوان مفصل'}</span>
              </div>
              {order.trackingNumber && (
                <div className="rounded-2xl bg-[#FAF9F7] p-3 border border-[#E8B4BC]/10">
                  <p className="text-[10px] font-bold text-[#171717]/45 mb-1">رقم التتبع</p>
                  {trackingUrl ? (
                    <a href={trackingUrl} target="_blank" rel="noreferrer" className="font-black text-[#C6A56B] underline" dir="ltr">
                      {order.trackingNumber}
                    </a>
                  ) : (
                    <span className="font-black text-[#C6A56B]" dir="ltr">{order.trackingNumber}</span>
                  )}
                  {order.courierName && <p className="text-xs text-[#171717]/50 mt-1">{order.courierName}</p>}
                </div>
              )}
            </div>
          </section>

          <ReturnRequestPanel order={order} onSubmitted={onReturnSubmitted} returnWindowDays={returnWindowDays} />

          <a
            href={`https://wa.me/966560301744?text=${encodeURIComponent(`مرحباً، أحتاج مساعدة بخصوص طلب المتجر #${order.shortId}`)}`}
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
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(() => getCustomerSession());
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [returnWindowDays, setReturnWindowDays] = useState(7);
  const [rewards, setRewards] = useState(null);
  const [friendshipCode, setFriendshipCode] = useState(null);
  const [applyingRewardPoints, setApplyingRewardPoints] = useState(false);
  const [orderFilter, setOrderFilter] = useState('all');

  const canLoadOrders = Boolean(customer?.sessionToken);

  const handleApplyRewardPoints = async (points) => {
    const session = getCustomerSession();
    if (!session?.sessionToken || !selectedOrder?.id) {
      toast.error('سجلي الدخول مرة أخرى لتحديث النقاط');
      return;
    }
    setApplyingRewardPoints(true);
    const toastId = toast.loading('جاري تحديث نقاط الطلب...');
    try {
      const { error: functionError } = await supabase.functions.invoke('customer-orders', {
        body: {
          action: 'apply_reward_points',
          sessionToken: session.sessionToken,
          orderId: selectedOrder.id,
          points,
        },
      });
      if (functionError) throw new Error(await getFunctionError(functionError));
      toast.success(points > 0 ? 'تم تطبيق النقاط على الطلب' : 'تم إلغاء النقاط من الطلب', { id: toastId });
      await loadOrders();
    } catch (err) {
      console.error(err);
      const message = String(err?.message || '');
      const friendly = message.includes('reward_minimum_redemption_not_met')
        ? 'لم تصل إلى الحد الأدنى للاستبدال.'
        : message.includes('reward_redemption_limit_exceeded') || message.includes('reward_redemption_exceeds_unpaid_products')
          ? 'عدد النقاط يتجاوز الحد المسموح لهذا الطلب.'
          : message.includes('reward_points_balance_insufficient') || message.includes('reward_points_lots_insufficient')
            ? 'رصيد النقاط المتاح غير كافٍ.'
            : message.includes('reward_redemption_order_locked')
              ? 'لا يمكن تعديل النقاط بعد إغلاق الدفع أو الطلب.'
              : 'تعذر تحديث النقاط حالياً.';
      toast.error(friendly, { id: toastId });
    } finally {
      setApplyingRewardPoints(false);
    }
  };

  const handleReorder = async (order) => {
    const productIds = [...new Set((order.items || []).map(item => item.productId).filter(Boolean))];
    if (productIds.length === 0) {
      toast.error('لا توجد منتجات قابلة لإعادة الطلب');
      return;
    }

    const toastId = toast.loading('جاري تجهيز السلة...');
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, price, image, stock_quantity, in_stock, product_options')
        .in('id', productIds);
      if (error) throw error;

      const productsById = new Map((data || []).map(product => [String(product.id), product]));
      const savedCart = JSON.parse(localStorage.getItem('art_moment_cart')) || [];
      const nextCart = [...savedCart];
      let addedCount = 0;
      let skippedCount = 0;

      (order.items || []).forEach(item => {
        const product = productsById.get(String(item.productId));
        const stockQuantity = normalizeStockQuantity(product?.stock_quantity);
        const inStock = product && product.in_stock !== false && (stockQuantity === null || stockQuantity > 0);

        if (!inStock) {
          skippedCount += 1;
          return;
        }

        const cartProduct = {
          id: product.id,
          name: product.name,
          description: product.description || '',
          price: Number(product.price || item.price || 0),
          image: product.image || item.image || null,
          qty: Number(item.quantity || 1),
          stockQuantity,
          inStock: true,
          productOptions: product.product_options || item.productOptions || [],
          selectedOptions: item.selectedOptions || {},
          selectedOptionLabels: getSelectedOptionLabels(item.productOptions, item.selectedOptions),
        };
        cartProduct.cartKey = getCartLineKey(product.id, cartProduct.selectedOptions);
        const safeQty = clampCartQuantity(cartProduct, item.quantity || 1);
        const existing = nextCart.find(cartItem => (
          String(cartItem.cartKey || getCartLineKey(cartItem.id, cartItem.selectedOptions)) === cartProduct.cartKey
        ));

        if (existing) {
          const hydrated = {
            ...existing,
            stockQuantity,
            inStock: true,
          };
          existing.qty = clampCartQuantity(hydrated, Number(existing.qty || 0) + safeQty);
          existing.price = cartProduct.price;
          existing.name = cartProduct.name;
          existing.image = cartProduct.image;
          existing.stockQuantity = stockQuantity;
          existing.inStock = true;
        } else {
          nextCart.push({ ...cartProduct, qty: safeQty });
        }
        addedCount += 1;
      });

      if (addedCount === 0) {
        toast.error('كل منتجات هذا الطلب غير متوفرة حالياً', { id: toastId });
        return;
      }

      localStorage.setItem('art_moment_cart', JSON.stringify(nextCart));
      toast.success(
        skippedCount > 0
          ? `تمت إضافة المنتجات المتوفرة وتجاوز ${skippedCount} غير متوفر`
          : 'تمت إضافة الطلب إلى السلة',
        { id: toastId },
      );
      navigate('/store/cart');
    } catch (err) {
      console.error(err);
      toast.error('تعذر إعادة الطلب حالياً', { id: toastId });
    }
  };

  const handleDownloadReceipt = async (order) => {
    const toastId = toast.loading('جاري تجهيز ملف PDF...');
    try {
      await downloadReceipt(order);
      toast.success('تم تحميل الإيصال', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('تعذر إنشاء ملف PDF حالياً', { id: toastId });
    }
  };

  const loadOrders = useCallback(async () => {
    const session = getCustomerSession();
    setCustomer(session);

    if (!session?.sessionToken) {
      setOrders([]);
      setSelectedOrder(null);
      setRewards(null);
      setFriendshipCode(null);
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
      setRewards(data?.rewards || null);
      setFriendshipCode(data?.friendshipCode || null);
      setReturnWindowDays(Number(data?.operationRules?.returnWindowDays || 7));
      if (orderId && !data?.order) setError('لم يتم العثور على هذا الطلب ضمن حسابك.');
    } catch (err) {
      console.error(err);
      setError(err.message === 'unauthorized'
        ? 'انتهت جلسة الدخول. سجل الدخول مرة أخرى لعرض طلباتك.'
        : 'تعذر تحميل طلباتك حالاً. حاول مرة أخرى.');
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
  const filteredOrders = useMemo(() => {
    if (orderFilter === 'current') {
      return orders.filter((order) => !['delivered', 'cancelled', 'returned'].includes(order.status));
    }
    if (orderFilter === 'completed') {
      return orders.filter((order) => ['delivered', 'cancelled', 'returned'].includes(order.status));
    }
    return orders;
  }, [orderFilter, orders]);

  return (
    <div className="art-page min-h-screen font-[Tajawal] text-[#171717] pb-20" dir="rtl">
      <SeoHead
        title={orderId ? "تفاصيل الطلب | لحظة فن" : "طلباتي | لحظة فن"}
        description="مساحة العميل الخاصة لعرض الطلبات وتفاصيل المنتجات والدفع والتوصيل بأمان."
        path={orderId ? "/store/orders/" + orderId : "/store/orders"}
        noindex
        nofollow
      />
      <header className="art-nav art-nav-scrolled sticky top-0 z-40">
        <div className="art-shell h-16 flex items-center justify-between">
          <Link to="/store" className="inline-flex items-center gap-2 text-sm font-black text-[#171717]/65 hover:text-[#E8B4BC]">
            <ArrowRight size={18} /> المتجر
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Art Moment" className="w-9 h-9 object-contain" />
            <span className="font-black">لحظة فن</span>
          </Link>
          <Link to="/" className="w-10 h-10 rounded-full bg-white border border-[#E8B4BC]/15 flex items-center justify-center text-[#171717]/70 hover:text-[#E8B4BC]">
            <Home size={18} />
          </Link>
        </div>
      </header>

      <main className="art-shell py-8 sm:py-10">
        <div className="mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <p className="text-xs font-black text-[#C6A56B] mb-2">حساب العميل</p>
            <h1 className="text-3xl sm:text-4xl font-black text-[#171717] mb-2">طلباتي</h1>
            <p className="text-[#171717]/60 text-sm max-w-2xl">
              كل طلبات المتجر المرتبطة بحسابك، مع تفاصيل المنتجات والدفع والتوصيل في مكان واحد.
            </p>
          </div>

          {canLoadOrders && (
            <button
              type="button"
              onClick={loadOrders}
              disabled={loading}
              className="w-fit px-4 py-2.5 rounded-full bg-white border border-[#E8B4BC]/20 text-sm font-black text-[#171717] hover:bg-[#FAF9F7] flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> تحديث
            </button>
          )}
        </div>

        {!canLoadOrders ? (
          <section className="bg-white rounded-[2rem] border border-[#E8B4BC]/15 shadow-sm p-8 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-[#E8B4BC]/10 text-[#E8B4BC] flex items-center justify-center mx-auto mb-4">
              <LogIn size={30} />
            </div>
            <h2 className="font-black text-2xl mb-2">سجلي الدخول لعرض طلباتك</h2>
            <p className="text-sm text-[#171717]/60 leading-relaxed mb-6">
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
          <div className="min-h-[45vh] flex flex-col items-center justify-center text-[#171717]/55">
            <Loader2 size={34} className="animate-spin text-[#E8B4BC] mb-4" />
            <p className="font-bold">جاري تحميل طلباتك...</p>
          </div>
        ) : error ? (
          <section className="bg-white rounded-[2rem] border border-red-100 shadow-sm p-8 text-center max-w-xl mx-auto">
            <AlertCircle size={38} className="mx-auto mb-4 text-red-500" />
            <h2 className="font-black text-xl mb-2">تعذر عرض الطلبات</h2>
            <p className="text-sm text-[#171717]/60 mb-5">{error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={loadOrders} className="px-5 py-2.5 rounded-xl bg-[#171717] text-white font-bold">إعادة المحاولة</button>
              <button onClick={() => setIsAuthModalOpen(true)} className="px-5 py-2.5 rounded-xl bg-[#FAF9F7] text-[#171717] font-bold border border-[#E8B4BC]/20">تسجيل الدخول</button>
            </div>
          </section>
        ) : orderId ? (
          selectedOrder ? (
            <OrderDetails
              order={selectedOrder}
              rewards={rewards}
              onReturnSubmitted={loadOrders}
              onReorder={handleReorder}
              onDownloadReceipt={handleDownloadReceipt}
              onApplyRewardPoints={handleApplyRewardPoints}
              applyingRewardPoints={applyingRewardPoints}
              returnWindowDays={returnWindowDays}
            />
          ) : null
        ) : (
          <div className="space-y-6">
            {friendshipCode && (
              <section className="flex flex-col gap-4 rounded-3xl border border-[#C6A56B]/25 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#C6A56B]/12 text-[#C6A56B]">
                    <Gift size={21} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#C6A56B]">برنامج كود الصداقة</p>
                    <h2 className="mt-1 text-lg font-black text-[#171717]">
                      كودك: <span className="tracking-widest" dir="ltr">{friendshipCode}</span>
                    </h2>
                    <p className="mt-1 text-xs leading-6 text-[#171717]/55">
                      شاركي الكود مع صديقاتك. تحصل صديقتك على خصم 5% بكوبون WELCOME، وتحصلين على 200 نقطة عند أول طلب لها.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(String(friendshipCode));
                        toast.success('تم نسخ كود الصداقة');
                      } catch {
                        toast.error('تعذر نسخ الكود تلقائياً');
                      }
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#C6A56B]/25 bg-[#FAF9F7] px-4 py-2.5 text-xs font-black text-[#171717] sm:flex-none"
                  >
                    <Copy size={15} /> نسخ
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`استخدمي كود الصداقة ${friendshipCode} عند طلبك من لحظة فن، وكوبون WELCOME للحصول على خصم 5%.\nhttps://art-moment.com`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-xs font-black text-white sm:flex-none"
                  >
                    <MessageCircle size={15} /> مشاركة
                  </a>
                </div>
              </section>
            )}

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-3xl border border-[#E8B4BC]/15 p-5 shadow-sm">
                <span className="text-xs font-bold text-[#171717]/45">عدد الطلبات</span>
                <p className="text-3xl font-black mt-2">{orders.length}</p>
              </div>
              <div className="bg-white rounded-3xl border border-[#E8B4BC]/15 p-5 shadow-sm">
                <span className="text-xs font-bold text-[#171717]/45">طلبات نشطة</span>
                <p className="text-3xl font-black mt-2 text-[#C6A56B]">{stats.active}</p>
              </div>
              <div className="bg-white rounded-3xl border border-[#E8B4BC]/15 p-5 shadow-sm">
                <span className="text-xs font-bold text-[#171717]/45">إجمالي مشتريات المتجر</span>
                <p className="text-2xl font-black mt-2 text-[#E8B4BC]">{formatCurrency(stats.total)}</p>
              </div>
            </div>

            <RewardPointsSummary rewards={rewards} />

            {orders.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border border-[#E8B4BC]/15 bg-white p-2 shadow-sm" aria-label="تصفية الطلبات">
                {[
                  ['all', 'الكل', orders.length],
                  ['current', 'الحالية', stats.active],
                  ['completed', 'المكتملة', orders.length - stats.active],
                ].map(([value, label, count]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setOrderFilter(value)}
                    className={'min-h-11 px-4 py-2 text-sm font-black transition-colors ' + (
                      orderFilter === value
                        ? 'bg-[#171717] text-white'
                        : 'bg-[#FAF9F7] text-[#171717]/65 hover:text-[#171717]'
                    )}
                  >
                    {label} <span className="ms-1 text-xs opacity-65">{count}</span>
                  </button>
                ))}
              </div>
            )}

            {orders.length === 0 ? (
              <section className="bg-white rounded-[2rem] border border-[#E8B4BC]/15 shadow-sm p-8 text-center">
                <ShoppingBag size={42} className="mx-auto mb-4 text-[#E8B4BC]/45" />
                <h2 className="font-black text-2xl mb-2">لا توجد طلبات متجر بعد</h2>
                <p className="text-sm text-[#171717]/55 mb-6">ابدأ من المتجر، وستظهر طلباتك هنا تلقائياً بعد تأكيدها.</p>
                <Link to="/store" className="art-cta px-8 py-3 rounded-2xl font-black inline-flex items-center gap-2">
                  <ShoppingBag size={18} /> تصفح المتجر
                </Link>
              </section>
            ) : filteredOrders.length === 0 ? (
              <section className="bg-white rounded-[2rem] border border-[#E8B4BC]/15 shadow-sm p-8 text-center">
                <ShoppingBag size={42} className="mx-auto mb-4 text-[#E8B4BC]/45" />
                <h2 className="font-black text-xl mb-2">لا توجد طلبات ضمن هذه الفئة</h2>
                <p className="text-sm text-[#171717]/55">اختَر تصنيفًا آخر لعرض بقية طلباتك.</p>
              </section>
            ) : (
              <div className="grid xl:grid-cols-2 gap-5">
                {filteredOrders.map((order) => <OrderCard key={order.id} order={order} />)}
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
