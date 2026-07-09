# DapurNyonya — Implementation Summary

DapurNyonya is a Progressive Web Application (PWA) that enables a home-based food business to manage its product catalogue, customer orders, production schedule, and revenue analytics through a single system. Customers browse products, place orders for a chosen delivery or pickup date, and pay either by cash or through an online payment gateway; the business owner (a single administrator) reviews and fulfils those orders through a dedicated admin interface. The system is fully deployed on Google Firebase and is installable on mobile and desktop devices as a standalone application.

This document describes the system exactly as implemented in the codebase.

---

## 1. Technology Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 with TypeScript |
| Build tool | Vite 6 |
| Routing | React Router v7 (client-side routing, single-page application) |
| Styling | Tailwind CSS v4 with shadcn/ui component primitives (built on Radix UI) |
| Charting | Recharts (analytics visualisations) |
| Authentication | Firebase Authentication (email/password and Google sign-in) |
| Database | Cloud Firestore (NoSQL document database, region `asia-southeast1`) |
| Server-side logic | Firebase Cloud Functions v2 (Node.js 20, TypeScript) |
| Hosting | Firebase Hosting (serves the built SPA with a catch-all rewrite) |
| Payment gateway | ToyyibPay (Malaysian gateway supporting FPX online banking; sandbox environment) |
| Geocoding | Nominatim (OpenStreetMap) — converts customer addresses to coordinates |
| Route distance | OpenRouteService Directions API — computes real driving distance for delivery fees |
| PWA tooling | `vite-plugin-pwa` with a Workbox-generated service worker |

The entire system runs on a single Firebase project (`dapurnyonya-9b752`). There is no self-managed server; all infrastructure is serverless.

---

## 2. Software Architecture

### 2.1 Overall Design

The system follows a **client-centric serverless architecture**. The React application in the browser performs all business logic — order construction, capacity checks, fee calculation, status transitions, and analytics aggregation — and reads and writes Cloud Firestore directly through the Firebase client SDK. Access control is enforced declaratively by Firestore Security Rules rather than by an intermediary API server.

Cloud Functions are used only where a browser-side implementation would be impossible or insecure: specifically, as **secret-holding proxies** to two third-party HTTP APIs. The two deployed functions are:

1. **`createToyyibPayBill`** (callable, authenticated) — creates a payment bill on the ToyyibPay gateway using a secret API key that never leaves the server, and returns the hosted payment URL to the browser.
2. **`calculateDeliveryDistance`** (callable, authenticated) — given the customer's coordinates, queries the OpenRouteService Directions API (again using a server-held API key) for the driving distance from the business's kitchen location, and returns the distance in kilometres.

A third HTTP endpoint, **`toyyibpayCallback`**, exists solely to satisfy the payment gateway's requirement for a reachable server callback URL; it acknowledges the request and performs no processing, because order creation is handled on the browser's return journey (Section 5.3).

Notably, the Cloud Functions have **no Firestore access at all** — the `firebase-admin` SDK is not a dependency. Every database read and write in the system originates from the authenticated client and is governed by security rules.

### 2.2 Frontend Structure

The application is organised as follows:

- **`src/app/App.tsx`** — the composition root. It subscribes to Firebase's authentication state, derives the signed-in user's role, and defines the full route table. Route protection is performed inline: the `/customer/*` route group renders only when the user's role is `customer`, and `/admin/*` only for `admin`; all other access redirects to the login page.
- **`src/app/pages/`** — one component per screen, split into public/auth pages, `customer/` pages, and `admin/` pages (full inventory in Section 3).
- **`src/app/components/ui/`** — reusable presentation components: shadcn/ui primitives (Button, Card, Input, Dialog, Select, Badge, etc.) plus custom shared components (`PageContainer`, `FormSection`, `LoadingSpinner`, and the global `Header` navigation bar with role-aware links and a live cart badge).
- **`src/app/components/pwa/InstallAppPrompt.tsx`** — the "install this app" banner (Section 7).
- **`src/app/context/CartContext.tsx`** — the shopping cart, the application's single React Context provider (Section 2.3).
- **`src/app/utils/`** — the service layer:
  - `db.ts` — **the single data-access module.** Every Firestore operation in the application goes through this file's functions (product CRUD, order creation and updates, counters, settings, daily limits, user and admin profiles). No page talks to Firestore directly.
  - `business.ts` — domain helpers: password-policy validation, date-key generation, preparation-lead-time calculation, and finalized order-number formatting (`DN-YYMMDD-XX`).
  - `delivery.ts` — delivery-fee tiers by distance, the 20 km maximum delivery radius, and a postal-code-based fallback pricer.
  - `geocode.ts` — address-to-coordinates lookup via Nominatim.
  - `image.ts` — client-side image compression (Section 4.1).
  - `statusStyles.ts` — the mapping from each order status to its badge styling.
