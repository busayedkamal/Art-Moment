/* global console, process */
import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const productRoot = join(dist, 'store', 'products');
const source = await readFile(join(root, 'src', 'pages', 'ProductDetailsPage.jsx'), 'utf8');
const optionsSource = await readFile(join(root, 'src', 'utils', 'productOptions.js'), 'utf8');
const checkoutSource = await readFile(join(root, 'supabase', 'functions', 'store-checkout', 'index.ts'), 'utf8');
const failures = [];
const passes = [];
const manual = [];

const pass = (label) => passes.push(label);
const fail = (label) => failures.push(label);
const decode = (value = '') => value
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>');
const getMeta = (html, property, value) => {
  const key = property === 'name' ? 'name' : 'property';
  const pattern = new RegExp(`<meta\\s+${key}="${value}"\\s+content="([^"]*)"\\s*/?>`, 'i');
  return decode(html.match(pattern)?.[1] || '');
};
const getLink = (html, rel) => decode(html.match(new RegExp(`<link\\s+rel="${rel}"\\s+href="([^"]*)"\\s*/?>`, 'i'))?.[1] || '');
const getTitle = (html) => decode(html.match(/<title>(.*?)<\/title>/is)?.[1] || '');
const getH1 = (html) => decode((html.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1] || '').replace(/<[^>]+>/g, '').trim());
const getJsonLdNodes = (html) => [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>(.*?)<\/script>/gis)]
  .flatMap((match) => {
    try {
      const parsed = JSON.parse(match[1]);
      return Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [parsed];
    } catch {
      return [];
    }
  });

const entries = (await readdir(productRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory());
if (entries.length === 0) fail('Static product pages were generated');

let availableCount = 0;
let unavailableCount = 0;
let product14Found = false;
for (const entry of entries) {
  const id = entry.name;
  const html = await readFile(join(productRoot, id, 'index.html'), 'utf8');
  const title = getTitle(html);
  const description = getMeta(html, 'name', 'description');
  const canonical = getLink(html, 'canonical');
  const ogTitle = getMeta(html, 'property', 'og:title');
  const ogDescription = getMeta(html, 'property', 'og:description');
  const ogUrl = getMeta(html, 'property', 'og:url');
  const ogImage = getMeta(html, 'property', 'og:image');
  const h1 = getH1(html);
  const productNode = getJsonLdNodes(html).find((node) => node?.['@type'] === 'Product');
  const expectedUrl = `https://art-moment.com/store/products/${encodeURIComponent(id)}`;

  if (!title || title !== ogTitle) fail(`Product ${id}: title and og:title match`);
  if (!description || description !== ogDescription) fail(`Product ${id}: description and og:description match`);
  if (canonical !== expectedUrl || ogUrl !== expectedUrl) fail(`Product ${id}: canonical and og:url are clean`);
  if (!ogImage.endsWith(`/seo/products/${encodeURIComponent(id)}-share.jpg`)) fail(`Product ${id}: product-specific share image`);
  if (!productNode || productNode.name !== h1) fail(`Product ${id}: Product JSON-LD name matches H1`);
  if (!productNode?.offers?.price || !productNode?.offers?.availability) fail(`Product ${id}: Product offer is complete`);

  const shareFile = join(dist, 'seo', 'products', `${encodeURIComponent(id)}-share.jpg`);
  try {
    await access(shareFile);
    const metadata = await sharp(shareFile).metadata();
    if (metadata.width !== 1200 || metadata.height !== 630) fail(`Product ${id}: share image is 1200x630`);
  } catch {
    fail(`Product ${id}: share image file exists`);
  }

  if (productNode?.offers?.availability === 'https://schema.org/InStock') availableCount += 1;
  if (productNode?.offers?.availability === 'https://schema.org/OutOfStock') unavailableCount += 1;
  if (String(id) === '14') product14Found = true;
}

if (availableCount > 0) pass(`Available product fixture found (${availableCount})`); else fail('Available product fixture exists');
if (unavailableCount > 0) pass(`Out-of-stock product fixture found (${unavailableCount})`); else manual.push('Create or select one fully out-of-stock product and verify its disabled CTA.');
if (product14Found) pass('Bundle product 14 static page found'); else manual.push('Bundle product 14 is not present in the build catalog.');

const requiredEvents = [
  'product_share_open', 'product_share_whatsapp', 'product_share_telegram',
  'product_share_email', 'product_share_copy',
];
if (requiredEvents.every((event) => source.includes(event))) pass('All five product-share events are wired'); else fail('All five product-share events are wired');
if (source.includes("productUrl + '?ref=share'") && source.includes('path={`/store/products/${product.id}`}')) pass('Shared ref and clean canonical are separated'); else fail('Shared ref and clean canonical are separated');
if (source.includes('navigator.share') && source.includes('setIsShareOpen')) pass('Native share and desktop fallback are wired'); else fail('Native share and desktop fallback are wired');
if (source.includes('fixed inset-x-0 bottom-0') && source.includes('lg:hidden')) pass('Mobile sticky CTA is present'); else fail('Mobile sticky CTA is present');
if (source.includes('setIsImageOpen(true)') && source.includes('showAdjacentImage')) pass('Gallery zoom and image navigation are present'); else fail('Gallery zoom and image navigation are present');
if (optionsSource.includes('valueObject.available !== false') && checkoutSource.includes('product_option_unavailable')) pass('Unavailable variants are blocked client and server side'); else fail('Unavailable variants are blocked client and server side');
if (source.includes('selectedOptions: normalizedSelections') && source.includes('selectedOptionLabels: selectedLabels')) pass('Selected variant snapshot is stored in cart'); else fail('Selected variant snapshot is stored in cart');

manual.push('Verify native share on one iPhone and one Android device.');
manual.push('Open a ?ref=share link in a fresh browser session and confirm product_view source=share.');
manual.push('Select an unavailable variant in admin data, then confirm it is disabled on the product page.');
manual.push('Use the mobile sticky CTA and swipe/touch through the second and third gallery images on a real phone.');

console.log(`Product Detail release gate: ${entries.length} static product pages checked.`);
passes.forEach((label) => console.log(`PASS  ${label}`));
manual.forEach((label) => console.log(`MANUAL  ${label}`));
if (failures.length > 0) {
  failures.forEach((label) => console.error(`FAIL  ${label}`));
  process.exitCode = 1;
} else {
  console.log('Automated Product Detail checks passed.');
}