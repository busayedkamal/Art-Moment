// src/pages/NewOrder.jsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useOrdersData from '../hooks/useOrdersData.js';
import { loadSettings } from '../storage/settingsStorage.js';

function toDatetimeLocalValue(isoOrDate) {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function datetimeLocalToIso(v) {
  // v: "YYYY-MM-DDTHH:mm"
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export default function NewOrder() {
  const nav = useNavigate();
  const { create } = useOrdersData();

  const settings = useMemo(() => loadSettings(), []);
  const price4x6 = Number(settings?.price4x6 ?? 0);
  const priceA4 = Number(settings?.priceA4 ?? 0);

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [createdAtLocal, setCreatedAtLocal] = useState(toDatetimeLocalValue(new Date()));
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [srcInstagram, setSrcInstagram] = useState(false);
  const [srcWhatsapp, setSrcWhatsapp] = useState(false);
  const [srcSnap, setSrcSnap] = useState(false);
  const [srcTiktok, setSrcTiktok] = useState(false);
  const [srcOther, setSrcOther] = useState('');
  const [srcDirect, setSrcDirect] = useState(false);

  const [qty4x6, setQty4x6] = useState(0);
  const [qtyA4, setQtyA4] = useState(0);

  const [deposit, setDeposit] = useState(0);
  const [notes, setNotes] = useState('');

  const total = useMemo(() => {
    const t = (Number(qty4x6) * price4x6) + (Number(qtyA4) * priceA4);
    return Number.isFinite(t) ? t : 0;
  }, [qty4x6, qtyA4, price4x6, priceA4]);

  const paymentStatus = useMemo(() => {
    const d = Number(deposit) || 0;
    if (total <= 0) return 'unpaid';
    if (d <= 0) return 'unpaid';
    if (d >= total) return 'paid';
    return 'partial';
  }, [deposit, total]);

  const sourceText = useMemo(() => {
    const parts = [];
    if (srcInstagram) parts.push('انستقرام');
    if (srcWhatsapp) parts.push('واتساب');
    if (srcSnap) parts.push('سناب');
    if (srcTiktok) parts.push('تيك توك');
    if (srcDirect) parts.push('مباشر');
    if (srcOther?.trim()) parts.push(srcOther.trim());
    return parts.join('، ') || 'غير محدد';
  }, [srcInstagram, srcWhatsapp, srcSnap, srcTiktok, srcDirect, srcOther]);

  const remaining = Math.max(0, total - (Number(deposit) || 0));

  const onSubmit = (e) => {
    e.preventDefault();

    if (!customerName.trim()) return alert('رجاءً أدخل اسم العميل.');
    if (!phone.trim()) return alert('رجاءً أدخل رقم الجوال.');

    const order = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      createdAt: datetimeLocalToIso(createdAtLocal), // ✅ قابل للتعديل
      deliveryDate,
      source: sourceText,

      qty4x6: Number(qty4x6) || 0,
      qtyA4: Number(qtyA4) || 0,

      price4x6,
      priceA4,

      total: Number(total) || 0,
      deposit: Number(deposit) || 0,
      remaining,

      status: 'new',
      paymentStatus,

      notes: notes?.trim() || '',
    };

    const created = create(order);
    nav(`/app/orders/${created.id}`);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">إضافة طلب جديد</h1>
        <button
          type="button"
          onClick={() => nav('/app/orders')}
          className="rounded-xl border px-4 py-2 text-sm"
        >
          الرجوع للطلبات
        </button>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-600">اسم العميل</label>
            <input
              className="w-full rounded-xl border px-3 py-2"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="مثال: أنور"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">رقم الجوال</label>
            <input
              className="w-full rounded-xl border px-3 py-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05xxxxxxxx"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">تاريخ/وقت إنشاء الطلب</label>
            <input
              type="datetime-local"
              className="w-full rounded-xl border px-3 py-2"
              value={createdAtLocal}
              onChange={(e) => setCreatedAtLocal(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">تاريخ التسليم المطلوب</label>
            <input
              type="date"
              className="w-full rounded-xl border px-3 py-2"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-600">مصدر الطلب (يمكن اختيار أكثر من واحد)</div>
          <div className="flex flex-wrap gap-2">
            {[
              ['انستقرام', srcInstagram, setSrcInstagram],
              ['واتساب', srcWhatsapp, setSrcWhatsapp],
              ['سناب', srcSnap, setSrcSnap],
              ['تيك توك', srcTiktok, setSrcTiktok],
              ['مباشر', srcDirect, setSrcDirect],
            ].map(([label, val, setVal]) => (
              <label key={label} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                <input type="checkbox" checked={val} onChange={(e) => setVal(e.target.checked)} />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">مصدر آخر (اختياري)</label>
            <input
              className="w-full rounded-xl border px-3 py-2"
              value={srcOther}
              onChange={(e) => setSrcOther(e.target.value)}
              placeholder="مثال: عميل قديم / صديق ..."
            />
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-600">عدد صور 4x6</label>
            <input
              type="number"
              min="0"
              className="w-full rounded-xl border px-3 py-2"
              value={qty4x6}
              onChange={(e) => setQty4x6(e.target.value)}
            />
            <div className="mt-1 text-xs text-slate-500">سعر الوحدة حسب الإعدادات: {price4x6} ر.س</div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">عدد صور A4</label>
            <input
              type="number"
              min="0"
              className="w-full rounded-xl border px-3 py-2"
              value={qtyA4}
              onChange={(e) => setQtyA4(e.target.value)}
            />
            <div className="mt-1 text-xs text-slate-500">سعر الوحدة حسب الإعدادات: {priceA4} ر.س</div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">المبلغ الإجمالي (ر.س)</label>
            <input
              className="w-full rounded-xl border bg-slate-50 px-3 py-2"
              value={total.toFixed(2)}
              readOnly
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">العربون / المبلغ المقدم (ر.س)</label>
            <input
              type="number"
              min="0"
              className="w-full rounded-xl border px-3 py-2"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
            <div className="mt-1 text-xs text-slate-500">المتبقي: {remaining.toFixed(2)} ر.س</div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <label className="mb-1 block text-sm text-slate-600">ملاحظات إضافية</label>
          <textarea
            className="min-h-[110px] w-full rounded-xl border px-3 py-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="أي تفاصيل تخص الطلب..."
          />
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded-xl bg-slate-900 px-5 py-2 text-sm text-white">
            حفظ الطلب
          </button>
          <button type="button" onClick={() => nav('/app/orders')} className="rounded-xl border px-5 py-2 text-sm">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
