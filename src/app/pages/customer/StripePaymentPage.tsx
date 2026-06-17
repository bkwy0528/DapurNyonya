import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '../../../firebase';
import { createOrder } from '../../utils/db';
import { useCart } from '../../context/CartContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { ArrowLeft, Lock, AlertCircle } from 'lucide-react';
import { User } from '../../App';
import { toast } from 'sonner';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

const stripeAppearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#f97316',
    colorBackground: '#ffffff',
    colorText: '#1f2937',
    borderRadius: '8px',
  },
};

// ─── Inner form (must live inside <Elements>) ─────────────────────────────────

interface PaymentFormProps {
  pendingOrder: any;
  user: User;
  onSuccess: (paymentIntentId: string) => void;
}

function PaymentForm({ pendingOrder, user, onSuccess }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setErrorMsg('');

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/customer/payment`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMsg(error.message || 'Payment failed. Please check your card details.');
      setProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      onSuccess(paymentIntent.id);
    } else {
      setErrorMsg('Unexpected payment status. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement options={{ layout: 'tabs' }} />

      {errorMsg && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full h-14 text-lg brand-button"
      >
        <Lock className="w-5 h-5 mr-2" />
        {processing ? 'Processing…' : `Pay RM ${(pendingOrder.total || 0).toFixed(2)}`}
      </Button>

      <p className="text-xs text-center text-gray-500 flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" />
        Secured by Stripe — your card details are never stored on our servers.
      </p>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface StripePaymentPageProps {
  user: User;
}

export default function StripePaymentPage({ user }: StripePaymentPageProps) {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initError, setInitError] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('pendingOrder');
    if (!raw) { navigate('/customer/cart'); return; }

    const order = JSON.parse(raw);
    setPendingOrder(order);

    const functions = getFunctions(firebaseApp, 'asia-southeast1');
    const createPaymentIntent = httpsCallable(functions, 'createPaymentIntent');

    createPaymentIntent({
      amount: order.total,
      metadata: {
        customerName: order.customerName,
        customerId: user.id,
        deliveryDate: order.deliveryDate || '',
      },
    })
      .then((result: any) => setClientSecret(result.data.clientSecret))
      .catch(() => setInitError('Could not initialise payment. Please go back and try again.'));
  }, [navigate, user.id]);

  const handleSuccess = async (paymentIntentId: string) => {
    const orderId = await createOrder({
      ...pendingOrder,
      status: 'Order Received',
      paymentStatus: 'paid',
      paymentIntentId,
    });

    clearCart();
    sessionStorage.removeItem('pendingOrder');
    sessionStorage.setItem(
      'confirmedOrder',
      JSON.stringify({
        orderId,
        paymentIntentId,
        paidAt: new Date().toISOString(),
        total: pendingOrder.total,
        subtotal: pendingOrder.subtotal,
        deliveryCharge: pendingOrder.deliveryCharge,
        items: pendingOrder.items,
        deliveryDate: pendingOrder.deliveryDate,
        deliveryMethod: pendingOrder.deliveryMethod,
        deliveryAddress: pendingOrder.deliveryAddress,
        customerName: pendingOrder.customerName,
      })
    );

    toast.success('Payment successful!');
    navigate('/customer/order-confirmation');
  };

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <p className="text-gray-700">{initError}</p>
            <Button onClick={() => navigate('/customer/checkout')} className="brand-button">
              Back to Checkout
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!clientSecret || !pendingOrder) return <LoadingSpinner />;

  return (
    <div className="min-h-screen pb-24">
      <div className="page-hero page-hero--rounded">
        <Link to="/customer/order-confirmation" className="page-back-link">
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span className="text-lg">Back</span>
        </Link>
        <h1 className="text-2xl">Secure Payment</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Order total banner */}
        <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Order Total</p>
                <p className="text-3xl font-bold text-orange-600">
                  RM {(pendingOrder.total || 0).toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Delivery / Pickup</p>
                <p className="font-semibold text-gray-900">
                  {pendingOrder.deliveryDate
                    ? new Date(`${pendingOrder.deliveryDate}T00:00:00`).toLocaleDateString('en-MY', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stripe Elements card form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-orange-600" />
              Card Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
              <PaymentForm pendingOrder={pendingOrder} user={user} onSuccess={handleSuccess} />
            </Elements>
          </CardContent>
        </Card>

        {/* Test mode hint */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold text-blue-800">Test Mode — use these demo card numbers:</p>
            <p className="text-xs text-blue-700">Visa success: <span className="font-mono">4242 4242 4242 4242</span></p>
            <p className="text-xs text-blue-700">Card declined: <span className="font-mono">4000 0000 0000 0002</span></p>
            <p className="text-xs text-blue-700">Any future expiry • Any 3-digit CVC • Any postal code</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
