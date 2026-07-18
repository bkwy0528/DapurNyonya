import { describe, it, expect } from 'vitest';
import { getStatusStyle } from '../../src/app/utils/statusStyles';

describe('getStatusStyle', () => {
  it('maps every known order status to its badge class', () => {
    expect(getStatusStyle('Order Received')).toBe('status-badge--received');
    expect(getStatusStyle('In Preparation')).toBe('status-badge--preparing');
    expect(getStatusStyle('Ready for Pickup')).toBe('status-badge--ready');
    expect(getStatusStyle('Out for Delivery')).toBe('status-badge--out');
    expect(getStatusStyle('Delivered')).toBe('status-badge--delivered');
    expect(getStatusStyle('Cancelled')).toBe('status-badge--cancelled');
  });

  it('falls back to a neutral style for an unrecognized status', () => {
    // Statuses from removed flows ('Pending Approval', 'Rejected', the
    // "Pending Payment" anomaly) and any other unexpected value must never
    // crash the badge — see QA strategy §19.3.
    expect(getStatusStyle('Pending Approval')).toBe('bg-gray-100 text-gray-700');
    expect(getStatusStyle('Rejected')).toBe('bg-gray-100 text-gray-700');
    expect(getStatusStyle('Pending Payment')).toBe('bg-gray-100 text-gray-700');
    expect(getStatusStyle('')).toBe('bg-gray-100 text-gray-700');
  });
});
