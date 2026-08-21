/* global AbortSignal, Buffer, console, fetch */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { loadEnv } from 'vite';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const template = await readFile(join(dist, 'index.html'), 'utf8');
const siteUrl = 'https://art-moment.com';
const env = loadEnv('production', root, '');

const pages = [
  {
    path: '/',
    title: 'لحظة فن | طباعة الصور وحفظ الذكريات',
    description: 'اطبع صورك أونلاين وتسوق الألبومات والإطارات ومستلزمات حفظ الصور من لحظة فن.',
    heading: 'أجمل لحظاتك تستحق التوثيق',
    body: 'طباعة صور فوتوغرافية، ألبومات وإطارات ومنتجات تحفظ ذكرياتك بجودة واضحة.',
    links: [['/print', 'اطبع صورك الآن'], ['/store', 'تصفح المتجر'], ['/track', 'تتبع طلبك']],
  },
  {
    path: '/print',
    title: 'اطبع صورك الآن | لحظة فن',
    description: 'اختر مقاس وخامة طباعة الصور، ارفع ملفاتك بخصوصية، ثم راجع العدد والإعدادات والسعر قبل إضافتها إلى السلة.',
    heading: 'اطبع صورك بخطوات واضحة وآمنة',
    body: 'اختر المقاس والخامة والسطح والحواف، ثم ارفع صورك وحدد عدد النسخ وطريقة ملاءمة الصورة قبل مراجعة السعر والإضافة إلى السلة.',
    links: [['/photo-print-sizes', 'مقاسات الطباعة'], ['/store', 'المتجر']],
  },
  {
    path: '/store',
    title: 'متجر لحظة فن | ألبومات وإطارات ومطبوعات',
    description: 'تسوق ألبومات الصور والإطارات والمطبوعات ومستلزمات حفظ الصور المختارة من لحظة فن.',
    heading: 'متجر لحظة فن',
    body: 'ألبومات وإطارات ومطبوعات ومستلزمات مختارة لحفظ الصور والذكريات.',
    links: [['/store/albums', 'ألبومات الصور'], ['/store/frames', 'إطارات الصور'], ['/store/photo-supplies', 'مستلزمات حفظ الصور']],
  },
  {
    path: '/photo-printing',
    title: 'طباعة الصور | لحظة فن Art Moment',
    description: 'اطبع صور الجوال والكاميرا بمقاسات عملية وأسعار واضحة قبل تجهيز الطلب.',
    heading: 'طباعة الصور بجودة تحفظ لحظاتك',
    body: 'ابدأ باختيار المقاس، ارفع صورك، ثم راجع العدد والسعر قبل إضافة طلب الطباعة إلى السلة.',
    links: [['/print', 'ابدأ الطباعة'], ['/photo-print-sizes', 'تعرف على المقاسات']],
  },
  {
    path: '/photographic-printing',
    title: 'طباعة الصور الفوتوغرافية | لحظة فن',
    description: 'طباعة فوتوغرافية للألبومات والإطارات والذكريات اليومية بمقاسات وأسعار واضحة قبل إتمام الطلب.',
    heading: 'طباعة الصور الفوتوغرافية',
    body: 'اختر المقاس وارفع صورك وحدد الكمية، ثم راجع طلبك قبل إضافته إلى السلة.',
    links: [['/print', 'اطبع صورك'], ['/store/albums', 'تصفح الألبومات']],
  },
  {
    path: '/photo-print-sizes',
    title: 'مقاسات طباعة الصور | لحظة فن',
    description: 'دليل مبسط لاختيار مقاس طباعة الصور المناسب للألبوم أو الإطار مع السعر قبل إتمام الطلب.',
    heading: 'مقاسات طباعة الصور',
    body: 'اختر المقاس المناسب للألبوم أو الإطار وشاهد السعر قبل إتمام الطلب.',
    links: [['/print', 'اختر المقاس وابدأ'], ['/store/frames', 'إطارات الصور']],
  },
  {
    path: '/store/albums',
    title: 'ألبومات الصور | متجر لحظة فن',
    description: 'تصفح ألبومات الصور المتوفرة بمقاسات وألوان مختلفة مع تفاصيل السعة والخامة والتوفر.',
    heading: 'ألبومات الصور',
    body: 'قارن السعة والمقاس واللون ثم افتح صفحة المنتج لمراجعة جميع التفاصيل.',
    links: [['/store', 'كل المتجر'], ['/photo-printing', 'طباعة الصور']],
  },
  {
    path: '/store/frames',
    title: 'إطارات الصور | متجر لحظة فن',
    description: 'إطارات للصور المطبوعة بمقاسات وخامات متنوعة مع توضيح المقاس والتوفر.',
    heading: 'إطارات الصور',
    body: 'اختر الإطار المناسب لمساحتك وتحقق من المقاس والخامة قبل الشراء.',
    links: [['/store', 'كل المتجر'], ['/photo-print-sizes', 'مقاسات الطباعة']],
  },
  {
    path: '/store/photo-supplies',
    title: 'مستلزمات حفظ الصور | متجر لحظة فن',
    description: 'ملصقات ومستلزمات مختارة لتنظيم الصور وتزيين الألبومات وحفظ الذكريات.',
    heading: 'مستلزمات حفظ الصور',
    body: 'منتجات مكملة للطباعة والألبومات مع تفاصيل واضحة لكل منتج.',
    links: [['/store', 'كل المتجر'], ['/store/albums', 'ألبومات الصور']],
  },
  {
    path: '/store/cart',
    title: 'سلة التسوق | لحظة فن',
    description: 'راجع منتجات سلة لحظة فن والكميات قبل تسجيل الدخول وإتمام الطلب.',
    heading: 'سلة التسوق',
    body: 'راجع المنتجات والكميات، أو عد إلى المتجر لإضافة ما يحفظ لحظاتك.',
    links: [['/store', 'تصفح المتجر'], ['/print', 'اطبع صورك الآن']],
    noindex: true,
  },
  {
    path: '/track',
    title: 'تتبع طلبك | لحظة فن',
    description: 'أدخل رقم الطلب ورمز التتبع الآمن لمعرفة آخر حالة متاحة لطلبك من لحظة فن.',
    heading: 'تتبع طلبك',
    body: 'استخدم رقم الطلب ورمز التتبع الآمن المرفق بتأكيد الطلب. لا نعرض بيانات العميل أو ملفات الصور في صفحة التتبع العامة.',
    links: [['/store/orders', 'طلباتي'], ['/store', 'العودة للمتجر']],
    noindex: true,
  },
  {
    path: '/store/orders',
    title: 'طلباتي | لحظة فن',
    description: 'سجل الدخول لعرض طلباتك وتفاصيل المنتجات والدفع والتوصيل بأمان.',
    heading: 'طلباتي',
    body: 'هذه مساحة خاصة بحساب العميل، وتتطلب جلسة دخول آمنة لعرض الطلبات والتفاصيل.',
    links: [['/store', 'العودة للمتجر'], ['/track', 'تتبع طلب كزائر']],
    noindex: true,
    nofollow: true,
  },
];

