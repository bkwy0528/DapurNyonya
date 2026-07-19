import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  validatePassword,
  getDateKey,
  generateFinalOrderNumber,
  getMaxPrepDaysFromCart,
  normalizeOpenOrderRanges,
  isDateOrderable,
  normalizeOrderLeadBufferDays,
  getLimitForDate,
  DEFAULT_DAILY_LIMIT_KEY,
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

describe('normalizeOrderLeadBufferDays', () => {
  it('defaults to 0 (no extra buffer) when unset', () => {
    expect(normalizeOrderLeadBufferDays(undefined)).toBe(0);
    expect(normalizeOrderLeadBufferDays(null)).toBe(0);
  });

  it('keeps a valid whole-day buffer', () => {
    expect(normalizeOrderLeadBufferDays(2)).toBe(2);
  });

  it('floors a fractional value', () => {
    expect(normalizeOrderLeadBufferDays(2.9)).toBe(2);
  });

  it('rejects a negative buffer, falling back to 0', () => {
    expect(normalizeOrderLeadBufferDays(-1)).toBe(0);
  });

  it('rejects non-numeric input, falling back to 0', () => {
    expect(normalizeOrderLeadBufferDays('not a number')).toBe(0);
  });
});

describe('getLimitForDate', () => {
  it('returns 0 (unlimited) when nothing is set', () => {
    expect(getLimitForDate({}, '2026-07-18')).toBe(0);
  });

  it('returns the per-date limit when set', () => {
    expect(getLimitForDate({ '2026-07-18': 8 }, '2026-07-18')).toBe(8);
  });

  it('falls back to the default limit for dates without their own', () => {
    const limits = { [DEFAULT_DAILY_LIMIT_KEY]: 12, '2026-07-18': 8 };
    expect(getLimitForDate(limits, '2026-07-18')).toBe(8);
    expect(getLimitForDate(limits, '2026-07-19')).toBe(12);
  });
});
