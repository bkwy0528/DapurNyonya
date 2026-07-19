import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { expireBatchPaymentsCore, closeExpiredProductionDatesCore } from './batchLifecycle';
import { sendPushToUserCore, sendPushToUsersCore } from './pushNotifications';
import { deductIngredientsForOrderCore, shouldDeductIngredients } from './ingredientDeduction';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import Busboy from '@fastify/busboy';
import type { Request } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// Same allowlist as firestore.rules' isAdmin() — there's no custom-claims
// setup in this project, admin identity is just this hardcoded email list,
// duplicated here because Cloud Functions can't reference Firestore rules.
const ADMIN_EMAILS = ['yikbryan0528work@gmail.com', 'ksl_joyce@yahoo.com'];

const TOYYIBPAY_BASE_URL = 'https://dev.toyyibpay.com';

// No Firestore order exists yet at bill-creation time — the order is only recorded
// client-side after ToyyibPay confirms success on the return redirect (see
// ToyyibPayReturnPage.tsx), so a failed/abandoned payment never leaves a dead order behind.
export const createToyyibPayBill = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to make a payment.');
    }

    const { amount, customerName, customerEmail, customerPhone, returnUrl, callbackUrl, paymentMethod } = request.data as {
      amount: number;
      customerName: string;
      customerEmail?: string;
      customerPhone?: string;
      returnUrl: string;
      callbackUrl: string;
      paymentMethod?: 'tng' | 'fpx';
    };

    if (!amount || amount <= 0) {
      throw new HttpsError('invalid-argument', 'Invalid amount.');
    }

    // billPaymentChannel only distinguishes FPX vs credit card vs both — DuitNow
    // QR is a separate, additive toggle on top of it, not a replacement, so
    // 'tng' can't fully exclude the FPX tab the way 'fpx' excludes DuitNow QR.
    // Requires DuitNow QR to be activated for the category on ToyyibPay's
    // dashboard, or enableDuitNowQR has no visible effect.
    const channelParams: Record<string, string> = paymentMethod === 'tng'
      ? { billPaymentChannel: '0', enableDuitNowQR: '1', chargeDuitNowQR: '0' }
      : { billPaymentChannel: '0' };

    // Credentials live in functions/.env (server-only — never sent to Firestore or
    // the browser) so they're set via `firebase deploy --only functions`, not the app UI.
    const toyyibpaySecretKey = process.env.TOYYIBPAY_SECRET_KEY;
    const toyyibpayCategoryCode = process.env.TOYYIBPAY_CATEGORY_CODE;

    if (!toyyibpaySecretKey || !toyyibpayCategoryCode) {
      throw new HttpsError('failed-precondition', 'ToyyibPay is not configured. Set TOYYIBPAY_SECRET_KEY and TOYYIBPAY_CATEGORY_CODE in functions/.env and redeploy.');
    }

    const reference = `dn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const body = new URLSearchParams({
      userSecretKey: toyyibpaySecretKey,
      categoryCode: toyyibpayCategoryCode,
      billName: 'DapurNyonya Order',
      billDescription: `Order for ${customerName || 'Customer'}`,
      billPriceSetting: '1',
      billPayorInfo: '1',
      billAmount: String(Math.round(amount * 100)),
      billReturnUrl: returnUrl,
      billCallbackUrl: callbackUrl,
      billExternalReferenceNo: reference,
      billTo: customerName || 'Customer',
      billEmail: customerEmail || '',
      billPhone: customerPhone || '',
      billContentEmail: 'Thank you for your order!',
      ...channelParams,
    });

    const response = await fetch(`${TOYYIBPAY_BASE_URL}/index.php/api/createBill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const rawText = await response.text();
    let result: Array<{ BillCode?: string; msg?: string }> | undefined;
    try {
      result = JSON.parse(rawText);
    } catch {
      logger.error('ToyyibPay createBill returned non-JSON response', { status: response.status, rawText });
      throw new HttpsError('internal', 'ToyyibPay returned an unexpected response. Please try again shortly.');
    }

    const billCode = result?.[0]?.BillCode;

    if (!billCode) {
      logger.error('ToyyibPay createBill did not return a BillCode', { status: response.status, result });
      throw new HttpsError('internal', result?.[0]?.msg || 'Failed to create ToyyibPay bill.');
    }

    return { billCode, paymentUrl: `${TOYYIBPAY_BASE_URL}/${billCode}` };
  }
);

