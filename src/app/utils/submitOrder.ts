import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '../../firebase';

export interface SubmitOrderInput {
  clientRequestId: string;
  items: { productId: string; quantity: number; notes?: string }[];
  deliveryMethod: 'pickup' | 'delivery';
  deliveryAddress?: string;
  postalCode?: string;
  contactPhone: string;
  specialInstructions?: string;
  paymentMethod: 'tng' | 'fpx';
  paymentNote?: string;
  deliveryDate: string;
  customerName: string;
  billCode: string;
}

// The only way an order is ever created (see functions/src/index.ts's
// submitOrder) — it recomputes prices from the live product catalog and
// verifies a server-recorded payment confirmation before writing anything.
// Direct Firestore writes to `orders` are blocked by rules.
export async function submitOrder(input: SubmitOrderInput): Promise<{ orderId: string; total: number }> {
  const functions = getFunctions(firebaseApp, 'asia-southeast1');
  const callable = httpsCallable(functions, 'submitOrder');
  const result = await callable(input);
  return result.data as { orderId: string; total: number };
}

export interface CreateBatchPreOrderInput {
  productId: string;
  productionDate: string;
  quantity: number;
  notes?: string;
  deliveryMethod: 'pickup' | 'delivery';
  deliveryAddress?: string;
  postalCode?: string;
  contactPhone: string;
  specialInstructions?: string;
  customerName: string;
}

// The only way a batch pre-order is ever created (see functions/src/index.ts's
// createBatchPreOrder) — it recomputes the price from the live product
// catalog and checks batch capacity/MOQ inside a transaction. Direct
// Firestore writes to `batchOrders` are blocked by rules.
export async function createBatchPreOrder(input: CreateBatchPreOrderInput): Promise<{ batchOrderId: string; batchId: string }> {
  const functions = getFunctions(firebaseApp, 'asia-southeast1');
  const callable = httpsCallable(functions, 'createBatchPreOrder');
  const result = await callable(input);
  return result.data as { batchOrderId: string; batchId: string };
}

export interface SubmitBatchOrderPaymentInput {
  batchOrderId: string;
  billCode: string;
  paymentMethod: 'tng' | 'fpx';
  paymentNote?: string;
}

// Graduates a paid batch pre-order into a real orders/ doc (see
// functions/src/index.ts's submitBatchOrderPayment) — mirrors submitOrder's
// integrity pattern, just scoped to one existing batchOrders doc instead of a
// fresh cart.
export async function submitBatchOrderPayment(input: SubmitBatchOrderPaymentInput): Promise<{ orderId: string; total: number }> {
  const functions = getFunctions(firebaseApp, 'asia-southeast1');
  const callable = httpsCallable(functions, 'submitBatchOrderPayment');
  const result = await callable(input);
  return result.data as { orderId: string; total: number };
}

// Admin-only: sends a real push to the caller's own stored tokens, so an
// admin can visually confirm the whole pipeline actually delivers.
export async function sendTestNotificationToSelf(): Promise<{ sent: number; pruned: number }> {
  const functions = getFunctions(firebaseApp, 'asia-southeast1');
  const callable = httpsCallable(functions, 'sendTestNotificationToSelf');
  const result = await callable({});
  return result.data as { sent: number; pruned: number };
}
