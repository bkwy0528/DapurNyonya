import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SwipeToDelete from '../../src/app/components/SwipeToDelete';

function getTrackOffset(track: HTMLElement): number {
  const match = track.style.transform.match(/translateX\((-?\d+(?:\.\d+)?)px\)/);
  return match ? parseFloat(match[1]) : 0;
}

function touch(clientX: number, clientY: number) {
  return { touches: [{ clientX, clientY }] };
}

describe('SwipeToDelete', () => {
  it('renders its children', () => {
    render(<SwipeToDelete onDelete={() => {}}><p>Cart item</p></SwipeToDelete>);
    expect(screen.getByText('Cart item')).toBeInTheDocument();
  });

  it('reveals the delete button and snaps fully open past the threshold', () => {
    render(<SwipeToDelete onDelete={() => {}}><p>Cart item</p></SwipeToDelete>);
    const track = screen.getByTestId('swipe-track');

    fireEvent.touchStart(track, touch(200, 100));
    fireEvent.touchMove(track, touch(120, 100)); // 80px left drag
    fireEvent.touchEnd(track);

    expect(getTrackOffset(track)).toBe(-88);
  });

  it('snaps back to closed when the drag does not clear the halfway threshold', () => {
    render(<SwipeToDelete onDelete={() => {}}><p>Cart item</p></SwipeToDelete>);
    const track = screen.getByTestId('swipe-track');

    fireEvent.touchStart(track, touch(200, 100));
    fireEvent.touchMove(track, touch(180, 100)); // 20px left drag, well under 44px halfway
    fireEvent.touchEnd(track);

    expect(getTrackOffset(track)).toBe(0);
  });

  it('ignores a predominantly vertical drag so page scroll is not hijacked', () => {
    render(<SwipeToDelete onDelete={() => {}}><p>Cart item</p></SwipeToDelete>);
    const track = screen.getByTestId('swipe-track');

    fireEvent.touchStart(track, touch(200, 100));
    fireEvent.touchMove(track, touch(190, 160)); // 10px horizontal, 60px vertical — a scroll, not a swipe
    fireEvent.touchEnd(track);

    expect(getTrackOffset(track)).toBe(0);
  });

  it('clamps the drag so it can never swipe past the reveal width', () => {
    render(<SwipeToDelete onDelete={() => {}}><p>Cart item</p></SwipeToDelete>);
    const track = screen.getByTestId('swipe-track');

    fireEvent.touchStart(track, touch(300, 100));
    fireEvent.touchMove(track, touch(0, 100)); // 300px left drag, far past the 88px reveal width
    expect(getTrackOffset(track)).toBe(-88);
  });

  it('calls onDelete when the revealed delete button is pressed', () => {
    const onDelete = vi.fn();
    render(<SwipeToDelete onDelete={onDelete}><p>Cart item</p></SwipeToDelete>);
    const track = screen.getByTestId('swipe-track');

    fireEvent.touchStart(track, touch(200, 100));
    fireEvent.touchMove(track, touch(120, 100));
    fireEvent.touchEnd(track);

    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(getTrackOffset(track)).toBe(0); // deleting also closes the swipe
  });
});
