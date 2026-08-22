import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1));
const read = (path) => readFile(join(root, path), 'utf8');
const checks = [];

function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail });
}

const [
  trackHtml,
  ordersHtml,
  vercelText,
  trackPage,
  ordersPage,
  trackFunction,
  checkoutFunction,
  migration,
] = await Promise.all([
  read('dist/track/index.html'),
  read('dist/store/orders/index.html'),
  read('vercel.json'),
  read('src/pages/TrackOrderPage.jsx'),
  read('src/pages/CustomerOrdersPage.jsx'),
  read('supabase/functions/track-order/index.ts'),
  read('supabase/functions/store-checkout/index.ts'),
  read('supabase/migrations/202608210001_secure_order_tracking.sql'),
]);

check('Track HTML title', trackHtml.includes('<title>تتبع طلبك | لحظة فن</title>'));
check('Track HTML H1', /<h1[^>]*>تتبع طلبك<\/h1>/.test(trackHtml));
check('Track robots', trackHtml.includes('name="robots" content="noindex,follow"'));
check('Orders HTML title', ordersHtml.includes('<title>طلباتي | لحظة فن</title>'));
check('Orders HTML H1', /<h1[^>]*>طلباتي<\/h1>/.test(ordersHtml));
check('Orders robots', ordersHtml.includes('name="robots" content="noindex,nofollow"'));

const vercel = JSON.parse(vercelText);
const rewrites = vercel.rewrites || [];
const trackRewrite = rewrites.findIndex((item) => item.source === '/track');
const ordersRewrite = rewrites.findIndex((item) => item.source === '/store/orders');
const dynamicOrdersRewrite = rewrites.findIndex((item) => item.source === '/store/orders/:orderId');
const catchAllRewrite = rewrites.findIndex((item) => item.source === '/(.*)');
check('Track rewrite before catch-all', trackRewrite >= 0 && trackRewrite < catchAllRewrite);
check('Orders rewrite before catch-all', ordersRewrite >= 0 && ordersRewrite < catchAllRewrite);
check('Order detail rewrite before list', dynamicOrdersRewrite >= 0 && dynamicOrdersRewrite < ordersRewrite);

check('Track requires full order and token', trackFunction.includes("eq('tracking_access_token', trackingToken)") && trackFunction.includes("eq('short_id', orderNumber)") && !trackFunction.includes("orderNumber.slice(0, 6)"));
check('Track rate limit enabled', trackFunction.includes("from('public_tracking_attempts')") && trackFunction.includes('>= 10'));
check('Track uses generic mismatch', trackFunction.includes("error: 'tracking_not_found'"));
check('Track has no public history credentials', !/body\?\.phone|body\?\.pin/.test(trackFunction));
check('Account history requires customer session', trackFunction.includes('verifyCustomerSessionToken(sessionToken)') && trackFunction.includes("String(body?.mode || '') === 'history'") && trackPage.includes('getCustomerSession'));
check('Track UI has two credentials', trackPage.includes('orderNumber') && trackPage.includes('trackingToken') && !trackPage.includes('رقم الجوال المسجل'));
check('Track UI restores secure history tab', trackPage.includes("historyTab: 'سجل طلباتي'") && trackPage.includes('CustomerAuthModal'));
check('Tracking token stays out of URL', !trackPage.includes('useSearchParams') && !trackPage.includes('setParams'));
check('Orders page is private', ordersPage.includes('noindex') && ordersPage.includes('nofollow') && ordersPage.includes('sessionToken'));
check('Orders filters present', ordersPage.includes("orderFilter === 'current'") && ordersPage.includes("orderFilter === 'completed'"));
check('Checkout returns tracking token', checkoutFunction.includes('tracking_token: trackingToken'));
check('Checkout does not expose customer PIN', !checkoutFunction.includes('customer_pin:'));
check('Secure tokens cover both order tables', migration.includes('alter table public.orders') && migration.includes('alter table public.store_orders'));
check('Status history trigger included', migration.includes('store_orders_status_history_trigger'));

const publicLookupBlock = trackFunction.match(/const \[printResult, storeResult\][\s\S]*?const matched/)?.[0] || '';
const selectFragments = [...publicLookupBlock.matchAll(/\.select\('([^']+)'/g)].map((match) => match[1]);
const forbiddenPublicFields = ['phone', 'email', 'customer_name', 'city', 'district', 'street', 'building_number', 'postal_code', 'image', 'metadata', 'original', 'preview'];
const leakedField = selectFragments.flatMap((fragment) => forbiddenPublicFields.filter((field) => new RegExp('(^|[, ])' + field + '([, )]|$)', 'i').test(fragment)));
check('Public tracking selects no personal or image fields', leakedField.length === 0, leakedField.join(', '));

const failed = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log((item.ok ? 'PASS' : 'FAIL') + '  ' + item.name + (item.detail ? ' - ' + item.detail : ''));
}
if (failed.length > 0) {
  console.error('\nTracking release gate failed: ' + failed.length + ' check(s).');
  process.exit(1);
}
console.log('\nTracking release gate passed: ' + checks.length + ' checks.');