const productCategoriesByPath = {
  '/store': null,
  '/photo-printing': ['printing', 'طباعة'],
  '/photographic-printing': ['printing', 'طباعة'],
  '/photo-print-sizes': ['printing', 'طباعة'],
  '/store/albums': ['albums', 'ألبومات'],
  '/store/frames': ['frames', 'إطارات'],
  '/store/photo-supplies': ['stickers', 'ملصقات', 'supplies', 'مستلزمات'],
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

function replaceMeta(html, page) {
  const canonical = new URL(page.path, siteUrl).toString();
  const image = page.image
    ? new URL(page.image, siteUrl).toString()
    : siteUrl + '/pwa-512x512.png';
  const replacements = [
    [/<title>.*?<\/title>/s, '<title>' + escapeHtml(page.title) + '</title>'],
    [/<meta name="description" content=".*?"\s*\/>/s, '<meta name="description" content="' + escapeHtml(page.description) + '" />'],
    [/<link rel="canonical" href=".*?"\s*\/>/s, '<link rel="canonical" href="' + canonical + '" />'],
    [/<meta property="og:title" content=".*?"\s*\/>/s, '<meta property="og:title" content="' + escapeHtml(page.title) + '" />'],
    [/<meta property="og:description" content=".*?"\s*\/>/s, '<meta property="og:description" content="' + escapeHtml(page.description) + '" />'],
    [/<meta property="og:type" content=".*?"\s*\/>/s, '<meta property="og:type" content="' + (page.type || 'website') + '" />'],
    [/<meta property="og:url" content=".*?"\s*\/>/s, '<meta property="og:url" content="' + canonical + '" />'],
    [/<meta property="og:image" content=".*?"\s*\/>/s, '<meta property="og:image" content="' + escapeHtml(image) + '" />'],
    [/<meta name="twitter:title" content=".*?"\s*\/>/s, '<meta name="twitter:title" content="' + escapeHtml(page.title) + '" />'],
    [/<meta name="twitter:description" content=".*?"\s*\/>/s, '<meta name="twitter:description" content="' + escapeHtml(page.description) + '" />'],
    [/<meta name="twitter:image" content=".*?"\s*\/>/s, '<meta name="twitter:image" content="' + escapeHtml(image) + '" />'],
    [/<meta name="robots" content=".*?"\s*\/>/s, '<meta name="robots" content="' + (page.noindex ? 'noindex,' + (page.nofollow ? 'nofollow' : 'follow') : 'index,follow,max-image-preview:large') + '" />'],
  ];
  return replacements.reduce((result, [pattern, value]) => result.replace(pattern, value), html);
}

function appendStructuredData(html, nodes) {
  const graph = (Array.isArray(nodes) ? nodes : [nodes]).filter(Boolean);
  if (graph.length === 0) return html;
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
    .replaceAll('<', '\\u003c');
  return html.replace('</head>', '<script type="application/ld+json">' + json + '</script></head>');
}

async function fetchCatalogProducts() {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('SEO product rendering skipped: Supabase build variables are unavailable.');
    return [];
  }

  const endpoint = new URL('/rest/v1/products', supabaseUrl);
  endpoint.searchParams.set('select', '*');
  endpoint.searchParams.set('order', 'sort_order.asc');
  endpoint.searchParams.set('limit', '100');
  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      throw new Error(`Unable to load products for SEO pages (${response.status}).`);
    }
    return response.json();
  } catch (error) {
    console.warn(`SEO product rendering skipped: ${error.message}`);
    return [];
  }
}

