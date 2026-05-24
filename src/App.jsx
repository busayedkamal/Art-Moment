// src/App.jsx
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import AuthProvider, { useAuth } from './contexts/AuthContext'

// الصفحات العامة
import LandingPage from './LandingPage.jsx'
import TrackOrderPage from './pages/TrackOrderPage.jsx'

// صفحات لوحة التحكم
import AdminLoginPage from './pages/AdminLoginPage.jsx'
import Dashboard from './pages/Dashboard.jsx'
import NewOrder from './pages/NewOrder.jsx'
import Orders from './pages/Orders.jsx'
import OrderDetails from './pages/OrderDetails.jsx'
import Customers from './pages/Customers.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'
import Expenses from './pages/Expenses.jsx' // 👈 1. هذا السطر كان ناقصاً (استدعاء الصفحة)

// الإطار العام
import Layout from './components/layout/Layout.jsx'

// مكون حماية المسارات
function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F8F5F2]"><div className="w-8 h-8 border-4 border-[#D9A3AA]/30 border-t-[#D9A3AA] rounded-full animate-spin"></div></div>
  
  if (!session) {
    return <Navigate to="/admin/login" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* 1. المسارات العامة */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/track" element={<TrackOrderPage />} />
      
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
        <Route path="expenses" element={<Expenses />} /> {/* 👈 2. هذا السطر كان ناقصاً (تفعيل الرابط) */}
        <Route path="settings" element={<Settings />} />
      </Route>

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