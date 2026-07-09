import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '../../../firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Textarea } from '../../components/ui/textarea';
import { ArrowLeft, MapPin, Truck, Home as HomeIcon, Calendar, Banknote, Smartphone, Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { getMaxPrepDaysFromCart } from '../../utils/business';
import { User } from '../../App';
import PageContainer from '../../components/ui/PageContainer';
import FormSection from '../../components/ui/FormSection';
import { getDailyLimits, getOrderCountForDate } from '../../utils/db';
import { geocodeAddress } from '../../utils/geocode';
import { feeForDistanceKm, feeForPostalCode, MAX_DELIVERY_KM } from '../../utils/delivery';

const paymentOptions = [
  { value: 'cash' as const, Icon: Banknote, label: 'Cash', desc: 'Pay on pickup only — not available for delivery orders' },
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
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'tng' | 'fpx' | ''>('');
  const [paymentNote, setPaymentNote] = useState('');
  const [dateCapacity, setDateCapacity] = useState<{ count: number; limit: number } | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const errorBoxRef = useRef<HTMLDivElement>(null);

  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number | null>(null);
  const [feeStatus, setFeeStatus] = useState<'idle' | 'calculating' | 'distance' | 'postal-fallback' | 'out-of-range'>('idle');

  const [minPrepDays] = useState(() => Math.max(1, getMaxPrepDaysFromCart(cartItems)));
  const [minDate] = useState(() => {
    const days = Math.max(1, getMaxPrepDaysFromCart(cartItems));
    const min = new Date();
    min.setDate(min.getDate() + days);
    // Use local date parts — toISOString() returns UTC and shifts the date after 8 PM in MY timezone
    const y = min.getFullYear();
    const m = String(min.getMonth() + 1).padStart(2, '0');
    const d = String(min.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  useEffect(() => {
    if (cartItems.length === 0) navigate('/customer/cart');
  }, [cartItems.length, navigate]);

  useEffect(() => {
    if (!deliveryDate) { setDateCapacity(null); return; }
    Promise.all([getOrderCountForDate(deliveryDate), getDailyLimits()])
      .then(([count, limits]) => { setDateCapacity({ count, limit: limits[deliveryDate] ?? 0 }); })
      .catch(() => { /* capacity display unavailable on read failure */ });
  }, [deliveryDate]);

  // Distance is computed via a Cloud Function (openrouteservice key stays server-side)
  // from the customer's geocoded address to the kitchen. If geocoding or routing
  // fails for any reason, fall back to the old postal-code zone pricing so
  // checkout never gets stuck.
  //
  // feeRequestId guards against out-of-order responses: if the address is edited
  // again before the first lookup finishes, the earlier (now-stale) response must
  // not be allowed to overwrite state set by the newer one.
  const feeRequestId = useRef(0);

  const calculateDeliveryFee = async () => {
    if (deliveryMethod !== 'delivery' || !deliveryAddress.trim() || postalCode.length !== 5) return;
    const requestId = ++feeRequestId.current;
    setFeeStatus('calculating');
    try {
      const point = await geocodeAddress(deliveryAddress, postalCode);
      if (requestId !== feeRequestId.current) return;
      if (!point) throw new Error('Address not found');

      const functions = getFunctions(firebaseApp, 'asia-southeast1');
      const calculateDeliveryDistance = httpsCallable(functions, 'calculateDeliveryDistance');
      const result: any = await calculateDeliveryDistance({ lat: point.lat, lon: point.lon });
      if (requestId !== feeRequestId.current) return;

      const distanceKm: number = result.data.distanceKm;
      setDeliveryDistanceKm(distanceKm);

      const fee = feeForDistanceKm(distanceKm);
      if (fee === null) {
        setDeliveryCharge(0);
        setFeeStatus('out-of-range');
      } else {
        setDeliveryCharge(fee);
        setFeeStatus('distance');
      }
    } catch {
      if (requestId !== feeRequestId.current) return;
      setDeliveryDistanceKm(null);
      setDeliveryCharge(feeForPostalCode(postalCode));
      setFeeStatus('postal-fallback');
    }
  };

  useEffect(() => {
    if (deliveryMethod === 'pickup') {
      setDeliveryCharge(0);
      setDeliveryDistanceKm(null);
      setFeeStatus('idle');
    } else if (paymentMethod === 'cash') {
      // Cash is pickup-only — clear a stale selection carried over from before switching to delivery
      setPaymentMethod('');
    }
  }, [deliveryMethod]);

  const subtotal = getCartTotal();
  const total = subtotal + deliveryCharge;

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
      // The date picker enforces min, but a typed date can bypass it
      errors.push(`The earliest available date is ${new Date(`${minDate}T00:00:00`).toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — your items need ${minPrepDays} day${minPrepDays !== 1 ? 's' : ''} to prepare`);
    }
    if (deliveryMethod === 'delivery' && !deliveryAddress) errors.push('Please fill in your delivery address');
    if (deliveryMethod === 'delivery' && !postalCode) errors.push('Please fill in your postal code');
    if (deliveryMethod === 'delivery' && feeStatus === 'calculating') errors.push('Please wait for the delivery fee to finish calculating');
    if (deliveryMethod === 'delivery' && feeStatus === 'out-of-range') errors.push(`Sorry, we don't deliver that far (over ${MAX_DELIVERY_KM}km away). Please choose Pickup or a closer address.`);
    if (!contactPhone) errors.push('Please provide a contact phone number');
    if (!paymentMethod) errors.push('Please select a payment method');
    if (paymentMethod === 'cash' && deliveryMethod === 'delivery') errors.push('Cash is only available for pickup — please choose an online payment method, or switch to pickup');

    if (errors.length > 0) {
      showErrors(errors);
      return;
    }

    // Re-check capacity right before proceeding (counts come from the public
    // orderCounts collection, so this works for customers too)
    try {
      const [count, limits] = await Promise.all([getOrderCountForDate(deliveryDate), getDailyLimits()]);
      const limit = limits[deliveryDate] ?? 0;
      if (limit > 0 && count >= limit) {
        showErrors(['The selected date is fully booked. Please choose another date.']);
        return;
      }
    } catch {
      // Network hiccup — don't block the order over a failed capacity read
    }

    setFormErrors([]);

    // This is only what gets shown on the confirmation screen before the
    // customer commits — submitOrder() (called from OrderConfirmationPage /
    // ToyyibPayReturnPage) recomputes subtotal/total/items from the live
    // product catalog and ignores whatever is written here, so nothing in
    // this object is trusted for the actual order.
    const pendingOrder = {
      clientRequestId: crypto.randomUUID(),
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
    if (paymentMethod === 'tng' || paymentMethod === 'fpx') {
      navigate('/customer/payment');
    } else {
      navigate('/customer/order-confirmation');
    }
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
              <Label htmlFor="deliveryDate" className="text-base">Select Date *</Label>
              <Input id="deliveryDate" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} min={minDate} className="text-base" />
              <p className="text-base text-gray-700">Items in your cart require at least {minPrepDays} day{minPrepDays !== 1 ? 's' : ''} advance notice</p>
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
                  {feeStatus === 'calculating' ? <Loader2 className="w-5 h-5 animate-spin" /> : deliveryCharge > 0 ? `RM ${deliveryCharge.toFixed(2)}` : 'Calculated'}
                </span>
              </div>
            </RadioGroup>

            {deliveryMethod === 'delivery' && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-base">Delivery Address *</Label>
                  <Textarea id="address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} onBlur={calculateDeliveryFee} placeholder="Enter your complete delivery address" className="min-h-24 text-base" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode" className="text-base">Postal Code *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input id="postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, ''))} onBlur={calculateDeliveryFee} placeholder="e.g., 50470" className="pl-12 text-base" maxLength={5} />
                  </div>
                  {feeStatus === 'calculating' && (
                    <p className="text-sm text-gray-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Calculating delivery fee…</p>
                  )}
                  {feeStatus === 'distance' && (
                    <p className="text-sm text-green-600">✓ Delivery charge: RM {deliveryCharge.toFixed(2)} ({deliveryDistanceKm?.toFixed(1)} km away)</p>
                  )}
                  {feeStatus === 'postal-fallback' && (
                    <p className="text-sm text-amber-600">✓ Delivery charge (estimated): RM {deliveryCharge.toFixed(2)}</p>
                  )}
                  {feeStatus === 'out-of-range' && (
                    <p className="text-sm text-red-600">Sorry, this address is beyond our {MAX_DELIVERY_KM}km delivery radius{deliveryDistanceKm ? ` (${deliveryDistanceKm.toFixed(1)} km away)` : ''}. Please choose Pickup instead.</p>
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
                <span className="font-semibold">
                  {feeStatus === 'calculating' ? 'Calculating…' : deliveryCharge === 0 ? 'FREE' : `RM ${deliveryCharge.toFixed(2)}`}
                </span>
              </div>
              <div className="flex items-center justify-between text-xl pt-3 border-t">
                <span className="font-bold text-gray-900">Total:</span>
                <span className="font-bold text-orange-600">RM {total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <Label className="text-base font-semibold">Payment Method *</Label>
                <div className="space-y-3 mt-3">
                  {paymentOptions
                    .filter(({ value }) => !(value === 'cash' && deliveryMethod === 'delivery'))
                    .map(({ value, Icon, label, desc }) => (
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
                {paymentMethod === 'tng' || paymentMethod === 'fpx' ? 'Proceed to Online Payment' : 'Review My Order →'}
              </Button>
              <p className="text-sm text-center text-gray-600">Orders require admin approval before processing</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
