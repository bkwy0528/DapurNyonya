import { db } from '../../firebase';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, writeBatch, increment,
} from 'firebase/firestore';

export const ADMIN_EMAILS = ['yikbryan0528work@gmail.com', 'ksl_joyce@yahoo.com'];

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

// ─── Ingredients (master list) ──────────────────────────────────────────────

export async function getIngredients(): Promise<any[]> {
  const snap = await getDocs(collection(db, 'ingredients'));
  return snap.docs.map(d => d.data());
}

export async function saveIngredient(ingredient: any): Promise<void> {
  await setDoc(doc(db, 'ingredients', ingredient.id), ingredient);
}

export async function updateIngredientPurchased(id: string, purchased: number): Promise<void> {
  await updateDoc(doc(db, 'ingredients', id), { purchased });
}

export async function deleteIngredient(id: string): Promise<void> {
  await deleteDoc(doc(db, 'ingredients', id));
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

export async function getOrderCountForDate(date: string): Promise<number> {
  const snap = await getDoc(doc(db, 'orderCounts', date));
  return snap.exists() ? Math.max(0, (snap.data() as any).count || 0) : 0;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<any> {
  const snap = await getDoc(doc(db, 'settings', 'business'));
  return snap.exists() ? snap.data() : null;
}

export async function saveSettings(settings: any): Promise<void> {
  await setDoc(doc(db, 'settings', 'business'), settings);
}

// ─── Production Batches (batch/MOQ ordering) ────────────────────────────────
//
// Admin config (status/minQuantity/maxQuantity) is written directly from the
// Production Calendar page, same as dailyLimits. currentQuantity/orderCount/
// batchStatus/confirmedAt/paymentDeadline are only ever written by the
// createBatchPreOrder/expireBatchPayments/closeExpiredProductionDates Cloud
// Functions (Admin SDK) — never by this client-side writer.

export async function getProductionBatches(): Promise<any[]> {
  const snap = await getDocs(collection(db, 'productionBatches'));
  return snap.docs.map(d => d.data());
}

export async function getProductionBatchesForProduct(productId: string): Promise<any[]> {
  const q = query(collection(db, 'productionBatches'), where('productId', '==', productId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

// Creates a new batch or overwrites an existing one's admin-configurable
// fields (status/minQuantity/maxQuantity) — callers must preserve the
// server-maintained counters (currentQuantity/orderCount/batchStatus/etc.)
// by spreading the existing doc first when editing.
export async function saveProductionBatch(batch: any): Promise<void> {
  await setDoc(doc(db, 'productionBatches', batch.id), batch);
}

// ─── Batch Orders (customer pre-orders against a production batch) ─────────

export async function getBatchOrdersByCustomer(customerId: string): Promise<any[]> {
  const q = query(collection(db, 'batchOrders'), where('customerId', '==', customerId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

export async function getBatchOrdersForBatch(batchId: string): Promise<any[]> {
  const q = query(collection(db, 'batchOrders'), where('batchId', '==', batchId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

// Admin-only (enforced by firestore.rules: batchOrders update + productionBatches
// write both require isAdmin()). Cancels a single not-yet-paid pre-order and
// releases its reserved quantity back to the batch in one atomic write, so a
// concurrent pre-order can immediately use the freed slots. Mirrors what
// expireBatchPayments does server-side on deadline expiry; like there, a
// 'confirmed' batch stays confirmed even if this drops it below its minimum —
// payment is already open for everyone else.
export async function adminCancelBatchOrder(batchOrder: any): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'batchOrders', batchOrder.id), { status: 'cancelled' });
  batch.update(doc(db, 'productionBatches', batchOrder.batchId), {
    currentQuantity: increment(-batchOrder.quantity),
    orderCount: increment(-1),
  });
  await batch.commit();
}

export async function getBatchOrderById(id: string): Promise<any | null> {
  const snap = await getDoc(doc(db, 'batchOrders', id));
  return snap.exists() ? snap.data() : null;
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