function getPageProducts(page, products) {
  if (!(page.path in productCategoriesByPath)) return [];
  const categories = productCategoriesByPath[page.path];
  if (!categories) return products.slice(0, 24);
  const normalizedCategories = categories.map((category) => String(category).toLowerCase());
  return products
    .filter((product) => normalizedCategories.includes(String(product.category || '').toLowerCase()))
    .slice(0, 24);
}

function staticProductList(page, products) {
  const pageProducts = getPageProducts(page, products);
  if (pageProducts.length === 0) return '';

  const cards = pageProducts.map((product) => {
    const href = `/store/products/${encodeURIComponent(product.id)}`;
    const name = escapeHtml(product.name || 'منتج من لحظة فن');
    const description = escapeHtml(product.description || '');
    const price = Number(product.price || 0).toFixed(2);
    const image = typeof product.image === 'string' && /^https?:\/\//i.test(product.image)
      ? `<img src="${escapeHtml(product.image)}" alt="${name}" width="480" height="480" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:cover;background:#f3f0ec">`
      : '';
    return `<li style="list-style:none;border:1px solid rgba(23,23,23,.1);background:#fff;padding:14px"><article>${image}<h3 style="font-size:18px;line-height:1.6;margin:14px 0 6px"><a href="${href}" style="color:#171717">${name}</a></h3>${description ? `<p style="color:#625d59;line-height:1.7;margin:0 0 12px">${description}</p>` : ''}<p style="font-weight:800;color:#b96f7d;margin:0">${price} ر.س</p></article></li>`;
  }).join('');

  return `<section aria-labelledby="seo-products-heading" style="padding:20px 0 64px"><h2 id="seo-products-heading" style="font-size:28px;line-height:1.4;margin:0 0 24px">منتجات متاحة من لحظة فن</h2><ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;padding:0;margin:0">${cards}</ul></section>`;
}

