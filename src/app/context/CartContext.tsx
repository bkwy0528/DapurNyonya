import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebase';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  unit: string;
  prepDays?: number;
  deliveryDate?: string;
  notes?: string;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    // A corrupted saved cart must never crash the whole app at boot — fall back to empty.
    try {
      const saved = localStorage.getItem('cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cartItems));
  }, [cartItems]);

  // The cart is stored under a single shared localStorage key, so on a shared
  // device one customer's cart would otherwise carry over to the next login.
  // Clearing on the signed-in → signed-out transition (not on initial load,
  // which also reports null before auth restores) closes that leak.
  useEffect(() => {
    let wasSignedIn = auth.currentUser != null;
    return onAuthStateChanged(auth, (u) => {
      if (wasSignedIn && !u) setCartItems([]);
      wasSignedIn = u != null;
    });
  }, []);

  const addToCart = (item: CartItem) => {
    setCartItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.productId === item.productId);
      if (existingIndex >= 0) {
        return prev.map((existing, idx) => {
          if (idx !== existingIndex) return existing;
          // Notes are appended, never replaced — a customer's earlier note (e.g. an
          // allergy warning) must survive re-adding the same product with a new note.
          const notes = existing.notes && item.notes && existing.notes !== item.notes
            ? `${existing.notes}; ${item.notes}`
            : item.notes || existing.notes;
          return {
            ...existing,
            quantity: existing.quantity + item.quantity,
            prepDays: item.prepDays ?? existing.prepDays,
            deliveryDate: item.deliveryDate ?? existing.deliveryDate,
            notes,
          };
        });
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getCartCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartTotal,
        getCartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
