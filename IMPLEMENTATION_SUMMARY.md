# DapurNyonya — Implementation Summary

This document describes the system exactly as implemented in the codebase at the time of writing. Every collection name, field name, status string, and function name below is taken verbatim from the source code. Features that are partially implemented or intentionally absent are stated as such.

---

## 1. Overview

DapurNyonya is a Progressive Web Application (PWA) through which a home-based food business sells handmade festive foods. Customers browse the catalogue (no account needed), build a cart, place orders for a chosen pickup or delivery date, and pay online through the ToyyibPay gateway before any order exists in the database. A second, distinct ordering mode — batch/minimum-order-quantity (MOQ) pre-ordering — lets customers reserve units of selected products against an admin-opened production date, paying only once enough pre-orders accumulate to make the batch viable.

The system has exactly two user roles: customers (any registered account) and the administrator (the business owner, identified by a hard-coded email allowlist). The administrator manages products and recipes, order fulfilment, production capacity, batch production dates, ingredient shopping lists, business settings, and revenue analytics through a dedicated admin interface in the same application.

Everything runs on a single Firebase project (`dapurnyonya-9b752`) in region `asia-southeast1`: Firebase Hosting serves the built single-page application, Cloud Firestore stores all data, Firebase Authentication handles sign-in, Firebase Cloud Messaging delivers push notifications, and Cloud Functions (2nd gen, Node.js 20) hold all payment and order-creation logic plus two scheduled jobs. There is no self-managed server. The project also carries an automated test suite (Vitest unit tests, Firestore rules tests, emulator-based integration tests for the scheduled functions, and Playwright end-to-end tests), runnable against the Firebase emulators.

---

## 2. Technology Stack

Derived from the root `package.json` and `functions/package.json`:

| Layer | Technology |
|---|---|
| Frontend framework | React 18.3.1 (peer dependency) with TypeScript 6 |
| Build tool | Vite 6 |
| Routing | React Router 7 (`react-router`), client-side SPA routing |
| Styling | Tailwind CSS 4 (via `@tailwindcss/vite`) with shadcn/ui-style primitives built on Radix UI; `motion` for animation |
| Charts | Recharts 2.15 (admin analytics) |
| Firebase client SDK | `firebase` 12.x — Auth, Firestore, Functions, Messaging |
| Server-side logic | Firebase Cloud Functions v2 (`firebase-functions` 6, Node.js 20, TypeScript), using `firebase-admin` 13 for all Firestore access and FCM sends; `@fastify/busboy` for multipart parsing |
| Payment gateway | ToyyibPay **sandbox** (`https://dev.toyyibpay.com`) — FPX online banking and DuitNow QR / e-wallets |
| Push notifications | Firebase Cloud Messaging (web push, VAPID key via `VITE_FIREBASE_VAPID_KEY`) |
| PWA tooling | `vite-plugin-pwa` 1.x with a Workbox-generated service worker, plus a separate hand-written `public/firebase-messaging-sw.js` for background push |
| Hosting | Firebase Hosting, `dist/` with a catch-all rewrite to `/index.html` |
| Testing | Vitest 4, `@firebase/rules-unit-testing`, Playwright, Testing Library |

Note: `firebase-admin` **is** a dependency of the functions package and is used by every Cloud Function; this is a change from earlier iterations of the system, where Cloud Functions had no database access.

---

## 3. Architecture

### 3.1 Division of responsibility

The browser client (React SPA) renders all UI, performs advisory validation (form checks, date rules, capacity pre-checks), and reads Firestore directly through a single data-access module (`src/app/utils/db.ts`). It also performs the admin's direct writes (products, ingredients, settings, daily limits, batch configuration, order status updates).

**Order creation, payment verification, and the batch pre-order state machine are entirely server-side**, in Cloud Functions using the Admin SDK (which bypasses security rules). Firestore security rules block clients from creating documents in `orders` and `batchOrders` outright (`allow create: if false`), so the callable functions are the only writers. The client-side wrappers in `src/app/utils/submitOrder.ts` do nothing but invoke the callables.

### 3.2 Deployed Cloud Functions

All functions live in `functions/src/index.ts` (with core logic for the scheduled jobs extracted to `functions/src/batchLifecycle.ts` and push helpers to `functions/src/pushNotifications.ts` for testability) and are deployed in region `asia-southeast1`.

**`createToyyibPayBill`** — callable; requires authentication.
1. Validates the amount and reads `TOYYIBPAY_SECRET_KEY` and `TOYYIBPAY_CATEGORY_CODE` from the functions environment (`functions/.env`; never exposed to the client or stored in Firestore).
2. POSTs to `https://dev.toyyibpay.com/index.php/api/createBill` with `billPaymentChannel: '0'`; when the client passes `paymentMethod: 'tng'` it additionally sets `enableDuitNowQR: '1'` and `chargeDuitNowQR: '0'` (DuitNow QR is an additive toggle on top of FPX in ToyyibPay's API — the FPX tab cannot be fully excluded, and DuitNow QR must also be activated for the category on ToyyibPay's dashboard to appear).
3. Returns `{ billCode, paymentUrl }`. **No Firestore read or write** — no order exists at bill-creation time.

**`toyyibpayCallback`** — HTTP endpoint (`onRequest`). ToyyibPay calls it server-to-server when a bill's outcome is known. It parses the multipart/form-data body with busboy and **writes** (Admin SDK) a document to `paymentConfirmations/{billCode}` containing `billCode`, `status`, `refno`, `amount` (converted from ToyyibPay's decimal-Ringgit string to integer cents), `orderId`, `reason`, and a `receivedAt` server timestamp. It performs no other processing and always replies `200 OK`. This record — not anything the customer's browser reports — is what the order-creating functions later trust as proof of payment.

