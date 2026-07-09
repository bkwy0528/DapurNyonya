import { describe, it, expect } from 'vitest';
import { feeForDistanceKm, feeForPostalCode, MAX_DELIVERY_KM } from '../../src/app/utils/delivery';

describe('feeForDistanceKm', () => {
  it('charges the first tier at the shortest distances', () => {
    expect(feeForDistanceKm(0)).toBe(5);
    expect(feeForDistanceKm(1.5)).toBe(5);
  });

  it('charges the correct fee exactly at each tier boundary', () => {
    expect(feeForDistanceKm(3)).toBe(5);
    expect(feeForDistanceKm(3.01)).toBe(8);
    expect(feeForDistanceKm(6)).toBe(8);
    expect(feeForDistanceKm(6.01)).toBe(12);
    expect(feeForDistanceKm(10)).toBe(12);
    expect(feeForDistanceKm(10.01)).toBe(16);
    expect(feeForDistanceKm(15)).toBe(16);
    expect(feeForDistanceKm(15.01)).toBe(20);
  });

  it('charges the top tier fee right up to the delivery radius', () => {
    expect(feeForDistanceKm(MAX_DELIVERY_KM)).toBe(20);
  });

  it('refuses delivery beyond the max radius', () => {
    expect(feeForDistanceKm(MAX_DELIVERY_KM + 0.01)).toBeNull();
    expect(feeForDistanceKm(50)).toBeNull();
  });

  it('treats zero and negative distances as the nearest tier rather than throwing', () => {
    expect(feeForDistanceKm(0)).toBe(5);
    expect(feeForDistanceKm(-1)).toBe(5);
  });
});

describe('feeForPostalCode', () => {
  it('prices the Klang Valley / southern band (5xxxx-6xxxx) as the cheapest zone', () => {
    expect(feeForPostalCode('50470')).toBe(5.0);
    expect(feeForPostalCode('68000')).toBe(5.0);
  });

  it('prices the northern band (1xxxx-4xxxx)', () => {
    expect(feeForPostalCode('10000')).toBe(8.0);
    expect(feeForPostalCode('40000')).toBe(8.0);
  });

  it('prices the eastern band (7xxxx-9xxxx)', () => {
    expect(feeForPostalCode('70000')).toBe(12.0);
    expect(feeForPostalCode('93000')).toBe(12.0);
  });

  it('falls back to the default fee for an out-of-range or malformed postcode', () => {
    expect(feeForPostalCode('00000')).toBe(10.0);
    expect(feeForPostalCode('')).toBe(10.0);
    expect(feeForPostalCode('abcde')).toBe(10.0);
  });
});