function staticContent(page, products) {
  const links = page.links.map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`).join('');
  const breadcrumb = page.path === '/'
    ? ''
    : `<nav aria-label="مسار التنقل" style="margin-top:24px;font-size:14px"><a href="/">الرئيسية</a><span aria-hidden="true"> / </span><span aria-current="page">${escapeHtml(page.heading)}</span></nav>`;
  return `<main id="seo-static-content" style="font-family:Tajawal,Arial,sans-serif;direction:rtl;max-width:1180px;margin:0 auto;padding:32px 20px;color:#171717"><header style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ddd;padding-bottom:20px"><a href="/" style="font-weight:800;color:#171717;text-decoration:none">لحظة فن Art Moment</a><a href="/store/cart" style="color:#171717">السلة</a></header>${breadcrumb}<section style="padding:48px 0"><h1 style="font-size:40px;font-weight:800;line-height:1.3;margin:0 0 20px">${escapeHtml(page.heading)}</h1><p style="max-width:720px;font-size:16px;line-height:1.75;color:#555">${escapeHtml(page.body)}</p><nav style="display:flex;flex-wrap:wrap;gap:12px;margin-top:28px">${links}</nav></section>${staticProductList(page, products)}</main>`;
}

function normalizeProductImages(product) {
  const gallery = Array.isArray(product.gallery_images) ? product.gallery_images : [];
  return [...new Set([product.image, product.hover_image, ...gallery]
    .filter((image) => typeof image === 'string' && image.trim()))];
}

function productCategoryLabel(category) {
  const labels = {
    albums: 'ألبومات الصور',
    frames: 'إطارات الصور',
    stickers: 'مستلزمات حفظ الصور',
    printing: 'باقات وطباعة الصور',
  };
  return labels[String(category || '').toLowerCase()] || String(category || 'منتجات لحظة فن');
}

function getProductShareSubtitle(product) {
  const category = String(product.category || '').toLowerCase();
  const searchable = [product.name, product.description, JSON.stringify(product.specifications || {})]
    .filter(Boolean)
    .join(' ');
  if (category === 'printing' || /باقة|package|طباعة/i.test(searchable)) {
    const values = (searchable.match(/\d[\d,]*/g) || [])
      .map((value) => Number(value.replaceAll(',', '')))
      .filter(Number.isFinite);
    if (values.length > 0) return 'حتى ' + Math.max(...values) + ' صورة';
  }
  return productCategoryLabel(product.category);
}

function wrapShareTitle(value, maxLength = 18) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  for (const word of words) {
    const current = lines.at(-1) || '';
    if (!current || current.length + word.length + 1 > maxLength) lines.push(word);
    else lines[lines.length - 1] = current + ' ' + word;
  }
  return lines.slice(0, 3);
}

async function readProductImageBuffer(product) {
  const image = normalizeProductImages(product)[0];
  try {
    if (/^https?:\/\//i.test(image || '')) {
      const response = await fetch(image, { signal: AbortSignal.timeout(12000) });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
    }
    if (image?.startsWith('/')) {
      return await readFile(join(dist, image.replace(/^\/+/, '')));
    }
    const match = String(image || '').match(/^data:image\/(?:jpeg|png|webp);base64,(.+)$/s);
    if (match) return Buffer.from(match[1], 'base64');
  } catch (error) {
    console.warn('Unable to load product share image:', product.id, error.message);
  }
  return readFile(join(dist, 'pwa-512x512.png'));
}