// ToyyibPay posts this callback as multipart/form-data, which the functions
// framework's default parser leaves as a raw Buffer on req.body (it only
// auto-parses JSON and url-encoded bodies) — so the fields have to be pulled
// out with busboy instead of read directly off req.body.
function parseMultipartFields(req: Request): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {};
    const busboy = Busboy({ headers: { ...req.headers, 'content-type': req.headers['content-type']! } as Record<string, string> & { 'content-type': string } });
    busboy.on('field', (name: string, value: string) => { fields[name] = value; });
    busboy.on('finish', () => resolve(fields));
    busboy.on('error', reject);
    busboy.end(req.rawBody);
  });
}

// ToyyibPay calls this server-to-server once a bill is paid (or fails), independently
// of whatever the customer's browser does on the return redirect — submitOrder() below
// only trusts a payment as real once it sees the matching record this callback wrote,
// never the client-controlled return-page URL. Field names follow ToyyibPay's documented
// callback payload (billcode, status, refno). Unlike createBill's billAmount param, the
// callback's amount field is a decimal Ringgit string (e.g. "10.00"), not cents — it's
// converted to cents here so it's directly comparable to submitOrder's expectedCents.
export const toyyibpayCallback = onRequest(
  { region: 'asia-southeast1' },
  async (req, res) => {
    const contentType = req.headers['content-type'] || '';
    const body = contentType.includes('multipart/form-data')
      ? await parseMultipartFields(req)
      : (req.body as Record<string, string>);
    const billCode = body.billcode || body.billCode;

    if (!billCode) {
      logger.warn('ToyyibPay callback missing billcode', { body });
      res.status(200).send('OK');
      return;
    }

    await db.collection('paymentConfirmations').doc(billCode).set({
      billCode,
      status: body.status,
      refno: body.refno || null,
      amount: body.amount ? Math.round(Number(body.amount) * 100) : null,
      orderId: body.order_id || null,
      reason: body.reason || null,
      receivedAt: FieldValue.serverTimestamp(),
    });

    res.status(200).send('OK');
  }
);

// ─── Order submission ─────────────────────────────────────────────────────────
//
// The sole place an order is ever created — the post-payment ToyyibPay return
// flow calls this instead of writing to Firestore directly; firestore.rules
// blocks direct client creates entirely. That closes two gaps a prior review
// found: (1) price/product data was previously taken as-is from the client
// (cart prices, product names) with nothing re-checking them against the real
// catalog; (2) a paid order was previously created just because the customer's
// browser landed on the return URL with a certain query string, which anyone
// could type in by hand. Payment is only trusted once toyyibpayCallback (a
// server-to-server call from ToyyibPay itself) has recorded a matching
// paymentConfirmations doc. Cash was removed entirely on the admin's request:
// every order is paid before it exists, so there is no approval step, and the
// delivery (Grab) fee is arranged separately over WhatsApp rather than
// collected with the order.

function getDateKey(date: Date = new Date()): string {
  const YY = String(date.getFullYear()).slice(-2);
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const DD = String(date.getDate()).padStart(2, '0');
  return `${YY}${MM}${DD}`;
}

function generateFinalOrderNumber(sequence: number): string {
  return `DN-${getDateKey()}-${String(sequence).padStart(2, '0')}`;
}

interface SubmitOrderItem {
  productId: string;
  quantity: number;
  notes?: string;
}

