import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPrintOrderFinancials } from '../src/utils/orderFinancials.js';
import { getPrintUnitPrice } from '../supabase/functions/_shared/printDrafts.ts';

test('mixed print invoice includes all three sizes at their saved prices', () => {
  const result = getPrintOrderFinancials({
    photo_4x6_qty: 10, photo_4x6_unit_price: 1,
    a4_qty: 2, a4_unit_price: 5, a5_qty: 3, a5_unit_price: 2.5,
    subtotal: 27.5, delivery_fee: 5, total_amount: 30.5,
    direct_discount_amount: 2, points_used_amount: 3, deposit: 20,
  });
  assert.deepEqual(result.lineItems.map(({ key, lineTotal }) => [key, lineTotal]), [
    ['photo_4x6', 10], ['a4', 10], ['a5', 7.5],
  ]);
  assert.equal(result.remainingAmount, 7.5);
  assert.equal(result.totalDiscount, 2);
});

test('legacy orders retain their original two-size calculation', () => {
  const result = getPrintOrderFinancials({
    photo_4x6_qty: 10, a4_qty: 2, a4_unit_price: 5, subtotal: 20, total_amount: 20,
  });
  assert.equal(result.lineItems.length, 2);
  assert.equal(result.lineItems[0].unitPrice, 1);
});

test('unknown prices in a mixed A5 order are not inferred from other sizes', () => {
  const result = getPrintOrderFinancials({
    photo_4x6_qty: 10, a4_qty: 2, a4_unit_price: 5, a5_qty: 3,
    subtotal: 27.5, total_amount: 27.5,
  });
  assert.equal(result.lineItems[0].unitPrice, null);
  assert.equal(result.lineItems.find(item => item.key === 'a5').unitPrice, null);
});

test('A5-only historical invoices can reconstruct their unit price', () => {
  const result = getPrintOrderFinancials({ a5_qty: 3, subtotal: 7.5, total_amount: 7.5 });
  assert.equal(result.lineItems[0].unitPrice, 2.5);
});

function client(a5Price, variant = { pricing_mode: 'existing_a5', is_active: true, is_available: true }) {
  return { from(table) {
    return {
      select() { return this; },
      eq() { return this; },
      async maybeSingle() {
        return { data: table === 'settings' ? {
          a5_price: a5Price, a4_price: 5, photo_4x6_price: 1,
          is_dynamic_pricing_enabled: true, tier_1_limit: 20, tier_1_price: 0.5,
        } : variant, error: null };
      },
    };
  } };
}

test('A5 pricing uses its setting and is independent of 4x6 quantity tiers', async () => {
  assert.equal(await getPrintUnitPrice(client(2.5), 'A5', 5, 'a5-test'), 2.5);
  assert.equal(await getPrintUnitPrice(client(2.5), 'A5', 500, 'a5-test'), 2.5);
  assert.equal(await getPrintUnitPrice(client(2.5), 'A5', 5), 2.5);
});

test('unpriced A5 is rejected rather than priced as 4x6', async () => {
  await assert.rejects(getPrintUnitPrice(client(0), 'A5', 5, 'a5-test'), /print_variant_unavailable/);
  await assert.rejects(getPrintUnitPrice(client(0), 'A5', 5), /print_variant_unavailable/);
});

test('custom and unavailable A5 variants preserve their own rules', async () => {
  assert.equal(await getPrintUnitPrice(client(2.5, {
    pricing_mode: 'fixed', unit_price: 7, is_active: true, is_available: true,
  }), 'A5', 5, 'custom'), 7);
  await assert.rejects(getPrintUnitPrice(client(2.5, {
    pricing_mode: 'existing_a5', is_active: true, is_available: false,
  }), 'A5', 5, 'disabled'), /print_variant_unavailable/);
});
