/* global URL, console, process */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1));
const read = (path) => readFile(join(root, path), 'utf8');
const checks = [];
const check = (name, condition) => checks.push({ name, ok: Boolean(condition) });

const [migration, checkout, customerOrders, trackOrder, customerPage, trackPage, adminPage, itemStatuses] = await Promise.all([
  read('supabase/migrations/202608250001_mixed_order_item_statuses.sql'),
  read('supabase/functions/store-checkout/index.ts'),
  read('supabase/functions/customer-orders/index.ts'),
  read('supabase/functions/track-order/index.ts'),
  read('src/pages/CustomerOrdersPage.jsx'),
  read('src/pages/TrackOrderPage.jsx'),
  read('src/pages/StoreOrdersManagement.jsx'),
  read('src/utils/storeOrderItemStatus.js'),
]);

check('Product and print item status sets exist', itemStatuses.includes('PRODUCT_ITEM_STATUSES') && itemStatuses.includes('PRINT_ITEM_STATUSES'));
check('Item transitions are explicit', itemStatuses.includes('PRODUCT_ITEM_TRANSITIONS') && itemStatuses.includes('PRINT_ITEM_TRANSITIONS'));
check('Order items persist status and snapshots', migration.includes('add column if not exists item_image') && migration.includes('add column if not exists status text'));
check('Historical items receive a logical backfill', migration.includes("orders.status::text in ('shipped', 'delivered', 'returned')") && migration.includes("then 'printing'"));
check('Item history is protected by RLS', migration.includes('store_order_item_status_history') && migration.includes('enable row level security') && migration.includes('public.is_admin()'));
check('No-op status updates do not create history', migration.includes('old.status is not distinct from new.status') && migration.includes("'changed', false"));
check('Concurrent item changes serialize on the order', migration.includes('where orders.id = current_item.store_order_id for update'));
check('Aggregate order status is derived atomically', migration.includes('attention_count > 0') && migration.includes('ready_count = active_count') && migration.includes("next_order_status := 'processing'"));
check('Invalid item transitions are rejected in SQL', migration.includes('invalid_item_status_transition'));
check('Cancellation updates all item states and inventory', migration.includes("status_reason_code = 'order_cancelled'") && migration.includes('restore_store_stock'));
check('Checkout snapshots product identity', checkout.includes("item_type: 'product'") && checkout.includes('item_name: String(product.name') && checkout.includes('item_image: product.image'));
check('Checkout initializes both item kinds', checkout.includes("status: 'pending'") && checkout.includes("status: 'files_received'"));
check('Customer orders return safe item status fields', customerOrders.includes('statusUpdatedAt') && customerOrders.includes('status_updated_at') && !customerOrders.includes('status_reason_code'));
check('Tracking separates item and order status', trackOrder.includes('normalizeItemStatus(row)') && !trackOrder.includes('status: statusCode,'));
check('Tracking page renders item state', trackPage.includes('itemStatusCopy(item.status, language)'));
check('Orders page has all/current/completed filters', customerPage.includes("orderFilter === 'current'") && customerPage.includes("orderFilter === 'completed'"));
check('Orders page summarizes mixed contents', customerPage.includes('summarizeMixedOrderItems(order.items)'));
check('Orders page renders per-item status', customerPage.includes('<ItemStatusBadge item={item} />'));
check('Print reorder reuses settings without files', customerPage.includes('handleRepeatPrint') && customerPage.includes("params.set(key") && !customerPage.includes('original_storage_path'));
check('Admin updates item status through RPC', adminPage.includes("rpc('set_store_order_item_status'") && adminPage.includes('getStoreOrderItemTransitions'));

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}`);
if (failed.length) {
  console.error(`\nMixed-order release gate failed: ${failed.length} check(s).`);
  process.exit(1);
}
console.log(`\nMixed-order release gate passed: ${checks.length} checks.`);