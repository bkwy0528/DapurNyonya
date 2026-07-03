import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useCart } from '../../context/CartContext';
import { createOrder } from '../../utils/db';

export default function ToyyibPayReturnPage() {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [searchParams] = useSearchParams();
  const [outcome, setOutcome] = useState<'checking' | 'success' | 'failed' | 'pending' | 'lost'>('checking');
  const started = useRef(false);

  const statusId = searchParams.get('status_id');
  const transactionId = searchParams.get('transaction_id');

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (statusId === '1') {
      const raw = sessionStorage.getItem('pendingOrder');
      if (!raw) { setOutcome('lost'); return; }
      const pendingOrder = JSON.parse(raw);

      (async () => {
        await createOrder({
          ...pendingOrder,
          status: 'Order Received',
          paymentStatus: 'paid',
          transactionId: transactionId || null,
        });
        clearCart();
        sessionStorage.removeItem('pendingOrder');
        setOutcome('success');
        setTimeout(() => navigate('/customer/tracking'), 3000);
      })();
    } else if (statusId === '3') {
      // Payment failed — pendingOrder/cart were never touched, so the customer can retry as-is.
      setOutcome('failed');
    } else {
      setOutcome('pending');
    }
  }, [statusId, transactionId, navigate, clearCart]);

  if (outcome === 'checking') return <LoadingSpinner />;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          {outcome === 'success' && (
            <>
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold text-green-800">Payment Successful</h2>
              <p className="text-gray-600">Your order is confirmed. Redirecting to your orders…</p>
            </>
          )}
          {outcome === 'pending' && (
            <>
              <Clock className="w-16 h-16 text-orange-500 mx-auto" />
              <h2 className="text-2xl font-bold text-orange-800">Payment Not Completed</h2>
              <p className="text-gray-600">Your payment wasn't completed, so no order was placed. Your cart is still saved.</p>
              <Button onClick={() => navigate('/customer/payment')} className="brand-button">
                Try Again
              </Button>
            </>
          )}
          {outcome === 'failed' && (
            <>
              <XCircle className="w-16 h-16 text-red-500 mx-auto" />
              <h2 className="text-2xl font-bold text-red-800">Payment Failed</h2>
              <p className="text-gray-600">Your payment could not be completed, so no order was placed. Your cart is still saved.</p>
              <Button onClick={() => navigate('/customer/payment')} className="brand-button">
                Try Again
              </Button>
            </>
          )}
          {outcome === 'lost' && (
            <>
              <XCircle className="w-16 h-16 text-red-500 mx-auto" />
              <h2 className="text-2xl font-bold text-red-800">Something Went Wrong</h2>
              <p className="text-gray-600">Payment was confirmed but we couldn't find your order details in this session. Please contact us with your payment reference.</p>
              <Button onClick={() => navigate('/customer/home')} className="brand-button">
                Back to Home
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
