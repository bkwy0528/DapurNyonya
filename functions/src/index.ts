import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';

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

    const result = (await response.json()) as Array<{ BillCode?: string; msg?: string }>;
    const billCode = result?.[0]?.BillCode;

    if (!billCode) {
      throw new HttpsError('internal', result?.[0]?.msg || 'Failed to create ToyyibPay bill.');
    }

    return { billCode, paymentUrl: `${TOYYIBPAY_BASE_URL}/${billCode}` };
  }
);

// ToyyibPay requires a reachable callback URL, but since no order exists until the
// customer's browser returns to ToyyibPayReturnPage and confirms success, there is
// nothing for this endpoint to update yet — it just acknowledges receipt.
export const toyyibpayCallback = onRequest(
  { region: 'asia-southeast1' },
  async (_req, res) => {
    res.status(200).send('OK');
  }
);