async function materializeProductImage(product) {
  const fileName = encodeURIComponent(String(product.id)) + '-share.jpg';
  const output = join(dist, 'seo', 'products', fileName);
  const source = await readProductImageBuffer(product);
  const productImage = await sharp(source)
    .rotate()
    .resize(630, 630, { fit: 'cover', position: 'attention', background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 86, chromaSubsampling: '4:4:4' })
    .toBuffer();
  const titleLines = wrapShareTitle(product.name);
  const titleSize = titleLines.length > 2 ? 49 : 57;
  const title = titleLines.map((line, index) => (
    '<text x="500" y="' + (250 + (index * 72)) + '" text-anchor="start" direction="rtl" '
      + 'font-family="Tajawal,Arial,sans-serif" font-size="' + titleSize + '" font-weight="800" fill="#171717">'
      + escapeHtml(line) + '</text>'
  )).join('');
  const subtitleY = 250 + (titleLines.length * 72) + 22;
  const overlay = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="570" height="630" viewBox="0 0 570 630">'
      + '<rect width="570" height="630" fill="#FAF9F7"/>'
      + '<path d="M42 66h38M42 66v38M528 566h-38M528 566v-38" fill="none" stroke="#C6A56B" stroke-width="4"/>'
      + '<circle cx="496" cy="86" r="8" fill="#E8B4BC"/>'
      + '<text x="472" y="94" text-anchor="start" direction="rtl" font-family="Tajawal,Arial,sans-serif" font-size="29" font-weight="800" fill="#171717">لحظة فن</text>'
      + '<text x="410" y="126" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="700" letter-spacing="2" fill="#8F713C">ART MOMENT</text>'
      + '<line x1="72" y1="166" x2="500" y2="166" stroke="#E8B4BC" stroke-opacity="0.55"/>'
      + title
      + '<text x="500" y="' + subtitleY + '" text-anchor="start" direction="rtl" font-family="Tajawal,Arial,sans-serif" font-size="25" font-weight="700" fill="#B96F7D">'
      + escapeHtml(getProductShareSubtitle(product)) + '</text>'
      + '<text x="500" y="555" text-anchor="start" direction="rtl" font-family="Tajawal,Arial,sans-serif" font-size="18" font-weight="600" fill="#625D59">تفاصيل المنتج في متجر لحظة فن</text>'
      + '</svg>',
  );
  await mkdir(dirname(output), { recursive: true });
  await sharp({
    create: { width: 1200, height: 630, channels: 3, background: '#FAF9F7' },
  })
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: productImage, left: 570, top: 0 },
    ])
    .jpeg({ quality: 84, chromaSubsampling: '4:2:0' })
    .toFile(output);
  return siteUrl + '/seo/products/' + fileName;
}

function productStaticContent(product, page) {
  // Keep the initial HTML lightweight; the interactive app loads the full gallery.
  const images = page.image ? [page.image] : [];
  const price = Number(product.price || 0).toFixed(2);
  const hasTrackedStock = product.stock_quantity !== null && product.stock_quantity !== undefined;
  const stock = Number(product.stock_quantity || 0);
  const available = product.in_stock !== false && (!hasTrackedStock || stock > 0);
  const stockLabel = available
    ? hasTrackedStock ? 'متوفر (' + stock + ')' : 'متوفر'
    : 'غير متوفر حاليًا';
  const specifications = product.specifications && typeof product.specifications === 'object'
    ? Object.entries(product.specifications)
    : [];
  const gallery = images.map((item, index) => (
    '<li style="list-style:none"><img src="' + escapeHtml(item) + '" alt="' + escapeHtml(product.name)
      + (index ? ' - صورة ' + (index + 1) : '') + '" width="720" height="720" '
      + (index ? 'loading="lazy"' : '')
      + ' style="display:block;width:100%;aspect-ratio:1;object-fit:contain;background:#fff"></li>'
  )).join('');
  const specs = specifications.length > 0
    ? '<section style="margin-top:32px"><h2>المواصفات</h2><dl>'
      + specifications.map(([name, value]) => (
        '<div style="display:flex;justify-content:space-between;gap:24px;padding:12px 0;border-bottom:1px solid #eee">'
        + '<dt>' + escapeHtml(name) + '</dt><dd style="font-weight:700;margin:0">' + escapeHtml(value) + '</dd></div>'
      )).join('')
      + '</dl></section>'
    : '';
  const details = [
    ['محتويات العبوة', product.package_contents],
    ['التجهيز والشحن', product.preparation_time],
    ['الاستبدال والاسترجاع', product.return_policy],
  ].filter(([, value]) => value)
    .map(([title, value]) => (
      '<section style="padding:20px 0;border-top:1px solid #eee"><h2 style="font-size:20px">' + title
      + '</h2><p style="color:#625d59;line-height:1.9;white-space:pre-line">' + escapeHtml(value) + '</p></section>'
    )).join('');

  return '<main id="seo-static-content" style="font-family:Tajawal,Arial,sans-serif;direction:rtl;max-width:1180px;margin:0 auto;padding:32px 20px;color:#171717">'
    + '<header style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ddd;padding-bottom:20px">'
    + '<a href="/" style="font-weight:800;color:#171717;text-decoration:none">لحظة فن Art Moment</a><a href="/store/cart" style="color:#171717">السلة</a></header>'
    + '<nav aria-label="مسار التنقل" style="margin:24px 0;font-size:14px"><a href="/">الرئيسية</a><span aria-hidden="true"> / </span>'
    + '<a href="/store">المتجر</a><span aria-hidden="true"> / </span><span aria-current="page">' + escapeHtml(product.name) + '</span></nav>'
    + '<article style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:40px;align-items:start"><section>'
    + '<ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;padding:0;margin:0">'
    + (gallery || '<li style="list-style:none;background:#f6f3f0;aspect-ratio:1"></li>') + '</ul></section><section>'
    + '<p style="color:#b97882;font-weight:800">' + escapeHtml(productCategoryLabel(product.category)) + '</p>'
    + '<h1 style="font-size:40px;line-height:1.3;margin:12px 0">' + escapeHtml(product.name) + '</h1>'
    + '<p style="font-size:30px;font-weight:900;color:#c6a56b">' + price + ' ر.س</p>'
    + '<p style="display:inline-block;padding:8px 12px;background:' + (available ? '#ecfdf5' : '#fff1f2')
    + ';color:' + (available ? '#047857' : '#dc2626') + ';font-weight:800">' + stockLabel + '</p>'
    + '<p style="font-size:16px;line-height:1.9;color:#625d59">' + escapeHtml(product.description || page.description) + '</p>'
    + '<a href="' + escapeHtml(page.path) + '" style="display:inline-block;margin-top:20px;padding:14px 24px;background:#171717;color:#fff;font-weight:800;text-decoration:none">'
    + 'عرض الخيارات وإضافة المنتج للسلة</a>' + specs + details + '</section></article></main>';
}

