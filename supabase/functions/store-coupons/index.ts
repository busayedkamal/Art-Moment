import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { calculateStoreCouponDiscount } from '../_shared/storeCoupons.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { recalculatePrintDraft, verifyPrintDraftAccess } from '../_shared/printDrafts.ts';

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  try {
    const body = await req.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    const normalizedItems = items
      .filter((item: Record<string, unknown>) => item.itemType !== 'print')
      .map((item: Record<string, unknown>) => ({
        product_id: Number(item.id || item.product_id),
        quantity: Math.max(1, Number(item.qty || item.quantity || 1)),
      }))
      .filter((item: { product_id: number; quantity: number }) => Number.isFinite(item.product_id) && item.quantity > 0);

    const printItems = items
      .filter((item: Record<string, unknown>) => item.itemType === 'print')
      .map((item: Record<string, unknown>) => ({
        draftId: String(item.printDraftId || ''),
        accessToken: String(item.printDraftToken || ''),
      }))
      .filter((item: { draftId: string; accessToken: string }) => item.draftId && item.accessToken);

    if (normalizedItems.length === 0 && printItems.length === 0) {
      return jsonResponse({ error: 'empty_cart' }, 400);
    }

    const supabase = getServiceClient();
    const productIds = normalizedItems.map((item: { product_id: number }) => item.product_id);
    let products: Array<Record<string, unknown>> = [];
    if (productIds.length > 0) {
      const productResult = await supabase
        .from('products')
        .select('id, price, in_stock, stock_quantity')
        .in('id', productIds);
      if (productResult.error) throw productResult.error;
      products = productResult.data || [];
    }

    const productById = new Map((products || []).map((product: Record<string, unknown>) => [String(product.id), product]));
    let subtotal = 0;

    normalizedItems.forEach((item: { product_id: number; quantity: number }) => {
      const product = productById.get(String(item.product_id));
      if (!product || product.in_stock === false) throw new Error('product_unavailable');

      const stockQuantity = product.stock_quantity;
      if (stockQuantity !== null && stockQuantity !== undefined && Number(stockQuantity) < item.quantity) {
        throw new Error('product_out_of_stock');
      }

      subtotal += Number(product.price || 0) * item.quantity;
    });

    for (const printItem of printItems) {
      const draft = await verifyPrintDraftAccess(supabase, printItem.draftId, printItem.accessToken);
      const summary = await recalculatePrintDraft(supabase, draft.id);
      if (summary.draft.status !== 'ready') throw new Error('print_draft_not_ready');
      subtotal += Number(summary.draft.subtotal || 0);
    }

    const coupon = await calculateStoreCouponDiscount(supabase, body?.code, subtotal);
    if (!coupon) return jsonResponse({ error: 'missing_coupon' }, 400);

    return jsonResponse({ coupon });
  } catch (error) {
    console.error('store-coupons error:', error);
    const message = error instanceof Error ? error.message : 'coupon_validation_failed';
    const status = ['invalid_coupon', 'missing_coupon', 'empty_cart'].includes(message)
      ? 400
      : ['product_unavailable', 'product_out_of_stock'].includes(message)
        ? 409
        : 500;
    return jsonResponse({ error: message }, status);
  }
});
