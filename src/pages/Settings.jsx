// src/pages/Settings.jsx
import { useEffect, useState, useRef } from 'react'
import { loadSettings, saveSettings } from '../storage/settingsStorage.js'
import {
  loadOrders,
  addOrder,
  updateOrder,
} from '../storage/orderStorage.js'

const DEFAULT_NOTE_TEMPLATES = [
  'تم استلام العربون.',
  'بانتظار صور إضافية من العميل.',
  'جاهز للاستلام – تم التواصل مع العميل.',
  'تم التسليم – بانتظار تقييمك لنا 🌟.',
]

export default function Settings() {
  const [price4x6, setPrice4x6] = useState('')
  const [priceA4, setPriceA4] = useState('')
  const [defaultDueDays, setDefaultDueDays] = useState('')
  const [adminCode, setAdminCode] = useState('')
  const [noteTemplatesText, setNoteTemplatesText] = useState(
    DEFAULT_NOTE_TEMPLATES.join('\n'),
  )
  const [loading, setLoading] = useState(true)

  // حقل ملف النسخة الاحتياطية
  const fileInputRef = useRef(null)

  // تحميل الإعدادات عند فتح الصفحة
  useEffect(() => {
    const s = loadSettings()

    setPrice4x6(
      s.price4x6 !== undefined && s.price4x6 !== null
        ? String(s.price4x6)
        : '',
    )
    setPriceA4(
      s.priceA4 !== undefined && s.priceA4 !== null
        ? String(s.priceA4)
        : '',
    )
    setDefaultDueDays(
      s.defaultDueDays !== undefined && s.defaultDueDays !== null
        ? String(s.defaultDueDays)
        : '',
    )
    setAdminCode(s.adminCode || '')

    if (Array.isArray(s.noteTemplates) && s.noteTemplates.length) {
      setNoteTemplatesText(s.noteTemplates.join('\n'))
    }

    setLoading(false)
  }, [])

  const handleSaveSettings = (e) => {
    e.preventDefault()

    const templates = noteTemplatesText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    const next = {
      price4x6: Number(price4x6 || 0),
      priceA4: Number(priceA4 || 0),
      defaultDueDays: defaultDueDays
        ? Number(defaultDueDays || 0)
        : undefined,
      adminCode: adminCode.trim() || '',
      noteTemplates: templates.length ? templates : DEFAULT_NOTE_TEMPLATES,
    }

    saveSettings(next)
    alert('تم حفظ الإعدادات بنجاح.')
  }

  // 🔹 تنزيل نسخة احتياطية (JSON)
  const handleDownloadBackup = () => {
    try {
      const orders = loadOrders()
      const settings = loadSettings()

      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        orders,
        settings,
      }

      const json = JSON.stringify(backup, null, 2)
      const blob = new Blob([json], {
        type: 'application/json;charset=utf-8;',
      })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      const datePart = new Date().toISOString().slice(0, 10)
      link.href = url
      link.setAttribute(
        'download',
        `art-moment-backup-${datePart}.json`,
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert('حدث خطأ أثناء إنشاء النسخة الاحتياطية.')
    }
  }

  // فتح حوار اختيار ملف النسخة الاحتياطية
  const handleClickImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  // 🔹 استيراد نسخة احتياطية من ملف JSON
  const handleImportFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('صيغة الملف غير صحيحة.')
      }

      const importedOrders = Array.isArray(parsed.orders)
        ? parsed.orders
        : []
      const importedSettings =
        parsed.settings && typeof parsed.settings === 'object'
          ? parsed.settings
          : null

      let importedOrdersCount = 0

      // دمج الطلبات حسب رقم الطلب id
      if (importedOrders.length) {
        const existing = loadOrders()
        const existingIds = new Set(existing.map((o) => o.id))

        for (const o of importedOrders) {
          if (!o || typeof o !== 'object' || !o.id) continue

          if (existingIds.has(o.id)) {
            updateOrder(o)
          } else {
            addOrder(o)
          }
          importedOrdersCount += 1
        }
      }

      // استيراد الإعدادات
      if (importedSettings) {
        saveSettings(importedSettings)
      }

      alert(
        `تم استيراد النسخة الاحتياطية بنجاح:\n- عدد الطلبات في الملف: ${
          importedOrders.length
        }\n- تم دمج/تحديث: ${importedOrdersCount} طلب.\n- تم تحديث الإعدادات: ${
          importedSettings ? 'نعم' : 'لا'
        }.`,
      )
    } catch (err) {
      console.error(err)
      alert(
        'تعذّر قراءة ملف النسخة الاحتياطية.\nتأكد أن الملف بصيغة JSON صالحة من النظام نفسه.',
      )
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg md:text-2xl font-bold text-slate-800">
          إعدادات لحظة فن
        </h1>
        <p className="text-sm text-slate-500">جاري تحميل الإعدادات...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* العنوان */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h1 className="text-lg md:text-2xl font-bold text-slate-800">
          إعدادات لحظة فن
        </h1>
      </div>

      {/* إعدادات عامة (تسعير + كود مسؤول + ملاحظات جاهزة) */}
      <form
        onSubmit={handleSaveSettings}
        className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4 text-sm"
      >
        <h2 className="font-semibold text-slate-800 text-base">
          إعدادات عامة
        </h2>

        {/* أسعار الصور */}
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs mb-1 text-slate-600">
              سعر صورة 4x6 (ر.س)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price4x6}
              onChange={(e) => setPrice4x6(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="مثال: 1.5"
            />
          </div>

          <div>
            <label className="block text-xs mb-1 text-slate-600">
              سعر صورة A4 (ر.س)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={priceA4}
              onChange={(e) => setPriceA4(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="مثال: 5"
            />
          </div>

          <div>
            <label className="block text-xs mb-1 text-slate-600">
              عدد الأيام الافتراضي لتاريخ التسليم{' '}
              <span className="text-[10px] text-slate-400 ml-1">
                (اختياري)
              </span>
            </label>
            <input
              type="number"
              min="0"
              value={defaultDueDays}
              onChange={(e) => setDefaultDueDays(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="مثال: 2"
            />
          </div>
        </div>

        {/* كود دخول المسؤول */}
        <div>
          <label className="block text-xs mb-1 text-slate-600">
            كود دخول لوحة التحكم (المسؤول)
          </label>
          <input
            type="text"
            value={adminCode}
            onChange={(e) => setAdminCode(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
            placeholder="مثال: 1234 أو أي كود تفضله"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            سيتم طلب هذا الكود عند محاولة فتح لوحة التحكم من الصفحة الرئيسية.
          </p>
        </div>

        {/* قوالب الملاحظات الجاهزة */}
        <div>
          <label className="block text-xs mb-1 text-slate-600">
            قوالب الملاحظات الجاهزة
          </label>
          <textarea
            value={noteTemplatesText}
            onChange={(e) => setNoteTemplatesText(e.target.value)}
            rows={4}
            className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
            placeholder={DEFAULT_NOTE_TEMPLATES.join('\n')}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            اكتب كل سطر كملاحظة جاهزة مستقلة. ستظهر هذه القوالب في صفحة
            تفاصيل الطلب عند الضغط على زر &quot;إضافة ملاحظة جاهزة&quot;.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs bg-slate-900 text-white hover:bg-slate-800"
          >
            حفظ الإعدادات
          </button>
        </div>
      </form>

      {/* النسخ الاحتياطي والاستيراد */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3 text-sm">
        <h2 className="font-semibold text-slate-800 text-base">
          النسخ الاحتياطي والاستعادة
        </h2>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          يتم حفظ بيانات النظام حالياً داخل المتصفح (LocalStorage) على هذا
          الجهاز فقط. من هنا يمكنك تنزيل نسخة احتياطية كملف JSON، أو
          استيراد نسخة سابقة عند تغيير الجهاز أو المتصفح.
        </p>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50"
          >
            تنزيل نسخة احتياطية (JSON)
          </button>

          <button
            type="button"
            onClick={handleClickImport}
            className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50"
          >
            استيراد نسخة احتياطية
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportFileChange}
          />
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          * عند الاستيراد لا يتم حذف الطلبات الحالية، بل يتم دمج محتوى الملف
          مع الموجود حالياً اعتماداً على رقم الطلب. إذا كان هناك طلب بنفس
          الرقم فسيتم تحديثه، وإذا كان جديداً فسيتم إضافته.
        </p>
      </div>
    </div>
  )
}
