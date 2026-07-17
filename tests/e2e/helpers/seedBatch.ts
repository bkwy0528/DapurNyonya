import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

const PROJECT_ID = 'dapurnyonya-9b752'; // must match the app's project so it sees the docs
const FIRESTORE_HOST = { host: '127.0.0.1', port: 8089 };

// Batch-tracked products and their production dates are normally created
// through Product Management / the Pre-Orders admin page — seeded directly here
// (rules disabled) purely to save UI setup steps in tests that aren't
// exercising those admin flows themselves.
export async function seedBatchProduct(product: { id: string; name: string; price: number; unit: string }) {
  const env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: FIRESTORE_HOST });
  try {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'products', product.id), {
        id: product.id,
        name: product.name,
        description: 'Batch test product',
        price: product.price,
        image: '',
        unit: product.unit,
        prepDays: 1,
        available: true,
        batchTracked: true,
      });
    });
  } finally {
    await env.cleanup();
  }
}

export async function seedProductionBatch(batch: {
  id: string; productId: string; productName: string; productionDate: string; minQuantity: number; maxQuantity: number;
}) {
  const env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: FIRESTORE_HOST });
  try {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'productionBatches', batch.id), {
        id: batch.id,
        productId: batch.productId,
        productName: batch.productName,
        productionDate: batch.productionDate,
        status: 'open',
        minQuantity: batch.minQuantity,
        maxQuantity: batch.maxQuantity,
        currentQuantity: 0,
        orderCount: 0,
        batchStatus: 'collecting',
        confirmedAt: null,
        paymentDeadline: null,
      });
    });
  } finally {
    await env.cleanup();
  }
}

// The UI can create a batchOrders doc for real (createBatchPreOrder is pure
// Firestore, no external calls) — this helper only looks up the id the UI
// flow produced, by matching customer + batch, since the browser never
// surfaces the raw document id.
export async function findBatchOrderId(customerEmail: string, batchId: string): Promise<string> {
  const env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: FIRESTORE_HOST });
  try {
    let batchOrderId = '';
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', customerEmail)));
      if (userSnap.empty) throw new Error(`No user doc found for ${customerEmail}`);
      const uid = userSnap.docs[0].id;
      const boSnap = await getDocs(query(
        collection(db, 'batchOrders'), where('customerId', '==', uid), where('batchId', '==', batchId),
      ));
      if (boSnap.empty) throw new Error(`No batchOrders doc found for ${customerEmail} in batch ${batchId}`);
      batchOrderId = boSnap.docs[0].id;
    });
    return batchOrderId;
  } finally {
    await env.cleanup();
  }
}

// Writes the paymentConfirmations doc the toyyibpayCallback function would
// record on a successful payment — the emulator can't receive ToyyibPay's
// real server-to-server callback, and this doc is what
// submitBatchOrderPayment requires before it will graduate a pre-order.
export async function seedPaymentConfirmation(billCode: string, amountCents: number) {
  const env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: FIRESTORE_HOST });
  try {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'paymentConfirmations', billCode), {
        billCode, status: '1', refno: `TP-${billCode}`, amount: amountCents,
        orderId: null, reason: null, receivedAt: new Date().toISOString(),
      });
    });
  } finally {
    await env.cleanup();
  }
}

// Reads a batchOrders doc directly (rules disabled) so a test can assert on
// server-side state the UI doesn't surface.
export async function readBatchOrder(batchOrderId: string): Promise<any> {
  const env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: FIRESTORE_HOST });
  try {
    let data: any = null;
    await env.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(doc(ctx.firestore(), 'batchOrders', batchOrderId));
      data = snap.exists() ? snap.data() : null;
    });
    return data;
  } finally {
    await env.cleanup();
  }
}

// Graduates a batchOrders doc into a real orders/ doc, mirroring exactly what
// submitBatchOrderPayment writes — used the same way seedOrder.ts's
// seedPaidOrder is: ToyyibPay itself is outside the emulator, so the payment
// step can't be driven through the real UI/function in tests.
export async function seedBatchOrderPaid(batchOrderId: string): Promise<{ orderId: string; finalizedNumber: string }> {
  const env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: FIRESTORE_HOST });
  try {
    let orderId = '';
    let finalizedNumber = '';
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const boRef = doc(db, 'batchOrders', batchOrderId);
      const boSnap = await getDoc(boRef);
      if (!boSnap.exists()) throw new Error(`No batchOrders/${batchOrderId} found`);
      const bo = boSnap.data() as any;

      const orderRef = doc(collection(db, 'orders'));
      orderId = orderRef.id;
      finalizedNumber = `DN-TEST-${orderRef.id.slice(-4).toUpperCase()}`;
      await setDoc(orderRef, {
        id: orderRef.id,
        customerId: bo.customerId,
        customerName: bo.customerName,
        customerPhone: bo.customerPhone,
        items: [{ productId: bo.productId, name: bo.productName, price: bo.price, unit: bo.unit, image: bo.image || '', quantity: bo.quantity, notes: bo.notes || '' }],
        subtotal: bo.price * bo.quantity,
        deliveryCharge: 0,
        total: bo.price * bo.quantity,
        deliveryMethod: bo.deliveryMethod,
        deliveryAddress: bo.deliveryAddress,
        postalCode: bo.postalCode,
        specialInstructions: bo.specialInstructions,
        paymentMethod: 'tng',
        paymentNote: '',
        status: 'Order Received',
        paymentStatus: 'paid',
        transactionId: `TP${Date.now()}`,
        billCode: `test-bill-${orderRef.id}`,
        paidAt: new Date().toISOString(),
        orderDate: new Date().toISOString(),
        deliveryDate: bo.productionDate,
        finalizedNumber,
        clientRequestId: `seed-batch-${orderRef.id}`,
      });
      await setDoc(boRef, { status: 'paid', orderId: orderRef.id }, { merge: true });
    });
    return { orderId, finalizedNumber };
  } finally {
    await env.cleanup();
  }
}
