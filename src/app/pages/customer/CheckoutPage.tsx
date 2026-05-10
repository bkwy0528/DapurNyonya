import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Textarea } from '../../components/ui/textarea';
import { ArrowLeft, MapPin, Truck, Home as HomeIcon, Calendar } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { User } from '../../App';
import { toast } from 'sonner';

interface CheckoutPageProps {
  user: User;
}

export default function CheckoutPage({ user }: CheckoutPageProps) {
  const navigate = useNavigate();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState(user.address || '');
  const [postalCode, setPostalCode] = useState('');
  const [contactPhone, setContactPhone] = useState(user.phone);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  // Get tomorrow's date as minimum
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const [minDate] = useState(getTomorrowDate());

  // Delivery charge calculation based on postal code (simplified)
  const calculateDeliveryCharge = (): number => {
    if (deliveryMethod === 'pickup') return 0;
    
    if (!postalCode) return 0;
    
    // Simplified distance-based pricing for Malaysia
    const firstDigit = parseInt(postalCode.charAt(0));
    
    // Pricing tiers based on postal code ranges
    if (firstDigit >= 5 && firstDigit <= 6) {
      // Kuala Lumpur / Selangor area - closer
      return 5.00;
    } else if (firstDigit >= 1 && firstDigit <= 4) {
      // Northern states - medium distance
      return 8.00;
    } else if (firstDigit >= 7 && firstDigit <= 9) {
      // Southern and Eastern states - farther
      return 12.00;
    }
    
    return 10.00; // Default delivery charge
  };

  const subtotal = getCartTotal();
  const deliveryCharge = calculateDeliveryCharge();
  const total = subtotal + deliveryCharge;

  useEffect(() => {
    if (cartItems.length === 0) {
      navigate('/customer/cart');
    }
  }, [cartItems.length, navigate]);

  const handlePlaceOrder = () => {
    if (!deliveryDate) {
      toast.error('Please select a pickup/delivery date');
      return;
    }

    if (deliveryMethod === 'delivery') {
      if (!deliveryAddress || !postalCode) {
        toast.error('Please fill in delivery address and postal code');
        return;
      }
    }

    if (!contactPhone) {
      toast.error('Please provide a contact phone number');
      return;
    }

    // Create order
    const order = {
      id: Date.now().toString(),
      customerId: user.id,
      customerName: user.name,
      customerPhone: contactPhone,
      items: cartItems,
      subtotal,
      deliveryCharge,
      total,
      deliveryMethod,
      deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : 'Pickup',
      postalCode: deliveryMethod === 'delivery' ? postalCode : '',
      specialInstructions,
      status: 'Pending Approval',
      orderDate: new Date().toISOString(),
      deliveryDate,
    };

    // Save order
    const existingOrders = JSON.parse(localStorage.getItem('orders') || '[]');
    localStorage.setItem('orders', JSON.stringify([...existingOrders, order]));

    // Clear cart
    clearCart();

    toast.success('Order placed successfully!');
    navigate('/customer/tracking');
  };

  if (cartItems.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <Link to="/customer/cart" className="inline-flex items-center text-white hover:text-gray-100 mb-4">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back to Cart</span>
          </Link>
          <h1 className="text-2xl">Checkout</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Delivery Date */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Calendar className="w-6 h-6 text-orange-600" />
              Pickup/Delivery Date
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deliveryDate" className="text-base">Select Date *</Label>
              <Input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                min={minDate}
                className="h-12 text-base"
              />
              <p className="text-sm text-gray-600">
                Orders require minimum 3-5 days advance notice
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Method */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Truck className="w-6 h-6 text-orange-600" />
              Delivery Method
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup 
              value={deliveryMethod} 
              onValueChange={(value) => setDeliveryMethod(value as 'pickup' | 'delivery')}
            >
              <div 
                className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  deliveryMethod === 'pickup' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'
                }`}
                onClick={() => setDeliveryMethod('pickup')}
              >
                <RadioGroupItem value="pickup" id="pickup" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="pickup" className="text-lg cursor-pointer flex items-center gap-2">
                    <HomeIcon className="w-5 h-5" />
                    Pickup
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">Pick up your order from our location (Free)</p>
                </div>
                <span className="text-lg font-bold text-green-600">FREE</span>
              </div>

              <div 
                className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  deliveryMethod === 'delivery' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'
                }`}
                onClick={() => setDeliveryMethod('delivery')}
              >
                <RadioGroupItem value="delivery" id="delivery" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="delivery" className="text-lg cursor-pointer flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Delivery
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">Get your order delivered to your doorstep</p>
                </div>
                <span className="text-lg font-bold text-orange-600">
                  {deliveryCharge > 0 ? `RM ${deliveryCharge.toFixed(2)}` : 'Calculated'}
                </span>
              </div>
            </RadioGroup>

            {deliveryMethod === 'delivery' && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-base">Delivery Address *</Label>
                  <Textarea
                    id="address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter your complete delivery address"
                    className="min-h-24 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postalCode" className="text-base">Postal Code *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="postalCode"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="e.g., 50470"
                      className="pl-12 h-12 text-base"
                      maxLength={5}
                    />
                  </div>
                  {postalCode && deliveryCharge > 0 && (
                    <p className="text-sm text-green-600">
                      ✓ Delivery charge calculated: RM {deliveryCharge.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-base">Contact Phone *</Label>
              <Input
                id="phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+60 12-345 6789"
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions" className="text-base">Special Instructions (Optional)</Label>
              <Textarea
                id="instructions"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Any special delivery or preparation instructions?"
                className="min-h-24 text-base"
              />
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200">
          <CardHeader>
            <CardTitle className="text-xl">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {cartItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-semibold">RM {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between text-base">
                <span className="text-gray-700">Subtotal:</span>
                <span className="font-semibold">RM {subtotal.toFixed(2)}</span>
              </div>
              
              <div className="flex items-center justify-between text-base">
                <span className="text-gray-700 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Delivery Charge:
                </span>
                <span className="font-semibold">
                  {deliveryCharge === 0 ? 'FREE' : `RM ${deliveryCharge.toFixed(2)}`}
                </span>
              </div>

              <div className="flex items-center justify-between text-xl pt-3 border-t">
                <span className="font-bold text-gray-900">Total:</span>
                <span className="font-bold text-orange-600">RM {total.toFixed(2)}</span>
              </div>
            </div>

            <Button
              onClick={handlePlaceOrder}
              size="lg"
              className="w-full h-14 text-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            >
              Place Order
            </Button>

            <p className="text-xs text-center text-gray-600">
              Orders require admin approval before processing
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}