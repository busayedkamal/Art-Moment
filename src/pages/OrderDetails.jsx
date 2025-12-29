// src/pages/OrderDetails.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useOrdersData from '../hooks/useOrdersData.js';

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function OrderDetails() {
  const nav = useNavigate();
  const { id } = useParams();

  const { orders, update, remove } = useOrdersData({ includeArchived: true });

  const order = useMemo(() => (orders || []).find((o) => String(o.id) === String(id)) || null, [orders, id]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [createdAtLocal, setCreatedAtLocal] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [status, setStatus] = useState('new');
  const [paymentStatus, setPaymentStatus] = useState('unpaid');
  const [notes, setNotes] = useState('');
  const [deposit, setDeposit] = useState(0);

  useEffect(() => {
    if (!order) return;
    setCreatedAtLocal(toLocalInput(order.createdAt));
    setDeliveryDate(order.deliveryDate || '');
    setStatus(order.status || 'new');
    setPaymentStatus(order.paymentStatus || 'unpaid');
    setNotes(order.notes || '');
    setDeposit(Number(order.deposit || 0));
  }, [order]);

  async function onSave() {
    if (!order || saving) return;

    try {
      setSaving(true);
      setErr('');

      const createdAtIso = createdAtLocal ? new Date(createdAtLocal).toISOString() : (order.createdAt || new Date().toISOString());

      await update({
        ...order,
        createdAt: createdAtIso,
        deliveryDate,
        status,
        paymentStatus,
        notes,
        deposit: Number(deposit || 0),
      });
    } catch (e) {
      setErr(e?.message || 'فشل حفظ التعديلات');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!order) return;
    const ok = window.confirm('هل أنت متأكد من حذف الطلب؟');
    if (!ok) return;

    try {
      setErr('');
      await remove(order.id);
      nav('/app/orders');
    } catch (e) {
      setErr(e?.message || 'فشل حذف الطلب');
    }
  }

  if (!order) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">تفاصيل الطلب</h1>
        <p className="mt-2 text-sm text-rose-600">لم يتم العثور على الطلب المطلوب في البيانات المحلية.</p>
        <button type="button" onClick={() => nav('/app/orders')} className="mt-4 rounded-xl border px-4 py-2 text-sm">
          الرجوع إلى صفحة الطلبات
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">تفاصيل الطلب</h1>
          <p className="text-sm text-slate-500">رقم الطلب: <b>{order.id}</b></p>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={() => nav('/app/orders')} className="rounded-xl border px-4 py-2 text-sm">
            الرجوع
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700"
          >
            حذف الطلب
          </button>
        </div>
      </div>

      {err ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}

      <div className="grid gap-4 rounded-2xl border bg-white p-4 md:p-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-600">تاريخ إنشاء الطلب (قابل للتعديل)</label>
            <input
              type="datetime-local"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={createdAtLocal}
              onChange={(e) => setCreatedAtLocal(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">تاريخ التسليم</label>
            <input
              type="date"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">الحالة</label>
            <select className="w-full rounded-xl border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="new">جديد</option>
              <option value="in_progress">قيد الطباعة</option>
              <option value="ready">جاهز</option>
              <option value="delivered">تم التسليم</option>
              <option value="cancelled">ملغي</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">حالة الدفع</label>
            <select className="w-full rounded-xl border px-3 py-2 text-sm" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option value="unpaid">غير مدفوع</option>
              <option value="partial">مدفوع جزئياً</option>
              <option value="paid">مدفوع</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">العربون (ريال)</label>
            <input
              type="number"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              min={0}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">ملاحظات</label>
          <textarea
            className="min-h-[90px] w-full rounded-xl border px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
