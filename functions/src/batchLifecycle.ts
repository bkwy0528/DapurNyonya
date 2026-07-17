import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

// Core logic of the two scheduled batch-lifecycle functions, extracted from
// the onSchedule handlers in index.ts so it can be exercised directly against
// the Firestore emulator (Cloud Scheduler doesn't exist in the emulator, so
// the handlers themselves can never fire in tests). The handlers inject the
// real `db` and the current time; tests inject a test db and a fixed time.

// Releases the reserved quantity for any pre-order whose payment window
// closed without paying. Already-paid orders have graduated into `orders` by
// this point and are never touched — once paid, always honored, regardless of
// what happens to the rest of the batch. Returns how many were released.
export async function expireBatchPaymentsCore(db: Firestore, nowIso: string): Promise<number> {
  const expiredSnap = await db.collection('batchOrders')
    .where('status', '==', 'awaiting_payment')
    .where('paymentDeadline', '<', nowIso)
    .get();

  let released = 0;
  for (const docSnap of expiredSnap.docs) {
    const batchOrder = docSnap.data() as any;
    await db.runTransaction(async (tx) => {
      const freshSnap = await tx.get(docSnap.ref);
      const fresh = freshSnap.data() as any;
      if (fresh.status !== 'awaiting_payment') return; // already paid/expired by a previous run
      tx.update(docSnap.ref, { status: 'expired' });
      const batchRef = db.collection('productionBatches').doc(batchOrder.batchId);
      tx.set(batchRef, {
        currentQuantity: FieldValue.increment(-batchOrder.quantity),
        orderCount: FieldValue.increment(-1),
      }, { merge: true });
    });
    released += 1;
  }
  return released;
}

// Cancels any batch whose production date has arrived without reaching its
// minimum quantity, along with every pre-order still waiting on it — no admin
// action required. A batch that already reached 'confirmed' is governed by
// its payment deadline (expireBatchPaymentsCore above), not the production
// date, so it's excluded here even once that date has passed. Returns how
// many batches were cancelled.
export async function closeExpiredProductionDatesCore(db: Firestore, todayKey: string): Promise<number> {
  const expiredBatchesSnap = await db.collection('productionBatches')
    .where('batchStatus', '==', 'collecting')
    .where('productionDate', '<=', todayKey)
    .get();

  for (const batchDoc of expiredBatchesSnap.docs) {
    await batchDoc.ref.set({ batchStatus: 'cancelled', status: 'closed' }, { merge: true });

    const waitingSnap = await db.collection('batchOrders')
      .where('batchId', '==', batchDoc.id)
      .where('status', '==', 'waiting')
      .get();
    if (!waitingSnap.empty) {
      const cancelWrite = db.batch();
      waitingSnap.docs.forEach((docSnap) => {
        cancelWrite.update(docSnap.ref, { status: 'cancelled' });
      });
      await cancelWrite.commit();
    }
  }
  return expiredBatchesSnap.size;
}