interface SubmitOrderRequest {
  clientRequestId: string;
  items: SubmitOrderItem[];
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

export const submitOrder = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to place an order.');
    }
    const customerId = request.auth.uid;
    const data = request.data as SubmitOrderRequest;
    const { clientRequestId, items, deliveryMethod, paymentMethod } = data;

    if (!clientRequestId || typeof clientRequestId !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing request id.');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new HttpsError('invalid-argument', 'Cart is empty.');
    }
    if (deliveryMethod !== 'pickup' && deliveryMethod !== 'delivery') {
      throw new HttpsError('invalid-argument', 'Invalid delivery method.');
    }
    if (deliveryMethod === 'delivery' && !data.deliveryAddress) {
      throw new HttpsError('invalid-argument', 'Missing delivery address.');
    }
    // Cash was removed — every order must arrive through the online payment flow.
    if (paymentMethod !== 'tng' && paymentMethod !== 'fpx') {
      throw new HttpsError('invalid-argument', 'Invalid payment method.');
    }
    if (!data.contactPhone || !data.deliveryDate) {
      throw new HttpsError('invalid-argument', 'Missing required order details.');
    }

    // Idempotency: a duplicate submit (double-click, refresh mid-request) with
    // the same client-generated request id returns the order already created
    // for it instead of creating a second one.
    const existingByRequestId = await db.collection('orders')
      .where('customerId', '==', customerId)
      .where('clientRequestId', '==', clientRequestId)
      .limit(1).get();
    if (!existingByRequestId.empty) {
      const existing = existingByRequestId.docs[0];
      return { orderId: existing.id, total: existing.data().total };
    }

    // Recompute every line from the live product catalog — never trust a
    // client-supplied price or name.
    const resolvedItems = await Promise.all(items.map(async (item) => {
      if (!item.productId || !(item.quantity > 0)) {
        throw new HttpsError('invalid-argument', 'Invalid cart item.');
      }
      const snap = await db.collection('products').doc(item.productId).get();
      if (!snap.exists) {
        throw new HttpsError('failed-precondition', `Product ${item.productId} no longer exists.`);
      }
      const product = snap.data() as any;
      // Deliberately NOT rejecting a product whose `available` flag is now
      // false: the customer has already paid by this point, and the paid amount
      // is independently re-verified below. `available` gates whether a NEW cart
      // can add the item, not whether an already-paid order is honored — a mid-
      // checkout sold-out toggle must not strand a payment. The order still
      // surfaces normally in Order Management for the admin to fulfil or refund.
      return {
        productId: item.productId,
        name: product.name as string,
        price: product.price as number,
        unit: product.unit as string,
        image: (product.image as string) || '',
        quantity: item.quantity,
        notes: item.notes || '',
      };
    }));

    // The delivery (Grab) fee is arranged over WhatsApp after the order, so the
    // amount paid online is always exactly the items subtotal.
    const subtotal = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const deliveryCharge = 0;
    const total = subtotal;

    if (!data.billCode) {
      throw new HttpsError('invalid-argument', 'Missing payment reference.');
    }

    // A second dedup pass keyed on the payment itself — covers a reload that
    // generates a new clientRequestId but points at the same already-paid bill.
    const existingByBill = await db.collection('orders')
      .where('customerId', '==', customerId)
      .where('billCode', '==', data.billCode)
      .limit(1).get();
    if (!existingByBill.empty) {
      const existing = existingByBill.docs[0];
      return { orderId: existing.id, total: existing.data().total };
    }

    const confirmationSnap = await db.collection('paymentConfirmations').doc(data.billCode).get();
    if (!confirmationSnap.exists) {
      // ToyyibPay's server-to-server callback may not have landed yet if the
      // customer's browser returns faster than the callback POST arrives.
      // 'unavailable' (not 'failed-precondition') marks this as transient so
      // the return page retries for a few seconds before giving up — a genuine
      // never-paid bill simply exhausts those retries.
      throw new HttpsError('unavailable', 'Payment has not been confirmed yet. Please wait a moment and try again.');
    }
    const confirmation = confirmationSnap.data() as any;
    if (confirmation.status !== '1') {
      throw new HttpsError('failed-precondition', 'Payment was not successful.');
    }
    const expectedCents = Math.round(total * 100);
    if (confirmation.amount !== expectedCents) {
      logger.error('ToyyibPay paid amount does not match the recomputed order total', {
        billCode: data.billCode, expectedCents, paidAmount: confirmation.amount,
      });
      throw new HttpsError('failed-precondition', 'Paid amount does not match the order total.');
    }

    const paymentStatus = 'paid';
    const transactionId: string | null = confirmation.refno || null;
    const status = 'Order Received';

    const orderId = await db.runTransaction(async (tx) => {
      const newOrderRef = db.collection('orders').doc();

      // Capacity is re-checked inside the same transaction that increments the
      // count, so two orders racing for the last slot can no longer both slip
      // through (the checkout-time pre-check is only advisory). A paid order is
      // never refused here — the money is already captured by this point and
      // checkout pre-checked capacity before payment started — so it is created
      // regardless and the (rare) overbooking is logged for the admin to resolve.
      const countRef = db.collection('orderCounts').doc(data.deliveryDate);
      // A date without its own limit falls back to the admin's default limit,
      // stored under the reserved `_default` key in the same collection.
      const [limitSnap, defaultLimitSnap] = await Promise.all([
        tx.get(db.collection('dailyLimits').doc(data.deliveryDate)),
        tx.get(db.collection('dailyLimits').doc('_default')),
      ]);
      const countSnap = await tx.get(countRef);
      const limit = limitSnap.exists
        ? Number((limitSnap.data() as any).limit) || 0
        : defaultLimitSnap.exists ? Number((defaultLimitSnap.data() as any).limit) || 0 : 0;
      const booked = countSnap.exists ? Math.max(0, Number((countSnap.data() as any).count) || 0) : 0;
      if (limit > 0 && booked >= limit) {
        logger.warn('Paid order accepted over the daily capacity limit', {
          deliveryDate: data.deliveryDate, limit, booked,
        });
      }

      const dateKey = getDateKey();
      const counterRef = db.collection('counters').doc(`orders-${dateKey}`);
      const counterSnap = await tx.get(counterRef);
      const next = (counterSnap.exists ? (counterSnap.data() as any).count : 0) + 1;
      tx.set(counterRef, { count: next });
      const finalizedNumber = generateFinalOrderNumber(next);

      tx.set(newOrderRef, {
        id: newOrderRef.id,
        customerId,
        customerName: data.customerName || '',
        customerPhone: data.contactPhone,
        items: resolvedItems,
        subtotal,
        deliveryCharge,
        total,
        deliveryMethod,
        deliveryAddress: deliveryMethod === 'delivery' ? data.deliveryAddress : 'Pickup',
        postalCode: deliveryMethod === 'delivery' ? (data.postalCode || '') : '',
        specialInstructions: data.specialInstructions || '',
        paymentMethod,
        paymentNote: data.paymentNote || '',
        status,
        paymentStatus,
        transactionId,
        billCode: data.billCode || null,
        paidAt: paymentStatus === 'paid' ? new Date().toISOString() : null,
        orderDate: new Date().toISOString(),
        deliveryDate: data.deliveryDate,
        finalizedNumber,
        clientRequestId,
      });

      tx.set(countRef, { count: FieldValue.increment(1) }, { merge: true });

      return newOrderRef.id;
    });

    return { orderId, total };
  }
);

