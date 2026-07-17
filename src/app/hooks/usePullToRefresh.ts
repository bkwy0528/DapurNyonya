import { useEffect, useRef, useState } from 'react';

export const PULL_THRESHOLD = 70;
const MAX_PULL = 100;
const RESISTANCE = 0.5;
const DEAD_ZONE = 4;

// Refs (not state) back the touch handlers so listeners can be bound once
// instead of re-subscribing on every pixel of movement — state is only
// touched to drive the visible indicator.
export function usePullToRefresh(onRefresh: () => Promise<void> | void, enabled = true) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 0 && !refreshingRef.current) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= DEAD_ZONE) {
        setPullDistance(0);
        return;
      }
      // Claiming the gesture (preventDefault) only past the dead zone keeps
      // ordinary taps and upward scrolls from being swallowed.
      e.preventDefault();
      setPullDistance(Math.min((delta - DEAD_ZONE) * RESISTANCE, MAX_PULL));
    };

    const onTouchEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      startY.current = null;
      setPullDistance((current) => {
        if (current >= PULL_THRESHOLD) {
          refreshingRef.current = true;
          setRefreshing(true);
          Promise.resolve(onRefreshRef.current()).finally(() => {
            refreshingRef.current = false;
            setRefreshing(false);
            setPullDistance(0);
          });
          return PULL_THRESHOLD;
        }
        return 0;
      });
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled]);

  return { pullDistance, refreshing };
}