function productStructuredData(product, page) {
  const images = page.image ? [page.image] : [];
  const hasTrackedStock = product.stock_quantity !== null && product.stock_quantity !== undefined;
  const stock = Number(product.stock_quantity || 0);
  const available = product.in_stock !== false && (!hasTrackedStock || stock > 0);
  const canonical = new URL(page.path, siteUrl).toString();
  const productNode = {
    '@type': 'Product',
    '@id': canonical + '#product',
    name: product.name,
    description: product.description || page.description,
    image: images,
    sku: String(product.id),
    category: productCategoryLabel(product.category),
    offers: {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: 'SAR',
      price: Number(product.price || 0).toFixed(2),
      availability: available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
  if (product.product_group_code) {
    productNode.isVariantOf = {
      '@type': 'ProductGroup',
      productGroupID: product.product_group_code,
      name: product.name,
    };
  }
  return [
    productNode,
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: siteUrl + '/' },
        { '@type': 'ListItem', position: 2, name: 'المتجر', item: siteUrl + '/store' },
        { '@type': 'ListItem', position: 3, name: product.name, item: canonical },
      ],
    },
  ];
}
const products = await fetchCatalogProducts();

for (const page of pages) {
  let html = replaceMeta(template, page);
  html = html.replace('<div id="root"></div>', `${staticContent(page, products)}<div id="root"></div>`);
  const output = page.path === '/'
    ? join(dist, 'index.html')
    : join(dist, page.path.slice(1), 'index.html');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html, 'utf8');
}

for (const product of products) {
  if (!product || !product.id || !String(product.name || '').trim()) continue;
  product.name = String(product.name).trim();
  const encodedId = encodeURIComponent(String(product.id));
  const description = String(product.description || ('تعرّف على ' + product.name + ' من متجر لحظة فن، مع السعر والتوفر وتفاصيل المنتج.'))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  const shareImage = await materializeProductImage(product);
  const productPage = {
    path: '/store/products/' + encodedId,
    title: product.name + ' | متجر لحظة فن',
    description,
    image: shareImage,
    type: 'product',
  };
  let html = replaceMeta(template, productPage);
  html = appendStructuredData(html, productStructuredData(product, productPage));
  html = html.replace('<div id="root"></div>', productStaticContent(product, productPage) + '<div id="root"></div>');
  const output = join(dist, 'store', 'products', encodedId, 'index.html');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html, 'utf8');
}
const adminShell = replaceMeta(template, {
  path: '/admin/login',
  title: 'تسجيل دخول المسؤول | لحظة فن',
  description: 'منطقة إدارية خاصة ومحمية لمنصة لحظة فن.',
  noindex: true,
  nofollow: true,
});
await writeFile(join(dist, 'admin-shell.html'), adminShell, 'utf8');
