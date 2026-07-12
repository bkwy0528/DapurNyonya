import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { CheckCircle2, Clock, XCircle, AlarmClockOff } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useCart } from '../../context/CartContext';
import { submitOrder } from '../../utils/submitOrder';
import { User } from '../../App';

interface ToyyibPayReturnPageProps {
  user: User;
}

export default function ToyyibPayReturnPage({ user }: ToyyibPayReturnPageProps) {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [searchParams] = useSearchParams();
  const [outcome, setOutcome] = useState<'checking' | 'success' | 'failed' | 'pending' | 'expired' | 'lost'>('checking');
  const started = useRef(false);

  const statusId = searchParams.get('status_id');
  const transactionId = searchParams.get('transaction_id');

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (statusId === '1') {
      (async () => {
        try {
          const raw = sessionStorage.getItem('pendingOrder');
          const billCode = sessionStorage.getItem('pendingBillCode');
          if (!raw || !billCode) { setOutcome('lost'); return; }
          const pendingOrder = JSON.parse(raw);

          // submitOrder() is the actual authority here — it only creates the
          // order once it sees toyyibpayCallback's own server-recorded
          // confirmation for this exact bill (never this page's URL params,
          // which are just a client-side hint of what to try). It's also
          // idempotent on both clientRequestId and billCode, so a reload or
          // back-navigation landing here again after a previous run already
          // succeeded just returns that same order instead of duplicating it
          // or losing track of a payment that went through.
          await submitOrder({
            clientRequestId: pendingOrder.clientRequestId,
            items: (pendingOrder.items || []).map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              notes: item.notes,
            })),
            deliveryMethod: pendingOrder.deliveryMethod,
            deliveryAddress: pendingOrder.deliveryAddress,
            postalCode: pendingOrder.postalCode,
            contactPhone: pendingOrder.customerPhone,
            specialInstructions: pendingOrder.specialInstructions,
            paymentMethod: pendingOrder.paymentMethod,
            paymentNote: pendingOrder.paymentNote,
            deliveryDate: pendingOrder.deliveryDate,
            customerName: pendingOrder.customerName,
            billCode,
          });
          // Only removed once the order write has actually succeeded — removing it
          // beforehand meant a reload during the write would lose the recovery data
          // without any guarantee the order had actually been saved.
          sessionStorage.removeItem('pendingOrder');
          sessionStorage.removeItem('paymentExpiresAt');
          sessionStorage.removeItem('pendingBillCode');
          clearCart();
          setOutcome('success');
          setTimeout(() => navigate('/customer/tracking'), 3000);
        } catch (err) {
          // A confirmed payment must never be left on an endless spinner — surface
          // the reference so the customer has something concrete to give support,
          // even though we couldn't save the order on this attempt.
          console.error('Failed to finalize a confirmed ToyyibPay payment:', err);
          setOutcome('lost');
        }
      })();
    } else if (statusId === '3') {
      // Payment failed — pendingOrder/cart were never touched, so the customer can retry as-is.
      setOutcome('failed');
    } else {
      const expiresAt = Number(sessionStorage.getItem('paymentExpiresAt') || 0);
      setOutcome(expiresAt && Date.now() > expiresAt ? 'expired' : 'pending');
    }
  }, [statusId, transactionId, navigate, clearCart, user.id]);

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
          {outcome === 'expired' && (
            <>
              <AlarmClockOff className="w-16 h-16 text-orange-500 mx-auto" />
              <h2 className="text-2xl font-bold text-orange-800">Payment Expired</h2>
              <p className="text-gray-600">Your payment session expired before it was completed, so no order was placed. Your cart is still saved.</p>
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
              <p className="text-gray-600">Payment was confirmed but we couldn't save your order details. Please contact us with the reference below.</p>
              {transactionId && (
                <p className="font-mono text-sm bg-gray-100 rounded-lg p-3 break-all">{transactionId}</p>
              )}
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
