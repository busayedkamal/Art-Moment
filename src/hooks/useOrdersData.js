// src/hooks/useOrdersData.js
import { useEffect, useState, useCallback } from 'react'
import { loadOrders as loadLocalOrders } from '../storage/orderStorage.js'

/**
 * هوك مشترك لقراءة الطلبات:
 * - يبدأ بقراءة الطلبات من LocalStorage (حتى لا تكون الصفحة فاضية).
 * - ثم يحاول تحميل الطلبات من /api/orders (Supabase).
 * - في حال فشل الاتصال، يبقي على البيانات المحلية ويعرض رسالة خطأ بسيطة.
 */
export function useOrdersData() {
  const [orders, setOrders] = useState(() => {
    // قراءة أولية من LocalStorage
    try {
      return loadLocalOrders()
    } catch {
      return []
    }
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchFromApi = useCallback(async () => {
    if (typeof window === 'undefined') return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/orders')
      if (!res.ok) {
        throw new Error('فشل تحميل الطلبات من الخادم.')
      }

      const data = await res.json()

      // نحاول التعامل مع أكثر من شكل محتمل للـ JSON
      const remoteOrders =
        Array.isArray(data.orders) ? data.orders
        : Array.isArray(data.data) ? data.data
        : []

      if (!Array.isArray(remoteOrders)) {
        throw new Error('صيغة بيانات غير متوقعة من واجهة البرمجة.')
      }

      setOrders(remoteOrders)
    } catch (err) {
      console.error('useOrdersData error:', err)
      setError(err.message || 'حدث خطأ أثناء تحميل الطلبات.')
      // نترك orders كما هي (من LocalStorage) ولا نمسها
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFromApi()
  }, [fetchFromApi])

  return {
    orders,
    loading,
    error,
    reload: fetchFromApi,
  }
}
