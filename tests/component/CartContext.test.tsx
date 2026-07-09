import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CartProvider, useCart, type CartItem } from '../../src/app/context/CartContext';

const item = (overrides: Partial<CartItem> = {}): CartItem => ({
  productId: '1',
  name: 'Traditional Dumplings',
  price: 25,
  quantity: 1,
  image: '',
  unit: 'pack (12 pieces)',
  ...overrides,
});

const wrapper = ({ children }: { children: ReactNode }) => <CartProvider>{children}</CartProvider>;

describe('CartContext', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty when localStorage has no saved cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.cartItems).toEqual([]);
    expect(result.current.getCartCount()).toBe(0);
  });

  it('rehydrates from a previously saved cart in localStorage', () => {
    localStorage.setItem('cart', JSON.stringify([item({ quantity: 2 })]));
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.getCartCount()).toBe(2);
  });

  it('adds a new product as its own line', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart(item()));
    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartItems[0].quantity).toBe(1);
  });

  it('merges quantity when the same product is added again', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart(item({ quantity: 1 })));
    act(() => result.current.addToCart(item({ quantity: 2 })));
    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartItems[0].quantity).toBe(3);
  });

  it('overwrites (does not merge) notes when re-adding with a new note', () => {
    // Documents current behavior, not necessarily desired behavior — see QA
    // strategy §2.2 / regression suite §20 item 3: re-adding a cart line with
    // different notes replaces the old note rather than merging or asking.
    // If this is ever changed deliberately, update this test alongside it.
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart(item({ notes: 'no peanuts' })));
    act(() => result.current.addToCart(item({ notes: 'extra spicy' })));
    expect(result.current.cartItems[0].notes).toBe('extra spicy');
  });

  it('removes a product from the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart(item()));
    act(() => result.current.removeFromCart('1'));
    expect(result.current.cartItems).toEqual([]);
  });

  it('removes the line when quantity is updated to zero', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart(item({ quantity: 2 })));
    act(() => result.current.updateQuantity('1', 0));
    expect(result.current.cartItems).toEqual([]);
  });

  it('computes the cart total and count across multiple lines', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart(item({ productId: '1', price: 25, quantity: 2 })));
    act(() => result.current.addToCart(item({ productId: '2', price: 18, quantity: 1 })));
    expect(result.current.getCartTotal()).toBe(25 * 2 + 18);
    expect(result.current.getCartCount()).toBe(3);
  });

  it('persists every change to localStorage', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart(item()));
    expect(JSON.parse(localStorage.getItem('cart') || '[]')).toHaveLength(1);
  });

  it('empties the cart on clearCart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart(item()));
    act(() => result.current.clearCart());
    expect(result.current.cartItems).toEqual([]);
    expect(JSON.parse(localStorage.getItem('cart') || '[]')).toEqual([]);
  });
});
