import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  validatePassword,
  getDateKey,
  generateFinalOrderNumber,
  getMaxPrepDaysFromCart,
  normalizeOpenOrderRanges,
  isDateOrderable,
  getBatchPrepStartDate,
  isBatchDateOrderable,
} from '../../src/app/utils/business';

describe('validatePassword', () => {
  it('accepts an 8+ character alphanumeric password', () => {
    expect(validatePassword('abc12345')).toEqual([]);
  });

  it('rejects passwords under 8 characters', () => {
    expect(validatePassword('abc123')).toContain('Password must be at least 8 characters');
  });

  it('rejects a letters-only password', () => {
    expect(validatePassword('abcdefgh')).toContain('Password must be alphanumeric (letters and numbers)');
  });

  it('rejects a digits-only password', () => {
    expect(validatePassword('12345678')).toContain('Password must be alphanumeric (letters and numbers)');
  });

  it('can report both problems for a short, digits-only password', () => {
    expect(validatePassword('123')).toEqual([
      'Password must be at least 8 characters',
      'Password must be alphanumeric (letters and numbers)',
    ]);
  });
});

describe('getDateKey', () => {
  it('formats a given date as YYMMDD', () => {
    expect(getDateKey(new Date(2026, 6, 9))).toBe('260709'); // 9 Jul 2026
  });

  it('zero-pads single-digit months and days', () => {
    expect(getDateKey(new Date(2027, 0, 5))).toBe('270105'); // 5 Jan 2027
  });
});

describe('generateFinalOrderNumber', () => {
  afterEach(() => vi.useRealTimers());

  it('combines today\'s date key with a zero-padded sequence', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 9));
    expect(generateFinalOrderNumber(1)).toBe('DN-260709-01');
    expect(generateFinalOrderNumber(12)).toBe('DN-260709-12');
  });

  it('does not truncate a sequence past two digits', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 9));
    expect(generateFinalOrderNumber(123)).toBe('DN-260709-123');
  });
});

describe('getMaxPrepDaysFromCart', () => {
  it('defaults to 1 day for an empty cart', () => {
    expect(getMaxPrepDaysFromCart([])).toBe(1);
  });

  it('defaults to 1 day when items have no prepDays set', () => {
    expect(getMaxPrepDaysFromCart([{ name: 'x' }])).toBe(1);
  });

  it('picks the longest prep time across every item in the cart', () => {
    expect(getMaxPrepDaysFromCart([{ prepDays: 1 }, { prepDays: 3 }, { prepDays: 2 }])).toBe(3);
  });
});

describe('normalizeOpenOrderRanges', () => {
  it('defaults to no open ranges (closed) when the settings doc has none', () => {
    expect(normalizeOpenOrderRanges(undefined)).toEqual([]);
    expect(normalizeOpenOrderRanges(null)).toEqual([]);
  });

  it('keeps a valid range', () => {
    const ranges = normalizeOpenOrderRanges([{ start: '2026-06-01', end: '2026-06-19' }]);
    expect(ranges).toEqual([{ start: '2026-06-01', end: '2026-06-19' }]);
  });

  it('accepts a single-day range (start equals end)', () => {
    const ranges = normalizeOpenOrderRanges([{ start: '2026-06-19', end: '2026-06-19' }]);
    expect(ranges).toEqual([{ start: '2026-06-19', end: '2026-06-19' }]);
  });

  it('drops an inverted range (end before start)', () => {
    expect(normalizeOpenOrderRanges([{ start: '2026-06-19', end: '2026-06-01' }])).toEqual([]);
  });

  it('drops malformed dates', () => {
    expect(normalizeOpenOrderRanges([{ start: 'June 1', end: '2026-06-19' }])).toEqual([]);
  });

  it('keeps valid ranges while dropping bad ones from the same list', () => {
    const ranges = normalizeOpenOrderRanges([
      { start: '2026-06-01', end: '2026-06-19' },
      { start: '2026-07-19', end: '2026-07-01' },
    ]);
    expect(ranges).toEqual([{ start: '2026-06-01', end: '2026-06-19' }]);
  });
});

describe('isDateOrderable', () => {
  const ranges = normalizeOpenOrderRanges([{ start: '2026-06-01', end: '2026-06-19' }]);

  it('includes both boundary dates', () => {
    expect(isDateOrderable('2026-06-01', ranges)).toBe(true);
    expect(isDateOrderable('2026-06-19', ranges)).toBe(true);
  });

  it('excludes dates outside the window', () => {
    expect(isDateOrderable('2026-05-31', ranges)).toBe(false);
    expect(isDateOrderable('2026-06-20', ranges)).toBe(false);
  });

  it('is always false when no ranges are configured (closed by default)', () => {
    expect(isDateOrderable('2026-06-10', [])).toBe(false);
  });
});

describe('getBatchPrepStartDate', () => {
  it('subtracts prepDays from the production date', () => {
    expect(getBatchPrepStartDate('2026-07-20', 4)).toBe('2026-07-16');
  });

  it('crosses a month boundary correctly', () => {
    expect(getBatchPrepStartDate('2026-08-02', 4)).toBe('2026-07-29');
  });

  it('treats a negative prepDays as zero', () => {
    expect(getBatchPrepStartDate('2026-07-20', -1)).toBe('2026-07-20');
  });
});

describe('isBatchDateOrderable', () => {
  // prepDays=4 → prep starts 2026-07-16, so the "payment day" is 2026-07-15.
  it('is orderable on the payment day (the day before prep starts)', () => {
    expect(isBatchDateOrderable('2026-07-20', 4, '2026-07-15')).toBe(true);
  });

  it('is no longer orderable once prep starts', () => {
    expect(isBatchDateOrderable('2026-07-20', 4, '2026-07-16')).toBe(false);
  });

  it('is no longer orderable on or after the production date itself', () => {
    expect(isBatchDateOrderable('2026-07-20', 4, '2026-07-20')).toBe(false);
  });
});
