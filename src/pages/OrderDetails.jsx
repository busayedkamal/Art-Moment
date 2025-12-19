// src/pages/OrderDetails.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useOrdersData from '../hooks/useOrdersData.js';
import { getOrderById } from '../storage/orderStorage.js';
import { loadSettings } from '../storage/settingsStorage.js';

function toDatetimeLocalValue(iso) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(v) {
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('ar-SA');
}

function openA5InvoicePrint(order, settings) {
  const companyName = settings?.companyName || 'Art Moment';
  const footer = settings?.invoiceFooter || 'شكراً لاختيارك لنا 🌟';

  const html = `
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>فاتورة ${order.id}</title>
<style>
  @page { size: A5; margin: 8mm; }
  body { font-family: Arial, sans-serif; color: #111; }
  .box { border: 1px solid #ddd; border-radius: 10px; padding: 12px; }
  h1 { font-size: 16px; margin: 0 0 8px; }
  .muted { color: #666; font-size: 12px; }
  .row { display: flex; justify-content: space-between; gap: 10px; }
  .row > div { flex: 1; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border-bottom: 1px dashed #ddd; padding: 6px 0; font-size: 12px; }
  .total { margin-top: 10px; font-weight: bold; }
  .footer { margin-top: 12px; font-size: 11px; color: #555; text-align: center; }
</style>
</head>
<body>
  <div class="box">
    <h1>${companyName} — فاتورة / إيصال</h1>
    <div class="muted">رقم الطلب: ${order.id}</div>
    <div class="muted">تاريخ الإنشاء: ${formatDateTime(order.createdAt)}</div>
    <div class="muted">تاريخ التسليم: ${order.deliveryDate || '-'}</div>

    <div style="height:8px"></div>
    <div class="row">
      <div>
        <div class="muted">العميل</div>
        <div>${order.customerName || '-'}</div>
      </div>
      <div>
        <div class="muted">الجوال</div>
        <div>${order.phone || '-'}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th align="right">البند</th>
          <th align="left">الكمية</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>صور 4x6</td><td align="left">${order.qty4x6 ?? 0}</td></tr>
        <tr><td>صور A4</td><td align="left">${order.qtyA4 ?? 0}</td></tr>
      </tbody>
    </table>

    <div class="total">الإجمالي: ${(Number(order.total)||0).toFixed(2)} ر.س</div>
    <div class="muted">العربون: ${(Number(order.deposit)||0).toFixed(2)} ر.س</div>
    <div class="muted">المتبقي: ${(Number(order.remaining)||0).toFixed(2)} ر.س</div>

    ${order.notes ? `<div style="margin-top:10px"><div class="muted">ملاحظات</div><div style="font-size:12px">${String(order.notes).replaceAll('<','&lt;')}</div></div>` : ''}

    <div class="footer">${footer}</div>
  </div>

<script>
  window.onload = () => {
    window.print();
    setTimeout(() => window.close(), 300);
  }
</script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return alert('المتصفح منع نافذة الطباعة. فعّل Popups ثم جرّب مرة ثانية.');
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export default function OrderDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const { update, remove } = useOrdersData();

  const settings = useMemo(() => loadSettings(), []);
  const [order, setOrder] = useState(null);

  // حقول قابلة للتعديل
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [createdAtLocal, setCreatedAtLocal] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [source, setSource] = useState('');

  const [qty4x6, setQty4x6] = useState(0);
  const [qtyA4, setQtyA4] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [notes, setNotes] = useState('');

  const price4x6 = Number(settings?.price4x6 ?? 0);
  const priceA4 = Number(settings?.priceA4 ?? 0);

  const total = useMemo(() => (Number(qty4x6) * price4x6) + (Number(qtyA4) * priceA4), [qty4x6, qtyA4, price4x6, priceA4]);
  const remaining = useMemo(() => Math.max(0, (Number(total) || 0) - (Number(deposit) || 0)), [total, deposit]);

  const paymentStatus = useMemo(() => {
    const t = Number(total) || 0;
    const d = Number(deposit) || 0;
    if (t <= 0) return 'unpaid';
    if (d <= 0) return 'unpaid';
    if (d >= t) return 'paid';
    return 'partial';
  }, [total, deposit]);

  useEffect(() => {
    const found = getOrderById(id);
    setOrder(found);

    if (found) {
      setCustomerName(found.customerName || '');
      setPhone(found.phone || '');
      setCreatedAtLocal(toDatetimeLocalValue(found.createdAt));
      setDeliveryDate(found.deliveryDate || '');
      setSource(found.source || '');

      setQty4x6(found.qty4x6 ?? 0);
      setQtyA4(found.qtyA4 ?? 0);
      setDeposit(found.deposit ?? 0);
      setNotes(found.notes || '');
    }
  }, [id]);

  if (!order) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">تفاصيل الطلب</h1>
        <p className="mt-3 text-red-600">لم يتم العثور على الطلب المطلوب في البيانات المحلية.</p>
        <button onClick={() => nav('/app/orders')} className="mt-4 rounded-xl border px-4 py-2 text-sm">
          الرجوع إلى صفحة الطلبات
        </button>
      </div>
    );
  }

  const onSave = () => {
    const next = {
      ...order,
      customerName: customerName.trim(),
      phone: phone.trim(),
      createdAt: datetimeLocalToIso(createdAtLocal), // ✅ قابل للتعديل
      deliveryDate,
      source: source.trim(),

      qty4x6: Number(qty4x6) || 0,
      qtyA4: Number(qtyA4) || 0,

      price4x6,
      priceA4,

      total: Number(total) || 0,
      deposit: Number(deposit) || 0,
      remaining,
      paymentStatus,

      notes: notes?.trim() || '',
    };

    const updated = update(next);
    setOrder(updated);
    alert('تم حفظ التعديلات.');
  };

  const onDelete = () => {
    if (!confirm('هل أنت متأكد من حذف الطلب؟')) return;
    remove(order.id);
    nav('/app/orders');
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">تفاصيل الطلب</h1>
        <div className="flex gap-2">
          <button onClick={() => nav('/app/orders')} className="rounded-xl border px-4 py-2 text-sm">الرجوع</button>
          <button onClick={() => openA5InvoicePrint({ ...order, customerName, phone, createdAt: datetimeLocalToIso(createdAtLocal), deliveryDate, qty4x6, qtyA4, total, deposit, remaining, notes }, settings)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">
            طباعة فاتورة A5
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-2xl border bg-white p-4 md:grid md:grid-cols-2 md:gap-3">
          <div>
            <div className="text-xs text-slate-500">رقم الطلب</div>
            <div className="text-lg font-semibold">{order.id}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">حالة الدفع</div>
            <div className="text-sm">{paymentStatus === 'paid' ? 'مدفوع' : paymentStatus === 'partial' ? 'مدفوع جزئياً' : 'غير مدفوع'}</div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">اسم العميل</label>
            <input className="w-full rounded-xl border px-3 py-2" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">رقم الجوال</label>
            <input className="w-full rounded-xl border px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">تاريخ/وقت إنشاء الطلب</label>
            <input type="datetime-local" className="w-full rounded-xl border px-3 py-2" value={createdAtLocal} onChange={(e) => setCreatedAtLocal(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">تاريخ التسليم</label>
            <input type="date" className="w-full rounded-xl border px-3 py-2" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-600">المصدر</label>
            <input className="w-full rounded-xl border px-3 py-2" value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 md:grid md:grid-cols-2 md:gap-3">
          <div>
            <label className="mb-1 block text-sm text-slate-600">عدد صور 4x6</label>
            <input type="number" min="0" className="w-full rounded-xl border px-3 py-2" value={qty4x6} onChange={(e) => setQty4x6(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">عدد صور A4</label>
            <input type="number" min="0" className="w-full rounded-xl border px-3 py-2" value={qtyA4} onChange={(e) => setQtyA4(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">الإجمالي (ر.س)</label>
            <input className="w-full rounded-xl border bg-slate-50 px-3 py-2" readOnly value={(Number(total)||0).toFixed(2)} />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">العربون (ر.س)</label>
            <input type="number" min="0" className="w-full rounded-xl border px-3 py-2" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            <div className="mt-1 text-xs text-slate-500">المتبقي: {remaining.toFixed(2)} ر.س</div>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-600">ملاحظات</label>
            <textarea className="min-h-[110px] w-full rounded-xl border px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onSave} className="rounded-xl bg-slate-900 px-5 py-2 text-sm text-white">حفظ</button>
          <button onClick={onDelete} className="rounded-xl border px-5 py-2 text-sm text-red-600">حذف الطلب</button>
        </div>
      </div>
    </div>
  );
}
