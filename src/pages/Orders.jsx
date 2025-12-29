// src/pages/Orders.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useOrdersData from '../hooks/useOrdersData.js';

function paymentLabel(v) {
  if (v === 'paid') return 'مدفوع';
  if (v === 'partial') return 'مدفوع جزئياً';
  return 'غير مدفوع';
}

export default function Orders() {
  const nav = useNavigate();
  const location = useLocation();

  const { orders, loading, error, reload } = useOrdersData({ includeArchived: true });

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [readyToday, setReadyToday] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  // ✅ قراءة فلتر العميل من Customers.jsx
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const customer = params.get('customer') || params.get('q') || '';
    if (customer) {
      setQ(customer);
    }
  }, [location.search]);

  const filtered = useMemo(() => {
    const query = String(q || '').trim().toLowerCase();

    return (orders || []).filter((o) => {
      const hay = [
        o?.id,
        o?.customerName,
        o?.phone,
        o?.status,
        o?.paymentStatus,
      ]
        .join(' ')
        .toLowerCase();

      if (query && !hay.includes(query)) return false;
      if (status !== 'all' && (o?.status || 'new') !== status) return false;
      if (paymentStatus !== 'all' && (o?.paymentStatus || 'unpaid') !== paymentStatus) return false;

      if (readyToday) {
        if ((o?.deliveryDate || '') !== today) return false;
      }

      return true;
    });
  }, [orders, q, status, paymentStatus, readyToday, today]);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">الطلبات</h1>
          <p className="text-sm text-slate-500">إدارة الطلبات الحالية والمتابعة حسب حالة الدفع والتجهيز.</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => nav('/app/orders/new')}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white"
          >
            + إضافة طلب جديد
          </button>
          <button
            type="button"
            onClick={reload}
            className="rounded-xl border px-4 py-2 text-sm"
          >
            تحديث
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-4">
        <input
          className="rounded-xl border px-3 py-2 text-sm md:col-span-2"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث باسم العميل / الجوال / رقم الطلب"
        />

        <select className="rounded-xl border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">كل الحالات</option>
          <option value="new">جديد</option>
          <option value="in_progress">قيد الطباعة</option>
          <option value="ready">جاهز</option>
          <option value="delivered">تم التسليم</option>
          <option value="cancelled">ملغي</option>
        </select>

        <select className="rounded-xl border px-3 py-2 text-sm" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
          <option value="all">كل حالات الدفع</option>
          <option value="unpaid">غير مدفوع</option>
          <option value="partial">مدفوع جزئياً</option>
          <option value="paid">مدفوع</option>
        </select>

        <label className="flex items-center gap-2 text-sm md:col-span-4">
          <input type="checkbox" checked={readyToday} onChange={(e) => setReadyToday(e.target.checked)} />
          جاهز للتسليم اليوم
        </label>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">جاري تحميل الطلبات...</div>
      ) : error ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-rose-600">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">لا توجد طلبات مطابقة للفلاتر الحالية.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <div className="border-b px-4 py-3 text-sm text-slate-600">
            إجمالي: <b>{filtered.length}</b> طلب
          </div>

          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-right">رقم الطلب</th>
                <th className="px-4 py-3 text-right">العميل</th>
                <th className="px-4 py-3 text-right">الجوال</th>
                <th className="px-4 py-3 text-right">الحالة</th>
                <th className="px-4 py-3 text-right">حالة الدفع</th>
                <th className="px-4 py-3 text-right">المبلغ</th>
                <th className="px-4 py-3 text-right">تاريخ الاستحقاق</th>
                <th className="px-4 py-3 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{o.id}</td>
                  <td className="px-4 py-3">{o.customerName || '-'}</td>
                  <td className="px-4 py-3">{o.phone || '-'}</td>
                  <td className="px-4 py-3">{o.status || 'new'}</td>
                  <td className="px-4 py-3">{paymentLabel(o.paymentStatus || 'unpaid')}</td>
                  <td className="px-4 py-3">{Number(o.total || 0).toFixed(2)} ر.س</td>
                  <td className="px-4 py-3">{o.deliveryDate || '-'}</td>
                  <td className="px-4 py-3">
                    <Link className="text-emerald-700 underline" to={`/app/orders/${o.id}`}>
                      تفاصيل
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
