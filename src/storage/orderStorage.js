// src/storage/orderStorage.js
// تخزين الطلبات في LocalStorage + مزامنة مع API Supabase عبر /api/orders

const STORAGE_KEY = 'art-moment-orders'
const ID_COUNTER_KEY = 'art-moment-order-id-counter'

// ========== مساعدات عامة ==========

// قراءة آمنة من LocalStorage
function safeParse(json, fallback) {
  try {
    const data = JSON.parse(json)
    return Array.isArray(data) ? data : fallback
  } catch {
    return fallback
  }
}

// تحميل جميع الطلبات من LocalStorage
export function loadOrders() {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  return safeParse(raw, [])
}

// حفظ جميع الطلبات في LocalStorage
export function saveOrders(orders) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders ?? []))
}

// ========== مزامنة مع الـ API (Supabase) ==========

function canCallApi() {
  return typeof window !== 'undefined' && typeof fetch === 'function'
}

// إنشاء طلب جديد في Supabase
function syncCreateOrderToCloud(order) {
  if (!canCallApi()) return
  try {
    fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
    }).catch((err) => {
      console.error('syncCreateOrderToCloud error:', err)
    })
  } catch (err) {
    console.error('syncCreateOrderToCloud unexpected error:', err)
  }
}

// تحديث طلب موجود في Supabase
function syncUpdateOrderToCloud(order) {
  if (!canCallApi()) return
  if (!order?.id) return

  try {
    const url = `/api/orders?id=${encodeURIComponent(order.id)}`
    fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
    }).catch((err) => {
      console.error('syncUpdateOrderToCloud error:', err)
    })
  } catch (err) {
    console.error('syncUpdateOrderToCloud unexpected error:', err)
  }
}

// حذف طلب من Supabase
function syncDeleteOrderFromCloud(id) {
  if (!canCallApi()) return
  if (!id) return

  try {
    const url = `/api/orders?id=${encodeURIComponent(id)}`
    fetch(url, {
      method: 'DELETE',
    }).catch((err) => {
      console.error('syncDeleteOrderFromCloud error:', err)
    })
  } catch (err) {
    console.error('syncDeleteOrderFromCloud unexpected error:', err)
  }
}

// ========== منطق أرقام الطلبات ==========

// إنشاء رقم طلب جديد (محلي) – نفس المنطق السابق
export function generateOrderId() {
  if (typeof window === 'undefined') {
    // احتياط في بيئة بدون window (لن تحدث في المتصفح العادي)
    return `ORD-${Date.now()}`
  }

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const raw = window.localStorage.getItem(ID_COUNTER_KEY)
  let state = null

  try {
    state = raw ? JSON.parse(raw) : null
  } catch {
    state = null
  }

  if (!state || state.date !== today) {
    state = { date: today, counter: 1 }
  } else {
    state.counter += 1
  }

  window.localStorage.setItem(ID_COUNTER_KEY, JSON.stringify(state))

  const counterStr = String(state.counter).padStart(3, '0')
  return `${today.replace(/-/g, '')}-${counterStr}` // مثال: 20241205-001
}

// ========== عمليات CRUD على LocalStorage + مزامنة مع السحابة ==========

// إضافة طلب جديد
export function addOrder(order) {
  const orders = loadOrders()
  orders.push(order)
  saveOrders(orders)

  // مزامنة مع Supabase في الخلفية
  syncCreateOrderToCloud(order)

  return order
}

// تحديث طلب موجود
export function updateOrder(updated) {
  const orders = loadOrders()
  const idx = orders.findIndex((o) => o.id === updated.id)
  if (idx === -1) {
    // لو ما حصلناه نضيفه كاحتياط (ما يفترض يحصل عادة)
    orders.push(updated)
  } else {
    orders[idx] = updated
  }
  saveOrders(orders)

  // مزامنة مع Supabase في الخلفية
  syncUpdateOrderToCloud(updated)

  return updated
}

// جلب طلب برقم معيّن
export function getOrderById(id) {
  const orders = loadOrders()
  return orders.find((o) => o.id === id) || null
}

// حذف طلب
export function deleteOrder(id) {
  const orders = loadOrders()
  const filtered = orders.filter((o) => o.id !== id)
  const changed = filtered.length !== orders.length
  if (changed) {
    saveOrders(filtered)
    // مزامنة مع Supabase في الخلفية
    syncDeleteOrderFromCloud(id)
  }
  return changed
}

// مسح جميع الطلبات (محلي فقط)
export function clearAllOrders() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  window.localStorage.removeItem(ID_COUNTER_KEY) // مسح عداد أرقام الطلبات
  // ملاحظة: لا نحذف من Supabase هنا حتى لا نفقد البيانات السحابية بالخطأ
}

// ========== دوال النسخ الاحتياطي (محلياً فقط حتى الآن) ==========

export function exportOrdersForBackup() {
  return loadOrders()
}

export function importOrdersFromBackup(ordersFromFile) {
  if (!Array.isArray(ordersFromFile)) {
    throw new Error(
      'صيغة ملف النسخة الاحتياطية غير صحيحة (يجب أن يحتوي على مصفوفة طلبات).',
    )
  }
  saveOrders(ordersFromFile)

  // ملاحظة:
  // حالياً هذه الدالة لا تعمل مزامنة تلقائية لكل الطلبات مع Supabase
  // حتى لا نرسل مئات الطلبات مرة واحدة بالخطأ.
  // لو حاب لاحقاً نضيف زر "رفع جميع الطلبات إلى السحابة" نسوي
  // دالة خاصة لذلك:
  //
  //   ordersFromFile.forEach((o) => syncCreateOrderToCloud(o))
  //
  // أو نكتب API خاص للـ bulk import.
}
