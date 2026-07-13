export function validatePassword(password: string) {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) errors.push('Password must be alphanumeric (letters and numbers)');
  return errors;
}

export function getDateKey(date: Date = new Date()) {
  const YY = String(date.getFullYear()).slice(-2);
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const DD = String(date.getDate()).padStart(2, '0');
  return `${YY}${MM}${DD}`;
}

// Sequence comes from an atomic per-day Firestore counter (assigned server-side
// by the submitOrder function) so the first order paid each day is 01, the next
// is 02, etc. — makes the day's order sequence visible at a glance.
export function generateFinalOrderNumber(sequence: number) {
  const seq = String(sequence).padStart(2, '0');
  return `DN-${getDateKey()}-${seq}`;
}

export function getMaxPrepDaysFromCart(cartItems: any[]) {
  if (!cartItems || cartItems.length === 0) return 1;
  return cartItems.reduce((max: number, item: any) => Math.max(max, item.prepDays || 1), 1);
}

// ─── Ordering rules for preorder scheduling ──────────────────────────────────
//
// Small orders are batched onto fixed weekly collection days; orders that meet
// the bulk minimum may pick any date (prep time permitting). The thresholds
// live in settings/business under `orderingRules` so the admin can change them
// without a code release. Products marked `bulkExempt` (e.g. bottled kueh
// tarts sold as a jar of 20) neither count toward the minimum nor restrict the
// date — a cart of only exempt items may pick any day.

export interface OrderingRules {
  bulkMinQuantity: number; // units in the cart needed to unlock flexible dates
  smallOrderWeekdays: number[]; // allowed collection days for small orders, JS getDay() values (0=Sun … 6=Sat)
}

export const DEFAULT_ORDERING_RULES: OrderingRules = {
  bulkMinQuantity: 20,
  smallOrderWeekdays: [6], // Saturdays
};

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function normalizeOrderingRules(raw: any): OrderingRules {
  const minQty = Number(raw?.bulkMinQuantity);
  const weekdays = Array.isArray(raw?.smallOrderWeekdays)
    ? raw.smallOrderWeekdays.map(Number).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6)
    : [];
  return {
    bulkMinQuantity: Number.isFinite(minQty) && minQty > 0 ? Math.floor(minQty) : DEFAULT_ORDERING_RULES.bulkMinQuantity,
    smallOrderWeekdays: weekdays.length > 0 ? weekdays : DEFAULT_ORDERING_RULES.smallOrderWeekdays,
  };
}

// `exemptProductIds` comes from the live product catalogue rather than the
// cart items themselves, so carts saved before a product was flagged still
// follow the current rule.
export function getBulkOrderStatus(cartItems: any[], rules: OrderingRules, exemptProductIds: Set<string>) {
  const countedUnits = (cartItems || [])
    .filter(item => !exemptProductIds.has(item.productId))
    .reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
  return {
    countedUnits,
    // Carts of only exempt items (countedUnits 0) are never restricted
    restrictedToWeekdays: countedUnits > 0 && countedUnits < rules.bulkMinQuantity,
  };
}
