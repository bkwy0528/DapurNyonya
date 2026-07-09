import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Banknote, CheckCircle2 } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useCart } from '../../context/CartContext';
import { toast } from 'sonner';
import { submitOrder } from '../../utils/submitOrder';

// ─── Cash payment confirmation ────────────────────────────────────────────────

function CashConfirmView({ pending }: { pending: any }) {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await submitOrder({
        clientRequestId: pending.clientRequestId,
        items: (pending.items || []).map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          notes: item.notes,
        })),
        deliveryMethod: pending.deliveryMethod,
        deliveryAddress: pending.deliveryAddress,
        postalCode: pending.postalCode,
        deliveryCharge: pending.deliveryCharge,
        contactPhone: pending.customerPhone,
        specialInstructions: pending.specialInstructions,
        paymentMethod: pending.paymentMethod,
        paymentNote: pending.paymentNote,
        deliveryDate: pending.deliveryDate,
        customerName: pending.customerName,
      });
      sessionStorage.removeItem('pendingOrder');
      clearCart();
      setSubmitted(true);
      setTimeout(() => navigate('/customer/tracking'), 3000);
    } catch (err: any) {
      setSubmitting(false);
      // failed-precondition messages are written for the customer (date fully
      // booked, product no longer available) — show them instead of a generic error.
      const message = err?.code === 'functions/failed-precondition' && err?.message
        ? err.message
        : 'Could not submit your order. Please try again.';
      toast.error(message);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold text-green-800">Order Submitted!</h2>
            <p className="text-gray-600">Thank you for your order. We'll notify you once it's confirmed. Redirecting to your orders…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
