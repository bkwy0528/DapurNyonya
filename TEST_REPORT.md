# DapurNyonya — Pre-Release QA Report (20 Jul 2026)

Full regression pass over customer and admin flows ahead of the public release /
ToyyibPay production switch. All testing ran locally against the Firebase
emulators (Firestore + Auth + Functions) — no production reads, writes, or
payments were made.

## 1. Automated test results

| Suite | Command | Result |
|---|---|---|
| Production build (Vite + PWA) | `npm run build` | ✅ clean |
| App typecheck | `npx tsc --noEmit` | ✅ clean |
| Functions build | `cd functions && npm run build` | ✅ clean |
| Unit + component (vitest, jsdom) | `npm test` | ✅ 67/67 |
| Firestore security rules | `npm run test:rules` | ✅ 43/43 |
| Integration (real Functions logic vs emulator) | `npm run test:integration` | ✅ 14/14 |
| End-to-end (Playwright vs emulators) | `npm run test:e2e` | ✅ 28 passing, 1 conditionally skipped* |

\* The push-notification opt-in e2e skips itself in sandboxed/headless
environments where Chromium has no notification service; it runs for real on a
normal dev machine. Its inverse case (blocked permission shows a clear message)
runs and passes.

### Coverage by area

- **Customer flow**: register/login validation, browse, product page, cart
  (quantity, badge, notes), checkout validation (all missing fields at once,
  empty cart guard), date gating (prep-days minimum + admin-opened windows),
  handoff to payment page, tracking, receipt, no-cancel guarantee.
- **Admin flow**: dashboard metrics, product add (with and without photo crop
  dialog), order fulfilment status progression visible to the customer,
  Pre-Orders production calendar (open a date, cancel a pre-order, quantity
  release), **Schedule page availability windows + orders-grouped-by-range
  (new)**, **notification bell for both roles (new)**.
- **Batch/MOQ**: MOQ crossing fan-out, under-minimum batch, joining a confirmed
  batch, real `submitBatchOrderPayment` (unpaid refusal, wrong-owner refusal,
  graduation, idempotent repeat call), admin cancel releasing quantity.
- **Server logic**: ingredient auto-deduction transitions + clamping, batch
  payment expiry + date closing (idempotency), push token pruning.
- **Security rules**: every collection's read/write matrix, including
  client-create bans on orders/batchOrders and paymentConfirmations lockout.

## 2. Test-suite corrections made in this pass

You warned some cases might be stale — two were, and both were failures of the
test, not the app:

1. **`tests/e2e/batch-ordering.spec.ts`** — the admin Pre-Orders page now
   renders expanded pre-order rows as `{customer} — {qty} {product name}`
   (label rework), but two tests still expected the old `{qty} {unit}` text
   ("3 piece"). Updated to the current labels; both tests now pass.

2. **Missing coverage for the newest features** — added two spec files:
   - `tests/e2e/admin-schedule.spec.ts`: availability window added through the
     real calendar UI, persistence across reload, removal (seeded window left
     intact); clicking a saved window lists orders inside it grouped per day
     with the priority badge.
   - `tests/e2e/notification-bell.spec.ts`: customer bell unread badge → panel
     item → navigates to tracking → badge cleared; admin bell "New order" item
     → navigates to Order Management.

`TESTING_CHECKLIST.md` in the repo root is fully obsolete (localStorage-era
demo credentials, approve/reject workflow, cash payment — none exist anymore).
Recommend deleting it or replacing it with the manual checklist in §5 so it
can't mislead a future reader/marker.

## 3. Code review findings (no blockers)

- **Dead capacity code in `submitOrder`** (`functions/src/index.ts:331-353,388`):
  it still reads `dailyLimits`/`_default` and increments `orderCounts`, though
  the capacity feature was removed from the UI. It can never refuse an order
  (log-only), so it's harmless — clean up whenever you next deploy functions
  anyway. The matching `orderCounts`/`dailyLimits` rules and rules tests can go
  at the same time.
- **`submitOrder` trusts `deliveryDate`**: open-window/prep-days gating is
  client-side only. Money is safe (totals are recomputed server-side), worst
  case is an out-of-window date appearing in admin pages. Fine for launch;
  optional hardening later.
- **Schedule page availability list**: adding the exact same range twice
  creates duplicate rows (React key collision warning, cosmetic). Overlapping
  ranges are allowed and behave correctly (union).
- **Uncommitted push-notification changes** (sw, App.tsx, ProfilePage,
  notifications.ts): reviewed line by line — the toggle now reflects the actual
  device subscription (`isPushRegistered`) instead of the irreversible browser
  permission, disable actually invalidates the token server-side, and
  foreground pushes show the same OS notification as background ones. Logic is
  sound and typechecks; real push delivery can't be exercised in the emulator,
  so verify once on a real phone after deploying (see §5). **Commit these
  before releasing.**

## 4. Release verdict

**Yes — ready for a public soft launch once the go-live steps below are done.**
Every automated suite is green, the security-rules matrix is solid (clients
cannot create/modify orders, totals and payment status are server-verified),
and the newest admin features are now covered by tests. Nothing found in this
pass blocks release.

## 5. Go-live steps (ToyyibPay sandbox → production)

1. Commit the pending push-notification changes.
2. In `functions/src/index.ts:23` change
   `TOYYIBPAY_BASE_URL = 'https://dev.toyyibpay.com'` → `'https://toyyibpay.com'`.
3. In `functions/.env` set the **production** `TOYYIBPAY_SECRET_KEY` and
   `TOYYIBPAY_CATEGORY_CODE` (from the prod-verified account). Confirm DuitNow
   QR is activated for that production category, or QR payments will fail.
4. Deploy: `firebase deploy --only hosting,functions,firestore:rules`.
5. Manual smoke test on production (things the emulator cannot cover):
   - [ ] One real low-value order end-to-end: checkout → ToyyibPay → return
         page → order appears with number/receipt → callback recorded.
   - [ ] One real batch pre-order payment (confirm a small batch, pay, verify
         it graduates into a numbered order).
   - [ ] Push notifications on a real Android phone: enable in Profile, have
         admin change the order status, notification arrives (app closed and
         open); toggle off and confirm no further pushes.
   - [ ] Receipt print/share on iPhone (fix from the payment-flow rework was
         never verified on-device).
   - [ ] Admin: confirm the Schedule page shows the real open windows and the
         production calendar reflects live batches.
6. After the smoke test, delete the test order/pre-order from Firestore (same
   cleanup approach as previous audits).

Suggested rollout: soft-launch to a few friendly customers for the first days
before announcing widely — the first real ToyyibPay callback under production
keys is the one step no local test can prove.
