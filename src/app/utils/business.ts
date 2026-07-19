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

// ─── Open order date ranges (preorder scheduling) ────────────────────────────
//
// General (non-batch-tracked) product orders are only accepted on dates that
// fall inside one of these admin-configured windows — closed by default until
// at least one window is added on the Production Calendar page. Batch-tracked
// products are unaffected; they use their own production-date flow. Ranges
// live in settings/business under `openOrderRanges` so the admin can change
// them without a code release.

export interface OrderWindow {
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
}

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toLocalYMD(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Drops any entry with a malformed or inverted (end before start) range
// rather than failing the whole list, so one bad entry can't lock out every
// other configured window.
export function normalizeOpenOrderRanges(raw: any): OrderWindow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r: any) => r && YMD_PATTERN.test(r?.start) && YMD_PATTERN.test(r?.end) && r.start <= r.end)
    .map((r: any) => ({ start: r.start, end: r.end }));
}

// YYYY-MM-DD strings compare correctly as strings, so no Date parsing needed.
export function isDateOrderable(dateKey: string, ranges: OrderWindow[]) {
  return ranges.some(r => dateKey >= r.start && dateKey <= r.end);
}

// Extra whole days added on top of a product's own prepDays before a delivery
// date becomes selectable — e.g. a buffer of 1 guarantees at least one full
// day between the customer paying and prep starting, on top of however long
// the item itself takes to prepare. 0 means "no extra buffer" (default).
export function normalizeOrderLeadBufferDays(raw: any): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
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
