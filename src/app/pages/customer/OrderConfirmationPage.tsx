import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Banknote } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useCart } from '../../context/CartContext';
import { toast } from 'sonner';
import { createOrder } from '../../utils/db';

// ─── Cash payment confirmation ────────────────────────────────────────────────

function CashConfirmView({ pending }: { pending: any }) {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await createOrder({ ...pending, status: 'Pending Approval' });
      sessionStorage.removeItem('pendingOrder');
      clearCart();
      toast.success('Order submitted! We will notify you once confirmed.');
      navigate('/customer/tracking');
    } catch {
      setSubmitting(false);
      toast.error('Could not submit your order. Please try again.');
    }
  };

  const formattedDeliveryDate = pending?.deliveryDate
    ? new Date(`${pending.deliveryDate}T00:00:00`).toLocaleDateString('en-MY', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <div className="min-h-screen pb-24">
      <div className="page-hero page-hero--rounded">
        <Link to="/customer/checkout" className="page-back-link">
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span className="text-lg">Back to Checkout</span>
        </Link>
        <h1 className="text-2xl">Confirm Your Order</h1>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Order summary */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Delivery Date</p>
              <p className="font-semibold">{formattedDeliveryDate}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-600">Delivery Method</p>
              <p className="font-semibold">{pending.deliveryMethod === 'delivery' ? 'Delivery' : 'Pickup'}</p>
            </div>

            {pending.deliveryMethod === 'delivery' && pending.deliveryAddress && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Delivery Address</p>
                <p className="font-semibold">{pending.deliveryAddress}</p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm text-gray-600">Payment Method</p>
              <p className="font-semibold">Cash</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-600">Items</p>
              {(pending.items || []).map((it: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <span>{it.name} × {it.quantity}</span>
                  <span>RM {((it.price || 0) * (it.quantity || 0)).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Subtotal</span>
                <span className="font-semibold">RM {(pending.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Delivery Charge</span>
                <span className="font-semibold">
                  {pending.deliveryCharge === 0 ? 'FREE' : `RM ${(pending.deliveryCharge || 0).toFixed(2)}`}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-orange-600 text-lg">RM {(pending.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cash payment instructions */}
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-lg text-yellow-800 font-semibold">
              <Banknote className="w-5 h-5" />
              Cash Payment
            </div>
            <p className="text-sm text-yellow-800">
              Please prepare <strong>RM {(pending.total || 0).toFixed(2)}</strong> in cash. Payment is collected upon pickup or delivery.
            </p>
          </CardContent>
        </Card>

        <div className="pt-2">
          <Button onClick={handleConfirm} disabled={submitting} className="w-full brand-button h-14 text-lg">
            {submitting ? 'Submitting…' : 'Confirm & Submit Order'}
          </Button>
          <p className="text-xs text-center text-gray-500 mt-3">
            Orders require admin approval before processing
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Root component — decides which view to show ─────────────────────────────

export default function OrderConfirmationPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'loading' | 'manual' | 'empty'>('loading');
  const [pendingOrder, setPendingOrder] = useState<any>(null);

  useEffect(() => {
    const pendingRaw = sessionStorage.getItem('pendingOrder');

    if (pendingRaw) {
      setPendingOrder(JSON.parse(pendingRaw));
      setMode('manual');
    } else {
      setMode('empty');
    }
  }, []);

  if (mode === 'loading') return <LoadingSpinner />;

  if (mode === 'empty') {
    navigate('/customer/home');
    return null;
  }

  if (mode === 'manual' && pendingOrder) {
    return <CashConfirmView pending={pendingOrder} />;
  }

  return null;
}
