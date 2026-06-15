import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Banknote, Smartphone, Wallet } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { toast } from 'sonner';
import { createOrder, getSettings } from '../../utils/db';

export default function OrderConfirmationPage() {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('pendingOrder');
    if (raw) setPendingOrder(JSON.parse(raw));
    getSettings().then(s => setSettings(s));
  }, []);

  const handleConfirm = async () => {
    if (!pendingOrder) return;
    await createOrder({ ...pendingOrder, status: 'Pending Approval' });
    sessionStorage.removeItem('pendingOrder');
    clearCart();
    toast.success('Order submitted. Await admin confirmation.');
    navigate('/customer/tracking');
  };

  if (!pendingOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card><CardContent className="p-8">No pending order found.</CardContent></Card>
      </div>
    );
  }

  const formattedDeliveryDate = pendingOrder?.deliveryDate
    ? new Date(`${pendingOrder.deliveryDate}T00:00:00`).toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const paymentLabel: Record<string, string> = {
    cash: 'Cash',
    ewallet: "Touch 'n Go eWallet",
    debit: 'Debit Card / Bank Transfer',
  };

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
              <p className="font-semibold">{pendingOrder.deliveryMethod === 'delivery' ? 'Delivery' : 'Pickup'}</p>
            </div>

            {pendingOrder.deliveryMethod === 'delivery' && pendingOrder.deliveryAddress && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Delivery Address</p>
                <p className="font-semibold">{pendingOrder.deliveryAddress}</p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm text-gray-600">Payment Method</p>
              <p className="font-semibold">{paymentLabel[pendingOrder.paymentMethod] ?? pendingOrder.paymentMethod}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-600">Items</p>
              {(pendingOrder.items || []).map((it: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <span>{it.name} x {it.quantity}</span>
                  <span>RM {((it.price || 0) * (it.quantity || 0)).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Subtotal</span>
                <span className="font-semibold">RM {(pendingOrder.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Delivery Charge</span>
                <span className="font-semibold">{pendingOrder.deliveryCharge === 0 ? 'FREE' : `RM ${(pendingOrder.deliveryCharge || 0).toFixed(2)}`}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-orange-600 text-lg">RM {(pendingOrder.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment instructions */}
        {pendingOrder.paymentMethod === 'cash' && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-yellow-800">
                <Banknote className="w-5 h-5" />
                Cash Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-yellow-800">
              <p>Please prepare the exact amount of <strong>RM {(pendingOrder.total || 0).toFixed(2)}</strong> and pay upon pickup or delivery.</p>
            </CardContent>
          </Card>
        )}

        {pendingOrder.paymentMethod === 'ewallet' && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-green-800">
                <Smartphone className="w-5 h-5" />
                Touch 'n Go eWallet Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-green-800">
              {settings?.eWallet && (
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-gray-500 mb-1">Transfer to</p>
                  <p className="text-xl font-bold text-gray-900">{settings.eWallet}</p>
                </div>
              )}
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <p className="text-xs text-gray-500 mb-1">Amount</p>
                <p className="text-xl font-bold text-orange-600">RM {(pendingOrder.total || 0).toFixed(2)}</p>
              </div>
              {settings?.paymentInstructions && (
                <p className="leading-relaxed">{settings.paymentInstructions}</p>
              )}
              <p className="font-medium">Your order will be processed once payment is confirmed by the seller.</p>
            </CardContent>
          </Card>
        )}

        {pendingOrder.paymentMethod === 'debit' && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-blue-800">
                <Wallet className="w-5 h-5" />
                Bank Transfer / Debit Card
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-blue-800">
              {settings?.bankAccount && (
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-gray-500 mb-1">Bank Account Number</p>
                  <p className="text-xl font-bold text-gray-900">{settings.bankAccount}</p>
                </div>
              )}
              <div className="bg-white rounded-lg p-3 border border-blue-200">
                <p className="text-xs text-gray-500 mb-1">Amount</p>
                <p className="text-xl font-bold text-orange-600">RM {(pendingOrder.total || 0).toFixed(2)}</p>
              </div>
              {settings?.paymentInstructions && (
                <p className="leading-relaxed">{settings.paymentInstructions}</p>
              )}
              <p className="font-medium">Your order will be processed once payment is confirmed by the seller.</p>
            </CardContent>
          </Card>
        )}

        <div className="pt-2">
          <Button onClick={handleConfirm} className="w-full success-button h-14 text-lg">Confirm & Submit Order</Button>
          <p className="text-xs text-center text-gray-500 mt-3">Orders require admin approval before processing</p>
        </div>
      </div>
    </div>
  );
}
