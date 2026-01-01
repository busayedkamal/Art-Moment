// src/hooks/useOrdersData.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadOrders,
  saveOrders,
  addOrder as addOrderToStorage,
  updateOrder as updateOrderInStorage,
  deleteOrder as deleteOrderFromStorage,
  getOrderById,
  generateOrderId,
} from '../storage/orderStorage';

// نفس المفتاح المستخدم داخل orderStorage.js
// (مهم لمزامنة التغييرات بين التبويبات)
const STORAGE_KEY = 'art-moment-orders';

function normalizePhone(phone) {
  return String(phone || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/^00/, '+')
    .replace(/[^\d+]/g, '');
}

function safeDateValue(v) {
  // يرجّع رقم قابل للمقارنة حتى لو كانت القيمة فاضية/غير صحيحة
  const t = new Date(v || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

export default function useOrdersData(options = {}) {
  const {
    autoLoad = true,
    sort = 'createdAt_desc', // createdAt_desc | createdAt_asc
  } = options;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(Boolean(autoLoad));
  const [error, setError] = useState('');

  const applySort = useCallback(
    (list) => {
      const arr = Array.isArray(list) ? [...list] : [];
      if (sort === 'createdAt_asc') {
        arr.sort((a, b) => safeDateValue(a?.createdAt) - safeDateValue(b?.createdAt));
      } else {
        arr.sort((a, b) => safeDateValue(b?.createdAt) - safeDateValue(a?.createdAt));
      }
      return arr;
    },
    [sort]
  );

  const refresh = useCallback(() => {
    try {
      setError('');
      setLoading(true);
      const list = loadOrders();
      setOrders(applySort(list));
    } catch (e) {
      setError(e?.message || 'حدث خطأ أثناء تحميل الطلبات');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [applySort]);

  useEffect(() => {
    if (autoLoad) refresh();
  }, [autoLoad, refresh]);

  // مزامنة تلقائية بين التبويبات/النوافذ عند تغيّر LocalStorage
  useEffect(() => {
    function onStorage(ev) {
      if (ev.key === STORAGE_KEY) {
        try {
          const list = loadOrders();
          setOrders(applySort(list));
        } catch {
          // تجاهل
        }
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [applySort]);

  // إنشاء طلب جديد (Sync، ويمكن استخدام await عليه بدون مشكلة)
  const create = useCallback(
    (orderInput = {}) => {
      setError('');
      const nowIso = new Date().toISOString();

      const id = orderInput.id || generateOrderId();
      const createdAt =
        orderInput.createdAt && String(orderInput.createdAt).trim()
          ? new Date(orderInput.createdAt).toISOString()
          : nowIso;

      const newOrder = {
        ...orderInput,
        id,
        phone: normalizePhone(orderInput.phone),
        createdAt,
        updatedAt: nowIso,
      };

      // حفظ في التخزين
      addOrderToStorage(newOrder);

      // تحديث الواجهة فورًا
      setOrders((prev) => applySort([newOrder, ...prev]));
      return newOrder;
    },
    [applySort]
  );

  // تعديل طلب
  const update = useCallback(
    (updatedOrder = {}) => {
      setError('');
      if (!updatedOrder?.id) {
        throw new Error('لا يمكن تحديث طلب بدون رقم طلب (id).');
      }

      const existing = getOrderById(updatedOrder.id);
      if (!existing) {
        throw new Error('الطلب غير موجود في البيانات المحلية.');
      }

      const nowIso = new Date().toISOString();

      const merged = {
        ...existing,
        ...updatedOrder,
        phone: normalizePhone(updatedOrder.phone ?? existing.phone),
        // اسمح بتعديل createdAt إذا جاي من الصفحة
        createdAt: updatedOrder.createdAt
          ? new Date(updatedOrder.createdAt).toISOString()
          : existing.createdAt,
        updatedAt: nowIso,
      };

      updateOrderInStorage(merged);

      setOrders((prev) => {
        const next = prev.map((o) => (o.id === merged.id ? merged : o));
        return applySort(next);
      });

      return merged;
    },
    [applySort]
  );

  // حذف طلب
  const remove = useCallback(
    (id) => {
      setError('');
      if (!id) throw new Error('رقم الطلب مطلوب للحذف.');
      const ok = deleteOrderFromStorage(id);

      if (ok) {
        setOrders((prev) => prev.filter((o) => o.id !== id));
      }
      return ok;
    },
    []
  );

  const byId = useCallback((id) => getOrderById(id), []);

  // مفيد لصفحات التقارير/العملاء
  const stats = useMemo(() => {
    const total = orders.length;
    const paid = orders.filter((o) => String(o.paymentStatus || '').includes('مدفوع')).length;
    const delivered = orders.filter((o) => String(o.status || '').includes('تم التسليم')).length;
    return { total, paid, delivered };
  }, [orders]);

  return {
    orders,
    loading,
    error,
    refresh,

    // API محلي
    create,
    update,
    remove,
    byId,
    stats,

    // مفيد لو في صفحة تبغى setOrders مباشرة (اختياري)
    setOrders,

    // للرجوع للنسخة V1 بالكامل: تأكيد أنه لا يوجد fetch ولا API هنا
  };
}