// ─── Batch/MOQ production ordering ────────────────────────────────────────────
//
// Products flagged `batchTracked` skip the flow above entirely. A customer's
// pre-order lives in `batchOrders` (waiting → awaiting_payment → paid/expired/
// cancelled) and never touches `orders` until it's actually paid — the
// opposite of the normal flow's "no order exists until paid" invariant, since
// here a pre-order must be able to exist, accumulate, and even die (MOQ never
// reached) before any money moves. `createToyyibPayBill`/`toyyibpayCallback`
// above are reused as-is for the payment step; only the pre-order and
// graduation-to-`orders` logic is new. See src/app/utils/batchOrders.ts for
// the shared client-side types this mirrors.

function malaysiaTodayYMD(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

interface CreateBatchPreOrderRequest {
  productId: string;
  productionDate: string; // YYYY-MM-DD, identifies the productionBatches doc together with productId
  quantity: number;
  notes?: string;
  deliveryMethod: 'pickup' | 'delivery';
  deliveryAddress?: string;
  postalCode?: string;
  contactPhone: string;
  specialInstructions?: string;
  customerName: string;
}

export const createBatchPreOrder = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to place a pre-order.');
    }
    const customerId = request.auth.uid;
    const data = request.data as CreateBatchPreOrderRequest;

    if (!data.productId || !data.productionDate || !(data.quantity > 0)) {
      throw new HttpsError('invalid-argument', 'Invalid pre-order request.');
    }
    if (data.deliveryMethod !== 'pickup' && data.deliveryMethod !== 'delivery') {
      throw new HttpsError('invalid-argument', 'Invalid delivery method.');
    }
    if (data.deliveryMethod === 'delivery' && !data.deliveryAddress) {
      throw new HttpsError('invalid-argument', 'Missing delivery address.');
    }
    if (!data.contactPhone) {
      throw new HttpsError('invalid-argument', 'Missing contact phone.');
    }

    const productSnap = await db.collection('products').doc(data.productId).get();
    if (!productSnap.exists) {
      throw new HttpsError('failed-precondition', 'Product no longer exists.');
    }
    const product = productSnap.data() as any;
    if (!product.batchTracked) {
      throw new HttpsError('failed-precondition', 'This product is not open for batch pre-orders.');
    }
    if (product.available === false) {
      throw new HttpsError('failed-precondition', `${product.name} is no longer available.`);
    }

    const batchId = `${data.productId}_${data.productionDate}`;
    const batchRef = db.collection('productionBatches').doc(batchId);
    const settingsRef = db.collection('settings').doc('business');
    const batchOrderRef = db.collection('batchOrders').doc();

    const { justConfirmed, effectiveDeadline } = await db.runTransaction(async (tx) => {
      const [batchSnap, settingsSnap] = await Promise.all([tx.get(batchRef), tx.get(settingsRef)]);
      if (!batchSnap.exists) {
        throw new HttpsError('failed-precondition', 'This production date is not open.');
      }
      const batch = batchSnap.data() as any;
      if (batch.status !== 'open' || batch.batchStatus === 'cancelled') {
        throw new HttpsError('failed-precondition', 'This production date is no longer accepting pre-orders.');
      }
      const wasConfirmed = batch.batchStatus === 'confirmed';
      if (wasConfirmed && batch.paymentDeadline && new Date(batch.paymentDeadline).getTime() < Date.now()) {
        throw new HttpsError('failed-precondition', 'The payment window for this production date has closed.');
      }

      const currentQuantity = Number(batch.currentQuantity) || 0;
      const maxQuantity = Number(batch.maxQuantity) || 0;
      if (maxQuantity > 0 && currentQuantity + data.quantity > maxQuantity) {
        throw new HttpsError('failed-precondition', `Only ${Math.max(0, maxQuantity - currentQuantity)} left for this date. Please reduce the quantity or choose another date.`);
      }

      const newQuantity = currentQuantity + data.quantity;
      const minQuantity = Number(batch.minQuantity) || 0;
      const nowConfirms = !wasConfirmed && minQuantity > 0 && newQuantity >= minQuantity;

      const windowHours = Number((settingsSnap.data() as any)?.batchPaymentWindowHours) || 48;
      const nowIso = new Date().toISOString();
      const newDeadlineIso = new Date(Date.now() + windowHours * 60 * 60 * 1000).toISOString();

      const batchUpdate: Record<string, any> = {
        currentQuantity: newQuantity,
        orderCount: FieldValue.increment(1),
      };
      if (nowConfirms) {
        batchUpdate.batchStatus = 'confirmed';
        batchUpdate.confirmedAt = nowIso;
        batchUpdate.paymentDeadline = newDeadlineIso;
      }
      tx.set(batchRef, batchUpdate, { merge: true });

      const deadline = nowConfirms ? newDeadlineIso : (wasConfirmed ? (batch.paymentDeadline || null) : null);
      const initialStatus: 'waiting' | 'awaiting_payment' = (nowConfirms || wasConfirmed) ? 'awaiting_payment' : 'waiting';

      tx.set(batchOrderRef, {
        id: batchOrderRef.id,
        customerId,
        customerName: data.customerName || '',
        customerPhone: data.contactPhone,
        batchId,
        productionDate: data.productionDate,
        productId: data.productId,
        productName: product.name,
        price: product.price,
        unit: product.unit,
        image: product.image || '',
        quantity: data.quantity,
        notes: data.notes || '',
        deliveryMethod: data.deliveryMethod,
        deliveryAddress: data.deliveryMethod === 'delivery' ? data.deliveryAddress : 'Pickup',
        postalCode: data.deliveryMethod === 'delivery' ? (data.postalCode || '') : '',
        specialInstructions: data.specialInstructions || '',
        createdAt: nowIso,
        status: initialStatus,
        paymentDeadline: deadline,
        billCode: null,
        paymentMethod: '',
        paymentNote: '',
        orderId: null,
      });

      return { justConfirmed: nowConfirms, effectiveDeadline: newDeadlineIso };
    });

    if (justConfirmed) {
      // Everyone who joined this batch before this pre-order tipped it over
      // MOQ is still sitting at 'waiting' — fan the confirmation out to them.
      // This pre-order's own doc was already written as 'awaiting_payment'
      // above, so it's excluded from this query by construction (it isn't
      // committed as 'waiting' at any point another read could observe).
      const waitingSnap = await db.collection('batchOrders')
        .where('batchId', '==', batchId)
        .where('status', '==', 'waiting')
        .get();
      if (!waitingSnap.empty) {
        const fanOut = db.batch();
        waitingSnap.docs.forEach((docSnap) => {
          fanOut.update(docSnap.ref, { status: 'awaiting_payment', paymentDeadline: effectiveDeadline });
        });
        await fanOut.commit();
      }

      // The customer who just tipped it over is excluded from waitingSnap
      // above (their own doc went straight to 'awaiting_payment'), so they're
      // added back here to also get the confirmation push.
      const deadlineLabel = new Date(effectiveDeadline).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
      const customerIds = [customerId, ...waitingSnap.docs.map((docSnap) => (docSnap.data() as any).customerId as string)];
      try {
        await sendPushToUsersCore(db, messaging, customerIds, {
          title: 'Minimum quantity reached!',
          body: `${product.name} is confirmed for production — pay by ${deadlineLabel} to keep your spot.`,
          url: '/customer/orders',
        });
      } catch (err) {
        logger.error('Failed to send batch-confirmed push notifications', { batchId, err });
      }
    }

    return { batchOrderId: batchOrderRef.id, batchId };
  }
);

