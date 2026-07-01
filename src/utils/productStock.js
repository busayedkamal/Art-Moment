export function normalizeStockQuantity(value) {
  const stock = Number(value);
  return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : null;
}

export function getAvailableStock(product) {
  if (!product) return null;
  return normalizeStockQuantity(product.stockQuantity ?? product.stock_quantity);
}

export function isProductAvailable(product) {
  const stock = getAvailableStock(product);
  return product?.inStock !== false && (stock === null || stock > 0);
}

export function canAddProductToCart(product, currentQty = 0) {
  if (!isProductAvailable(product)) return false;
  const stock = getAvailableStock(product);
  return stock === null || Number(currentQty || 0) < stock;
}

export function clampCartQuantity(product, requestedQty) {
  const parsedQty = Number.parseInt(requestedQty, 10);
  const qty = Number.isFinite(parsedQty) ? Math.max(1, parsedQty) : 1;
  const stock = getAvailableStock(product);
  return stock === null ? qty : Math.min(qty, stock);
}

export function getStockLabel(product) {
  const stock = getAvailableStock(product);
  if (stock === null) return '\u0627\u0644\u0643\u0645\u064a\u0629 \u0645\u062a\u0627\u062d\u0629';
  if (stock <= 0) return '\u0646\u0641\u062f\u062a \u0627\u0644\u0643\u0645\u064a\u0629';
  return `\u0627\u0644\u0645\u062a\u0648\u0641\u0631: ${stock}`;
}
