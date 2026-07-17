import { Loader2, ArrowDown } from 'lucide-react';
import { PULL_THRESHOLD } from '../hooks/usePullToRefresh';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  refreshing: boolean;
}

export default function PullToRefreshIndicator({ pullDistance, refreshing }: PullToRefreshIndicatorProps) {
  if (pullDistance === 0 && !refreshing) return null;

  const ready = pullDistance >= PULL_THRESHOLD || refreshing;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center overflow-hidden md:hidden"
      style={{ height: refreshing ? 48 : pullDistance }}
      aria-hidden="true"
    >
      <div
        className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md"
        style={{ opacity: Math.min(pullDistance / PULL_THRESHOLD, 1) }}
      >
        {refreshing ? (
          <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
        ) : (
          <ArrowDown className={`h-5 w-5 text-orange-600 transition-transform duration-200 ${ready ? 'rotate-180' : ''}`} />
        )}
      </div>
    </div>
  );
}
