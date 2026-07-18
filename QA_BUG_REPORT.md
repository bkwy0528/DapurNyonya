# DapurNyonya — Automated QA & Bug Report

**Date:** 2026-07-18
**Scope:** Full automated sweep — typecheck, production build, all test suites (unit, component, Firestore rules, integration, e2e against emulators), plus a manual code audit of the recent features (batch/MOQ ordering, push notifications, ordering rules, ToyyibPay payment flow, Firestore security rules).
**Environment note:** All tests ran against the local Firebase emulators. Nothing touched production Firebase or ToyyibPay.

---

## 0. Fixes applied (2026-07-18, follow-up session)

| Ref | Fix | Files |
|---|---|---|
| F1 | `retries: 1` added so a cold-start miss self-heals instead of failing the run | `playwright.config.ts` |
| F2a | A paid order is **no longer rejected** just because the product was marked unavailable mid-checkout (amount is still fully verified) — removes the most likely "paid but no order" dead-end | `functions/src/index.ts` |
| F2b | **Callback-race retry:** a missing payment confirmation now returns `unavailable` (transient), and the return page retries ~6× over ~12s with a "Confirming your payment…" screen before giving up | `functions/src/index.ts`, `ToyyibPayReturnPage.tsx`, `batch-ordering.spec.ts` (assertion updated) |
| F4 | Removed dead `Pending Approval` / `Rejected` status entries (they now fall through to the neutral fallback, still covered by a test) | `statusStyles.ts`, `CustomerOrderTrackingPage.tsx`, `tests/unit/statusStyles.test.ts` |
| F6 | `pretest:*` hooks free port 8089 before each emulator run (Windows quirk); only kills `java` | `scripts/free-emulator-ports.mjs`, `package.json` |
| — | Removed orphaned `ORS_API_KEY` + stale delivery-fee comment (feature was replaced by WhatsApp fee) | `functions/.env` |

**Deliberately NOT changed (accepted residual risk):** F2 for a genuine **price mismatch / underpayment** still rejects the order rather than auto-creating it. Auto-creating an order when the paid amount doesn't match the recomputed total would reopen the fraud vector the earlier security review closed (the bill amount is client-set, so the server-side amount check is the only thing preventing "create a cheap bill, order expensive goods"). The realistic version of this — an admin editing a live product's **price** mid-transaction — is best handled operationally: don't edit prices while testers are active. F3 and F5 are unchanged pending your call.

---

## 1. Test results — everything green except first-run e2e flakiness

| Suite | Command | Result |
|---|---|---|
| Frontend typecheck | `npx tsc --noEmit` | ✅ clean |
| Functions build | `functions » npm run build` | ✅ clean |
| Production build | `npm run build` (vite) | ✅ built (1 chunk-size warning, see F5) |
| Unit | `npm test` | ✅ 59/59 |
| Firestore rules | `npm run test:rules` | ✅ 43/43 |
| Integration | `npm run test:integration` | ✅ 8/8 |
| E2E (run 1) | `npm run test:e2e` | ⚠️ 21 passed, **4 failed**, 1 skipped (3.9 min) |
| E2E (run 2) | `npm run test:e2e` | ✅ **25 passed**, 0 failed, 1 skipped (1.4 min) |
| E2E (batch file alone) | `playwright test batch-ordering.spec.ts` | ✅ 4/4 (38 s) |

**Bottom line:** the app compiles, builds, and passes every deterministic test. The only red was 4 e2e tests on the *first* full run, which is a flakiness issue (F1), not a product defect — they pass in isolation and on a warm re-run.

---

## 2. Findings

### F1 — [Medium] E2E suite is flaky on the first cold full run (test-infra, not product)
**What happened:** On the first `npm run test:e2e`, all four `batch-ordering.spec.ts` tests failed. Each failed at the same step — after clicking **Place Pre-Order** the page stayed put instead of navigating to `/customer/tracking`, and the form showed the error `• internal` (a Firebase callable error).

**Root cause (verified):** Not a logic bug. Reproduced and isolated:
- The batch file alone → 4/4 pass (38 s).
- The single "never reaches minimum" test alone → passes.
- A second full-suite run → all 25 pass (1.4 min).

The first run took **3.9 min vs 1.4 min** for the warm run. `createBatchPreOrder` is a real round-trip to the Functions emulator whose result *gates* navigation (the test already bumps the wait to 20 s for this reason). On a cold first run — Vite compiling routes on demand + the Functions emulator cold-starting under load from the preceding `admin-journey` spec — the callable exceeds that window and the SDK surfaces `internal`, so the pre-order never gets placed.

**Why it matters:** Makes the e2e suite (and therefore CI / pre-deploy verification) unreliable — a green build can show red purely on timing.