interface SubmitBatchOrderPaymentRequest {
  batchOrderId: string;
  billCode: string;
  paymentMethod: 'tng' | 'fpx';
  paymentNote?: string;
}

export const submitBatchOrderPayment = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to pay for a pre-order.');
    }
    const customerId = request.auth.uid;
    const data = request.data as SubmitBatchOrderPaymentRequest;
    if (!data.batchOrderId || !data.billCode) {
      throw new HttpsError('invalid-argument', 'Missing payment details.');
    }
    if (data.paymentMethod !== 'tng' && data.paymentMethod !== 'fpx') {
      throw new HttpsError('invalid-argument', 'Invalid payment method.');
    }

    const batchOrderRef = db.collection('batchOrders').doc(data.batchOrderId);
    const batchOrderSnap = await batchOrderRef.get();
    if (!batchOrderSnap.exists) {
      throw new HttpsError('not-found', 'Pre-order not found.');
    }
    const batchOrder = batchOrderSnap.data() as any;
    if (batchOrder.customerId !== customerId) {
      throw new HttpsError('permission-denied', 'This pre-order does not belong to you.');
    }

    // Idempotency: a reload after a previous successful submit returns the
    // already-created order instead of creating a second one.
    if (batchOrder.status === 'paid' && batchOrder.orderId) {
      const existing = await db.collection('orders').doc(batchOrder.orderId).get();
      if (existing.exists) {
        return { orderId: batchOrder.orderId, total: (existing.data() as any).total };
      }
    }

    if (batchOrder.status !== 'awaiting_payment') {
      throw new HttpsError('failed-precondition', 'This pre-order is not currently open for payment.');
    }
    if (batchOrder.paymentDeadline && new Date(batchOrder.paymentDeadline).getTime() < Date.now()) {
      throw new HttpsError('failed-precondition', 'The payment window for this pre-order has expired.');
    }

    // Recompute the price from the live product catalog — never trust
    // whatever was stored on the pre-order for the amount actually charged.
    const productSnap = await db.collection('products').doc(batchOrder.productId).get();
    if (!productSnap.exists) {
      throw new HttpsError('failed-precondition', 'Product no longer exists.');
    }
    const product = productSnap.data() as any;
    const total = product.price * batchOrder.quantity;

    const confirmationSnap = await db.collection('paymentConfirmations').doc(data.billCode).get();
    if (!confirmationSnap.exists) {
      // Transient callback lag — same reasoning as submitOrder above: 'unavailable'
      // so the return page retries briefly rather than dead-ending the customer.
      throw new HttpsError('unavailable', 'Payment has not been confirmed yet. Please wait a moment and try again.');
    }
    const confirmation = confirmationSnap.data() as any;
    if (confirmation.status !== '1') {
      throw new HttpsError('failed-precondition', 'Payment was not successful.');
    }
    const expectedCents = Math.round(total * 100);
    if (confirmation.amount !== expectedCents) {
      logger.error('ToyyibPay paid amount does not match the recomputed batch order total', {
        billCode: data.billCode, expectedCents, paidAmount: confirmation.amount,
      });
      throw new HttpsError('failed-precondition', 'Paid amount does not match the order total.');
    }

    const transactionId: string | null = confirmation.refno || null;

    const orderId = await db.runTransaction(async (tx) => {
      // Re-read inside the transaction to guard against a second concurrent
      // submit for the same pre-order (e.g. two tabs) both reaching this far.
      const freshSnap = await tx.get(batchOrderRef);
      const fresh = freshSnap.data() as any;
      if (fresh.status === 'paid' && fresh.orderId) {
        return fresh.orderId as string;
      }
      if (fresh.status !== 'awaiting_payment') {
        throw new HttpsError('failed-precondition', 'This pre-order is not currently open for payment.');
      }

      const newOrderRef = db.collection('orders').doc();
      const dateKey = getDateKey();
      const counterRef = db.collection('counters').doc(`orders-${dateKey}`);
      const counterSnap = await tx.get(counterRef);
      const next = (counterSnap.exists ? (counterSnap.data() as any).count : 0) + 1;
      tx.set(counterRef, { count: next });
      const finalizedNumber = generateFinalOrderNumber(next);

      // Written in the exact same shape submitOrder() produces above, so
      // every existing order-consuming page (Order Management, Ingredient
      // Planning, Analytics, Customer Order Tracking) handles it unchanged.
      tx.set(newOrderRef, {
        id: newOrderRef.id,
        customerId,
        customerName: fresh.customerName || '',
        customerPhone: fresh.customerPhone,
        items: [{
          productId: fresh.productId,
          name: product.name,
          price: product.price,
          unit: product.unit,
          image: product.image || '',
          quantity: fresh.quantity,
          notes: fresh.notes || '',
        }],
        subtotal: total,
        deliveryCharge: 0,
        total,
        deliveryMethod: fresh.deliveryMethod,
        deliveryAddress: fresh.deliveryAddress,
        postalCode: fresh.postalCode,
        specialInstructions: fresh.specialInstructions,
        paymentMethod: data.paymentMethod,
        paymentNote: data.paymentNote || '',
        status: 'Order Received',
        paymentStatus: 'paid',
        transactionId,
        billCode: data.billCode,
        paidAt: new Date().toISOString(),
        orderDate: new Date().toISOString(),
        deliveryDate: fresh.productionDate,
        finalizedNumber,
        clientRequestId: `batch-${data.batchOrderId}`,
      });

      tx.update(batchOrderRef, {
        status: 'paid',
        orderId: newOrderRef.id,
        billCode: data.billCode,
        paymentMethod: data.paymentMethod,
        paymentNote: data.paymentNote || '',
      });

      return newOrderRef.id;
    });

    return { orderId, total };
  }
);

