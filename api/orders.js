// api/orders.js
import { supabase } from './supabaseClient.js'

export default async function handler(req, res) {
  const { method } = req

  // تفعيل CORS بسيط (لو احتجته)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    if (method === 'GET') {
      // /api/orders أو /api/orders?id=...
      const { id, code, phone, search, status } = req.query

      let query = supabase
        .from('orders')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at_ts', { ascending: false })

      if (id) {
        query = query.eq('id', id)
      }
      if (code) {
        query = query.eq('order_code', code)
      }
      if (phone) {
        query = query.eq('phone', phone)
      }
      if (status) {
        query = query.eq('status', status)
      }
      if (search) {
        // بحث بسيط بالاسم أو الجوال أو كود الطلب
        const s = search.trim()
        query = query.or(
          `customer_name.ilike.%${s}%,phone.ilike.%${s}%,order_code.ilike.%${s}%`,
        )
      }

      const { data, error } = await query

      if (error) {
        console.error('Supabase GET error:', error)
        return res.status(500).json({ error: 'Failed to load orders' })
      }

      return res.status(200).json(data)
    }

    if (method === 'POST') {
      // إنشاء طلب جديد
      const body = req.body

      if (!body || !body.order_code || !body.customer_name || !body.phone) {
        return res.status(400).json({ error: 'بيانات الطلب ناقصة' })
      }

      const { data, error } = await supabase
        .from('orders')
        .insert({
          order_code: body.order_code,
          customer_name: body.customer_name,
          phone: body.phone,
          source: body.source || null,
          photos_4x6: body.photos4x6 || 0,
          photos_a4: body.photosA4 || 0,
          total_amount: body.totalAmount || 0,
          paid_amount: body.paidAmount || 0,
          payment_status: body.paymentStatus || 'غير مدفوع',
          payment_method: body.paymentMethod || 'cash',
          status: body.status || 'جديد',
          notes: body.notes || null,
          created_at: body.createdAt || new Date().toISOString().slice(0, 10),
          due_date: body.dueDate || null,
        })
        .select('*')
        .single()

      if (error) {
        console.error('Supabase POST error:', error)
        return res.status(500).json({ error: 'Failed to create order' })
      }

      return res.status(201).json(data)
    }

    if (method === 'PATCH') {
      // تحديث طلب موجود: required: order_code أو id
      const body = req.body
      const { id, order_code } = body || {}

      if (!id && !order_code) {
        return res.status(400).json({ error: 'يجب تمرير id أو order_code لتحديث الطلب' })
      }

      const updateFields = { ...body }
      delete updateFields.id
      delete updateFields.order_code

      // تحويل بعض الحقول للأسماء في DB
      if (updateFields.photos4x6 !== undefined) {
        updateFields.photos_4x6 = updateFields.photos4x6
        delete updateFields.photos4x6
      }
      if (updateFields.photosA4 !== undefined) {
        updateFields.photos_a4 = updateFields.photosA4
        delete updateFields.photosA4
      }

      const query = supabase.from('orders').update(updateFields)
      if (id) query.eq('id', id)
      if (order_code) query.eq('order_code', order_code)

      const { data, error } = await query.select('*')

      if (error) {
        console.error('Supabase PATCH error:', error)
        return res.status(500).json({ error: 'Failed to update order' })
      }

      return res.status(200).json(data)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Handler runtime error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
