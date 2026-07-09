import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

const TOYYIBPAY_BASE_URL = 'https://dev.toyyibpay.com'; // sandbox — switch to https://toyyibpay.com for production

// No Firestore order exists yet at bill-creation time — the order is only recorded
// client-side after ToyyibPay confirms success on the return redirect (see
// ToyyibPayReturnPage.tsx), so a failed/abandoned payment never leaves a dead order behind.
export const createToyyibPayBill = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to make a payment.');
    }

    const { amount, customerName, customerEmail, customerPhone, returnUrl, callbackUrl } = request.data as {
      amount: number;
      customerName: string;
      customerEmail?: string;
      customerPhone?: string;
      returnUrl: string;
      callbackUrl: string;
    };

    if (!amount || amount <= 0) {
      throw new HttpsError('invalid-argument', 'Invalid amount.');
    }

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

// ToyyibPay calls this server-to-server once a bill is paid (or fails), independently
// of whatever the customer's browser does on the return redirect — submitOrder() below
// only trusts a payment as real once it sees the matching record this callback wrote,
// never the client-controlled return-page URL. Field names follow ToyyibPay's documented
// callback payload (billcode, status, amount in cents, refno); verify against the actual
// sandbox before relying on this in production, since it can't be exercised from here.
export const toyyibpayCallback = onRequest(
  { region: 'asia-southeast1' },
  async (req, res) => {
    const body = req.body as Record<string, string>;
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
      amount: body.amount ? Number(body.amount) : null,
      orderId: body.order_id || null,
      reason: body.reason || null,
      receivedAt: FieldValue.serverTimestamp(),
    });

    res.status(200).send('OK');
  }
);

// Kitchen origin — No 42, Jalan USJ 2/5A, 47600 Subang Jaya, Selangor (geocoded once via Nominatim)
const DELIVERY_ORIGIN = { lat: 3.0622477, lon: 101.5833748 };

// The ORS key stays server-side (never sent to the browser) so it can't be scraped
// out of the frontend bundle and used to burn through the free daily quota.
export const calculateDeliveryDistance = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to calculate delivery distance.');
    }

    const { lat, lon } = request.data as { lat: number; lon: number };
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      throw new HttpsError('invalid-argument', 'Missing destination coordinates.');
    }

    const apiKey = process.env.ORS_API_KEY;
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'Delivery distance service is not configured. Set ORS_API_KEY in functions/.env and redeploy.');
    }

    const url = new URL('https://api.openrouteservice.org/v2/directions/driving-car');
    url.searchParams.set('api_key', apiKey);
    // openrouteservice expects "lon,lat" order
    url.searchParams.set('start', `${DELIVERY_ORIGIN.lon},${DELIVERY_ORIGIN.lat}`);
    url.searchParams.set('end', `${lon},${lat}`);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new HttpsError('internal', 'Could not calculate delivery distance.');
    }

    const data = (await response.json()) as any;
    const meters = data?.features?.[0]?.properties?.summary?.distance;
    if (typeof meters !== 'number') {
      throw new HttpsError('internal', 'Unexpected response from routing service.');
    }

    return { distanceKm: meters / 1000 };
  }
);

// ─── Order submission ─────────────────────────────────────────────────────────
//
// The sole place an order is ever created. Both the cash-on-pickup flow and the
// post-payment ToyyibPay return flow call this instead of writing to Firestore
// directly — firestore.rules blocks direct client creates entirely (see
// firestore.rules), so this is now the only path. That closes two gaps a prior
// review found: (1) price/product data was previously taken as-is from the
// client (cart prices, product names) with nothing re-checking them against the
// real catalog; (2) a paid order was previously created just because the
// customer's browser landed on the return URL with a certain query string,
// which anyone could type in by hand. Payment is now only trusted once
// toyyibpayCallback (a server-to-server call from ToyyibPay itself) has
// recorded a matching paymentConfirmations doc.

const VALID_DELIVERY_CHARGES = [0, 5, 8, 12, 16, 20]; // mirrors src/app/utils/delivery.ts's tiers

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
  deliveryCharge: number;
  contactPhone: string;
  specialInstructions?: string;
  paymentMethod: 'cash' | 'tng' | 'fpx';
  paymentNote?: string;
  deliveryDate: string;
  customerName: string;
  billCode?: string; // required when paymentMethod is 'tng' or 'fpx'
}

export const submitOrder = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to place an order.');
    }
    const customerId = request.auth.uid;
    const data = request.data as SubmitOrderRequest;
    const { clientRequestId, items, deliveryMethod, deliveryCharge, paymentMethod } = data;

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
    const chargeIsValidForMethod = deliveryMethod === 'pickup' ? deliveryCharge === 0 : deliveryCharge > 0;
    if (!VALID_DELIVERY_CHARGES.includes(deliveryCharge) || !chargeIsValidForMethod) {
      throw new HttpsError('invalid-argument', 'Invalid delivery charge.');
    }
    if (paymentMethod === 'cash' && deliveryMethod === 'delivery') {
      throw new HttpsError('invalid-argument', 'Cash is only available for pickup.');
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
      if (product.available === false) {
        throw new HttpsError('failed-precondition', `${product.name} is no longer available.`);
      }
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

    const subtotal = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const total = subtotal + deliveryCharge;

    let paymentStatus: 'paid' | null = null;
    let transactionId: string | null = null;
    let status = 'Pending Approval';

    if (paymentMethod === 'tng' || paymentMethod === 'fpx') {
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
        throw new HttpsError('failed-precondition', 'Payment has not been confirmed yet. Please wait a moment and try again.');
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

      paymentStatus = 'paid';
      transactionId = confirmation.refno || null;
      status = 'Order Received';
    }

    const orderId = await db.runTransaction(async (tx) => {
      const newOrderRef = db.collection('orders').doc();

      // Capacity is re-checked inside the same transaction that increments the
      // count, so two orders racing for the last slot can no longer both slip
      // through (the checkout-time pre-check is only advisory). A paid online
      // order is never refused here — the money is already captured by this
      // point and checkout pre-checked capacity before payment started — so it
      // is created regardless and the (rare) overbooking is logged for the
      // admin to resolve.
      const countRef = db.collection('orderCounts').doc(data.deliveryDate);
      const limitSnap = await tx.get(db.collection('dailyLimits').doc(data.deliveryDate));
      const countSnap = await tx.get(countRef);
      const limit = limitSnap.exists ? Number((limitSnap.data() as any).limit) || 0 : 0;
      const booked = countSnap.exists ? Math.max(0, Number((countSnap.data() as any).count) || 0) : 0;
      if (limit > 0 && booked >= limit) {
        if (paymentStatus !== 'paid') {
          throw new HttpsError('failed-precondition', 'The selected date is fully booked. Please choose another date.');
        }
        logger.warn('Paid order accepted over the daily capacity limit', {
          deliveryDate: data.deliveryDate, limit, booked,
        });
      }

      let finalizedNumber: string | null = null;

      if (status === 'Order Received') {
        const dateKey = getDateKey();
        const counterRef = db.collection('counters').doc(`orders-${dateKey}`);
        const counterSnap = await tx.get(counterRef);
        const next = (counterSnap.exists ? (counterSnap.data() as any).count : 0) + 1;
        tx.set(counterRef, { count: next });
        finalizedNumber = generateFinalOrderNumber(next);
      }

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
