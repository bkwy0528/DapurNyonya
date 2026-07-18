import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, BellOff } from 'lucide-react';
import { getOrders, getOrdersByCustomer, getAllBatchOrders, getBatchOrdersByCustomer, getProductionBatches } from '../utils/db';
import { buildNotificationFeed, buildAdminNotificationFeed, formatRelativeTime, type NotificationItem } from '../utils/notificationFeed';
import type { ProductionBatch } from '../utils/batchOrders';

// Header bell for customers and the admin. The list is derived on the client
// from data each role already reads (see notificationFeed.ts) — no
// notifications collection exists, so "unread" is tracked locally with a
// per-user last-seen timestamp.
const lastSeenKey = (userId: string) => `notif-last-seen:${userId}`;

export default function NotificationBell({ userId, role }: { userId: string; role: 'customer' | 'admin' }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [lastSeen, setLastSeen] = useState(() => localStorage.getItem(lastSeenKey(userId)) || '');
  // Frozen copy of lastSeen from the moment the panel opened, so items keep
  // their unread highlight while the panel is up even though opening it
  // already cleared the badge.
  const [lastSeenAtOpen, setLastSeenAtOpen] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const loadFeed = useCallback(() => {
    const fetches = role === 'admin'
      ? Promise.all([getOrders(), getAllBatchOrders(), getProductionBatches()])
      : Promise.all([getOrdersByCustomer(userId), getBatchOrdersByCustomer(userId), getProductionBatches()]);
    return fetches
      .then(([orders, batchOrders, batches]) => {
        if (role === 'admin') {
          setItems(buildAdminNotificationFeed(orders, batchOrders, batches as ProductionBatch[]));
        } else {
          const batchesById: Record<string, ProductionBatch> = {};
          (batches as ProductionBatch[]).forEach((b) => { batchesById[b.id] = b; });
          setItems(buildNotificationFeed(orders, batchOrders, batchesById));
        }
      })
      .catch(() => { /* the bell is supplementary — a failed read just leaves it empty */ });
  }, [userId, role]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  // Close on outside click / Escape, like a native menu.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const unreadCount = items.filter((item) => item.time > lastSeen).length;

  const toggle = () => {
    if (!open) {
      setLastSeenAtOpen(lastSeen);
      // Opening counts as seeing everything currently listed — the badge
      // clears now; the in-panel highlights use the frozen copy above.
      const now = new Date().toISOString();
      localStorage.setItem(lastSeenKey(userId), now);
      setLastSeen(now);
      loadFeed(); // refresh so a status change mid-session shows up
    }
    setOpen(!open);
  };

  const openItem = (item: NotificationItem) => {
    setOpen(false);
    navigate(item.link);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        aria-expanded={open}
        className="header-icon-button relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          // key remounts the badge when the count changes so the
          // badge-pop animation replays (same trick as the cart badge)
          <span key={unreadCount} className="cart-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(90vw,22rem)] rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="font-semibold text-gray-900">Notifications</p>
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <BellOff className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Nothing here yet — updates about your orders will show up here.</p>
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-gray-100">
              {items.map((item) => {
                const isNew = item.time > lastSeenAtOpen;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-orange-50 active:bg-orange-50 ${isNew ? 'bg-orange-50/60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                        {isNew && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" aria-label="New" />}
                      </div>
                      <p className="mt-0.5 text-sm text-gray-600">{item.body}</p>
                      <p className="mt-1 text-xs text-gray-400">{formatRelativeTime(item.time)}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
