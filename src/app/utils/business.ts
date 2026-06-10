export function validatePassword(password: string) {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) errors.push('Password must be alphanumeric (letters and numbers)');
  if (!/[!@#$%^&*(),.?":{}|<>\[\]\\/;:'`~_+=-]/.test(password)) errors.push('Password must include at least one symbol');
  return errors;
}

export function generateFinalOrderNumber() {
  const year = new Date().getFullYear();
  const key = `orderCounter-${year}`;
  const raw = parseInt(localStorage.getItem(key) || '0', 10) + 1;
  localStorage.setItem(key, String(raw));
  const seq = String(raw).padStart(4, '0');
  return `DN-${year}-${seq}`;
}

export function getMaxPrepDaysFromCart(cartItems: any[]) {
  if (!cartItems || cartItems.length === 0) return 1;
  return cartItems.reduce((max: number, item: any) => Math.max(max, item.prepDays || 1), 1);
}
