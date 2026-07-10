import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ArrowLeft, Plus, Minus, Trash2, ShoppingCart, LogIn } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { User } from '../../App';
import { toast } from 'sonner';

interface CartPageProps {
  user: User | null;
}

export default function CartPage({ user }: CartPageProps) {
  const navigate = useNavigate();
  const { cartItems, updateQuantity, removeFromCart, getCartTotal } = useCart();
  const [itemToRemove, setItemToRemove] = useState<{ productId: string; name: string } | null>(null);
  const homeLink = user ? '/customer/home' : '/';

  const confirmRemove = () => {
    if (itemToRemove) {
      removeFromCart(itemToRemove.productId);
      toast.success(`${itemToRemove.name} removed from cart`);
      setItemToRemove(null);
    }
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    if (!user) {
      // Cart survives the login round-trip via CartContext's localStorage
      // persistence, so this is a detour, not a reset.
      navigate('/login', { state: { from: '/customer/cart' } });
      return;
    }
    navigate('/customer/checkout');
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen pb-24">
        {/* Header */}
        <div className="page-hero">
          <div className="page-hero__inner">
            <Link to={homeLink} className="page-back-link">
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="text-lg">Back to Home</span>
            </Link>
            <h1 className="text-2xl">Shopping Cart</h1>
          </div>
        </div>

        {/* Empty State */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingCart className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">Your cart is empty</h2>
            <p className="text-gray-600 mb-8">Add some delicious items to get started!</p>
            <Link to={homeLink}>
              <Button className="brand-button">
                Browse Products
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="page-hero">
        <div className="page-hero__inner">
          <Link to={homeLink} className="page-back-link">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back to Home</span>
          </Link>
          <h1 className="text-2xl">Shopping Cart</h1>
          <p className="text-sm opacity-90 mt-1">{cartItems.length} item(s) in your cart</p>
        </div>
      </div>

      {/* Cart Items */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-4">
          {cartItems.map((item) => (
            <Card key={item.productId}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Product Image */}
                  <div className="w-full sm:w-32 h-32 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg sm:text-xl font-semibold text-gray-900">{item.name}</h3>
                        <p className="text-sm text-gray-600">{item.unit}</p>
                        {item.deliveryDate && (
                          <p className="text-sm text-gray-600 mt-1">
                            Delivery: {new Date(item.deliveryDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setItemToRemove({ productId: item.productId, name: item.name })}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-5 h-5 mr-1" />
                        Remove
                      </Button>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="w-10 h-10 p-0 border-2"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="text-lg font-semibold w-12 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="w-10 h-10 p-0 border-2"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-orange-600">
                        RM {(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>

                    {item.notes && (
                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        <span className="font-medium">Notes:</span> {item.notes}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Summary */}
        <Card className="brand-summary-card">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between text-lg">
              <span className="text-gray-700">Subtotal:</span>
              <span className="font-semibold text-gray-900">RM {getCartTotal().toFixed(2)}</span>
            </div>
            <p className="text-sm text-gray-600">Delivery charges will be calculated at checkout</p>
            {!user && (
              <p className="text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg p-3">
                You'll need to login or create a free account to complete your order — your cart will be waiting for you.
              </p>
            )}
            <Button
              onClick={handleCheckout}
              size="lg"
              className="w-full h-14 text-lg success-button"
            >
              {user ? (
                <>
                  <ShoppingCart className="w-6 h-6 mr-2" />
                  Proceed to Checkout
                </>
              ) : (
                <>
                  <LogIn className="w-6 h-6 mr-2" />
                  Login to Checkout
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={itemToRemove !== null} onOpenChange={(open) => !open && setItemToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove item from cart?</DialogTitle>
          </DialogHeader>
          <p className="text-gray-700">
            Are you sure you want to remove <strong>{itemToRemove?.name}</strong> from your cart?
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setItemToRemove(null)} className="flex-1 h-12">
              Keep It
            </Button>
            <Button variant="destructive" onClick={confirmRemove} className="flex-1 h-12">
              <Trash2 className="w-4 h-4 mr-2" />
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}