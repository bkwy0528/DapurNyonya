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
import { getMaxPrepDaysFromCart } from '../../utils/business';
import { User } from '../../App';
import { toast } from 'sonner';
import PageContainer from '../../components/ui/PageContainer';
import FormSection from '../../components/ui/FormSection';
import { getDailyLimits, getOrderCountForDate } from '../../utils/db';

interface CheckoutPageProps {
  user: User;
}

export default function CheckoutPage({ user }: CheckoutPageProps) {
  const navigate = useNavigate();
  const { cartItems, getCartTotal } = useCart();
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState(user.address || '');
  const [postalCode, setPostalCode] = useState('');
  const [contactPhone, setContactPhone] = useState(user.phone);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'ewallet' | 'debit' | ''>('');
  const [paymentNote, setPaymentNote] = useState('');
  const [dateCapacity, setDateCapacity] = useState<{ count: number; limit: number } | null>(null);

  const [minDate] = useState(() => {
    const maxPrep = getMaxPrepDaysFromCart(cartItems);
    const min = new Date();
    min.setDate(min.getDate() + Math.max(1, maxPrep));
    return min.toISOString().split('T')[0];
  });

  useEffect(() => {
    if (cartItems.length === 0) navigate('/customer/cart');
  }, [cartItems.length, navigate]);

  useEffect(() => {
    if (!deliveryDate) { setDateCapacity(null); return; }
    Promise.all([getOrderCountForDate(deliveryDate), getDailyLimits()]).then(([count, limits]) => {
      setDateCapacity({ count, limit: limits[deliveryDate] ?? 0 });
    });
  }, [deliveryDate]);

  const calculateDeliveryCharge = (): number => {
    if (deliveryMethod === 'pickup') return 0;
    if (!postalCode) return 0;
    const first = parseInt(postalCode.charAt(0));
    if (first >= 5 && first <= 6) return 5.00;
    if (first >= 1 && first <= 4) return 8.00;
    if (first >= 7 && first <= 9) return 12.00;
    return 10.00;
  };

  const subtotal = getCartTotal();
  const deliveryCharge = calculateDeliveryCharge();
  const total = subtotal + deliveryCharge;

  const handlePlaceOrder = async () => {
    if (!deliveryDate) {
      toast.error('Please select a pickup/delivery date');
      return;
    }
    if (deliveryMethod === 'delivery' && (!deliveryAddress || !postalCode)) {
      toast.error('Please fill in delivery address and postal code');
      return;
    }
    if (!contactPhone) {
      toast.error('Please provide a contact phone number');
      return;
    }
    if (!paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }

    // Re-check capacity before proceeding
    const [count, limits] = await Promise.all([getOrderCountForDate(deliveryDate), getDailyLimits()]);
    const limit = limits[deliveryDate] ?? 0;
    if (limit > 0 && count >= limit) {
      toast.error('Selected date is fully booked. Please choose another date');
      return;
    }

    const pendingOrder = {
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
      paymentMethod,
      paymentNote,
      status: 'Pending Approval',
      orderDate: new Date().toISOString(),
      deliveryDate,
      finalizedNumber: null,
    };

    sessionStorage.setItem('pendingOrder', JSON.stringify(pendingOrder));
    navigate('/customer/order-confirmation');
  };

  if (cartItems.length === 0) return null;

  return (
    <PageContainer>
      <div className="page-hero page-hero--rounded">
        <Link to="/customer/cart" className="inline-flex items-center text-white hover:text-gray-100 mb-2">
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span className="text-lg">Back to Cart</span>
        </Link>
        <h1 className="text-2xl">Checkout</h1>
      </div>

      <div className="px-0 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Calendar className="w-6 h-6 text-orange-600" />
              Pickup/Delivery Date
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormSection>
              <Label htmlFor="deliveryDate" className="text-base">Select Date *</Label>
              <Input id="deliveryDate" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} min={minDate} className="text-base" />
              <p className="text-sm text-gray-600">Orders require minimum 3-5 days advance notice</p>
              {dateCapacity && dateCapacity.limit > 0 && (
                dateCapacity.count >= dateCapacity.limit
                  ? <p className="text-sm text-red-600">Selected date is fully booked. Please choose another date.</p>
                  : <p className="text-sm text-green-700">Available slots: {Math.max(0, dateCapacity.limit - dateCapacity.count)} of {dateCapacity.limit} remaining</p>
              )}
            </FormSection>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Truck className="w-6 h-6 text-orange-600" />
              Delivery Method
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as 'pickup' | 'delivery')}>
              <div className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${deliveryMethod === 'pickup' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`} onClick={() => setDeliveryMethod('pickup')}>
                <RadioGroupItem value="pickup" id="pickup" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="pickup" className="text-lg cursor-pointer flex items-center gap-2">
                    <HomeIcon className="w-5 h-5" />Pickup
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">Pick up your order from our location (Free)</p>
                </div>
                <span className="text-lg font-bold text-green-600">FREE</span>
              </div>

              <div className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${deliveryMethod === 'delivery' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`} onClick={() => setDeliveryMethod('delivery')}>
                <RadioGroupItem value="delivery" id="delivery" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="delivery" className="text-lg cursor-pointer flex items-center gap-2">
                    <Truck className="w-5 h-5" />Delivery
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
                  <Textarea id="address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Enter your complete delivery address" className="min-h-24 text-base" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode" className="text-base">Postal Code *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input id="postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="e.g., 50470" className="pl-12 text-base" maxLength={5} />
                  </div>
                  {postalCode && deliveryCharge > 0 && (
                    <p className="text-sm text-green-600">✓ Delivery charge calculated: RM {deliveryCharge.toFixed(2)}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-base">Contact Phone *</Label>
              <Input id="phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+60 12-345 6789" className="h-12 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instructions" className="text-base">Special Instructions (Optional)</Label>
              <Textarea id="instructions" value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} placeholder="Any special delivery or preparation instructions?" className="min-h-24 text-base" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200">
          <CardHeader>
            <CardTitle className="text-xl">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {cartItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{item.name} × {item.quantity}</span>
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
                <span className="text-gray-700 flex items-center gap-2"><Truck className="w-4 h-4" />Delivery Charge:</span>
                <span className="font-semibold">{deliveryCharge === 0 ? 'FREE' : `RM ${deliveryCharge.toFixed(2)}`}</span>
              </div>
              <div className="flex items-center justify-between text-xl pt-3 border-t">
                <span className="font-bold text-gray-900">Total:</span>
                <span className="font-bold text-orange-600">RM {total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-base">Payment Method *</Label>
                <div className="flex flex-col sm:flex-row gap-3 mt-2">
                  <Button type="button" variant={paymentMethod === 'cash' ? 'secondary' : 'outline'} className={`w-full sm:w-auto px-4 py-3 ${paymentMethod === 'cash' ? 'border-orange-500 bg-orange-50' : ''}`} onClick={() => setPaymentMethod('cash')}>Cash</Button>
                  <Button type="button" variant={paymentMethod === 'ewallet' ? 'secondary' : 'outline'} className={`w-full sm:w-auto px-4 py-3 ${paymentMethod === 'ewallet' ? 'border-orange-500 bg-orange-50' : ''}`} onClick={() => setPaymentMethod('ewallet')}>Touch 'n Go eWallet</Button>
                  <Button type="button" variant={paymentMethod === 'debit' ? 'secondary' : 'outline'} className={`w-full sm:w-auto px-4 py-3 ${paymentMethod === 'debit' ? 'border-orange-500 bg-orange-50' : ''}`} onClick={() => setPaymentMethod('debit')}>Debit Card</Button>
                </div>
              </div>
              <div>
                <Label className="text-base">Payment Note (optional)</Label>
                <Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} className="mt-2" />
              </div>
              <Button size="lg" onClick={handlePlaceOrder} className="w-full bg-gradient-to-r from-green-500 to-emerald-500">
                Proceed to Confirmation
              </Button>
              <p className="text-xs text-center text-gray-600">Orders require admin approval before processing</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
