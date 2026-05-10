import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, CreditCard, Upload, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../../App';

interface OrderSummaryPageProps {
  user: User;
}

export default function OrderSummaryPage({ user }: OrderSummaryPageProps) {
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState<any>(null);

  useEffect(() => {
    const data = sessionStorage.getItem('currentOrder');
    if (data) {
      setOrderData(JSON.parse(data));
    } else {
      navigate('/customer/home');
    }
  }, [navigate]);

  const handleConfirmOrder = () => {
    // Save order to localStorage (simulating database)
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const newOrder = {
      id: Date.now().toString(),
      customerId: user.id,
      customerName: user.name,
      ...orderData,
      status: 'Pending Approval',
      createdAt: new Date().toISOString()
    };
    orders.push(newOrder);
    localStorage.setItem('orders', JSON.stringify(orders));

    sessionStorage.removeItem('currentOrder');
    toast.success('Order submitted! Waiting for approval.');
    navigate('/customer/tracking');
  };

  if (!orderData) {
    return null;
  }

  return (
    <div className="min-h-screen pb-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <Link to="/customer/home" className="inline-flex items-center text-white hover:text-gray-100 mb-4">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back</span>
          </Link>
          <h1 className="text-2xl">Order Summary</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-4 pb-4 border-b">
              <img
                src={orderData.product.image}
                alt={orderData.product.name}
                className="w-24 h-24 rounded-lg object-cover"
              />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{orderData.product.name}</h3>
                <p className="text-gray-600 text-sm mt-1">{orderData.product.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-gray-600">Quantity: {orderData.quantity} {orderData.product.unit}</span>
                  <span className="text-lg font-semibold">${orderData.product.price.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Delivery/Pickup Date</span>
                <Badge variant="outline" className="text-base px-4 py-1">
                  {new Date(orderData.deliveryDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Badge>
              </div>

              {orderData.notes && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-gray-600 mb-1">Special Instructions:</p>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{orderData.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Price Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-lg">
              <span className="text-gray-600">Subtotal</span>
              <span>${orderData.totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-lg">
              <span className="text-gray-600">Delivery Fee</span>
              <span className="text-green-600">Free</span>
            </div>
            <div className="pt-4 border-t flex items-center justify-between">
              <span className="text-xl font-semibold text-gray-900">Total Amount</span>
              <span className="text-3xl font-bold text-orange-600">${orderData.totalPrice.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Instructions */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="w-5 h-5 mr-2" />
              Payment Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-base">Payment Methods:</Label>
              <div className="space-y-2 text-gray-700">
                <p>• Bank Transfer: Account 1234-5678-9012</p>
                <p>• E-Wallet: +1 (555) 123-4567</p>
                <p>• Cash on Delivery (Available)</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base">Upload Payment Proof (Optional)</Label>
              <Button variant="outline" className="w-full h-14 border-2 border-dashed">
                <Upload className="w-5 h-5 mr-2" />
                Upload Screenshot
              </Button>
              <p className="text-sm text-gray-600">
                You can also make payment upon pickup/delivery
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Confirm Button */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3 mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <p className="text-gray-900 mb-2">
                  By confirming, you agree to our terms and conditions. We'll start preparing your order once confirmed.
                </p>
                <p className="text-sm text-gray-600">
                  You'll receive order updates via notifications.
                </p>
              </div>
            </div>
            <Button
              size="lg"
              onClick={handleConfirmOrder}
              className="w-full h-14 text-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Confirm Order
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}