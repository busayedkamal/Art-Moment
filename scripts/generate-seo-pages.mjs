/* global AbortSignal, console, fetch */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { loadEnv } from 'vite';

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
  const replacements = [
    [/<title>.*?<\/title>/s, `<title>${escapeHtml(page.title)}</title>`],
    [/<meta name="description" content=".*?"\s*\/>/s, `<meta name="description" content="${escapeHtml(page.description)}" />`],
    [/<link rel="canonical" href=".*?"\s*\/>/s, `<link rel="canonical" href="${canonical}" />`],
    [/<meta property="og:title" content=".*?"\s*\/>/s, `<meta property="og:title" content="${escapeHtml(page.title)}" />`],
    [/<meta property="og:description" content=".*?"\s*\/>/s, `<meta property="og:description" content="${escapeHtml(page.description)}" />`],
    [/<meta property="og:url" content=".*?"\s*\/>/s, `<meta property="og:url" content="${canonical}" />`],
    [/<meta name="twitter:title" content=".*?"\s*\/>/s, `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`],
    [/<meta name="twitter:description" content=".*?"\s*\/>/s, `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`],
    [/<meta name="robots" content=".*?"\s*\/>/s, `<meta name="robots" content="${page.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'}" />`],
  ];
  return replacements.reduce((result, [pattern, value]) => result.replace(pattern, value), html);
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
