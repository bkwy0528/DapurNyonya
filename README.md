# DapurNyonya — Order Tracking & Production Scheduling PWA

A Progressive Web App for a home-based Nyonya food business: customers order
handmade festive foods online and pay through ToyyibPay, while the owner runs
order fulfilment, batch production planning, ingredient shopping lists, and
revenue analytics from a built-in admin interface.

Developed as a BSc Computer Science capstone (final-year) project.

**Live app:** https://dapurnyonya-9b752.web.app

## Features

**Customers**
- Browse the catalogue, build a cart, and check out for a chosen pickup or
  delivery date — dates are gated by each product's preparation time and by
  order windows the admin opens (e.g. a festive season).
- Pay online via ToyyibPay (FPX online banking or DuitNow QR / e-wallets).
  An order only exists after payment is verified server-side.
- **Batch pre-orders (MOQ):** reserve units of selected products against an
  admin-opened production date; pay only once the batch reaches its minimum
  quantity. Under-minimum batches auto-cancel with nothing charged.
- Live order tracking with a status timeline, digital receipts, an in-app
  notification feed, and optional web push notifications.
- Installable as a PWA (Android/iOS/desktop) with offline-capable shell.

**Admin**
- Dashboard with daily metrics; full order management with status progression
  (received → in preparation → ready/out for delivery → delivered).
- Product and recipe management (photos with in-browser crop/compress,
  preparation days, batch-tracked flag).
- Pre-Orders production calendar: open/close production dates, set min/max
  quantities, monitor batch progress, cancel pre-orders.
- Schedule page: open date windows for regular ordering and view upcoming
  orders grouped per day with production-stage prompts.
- Ingredient planning with a master Required/Purchased list; stock is
  auto-deducted server-side when orders reach a fulfilled status.
- Analytics (revenue, product mix) and business settings.

## Architecture

- **React SPA** (Vite, TypeScript, Tailwind 4 + Radix primitives) reads
  Firestore directly; Firestore **security rules** are the enforcement
  boundary for everything the client does.
- **Cloud Functions** (2nd gen, `asia-southeast1`) hold everything that must
  not be client-controlled: ToyyibPay bill creation (API keys stay
  server-side), the server-to-server payment callback, order creation
  (`submitOrder` recomputes prices from the live catalogue and only trusts the
  callback's payment confirmation — clients cannot create orders at all), the
  batch pre-order state machine, scheduled batch expiry/closing jobs,
  ingredient deduction, and FCM push sends.
- **Firebase**: Hosting, Firestore, Auth, Cloud Messaging. No self-managed
  server.

A detailed, code-accurate description of every collection, function, and
status flow is in [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md).
End-user instructions are in [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

## Getting started

Prerequisites: Node.js 20+, Java 11+ (for the Firebase emulators), and the
Firebase CLI (`npm i -g firebase-tools`).

```bash
npm install
cd functions && npm install && cd ..
```

Configuration:

| File | Purpose |
|---|---|
| `src/firebase.ts` | Firebase web app config (safe to be public; security comes from Firestore rules + Functions) |
| `.env` | `VITE_FIREBASE_VAPID_KEY` — Web Push certificate public key (Firebase Console → Cloud Messaging) |
| `functions/.env` | `TOYYIBPAY_SECRET_KEY`, `TOYYIBPAY_CATEGORY_CODE` — never committed |

Run:

```bash
npm run dev            # against production Firebase
npm run dev:emulator   # against local emulators (no real data touched)
```

## Testing

All suites run locally against the Firebase emulators — no production reads,
writes, or payments.

| Command | Suite |
|---|---|
| `npm test` | Unit + component tests (Vitest, jsdom) |
| `npm run test:rules` | Firestore security-rules tests |
| `npm run test:integration` | Cloud Functions logic against the Firestore emulator |
| `npm run test:e2e` | Playwright end-to-end (customer + admin journeys) |

The latest full QA pass and release checklist are in
[TEST_REPORT.md](TEST_REPORT.md).

## Deployment

```bash
npm run build
firebase deploy --only hosting,functions,firestore:rules
```

Payments run against the ToyyibPay **sandbox** (`dev.toyyibpay.com`) during
development; switching to production means changing `TOYYIBPAY_BASE_URL` in
`functions/src/index.ts`, supplying production credentials in
`functions/.env`, and redeploying functions.

## Repository layout

```
src/                  React app (customer + admin pages, shared components, utils)
functions/src/        Cloud Functions (payments, orders, batch lifecycle, push)
firestore.rules       Security rules — client access boundary
public/               PWA icons + dedicated FCM service worker
tests/                unit / component / rules / integration / e2e suites
docs/USER_GUIDE.md    End-user guide (customers + admin)
```

## Attributions

Third-party assets and libraries are listed in
[ATTRIBUTIONS.md](ATTRIBUTIONS.md). Product photos are illustrative samples
from Unsplash.
