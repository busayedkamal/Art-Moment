// src/storage/orderStorage.js
// V1 (LocalStorage فقط) — بدون أي API

const STORAGE_KEY = 'art-moment-orders';
const ID_COUNTER_KEY = 'art-moment-order-id-counter';
const CHANGE_EVENT = 'art-moment-orders-changed';

// قراءة آمنة من LocalStorage
function safeParse(json, fallback) {
  try {
    const data = JSON.parse(json);
    return Array.isArray(data) ? data : fallback;
  } catch {
    return fallback;
  }
}

function emitChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// تحميل جميع الطلبات
export function loadOrders() {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return safeParse(raw, []);
}

// حفظ جميع الطلبات
export function saveOrders(orders) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders ?? []));
  emitChange();
}

// إنشاء رقم طلب جديد
export function generateOrderId() {
  if (typeof window === 'undefined') return `ORD-${Date.now()}`;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const raw = window.localStorage.getItem(ID_COUNTER_KEY);
  let state = null;

  try {
    state = raw ? JSON.parse(raw) : null;
  } catch {
    state = null;
  }

  if (!state || state.date !== today) state = { date: today, counter: 1 };
  else state.counter += 1;

  window.localStorage.setItem(ID_COUNTER_KEY, JSON.stringify(state));

  const counterStr = String(state.counter).padStart(3, '0');
  return `${today.replace(/-/g, '')}-${counterStr}`; // مثال: 20241205-001
}

// إضافة طلب جديد
export function addOrder(order) {
  const orders = loadOrders();
  orders.push(order);
  saveOrders(orders);
  return order;
}

// تحديث طلب موجود
export function updateOrder(updated) {
  const orders = loadOrders();
  const idx = orders.findIndex((o) => String(o.id) === String(updated.id));
  if (idx === -1) orders.push(updated);
  else orders[idx] = updated;
  saveOrders(orders);
  return updated;
}

// جلب طلب برقم معيّن
export function getOrderById(id) {
  const orders = loadOrders();
  return orders.find((o) => String(o.id) === String(id)) || null;
}

// حذف طلب
export function deleteOrder(id) {
  const orders = loadOrders();
  const filtered = orders.filter((o) => String(o.id) !== String(id));
  saveOrders(filtered);
  return filtered.length !== orders.length;
}

// مسح جميع الطلبات
export function clearAllOrders() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(ID_COUNTER_KEY);
  emitChange();
}

// نسخ احتياطي
export function exportOrdersForBackup() {
  return loadOrders();
}

export function importOrdersFromBackup(ordersFromFile) {
  if (!Array.isArray(ordersFromFile)) {
    throw new Error('صيغة ملف النسخة الاحتياطية غير صحيحة (يجب أن يحتوي على مصفوفة طلبات).');
  }
  saveOrders(ordersFromFile);
}

// للاستماع للتغييرات داخل نفس التبويب
export function onOrdersChanged(handler) {
  if (typeof window === 'undefined') return () => {};
  const fn = () => handler?.();
  window.addEventListener(CHANGE_EVENT, fn);
  return () => window.removeEventListener(CHANGE_EVENT, fn);
}
