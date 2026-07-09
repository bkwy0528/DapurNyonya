import { describe, it, expect } from 'vitest';
import { getStatusStyle } from '../../src/app/utils/statusStyles';

describe('getStatusStyle', () => {
  it('maps every known order status to its badge class', () => {
    expect(getStatusStyle('Pending Approval')).toBe('status-badge--pending');
    expect(getStatusStyle('Order Received')).toBe('status-badge--received');
    expect(getStatusStyle('In Preparation')).toBe('status-badge--preparing');
    expect(getStatusStyle('Ready for Pickup')).toBe('status-badge--ready');
    expect(getStatusStyle('Out for Delivery')).toBe('status-badge--out');
    expect(getStatusStyle('Delivered')).toBe('status-badge--delivered');
    expect(getStatusStyle('Rejected')).toBe('status-badge--rejected');
    expect(getStatusStyle('Cancelled')).toBe('status-badge--cancelled');
  });

  it('falls back to a neutral style for an unrecognized status', () => {
    // Guards against the known "Pending Payment" data anomaly (an order status
    // from a since-reverted design) and any other unexpected value never
    // crashing the badge — see QA strategy §19.3.
    expect(getStatusStyle('Pending Payment')).toBe('bg-gray-100 text-gray-700');
    expect(getStatusStyle('')).toBe('bg-gray-100 text-gray-700');
  });
});
