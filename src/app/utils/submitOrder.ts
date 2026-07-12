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
