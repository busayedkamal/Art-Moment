import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const template = await readFile(join(dist, 'index.html'), 'utf8');
const siteUrl = 'https://art-moment.com';

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
    description: 'اختر مقاس الطباعة وارفع صورك وراجع العدد والسعر قبل إضافة طلب الطباعة إلى السلة.',
    heading: 'اطبع صورك بخطوات واضحة',
    body: 'اختر المقاس، ارفع الصور، راجع الدقة والكمية ثم أكمل طلبك.',
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
    description: 'اطبع صور الجوال والكاميرا بمقاسات عملية وجودة ألوان واضحة، مع مراجعة الملفات قبل تجهيز الطلب.',
    heading: 'طباعة الصور بجودة تحفظ لحظاتك',
    body: 'ابدأ باختيار المقاس، ارفع صورك، ثم راجع العدد والسعر قبل إضافة طلب الطباعة إلى السلة.',
    links: [['/print', 'ابدأ الطباعة'], ['/photo-print-sizes', 'تعرف على المقاسات']],
  },
  {
    path: '/photographic-printing',
    title: 'طباعة الصور الفوتوغرافية | لحظة فن',
    description: 'طباعة فوتوغرافية للألبومات والإطارات والذكريات اليومية مع مراجعة دقة الملفات.',
    heading: 'طباعة الصور الفوتوغرافية',
    body: 'مطبوعات للألبومات والإطارات مع تنبيه للدقة المنخفضة قبل التنفيذ.',
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
];

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
  ];
  return replacements.reduce((result, [pattern, value]) => result.replace(pattern, value), html);
}

function staticContent(page) {
  const links = page.links.map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`).join('');
  return `<main id="seo-static-content" style="font-family:Tajawal,Arial,sans-serif;direction:rtl;max-width:1180px;margin:0 auto;padding:48px 24px;color:#171717"><header style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ddd;padding-bottom:20px"><a href="/" style="font-weight:900;color:#171717;text-decoration:none">لحظة فن Art Moment</a><a href="/store/cart" style="color:#171717">السلة</a></header><section style="padding:64px 0"><h1 style="font-size:clamp(32px,6vw,64px);line-height:1.2;margin:0 0 20px">${escapeHtml(page.heading)}</h1><p style="max-width:720px;line-height:2;color:#555">${escapeHtml(page.body)}</p><nav style="display:flex;flex-wrap:wrap;gap:12px;margin-top:28px">${links}</nav></section></main>`;
}

for (const page of pages) {
  let html = replaceMeta(template, page);
  html = html.replace('<div id="root"></div>', `${staticContent(page)}<div id="root"></div>`);
  const output = page.path === '/'
    ? join(dist, 'index.html')
    : join(dist, page.path.slice(1), 'index.html');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html, 'utf8');
}
