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
// the bulk minimum may pick any date (prep time permitting). During the
// festive season window (e.g. bak chang season, when production runs daily)
// delivery dates inside the window are open to small orders too. The
// thresholds live in settings/business under `orderingRules` so the admin can
// change them without a code release. Products marked `bulkExempt` (e.g.
// bottled kueh tarts sold as a jar of 20) neither count toward the minimum nor
// restrict the date — a cart of only exempt items may pick any day.

export interface OrderingRules {
  bulkMinQuantity: number; // units in the cart needed to unlock flexible dates
  smallOrderWeekdays: number[]; // allowed collection days for small orders, JS getDay() values (0=Sun … 6=Sat)
  seasonStart: string | null; // festive season window, YYYY-MM-DD inclusive; both null = off
  seasonEnd: string | null;
}

export const DEFAULT_ORDERING_RULES: OrderingRules = {
  bulkMinQuantity: 20,
  smallOrderWeekdays: [6], // Saturdays
  seasonStart: null,
  seasonEnd: null,
};

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toLocalYMD(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeOrderingRules(raw: any): OrderingRules {
  const minQty = Number(raw?.bulkMinQuantity);
  const weekdays = Array.isArray(raw?.smallOrderWeekdays)
    ? raw.smallOrderWeekdays.map(Number).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6)
    : [];
  // The season only counts when both ends are valid dates in order — a
  // half-filled or inverted window behaves as if no season were set.
  const start = typeof raw?.seasonStart === 'string' && YMD_PATTERN.test(raw.seasonStart) ? raw.seasonStart : null;
  const end = typeof raw?.seasonEnd === 'string' && YMD_PATTERN.test(raw.seasonEnd) ? raw.seasonEnd : null;
  const seasonValid = start !== null && end !== null && start <= end;
  return {
    bulkMinQuantity: Number.isFinite(minQty) && minQty > 0 ? Math.floor(minQty) : DEFAULT_ORDERING_RULES.bulkMinQuantity,
    smallOrderWeekdays: weekdays.length > 0 ? weekdays : DEFAULT_ORDERING_RULES.smallOrderWeekdays,
    seasonStart: seasonValid ? start : null,
    seasonEnd: seasonValid ? end : null,
  };
}

// YYYY-MM-DD strings compare correctly as strings, so no Date parsing needed.
export function isDateInSeason(dateKey: string, rules: OrderingRules) {
  return rules.seasonStart !== null && rules.seasonEnd !== null
    && dateKey >= rules.seasonStart && dateKey <= rules.seasonEnd;
}

// A small (weekday-restricted) order may still take any date that falls inside
// the festive season window.
export function isSmallOrderDateAllowed(date: Date, rules: OrderingRules) {
  return rules.smallOrderWeekdays.includes(date.getDay()) || isDateInSeason(toLocalYMD(date), rules);
}

// ─── Daily capacity limits ───────────────────────────────────────────────────
//
// Per-date limits live in the `dailyLimits` collection keyed by YYYY-MM-DD.
// A doc under this reserved key holds the default limit applied to every date
// without its own doc, so the admin can cap all days in one action. It rides
// along in the same getDailyLimits() fetch and is covered by the same
// Firestore rules as the per-date docs.

export const DEFAULT_DAILY_LIMIT_KEY = '_default';

// 0 means unlimited (no cap set for that date).
export function getLimitForDate(limits: Record<string, number>, dateKey: string): number {
  return limits[dateKey] ?? limits[DEFAULT_DAILY_LIMIT_KEY] ?? 0;
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
