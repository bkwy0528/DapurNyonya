import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';

// With cash gone, the UI can no longer create an order inside the emulator —
// checkout hands off to ToyyibPay's hosted page, which doesn't exist here. So
// tests that need an existing order write one directly (rules disabled, same
// as the Admin SDK the real submitOrder function uses), shaped exactly like
// submitOrder's own write: already paid, already numbered, status Order
// Received.
export interface SeededOrder {
  orderId: string;
  finalizedNumber: string;
}

export async function seedPaidOrder(customerEmail: string, deliveryDate: string): Promise<SeededOrder> {
  const env = await initializeTestEnvironment({
    projectId: 'dapurnyonya-9b752', // must match the app's project so it sees the doc
    firestore: { host: '127.0.0.1', port: 8089 },
  });

  try {
    let orderId = '';
    let finalizedNumber = '';
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();

      // Registration wrote users/{uid} with the email — that's the only way to
      // learn the fresh customer's uid from outside the browser.
      const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', customerEmail)));
      if (userSnap.empty) throw new Error(`No user doc found for ${customerEmail}`);
      const uid = userSnap.docs[0].id;
      const profile = userSnap.docs[0].data() as any;

      const orderRef = doc(collection(db, 'orders'));
      orderId = orderRef.id;
      finalizedNumber = `DN-TEST-${orderRef.id.slice(-4).toUpperCase()}`;
      await setDoc(orderRef, {
        id: orderRef.id,
        customerId: uid,
        customerName: profile.name || 'QA Customer',
        customerPhone: profile.phone || '123456789',
        items: [{ productId: '1', name: 'Traditional Dumplings', price: 25, unit: 'pack (12 pieces)', image: '', quantity: 2, notes: '' }],
        subtotal: 50,
        deliveryCharge: 0,
        total: 50,
        deliveryMethod: 'pickup',
        deliveryAddress: 'Pickup',
        postalCode: '',
        specialInstructions: '',
        paymentMethod: 'tng',
        paymentNote: '',
        status: 'Order Received',
        paymentStatus: 'paid',
        transactionId: `TP${Date.now()}`,
        billCode: `test-bill-${orderRef.id}`,
        paidAt: new Date().toISOString(),
        orderDate: new Date().toISOString(),
        deliveryDate,
        finalizedNumber,
        clientRequestId: `seed-${orderRef.id}`,
      });
    });
    return { orderId, finalizedNumber };
  } finally {
    await env.cleanup();
  }
}