// Runs every 15 minutes: releases the reserved quantity for any pre-order
// whose payment window closed without paying. Already-paid orders have
// graduated into `orders` by this point and are never touched here — once
// paid, always honored, regardless of what happens to the rest of the batch.
export const expireBatchPayments = onSchedule(
  { region: 'asia-southeast1', schedule: 'every 15 minutes', timeZone: 'Asia/Kuala_Lumpur' },
  async () => {
    const released = await expireBatchPaymentsCore(db, new Date().toISOString(), messaging);
    if (released > 0) logger.info(`expireBatchPayments: released ${released} expired pre-order(s).`);
  }
);

// Runs once daily: any batch whose production date has arrived without
// reaching its minimum quantity is cancelled outright, along with every
// pre-order still waiting on it — no admin action required. A batch that
// already reached 'confirmed' is governed by its payment deadline
// (expireBatchPayments above), not the production date, so it's excluded
// here even once that date has passed.
export const closeExpiredProductionDates = onSchedule(
  { region: 'asia-southeast1', schedule: 'every day 01:00', timeZone: 'Asia/Kuala_Lumpur' },
  async () => {
    const cancelled = await closeExpiredProductionDatesCore(db, malaysiaTodayYMD(), messaging);
    if (cancelled > 0) {
      logger.info(`closeExpiredProductionDates: cancelled ${cancelled} unmet batch(es).`);
    }
  }
);

