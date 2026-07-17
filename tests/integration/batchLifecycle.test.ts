import { describe, it, expect, beforeAll } from 'vitest';
import { getEmulatorDb } from '../../functions/src/emulatorAdmin';
import { expireBatchPaymentsCore, closeExpiredProductionDatesCore } from '../../functions/src/batchLifecycle';

type Firestore = ReturnType<typeof getEmulatorDb>;

// Exercises the REAL scheduled-function logic (extracted into
// functions/src/batchLifecycle.ts precisely because the emulator has no Cloud
// Scheduler to fire the onSchedule wrappers) against the Firestore emulator
// through the same Admin SDK the deployed functions use. Run via
// `npm run test:integration` (emulators:exec sets FIRESTORE_EMULATOR_HOST).

let db: Firestore;

const HOUR = 60 * 60 * 1000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const ymd = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

beforeAll(() => {
  db = getEmulatorDb('dapurnyonya-9b752');
});

const seedBatch = async (id: string, data: Record<string, unknown>) => {
  await db.collection('productionBatches').doc(id).set({
    id, productId: 'p1', productName: 'Test Chang', status: 'open',
    minQuantity: 10, maxQuantity: 0, confirmedAt: null, paymentDeadline: null, ...data,
  });
};

const seedBatchOrder = async (id: string, data: Record<string, unknown>) => {
  await db.collection('batchOrders').doc(id).set({
    id, customerId: 'c1', customerName: 'Test Customer', customerPhone: '123',
    productId: 'p1', productName: 'Test Chang', price: 5, unit: 'piece', image: '',
    notes: '', deliveryMethod: 'pickup', deliveryAddress: 'Pickup', postalCode: '',
    specialInstructions: '', createdAt: iso(0), paymentDeadline: null,
    billCode: null, paymentMethod: '', paymentNote: '', orderId: null, ...data,
  });
};

describe('expireBatchPaymentsCore', () => {
  it('expires only past-deadline awaiting_payment orders and releases their quantity', async () => {
    const batchId = `p1_${ymd(3)}-expiry`;
    await seedBatch(batchId, {
      productionDate: ymd(3), batchStatus: 'confirmed',
      currentQuantity: 18, orderCount: 3, confirmedAt: iso(-3 * HOUR), paymentDeadline: iso(-1 * HOUR),
    });
    await seedBatchOrder('exp-late', { batchId, productionDate: ymd(3), quantity: 4, status: 'awaiting_payment', paymentDeadline: iso(-1 * HOUR) });
    await seedBatchOrder('exp-ontime', { batchId, productionDate: ymd(3), quantity: 6, status: 'awaiting_payment', paymentDeadline: iso(+40 * HOUR) });
    await seedBatchOrder('exp-paid', { batchId, productionDate: ymd(3), quantity: 8, status: 'paid', orderId: 'order-x', paymentDeadline: iso(-1 * HOUR) });

    const released = await expireBatchPaymentsCore(db, new Date().toISOString());
    expect(released).toBe(1);

    const late = (await db.collection('batchOrders').doc('exp-late').get()).data()!;
    const onTime = (await db.collection('batchOrders').doc('exp-ontime').get()).data()!;
    const paid = (await db.collection('batchOrders').doc('exp-paid').get()).data()!;
    expect(late.status).toBe('expired');
    expect(onTime.status).toBe('awaiting_payment'); // deadline not reached
    expect(paid.status).toBe('paid'); // once paid, always honored

    const batch = (await db.collection('productionBatches').doc(batchId).get()).data()!;
    expect(batch.currentQuantity).toBe(14); // 18 - the expired order's 4
    expect(batch.orderCount).toBe(2);
    expect(batch.batchStatus).toBe('confirmed'); // expiry never un-confirms a batch
  });

  it('is idempotent — a second run releases nothing more', async () => {
    const released = await expireBatchPaymentsCore(db, new Date().toISOString());
    expect(released).toBe(0);
    const batch = (await db.collection('productionBatches').doc(`p1_${ymd(3)}-expiry`).get()).data()!;
    expect(batch.currentQuantity).toBe(14);
    expect(batch.orderCount).toBe(2);
  });
});

describe('closeExpiredProductionDatesCore', () => {
  it('cancels only under-minimum batches whose date has passed, and their waiting orders', async () => {
    const pastUnmet = `p1_${ymd(-1)}-unmet`;
    const pastConfirmed = `p1_${ymd(-1)}-confirmed`;
    const futureCollecting = `p1_${ymd(5)}-future`;
    await seedBatch(pastUnmet, { productionDate: ymd(-1), batchStatus: 'collecting', currentQuantity: 3, orderCount: 1 });
    await seedBatch(pastConfirmed, { productionDate: ymd(-1), batchStatus: 'confirmed', currentQuantity: 12, orderCount: 2, paymentDeadline: iso(+10 * HOUR) });
    await seedBatch(futureCollecting, { productionDate: ymd(5), batchStatus: 'collecting', currentQuantity: 2, orderCount: 1 });
    await seedBatchOrder('close-waiting', { batchId: pastUnmet, productionDate: ymd(-1), quantity: 3, status: 'waiting' });
    await seedBatchOrder('close-future-waiting', { batchId: futureCollecting, productionDate: ymd(5), quantity: 2, status: 'waiting' });

    const cancelled = await closeExpiredProductionDatesCore(db, ymd(0));
    expect(cancelled).toBe(1);

    const unmet = (await db.collection('productionBatches').doc(pastUnmet).get()).data()!;
    expect(unmet.batchStatus).toBe('cancelled');
    expect(unmet.status).toBe('closed');
    expect((await db.collection('batchOrders').doc('close-waiting').get()).data()!.status).toBe('cancelled');

    // A confirmed batch is governed by its payment deadline, not the date.
    const confirmed = (await db.collection('productionBatches').doc(pastConfirmed).get()).data()!;
    expect(confirmed.batchStatus).toBe('confirmed');
    expect(confirmed.status).toBe('open');

    // A future collecting batch is untouched.
    const future = (await db.collection('productionBatches').doc(futureCollecting).get()).data()!;
    expect(future.batchStatus).toBe('collecting');
    expect((await db.collection('batchOrders').doc('close-future-waiting').get()).data()!.status).toBe('waiting');
  });
});
