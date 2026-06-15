export const STATUS_STYLES: Record<string, string> = {
  'Pending Approval': 'status-badge--pending',
  'Order Received': 'status-badge--received',
  'In Preparation': 'status-badge--preparing',
  'Ready for Pickup': 'status-badge--ready',
  'Delivered': 'status-badge--delivered',
  'Rejected': 'status-badge--rejected',
};

export function getStatusStyle(status: string): string {
  return STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700';
}
