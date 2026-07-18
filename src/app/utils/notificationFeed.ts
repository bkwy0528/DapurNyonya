import type { BatchOrder, ProductionBatch } from './batchOrders';

// Builds the header bell's notification list purely from data the customer
// already owns (their orders + pre-orders) — nothing is stored server-side,
// so this adds zero Firestore writes. Each order/pre-order contributes at
// most one item describing its latest state.

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string; // ISO event time — used for sorting and unread comparison
  // Where clicking the item navigates.
  link: string;
  // Pinned above everything else regardless of time (e.g. a payment window
  // the customer still has to act on).
  actionable?: boolean;
}

const MAX_ITEMS = 15;
const MAX_AGE_DAYS = 30;

const ORDER_STATUS_COPY: Record<string, { title: string; body: (label: string) => string }> = {
  'Order Received': { title: 'Order confirmed', body: (l) => `${l} — we've received your order.` },
  'In Preparation': { title: 'Your order is being prepared', body: (l) => `${l} is now in preparation.` },
  'Out for Delivery': { title: 'Out for delivery', body: (l) => `${l} is on its way!` },
  'Ready for Pickup': { title: 'Ready for pickup', body: (l) => `${l} is ready for collection.` },
  'Delivered': { title: 'Delivered', body: (l) => `${l} has been delivered. Enjoy!` },
  'Cancelled': { title: 'Order cancelled', body: (l) => `${l} was cancelled.` },
};

const getOrderLabel = (order: any) => order.finalizedNumber || `Order #${String(order.id || '').slice(-6)}`;

export function buildNotificationFeed(
  orders: any[],
  batchOrders: BatchOrder[],
  batchesById: Record<string, ProductionBatch>,
  now: Date = new Date()
): NotificationItem[] {
  const items: NotificationItem[] = [];

  for (const order of orders) {
    const copy = ORDER_STATUS_COPY[order.status];
    if (!copy) continue; // legacy/unknown statuses produce no notification
    // statusUpdatedAt is only stamped from Order Management going forward —
    // older orders fall back to when they were placed.
    const time = order.statusUpdatedAt || order.orderDate || order.createdAt;
    if (!time) continue;
    items.push({
      id: `order-${order.id}`,
      title: copy.title,
      body: copy.body(getOrderLabel(order)),
      time,
      link: '/customer/tracking',
    });
  }

  for (const preOrder of batchOrders) {
    const label = `${preOrder.productName} × ${preOrder.quantity}`;
    if (preOrder.status === 'waiting') {
      items.push({
        id: `batch-${preOrder.id}`,
        title: 'Pre-order placed',
        body: `${label} — we'll let you know when the batch reaches its minimum.`,
        time: preOrder.createdAt,
        link: '/customer/tracking',
      });
    } else if (preOrder.status === 'awaiting_payment') {
      const deadline = preOrder.paymentDeadline
        ? new Date(preOrder.paymentDeadline).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
        : 'the deadline';
      items.push({
        id: `batch-${preOrder.id}`,
        title: 'Payment window open 🎉',
        body: `${preOrder.productName} reached its minimum! Pay by ${deadline} to keep your spot.`,
        // confirmedAt is when the batch actually crossed its minimum — the
        // moment this became news. paymentDeadline is in the future and would
        // make the item permanently "unread", so it's only used in the copy.
        time: batchesById[preOrder.batchId]?.confirmedAt || preOrder.createdAt,
        link: '/customer/tracking',
        actionable: true,
      });
    } else if (preOrder.status === 'expired') {
      items.push({
        id: `batch-${preOrder.id}`,
        title: 'Payment window expired',
        body: `${label} — the payment window closed before payment, so the pre-order was released.`,
        time: preOrder.paymentDeadline || preOrder.createdAt,
        link: '/customer/tracking',
      });
    } else if (preOrder.status === 'cancelled') {
      items.push({
        id: `batch-${preOrder.id}`,
        title: 'Pre-order cancelled',
        body: `${preOrder.productName} didn't reach its minimum quantity. No payment was collected.`,
        // Cancellation happens when the production date closes — the date
        // itself is the closest timestamp the pre-order doc carries.
        time: `${preOrder.productionDate}T00:00:00`,
        link: '/customer/tracking',
      });
    }
    // 'paid' is skipped — it already appears above as a real order.
  }

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
  return items
    .filter((item) => new Date(item.time).getTime() >= cutoff.getTime())
    .sort((a, b) =>
      Number(!!b.actionable) - Number(!!a.actionable)
      || new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, MAX_ITEMS);
}

// Admin variant — derived from the whole orders/batchOrders/batches
// collections the admin pages already read. Only *incoming* events are
// listed (orders placed, pre-orders joined, batches confirming, payment
// windows expiring); status changes are excluded because the admin makes
// those themselves.
export function buildAdminNotificationFeed(
  orders: any[],
  batchOrders: BatchOrder[],
  batches: ProductionBatch[],
  now: Date = new Date()
): NotificationItem[] {
  const items: NotificationItem[] = [];

  for (const order of orders) {
    // Every order in this system is created already paid, so "placed" and
    // "paid" are the same event.
    const time = order.orderDate || order.createdAt;
    if (!time) continue;
    items.push({
      id: `order-${order.id}`,
      title: 'New order 💰',
      body: `${getOrderLabel(order)} — ${order.customerName || 'Customer'} · RM ${(order.total || 0).toFixed(2)}`,
      time,
      link: '/admin/orders',
    });
  }

  for (const preOrder of batchOrders) {
    // The placement event is worth showing for every pre-order regardless of
    // its current status; a later payment already surfaces above as the
    // graduated real order, so 'paid' needs no extra item.
    items.push({
      id: `batch-${preOrder.id}`,
      title: 'New pre-order',
      body: `${preOrder.customerName} pre-ordered ${preOrder.productName} × ${preOrder.quantity} for ${new Date(`${preOrder.productionDate}T00:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}.`,
      time: preOrder.createdAt,
      link: '/admin/production-calendar',
    });
    if (preOrder.status === 'expired' && preOrder.paymentDeadline) {
      items.push({
        id: `batch-expired-${preOrder.id}`,
        title: 'Pre-order payment expired',
        body: `${preOrder.customerName}'s spot for ${preOrder.productName} × ${preOrder.quantity} was released.`,
        time: preOrder.paymentDeadline,
        link: '/admin/production-calendar',
      });
    }
  }

  for (const batch of batches) {
    if (batch.confirmedAt) {
      items.push({
        id: `batchconf-${batch.id}`,
        title: 'Batch reached minimum 🎉',
        body: `${batch.productName} for ${new Date(`${batch.productionDate}T00:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })} hit its minimum — payment window is open.`,
        time: batch.confirmedAt,
        link: '/admin/production-calendar',
      });
    }
  }

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
  return items
    .filter((item) => new Date(item.time).getTime() >= cutoff.getTime())
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, MAX_ITEMS);
}

// "2h ago"-style label for the panel; falls back to a plain date once it's
// old enough that relative time stops being meaningful.
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
}
