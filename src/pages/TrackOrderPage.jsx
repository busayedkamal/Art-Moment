import React, { useMemo, useState } from 'react';
import { getOrderById } from '../storage/orderStorage.js';

function normalizePhone(v) {
  return String(v || '').replace(/[^\d]/g, '');
}

export default function TrackOrderPage() {
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const canSearch = useMemo(() => String(orderId).trim().length > 0 && normalizePhone(phone).length > 0, [orderId, phone]);

  function handleSearch(e) {
    e.preventDefault();
    setError('');
    setResult(null);

    const id = String(orderId || '').trim();
    const p = normalizePhone(phone);

    const order = getOrderById(id);
    if (!order) return setError('لم يتم العثور على طلب بهذا الرقم.');

    const orderPhone = normalizePhone(order.phone);
    if (!orderPhone || orderPhone !== p) {
      return setError('رقم الجوال لا يطابق بيانات الطلب.');
    }

    setResult(order);
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-2xl font-bold">تتبع الطلب</h1>
      <p className="mb-6 text-slate-600">أدخل رقم الطلب ورقم الجوال المسجل في الطلب.</p>

      <form onSubmit={handleSearch} className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-slate-600">رقم الطلب</label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="مثال: 20241205-001"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-600">رقم الجوال</label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05xxxxxxxx"
            />
          </div>
        </div>

        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}

        <div className="mt-4">
          <button
            disabled={!canSearch}
            className="rounded-xl bg-slate-900 px-6 py-3 text-white disabled:opacity-60"
            type="submit"
          >
            تتبع
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">رقم الطلب</div>
              <div className="text-lg font-bold">{result.id}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-500">الحالة</div>
              <div className="text-lg font-bold">{result.status || '—'}</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <div>
              <div className="text-slate-500">العميل</div>
              <div className="font-semibold">{result.customerName}</div>
            </div>
            <div className="text-right md:text-left">
              <div className="text-slate-500">تاريخ التسليم</div>
              <div className="font-semibold">{result.deliveryDate || '-'}</div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 p-3 text-sm">
            <div className="mb-2 font-semibold">ملخص</div>
            <div>صور 4x6: {Number(result.photos4x6 || 0)}</div>
            <div>صور A4: {Number(result.photosA4 || 0)}</div>
            <div className="mt-2 font-bold">الإجمالي: {Number(result.totalAmount || 0)} ر.س</div>
          </div>
        </div>
      )}
    </div>
  );
}
