import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// صفحات عامة
import LandingPage from './LandingPage.jsx'
import TrackOrderPage from './pages/TrackOrderPage.jsx'
import AdminLoginPage from './pages/AdminLoginPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

// لوحة التحكم
import Layout from './components/layout/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Orders from './pages/Orders.jsx'
import OrderDetails from './pages/OrderDetails.jsx'
import Customers from './pages/Customers.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'
import NewOrder from './pages/NewOrder.jsx'

import { isAdminSessionActive } from './utils/adminSession.js'

function RequireAdmin({ children }) {
  if (!isAdminSessionActive()) return <Navigate to="/admin/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      {/* تتبع الطلب */}
      <Route path="/track" element={<TrackOrderPage />} />
      <Route path="/track-order" element={<Navigate to="/track" replace />} />

      {/* تسجيل دخول الأدمن */}
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* ✅ توافق مع المسار القديم لو كان موجود */}
      <Route path="/admin-login" element={<Navigate to="/admin/login" replace />} />

      {/* لوحة التحكم */}
      <Route
        path="/app"
        element={
          <RequireAdmin>
            <Layout />
          </RequireAdmin>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/new" element={<NewOrder />} />
        <Route path="orders/:id" element={<OrderDetails />} />
        <Route path="customers" element={<Customers />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
