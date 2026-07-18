export const STATUS_STYLES: Record<string, string> = {
  'Order Received': 'status-badge--received',
  'In Preparation': 'status-badge--preparing',
  'Ready for Pickup': 'status-badge--ready',
  'Out for Delivery': 'status-badge--out',
  'Delivered': 'status-badge--delivered',
  'Cancelled': 'status-badge--cancelled',
};

export function getStatusStyle(status: string): string {
  return STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700';
}
