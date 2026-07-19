import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Textarea } from '../../components/ui/textarea';
import { ArrowLeft, MapPin, Truck, Home as HomeIcon, Calendar, Smartphone, Building2, CheckCircle2 } from 'lucide-react';
import { Calendar as CalendarPicker } from '../../components/ui/calendar';
import { useCart } from '../../context/CartContext';
import { OrderWindow, getMaxPrepDaysFromCart, isDateOrderable, normalizeOpenOrderRanges, toLocalYMD } from '../../utils/business';
import { User } from '../../App';
import PageContainer from '../../components/ui/PageContainer';
import FormSection from '../../components/ui/FormSection';
import { getSettings } from '../../utils/db';

// Cash was removed on the admin's request — every order is paid online before
// it exists, which is also what lets orders skip the old approval step.
const paymentOptions = [
  { value: 'tng' as const, Icon: Smartphone, label: 'DuitNow QR / E-Wallet', desc: "e.g. Touch 'n Go, GrabPay, Boost, ShopeePay, MAE, or your banking app" },
  { value: 'fpx' as const, Icon: Building2, label: 'FPX Online Banking', desc: 'e.g. Maybank2u, CIMB Clicks, Public Bank, RHB, Hong Leong, Bank Islam' },
];

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
  const [paymentMethod, setPaymentMethod] = useState<'tng' | 'fpx' | ''>('');
  const [paymentNote, setPaymentNote] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const errorBoxRef = useRef<HTMLDivElement>(null);

  const [minPrepDays] = useState(() => Math.max(1, getMaxPrepDaysFromCart(cartItems)));

  // Orders are only accepted on admin-opened date windows (configured on the
  // Schedule page) — closed by default until at least one is added.
  const [openOrderRanges, setOpenOrderRanges] = useState<OrderWindow[]>([]);

  useEffect(() => {
    getSettings()
      .then(s => {
        setOpenOrderRanges(normalizeOpenOrderRanges(s?.openOrderRanges));
      })
      .catch(() => { /* defaults already applied */ });
  }, []);

  const minDate = useMemo(() => {
    const min = new Date();
    min.setDate(min.getDate() + minPrepDays);
    return toLocalYMD(min);
  }, [minPrepDays]);

  useEffect(() => {
    if (cartItems.length === 0) navigate('/customer/cart');
  }, [cartItems.length, navigate]);

  // Delivery fees are no longer calculated or collected here — the admin
  // arranges a Grab delivery and confirms the exact fee with the customer over
  // WhatsApp, since it depends on the Grab rate at their chosen date and time.
  const subtotal = getCartTotal();
  const total = subtotal;

  const showErrors = (errors: string[]) => {
    setFormErrors(errors);
    // Wait a frame so the error box exists before scrolling to it
    requestAnimationFrame(() => errorBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const handlePlaceOrder = async () => {
    // Collect every problem at once and show them persistently near the button —
    // transient toasts are easy to miss, especially for older customers.
    const errors: string[] = [];
    if (!deliveryDate) {
      errors.push('Please select a pickup/delivery date');
    } else if (deliveryDate < minDate) {
      // The calendar disables these, but guard against a stale selection
      errors.push(`The earliest available date is ${new Date(`${minDate}T00:00:00`).toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — orders need at least ${minPrepDays} day${minPrepDays !== 1 ? 's' : ''} advance notice`);
    } else if (!isDateOrderable(deliveryDate, openOrderRanges)) {
      errors.push('The selected date is not currently open for ordering — please pick a highlighted date on the calendar');
    }
    if (deliveryMethod === 'delivery' && !deliveryAddress) errors.push('Please fill in your delivery address');
    if (deliveryMethod === 'delivery' && !postalCode) errors.push('Please fill in your postal code');
    if (deliveryMethod === 'delivery' && postalCode && postalCode.length !== 5) errors.push('Postal code must be 5 digits');
    if (!contactPhone) errors.push('Please provide a contact phone number');
    if (!paymentMethod) errors.push('Please select a payment method');

    if (errors.length > 0) {
      showErrors(errors);
      return;
    }

    setFormErrors([]);

    // This is only what gets shown on the payment screen before the customer
    // commits — submitOrder() (called from ToyyibPayReturnPage) recomputes
    // subtotal/total/items from the live product catalog and ignores whatever
    // is written here, so nothing in this object is trusted for the actual order.
    const pendingOrder = {
      clientRequestId: crypto.randomUUID(),
      customerId: user.id,
      customerName: user.name,
      customerPhone: contactPhone,
      items: cartItems,
      subtotal,
      total,
      deliveryMethod,
      deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : 'Pickup',
      postalCode: deliveryMethod === 'delivery' ? postalCode : '',
      specialInstructions,
      paymentMethod,
      paymentNote,
      orderDate: new Date().toISOString(),
      deliveryDate,
      finalizedNumber: null,
    };

    sessionStorage.setItem('pendingOrder', JSON.stringify(pendingOrder));
    navigate('/customer/payment');
  };

  if (cartItems.length === 0) return null;

  return (
    <PageContainer>
      <div className="page-hero page-hero--rounded">
        <Link to="/customer/cart" className="page-back-link">
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
              <Label className="text-base">Select Date *</Label>
              {openOrderRanges.length === 0 ? (
                <div className="alert-box">
                  <p className="text-sm text-red-800">
                    Ordering is currently closed — no dates are available yet. Please check back soon.
                  </p>
                </div>
              ) : (
                <div className="info-box">
                  <p className="text-sm text-blue-900">
                    <strong>Available dates:</strong> {openOrderRanges.map(r =>
                      `${new Date(`${r.start}T00:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'long' })} – ${new Date(`${r.end}T00:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    ).join(', ')}
                  </p>
                </div>
              )}
              <div className="flex justify-center rounded-lg border border-gray-200 bg-white">
                <CalendarPicker
                  mode="single"
                  selected={deliveryDate ? new Date(`${deliveryDate}T00:00:00`) : undefined}
                  onSelect={(d) => setDeliveryDate(d ? toLocalYMD(d) : '')}
                  defaultMonth={new Date(`${(deliveryDate && deliveryDate >= minDate ? deliveryDate : minDate)}T00:00:00`)}
                  fromDate={new Date(`${minDate}T00:00:00`)}
                  disabled={[
                    { before: new Date(`${minDate}T00:00:00`) },
                    (date: Date) => !isDateOrderable(toLocalYMD(date), openOrderRanges),
                  ]}
                />
              </div>
              {deliveryDate && (
                <p className="text-base font-medium text-gray-900">
                  Selected: {new Date(`${deliveryDate}T00:00:00`).toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
              <p className="text-base text-gray-700">Orders require at least {minPrepDays} day{minPrepDays !== 1 ? 's' : ''} advance notice</p>
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
                <span className="text-sm font-semibold text-orange-600 text-right">Fee via WhatsApp</span>
              </div>
            </RadioGroup>

            {deliveryMethod === 'delivery' && (
              <div className="space-y-4 pt-4 border-t">
                <div className="info-box">
                  <p className="text-sm text-blue-900">
                    <strong>About the delivery fee:</strong> it is not included in your order total. Delivery is
                    arranged through Grab, so the fee depends on the Grab rate for your chosen date and time —
                    we'll contact you on WhatsApp to confirm the exact charge.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-base">Delivery Address *</Label>
                  <Textarea id="address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Enter your complete delivery address" className="min-h-24 text-base" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode" className="text-base">Postal Code *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input id="postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, ''))} placeholder="e.g., 50470" className="pl-12 text-base" maxLength={5} />
                  </div>
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
              <Input id="phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="60123456789" className="h-12 text-base" />
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
              {deliveryMethod === 'delivery' && (
                <div className="flex items-center justify-between text-base">
                  <span className="text-gray-700 flex items-center gap-2"><Truck className="w-4 h-4" />Delivery Fee:</span>
                  <span className="font-semibold text-gray-600">Confirmed via WhatsApp</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xl pt-3 border-t">
                <span className="font-bold text-gray-900">Total{deliveryMethod === 'delivery' ? ' (excl. delivery)' : ''}:</span>
                <span className="font-bold text-orange-600">RM {total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <Label className="text-base font-semibold">Payment Method *</Label>
                <div className="space-y-3 mt-3">
                  {paymentOptions.map(({ value, Icon, label, desc }) => (
                    <div
                      key={value}
                      onClick={() => setPaymentMethod(value)}
                      className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all select-none ${
                        paymentMethod === value
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 bg-white hover:border-orange-300'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        paymentMethod === value ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold ${paymentMethod === value ? 'text-orange-800' : 'text-gray-800'}`}>{label}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
                      </div>
                      {paymentMethod === value && <CheckCircle2 className="w-6 h-6 text-orange-500 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-base">Additional Notes <span className="text-gray-400 font-normal text-sm">(Optional)</span></Label>
                <Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} className="mt-2 h-12" placeholder="e.g. allergy info, gift packaging, etc." />
              </div>
              {formErrors.length > 0 && (
                <div ref={errorBoxRef} className="bg-red-50 border-2 border-red-200 rounded-lg p-4 space-y-1">
                  <p className="font-semibold text-red-800">Please fix the following before continuing:</p>
                  {formErrors.map((err, idx) => (
                    <p key={idx} className="text-red-700">• {err}</p>
                  ))}
                </div>
              )}
              <Button size="lg" onClick={handlePlaceOrder} className="w-full brand-button h-14 text-lg">
                Proceed to Online Payment
              </Button>
              <p className="text-sm text-center text-gray-600">Your order is confirmed immediately once payment succeeds</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
