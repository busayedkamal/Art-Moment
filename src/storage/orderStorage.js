// src/storage/orderStorage.js
// تخزين الطلبات في LocalStorage فقط بدون أي بيانات تجريبية تلقائية

const STORAGE_KEY = 'art-moment-orders';
const ID_COUNTER_KEY = 'art-moment-order-id-counter';

// قراءة آمنة من LocalStorage
function safeParse(json, fallback) {
  try {
    const data = JSON.parse(json);
    return Array.isArray(data) ? data : fallback;
  } catch {
    return fallback;
  }
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
}

// إنشاء رقم طلب جديد
export function generateOrderId() {
  if (typeof window === 'undefined') {
    // احتياط في بيئة بدون window (لن تحدث في المتصفح العادي)
    return `ORD-${Date.now()}`;
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const raw = window.localStorage.getItem(ID_COUNTER_KEY);
  let state = null;

  try {
    state = raw ? JSON.parse(raw) : null;
  } catch {
    state = null;
  }

  if (!state || state.date !== today) {
    state = { date: today, counter: 1 };
  } else {
    state.counter += 1;
  }

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
  const idx = orders.findIndex((o) => o.id === updated.id);
  if (idx === -1) {
    // لو ما حصلناه نضيفه كاحتياط (ما يفترض يحصل عادة)
    orders.push(updated);
  } else {
    orders[idx] = updated;
  }
  saveOrders(orders);
  return updated;
}

// جلب طلب برقم معيّن
export function getOrderById(id) {
  const orders = loadOrders();
  return orders.find((o) => o.id === id) || null;
}

// حذف طلب
export function deleteOrder(id) {
  const orders = loadOrders();
  const filtered = orders.filter((o) => o.id !== id);
  saveOrders(filtered);
  return filtered.length !== orders.length;
}

// مسح جميع الطلبات (يُستخدم مثلاً من زر Reset في الإعدادات إن أحببت مستقبلاً)
export function clearAllOrders() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(ID_COUNTER_KEY); // مسح عداد أرقام الطلبات
}


// دوال مساعدة للنسخ الاحتياطي (استعملناها سابقاً في شاشة الإعدادات)

export function exportOrdersForBackup() {
  return loadOrders();
}

export function importOrdersFromBackup(ordersFromFile) {
  if (!Array.isArray(ordersFromFile)) {
    throw new Error('صيغة ملف النسخة الاحتياطية غير صحيحة (يجب أن يحتوي على مصفوفة طلبات).');
  }
  saveOrders(ordersFromFile);
}
