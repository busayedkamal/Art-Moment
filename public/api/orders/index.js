// api/orders/index.js
// API كامل للطلبات (CRUD) مع Supabase
// GET  : تتبّع طلب بالـ phone أو id
// POST : إنشاء طلب جديد
// PUT  : تعديل طلب موجود
// DELETE : حذف طلب

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// ملاحظة أمان:
// هذا الكلاينت يستخدم service_role (صلاحيات عالية) لكن داخل السيرفر فقط.
// يفضّل لاحقاً إضافة طبقة حماية بسيطة للعمليات الكتابية (POST/PUT/DELETE)
// مثل هيدر سري ADMIN_API_SECRET.
const supabase =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      })
    : null

// ===== دوال مساعدة عامة =====

// قراءة JSON من الـ request بشكل آمن (يدعم Vercel Node runtime)
async function getJsonBody(req) {
  // لو Vercel عطانا body جاهز
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body)
      } catch {
        return {}
      }
    }
    // Buffer
    if (Buffer.isBuffer(req.body)) {
      try {
        return JSON.parse(req.body.toString('utf8'))
      } catch {
        return {}
      }
    }
    // كائن جاهز
    if (typeof req.body === 'object') {
      return req.body
    }
  }

  // fallback: نقرأ الستريم مباشرة
  return await new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      if (!data) return resolve({})
      try {
        resolve(JSON.parse(data))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

// تحويل صف من قاعدة البيانات → كائن يستخدمه الريأكت (camelCase)
function mapOrderRow(row) {
  if (!row) return null

  return {
    id: row.id,
    customerName: row.customer_name ?? null,
    phone: row.phone ?? null,
    source: row.source ?? null,

    photos4x6: row.photos_4x6 ?? 0,
    photosA4: row.photos_a4 ?? 0,

    totalAmount: Number(row.total_amount ?? 0),
    paidAmount: Number(row.paid_amount ?? 0),
    paymentStatus: row.payment_status ?? null,
    status: row.status ?? null,

    createdAt: row.created_at ?? null,
    dueDate: row.due_date ?? null,

    notes: row.notes ?? null,

    paymentMethod: row.payment_method ?? null,
    onlinePaymentStatus: row.online_payment_status ?? null,
    onlinePaymentId: row.online_payment_id ?? null,
    onlinePaymentProvider: row.online_payment_provider ?? null,
    onlinePaymentUrl: row.online_payment_url ?? null,
    onlinePaymentCreatedAt: row.online_payment_created_at ?? null,
    onlinePaymentPaidAt: row.online_payment_paid_at ?? null,

    // لو عندك عمود log من نوع json/jsonb
    log: row.log ?? null,
  }
}

// تجهيز بيانات الإدخال للـ INSERT (من body → إلى شكل الجدول)
function mapOrderToDbForInsert(body) {
  const row = {}

  // id: إما من العميل أو يتم توليده لاحقاً
  if (body.id) {
    row.id = String(body.id)
  }

  row.customer_name = body.customerName ?? null
  row.phone = body.phone ?? null
  row.source = body.source ?? null

  row.photos_4x6 = Number(body.photos4x6 ?? 0)
  row.photos_a4 = Number(body.photosA4 ?? 0)

  row.total_amount = Number(body.totalAmount ?? 0)
  row.paid_amount = Number(body.paidAmount ?? 0)

  row.payment_status = body.paymentStatus ?? null
  row.status = body.status ?? null

  row.notes = body.notes ?? null

  row.payment_method = body.paymentMethod ?? null
  row.online_payment_status = body.onlinePaymentStatus ?? null
  row.online_payment_id = body.onlinePaymentId ?? null
  row.online_payment_provider = body.onlinePaymentProvider ?? null
  row.online_payment_url = body.onlinePaymentUrl ?? null
  row.online_payment_created_at = body.onlinePaymentCreatedAt ?? null
  row.online_payment_paid_at = body.onlinePaymentPaidAt ?? null

  if (Array.isArray(body.log)) {
    row.log = body.log
  }

  // created_at و due_date:
  row.created_at =
    body.createdAt || new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
  row.due_date = body.dueDate ?? null

  return row
}

// بناء payload للتعديل (نحدّث فقط الحقول المرسلة)
function buildUpdatePayload(body) {
  const payload = {}

  const numericFields = ['photos4x6', 'photosA4', 'totalAmount', 'paidAmount']
  const map = {
    customerName: 'customer_name',
    phone: 'phone',
    source: 'source',
    photos4x6: 'photos_4x6',
    photosA4: 'photos_a4',
    totalAmount: 'total_amount',
    paidAmount: 'paid_amount',
    paymentStatus: 'payment_status',
    status: 'status',
    notes: 'notes',
    paymentMethod: 'payment_method',
    onlinePaymentStatus: 'online_payment_status',
    onlinePaymentId: 'online_payment_id',
    onlinePaymentProvider: 'online_payment_provider',
    onlinePaymentUrl: 'online_payment_url',
    onlinePaymentCreatedAt: 'online_payment_created_at',
    onlinePaymentPaidAt: 'online_payment_paid_at',
    createdAt: 'created_at',
    dueDate: 'due_date',
    log: 'log',
  }

  for (const [camel, snake] of Object.entries(map)) {
    if (Object.prototype.hasOwnProperty.call(body, camel)) {
      let value = body[camel]

      if (numericFields.includes(camel)) {
        value = Number(value ?? 0)
      }

      payload[snake] =
        value === undefined || value === null || value === ''
          ? null
          : value
    }
  }

  return payload
}

// ===== Handlers لكل Method =====

async function handleGet(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const phone = url.searchParams.get('phone')
  const id = url.searchParams.get('id')

  if (!phone && !id) {
    return res.status(400).json({
      error: 'يجب إرسال phone أو id في الاستعلام (query string).',
    })
  }

  let query = supabase.from('orders').select('*')

  if (id) {
    query = query.eq('id', id)
  } else if (phone) {
    query = query.eq('phone', phone)
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) {
    console.error('Supabase GET /api/orders error:', error)
    return res.status(500).json({
      error: 'حدث خطأ أثناء قراءة الطلبات من قاعدة البيانات.',
    })
  }

  const rows = Array.isArray(data) ? data : data ? [data] : []
  const mapped = rows.map(mapOrderRow).filter(Boolean)

  return res.status(200).json(mapped)
}

async function handlePost(req, res) {
  const body = await getJsonBody(req)

  // التحقق من الحقول الأساسية
  if (!body.customerName || !body.phone) {
    return res.status(400).json({
      error: 'الحقول customerName و phone مطلوبة لإنشاء طلب جديد.',
    })
  }

  // ضمان وجود id و createdAt و paymentStatus حتى لو ما أرسلهم العميل
  const nowDate = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  if (!body.id || !String(body.id).trim()) {
    // توليد رقم بسيط (ممكن لاحقاً ننقله لمنطق موحّد)
    const today = nowDate.replace(/-/g, '') // 20251205
    const rand = Math.floor(1000 + Math.random() * 9000) // 4 أرقام
    body.id = `${today}-${rand}`
  }

  if (!body.createdAt) {
    body.createdAt = nowDate
  }

  const total = Number(body.totalAmount || 0)
  const paid = Number(body.paidAmount || 0)

  if (!body.paymentStatus) {
    if (total <= 0 || paid <= 0) body.paymentStatus = 'غير مدفوع'
    else if (paid >= total) body.paymentStatus = 'مدفوع بالكامل'
    else body.paymentStatus = 'مدفوع جزئياً'
  }

  if (!body.status) {
    body.status = 'جديد'
  }

  const row = mapOrderToDbForInsert(body)

  const { data, error } = await supabase
    .from('orders')
    .insert(row)
    .select('*')
    .single()

  if (error) {
    console.error('Supabase POST /api/orders error:', error)
    return res.status(500).json({
      error: 'حدث خطأ أثناء إنشاء الطلب في قاعدة البيانات.',
    })
  }

  const mapped = mapOrderRow(data)
  return res.status(201).json(mapped)
}

async function handlePut(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const idFromQuery = url.searchParams.get('id')

  const body = await getJsonBody(req)
  const id = idFromQuery || body.id

  if (!id) {
    return res.status(400).json({
      error: 'يجب إرسال id (في الاستعلام أو في الـ body) لتعديل الطلب.',
    })
  }

  const payload = buildUpdatePayload(body)

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({
      error: 'لا يوجد حقول صالحة للتعديل في الطلب.',
    })
  }

  const { data, error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', id)
    .select('*')

  if (error) {
    console.error('Supabase PUT /api/orders error:', error)
    return res.status(500).json({
      error: 'حدث خطأ أثناء تحديث الطلب في قاعدة البيانات.',
    })
  }

  if (!data || !data.length) {
    return res.status(404).json({
      error: 'لم يتم العثور على طلب بهذا الرقم لتعديله.',
    })
  }

  const mapped = mapOrderRow(data[0])
  return res.status(200).json(mapped)
}

async function handleDelete(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const id = url.searchParams.get('id')

  if (!id) {
    return res.status(400).json({
      error: 'يجب إرسال id في الاستعلام (query string) لحذف الطلب.',
    })
  }

  const { data, error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) {
    console.error('Supabase DELETE /api/orders error:', error)
    return res.status(500).json({
      error: 'حدث خطأ أثناء حذف الطلب من قاعدة البيانات.',
    })
  }

  if (!data || !data.length) {
    return res.status(404).json({
      error: 'لم يتم العثور على طلب بهذا الرقم لحذفه.',
    })
  }

  return res.status(200).json({ success: true, id })
}

// ===== الهاندلر الرئيسي =====

export default async function handler(req, res) {
  if (!supabase) {
    return res.status(500).json({
      error:
        'Supabase client is not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    })
  }

  try {
    if (req.method === 'GET') {
      return await handleGet(req, res)
    }

    if (req.method === 'POST') {
      return await handlePost(req, res)
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      return await handlePut(req, res)
    }

    if (req.method === 'DELETE') {
      return await handleDelete(req, res)
    }

    res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE')
    return res.status(405).json({
      error: 'Method Not Allowed. Use GET, POST, PUT/PATCH, or DELETE.',
    })
  } catch (err) {
    console.error('Unexpected error in /api/orders:', err)
    return res.status(500).json({
      error: 'حدث خطأ غير متوقع في السيرفر.',
    })
  }
}
