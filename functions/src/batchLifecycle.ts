import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';
import { sendPushToUserCore } from './pushNotifications';

// Core logic of the two scheduled batch-lifecycle functions, extracted from
// the onSchedule handlers in index.ts so it can be exercised directly against
// the Firestore emulator (Cloud Scheduler doesn't exist in the emulator, so
// the handlers themselves can never fire in tests). The handlers inject the
// real `db` and the current time; tests inject a test db and a fixed time.
//
// `messaging` is optional so existing/legacy test call sites that don't care
// about push behaviour don't need to pass a fake — when omitted, sends are
// skipped entirely (never throws either way; push is always best-effort).

// Releases the reserved quantity for any pre-order whose payment window
// closed without paying. Already-paid orders have graduated into `orders` by
// this point and are never touched — once paid, always honored, regardless of
// what happens to the rest of the batch. Returns how many were released.
export async function expireBatchPaymentsCore(db: Firestore, nowIso: string, messaging?: Messaging): Promise<number> {
  const expiredSnap = await db.collection('batchOrders')
    .where('status', '==', 'awaiting_payment')
    .where('paymentDeadline', '<', nowIso)
    .get();

  let released = 0;
  for (const docSnap of expiredSnap.docs) {
    const batchOrder = docSnap.data() as any;
    const didRelease = await db.runTransaction(async (tx) => {
      const freshSnap = await tx.get(docSnap.ref);
      const fresh = freshSnap.data() as any;
      if (fresh.status !== 'awaiting_payment') return false; // already paid/expired by a previous run
      tx.update(docSnap.ref, { status: 'expired' });
      const batchRef = db.collection('productionBatches').doc(batchOrder.batchId);
      tx.set(batchRef, {
        currentQuantity: FieldValue.increment(-batchOrder.quantity),
        orderCount: FieldValue.increment(-1),
      }, { merge: true });
      return true;
    });
    if (didRelease) {
      released += 1;
      if (messaging) {
        try {
          await sendPushToUserCore(db, messaging, batchOrder.customerId, {
            title: 'Payment window expired',
            body: `Your pre-order for ${batchOrder.productName} expired unpaid. Your spot has been released.`,
          });
        } catch {
          // Push is best-effort — never let a notification failure affect the release itself.
        }
      }
    }
  }
  return released;
}

// Cancels any batch whose production date has arrived without reaching its
// minimum quantity, along with every pre-order still waiting on it — no admin
// action required. A batch that already reached 'confirmed' is governed by
// its payment deadline (expireBatchPaymentsCore above), not the production
// date, so it's excluded here even once that date has passed. Returns how
// many batches were cancelled.
export async function closeExpiredProductionDatesCore(db: Firestore, todayKey: string, messaging?: Messaging): Promise<number> {
  const expiredBatchesSnap = await db.collection('productionBatches')
    .where('batchStatus', '==', 'collecting')
    .where('productionDate', '<=', todayKey)
    .get();

  for (const batchDoc of expiredBatchesSnap.docs) {
    const batch = batchDoc.data() as any;
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

      if (messaging) {
        await Promise.all(waitingSnap.docs.map(async (docSnap) => {
          const batchOrder = docSnap.data() as any;
          try {
            await sendPushToUserCore(db, messaging, batchOrder.customerId, {
              title: 'Pre-order cancelled',
              body: `${batch.productName} for ${batch.productionDate} didn't reach the minimum quantity, so it's been cancelled.`,
            });
          } catch {
            // Push is best-effort — never let a notification failure affect the cancellation itself.
          }
        }));
      }
    }
  }
  return expiredBatchesSnap.size;
}
