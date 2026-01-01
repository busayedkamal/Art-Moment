// src/App.jsx
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import AuthProvider, { useAuth } from './contexts/AuthContext'

// الصفحات العامة
import LandingPage from './LandingPage.jsx'      // 👈 تأكدنا من استدعائها
import TrackOrderPage from './pages/TrackOrderPage.jsx' // 👈 صفحة التتبع

// صفحات لوحة التحكم
import AdminLoginPage from './pages/AdminLoginPage.jsx'
import Dashboard from './pages/Dashboard.jsx'
import NewOrder from './pages/NewOrder.jsx'
import Orders from './pages/Orders.jsx'
import OrderDetails from './pages/OrderDetails.jsx'
import Customers from './pages/Customers.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'

// الإطار العام
import Layout from './components/layout/Layout.jsx'

// مكون حماية المسارات
function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>
  
  if (!session) {
    return <Navigate to="/admin/login" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* 1. المسارات العامة (متاحة للجميع) */}
      <Route path="/" element={<LandingPage />} /> {/* 👈 الآن الرابط الرئيسي يفتح صفحة الهبوط */}
      <Route path="/track" element={<TrackOrderPage />} /> {/* مسار التتبع */}
      
      {/* 2. صفحة دخول الأدمن */}
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* 3. منطقة لوحة التحكم المحمية */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/new" element={<NewOrder />} />
        <Route path="orders/:id" element={<OrderDetails />} />
        <Route path="customers" element={<Customers />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* صفحة الخطأ 404 */}
      <Route path="*" element={<div className="min-h-screen flex items-center justify-center text-xl font-bold text-slate-400">الصفحة غير موجودة 404</div>} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-center" />
      </AuthProvider>
    </BrowserRouter>
  )
}