**`submitOrder`** — callable; requires authentication. The **sole creator of normal order documents**. Steps:
1. Validates the payload (`clientRequestId`, items, `deliveryMethod` `'pickup' | 'delivery'`, `paymentMethod` `'tng' | 'fpx'` only — cash is rejected, `contactPhone`, `deliveryDate`, `billCode`).
2. Idempotency check 1: an existing order with the same `customerId` + `clientRequestId` is returned as-is. Idempotency check 2: same for `customerId` + `billCode`.
3. Recomputes every line item (name, price, unit, image) from the live `products` collection — client-supplied prices are never used — and fails if a product is missing or `available === false`. `deliveryCharge` is hard-coded `0`; `total = subtotal`.
4. Reads `paymentConfirmations/{billCode}`; requires it to exist, have `status === '1'`, and have `amount` exactly equal to the recomputed total in cents.
5. In a single Firestore transaction: re-checks the date's capacity (`dailyLimits/{deliveryDate}` with fallback to `dailyLimits/_default`; if the limit is exceeded the paid order is still **accepted** and a warning is logged — money already captured is never refused), increments the per-day sequence in `counters/orders-{YYMMDD}` to mint `finalizedNumber` (`DN-YYMMDD-NN`), writes the order with `status: 'Order Received'`, `paymentStatus: 'paid'`, `transactionId` (ToyyibPay `refno`), `paidAt`, and increments `orderCounts/{deliveryDate}`.

**Answer to the explicit architecture question:** the order document for an online payment is created **server-side by the `submitOrder` callable**, which the customer's return page invokes after redirect — but the return-page URL parameters are only a hint of what to attempt. Payment truth comes exclusively from the `paymentConfirmations` record written by `toyyibpayCallback` (ToyyibPay's own server-to-server call). The callback endpoint itself only records the reported outcome to Firestore; the verification of status and amount happens inside `submitOrder`/`submitBatchOrderPayment` against that record.

**`createBatchPreOrder`** — callable; requires authentication. Sole creator of `batchOrders` documents. Validates the product is `batchTracked` and `available`; then in a transaction on `productionBatches/{productId}_{productionDate}`: requires batch `status === 'open'` and `batchStatus !== 'cancelled'`; rejects if the batch is `'confirmed'` and its `paymentDeadline` has passed; enforces `maxQuantity` (0 = unlimited); increments `currentQuantity` and `orderCount`; if the new quantity reaches `minQuantity` for the first time, flips `batchStatus` to `'confirmed'`, stamps `confirmedAt`, and sets `paymentDeadline` = now + `settings/business.batchPaymentWindowHours` (default 48); writes the pre-order with status `'waiting'` (batch still collecting) or `'awaiting_payment'` (batch already/now confirmed). After the transaction, if the batch just confirmed, it fans out `status: 'awaiting_payment'` + the deadline to every other `'waiting'` pre-order on the batch and sends a confirmation push notification to all affected customers.

