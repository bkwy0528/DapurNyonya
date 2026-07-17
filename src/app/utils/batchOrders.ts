// ─── Batch/MOQ production ordering ───────────────────────────────────────────
//
// Products flagged `batchTracked` skip the normal instant cart/checkout flow
// entirely. Instead customers place a pre-order against an admin-opened
// production date (productionBatches/{batchId}); no payment is collected
// until enough pre-orders accumulate to reach that date's minimum quantity.
// See functions/src/index.ts (createBatchPreOrder, submitBatchOrderPayment,
// expireBatchPayments, closeExpiredProductionDates) for the authoritative,
// transactionally-safe state machine — this file only holds shared types and
// pure display helpers for the client.

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
  confirmedAt?: string | null; // ISO string, set once batchStatus becomes 'confirmed'
  paymentDeadline?: string | null; // ISO string, set alongside confirmedAt
}

export type BatchOrderStatus = 'waiting' | 'awaiting_payment' | 'paid' | 'expired' | 'cancelled';

export interface BatchOrder {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  batchId: string;
  productionDate: string; // YYYY-MM-DD — copied from the batch at creation, used as the graduated order's deliveryDate
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
  createdAt: string; // ISO string
  status: BatchOrderStatus;
  paymentDeadline: string | null;
  billCode: string | null;
  paymentMethod: 'tng' | 'fpx' | '';
  paymentNote: string;
  orderId: string | null; // set once graduated into a real orders/ doc
}

export const DEFAULT_BATCH_PAYMENT_WINDOW_HOURS = 48;

export function getBatchPaymentWindowHours(settings: any): number {
  const hours = Number(settings?.batchPaymentWindowHours);
  return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_BATCH_PAYMENT_WINDOW_HOURS;
}

// Aggregate-only progress label — never shows who ordered, per the batch
// ordering privacy requirement.
export function getBatchProgressLabel(batch: ProductionBatch): string {
  return `${batch.currentQuantity} / ${batch.minQuantity} ${batch.productName}`;
}

export function getBatchStatusLabel(batch: ProductionBatch): string {
  if (batch.batchStatus === 'cancelled') return 'Cancelled — minimum not reached';
  if (batch.batchStatus === 'confirmed') return 'Confirmed — payment open';
  return 'Waiting for Minimum Quantity';
}

export function getRemainingToMinimum(batch: ProductionBatch): number {
  return Math.max(0, batch.minQuantity - batch.currentQuantity);
}

export function getRemainingCapacity(batch: ProductionBatch): number | null {
  if (!batch.maxQuantity || batch.maxQuantity <= 0) return null; // unlimited
  return Math.max(0, batch.maxQuantity - batch.currentQuantity);
}
