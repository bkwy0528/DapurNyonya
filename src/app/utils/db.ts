import { db } from '../../firebase';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, addDoc, runTransaction, writeBatch, increment,
} from 'firebase/firestore';

export const ADMIN_EMAIL = 'yikbryan0528work@gmail.com';

// ─── Products ────────────────────────────────────────────────────────────────

export async function getProducts(): Promise<any[]> {
  const snap = await getDocs(collection(db, 'products'));
  return snap.docs.map(d => d.data());
}

export async function saveProduct(product: any): Promise<void> {
  await setDoc(doc(db, 'products', product.id), product);
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, 'products', id));
}

export async function seedDefaultProducts(): Promise<void> {
  const defaults = [
    {
      id: '1',
      name: 'Traditional Dumplings',
      description: 'Handmade with premium ingredients, perfect for festive celebrations',
      price: 25.00,
      image: 'https://images.unsplash.com/photo-1766309416197-5982d32f4ce0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkdW1wbGluZ3MlMjBmb29kJTIwZmVzdGl2ZXxlbnwxfHx8fDE3NjY3NDIxMTF8MA&ixlib=rb-4.1.0&q=80&w=1080',
      unit: 'pack (12 pieces)',
      prepDays: 3,
      available: true,
    },
    {
      id: '2',
      name: 'Festive Cookies',
      description: 'Assorted cookies with traditional flavors and decorations',
      price: 18.00,
      image: 'https://images.unsplash.com/photo-1627373369962-42fd4fde6504?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb29raWVzJTIwZmVzdGl2ZSUyMHNuYWNrc3xlbnwxfHx8fDE3NjY3NDIxMTJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      unit: 'box (20 cookies)',
      prepDays: 2,
      available: true,
    },
    {
      id: '3',
      name: 'Traditional Snacks',
      description: 'Mix of authentic handmade snacks for every occasion',
      price: 22.00,
      image: 'https://images.unsplash.com/photo-1680345576132-9dc2b41636c3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmFkaXRpb25hbCUyMHNuYWNrcyUyMGZvb2R8ZW58MXx8fHwxNzY2NzQyMTEyfDA&ixlib=rb-4.1.0&q=80&w=1080',
      unit: 'pack (500g)',
      prepDays: 1,
      available: true,
    },
  ];
  await Promise.all(defaults.map(p => setDoc(doc(db, 'products', p.id), p)));
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function getOrders(): Promise<any[]> {
  const snap = await getDocs(collection(db, 'orders'));
  return snap.docs.map(d => d.data());
}

export async function getOrdersByCustomer(customerId: string): Promise<any[]> {
  const q = query(collection(db, 'orders'), where('customerId', '==', customerId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

export async function getOrderById(orderId: string): Promise<any | null> {
  const snap = await getDoc(doc(db, 'orders', orderId));
  return snap.exists() ? snap.data() : null;
}


export async function updateOrderFields(id: string, updates: Record<string, any>): Promise<void> {
  await updateDoc(doc(db, 'orders', id), updates);
}

// For status changes that free up a booked slot (admin reject, customer cancel):
// updates the order and decrements that date's counter atomically.
export async function updateOrderFieldsReleasingSlot(id: string, updates: Record<string, any>, deliveryDate?: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'orders', id), updates);
  if (deliveryDate) {
    batch.set(doc(db, 'orderCounts', deliveryDate), { count: increment(-1) }, { merge: true });
  }
  await batch.commit();
}

export async function getOrderCountForDate(date: string): Promise<number> {
  const snap = await getDoc(doc(db, 'orderCounts', date));
  return snap.exists() ? Math.max(0, (snap.data() as any).count || 0) : 0;
}

// Atomically returns 1, 2, 3... per dateKey (e.g. "260706") so concurrent
// approvals never get the same finalized order number.
export async function getNextDailyOrderSequence(dateKey: string): Promise<number> {
  const counterRef = doc(db, 'counters', `orders-${dateKey}`);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const next = (snap.exists() ? (snap.data() as any).count : 0) + 1;
    transaction.set(counterRef, { count: next });
    return next;
  });
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<any> {
  const snap = await getDoc(doc(db, 'settings', 'business'));
  return snap.exists() ? snap.data() : null;
}

export async function saveSettings(settings: any): Promise<void> {
  await setDoc(doc(db, 'settings', 'business'), settings);
}

// ─── Daily Limits ────────────────────────────────────────────────────────────

export async function getDailyLimits(): Promise<Record<string, number>> {
  const snap = await getDocs(collection(db, 'dailyLimits'));
  const result: Record<string, number> = {};
  snap.docs.forEach(d => { result[d.id] = (d.data() as any).limit; });
  return result;
}

export async function saveDailyLimit(dateKey: string, limit: number): Promise<void> {
  await setDoc(doc(db, 'dailyLimits', dateKey), { limit });
}

export async function clearDailyLimit(dateKey: string): Promise<void> {
  await deleteDoc(doc(db, 'dailyLimits', dateKey));
}

// ─── User Profiles ───────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<any> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveUserProfile(uid: string, profile: any): Promise<void> {
  await setDoc(doc(db, 'users', uid), profile, { merge: true });
}

// ─── Admin Profile ───────────────────────────────────────────────────────────

export async function getAdminProfile(): Promise<any> {
  const snap = await getDoc(doc(db, 'adminProfile', 'main'));
  return snap.exists() ? snap.data() : null;
}

export async function saveAdminProfile(profile: any): Promise<void> {
  await setDoc(doc(db, 'adminProfile', 'main'), profile, { merge: true });
}
