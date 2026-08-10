// src/App.jsx
import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import AuthProvider, { useAuth } from './contexts/AuthContext'
import { LanguageProvider, useLanguage } from './contexts/LanguageContext'
import DomTranslator from './components/DomTranslator'

// الصفحة الرئيسية
const LandingPage = lazy(() => import('./LandingPage.jsx'))

// الصفحات العامة
const StoreIndex = lazy(() => import('./pages/StoreIndex.jsx'))
const SocialLinksPage = lazy(() => import('./pages/SocialLinksPage.jsx'))
const TrackOrderPage = lazy(() => import('./pages/TrackOrderPage.jsx'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage.jsx'))
const StoreCart = lazy(() => import('./pages/StoreCart.jsx'))
const ProductDetailsPage = lazy(() => import('./pages/ProductDetailsPage.jsx'))
const CustomerOrdersPage = lazy(() => import('./pages/CustomerOrdersPage.jsx'))
const CustomerAccountPage = lazy(() => import('./pages/CustomerAccountPage.jsx'))
const StorePaymentResult = lazy(() => import('./pages/StorePaymentResult.jsx'))
const MarketingUnsubscribePage = lazy(() => import('./pages/MarketingUnsubscribePage.jsx'))
const ProductManagement = lazy(() => import('./pages/ProductManagement.jsx'))
const StoreOrdersManagement = lazy(() => import('./pages/StoreOrdersManagement.jsx'))
const ManualStoreOrder = lazy(() => import('./pages/ManualStoreOrder.jsx'))
const AdminNotifications = lazy(() => import('./pages/AdminNotifications.jsx'))
const AdminActivityLog = lazy(() => import('./pages/AdminActivityLog.jsx'))
const AdminActionTasks = lazy(() => import('./pages/AdminActionTasks.jsx'))
const StoreGrowthAnalytics = lazy(() => import('./pages/StoreGrowthAnalytics.jsx'))

// صفحات لوحة التحكم
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const NewOrder = lazy(() => import('./pages/NewOrder.jsx'))
const Orders = lazy(() => import('./pages/Orders.jsx'))
const OrderDetails = lazy(() => import('./pages/OrderDetails.jsx'))
const Customers = lazy(() => import('./pages/Customers.jsx'))
const Reports = lazy(() => import('./pages/Reports.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const Expenses = lazy(() => import('./pages/Expenses.jsx'))

// الإطار العام
const Layout = lazy(() => import('./components/layout/Layout.jsx'))

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF9F7]">
      <div className="w-9 h-9 border-4 border-[#E8B4BC]/25 border-t-[#E8B4BC] rounded-full animate-spin" />
    </div>
  )
}

// مكون حماية المسارات
function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FAF9F7]"><div className="w-8 h-8 border-4 border-[#E8B4BC]/30 border-t-[#E8B4BC] rounded-full animate-spin"></div></div>
  
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
      <Route path="/store" element={<StoreIndex />} />
      <Route path="/links" element={<SocialLinksPage />} />
      <Route path="/track" element={<TrackOrderPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/store/cart" element={<StoreCart />} />
      <Route path="/store/products/:productId" element={<ProductDetailsPage />} />
      <Route path="/store/payment/success" element={<StorePaymentResult />} />
      <Route path="/store/payment/failed" element={<StorePaymentResult />} />
      <Route path="/store/account" element={<CustomerAccountPage />} />
      <Route path="/store/orders" element={<CustomerOrdersPage />} />
      <Route path="/store/orders/:orderId" element={<CustomerOrdersPage />} />
      <Route path="/marketing/unsubscribe" element={<MarketingUnsubscribePage />} />
      
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
        <Route path="products" element={<ProductManagement />} />
        <Route path="store-orders" element={<StoreOrdersManagement />} />
        <Route path="store-orders/new" element={<ManualStoreOrder />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="activity" element={<AdminActivityLog />} />
        <Route path="tasks" element={<AdminActionTasks />} />
        <Route path="store-growth" element={<StoreGrowthAnalytics />} />
      </Route>

      <Route path="*" element={<div className="min-h-screen flex items-center justify-center text-xl font-bold text-slate-400">الصفحة غير موجودة 404</div>} />
    </Routes>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <LocalizedApp />
    </LanguageProvider>
  )
}

function LocalizedApp() {
  const { language } = useLanguage()

  return (
    <BrowserRouter>
      <AuthProvider>
        <DomTranslator />
        <div id="app-language-scope" key={language}>
          <Suspense fallback={<PageLoader />}>
            <AppRoutes />
          </Suspense>
          <Toaster position="top-center" />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
