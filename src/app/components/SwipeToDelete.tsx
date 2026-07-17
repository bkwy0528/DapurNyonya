import { useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { vibrate } from '../utils/haptics';

const REVEAL_WIDTH = 88;
const OPEN_THRESHOLD = REVEAL_WIDTH / 2;
const DIRECTION_LOCK_PX = 6;

interface SwipeToDeleteProps {
  children: ReactNode;
  onDelete: () => void;
  className?: string;
}

// Swipe left reveals a delete button — it doesn't delete on its own, since
// this app deliberately keeps a confirm step for destructive actions (see
// CartPage's existing remove-confirmation dialog). The always-visible Remove
// button stays untouched for anyone who never discovers the gesture.
export default function SwipeToDelete({ children, onDelete, className = '' }: SwipeToDeleteProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const startOffset = useRef(0);
  const direction = useRef<'h' | 'v' | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    startOffset.current = offset;
    direction.current = null;
    setDragging(true);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (direction.current === null && (Math.abs(dx) > DIRECTION_LOCK_PX || Math.abs(dy) > DIRECTION_LOCK_PX)) {
      direction.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
    if (direction.current !== 'h') return; // vertical drag — let the page scroll instead

    setOffset(Math.min(0, Math.max(-REVEAL_WIDTH, startOffset.current + dx)));
  };

  const onTouchEnd = () => {
    startX.current = null;
    startY.current = null;
    setDragging(false);
    setOffset((current) => (current <= -OPEN_THRESHOLD ? -REVEAL_WIDTH : 0));
  };

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <button
        type="button"
        onClick={() => { vibrate(); setOffset(0); onDelete(); }}
        aria-label="Delete item"
        tabIndex={offset === 0 ? -1 : undefined}
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 text-white transition-colors active:bg-red-600"
        style={{ width: REVEAL_WIDTH }}
      >
        <Trash2 className="w-6 h-6" />
      </button>
      <div
        data-testid="swipe-track"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 0.2s ease-out' }}
        className="relative bg-white"
      >
        {children}
      </div>
    </div>
  );
}
