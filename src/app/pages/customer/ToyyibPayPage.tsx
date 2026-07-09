import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '../../../firebase';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { AlertCircle } from 'lucide-react';
import { User } from '../../App';

interface ToyyibPayPageProps {
  user: User;
}

const PAYMENT_EXPIRY_MINUTES = 15;

export default function ToyyibPayPage({ user }: ToyyibPayPageProps) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const raw = sessionStorage.getItem('pendingOrder');
    if (!raw) { navigate('/customer/cart'); return; }
    const pendingOrder = JSON.parse(raw);

    (async () => {
      try {
        const functions = getFunctions(firebaseApp, 'asia-southeast1');
        const createToyyibPayBill = httpsCallable(functions, 'createToyyibPayBill');
        const result: any = await createToyyibPayBill({
          amount: pendingOrder.total,
          customerName: pendingOrder.customerName,
          customerEmail: user.email,
          customerPhone: pendingOrder.customerPhone,
          returnUrl: `${window.location.origin}/customer/payment-return`,
          callbackUrl: 'https://asia-southeast1-dapurnyonya-9b752.cloudfunctions.net/toyyibpayCallback',
        });

        // pendingOrder / cart are left untouched until ToyyibPayReturnPage confirms
        // success — that way a failed or abandoned payment never loses the customer's cart.
        sessionStorage.setItem('paymentExpiresAt', String(Date.now() + PAYMENT_EXPIRY_MINUTES * 60 * 1000));
        // ToyyibPayReturnPage needs this to ask submitOrder() to check the
        // server-recorded payment confirmation for this exact bill.
        sessionStorage.setItem('pendingBillCode', result.data.billCode);
        // replace (not href) so this auto-redirecting page never sits in browser
        // history — otherwise pressing back from ToyyibPay's hosted page lands back
        // here, silently creating a new bill and redirecting again instead of going
        // to checkout.
        window.location.replace(result.data.paymentUrl);
      } catch {
        setError('Could not start payment. Please go back and try again.');
      }
    })();
  }, [navigate, user.email]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <p className="text-gray-700">{error}</p>
            <Button onClick={() => navigate('/customer/checkout')} className="brand-button">
              Back to Checkout
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <LoadingSpinner />;
}
