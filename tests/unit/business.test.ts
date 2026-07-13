import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  validatePassword,
  getDateKey,
  generateFinalOrderNumber,
  getMaxPrepDaysFromCart,
  normalizeOrderingRules,
  isDateInSeason,
  isSmallOrderDateAllowed,
  getLimitForDate,
  DEFAULT_DAILY_LIMIT_KEY,
  DEFAULT_ORDERING_RULES,
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

describe('normalizeOrderingRules — festive season window', () => {
  it('defaults to no season when the settings doc has none', () => {
    const rules = normalizeOrderingRules({ bulkMinQuantity: 20, smallOrderWeekdays: [6] });
    expect(rules.seasonStart).toBeNull();
    expect(rules.seasonEnd).toBeNull();
  });

  it('keeps a valid season window', () => {
    const rules = normalizeOrderingRules({ seasonStart: '2026-06-01', seasonEnd: '2026-06-19' });
    expect(rules.seasonStart).toBe('2026-06-01');
    expect(rules.seasonEnd).toBe('2026-06-19');
  });

  it('accepts a single-day season (start equals end)', () => {
    const rules = normalizeOrderingRules({ seasonStart: '2026-06-19', seasonEnd: '2026-06-19' });
    expect(rules.seasonStart).toBe('2026-06-19');
  });

  it('drops a half-filled window', () => {
    const rules = normalizeOrderingRules({ seasonStart: '2026-06-01' });
    expect(rules.seasonStart).toBeNull();
    expect(rules.seasonEnd).toBeNull();
  });

  it('drops an inverted window (end before start)', () => {
    const rules = normalizeOrderingRules({ seasonStart: '2026-06-19', seasonEnd: '2026-06-01' });
    expect(rules.seasonStart).toBeNull();
    expect(rules.seasonEnd).toBeNull();
  });

  it('drops malformed dates', () => {
    const rules = normalizeOrderingRules({ seasonStart: 'June 1', seasonEnd: '2026-06-19' });
    expect(rules.seasonStart).toBeNull();
    expect(rules.seasonEnd).toBeNull();
  });
});

describe('isDateInSeason', () => {
  const rules = normalizeOrderingRules({ seasonStart: '2026-06-01', seasonEnd: '2026-06-19' });

  it('includes both boundary dates', () => {
    expect(isDateInSeason('2026-06-01', rules)).toBe(true);
    expect(isDateInSeason('2026-06-19', rules)).toBe(true);
  });

  it('excludes dates outside the window', () => {
    expect(isDateInSeason('2026-05-31', rules)).toBe(false);
    expect(isDateInSeason('2026-06-20', rules)).toBe(false);
  });

  it('is always false when no season is set', () => {
    expect(isDateInSeason('2026-06-10', DEFAULT_ORDERING_RULES)).toBe(false);
  });
});

describe('isSmallOrderDateAllowed', () => {
  // Default weekdays = Saturdays only; season covers 1–19 June 2026.
  const rules = normalizeOrderingRules({ seasonStart: '2026-06-01', seasonEnd: '2026-06-19' });

  it('allows configured weekdays as before', () => {
    expect(isSmallOrderDateAllowed(new Date(2026, 6, 18), rules)).toBe(true); // Sat 18 Jul, outside season
  });

  it('rejects other weekdays outside the season', () => {
    expect(isSmallOrderDateAllowed(new Date(2026, 6, 15), rules)).toBe(false); // Wed 15 Jul
  });

  it('allows any weekday inside the season', () => {
    expect(isSmallOrderDateAllowed(new Date(2026, 5, 10), rules)).toBe(true); // Wed 10 Jun
  });

  it('without a season, only the configured weekdays pass', () => {
    expect(isSmallOrderDateAllowed(new Date(2026, 5, 10), DEFAULT_ORDERING_RULES)).toBe(false);
    expect(isSmallOrderDateAllowed(new Date(2026, 5, 13), DEFAULT_ORDERING_RULES)).toBe(true); // Sat 13 Jun
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
