// api/orders.js
// نقطة الدخول الوحيدة لمسار /api/orders على Vercel (CRUD كامل مع Supabase)

import { createClient } from '@supabase/supabase-js';

// نستخدم مفاتيح الـ Service Role من متغيرات البيئة (backend فقط)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

// الأعمدة اللي نشتغل عليها في جدول orders
const ORDER_COLUMNS = `
  id,
  created_at,
  updated_at,
  customer_name,
  phone,
  source,
  photos_4x6,
  photos_a4,
  total_amount,
  paid_amount,
  payment_status,
  status,
  notes,
  payment_method,
  due_date,
  online_payment_status,
  online_payment_id,
  online_payment_provider,
  online_payment_url,
  online_payment_created_at,
  online_payment_paid_at,
  logs
`;

// تحويل من شكل قاعدة البيانات -> الشكل اللي يستخدمه الريأكت
function mapFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customerName: row.customer_name,
    phone: row.phone,
    source: row.source,
    photos4x6: row.photos_4x6 ?? 0,
    photosA4: row.photos_a4 ?? 0,
    totalAmount: Number(row.total_amount ?? 0),
    paidAmount: Number(row.paid_amount ?? 0),
    paymentStatus: row.payment_status,
    status: row.status,
    notes: row.notes,
    paymentMethod: row.payment_method,
    dueDate: row.due_date,
    onlinePaymentStatus: row.online_payment_status,
    onlinePaymentId: row.online_payment_id,
    onlinePaymentProvider: row.online_payment_provider,
    onlinePaymentUrl: row.online_payment_url,
    onlinePaymentCreatedAt: row.online_payment_created_at,
    onlinePaymentPaidAt: row.online_payment_paid_at,
    logs: row.logs || [],
  };
}

// تحويل من شكل الريأكت -> شكل قاعدة البيانات (snake_case)
function mapToDb(order) {
  return {
    id: order.id,
    customer_name: order.customerName ?? null,
    phone: order.phone ?? null,
    source: order.source ?? null,
    photos_4x6: order.photos4x6 ?? 0,
    photos_a4: order.photosA4 ?? 0,
    total_amount: order.totalAmount ?? 0,
    paid_amount: order.paidAmount ?? 0,
    payment_status: order.paymentStatus ?? null,
    status: order.status ?? null,
    notes: order.notes ?? null,
    payment_method: order.paymentMethod ?? null,
    due_date: order.dueDate ?? null,
    online_payment_status: order.onlinePaymentStatus ?? null,
    online_payment_id: order.onlinePaymentId ?? null,
    online_payment_provider: order.onlinePaymentProvider ?? null,
    online_payment_url: order.onlinePaymentUrl ?? null,
    online_payment_created_at: order.onlinePaymentCreatedAt ?? null,
    online_payment_paid_at: order.onlinePaymentPaidAt ?? null,
    logs: order.logs ?? [],
  };
}

export default async function handler(req, res) {
  const { method } = req;

  // نقرأ الـ query string (id, phone) من الرابط
  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = url.searchParams.get('id');
  const phone = url.searchParams.get('phone');

  try {
    // ==================== GET ====================
    if (method === 'GET') {
      // GET /api/orders?id=...
      if (id) {
        const { data, error } = await supabase
          .from('orders')
          .select(ORDER_COLUMNS)
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return res.status(404).json({ error: 'Order not found' });
        }
        return res.status(200).json({ order: mapFromDb(data) });
      }

      // GET /api/orders?phone=...
      if (phone) {
        const { data, error } = await supabase
          .from('orders')
          .select(ORDER_COLUMNS)
          .eq('phone', phone)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return res
          .status(200)
          .json({ orders: (data || []).map((row) => mapFromDb(row)) });
      }

      // GET /api/orders  -> كل الطلبات للوحة التحكم
      const { data, error } = await supabase
        .from('orders')
        .select(ORDER_COLUMNS)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res
        .status(200)
        .json({ orders: (data || []).map((row) => mapFromDb(row)) });
    }

    // تحضير body (في Vercel أحيانًا يكون String وأحيانًا Object)
    const rawBody =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const payload = rawBody ? JSON.parse(rawBody) : {};

    // ==================== POST ====================
    // إنشاء طلب جديد
    if (method === 'POST') {
      const dbRow = mapToDb(payload);

      const { data, error } = await supabase
        .from('orders')
        .insert(dbRow)
        .select(ORDER_COLUMNS)
        .single();

      if (error) throw error;

      return res.status(201).json({ order: mapFromDb(data) });
    }

    // ==================== PUT ====================
    // تعديل طلب
    if (method === 'PUT') {
      if (!payload.id) {
        return res.status(400).json({ error: 'id is required for update' });
      }

      const dbRow = mapToDb(payload);
      delete dbRow.id; // لا نعدّل المفتاح الأساسي

      const { data, error } = await supabase
        .from('orders')
        .update(dbRow)
        .eq('id', payload.id)
        .select(ORDER_COLUMNS)
        .single();

      if (error) throw error;

      return res.status(200).json({ order: mapFromDb(data) });
    }

    // ==================== DELETE ====================
    if (method === 'DELETE') {
      const targetId = payload.id || id;
      if (!targetId) {
        return res.status(400).json({ error: 'id is required for delete' });
      }

      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', targetId);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    // أي ميثود غير GET/POST/PUT/DELETE
    res.setHeader('Allow', 'GET,POST,PUT,DELETE');
    return res.status(405).json({ error: `Method ${method} not allowed` });
  } catch (err) {
    console.error('API /api/orders error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      details: err.message ?? String(err),
    });
  }
}
