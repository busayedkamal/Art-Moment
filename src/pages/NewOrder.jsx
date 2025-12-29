// src/pages/NewOrder.jsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useOrdersData from '../hooks/useOrdersData.js';

function nowLocalInput() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function NewOrder() {
  const nav = useNavigate();
  const { create } = useOrdersData({ includeArchived: true });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    deliveryDate: new Date().toISOString().slice(0, 10),
    createdAtLocal: nowLocalInput(),
    source: ['واتساب'],
    sourceOther: '',
    a4Qty: 0,
    photo4x6Qty: 0,
    subtotal: 0,
    deliveryFee: 0,
    total: 0,
    deposit: 0,
    notes: '',
    status: 'new',
    paymentStatus: 'unpaid',
  });

  const calc = useMemo(() => {
    const a4 = Number(form.a4Qty || 0);
    const p46 = Number(form.photo4x6Qty || 0);
    const subtotal = (a4 * 2) + (p46 * 1); // إذا عندك تسعيرة مختلفة عدّل هنا
    const deliveryFee = Number(form.deliveryFee || 0);
    const total = subtotal + deliveryFee;
    return { subtotal, total };
  }, [form.a4Qty, form.photo4x6Qty, form.deliveryFee]);

  function setField(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function toggleSource(v) {
    setForm((s) => {
      const arr = Array.isArray(s.source) ? [...s.source] : [];
      const exists = arr.includes(v);
      const next = exists ? arr.filter((x) => x !== v) : [...arr, v];
      return { ...s, source: next };
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      setErr('');

      const createdAtIso = form.createdAtLocal ? new Date(form.createdAtLocal).toISOString() : new Date().toISOString();

      const payload = {
        ...form,
        createdAt: createdAtIso,
        subtotal: calc.subtotal,
        total: calc.total,
        deposit: Number(form.deposit || 0),
        a4Qty: Number(form.a4Qty || 0),
        photo4x6Qty: Number(form.photo4x6Qty || 0),
        deliveryFee: Number(form.deliveryFee || 0),
      };

      delete payload.createdAtLocal;

      const created = await create(payload);
      nav(`/app/orders/${created.id}`);
    } catch (ex) {
      setErr(ex?.message || 'تعذر إنشاء الطلب');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إضافة طلب جديد</h1>
          <p className="text-sm text-slate-500">سجّل الطلب وسيتم حفظه محلياً على نفس الجهاز (LocalStorage).</p>
        </div>
        <button type="button" onClick={() => nav('/app/orders')} className="rounded-xl border px-4 py-2 text-sm">
          الرجوع للطلبات
        </button>
      </div>

      {err ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}

      <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border bg-white p-4 md:p-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-600">اسم العميل</label>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={form.customerName}
              onChange={(e) => setField('customerName', e.target.value)}
              placeholder="مثال: أنور"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">رقم الجوال</label>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="05xxxxxxxx"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">تاريخ التسليم المطلوب</label>
            <input
              type="date"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={form.deliveryDate}
              onChange={(e) => setField('deliveryDate', e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">تاريخ إنشاء الطلب (قابل للتعديل)</label>
            <input
              type="datetime-local"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={form.createdAtLocal}
              onChange={(e) => setField('createdAtLocal', e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-slate-600">مصدر الطلب (يمكن اختيار أكثر من واحد)</label>
            <div className="flex flex-wrap gap-2">
              {['واتساب', 'إنستقرام', 'سناب', 'مباشر'].map((s) => (
                <label key={s} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={(form.source || []).includes(s)}
                    onChange={() => toggleSource(s)}
                  />
                  {s}
                </label>
              ))}
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-sm text-slate-600">مصدر آخر (اختياري)</label>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={form.sourceOther}
                onChange={(e) => setField('sourceOther', e.target.value)}
                placeholder="مثال: عميل قديم، معرض..."
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-600">عدد صور A4</label>
              <input
                type="number"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={form.a4Qty}
                onChange={(e) => setField('a4Qty', e.target.value)}
                min={0}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">عدد صور 4×6</label>
              <input
                type="number"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={form.photo4x6Qty}
                onChange={(e) => setField('photo4x6Qty', e.target.value)}
                min={0}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-600">رسوم التوصيل (ريال)</label>
              <input
                type="number"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={form.deliveryFee}
                onChange={(e) => setField('deliveryFee', e.target.value)}
                min={0}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-600">العربون (ريال)</label>
              <input
                type="number"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={form.deposit}
                onChange={(e) => setField('deposit', e.target.value)}
                min={0}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-slate-50 p-3 text-sm">
            <div className="text-slate-500">المبلغ الفرعي</div>
            <div className="mt-1 text-lg font-bold">{calc.subtotal.toFixed(2)} ر.س</div>
          </div>

          <div className="rounded-xl border bg-slate-50 p-3 text-sm">
            <div className="text-slate-500">المبلغ الإجمالي</div>
            <div className="mt-1 text-lg font-bold">{calc.total.toFixed(2)} ر.س</div>
          </div>

          <div className="rounded-xl border bg-slate-50 p-3 text-sm">
            <div className="text-slate-500">المتبقي</div>
            <div className="mt-1 text-lg font-bold">{Math.max(0, calc.total - Number(form.deposit || 0)).toFixed(2)} ر.س</div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">ملاحظات إضافية</label>
          <textarea
            className="min-h-[90px] w-full rounded-xl border px-3 py-2 text-sm"
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="أي تفاصيل مهمة..."
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => nav('/app/orders')} className="rounded-xl border px-4 py-2 text-sm">
            إلغاء
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ الطلب'}
          </button>
        </div>
      </form>
    </div>
  );
}
