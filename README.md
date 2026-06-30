# لحظة فن Art Moment

منصة تجارة إلكترونية وإدارة طلبات لطباعة الصور والمنتجات الفنية. تجمع المنصة بين واجهة عميل للمتجر والتتبع، ولوحة إدارة داخلية للطلبات والعملاء والمحافظ والتقارير.

## نظرة عامة

- الواجهة مبنية بـ React وVite.
- التصميم مبني بـ Tailwind CSS مع هوية بصرية خاصة: وردي ناعم، ذهبي مطفي، خلفية لؤلؤية، ونص فحمي.
- قاعدة البيانات والخدمات الخلفية عبر Supabase.
- المسارات العامة الحساسة تعمل عبر Supabase Edge Functions بدل قراءة الجداول مباشرة من المتصفح.
- لوحة الإدارة تعتمد على Supabase Auth وسياسات RLS.

## أهم المسارات

- `/` الصفحة الرئيسية والتسويق والباقات.
- `/store` المتجر الكامل، البحث، الفلاتر، وسلة الشراء.
- `/store/cart` إتمام طلب المتجر.
- `/track` تتبع الطلب أو عرض سجل العميل.
- `/admin/login` دخول الإدارة.
- `/app/dashboard` لوحة الإدارة.
- `/app/orders` طلبات الطباعة.
- `/app/store-orders` طلبات المتجر.
- `/app/customers` العملاء والمحافظ.
- `/app/products` إدارة منتجات المتجر.
- `/app/reports` التقارير.

## التشغيل المحلي

ثبت الحزم:

```bash
npm install
```

شغل بيئة التطوير:

```bash
npm run dev
```

الفحص:

```bash
npm run lint
```

بناء نسخة الإنتاج:

```bash
npm run build
```

معاينة نسخة الإنتاج:

```bash
npm run preview
```

## متغيرات البيئة

يحتاج التطبيق إلى ملف `.env.local` يحتوي:

```bash
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

لا تضع مفاتيح الخدمة أو مفاتيح WhatsApp داخل متغيرات Vite لأنها تصل للمتصفح.

## Supabase وRLS

تم تجهيز سياسات RLS والوظائف الآمنة داخل مجلد `supabase/`.

### الوظائف الآمنة

- `public-settings`: قراءة الأسعار العامة بدون أسرار.
- `customer-auth`: تسجيل/دخول العميل بدون كشف `password_hash`.
- `store-checkout`: إنشاء طلب المتجر والمحفظة من جهة الخادم.
- `track-order`: تتبع الطلب وسجل العميل بدون فتح جداول الطلبات والمحافظ للمتصفح.

### ملفات SQL المهمة

- `supabase/migrations/202606300001_secure_public_access.sql`
  يقفل الجداول الحساسة ويفعل RLS.
- `supabase/migrations/202606300002_public_products_catalog.sql`
  يحافظ على قراءة كتالوج المنتجات للزوار بعد تفعيل RLS.

راجع:

```text
supabase/SECURITY_DEPLOYMENT.md
```

## نشر وظائف Supabase

```bash
supabase functions deploy public-settings
supabase functions deploy customer-auth
supabase functions deploy store-checkout
supabase functions deploy track-order
```

أسرار WhatsApp والخدمة يجب أن تكون في Supabase Secrets، وليس داخل الواجهة:

```bash
supabase secrets set WHATSAPP_ENABLED=true
supabase secrets set ULTRAMSG_INSTANCE_ID=your-instance-id
supabase secrets set ULTRAMSG_TOKEN=your-token
```

## ملاحظات أمنية

- لا تفتح جداول `wallets`, `wallet_transactions`, `orders`, `store_orders`, `customers`, `settings` للـ `anon`.
- قراءة المنتجات العامة مسموحة، والكتابة عليها للإدارة فقط.
- إرسال WhatsApp يجب أن يبقى من Edge Function أو خدمة خلفية.
- بعد إضافة صف في `admin_users` يصبح الوصول الإداري محصورًا على المديرين المسجلين.

## ملاحظات تطوير

- استخدم أنماط الهوية الموجودة في `src/index.css` مثل `art-page`, `art-panel`, `art-product-card`, `art-input`, `art-cta`.
- عند تعديل صفحات العميل العامة، تجنب أي قراءة مباشرة للجداول الحساسة.
- الصور الكبيرة داخل جدول المنتجات تعمل حاليًا، لكن الأفضل لاحقًا نقلها إلى Supabase Storage لتحسين الأداء.
