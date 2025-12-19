// src/hooks/useOrdersData.js
// Hook موحّد لقراءة الطلبات من LocalStorage (V1)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadOrders, onOrdersChanged } from '../storage/orderStorage';

function sortNewestFirst(a, b) {
  const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
  return bTime - aTime;
}

export default function useOrdersData() {
  const [orders, setOrders] = useState(() => loadOrders());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      setError('');
      const next = loadOrders();
      next.sort(sortNewestFirst);
      setOrders(next);
    } catch (e) {
      setError(e?.message || 'حدث خطأ أثناء تحميل الطلبات.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // تغيّر داخل نفس التبويب
    const off = onOrdersChanged(refresh);

    // تغيّر من تبويب آخر (storage event)
    function onStorage(e) {
      if (!e) return;
      if (e.key === 'art-moment-orders') refresh();
    }
    window.addEventListener('storage', onStorage);

    return () => {
      off?.();
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  const stats = useMemo(() => {
    const list = orders || [];
    const total = list.length;

    const newCount = list.filter((o) => (o.status || '').includes('جديد')).length;
    const printingCount = list.filter((o) => (o.status || '').includes('الطباعة') || (o.status || '').includes('قيد')).length;
    const readyCount = list.filter((o) => (o.status || '').includes('جاهز')).length;
    const deliveredCount = list.filter((o) => (o.status || '').includes('تم التسليم') || (o.status || '').includes('مستلم')).length;

    return { total, newCount, printingCount, readyCount, deliveredCount };
  }, [orders]);

  return { orders, setOrders, loading, error, refresh, stats };
}
