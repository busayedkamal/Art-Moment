import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ban, Banknote, CheckCircle2, Download, FileText, Landmark, Loader2, Plus, RotateCcw, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import RiyalSign from './RiyalSign';
import { createReceiptPdfBase64 } from '../utils/receiptPdf';
import { RECEIPT_STATUS_META, downloadReceipt, formatOrderReference, invokeReceipt, receiptOrderLabel } from '../utils/receiptApi';

export default function ReceiptsPanel({ customerId, customerName = '', customerPhone = '', compact = false, orderType = null, orderId = null }) {
  const defaultOrderValue = orderType && orderId ? `${orderType}:${orderId}` : '';
  const [context, setContext] = useState({ customer: null, printOrders: [], storeOrders: [], receipts: [] });
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const issueRequestIdRef = useRef(crypto.randomUUID());
  const [form, setForm] = useState({
    amount: '', paymentMethod: 'cash', bankName: '', transferReference: '',
    paymentDate: new Date().toISOString().slice(0, 10), orderValue: defaultOrderValue,
    description: 'دفعة مستلمة', notes: '',
  });

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const data = await invokeReceipt({ action: 'customer_context', customerId });
      setContext(data);
    } catch (error) {
      console.error(error);
      toast.error('تعذر تحميل إيصالات العميل');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const visibleReceipts = orderType && orderId
    ? context.receipts.filter((receipt) => (
      orderType === 'print' ? receipt.print_order_id === orderId : receipt.store_order_id === orderId
    ))
    : context.receipts;
  const issuedReceipts = visibleReceipts.filter((receipt) => receipt.status === 'issued');
  const issuedTotal = issuedReceipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
  const orderOptions = useMemo(() => [
    ...context.printOrders.map((order) => ({
      value: `print:${order.id}`,
      label: `طباعة ${formatOrderReference(order.id)} — ${Number(order.total_amount || 0).toFixed(2)} ر.س`,
    })),
    ...context.storeOrders.map((order) => ({
      value: `store:${order.id}`,
      label: `متجر ${formatOrderReference(order.short_id || order.id)} — ${(Number(order.total_amount || 0) + Number(order.delivery_fee || 0)).toFixed(2)} ر.س`,
    })),
  ], [context.printOrders, context.storeOrders]);

  const selectedOrder = orderOptions.find((option) => option.value === form.orderValue);
  const resolvedCustomer = context.customer || { id: customerId, name: customerName, phone: customerPhone };
  const linkedOrder = orderType === 'print'
    ? context.printOrders.find((order) => String(order.id) === String(orderId))
    : orderType === 'store'
      ? context.storeOrders.find((order) => String(order.id) === String(orderId))
      : null;
  const linkedOrderTotal = linkedOrder
    ? Number(linkedOrder.total_amount || 0) + (orderType === 'store' ? Number(linkedOrder.delivery_fee || 0) : 0)
    : 0;
  const linkedOrderRemaining = Math.max(linkedOrderTotal - issuedTotal, 0);

  const resetForm = () => setForm({
    amount: '', paymentMethod: 'cash', bankName: '', transferReference: '',
    paymentDate: new Date().toISOString().slice(0, 10), orderValue: defaultOrderValue,
    description: 'دفعة مستلمة', notes: '',
  });

  const handleIssue = async (sendWhatsApp) => {
    if (!Number(form.amount) || Number(form.amount) <= 0) return toast.error('أدخل مبلغًا صحيحًا');
    if (form.paymentMethod === 'bank_transfer' && !form.bankName.trim()) return toast.error('أدخل اسم البنك');
    setSubmitting(true);
    try {
      const [orderType, orderId] = form.orderValue ? form.orderValue.split(':') : [null, null];
      const { receipt } = await invokeReceipt({
        action: 'create', issueRequestId: issueRequestIdRef.current,
        customerId, amount: Number(form.amount), paymentMethod: form.paymentMethod,
        bankName: form.bankName, transferReference: form.transferReference, paymentDate: form.paymentDate,
        orderType, orderId, description: form.description, notes: form.notes,
      });
      if (receipt.status === 'issued') {
        toast.success('هذا الإيصال صادر بالفعل ولم يتم إنشاء نسخة مكررة');
        setIsModalOpen(false);
        issueRequestIdRef.current = crypto.randomUUID();
        resetForm();
        await load();
        return;
      }
      if (receipt.status !== 'draft') throw new Error('لا يمكن إعادة إصدار هذا الإيصال');
      const pdfBase64 = await createReceiptPdfBase64(
        { ...receipt, issued_at: new Date().toISOString() },
        resolvedCustomer,
        receiptOrderLabel(receipt),
      );
      const result = await invokeReceipt({ action: 'issue', receiptId: receipt.id, pdfBase64, sendWhatsApp });
      if (sendWhatsApp && result.whatsappError) {
        toast.error('صدر الإيصال، لكن تعذر إرساله عبر واتساب ويمكن إعادة المحاولة');
      } else {
        toast.success(sendWhatsApp ? 'تم إصدار الإيصال وإرساله' : 'تم إصدار الإيصال');
      }
      setIsModalOpen(false);
      issueRequestIdRef.current = crypto.randomUUID();
      resetForm();
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'تعذر إصدار الإيصال');
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (receipt) => {
    setBusyId(receipt.id);
    try { await downloadReceipt(receipt); }
    catch (error) { toast.error(error.message || 'تعذر تنزيل الإيصال'); }
    finally { setBusyId(null); }
  };

  const handleResend = async (receipt) => {
    setBusyId(receipt.id);
    try {
      await invokeReceipt({ action: 'resend', receiptId: receipt.id });
      toast.success('تم إرسال الإيصال عبر واتساب');
      await load();
    } catch (error) { toast.error(error.message || 'تعذر إرسال الإيصال'); }
    finally { setBusyId(null); }
  };

  const handleCancel = async (receipt) => {
    const reason = window.prompt(`سبب إلغاء الإيصال ${receipt.receipt_number}:`);
    if (!reason?.trim()) return;
    setBusyId(receipt.id);
    try {
      await invokeReceipt({ action: 'cancel', receiptId: receipt.id, reason });
      toast.success('تم إلغاء الإيصال مع الاحتفاظ بسجله');
      await load();
    } catch (error) { toast.error(error.message || 'تعذر إلغاء الإيصال'); }
    finally { setBusyId(null); }
  };

  if (!customerId) {
    return <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-700">يجب ربط هذا السجل بملف العميل الموحد قبل إنشاء إيصال.</div>;
  }

  return (
    <section className={`border border-[#E8B4BC]/20 bg-white ${compact ? 'p-3' : 'p-4'} rounded-lg`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8B4BC]/15 pb-3">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-black"><FileText size={17} className="text-[#C6A56B]" /> {orderId ? 'إيصالات الطلب' : 'إيصالات القبض'}</h4>
          <p className="mt-1 text-[11px] text-[#5F5A57]">{issuedReceipts.length} إيصال صادر · {issuedTotal.toFixed(2)} <RiyalSign size="0.8em" /></p>
        </div>
        <button type="button" onClick={() => setIsModalOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-xs font-black text-white">
          <Plus size={15} /> إنشاء إيصال قبض
        </button>
      </div>

      {orderId && linkedOrder && (
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-[#E8B4BC]/15 bg-[#FAF9F7] p-3 text-center">
          <div><span className="block text-[10px] text-[#5F5A57]">قيمة الطلب</span><strong className="mt-1 block text-sm">{linkedOrderTotal.toFixed(2)} <RiyalSign size="0.75em" /></strong></div>
          <div><span className="block text-[10px] text-[#5F5A57]">إجمالي المقبوض</span><strong className="mt-1 block text-sm text-emerald-700">{issuedTotal.toFixed(2)} <RiyalSign size="0.75em" /></strong></div>
          <div><span className="block text-[10px] text-[#5F5A57]">المتبقي</span><strong className="mt-1 block text-sm text-amber-700">{linkedOrderRemaining.toFixed(2)} <RiyalSign size="0.75em" /></strong></div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#C6A56B]" /></div>
      ) : visibleReceipts.length === 0 ? (
        <div className="py-7 text-center text-xs font-bold text-[#5F5A57]">لا توجد إيصالات لهذا العميل.</div>
      ) : (
        <div className="mt-3 space-y-2">
          {visibleReceipts.map((receipt) => {
            const meta = RECEIPT_STATUS_META[receipt.status] || RECEIPT_STATUS_META.draft;
            return (
              <div key={receipt.id} className="grid gap-3 rounded-lg border border-[#E8B4BC]/15 bg-[#FAF9F7] p-3 sm:grid-cols-[1.2fr_.8fr_.8fr_auto] sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><strong className="text-sm" dir="ltr">{receipt.receipt_number}</strong><span className={`rounded px-2 py-1 text-[10px] font-black ${meta.className}`}>{meta.label}</span></div>
                  <p className="mt-1 text-[11px] text-[#5F5A57]">{receiptOrderLabel(receipt)}</p>
                </div>
                <div><span className="block text-[10px] text-[#5F5A57]">المبلغ</span><strong>{Number(receipt.amount).toFixed(2)} <RiyalSign size="0.8em" /></strong></div>
                <div><span className="block text-[10px] text-[#5F5A57]">الاستلام</span><strong className="text-xs">{receipt.payment_method === 'bank_transfer' ? 'تحويل مصرفي' : 'نقدًا'}</strong><span className="mt-1 block text-[10px] text-[#5F5A57]">واتساب: {receipt.whatsapp_status === 'sent' ? 'تم الإرسال' : receipt.whatsapp_status === 'failed' ? 'تعذر الإرسال' : 'لم يرسل'}</span></div>
                <div className="flex flex-wrap gap-1.5">
                  {receipt.status !== 'draft' && <button title="تنزيل PDF" onClick={() => handleDownload(receipt)} disabled={busyId === receipt.id} className="grid size-10 place-items-center rounded-lg border bg-white"><Download size={15} /></button>}
                  {receipt.status === 'issued' && <button title="إرسال واتساب" onClick={() => handleResend(receipt)} disabled={busyId === receipt.id} className="grid size-10 place-items-center rounded-lg border bg-white text-emerald-600">{busyId === receipt.id ? <Loader2 size={15} className="animate-spin" /> : receipt.whatsapp_status === 'failed' ? <RotateCcw size={15} /> : <Send size={15} />}</button>}
                  {receipt.status === 'issued' && <button title="إلغاء الإيصال" onClick={() => handleCancel(receipt)} disabled={busyId === receipt.id} className="grid size-10 place-items-center rounded-lg border border-red-100 bg-red-50 text-red-600"><Ban size={15} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-3" onMouseDown={(event) => event.target === event.currentTarget && !submitting && setIsModalOpen(false)}>
          <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl" dir="rtl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
              <div><h3 className="text-lg font-black">إنشاء إيصال قبض</h3><p className="text-xs text-[#5F5A57]">{resolvedCustomer.name} · {resolvedCustomer.phone}</p></div>
              <button onClick={() => !submitting && setIsModalOpen(false)} className="grid size-10 place-items-center rounded-lg border"><X size={18} /></button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-black">المبلغ المستلم
                  <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-2 h-12 w-full rounded-lg border px-3 text-base outline-none focus:border-[#C6A56B]" placeholder="350.00" />
                </label>
                <label className="text-xs font-black">تاريخ الاستلام
                  <input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} className="mt-2 h-12 w-full rounded-lg border px-3 outline-none focus:border-[#C6A56B]" />
                </label>
              </div>
              <div>
                <span className="text-xs font-black">طريقة الاستلام</span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button onClick={() => setForm({ ...form, paymentMethod: 'cash', bankName: '', transferReference: '' })} className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border text-sm font-black ${form.paymentMethod === 'cash' ? 'border-[#171717] bg-[#171717] text-white' : 'bg-white'}`}><Banknote size={18} /> نقدًا</button>
                  <button onClick={() => setForm({ ...form, paymentMethod: 'bank_transfer' })} className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border text-sm font-black ${form.paymentMethod === 'bank_transfer' ? 'border-[#171717] bg-[#171717] text-white' : 'bg-white'}`}><Landmark size={18} /> تحويل مصرفي</button>
                </div>
              </div>
              {form.paymentMethod === 'bank_transfer' && <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-black">البنك المحول إليه<input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className="mt-2 h-12 w-full rounded-lg border px-3 outline-none focus:border-[#C6A56B]" /></label><label className="text-xs font-black">مرجع التحويل <span className="font-normal text-[#5F5A57]">(اختياري)</span><input value={form.transferReference} onChange={(e) => setForm({ ...form, transferReference: e.target.value })} className="mt-2 h-12 w-full rounded-lg border px-3 outline-none focus:border-[#C6A56B]" dir="ltr" /></label></div>}
              <label className="block text-xs font-black">ربط الإيصال بطلب <span className="font-normal text-[#5F5A57]">(اختياري)</span><select value={form.orderValue} onChange={(e) => setForm({ ...form, orderValue: e.target.value })} className="mt-2 h-12 w-full rounded-lg border bg-white px-3 outline-none focus:border-[#C6A56B]"><option value="">بدون ربط بطلب</option>{orderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className="block text-xs font-black">البيان<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-2 h-20 w-full resize-none rounded-lg border p-3 outline-none focus:border-[#C6A56B]" /></label>
              <label className="block text-xs font-black">ملاحظات داخلية <span className="font-normal text-[#5F5A57]">(لا تظهر في الإيصال)</span><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-2 h-16 w-full resize-none rounded-lg border p-3 outline-none focus:border-[#C6A56B]" /></label>
              <div className="rounded-lg border border-[#C6A56B]/35 bg-[#fffaf2] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black"><FileText size={17} className="text-[#C6A56B]" /> معاينة الإيصال</div>
                <div className="grid grid-cols-2 gap-3 text-xs"><div><span className="text-[#5F5A57]">العميل</span><strong className="mt-1 block">{resolvedCustomer.name}</strong></div><div><span className="text-[#5F5A57]">المبلغ</span><strong className="mt-1 block text-lg">{Number(form.amount || 0).toFixed(2)} ر.س</strong></div><div><span className="text-[#5F5A57]">الطريقة</span><strong className="mt-1 block">{form.paymentMethod === 'bank_transfer' ? 'تحويل مصرفي' : 'نقدًا'}</strong></div><div><span className="text-[#5F5A57]">الطلب</span><strong className="mt-1 block">{selectedOrder?.label || 'غير مرتبط'}</strong></div></div>
              </div>
            </div>
            <div className="sticky bottom-0 grid gap-2 border-t bg-white p-4 sm:grid-cols-2">
              <button disabled={submitting} onClick={() => handleIssue(false)} className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#171717] font-black disabled:opacity-50">{submitting ? <Loader2 className="animate-spin" size={17} /> : <CheckCircle2 size={17} />} إصدار الإيصال</button>
              <button disabled={submitting} onClick={() => handleIssue(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#171717] font-black text-white disabled:opacity-50">{submitting ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />} إصدار وإرسال عبر واتساب</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