- **`src/styles/`** — three layered stylesheets: `tailwind.css` (Tailwind v4 CSS-first configuration), `theme.css` (design tokens — colour palette, typography scale, radii — exposed as CSS custom properties and mapped into Tailwind's theme), and `application.css` (named, reusable component classes such as the app header, status badges, and info/warning boxes, kept deliberately small; one-off styling stays as inline Tailwind utilities in JSX).

### 2.3 State Management and Data Flow

State is deliberately kept simple:

- **Authentication state** lives in the root `App` component and is passed to pages as a prop.
- **The shopping cart** is the one piece of truly global client state, held in `CartContext` and persisted to `localStorage`, so the cart survives page reloads and browser restarts.
- **Checkout hand-off state** (the order being built, and a payment-session expiry timestamp) is held in `sessionStorage` while the customer moves between the checkout, payment, and confirmation screens.
- **Everything else is local component state.** Each page fetches the data it needs from `db.ts` on mount and re-fetches after its own mutations. There is no global cache, no Redux-style store, and no real-time listeners — data is read on demand.

---

## 3. Implemented Modules

### 3.1 Authentication and User Accounts

- **Registration** — customers register with name, phone number, email, and a password validated against a live on-screen policy checklist (minimum length, letters and numbers). Registration creates both a Firebase Authentication account and a profile document in the `users` collection.
- **Google sign-in** — available on both the login and registration screens. A first-time Google sign-in automatically creates the customer's profile document.
- **Login** — a single shared login screen for both roles; after sign-in the user is routed to the customer home or admin dashboard according to their role.
- **Password reset** — a self-service "forgot password" flow using Firebase's email-based reset.
- **Role model** — the system has exactly one administrator, identified by email address. The same check is implemented independently in two places: in the client (to decide which interface to render) and in the Firestore Security Rules (to enforce admin-only database permissions server-side). Every other authenticated account is a customer.
- **Profiles** — customers can edit their name, phone, address, notes, and profile photo; the administrator has an equivalent profile editor backed by a dedicated singleton document.

### 3.2 Product Catalogue (Admin)

The Product Management page provides full CRUD over the catalogue. Each product has a name, description, price, selling unit (free text, e.g. "pack of 12"), preparation lead time in days, an availability toggle, an image, and an optional **ingredient recipe** — a list of `{ingredient name, quantity, unit}` rows expressing what is needed to produce one unit of the product. The recipe feeds the Ingredient Planning module (Section 3.7). Product images can be uploaded (and are automatically compressed, Section 4.1) or supplied as an external URL. Deletion requires confirmation via a dialog.

### 3.3 Customer Ordering

- **Home / catalogue** — customers see all available products, plus an announcement banner whose content and visibility the administrator controls from Settings.
- **Product detail and ordering** — each product has a detail page (price, unit, preparation-time notice) and an order page where the customer sets a quantity and optional special instructions before adding to the cart.
- **Cart** — quantities can be adjusted or items removed (with a confirmation dialog); a running subtotal is shown. The cart persists across sessions via `localStorage`.

### 3.4 Checkout

The checkout page assembles the complete order:

- **Delivery date selection** — the earliest selectable date is derived from the longest preparation lead time among the cart's items, so a customer cannot order a three-day-preparation item for tomorrow.
- **Daily capacity enforcement** — the administrator can cap the number of orders per date (Section 3.6). At order placement, checkout re-checks the chosen date's current order count against its limit and blocks the order if the date is full.
- **Fulfilment method** — pickup (free) or delivery. For delivery, the customer enters an address and postal code, and the system computes a **distance-based delivery fee**: the address is geocoded via Nominatim, the real driving distance from the kitchen is obtained from the `calculateDeliveryDistance` Cloud Function, and a tiered fee is applied (RM5 / RM8 / RM12 / RM16 / RM20 for distances up to 3 / 6 / 10 / 15 / 20 km). Addresses beyond 20 km are out of delivery range: the fee shows as unavailable and order placement is blocked until the customer switches to pickup. If geocoding or routing fails for any reason, the system degrades gracefully to a coarser postal-code-prefix fee table so checkout never breaks. A request-sequencing guard discards stale fee responses when the customer edits the address rapidly.
- **Payment method** — cash (on pickup/delivery), Touch 'n Go, or FPX online banking. Both online options are processed through the same ToyyibPay hosted checkout.

On "Place Order," the order object is written to `sessionStorage` and the customer is routed to the cash confirmation screen or the online payment flow. **No database record exists yet at this point** — the timing of order creation is a deliberate design decision described in Section 5.

### 3.5 Order Tracking, Cancellation, and Receipts (Customer)

- **My Orders** — lists the customer's orders with a visual progress stepper whose steps adapt to the fulfilment method (pickup vs delivery).
- **Cancellation** — a customer may cancel an order only while it is still awaiting admin approval. The cancellation is enforced at the database-rules level: the rules permit a customer's update only if the order currently has status `Pending Approval`, the new status is `Cancelled`, and no other fields are touched. Cancelling also releases the order's slot in that date's capacity counter.
- **Receipt** — a printable itemised receipt per order (items, charges, delivery fee, payment details, finalized order number), with an ownership check so customers can only view their own receipts.

### 3.6 Order Management and Production Scheduling (Admin)

- **Order Management** — a searchable, filterable list of all orders with expandable detail cards. The administrator can:
  - **Approve** a cash order (`Pending Approval` → `Order Received`), which also mints the human-readable finalized order number `DN-YYMMDD-XX` from an atomic per-day counter;
  - **Reject** an order with a mandatory reason (recorded on the order), which atomically releases the date's capacity slot;
  - **Advance status** through the fulfilment pipeline — `Order Received` → `In Preparation` → `Ready for Pickup` (pickup orders) or `Out for Delivery` (delivery orders) → `Delivered`;
  - Attach private **admin notes** to any order.
- **Production Schedule** — a calendar view grouping active orders by delivery date. Each date shows its order load against its capacity limit, and the administrator can set or clear a per-date order limit from this page. Orders are annotated with urgency badges (Overdue / Today / Tomorrow / Urgent / Upcoming) and a suggested production stage based on days remaining (prepare ingredients → start cooking → packaging day).

### 3.7 Ingredient Planning (Admin)

The Ingredient Planning page computes a consolidated shopping list. In automatic mode it takes every order that still needs preparation (status `Pending Approval`, `Order Received`, or `In Preparation`, with a delivery date of today or later), tallies the quantity ordered per product, multiplies each product's tally by its per-unit ingredient recipe, and aggregates identical ingredients across products (matched case-insensitively by name and unit) into a single line each. A manual mode lets the administrator type arbitrary product counts and run the same calculation. Products that lack a recipe are flagged in a warning so the administrator knows their ingredients are not included. The result is presented as an interactive checklist with editable quantities.

### 3.8 Analytics (Admin)

Two levels of reporting exist, both computed client-side from the orders collection:

- **Dashboard** — at-a-glance cards: orders today, orders pending approval, orders due in the next seven days, total revenue, and the most recent orders.
- **Analytics Dashboard** — total revenue with month-over-month growth rate, total and completed order counts, a six-month revenue trend chart, a top-products-by-revenue chart, a full product performance table (units sold and revenue per product), and an order-status distribution chart, all rendered with Recharts.

A single revenue rule is applied consistently across every metric: **orders with status `Rejected`, `Cancelled`, or `Pending Approval` never count as revenue** — only approved, in-progress, and delivered orders do.

### 3.9 Business Settings (Admin)

The Settings page edits the public business profile (name, description, contact phone and email) and the customer-facing announcement banner (on/off toggle, title, body text). It also displays a read-only note that payment-gateway credentials are configured server-side (Section 6.3).

---

## 4. Notable Cross-Cutting Implementations

### 4.1 Image Handling

Product images and profile photos are stored as base64 strings inside Firestore documents rather than in a separate file store. Because Firestore caps documents at 1 MiB, every upload passes through a client-side compression utility that scales the image so no dimension exceeds 1200 px, then re-encodes it as JPEG at progressively lower quality (80% → 60% → 40% → 25%) until the result fits within 500 KB, rejecting the upload if it cannot.

### 4.2 Atomic Counters and Slot Accounting

Two counter mechanisms guarantee consistency without a server:

- **Capacity counters** (`orderCounts/{date}`) — incremented in the *same atomic batch write* as order creation, and decremented in the same batch as rejection or cancellation, so the per-date order count can never drift from the orders themselves.
- **Order-number sequence** (`counters/orders-{dateKey}`) — a Firestore transaction increments a per-day counter to produce collision-free sequential order numbers, regardless of which flow (admin approval of a cash order, or the customer's own successful online payment) mints the number.

---

## 5. Payment Workflow

Payment is the most carefully designed workflow in the system, built around one principle: **an order document is only ever created once the customer's commitment is certain.**

### 5.1 Cash

After checkout, the customer sees a confirmation screen summarising the order. Only on the explicit "Confirm & Submit Order" click is the order written to Firestore, with status **`Pending Approval`** — cash orders always require the administrator's manual approval before entering production. A submission guard disables the button during the write to prevent duplicate orders from double-clicks.

### 5.2 Online (Touch 'n Go / FPX via ToyyibPay)

1. The browser calls the `createToyyibPayBill` Cloud Function, which creates a bill on ToyyibPay's sandbox using server-held credentials and returns the hosted payment page URL.
2. Before redirecting, the client records a **15-minute payment-session expiry timestamp**. The pending order and the cart are left fully intact — nothing has been written to the database.
3. The customer completes (or abandons) payment on ToyyibPay's hosted page, then is redirected back to the application's payment-return page with a status code and transaction ID.

### 5.3 Return Handling and Order Creation

- **Success** — the pending order is first *removed* from `sessionStorage` (so a page refresh cannot create the order twice), then written to Firestore with status **`Order Received`**, `paymentStatus: 'paid'`, the payment timestamp, the gateway transaction ID, and a freshly minted finalized order number. Paid orders **skip admin approval entirely** — the payment itself is the commitment. The cart is then cleared and the customer is taken to order tracking.
- **Failure** — nothing is written; the cart and pending order survive, and a "Try Again" button returns the customer directly to the payment step to generate a fresh bill.
- **Pending / expired** — if the customer returns without a definitive status, the 15-minute expiry timestamp distinguishes a still-live session from an expired one, with appropriate messaging and the same retry path.
- **Lost session** — if the gateway reports success but the pending order is missing (e.g. the return landed in a different browser), the customer is shown their payment reference and told to contact the business.

A consequence of this design is that **a failed or abandoned payment leaves zero residue in the database** — there are no ghost "unpaid" orders to clean up, and the order pipeline contains only real orders.

### 5.4 Order Status Model

The complete lifecycle, as enforced by the admin interface and security rules:

```
                       (cash)                    (admin)
Checkout ──► Pending Approval ──► Order Received ──► In Preparation ──► Ready for Pickup ──► Delivered
                │        │              ▲                                └► Out for Delivery ─► Delivered
     (customer) │        │ (admin)      │ (online payment success —
                ▼        ▼              │  enters here directly, paid)
            Cancelled  Rejected      Checkout
```

---

## 6. Database Structure

Cloud Firestore, single database, all collections top-level (no subcollections):

| Collection | Document ID | Contents | Read access | Write access |
|---|---|---|---|---|
| `products` | product ID | name, description, price, unit, prep days, availability, base64 image, ingredient recipe | Public | Admin |
| `orders` | auto-generated | customer identity and contact, line items, subtotal / delivery charge / total, fulfilment method and address, payment method and status, order status, delivery date, finalized number, transaction ID, rejection reason, admin notes | Owner or admin | Create: signed-in, own orders only. Update: admin, or owner performing a rules-constrained cancellation. Delete: admin |
| `orderCounts` | delivery date | `{count}` — orders booked for that date | Public (enables checkout capacity check) | Any signed-in user (maintained atomically alongside order writes) |
| `counters` | `orders-{dateKey}` | `{count}` — daily order-number sequence | Signed-in | Signed-in (transactional increment) |
| `settings` | `business` | business name, description, contacts, announcement banner | Public | Admin |
| `dailyLimits` | date | `{limit}` — admin-set capacity cap | Public | Admin |
| `users` | Firebase UID | customer profile (name, phone, email, address, notes, photo) | Owner; admin may read | Owner |
| `adminProfile` | `main` | administrator's profile | Admin | Admin |

The security rules file defines two helper predicates — "is signed in" and "is the admin" (email comparison) — and applies them per collection as above. The customer-cancellation rule is the most granular: it uses Firestore's document-diff capability to permit an owner's update only when exactly the status and cancellation-timestamp fields change, and only for the `Pending Approval` → `Cancelled` transition.

---

## 7. Progressive Web App Implementation

The application is a fully installable PWA:

- **Web app manifest** — complete, with app identity, standalone display mode, theme colours, and a full icon set including maskable icons for Android and Apple touch icons and a launch splash image for iOS.
- **Service worker** — generated by Workbox at build time with an auto-update registration strategy. All build assets (HTML, JS, CSS, images, fonts) are precached, with explicit runtime caching policies: stale-while-revalidate for scripts and styles, cache-first for images (30-day expiry) and fonts (1-year expiry). This gives the application an offline-capable shell — the interface loads without a network connection, while live data (products, orders) still requires connectivity.
- **Install prompt** — a custom in-app banner that captures the browser's `beforeinstallprompt` event to offer one-tap installation on Android and desktop, detects when the app is already running in standalone mode, and — because iOS Safari does not support the install-prompt API — shows iOS users step-by-step "Share → Add to Home Screen" instructions instead. Dismissal is remembered in `localStorage`.

---

## 8. Key Design Decisions

1. **Serverless, client-executed business logic.** All domain logic runs in the browser against Firestore, secured by declarative rules; Cloud Functions exist only to hold third-party API secrets. This eliminated an entire API-server tier — its code, hosting, and maintenance — at the cost of trusting rules (rather than server code) as the enforcement boundary, an appropriate trade-off for a single-business system.

2. **Deferred order creation.** No order document is created until the customer explicitly confirms (cash) or the payment gateway confirms payment (online). The database therefore never contains abandoned or unpaid orders, which keeps the admin's order pipeline, capacity counters, and revenue figures clean by construction rather than by cleanup.

3. **Asymmetric approval flow.** Cash orders require manual admin approval (`Pending Approval`), since a cash promise carries no commitment; paid online orders bypass approval and enter the pipeline directly as `Order Received`. The approval step doubles as the administrator's manual backstop for date-capacity management.

4. **Single-admin role by email.** With exactly one business owner as the target user, admin identity is an email-address check applied consistently in the client and in the security rules, avoiding the additional machinery of a role-claims system.

5. **Secrets isolated in server environment variables.** The ToyyibPay secret key, category code, and OpenRouteService API key exist only as Cloud Functions environment variables — they never appear in the client bundle, in Firestore, or in version control (the env file is gitignored).

6. **Distance-based delivery pricing with graceful degradation.** Delivery fees reflect real driving distance (free-tier geocoding and routing APIs, no billing dependency), with a hard 20 km service radius; any failure in the geocoding/routing chain silently falls back to a simpler postal-code tariff so a third-party outage can never block checkout.

7. **Images inside the database.** Storing compressed base64 images directly in Firestore documents avoids introducing a second storage service and its access rules; enforced client-side compression keeps every document safely under Firestore's size limit.

8. **Atomicity for shared counters.** Capacity counters are updated in the same batch write as the order they account for, and order numbers come from a transactional counter — the two places where concurrent writes could corrupt state are exactly the two places using Firestore's atomic primitives.

9. **On-demand reads rather than live listeners.** Pages fetch data when opened and after their own actions. For a single administrator and a modest customer base, this keeps the data layer simple and predictable; the trade-off is that changes made elsewhere appear on the next visit to a page rather than instantly.

10. **UX tuned for the customer demographic.** The customer base skews middle-aged to senior, which shaped concrete choices: large touch targets, persistent inline error messages rather than transient ones, extended (6-second) toast notifications, a minimal number of choices per screen, and a step-by-step visual order tracker.
