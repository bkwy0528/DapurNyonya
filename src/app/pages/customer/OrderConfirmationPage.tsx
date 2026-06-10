import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useCart } from '../../context/CartContext';
import { toast } from 'sonner';
import { createOrder } from '../../utils/db';

export default function OrderConfirmationPage() {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [pendingOrder, setPendingOrder] = useState<any>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('pendingOrder');
    if (raw) setPendingOrder(JSON.parse(raw));
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

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Confirm Your Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Delivery Date</p>
              <p className="font-semibold">{pendingOrder.deliveryDate}</p>
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
              <p className="font-semibold capitalize">{pendingOrder.paymentMethod}</p>
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
                <span className="font-bold text-orange-600">RM {(pendingOrder.total || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-4">
              <Button onClick={handleConfirm} className="w-full success-button">Confirm & Submit Order</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
