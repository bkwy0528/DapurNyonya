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

// Sequence comes from an atomic per-day Firestore counter (see
// getNextDailyOrderSequence in db.ts) so the first order approved each day is 01,
// the next is 02, etc. — makes approval order visible at a glance.
export function generateFinalOrderNumber(sequence: number) {
  const seq = String(sequence).padStart(2, '0');
  return `DN-${getDateKey()}-${seq}`;
}

export function getMaxPrepDaysFromCart(cartItems: any[]) {
  if (!cartItems || cartItems.length === 0) return 1;
  return cartItems.reduce((max: number, item: any) => Math.max(max, item.prepDays || 1), 1);
}
