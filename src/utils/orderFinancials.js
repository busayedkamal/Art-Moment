const MONEY_EPSILON = 0.005;

export function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function positiveMoney(value) {
  return Math.max(0, roundMoney(value));
}

function hasField(record, field) {
  return Object.prototype.hasOwnProperty.call(record || {}, field);
}

export function extractOrderCouponCode(order = {}) {
  if (order.coupon_code) return String(order.coupon_code).trim();

  const notes = String(order.notes || '');
  const match = notes.match(/(?:تم\s+استخدام\s+كوبون|كوبون)\s*:\s*([^|]+)/i);
  return match?.[1]?.trim() || null;
}

function transactionTotal(transactions, type) {
  return roundMoney(
    (transactions || [])
      .filter((transaction) => transaction?.type === type)
      .reduce((sum, transaction) => sum + Number(transaction.amount_value || 0), 0),
  );
}

function buildPrintLineItems(order, subtotal) {
  const photoQty = Number(order.photo_4x6_qty || 0);
  const a4Qty = Number(order.a4_qty || 0);
  const albumQty = Number(order.album_qty || 0);
  const albumUnitPrice = positiveMoney(order.album_price);
  const albumTotal = roundMoney(albumQty * albumUnitPrice);

  let photoUnitPrice = Number(order.photo_4x6_unit_price);
  let a4UnitPrice = Number(order.a4_unit_price);
  photoUnitPrice = Number.isFinite(photoUnitPrice) && photoUnitPrice > 0 ? roundMoney(photoUnitPrice) : null;
  a4UnitPrice = Number.isFinite(a4UnitPrice) && a4UnitPrice > 0 ? roundMoney(a4UnitPrice) : null;

  const availablePhotosTotal = Math.max(0, roundMoney(subtotal - albumTotal));

  if (photoQty > 0 && a4Qty === 0 && !photoUnitPrice) {
    photoUnitPrice = roundMoney(availablePhotosTotal / photoQty);
  }
  if (a4Qty > 0 && photoQty === 0 && !a4UnitPrice) {
    a4UnitPrice = roundMoney(availablePhotosTotal / a4Qty);
  }
  if (photoQty > 0 && a4Qty > 0) {
    if (photoUnitPrice && !a4UnitPrice) {
      a4UnitPrice = roundMoney((availablePhotosTotal - photoQty * photoUnitPrice) / a4Qty);
    } else if (a4UnitPrice && !photoUnitPrice) {
      photoUnitPrice = roundMoney((availablePhotosTotal - a4Qty * a4UnitPrice) / photoQty);
    }
  }

  const lineItems = [];
  if (photoQty > 0) {
    lineItems.push({
      key: 'photo_4x6',
      label: 'طباعة صور 4×6',
      quantity: photoQty,
      unitPrice: photoUnitPrice,
      lineTotal: photoUnitPrice ? roundMoney(photoQty * photoUnitPrice) : null,
    });
  }
  if (a4Qty > 0) {
    lineItems.push({
      key: 'a4',
      label: 'طباعة صور A4',
      quantity: a4Qty,
      unitPrice: a4UnitPrice,
      lineTotal: a4UnitPrice ? roundMoney(a4Qty * a4UnitPrice) : null,
    });
  }
  if (albumQty > 0) {
    lineItems.push({
      key: 'album',
      label: 'ألبومات صور',
      quantity: albumQty,
      unitPrice: albumUnitPrice,
      lineTotal: albumTotal,
    });
  }

  return lineItems;
}

export function getPrintOrderFinancials(order = {}, transactions = []) {
  const subtotal = positiveMoney(order.subtotal);
  const deliveryFee = positiveMoney(order.delivery_fee);
  const grossAmount = roundMoney(subtotal + deliveryFee);
  const totalAmount = positiveMoney(order.total_amount);
  const recordedReduction = Math.max(0, roundMoney(grossAmount - totalAmount));
  const couponCode = extractOrderCouponCode(order);
  const transactionPoints = transactionTotal(transactions, 'redeem');
  const transactionPackages = transactionTotal(transactions, 'package_redeem');
  const hasExplicitBreakdown = [
    'direct_discount_amount',
    'coupon_discount_amount',
    'package_discount_amount',
    'points_used_amount',
  ].some((field) => hasField(order, field));

  let directDiscount;
  let couponDiscount;
  let packageDiscount;
  let pointsUsed;

  if (hasExplicitBreakdown) {
    directDiscount = positiveMoney(order.direct_discount_amount);
    couponDiscount = positiveMoney(order.coupon_discount_amount);
    packageDiscount = positiveMoney(order.package_discount_amount);
    pointsUsed = hasField(order, 'points_used_amount')
      ? positiveMoney(order.points_used_amount)
      : positiveMoney(transactionPoints || order.wallet_used);
  } else {
    const legacyDiscount = positiveMoney(order.manual_discount ?? order.discount);
    packageDiscount = Math.min(recordedReduction, positiveMoney(transactionPackages));
    couponDiscount = couponCode
      ? Math.min(recordedReduction - packageDiscount, legacyDiscount || recordedReduction)
      : 0;
    directDiscount = Math.max(0, roundMoney(legacyDiscount - couponDiscount - packageDiscount));
    pointsUsed = positiveMoney(transactionPoints || Math.max(0, Number(order.wallet_used || 0) - transactionPackages));
  }

  const discounts = [];
  if (directDiscount > MONEY_EPSILON) {
    discounts.push({ key: 'direct', label: 'خصم مباشر', amount: directDiscount });
  }
  if (couponDiscount > MONEY_EPSILON) {
    discounts.push({
      key: 'coupon',
      label: couponCode ? `خصم كود ${couponCode}` : 'خصم كود',
      amount: couponDiscount,
      code: couponCode,
    });
  }
  if (packageDiscount > MONEY_EPSILON) {
    discounts.push({ key: 'package', label: 'خصم رصيد الباقة', amount: packageDiscount });
  }

  const classifiedDiscount = roundMoney(
    discounts.reduce((sum, discount) => sum + discount.amount, 0),
  );
  const expectedTotal = roundMoney(grossAmount - classifiedDiscount);
  const reconciliationAmount = roundMoney(totalAmount - expectedTotal);
  if (reconciliationAmount < -MONEY_EPSILON) {
    discounts.push({
      key: 'legacy_adjustment',
      label: 'خصم أو تسوية سابقة غير مصنفة',
      amount: Math.abs(reconciliationAmount),
      isReconciliation: true,
    });
  }

  const cashPaid = positiveMoney(order.deposit ?? order.paid_amount);
  const paidAmount = roundMoney(cashPaid + pointsUsed);
  const remainingAmount = Math.max(0, roundMoney(totalAmount - paidAmount));
  const overpaidAmount = Math.max(0, roundMoney(paidAmount - totalAmount));

  return {
    lineItems: buildPrintLineItems(order, subtotal),
    subtotal,
    deliveryFee,
    grossAmount,
    directDiscount,
    couponDiscount,
    couponCode,
    packageDiscount,
    discounts,
    totalDiscount: roundMoney(discounts.reduce((sum, discount) => sum + discount.amount, 0)),
    totalAmount,
    pointsUsed,
    cashPaid,
    paidAmount,
    remainingAmount,
    overpaidAmount,
    reconciliationCharge: reconciliationAmount > MONEY_EPSILON ? reconciliationAmount : 0,
  };
}
