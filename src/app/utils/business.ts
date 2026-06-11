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
  const dayKey = `${YY}${MM}${DD}`;
  const counterKey = `orderCounter-${dayKey}`;
  const seq = parseInt(localStorage.getItem(counterKey) || '0', 10) + 1;
  localStorage.setItem(counterKey, String(seq));
  return `DN-${dayKey}${String(seq).padStart(2, '0')}`;
}

export function getMaxPrepDaysFromCart(cartItems: any[]) {
  if (!cartItems || cartItems.length === 0) return 1;
  return cartItems.reduce((max: number, item: any) => Math.max(max, item.prepDays || 1), 1);
}
