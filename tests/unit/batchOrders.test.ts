import { describe, it, expect } from 'vitest';
import {
  getBatchPaymentWindowHours,
  getBatchProgressLabel,
  getBatchStatusLabel,
  getRemainingToMinimum,
  getRemainingCapacity,
  DEFAULT_BATCH_PAYMENT_WINDOW_HOURS,
  ProductionBatch,
} from '../../src/app/utils/batchOrders';

const baseBatch: ProductionBatch = {
  id: 'chang_2026-07-18',
  productId: 'chang',
  productName: 'Chang',
  productionDate: '2026-07-18',
  status: 'open',
  minQuantity: 20,
  maxQuantity: 60,
  currentQuantity: 12,
  orderCount: 3,
  batchStatus: 'collecting',
};

describe('getBatchPaymentWindowHours', () => {
  it('defaults when settings has no value', () => {
    expect(getBatchPaymentWindowHours(null)).toBe(DEFAULT_BATCH_PAYMENT_WINDOW_HOURS);
    expect(getBatchPaymentWindowHours({})).toBe(DEFAULT_BATCH_PAYMENT_WINDOW_HOURS);
  });

  it('uses a configured positive value', () => {
    expect(getBatchPaymentWindowHours({ batchPaymentWindowHours: 24 })).toBe(24);
  });

  it('falls back to the default for invalid values', () => {
    expect(getBatchPaymentWindowHours({ batchPaymentWindowHours: 0 })).toBe(DEFAULT_BATCH_PAYMENT_WINDOW_HOURS);
    expect(getBatchPaymentWindowHours({ batchPaymentWindowHours: -5 })).toBe(DEFAULT_BATCH_PAYMENT_WINDOW_HOURS);
    expect(getBatchPaymentWindowHours({ batchPaymentWindowHours: 'soon' })).toBe(DEFAULT_BATCH_PAYMENT_WINDOW_HOURS);
  });
});

describe('getBatchProgressLabel', () => {
  it('formats current/minimum with the product name', () => {
    expect(getBatchProgressLabel(baseBatch)).toBe('12 / 20 Chang');
  });
});

describe('getBatchStatusLabel', () => {
  it('labels a collecting batch as waiting', () => {
    expect(getBatchStatusLabel(baseBatch)).toBe('Waiting for Minimum Quantity');
  });

  it('labels a confirmed batch', () => {
    expect(getBatchStatusLabel({ ...baseBatch, batchStatus: 'confirmed' })).toBe('Confirmed — payment open');
  });

  it('labels a cancelled batch', () => {
    expect(getBatchStatusLabel({ ...baseBatch, batchStatus: 'cancelled' })).toBe('Cancelled — minimum not reached');
  });
});

describe('getRemainingToMinimum', () => {
  it('reports how many more units are needed', () => {
    expect(getRemainingToMinimum(baseBatch)).toBe(8);
  });

  it('never goes negative once the minimum is met or exceeded', () => {
    expect(getRemainingToMinimum({ ...baseBatch, currentQuantity: 20 })).toBe(0);
    expect(getRemainingToMinimum({ ...baseBatch, currentQuantity: 25 })).toBe(0);
  });
});

describe('getRemainingCapacity', () => {
  it('reports how many more units fit before the maximum', () => {
    expect(getRemainingCapacity(baseBatch)).toBe(48);
  });

  it('is null (unlimited) when maxQuantity is 0', () => {
    expect(getRemainingCapacity({ ...baseBatch, maxQuantity: 0 })).toBeNull();
  });

  it('never goes negative once at or over capacity', () => {
    expect(getRemainingCapacity({ ...baseBatch, currentQuantity: 60 })).toBe(0);
    expect(getRemainingCapacity({ ...baseBatch, currentQuantity: 70 })).toBe(0);
  });
});