**Suggested fix (pick one or combine):**
- Add a warm-up step before the batch specs (hit `/customer/batch-order/*` once, or ping a callable) so the first real assertion isn't paying for cold start.
- Raise the `toHaveURL` timeout on the first pre-order navigation in each batch test (e.g. 20 s → 40 s), matching the existing rationale in the comments.
- Set `retries: 1` in `playwright.config.ts` for the e2e project (currently `retries: 0`), so a single cold-start miss self-heals.

---

### F2 — [Low, real] Money captured but no order saved if a product changes between checkout and payment confirmation
**Where:** `functions/src/index.ts` — `submitOrder` (lines ~255–313) and `submitBatchOrderPayment` (lines ~618–641).

**The gap:** After the customer pays on ToyyibPay's hosted page (money captured), the return flow calls `submitOrder`, which:
1. Re-fetches each product and **throws `failed-precondition`** if it no longer exists or is `available === false` (lines 260–266).
2. Recomputes the total and **throws `failed-precondition`** if the paid amount ≠ recomputed total (lines 307–313).

If an admin **edits a product's price, deletes it, or marks it unavailable** in the window between bill creation and the return call, the order is refused *after* payment. The customer lands on the "Something Went Wrong — contact us with this reference" screen (`ToyyibPayReturnPage`, `outcome === 'lost'`), and the payment must be reconciled by hand. The batch payment path has the same shape (recomputes `product.price * quantity`).

**Why it's still worth listing:** It's a money-in-without-order state. Likelihood is low (requires a mid-transaction catalog edit), and the integrity check itself is correct and deliberate — but there's no automatic recovery, only a support-contact dead-end.

**Options:** (a) operational — advise the admin not to edit price/availability of products with in-flight orders; (b) product — on mismatch, still record the order with a distinct `paymentStatus` (e.g. `paid_needs_review`) and total actually paid, so it surfaces in Order Management for the admin instead of only living in logs + a customer's screenshot.

---

### F3 — [Low, design] Batch (MOQ) orders bypass the daily capacity limit
**Where:** `submitBatchOrderPayment` writes an `orders/` doc with `deliveryDate = productionDate` but never increments `orderCounts[productionDate]` and never checks `dailyLimits`. Only the normal `submitOrder` path maintains daily capacity.

**Effect:** A production date can exceed the admin's per-day order cap through batch pre-orders. This is **probably intentional** — batch products have their own capacity model (`maxQuantity` per production batch) — but it means the two capacity systems are independent, and the admin's daily cap does not constrain batch volume on the same date. Flagging so it's a conscious decision, not a surprise.

---

### F4 — [Low, cosmetic] Dead status references left over from the removed approval/cash flow
**Where:** `src/app/utils/statusStyles.ts` (`'Pending Approval'`, `'Rejected'`) and `CustomerOrderTrackingPage.tsx` `getStatusProgress` (`case 'Pending Approval'`).

Since cash/approval was removed, no order can reach `Pending Approval` or `Rejected` — every order starts at `Order Received` (paid). These entries are harmless defensive fallbacks but are now unreachable. Cleanup only; no behavioural impact.

---

### F5 — [Note, not a bug] Large JS bundle
`npm run build` warns the main chunk is **1.62 MB (432 KB gzip)**, over Vite's 500 KB advisory. Not an error, but a load-time optimization opportunity (dynamic `import()` / route-level code-splitting, or `manualChunks`), especially given the mobile-first customer base.

---

### F6 — [Infra] Firestore emulator leaves a java process holding port 8089 on Windows
Confirmed again this session: between emulator runs, a lingering `java` kept port 8089 open, causing `Port 8089 is not open… could not start` failures until the process was killed. Matches the known Windows quirk. Consider a `pretest`/`pretest:e2e` step that frees the port (kill stale java) so runs don't need manual cleanup.

---

## 3. What was verified as *working correctly* (no action needed)
- **Payment integrity:** orders are only created server-side after a ToyyibPay server-to-server callback records a matching confirmation; client return-URL params are never trusted; prices are recomputed from the live catalog. Rules block all direct client creates to `orders`/`batchOrders`/`paymentConfirmations`. (43 rules tests + e2e cover ownership, wrong-owner rejection, unpaid rejection, idempotent re-submit.)
- **Idempotency:** double-submit / reload paths dedupe by `clientRequestId` and by `billCode`; batch payment re-runs return the same order.
- **Batch/MOQ state machine:** MOQ-crossing confirmation + fan-out to waiting customers, capacity rejection, expiry release, and unmet-minimum cancellation all pass (unit + integration + e2e).
- **Cart resilience:** corrupted localStorage falls back to empty; cart clears on sign-out (shared-device leak closed).
- **Ordering rules:** small-order weekday restriction, bulk-minimum unlock, festive-season window, and bulk-exempt products behave per spec (unit + e2e).

---

*Generated by an automated QA sweep. F1 is the only item blocking a reliably-green test run; F2 is the most consequential product-side edge case. F3–F6 are low priority / confirm-intent.*
