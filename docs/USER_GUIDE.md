# DapurNyonya User Guide

DapurNyonya is the online shop for a home kitchen that cooks in small, made-fresh batches. There is no warehouse and no ready stock — everything is cooked for a date. This guide explains how ordering works for **customers**, how the shop is run from the **admin side**, and walks through one complete example at the end.

---

## The two kinds of products

Every product in the shop carries one of two badges, and the badge decides how you order it:

| | 🟠 Made to Order | 🟠 Pre-Order |
|---|---|---|
| **What it means** | Cooked for the delivery date you choose | Only cooked once enough customers commit to the same production date |
| **How you order** | Add to cart → checkout | Join a production date directly (no cart) |
| **When you pay** | Immediately, at checkout | Only after the group reaches the minimum |
| **Example** | Kueh, cookies | Bak chang |

---

## Customer guide

### Getting started

Sign in with your **email and password**, or tap the **Google** button to use your Google account. Your profile keeps your name and phone number so the kitchen can contact you.

### Ordering a Made to Order product

1. **Add items to your cart** and go to checkout.
2. **Choose a delivery date.** The calendar only allows dates far enough ahead for the kitchen to prepare (each product needs a certain number of days' notice). If a date is fully booked, the page tells you and shows how many slots remain on other dates.
3. **Choose pickup or delivery.** For delivery, fill in your address and 5-digit postcode.
4. **Pay online** — DuitNow QR / e-wallet (Touch 'n Go, GrabPay, Boost, etc.) or FPX online banking. **Your order only exists once payment succeeds.** There is no cash option and nothing to "approve" — paid means confirmed.
5. **Track it** in the **Orders** tab. Your order moves through: *Order Received → In Preparation → Ready for Pickup / Out for Delivery → Delivered*.

**Take note:**

- **Small orders can usually only choose Saturdays.** Orders below the shop's minimum quantity are limited to Saturday delivery, except during festive periods the shop opens up, or for products marked as exempt. The checkout explains this whenever a date is blocked.
- **Delivery fee is not charged online.** The shop confirms the actual Grab delivery fee with you over WhatsApp after your order.
- If the payment page expires before you finish paying, nothing is charged — just start checkout again.

### Pre-ordering a Pre-Order product

Pre-Order products skip the cart. Tapping one opens its pre-order page instead.

1. **Pick a production date.** Each open date shows live progress — for example *"15 / 20 · 4 customers joined · Waiting for minimum"*. Only totals are shown, never other customers' names.
2. **Place your pre-order** — quantity, pickup or delivery, and any notes. **You pay nothing at this step.** Your quantity is reserved immediately and counts toward the minimum.
3. **Wait for the minimum.** Your pre-order appears under **"Your Pre-Orders"** in the Orders tab, showing the group's progress.
4. **When the minimum is reached, the batch is confirmed** and a payment window opens (typically 48 hours — the shop sets this). Your card jumps to the top of the Orders tab with a **Pay Now** button and a countdown.
5. **Pay, and your pre-order becomes a real order** — from here it is tracked exactly like a normal order.

**Take note:**

- **Check the app after you pre-order.** Notifications currently appear in the app only — there is no email or push notification yet. If you never come back, you can miss your payment window.
- **Miss the payment deadline → your pre-order expires.** Your reserved quantity is released to other customers. Nothing is charged, but you also won't get the food.
- **If the production date arrives without reaching the minimum, the whole batch is cancelled automatically.** Nobody ever paid, so there is nothing to refund.
- **Once you have paid, you are safe.** A paid pre-order is a confirmed order no matter what happens to the rest of the group.
- If you join a date that is **already confirmed**, you skip the waiting step and go straight to the payment window.
- Expired and cancelled pre-order cards clean themselves up — they disappear from your list about a week after the production date.

---

## Admin guide

### The navigation bar, left to right

| Page | What it's for |
|---|---|
| **Dashboard** | Today at a glance |
| **Orders** | All **paid** orders. Move each through *Start Preparation → Ready / Out for Delivery → Delivered* |
| **Products** | Add and edit products. Two important switches: *exempt from bulk minimum* (can be ordered any day) and *Batch Production (MOQ)* (moves the product to the pre-order flow) |
| **Schedule** | The workload calendar — what needs cooking each date, from paid orders. Also where you set **daily capacity** (maximum orders per day) |
| **Pre-Orders** | The pre-order control room — open production dates, set minimums, watch sign-ups |
| **Ingredients** | Shopping list calculated from upcoming paid orders, with Required vs Purchased tracking |
| **Analytics** | Revenue and product performance (paid orders only) |
| **Settings** | Business rules: bulk minimum, Saturday rule, festive-season windows, and the pre-order **payment window** |

### Running a pre-order (your only recurring job)

1. Open **Pre-Orders** and pick a date on the calendar.
2. For the product you want to cook that day, tap **Open this date** and enter the **minimum** quantity (and an optional maximum). That's it — the date is now live for customers.
3. Watch sign-ups fill in. Expanding a date shows every customer's pre-order; you can **cancel an individual pre-order** if needed (their reserved quantity is released back to the group).
4. You can **Close** a date to stop new sign-ups, and **Reopen** it later.

### What happens automatically (you never do these)

- When sign-ups reach the minimum, the batch **confirms itself** and every customer's payment window opens.
- Customers who don't pay in time are **expired automatically** (checked every 15 minutes) and their quantity is released.
- If a production date arrives without reaching its minimum, the batch **cancels itself** that morning.
- Payments **verify themselves** — ToyyibPay reports directly to the server. You never need to check receipts.

### Things to remember

- **A confirmed batch never un-confirms.** Even if someone's payment expires afterwards and the count drops below the minimum, everyone who paid is honored — cook for the paid orders.
- **Pre-order dates don't appear on Schedule until people pay.** While a date is still collecting sign-ups it lives only on the Pre-Orders page. Once customers pay, their orders show up in Orders, Schedule, and Ingredients like any other order.
- **Two separate capacity controls:** daily capacity (Schedule) limits how many normal orders can land on a date; a pre-order Max limits units of that one product on that date. Paid pre-orders do **not** count against the daily capacity.
- The delivery fee is arranged over WhatsApp — the app never charges it.

---

## A complete example, start to finish

**Setup (once):** add products in **Products**. Normal items need nothing special; for bak chang, switch on *Batch Production* and set the price. Check the payment window in **Settings** (48 hours is the default).

**A normal week:** customers buy made-to-order items and pay → they appear in **Orders** and **Schedule** → cook → mark *Delivered*. **Ingredients** says what to buy.

**A chang production run:**

1. The admin opens **Pre-Orders**, picks next Saturday, and opens it for Chang with a minimum of 20.
2. Customers see Chang badged **Pre-Order**, tap it, and join — 4 units, then 12, then 20 — paying nothing.
3. At 20, the batch **confirms itself**. Every customer's app now shows **Pay Now** with a 48-hour countdown.
4. Most pay, and their pre-orders become real orders on the admin's Orders page. One customer forgets — after 48 hours the system expires them automatically and frees their 3 units for anyone else.
5. On Saturday, **Schedule** and **Ingredients** show exactly what to cook and buy — only for customers who actually paid. Cook, mark orders *Delivered*, done.

**And if it fails?** If only 9 of 20 sign up by Saturday, the batch cancels itself that morning. Customers see *"Cancelled — Minimum Not Reached"*, and since nobody ever paid, there is nothing to refund.

---

## Quick answers

**A customer missed their payment window — can I let them back in?**
Their expired pre-order can't be revived, but if the date is still open (and under its maximum) they can simply place a new pre-order and pay straight away.

**Does anyone need a refund when a batch cancels?**
No. Money only ever changes hands after a batch is confirmed, so a cancelled batch has no payments to undo.

**Why is a chang date not showing on the Schedule calendar?**
Schedule only shows paid orders. The date appears there once customers start paying; until then, manage it from Pre-Orders.

**Where do customers see the delivery fee?**
They don't — the shop confirms the Grab fee over WhatsApp after the order. The app charges food only.
