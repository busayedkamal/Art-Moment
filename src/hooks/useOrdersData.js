// src/hooks/useOrdersData.js
import { useCallback, useEffect, useState } from 'react';
import {
  loadOrders,
  addOrder,
  updateOrder,
  deleteOrder,
  getOrderById,
  generateOrderId,
} from '../storage/orderStorage.js';

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export default function useOrdersData(options = {}) {
  const { includeArchived = true } = options;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    try {
      setError('');
      const all = safeArray(loadOrders());
      // حالياً ما عندنا archived بشكل رسمي—نتركها للمرونة
      const filtered = includeArchived ? all : all.filter((o) => !o?.archived);
      setOrders(filtered);
    } catch (e) {
      setError(e?.message || 'حدث خطأ أثناء تحميل الطلبات');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(async (payload) => {
    try {
      setError('');
      const nowIso = new Date().toISOString();
      const id = payload?.id || generateOrderId();

      const order = {
        id,
        createdAt: payload?.createdAt || nowIso,
        updatedAt: nowIso,
        ...payload,
      };

      addOrder(order);

      // تحديث فوري للـ state من المصدر (LocalStorage)
      const next = safeArray(loadOrders());
      setOrders(includeArchived ? next : next.filter((o) => !o?.archived));

      return order;
    } catch (e) {
      setError(e?.message || 'فشل إنشاء الطلب');
      throw e;
    }
  }, [includeArchived]);

  const update = useCallback(async (payload) => {
    try {
      setError('');
      if (!payload?.id) throw new Error('لا يمكن تحديث طلب بدون رقم (id).');

      const nowIso = new Date().toISOString();
      const existing = getOrderById(payload.id) || {};

      const merged = {
        ...existing,
        ...payload,
        updatedAt: nowIso,
      };

      updateOrder(merged);

      const next = safeArray(loadOrders());
      setOrders(includeArchived ? next : next.filter((o) => !o?.archived));

      return merged;
    } catch (e) {
      setError(e?.message || 'فشل حفظ التعديلات');
      throw e;
    }
  }, [includeArchived]);

  const remove = useCallback(async (id) => {
    try {
      setError('');
      if (!id) throw new Error('لا يمكن حذف طلب بدون رقم (id).');

      deleteOrder(id);

      const next = safeArray(loadOrders());
      setOrders(includeArchived ? next : next.filter((o) => !o?.archived));

      return true;
    } catch (e) {
      setError(e?.message || 'فشل حذف الطلب');
      throw e;
    }
  }, [includeArchived]);

  const getById = useCallback((id) => {
    return getOrderById(id);
  }, []);

  return {
    orders,
    loading,
    error,
    reload,
    create,
    update,
    remove,
    getById,
  };
}
