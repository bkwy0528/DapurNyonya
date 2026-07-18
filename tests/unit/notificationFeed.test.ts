import { describe, it, expect } from 'vitest';
import { buildNotificationFeed, buildAdminNotificationFeed, formatRelativeTime } from '../../src/app/utils/notificationFeed';
import type { BatchOrder, ProductionBatch } from '../../src/app/utils/batchOrders';

const NOW = new Date('2026-07-18T12:00:00');

const order = (overrides: Record<string, any> = {}) => ({
  id: 'order-abc123',
  status: 'Order Received',
  orderDate: '2026-07-17T10:00:00',
  ...overrides,
});

const preOrder = (overrides: Partial<BatchOrder> = {}): BatchOrder => ({
  id: 'bo1',
  batchId: 'batch1',
  productId: 'p1',
  productName: 'Kuih Lapis',
  unit: 'box',
  quantity: 2,
  price: 25,
  customerId: 'c1',
  customerName: 'Alice',
  customerPhone: '0123456789',
  productionDate: '2026-07-20',
  status: 'waiting',
  createdAt: '2026-07-16T09:00:00',
  paymentDeadline: null,
  ...overrides,
} as BatchOrder);

describe('buildNotificationFeed', () => {
  it('maps each order status to a notification and uses statusUpdatedAt when present', () => {
    const items = buildNotificationFeed(
      [order({ status: 'Out for Delivery', statusUpdatedAt: '2026-07-18T09:00:00' })],
      [], {}, NOW
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Out for delivery');
    expect(items[0].body).toContain('Order #abc123');
    expect(items[0].time).toBe('2026-07-18T09:00:00');
  });

  it('falls back to orderDate when statusUpdatedAt is missing (pre-existing orders)', () => {
    const items = buildNotificationFeed([order()], [], {}, NOW);
    expect(items[0].time).toBe('2026-07-17T10:00:00');
  });

  it('prefers the finalized order number as the label', () => {
    const items = buildNotificationFeed([order({ finalizedNumber: 'Order #0042' })], [], {}, NOW);
    expect(items[0].body).toContain('Order #0042');
  });

  it('skips legacy/unknown order statuses', () => {
    const items = buildNotificationFeed(
      [order({ status: 'Pending Approval' }), order({ id: 'x', status: 'Rejected' })],
      [], {}, NOW
    );
    expect(items).toHaveLength(0);
  });

  it('skips paid pre-orders (they already appear as real orders)', () => {
    const items = buildNotificationFeed([], [preOrder({ status: 'paid' })], {}, NOW);
    expect(items).toHaveLength(0);
  });

  it('pins an open payment window above newer items and stamps it with the batch confirmedAt', () => {
    const batch = { id: 'batch1', confirmedAt: '2026-07-17T08:00:00' } as ProductionBatch;
    const items = buildNotificationFeed(
      [order({ status: 'Delivered', statusUpdatedAt: '2026-07-18T11:00:00' })],
      [preOrder({ status: 'awaiting_payment', paymentDeadline: '2026-07-19T08:00:00' })],
      { batch1: batch },
      NOW
    );
    expect(items[0].title).toContain('Payment window open');
    expect(items[0].time).toBe('2026-07-17T08:00:00'); // not the future deadline
    expect(items[0].actionable).toBe(true);
    expect(items[1].title).toBe('Delivered');
  });

  it('describes expired and cancelled pre-orders', () => {
    const items = buildNotificationFeed(
      [],
      [
        preOrder({ id: 'bo2', status: 'expired', paymentDeadline: '2026-07-17T20:00:00' }),
        preOrder({ id: 'bo3', status: 'cancelled', productionDate: '2026-07-15' }),
      ],
      {},
      NOW
    );
    expect(items.map(i => i.title)).toEqual(['Payment window expired', 'Pre-order cancelled']);
    expect(items[1].body).toContain('No payment was collected');
  });

  it('drops items older than 30 days and caps the list at 15', () => {
    const old = order({ id: 'old', statusUpdatedAt: '2026-06-01T00:00:00' });
    const recent = Array.from({ length: 20 }, (_, i) =>
      order({ id: `o${i}`, statusUpdatedAt: `2026-07-${String(10 + (i % 8)).padStart(2, '0')}T0${i % 10}:00:00` }));
    const items = buildNotificationFeed([old, ...recent], [], {}, NOW);
    expect(items).toHaveLength(15);
    expect(items.find(i => i.id === 'order-old')).toBeUndefined();
  });

  it('sorts newest first', () => {
    const items = buildNotificationFeed(
      [
        order({ id: 'a', statusUpdatedAt: '2026-07-16T10:00:00' }),
        order({ id: 'b', statusUpdatedAt: '2026-07-18T10:00:00' }),
      ],
      [], {}, NOW
    );
    expect(items.map(i => i.id)).toEqual(['order-b', 'order-a']);
  });
});

describe('buildAdminNotificationFeed', () => {
  const batch = (overrides: Partial<ProductionBatch> = {}): ProductionBatch => ({
    id: 'batch1',
    productId: 'p1',
    productName: 'Kuih Lapis',
    productionDate: '2026-07-20',
    status: 'open',
    minQuantity: 10,
    maxQuantity: 0,
    currentQuantity: 5,
    orderCount: 3,
    batchStatus: 'collecting',
    ...overrides,
  } as ProductionBatch);

  it('lists a new order with customer name and total, linking to Order Management', () => {
    const items = buildAdminNotificationFeed(
      [order({ customerName: 'Alice', total: 50, orderDate: '2026-07-18T10:00:00' })],
      [], [], NOW
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toContain('New order');
    expect(items[0].body).toContain('Alice');
    expect(items[0].body).toContain('RM 50.00');
    expect(items[0].link).toBe('/admin/orders');
  });

  it('lists pre-order placements for every status, plus an extra item when payment expired', () => {
    const items = buildAdminNotificationFeed(
      [],
      [
        preOrder({ id: 'bo1', status: 'waiting' }),
        preOrder({ id: 'bo2', status: 'expired', paymentDeadline: '2026-07-17T20:00:00', createdAt: '2026-07-15T09:00:00' }),
      ],
      [], NOW
    );
    expect(items.map(i => i.title)).toEqual(['Pre-order payment expired', 'New pre-order', 'New pre-order']);
    expect(items.every(i => i.link === '/admin/production-calendar')).toBe(true);
  });

  it('announces a batch that reached its minimum', () => {
    const items = buildAdminNotificationFeed(
      [], [],
      [batch({ batchStatus: 'confirmed', confirmedAt: '2026-07-17T08:00:00' }), batch({ id: 'batch2' })],
      NOW
    );
    expect(items).toHaveLength(1); // unconfirmed batch contributes nothing
    expect(items[0].title).toContain('Batch reached minimum');
  });

  it('does not report admin-made status changes — an order contributes one item regardless of status', () => {
    const items = buildAdminNotificationFeed(
      [order({ status: 'Delivered', statusUpdatedAt: '2026-07-18T11:00:00', orderDate: '2026-07-16T10:00:00' })],
      [], [], NOW
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toContain('New order');
    expect(items[0].time).toBe('2026-07-16T10:00:00'); // placement time, not the status change
  });
});

describe('formatRelativeTime', () => {
  it('formats minutes, hours, and days', () => {
    expect(formatRelativeTime('2026-07-18T11:59:40', NOW)).toBe('Just now');
    expect(formatRelativeTime('2026-07-18T11:30:00', NOW)).toBe('30m ago');
    expect(formatRelativeTime('2026-07-18T07:00:00', NOW)).toBe('5h ago');
    expect(formatRelativeTime('2026-07-15T12:00:00', NOW)).toBe('3d ago');
  });

  it('falls back to a plain date after a week', () => {
    expect(formatRelativeTime('2026-07-01T12:00:00', NOW)).toMatch(/1 Jul/);
  });
});