**`submitBatchOrderPayment`** — callable; requires authentication. Graduates a paid pre-order into a real order. Checks ownership, idempotency (already `'paid'` with an `orderId` returns that order), status `'awaiting_payment'`, and the `paymentDeadline`; recomputes the price from the live product; verifies the `paymentConfirmations` record exactly as `submitOrder` does; then in a transaction (with a fresh re-read to defeat concurrent double-submits) creates an `orders` document **in the exact same shape `submitOrder` produces** (with `deliveryDate` = the batch's `productionDate` and `clientRequestId` = `batch-{batchOrderId}`) and updates the `batchOrders` doc to `status: 'paid'` with the new `orderId`. Note: this path performs **no daily-capacity check and no `orderCounts` increment** — batch capacity is governed by the batch's own min/max, not `dailyLimits`.

**`expireBatchPayments`** — **scheduled, every 15 minutes** (timezone `Asia/Kuala_Lumpur`). Finds `batchOrders` with `status == 'awaiting_payment'` and `paymentDeadline < now`; per document, in a transaction, sets `status: 'expired'` and decrements the batch's `currentQuantity`/`orderCount`, releasing the reserved units; sends a best-effort push to the customer. Already-paid orders are never touched.

**`closeExpiredProductionDates`** — **scheduled, daily at 01:00** (timezone `Asia/Kuala_Lumpur`). Finds `productionBatches` with `batchStatus == 'collecting'` and `productionDate <= today`; sets each to `batchStatus: 'cancelled'`, `status: 'closed'`, marks all its `'waiting'` pre-orders `'cancelled'`, and sends a best-effort push to each affected customer. Batches that reached `'confirmed'` are excluded — their fate is governed by the payment deadline, not the production date.

**`onOrderStatusChange`** — Firestore trigger (`onDocumentUpdated` on `orders/{orderId}`). When an order's `status` changes to one of `'In Preparation'`, `'Out for Delivery'`, `'Ready for Pickup'`, `'Delivered'`, sends a push notification to the order's customer (admin status updates are direct Firestore writes from the client, so a trigger is the only server-side hook point). `'Order Received'` is deliberately not notified — the customer just caused it by paying.

**`sendTestNotificationToSelf`** — callable; admin-only (checked against the same `ADMIN_EMAILS` list duplicated from the rules). Sends a fixed test push to the caller's own stored FCM tokens so the admin can verify the pipeline end-to-end.

All functions that touch Firestore do so via `firebase-admin`. Push sending (`pushNotifications.ts`) reads `users/{uid}.fcmTokens`, uses `sendEachForMulticast`, and prunes dead tokens from the profile; sends are best-effort and never fail the surrounding operation.

---

## 4. Frontend Structure and State Management

### 4.1 Page inventory and routing (`src/app/App.tsx`)

Public routes: `/` (`WelcomePage` — redirects signed-in users to their home), `/login`, `/register`, `/forgot-password`.

Guest-accessible shopping routes (browsing and cart never require an account; checkout does): `/customer/product/:productId` (`ProductDetailPage`), `/customer/order/:productId` (`ProductOrderPage`), `/customer/batch-order/:productId` (`BatchProductPage`), `/customer/cart` (`CartPage`).

Customer routes (rendered only when `user.role === 'customer'`, else redirect to `/login`): `/customer/home`, `/customer/checkout`, `/customer/payment` (`ToyyibPayPage`), `/customer/payment-return` (`ToyyibPayReturnPage`), `/customer/tracking` (`CustomerOrderTrackingPage`), `/customer/receipt/:orderId` (`OrderReceiptPage`), `/customer/profile`.

Admin routes (rendered only when `user.role === 'admin'`): `/admin/dashboard`, `/admin/orders` (`OrderManagementPage`), `/admin/schedule` (`ProductionSchedulePage`), `/admin/production-calendar` (`ProductionCalendarPage`, titled "Pre-Orders" in the UI), `/admin/ingredients` (`IngredientEstimationPage`), `/admin/settings`, `/admin/products`, `/admin/analytics`, `/admin/profile`.

Role derivation happens in `App.tsx`'s `onAuthStateChanged` handler: an email in `ADMIN_EMAILS` (exported from `db.ts`) makes the user `admin`; anyone else is `customer`. A first-time Google sign-in auto-creates the customer's `users/{uid}` profile from the Google account data. On admin sign-in, if the `products` collection is empty, `seedDefaultProducts()` writes three sample products.

### 4.2 State management

- **Auth/user state** — root `App` component state, passed down as props. No auth context.
- **Cart** — the single React context (`CartContext`), persisted to `localStorage` under key `cart`; cleared automatically on the signed-in → signed-out transition (shared-device leak protection). Notes on re-added items are appended, not replaced.
- **Checkout → payment handoff** — `sessionStorage` keys: `pendingOrder` (the draft order, or `{ kind: 'batchOrder', ... }` for a pre-order payment), `pendingBillCode` (set by `ToyyibPayPage` after bill creation), `paymentExpiresAt` (15-minute payment-session timestamp). These are only removed after the order write succeeds.
- **Other `localStorage` keys** — `pwa-install-dismissed`, `push-notif-nudge-dismissed`.
- Everything else is per-page component state, fetched on mount via `db.ts` and re-fetched after each page's own mutations. There are no real-time Firestore listeners; the tracking page adds pull-to-refresh instead.

`src/app/utils/db.ts` is the single client data-access module — every client Firestore call goes through it. Domain helpers live in `src/app/utils/business.ts` (ordering rules, daily limits, date keys, order-number format), `src/app/utils/batchOrders.ts` (shared batch types + display helpers), `src/app/utils/ingredients.ts`, and `src/app/utils/notifications.ts` (FCM permission/token/foreground handling).

---

## 5. Implemented Modules

**Authentication & profiles.** Email/password registration (client-side password policy: ≥8 characters, letters and digits), Google sign-in (auto-profile creation), email-based password reset. Customers edit name, phone, address, notes, and a cropped/compressed profile photo in `users/{uid}`; the admin has an equivalent editor writing to `adminProfile/main`.

**Product catalogue (admin).** Full CRUD in `ProductManagementPage`. A product carries `name`, `description`, `price`, `unit` (free text), `prepDays`, `available`, `image` (base64, cropped via `react-easy-crop` and compressed client-side to fit Firestore's 1 MiB document cap), and two flags: **`bulkExempt`** ("No Minimum Quantity" — the product neither counts toward the bulk minimum nor restricts the date) and **`batchTracked`** ("Batch Production (MOQ)" — the product leaves the normal cart flow entirely and is sold by pre-order). Each product optionally holds a recipe: `ingredients[]` rows referencing the shared master list (`ingredientId`, `name`, `quantity` per unit, `unit`, plus optional `batchAmount`/`batchYield` entry helpers from which per-unit quantity is derived). Typing a new ingredient name auto-creates a master ingredient; deleting a product warns if it still appears in upcoming orders. A duplicate-name warning requires a second save press.

**Customer ordering & cart.** Home page lists available products with an admin-controlled announcement banner; `batchTracked` products route to the pre-order page and are badged "Pre-Order", others to the quantity/notes order page ("Made to Order"). Cart supports quantity edits, swipe-to-delete, appended notes, and persists in `localStorage`. Guests can do all of this; checkout is gated behind login (with return-to-cart redirect state).

**Checkout (`CheckoutPage`).** Enforced client-side at checkout (server-side enforcement of these date rules does **not** exist in `submitOrder`):
- *Preparation lead time*: earliest selectable date = today + max `prepDays` across cart items (calendar dates before it are disabled).
- *Bulk-minimum / collection-day rule*: carts whose counted units (excluding `bulkExempt` products) are below `orderingRules.bulkMinQuantity` (default 20) may only pick the configured `smallOrderWeekdays` (default `[6]`, Saturdays) — **stored in** `settings/business.orderingRules`, **enforced in** the checkout calendar's disabled-dates function and re-validated in `handlePlaceOrder`.
- *Festive-season window*: dates between `orderingRules.seasonStart` and `seasonEnd` (inclusive, `YYYY-MM-DD`) are open to small orders too; a half-configured or inverted window is treated as off (`normalizeOrderingRules`).
- *Capacity*: the selected date's `orderCounts` count is compared to `dailyLimits` (per-date doc, falling back to the reserved `_default` doc) and shown as remaining slots; a full date blocks order placement. This client check is advisory — the authoritative re-check (log-only) happens in `submitOrder`'s transaction.
- Delivery requires address + 5-digit postal code. **No delivery fee is calculated or collected**; the UI states the Grab fee is confirmed separately via WhatsApp. Payment method choice is `'tng'` (DuitNow QR / e-wallet) or `'fpx'` only. "Place Order" writes `pendingOrder` to `sessionStorage` and navigates to `/customer/payment` — nothing is written to the database.

**Pre-order / batch module (customer side, `BatchProductPage`).** Shows open (`status === 'open'`, not cancelled, future-dated) production dates for the product with live aggregate progress bars (`currentQuantity / minQuantity`, count of customers joined, remaining capacity — never individual names, by design), quantity, delivery method, and contact form. Placing the pre-order calls `createBatchPreOrder`; no payment is collected. The tracking page ("My Orders") shows pre-order cards sorted action-first (`awaiting_payment`, `waiting`, `expired`, `cancelled`), with a payment-deadline banner and an inline "Pay Now" flow that writes a `{ kind: 'batchOrder' }` `pendingOrder` and reuses the same ToyyibPay pages; expired/cancelled cards disappear 7 days after their production date (client-side filtering only — documents are never deleted). A dismissible nudge prompts customers with pre-orders to enable push notifications.

**Pre-order administration (`ProductionCalendarPage`).** Calendar of production dates (amber = has batches, green = has a confirmed batch). Per date and batch-tracked product the admin can open a date with `minQuantity`/`maxQuantity` (writing the `productionBatches` doc directly — permitted by rules), edit min/max, close/reopen the date (`status` toggle), expand the pre-order list, and cancel an individual not-yet-paid pre-order (`adminCancelBatchOrder` in `db.ts`: an atomic batched write setting the pre-order `'cancelled'` and decrementing the batch counters).

**Order tracking (customer).** Paid orders (including graduated batch orders — indistinguishable by design) show a status timeline adapted to fulfilment method (pickup: `Order Received → In Preparation → Ready for Pickup`; delivery: `Order Received → In Preparation → Out for Delivery → Delivered`), admin notes ("Message from seller"), and a link to a print-optimised receipt (`OrderReceiptPage`, ownership-checked, A4 print CSS with mobile-print font scaling).

**Order management (admin).** Search (name/phone/order number), status filter, sort by placement or delivery date, expandable cards showing items, totals (legacy `deliveryCharge` shown when > 0; otherwise "Grab fee via WhatsApp" for delivery), payment method/transaction reference, addresses, and notes. Status advances forward-only via buttons: `Order Received` → `In Preparation` → (`Ready for Pickup` | `Out for Delivery`) → `Delivered` — direct Firestore field updates (`updateOrderFields`), which is what fires the `onOrderStatusChange` push trigger. There is no approve/reject step and no manual order creation.

**Production schedule (admin, `ProductionSchedulePage`).** Groups non-rejected/non-cancelled orders by `deliveryDate` on a calendar, shows load vs limit, urgency badges (Overdue/Today/Tomorrow/Urgent/Upcoming) and suggested production stages by days remaining, and manages `dailyLimits`: per-date caps plus the **default limit** stored under the reserved document ID `_default` in the same collection.

**Ingredient planning (admin, `IngredientEstimationPage`).** **Required-vs-Purchased tracking exists in code.** Automatic mode tallies product quantities from orders with status in `['Pending Approval', 'Order Received', 'In Preparation']` and `deliveryDate >= today` (matched by `productId`, name as legacy fallback), multiplies by recipes, and aggregates by master `ingredientId` into rows showing Required, an editable Purchased amount (persisted to `ingredients/{id}.purchased`), and Remaining/Shortage, plus a printable Shopping List of shortages. A manual mode accepts typed product counts. Recipe rows predating the master list ("legacy" free-text rows) aggregate by name+unit, cannot track Purchased, and a one-time **"Migrate Ingredient Data"** button converts them (creates master ingredients, carries over old per-product `stock` values into `purchased`, rewrites recipes). Warnings surface deleted products and products without recipes.

**Analytics (admin).** `AdminDashboard` (headline cards, in-progress counts, recent orders) and `AnalyticsDashboard` (total revenue, 30-day revenue and growth vs prior 30 days, six-month revenue area chart, product sales bar chart and table, status pie chart) — all computed client-side from a full `orders` read. Revenue rule everywhere: orders with status `'Rejected'`, `'Cancelled'`, or `'Pending Approval'` are excluded.

**Settings (admin, `AdminSettingsPage`).** The complete field set actually written to `settings/business` (a full-document `setDoc`, no merge): `businessName`, `businessDescription`, `contactPhone`, `contactEmail`, `operatingHours`, `announcementEnabled`, `announcementTitle`, `announcementText`, `orderingRules` (`{ bulkMinQuantity, smallOrderWeekdays, seasonStart, seasonEnd }`), `batchPaymentWindowHours`. The page also hosts the admin's push-notification enrolment and the "Send test notification to myself" button.

---

## 6. Order Status Model

Status strings verbatim from the code. A normal order is **born paid** — there is no pre-payment or approval state.

| Transition | Performed by |
|---|---|
| *(created)* → `Order Received` | System (`submitOrder` / `submitBatchOrderPayment`), triggered by the customer's verified payment |
| `Order Received` → `In Preparation` | Admin ("Start Preparation") |
| `In Preparation` → `Ready for Pickup` | Admin (pickup orders — "Mark as Ready") |
| `In Preparation` → `Out for Delivery` | Admin (delivery orders — "Send Out for Delivery") |
| `Ready for Pickup` → `Delivered` | Admin ("Mark as Picked Up") |
| `Out for Delivery` → `Delivered` | Admin ("Mark as Delivered") |

Statuses that exist in code but are **no longer reachable** for new orders: `'Pending Approval'`, `'Rejected'`, `'Cancelled'`. They survive only in display/filter logic (`statusStyles.ts`, tracking-page banners, dashboard/analytics exclusion lists, `IngredientEstimationPage`'s `NEEDS_PREPARATION` list) so that historical documents from the pre-ToyyibPay era still render correctly. No code path writes any of them to an `orders` document (the security rules would allow the admin to, but no UI exists). The order's payment state is a separate field, always `paymentStatus: 'paid'` with `paidAt`, `transactionId`, and `billCode` set at creation.

---

## 7. Pre-Order / Batch Lifecycle

Two coupled state machines, both with verbatim status strings.

**`productionBatches` documents** (ID `{productId}_{productionDate}`): admin-controlled `status: 'open' | 'closed'` (accepting new pre-orders or not) and server-maintained `batchStatus: 'collecting' | 'confirmed' | 'cancelled'`.
- Opened by the admin from the Production Calendar with `minQuantity` / `maxQuantity` (0 = unlimited); `currentQuantity`, `orderCount`, `batchStatus`, `confirmedAt`, `paymentDeadline` are maintained only by the Cloud Functions (plus the admin's single-pre-order cancel).
- `'collecting'` → `'confirmed'`: automatically, inside `createBatchPreOrder`'s transaction, the moment `currentQuantity` reaches `minQuantity`. Sets `confirmedAt` and `paymentDeadline` = now + `settings/business.batchPaymentWindowHours` (admin-configurable in Settings; default 48, from `DEFAULT_BATCH_PAYMENT_WINDOW_HOURS`).
- `'collecting'` → `'cancelled'` (+ `status: 'closed'`): automatically by the daily scheduled job when the production date arrives unmet.

**`batchOrders` documents**: `status: 'waiting' | 'awaiting_payment' | 'paid' | 'expired' | 'cancelled'`.
- Created `'waiting'` (batch still collecting) or `'awaiting_payment'` (batch confirmed) by `createBatchPreOrder`. On confirmation, all `'waiting'` siblings are fanned out to `'awaiting_payment'` with the shared deadline, and every affected customer gets a push notification.
- `'awaiting_payment'` → `'paid'`: `submitBatchOrderPayment`, which also creates the graduated `orders` document and links it via `orderId`.
- `'awaiting_payment'` → `'expired'`: scheduled expiry (below).
- `'waiting'` → `'cancelled'`: batch cancellation (below) or admin per-order cancel; `'awaiting_payment'` → `'cancelled'` is also possible via the admin's cancel button.

**Automated behaviours** — status of each:
- **Expiry of unpaid pre-orders: deployed scheduled function** (`expireBatchPayments`, every 15 minutes, `Asia/Kuala_Lumpur`). Marks the pre-order `'expired'` and releases its reserved quantity back to the batch.
- **Cancellation of unfilled dates: deployed scheduled function** (`closeExpiredProductionDates`, daily 01:00, `Asia/Kuala_Lumpur`).
- **Cleanup/hiding of old expired/cancelled cards: client-side filtering only** — `CustomerOrderTrackingPage` hides `'expired'`/`'cancelled'` cards from 7 days after the production date (`FINISHED_VISIBLE_DAYS = 7`). No document is ever deleted; there is no server-side cleanup job.

**Invariants the code actually guarantees:**
- A `'confirmed'` batch never reverts to `'collecting'` — no code path un-confirms. Expiries and admin cancels decrement `currentQuantity` (possibly below `minQuantity`) but leave `batchStatus` untouched; the daily cancel job queries only `'collecting'` batches.
- Once a pre-order is `'paid'`, it is permanently an `orders` document ("once paid, always honored") — the expiry and cancellation jobs only ever touch `'awaiting_payment'` and `'waiting'` documents respectively.
- Batch capacity (`maxQuantity`) and MOQ accounting are transactional — two racing pre-orders cannot oversell a batch.
- **Paid pre-orders do *not* count against daily capacity**: `submitBatchOrderPayment` performs no `dailyLimits` check and no `orderCounts` increment; batch demand is bounded only by the batch's own `maxQuantity`.
- Joining a confirmed batch is allowed while its payment window is open (the newcomer goes straight to `'awaiting_payment'` under the existing deadline); it is refused after the deadline passes.

---

## 8. Payment Workflow

End to end, for both normal checkout and batch "Pay Now" (they share every payment step; only the `pendingOrder.kind` differs):

1. **Bill creation.** `ToyyibPayPage` reads `pendingOrder` from `sessionStorage` and calls `createToyyibPayBill` with the amount, customer details, `returnUrl` (`{origin}/customer/payment-return`), the hard-coded `callbackUrl` (`https://asia-southeast1-dapurnyonya-9b752.cloudfunctions.net/toyyibpayCallback`), and the chosen `paymentMethod`. Channels on the bill: FPX always (`billPaymentChannel: '0'`); DuitNow QR/e-wallets additionally enabled (`enableDuitNowQR: '1'`, customer does not bear the QR charge) when the customer chose `'tng'`.
2. **Redirect.** The page stores `paymentExpiresAt` (now + 15 minutes) and `pendingBillCode`, then navigates with `window.location.replace` — so the auto-redirecting page never enters browser history (pressing Back from ToyyibPay cannot silently create a fresh bill).
3. **Server-to-server confirmation.** Independently of the browser, ToyyibPay POSTs the outcome to `toyyibpayCallback`, which records it in `paymentConfirmations/{billCode}` (status, `refno`, amount in cents).
4. **Return handling** (`ToyyibPayReturnPage`, keyed on the `status_id` query parameter):
   - `status_id === '1'` (success): calls `submitOrder` (or `submitBatchOrderPayment` when `pendingOrder.kind === 'batchOrder'`) with the stored `billCode`. Only after the callable succeeds are `pendingOrder`/`paymentExpiresAt`/`pendingBillCode` removed and the cart cleared; the customer sees a success screen and is redirected to tracking.
   - `status_id === '3'`: **failed** — nothing was ever written; cart and draft survive; "Try Again" returns to the payment page (new bill).
   - any other value: **pending** or, if `paymentExpiresAt` has passed, **expired** — same retry path.
   - **lost**: session data missing on a successful return, or the callable threw (e.g. the callback record hasn't arrived yet, amount mismatch) — the page shows the ToyyibPay `transaction_id` as a support reference rather than spinning forever.
5. **Where/when the order is written**: only inside `submitOrder`/`submitBatchOrderPayment`'s Firestore transaction, after verifying the `paymentConfirmations` record has `status === '1'` and an `amount` equal (in cents) to the **server-recomputed** total. Stored per order: `paymentMethod`, `paymentStatus: 'paid'`, `transactionId` (`refno`), `billCode`, `paidAt`, plus `paymentNote`.
6. **Duplicate prevention**: a `started` ref guards the return page against double effects; `submitOrder` deduplicates by (`customerId`, `clientRequestId`) and by (`customerId`, `billCode`); `submitBatchOrderPayment` is idempotent on the already-paid pre-order and re-reads it inside the transaction; session keys are cleared only after success, so a reload mid-write retries into the idempotent path instead of duplicating or losing the payment.

---

## 9. Database Structure

All collections are top-level (no subcollections). Access as enforced by `firestore.rules`; "server-only" writes come from Cloud Functions via the Admin SDK, which bypasses rules.

| Collection | Document ID | Contents | Read (rules) | Write (rules) |
|---|---|---|---|---|
| `products` | `Date.now().toString()` (seeds: `'1'`–`'3'`) | catalogue item incl. `bulkExempt`, `batchTracked`, `ingredients[]` recipe, base64 `image` | public | admin |
| `ingredients` | `` `${Date.now()}-${random}` `` | master ingredient: `id`, `name`, `unit`, `purchased` | public | admin |
| `orders` | Firestore auto-ID | full order (fields in §9.1) | admin, or owner (`customerId == auth.uid`) | create: **nobody** (server-only via `submitOrder`/`submitBatchOrderPayment`); update/delete: admin |
| `paymentConfirmations` | ToyyibPay `billCode` | `billCode`, `status`, `refno`, `amount` (cents), `orderId`, `reason`, `receivedAt` | **nobody** | **nobody** (written by `toyyibpayCallback`, read by the submit callables) |
| `orderCounts` | delivery date `YYYY-MM-DD` | `{ count }` orders booked that date | public (checkout capacity display) | admin (increments happen server-side in `submitOrder`'s transaction) |
| `counters` | `orders-{YYMMDD}` | `{ count }` daily order-number sequence | admin | admin (increments happen server-side in the submit callables' transactions) |
| `settings` | `business` | fields listed in §5 "Settings" | public | admin |
| `dailyLimits` | date `YYYY-MM-DD`, or reserved `_default` | `{ limit }` per-date / default capacity cap | public | admin |
| `productionBatches` | `{productId}_{YYYY-MM-DD}` | batch config + live counters (§7) | public (live progress shown pre-login) | admin (counters/`batchStatus` maintained server-side by the batch functions) |
| `batchOrders` | Firestore auto-ID | pre-order (interface in §9.2) | admin, or owner | create: **nobody** (server-only via `createBatchPreOrder`); update/delete: admin |
| `users` | Firebase Auth UID | profile: `name`, `email`, `phone`, `address`, `notes`, `profilePicture`, `fcmTokens[]` | owner; admin may read | owner |
| `adminProfile` | `main` | admin's profile | admin | admin |

**Consistency mechanisms now in place:** the per-date `orderCounts` increment happens in the same transaction that creates the order (`submitOrder`); the daily `counters/orders-{YYMMDD}` sequence is incremented transactionally by both order-creating callables (so numbers are collision-free across flows); `productionBatches.currentQuantity`/`orderCount` are adjusted transactionally by `createBatchPreOrder` and `expireBatchPaymentsCore`, and by an atomic client batched write in `adminCancelBatchOrder`. Composite indexes exist (`firestore.indexes.json`) for the three server queries: `batchOrders(batchId, status)`, `batchOrders(status, paymentDeadline)`, `productionBatches(batchStatus, productionDate)`.

### 9.1 Order document shape (verbatim from `submitOrder`'s write; no named TypeScript interface exists for the order document — the callable input type is `SubmitOrderRequest` in `functions/src/index.ts`)

```ts
{
  id: newOrderRef.id,
  customerId,
  customerName: data.customerName || '',
  customerPhone: data.contactPhone,
  items: resolvedItems, // [{ productId, name, price, unit, image, quantity, notes }]
  subtotal,
  deliveryCharge,       // always 0 for new orders
  total,
  deliveryMethod,       // 'pickup' | 'delivery'
  deliveryAddress: deliveryMethod === 'delivery' ? data.deliveryAddress : 'Pickup',
  postalCode: deliveryMethod === 'delivery' ? (data.postalCode || '') : '',
  specialInstructions: data.specialInstructions || '',
  paymentMethod,        // 'tng' | 'fpx'
  paymentNote: data.paymentNote || '',
  status,               // 'Order Received'
  paymentStatus,        // 'paid'
  transactionId,        // ToyyibPay refno, or null
  billCode: data.billCode || null,
  paidAt: paymentStatus === 'paid' ? new Date().toISOString() : null,
  orderDate: new Date().toISOString(),
  deliveryDate: data.deliveryDate,  // YYYY-MM-DD
  finalizedNumber,      // 'DN-YYMMDD-NN'
  clientRequestId,
}
```

The admin later adds `adminNotes` via `updateOrderFields`. Legacy orders may additionally carry `rejectReason`, `paymentIntentId`, and a non-zero `deliveryCharge`.

### 9.2 Batch types (verbatim from `src/app/utils/batchOrders.ts`)

```ts
export type BatchStatus = 'collecting' | 'confirmed' | 'cancelled';

export interface ProductionBatch {
  id: string; // `${productId}_${productionDate}`
  productId: string;
  productName: string;
  productionDate: string; // YYYY-MM-DD
  status: 'open' | 'closed'; // admin toggle — closed stops accepting new pre-orders
  minQuantity: number;
  maxQuantity: number; // 0 = unlimited, same convention as dailyLimits
  currentQuantity: number;
  orderCount: number;
  batchStatus: BatchStatus;
  confirmedAt?: string | null;
  paymentDeadline?: string | null;
}

export type BatchOrderStatus = 'waiting' | 'awaiting_payment' | 'paid' | 'expired' | 'cancelled';

export interface BatchOrder {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  batchId: string;
  productionDate: string;
  productId: string;
  productName: string;
  price: number;
  unit: string;
  image: string;
  quantity: number;
  notes: string;
  deliveryMethod: 'pickup' | 'delivery';
  deliveryAddress: string;
  postalCode: string;
  specialInstructions: string;
  createdAt: string;
  status: BatchOrderStatus;
  paymentDeadline: string | null;
  billCode: string | null;
  paymentMethod: 'tng' | 'fpx' | '';
  paymentNote: string;
  orderId: string | null; // set once graduated into a real orders/ doc
}
```

### 9.3 Product type (verbatim from `src/app/pages/admin/ProductManagementPage.tsx`)

```ts
export interface ProductIngredient {
  ingredientId?: string;
  name: string;
  quantity: number;
  unit: string;
  batchAmount?: number;
  batchYield?: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  unit: string;
  prepDays: number;
  available: boolean;
  bulkExempt?: boolean;
  batchTracked?: boolean;
  ingredients?: ProductIngredient[];
}
```

### 9.4 Settings document

There is no named interface for the settings document; the authoritative shape is the object passed to `saveSettings` in `AdminSettingsPage.tsx` (fields listed in §5), with the ordering rules subtree typed as:

```ts
export interface OrderingRules {
  bulkMinQuantity: number;
  smallOrderWeekdays: number[]; // JS getDay() values (0=Sun … 6=Sat)
  seasonStart: string | null;   // YYYY-MM-DD inclusive; both null = off
  seasonEnd: string | null;
}
```

---

## 10. Security Rules Summary (`firestore.rules`)

Two helper predicates: `isSignedIn()` (`request.auth != null`) and `isAdmin()` — **the admin is identified purely by email**: `request.auth.token.email in ['yikbryan0528work@gmail.com', 'ksl_joyce@yahoo.com']`. There is no custom-claims mechanism; the same allowlist is duplicated in `db.ts` (client role routing) and `functions/src/index.ts` (`sendTestNotificationToSelf`).

Per collection: `products`, `ingredients`, `settings`, `dailyLimits`, `productionBatches`, `orderCounts` — public read, admin-only write. `orders` and `batchOrders` — read by admin or the owning customer (`resource.data.customerId == request.auth.uid`); `allow create: if false` (creation is exclusively server-side via Admin SDK); update/delete admin-only. `paymentConfirmations` — `allow read, write: if false` (Cloud Functions only). `users/{uid}` — read/write by the owner, read by admin. `adminProfile`, `counters` — admin only.

There are **no field-diff (granular update-constraint) rules** in the current file — the previous customer-cancellation diff rule was removed along with the feature. Customers now have zero write access to `orders`: since every order is paid before it exists, the rules comment notes there is nothing for a customer to legitimately change.

---

## 11. PWA Implementation

- **Manifest** (generated by `vite-plugin-pwa` as `manifest.json`): name/short name `DapurNyonya`, `display: 'standalone'`, `orientation: 'portrait'`, `start_url`/`scope`/`id` `/`, theme `#f97316` on background `#fff7ed`, 192/512 px icons in both `any` and `maskable` purposes, an iOS `apple-touch-icon`, and a 1170×2532 narrow-form-factor screenshot.
- **Service worker**: Workbox-generated. Deviations from a standard setup: `registerType: 'prompt'` — a new deploy does **not** auto-activate; `main.tsx`'s `onNeedRefresh` shows a persistent toast with an "Update" action and only then swaps versions (no `skipWaiting` mid-session). `navigateFallbackDenylist: [/^\/__\//]` keeps Firebase's reserved paths (notably the `signInWithPopup` handler at `/__/auth/handler`) from being served the cached SPA shell. Precaching covers all build assets; runtime caching is StaleWhileRevalidate for scripts/styles/workers and CacheFirst for images (30 days) and fonts (1 year). The app shell therefore loads offline; live data still requires connectivity.
- **Push service worker**: a second, hand-written `public/firebase-messaging-sw.js` is registered manually at scope `/firebase-cloud-messaging-push-scope/` (so it never fights Workbox for `/`), shows OS notifications for background FCM messages, and opens the notification's link on click. Foreground messages are surfaced as in-app toasts instead (`App.tsx` + `onMessage`).
- **Install prompt** (`InstallAppPrompt.tsx`): captures `beforeinstallprompt` for one-tap install on Chromium platforms, detects standalone mode, shows iOS users "Share → Add to Home Screen" text instead (iOS has no prompt API), and remembers dismissal in `localStorage`.

---

## 12. Legacy Feature Audit

- **Cash payment option at checkout — REMOVED.** No code path can create a cash order: checkout offers only `'tng'`/`'fpx'`, and `submitOrder` rejects any other `paymentMethod`. Read-only display mappings for historical `'cash'` orders remain in `OrderManagementPage.tsx` (payment-method label map) and `OrderReceiptPage.tsx` (`PAYMENT_LABELS`, `paymentStatus()`).
- **`Pending Approval` status and admin approve/reject workflow — REMOVED as a workflow; the status string is DORMANT display/filter handling.** No UI or function creates, approves, or rejects an order. The string survives, unreachable for new orders, in: `src/app/utils/statusStyles.ts`, `src/app/pages/customer/CustomerOrderTrackingPage.tsx` (legacy banner, explicitly commented "Legacy display only"), `src/app/pages/admin/IngredientEstimationPage.tsx` (`NEEDS_PREPARATION`), `src/app/pages/admin/ProductManagementPage.tsx` (outstanding-units check), `src/app/pages/admin/AnalyticsDashboard.tsx` and `AdminDashboard.tsx` (revenue exclusions). `'Rejected'`/`rejectReason` handling is in the same dormant category (`statusStyles.ts`, tracking page, schedule/analytics filters, plus the `.status-badge--rejected` CSS class in `src/styles/application.css`).
- **Customer self-cancellation of orders (any form) — REMOVED.** The rules grant customers no write access to `orders` at all, and no cancel UI exists. A dormant display block for historical `'Cancelled'` orders remains in `CustomerOrderTrackingPage.tsx`. (Admin cancellation of *batch pre-orders* exists, but that is a different collection and not a customer action.)
- **Distance-based delivery fee calculation — REMOVED (no code remains).** Searches for Nominatim, OpenRouteService, `calculateDeliveryDistance`, fee tiers, and the postal-code fallback return nothing in `src/`, `functions/src/`, or config; the Cloud Function no longer exists.
- **Delivery-fee charging at checkout — REMOVED.** `deliveryCharge` is hard-coded to `0` in both order-creating functions; checkout and the batch page state the Grab fee is arranged via WhatsApp. Dormant remnant: both `OrderManagementPage.tsx` and `OrderReceiptPage.tsx` still render `order.deliveryCharge` when a legacy order carries a non-zero value (each falls back to "Grab fee via WhatsApp" / "Separate (Grab)" for new delivery orders where it is 0).
- **Payment-proof image upload — REMOVED (no code remains).**
- **Manual admin order entry — REMOVED (no code remains).** `OrderManagementPage` has no creation UI, and `orders` creation is blocked by rules for all clients including the admin.

---

## 13. Implementation Status Table

| Feature | Status | Notes |
|---|---|---|
| Online payment via ToyyibPay (FPX) | **Fully implemented** | Sandbox environment (`dev.toyyibpay.com`), not production ToyyibPay |
| DuitNow QR / e-wallet channel | **Partially implemented — external dependency** | `enableDuitNowQR: '1'` is sent for `'tng'`; visible only if DuitNow QR is activated for the category on ToyyibPay's dashboard, and the FPX tab cannot be hidden for `'tng'` bills |
| Server-side payment verification | **Fully implemented** | `toyyibpayCallback` record + status/amount check inside `submitOrder`/`submitBatchOrderPayment`; client URL params never trusted |
| Server-side order creation & price recomputation | **Fully implemented** | Client `create` blocked by rules for both `orders` and `batchOrders` |
| Duplicate-order prevention | **Fully implemented** | `clientRequestId` + `billCode` dedup, transactional re-reads, post-success session cleanup |
| Pre-order lifecycle: automatic batch confirmation at MOQ | **Fully implemented** | Inside `createBatchPreOrder` transaction, with fan-out to waiting customers |
| Pre-order lifecycle: expiry of unpaid pre-orders | **Fully implemented** | Deployed scheduled function `expireBatchPayments`, every 15 minutes |
| Pre-order lifecycle: cancellation of unfilled dates | **Fully implemented** | Deployed scheduled function `closeExpiredProductionDates`, daily 01:00 MYT |
| Pre-order lifecycle: cleanup/hiding of old expired/cancelled cards | **Partially implemented** | Client-side hiding only, 7 days after production date; documents are never deleted or archived |
| Push notifications | **Fully implemented** | Batch confirmed / expired / cancelled, order-status changes (`onOrderStatusChange`), admin test send; foreground messages shown as toasts; requires per-device opt-in |
| In-app notification centre / history | **Not implemented** | Notifications are push + transient toasts only; nothing is stored or listable in-app |
| Email notifications | **Not implemented** | Only ToyyibPay's own bill email (`billContentEmail`) exists |
| Required-vs-Purchased ingredient tracking | **Fully implemented** | Master `ingredients` collection with `purchased`; legacy free-text recipe rows need the one-time in-app migration before they can track Purchased |
| Bulk minimum rule (default 20 units) | **Partially implemented — client-side only** | Stored in `settings/business.orderingRules`; enforced in the checkout calendar and validation; `submitOrder` does not re-check it server-side |
| Saturday/collection-day rule for small orders | **Partially implemented — client-side only** | Same enforcement point and same server-side gap as above |
| Festive-season windows | **Partially implemented — client-side only** | Same as above; half-configured windows treated as off |
| `bulkExempt` product flag | **Fully implemented (within the client-side rule)** | Excluded from counted units; exempt-only carts unrestricted |
| Daily capacity limits | **Partially implemented** | Advisory client pre-check (public `orderCounts` + `dailyLimits`/`_default`); transactional server re-check exists but deliberately only **logs** an overbook — a paid order is never refused |
| Batch orders vs daily capacity | **Not implemented (by design)** | Graduated batch orders bypass `dailyLimits`/`orderCounts` entirely |
| Receipts | **Fully implemented** | Print-optimised A4 receipt page with ownership check |
| Analytics | **Fully implemented (client-side)** | Full `orders` collection read and aggregated in the browser; no server aggregation |
| Order status timeline & tracking | **Fully implemented** | Method-adaptive steps; pull-to-refresh; no real-time listeners |
| PWA install + offline shell + update prompt | **Fully implemented** | Data requires connectivity; update is user-confirmed |
| Guest browsing & cart | **Fully implemented** | Checkout gated behind login with return redirect |
| Admin identity via custom claims | **Not implemented** | Hard-coded email allowlist duplicated in rules, client, and functions |

---

## 14. Key Design Decisions

1. **No order document exists until payment is verified.** `orders` creation is blocked for clients; `submitOrder` runs server-side and requires a matching `paymentConfirmations` record. A failed or abandoned payment leaves zero database residue, which in turn made the whole cash/approval/cancellation apparatus unnecessary.
2. **Payment truth comes from the gateway's server-to-server callback, not the browser.** The return URL's `status_id` only selects which screen to show and which callable to attempt; the callable trusts only what `toyyibpayCallback` recorded, and additionally matches the paid amount (in cents) against a server-recomputed total. This closed two audited gaps: client-set prices and orders minted by hand-typing the success URL.
3. **Prices are always recomputed from the live catalogue at order time** (both flows), so the client-held cart is display-only.
4. **The batch module inverts the "paid before it exists" invariant deliberately**: a pre-order must exist, accumulate, and possibly die (MOQ unmet) before money moves, so pre-orders live in a separate `batchOrders` collection and only graduate into `orders` — written in the exact shape `submitOrder` produces — once paid. Every downstream consumer (order management, ingredient planning, analytics, tracking, receipts) handles batch orders with zero changes.
5. **Paid work is never clawed back**: expiry/cancellation jobs only touch unpaid states, a confirmed batch never un-confirms, and an over-capacity paid order is accepted and logged rather than refused (the admin resolves rare overbooking manually; refusing captured money automatically was judged worse).
6. **Idempotency everywhere in the money path**: client-generated `clientRequestId`, `billCode` dedup, and transactional re-reads make reloads, double-clicks, and two-tab payments safe.
7. **Ordering rules live in `settings/business`, not code**, so the admin changes the bulk minimum, collection days, festive windows, and batch payment window without a release. Enforcement of the date rules is client-side only — accepted as sufficient for this trust model (the same customer sees the same calendar; the server still controls money and capacity-critical writes).
8. **Delivery fees were removed rather than automated.** The earlier Nominatim + OpenRouteService distance-fee system was deleted; the Grab fee varies by pickup time and is now agreed over WhatsApp, so the amount paid online is always exactly the items subtotal. Git history retains the removal ("Remove delivery fee calculation…" era commits).
9. **Single-admin identity is an email allowlist** applied in three places (rules, client routing, functions) instead of custom claims — minimal machinery for a system with one business owner (two allowed emails).
10. **Scheduled-job logic is extracted into pure core functions** (`batchLifecycle.ts`, `pushNotifications.ts`) taking an injected `db`/clock/`messaging`, because Cloud Scheduler and FCM have no emulators — the deployed handlers are thin wrappers, and the cores are integration-tested against the Firestore emulator.
11. **Push is best-effort by construction**: a failed send never fails the business operation that triggered it, and dead tokens are pruned on the fly.
12. **Images are compressed base64 strings inside Firestore documents** (crop dialog + client-side compression) — one database, no Cloud Storage bucket or second set of security rules, at the cost of Firestore's 1 MiB document ceiling policed client-side.
13. **On-demand reads, no realtime listeners**: each page fetches on mount and after its own writes (plus pull-to-refresh on tracking). Simple and cheap at this scale; cross-device changes appear on next visit rather than live.
14. **A deliberate app-update handshake** (`registerType: 'prompt'` + persistent toast) replaced silent service-worker swaps, so a customer mid-checkout is never hot-swapped onto new code.
