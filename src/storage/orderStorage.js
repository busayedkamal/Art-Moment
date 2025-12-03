// src/storage/orderStorage.js
import { orders as seedOrders } from '../data/mockData.js'

const STORAGE_KEY = 'artMomentOrders'

export function loadOrders() {
  if (typeof window === 'undefined') {
    return seedOrders
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return seedOrders
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : seedOrders
  } catch (e) {
    console.error('Failed to load orders from localStorage', e)
    return seedOrders
  }
}

export function saveOrders(list) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.error('Failed to save orders to localStorage', e)
  }
}

export function getOrderById(id) {
  const list = loadOrders()
  return list.find((o) => o.id === id) || null
}

export function updateOrder(updatedOrder) {
  const list = loadOrders()
  const newList = list.map((o) =>
    o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o,
  )
  saveOrders(newList)
  return newList
}

export function addOrder(order) {
  const list = loadOrders()
  const newList = [...list, order]
  saveOrders(newList)
  return newList
}

export function generateOrderId() {
  const list = loadOrders()
  const year = new Date().getFullYear()
  const prefix = `OM-${year}-`

  const nums = list
    .filter((o) => typeof o.id === 'string' && o.id.startsWith(prefix))
    .map((o) => {
      const n = parseInt(o.id.slice(prefix.length), 10)
      return Number.isNaN(n) ? 0 : n
    })

  const next = nums.length ? Math.max(...nums) + 1 : 1
  return `${prefix}${String(next).padStart(4, '0')}`
}
