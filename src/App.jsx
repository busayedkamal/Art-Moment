// src/App.jsx
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'

// صفحات الموقع العام
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

// جلسة المسؤول
import { isAdminSessionActive } from './utils/adminSession.js'

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

// نفصل الراوتات في كومبوننت داخلي عشان نقدر نستخدم useLocation
function AppRoutes() {
  return (
    <Routes>
      {/* موقع العميل */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/track" element={<TrackOrderPage />} />

      {/* دخول المسؤول */}
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* لوحة التحكم – كل شيء داخل /app محمي بجلسة المسؤول */}
      <Route
        path="/app"
        element={
          <RequireAdmin>
            <Layout />
          </RequireAdmin>
        }
      >
        {/* صفحة الملخص الأساسية */}
        <Route index element={<Dashboard />} />

        {/* الطلبات */}
        <Route path="orders" element={<Orders />} />
        <Route path="orders/new" element={<NewOrder />} />
        <Route path="orders/:orderId" element={<OrderDetails />} />

        {/* العملاء */}
        <Route path="customers" element={<Customers />} />

        {/* التقارير */}
        <Route path="reports" element={<Reports />} />

        {/* الإعدادات */}
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* صفحة 404 الافتراضية */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

// حماية بسيطة لمسار /app
function RequireAdmin({ children }) {
  const location = useLocation()

  if (!isAdminSessionActive()) {
    return (
      <Navigate
        to="/admin/login"
        state={{ from: location }}
        replace
      />
    )
  }

  return children
}