// Fires on every admin status update to an order (OrderManagementPage writes
// directly to Firestore, not through a callable, so a Firestore trigger is
// the only hook point here). Skips 'Order Received' — the customer just
// triggered that themselves by paying, they don't need to be told about it.
const NOTIFIABLE_STATUSES = new Set(['In Preparation', 'Out for Delivery', 'Ready for Pickup', 'Delivered']);

export const onOrderStatusChange = onDocumentUpdated(
  { document: 'orders/{orderId}', region: 'asia-southeast1' },
  async (event) => {
    const before = event.data?.before.data() as any;
    const after = event.data?.after.data() as any;
    if (!before || !after || before.status === after.status) {
      return;
    }

    if (shouldDeductIngredients(before.status, after.status)) {
      try {
        await deductIngredientsForOrderCore(db, after.items || []);
      } catch (err) {
        logger.error('Failed to deduct ingredient stock for a fulfilled order', { orderId: event.params.orderId, err });
      }
    }

    if (!NOTIFIABLE_STATUSES.has(after.status)) {
      return;
    }
    try {
      await sendPushToUserCore(db, messaging, after.customerId, {
        title: 'Order update',
        body: `${after.finalizedNumber || 'Your order'} is now "${after.status}".`,
        url: '/customer/orders',
      });
    } catch (err) {
      logger.error('Failed to send order-status push notification', { orderId: event.params.orderId, err });
    }
  }
);

// Admin-only: sends a fixed test push to the caller's own stored tokens, so
// an admin can visually confirm the whole pipeline (permission -> token ->
// send -> OS notification) actually works on their own device.
export const sendTestNotificationToSelf = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const email = request.auth?.token.email;
    if (!email || !ADMIN_EMAILS.includes(email)) {
      throw new HttpsError('permission-denied', 'Admin only.');
    }
    const result = await sendPushToUserCore(db, messaging, request.auth!.uid, {
      title: 'Test notification',
      body: 'If you can see this, push notifications are working!',
    });
    if (result.sent === 0) {
      throw new HttpsError('failed-precondition', 'No notification tokens found for your account — enable notifications first.');
    }
    return result;
  }
);
