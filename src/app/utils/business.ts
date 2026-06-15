export function validatePassword(password: string) {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) errors.push('Password must be alphanumeric (letters and numbers)');
  if (!/[!@#$%^&*(),.?":{}|<>\[\]\\/;:'`~_+=-]/.test(password)) errors.push('Password must include at least one symbol');
  return errors;
}

export function generateFinalOrderNumber() {
  const now = new Date();
  const YY = String(now.getFullYear()).slice(-2);
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const DD = String(now.getDate()).padStart(2, '0');
  // Use random 4-char suffix instead of localStorage counter to avoid
  // duplicate numbers when admin switches devices or clears browser data.
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DN-${YY}${MM}${DD}-${suffix}`;
}

export function getMaxPrepDaysFromCart(cartItems: any[]) {
  if (!cartItems || cartItems.length === 0) return 1;
  return cartItems.reduce((max: number, item: any) => Math.max(max, item.prepDays || 1), 1);
}
