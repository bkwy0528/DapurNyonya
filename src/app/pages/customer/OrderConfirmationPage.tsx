import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ArrowLeft, Banknote, CheckCircle2, Smartphone, Wallet, CreditCard } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useCart } from '../../context/CartContext';
import { toast } from 'sonner';
import { createOrder, getSettings } from '../../utils/db';

// ─── Stripe receipt (card payment already processed) ─────────────────────────

function StripeReceiptView({ confirmed }: { confirmed: any }) {
  const navigate = useNavigate();
  const shortId = confirmed.paymentIntentId
    ? `…${confirmed.paymentIntentId.slice(-10)}`
    : '—';
  const paidAt = confirmed.paidAt
    ? new Date(confirmed.paidAt).toLocaleString('en-MY', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';
  const deliveryFormatted = confirmed.deliveryDate
    ? new Date(`${confirmed.deliveryDate}T00:00:00`).toLocaleDateString('en-MY', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  return (
    <div className="min-h-screen pb-24">
      <div className="page-hero page-hero--rounded">
        <h1 className="text-2xl">Order Confirmed!</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Success banner */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-300">
          <CardContent className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold text-green-800">Payment Successful</h2>
            <p className="text-green-700">Your order is confirmed and we'll start preparing it soon.</p>
          </CardContent>
        </Card>

        {/* Receipt card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-600" />
              Receipt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Payment Reference</span>
              <span className="font-mono text-gray-900">{shortId}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Paid At</span>
              <span className="text-gray-900">{paidAt}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Payment Method</span>
              <Badge className="bg-purple-100 text-purple-800">Credit / Debit Card</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Order Status</span>
              <Badge className="bg-blue-100 text-blue-800">Order Received</Badge>
            </div>

            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-semibold text-gray-900 mb-2">Items</p>
              {(confirmed.items || []).map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{item.name} × {item.quantity}</span>
                  <span className="font-semibold">RM {((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>RM {(confirmed.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Delivery Charge</span>
                <span>{confirmed.deliveryCharge === 0 ? 'FREE' : `RM ${(confirmed.deliveryCharge || 0).toFixed(2)}`}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-base border-t pt-2">
                <span>Total Paid</span>
                <span className="text-orange-600">RM {(confirmed.total || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Delivery Method</span>
                <span className="font-semibold">{confirmed.deliveryMethod === 'delivery' ? 'Delivery' : 'Pickup'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Date</span>
                <span className="font-semibold">{deliveryFormatted}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={() => navigate('/customer/tracking')}
          className="w-full brand-button h-14 text-lg"
        >
          Track My Order
        </Button>
      </div>
    </div>
  );
}

// ─── Manual payment confirmation (cash / ewallet / debit) ────────────────────

function ManualConfirmView({ pending, settings }: { pending: any; settings: any }) {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [transferReference, setTransferReference] = useState('');

  const requiresReference = ['tng', 'debit'].includes(pending.paymentMethod);

  const handleConfirm = async () => {
    if (requiresReference && !transferReference.trim()) {
      toast.error('Please enter your transaction reference number after making payment');
      return;
    }
    await createOrder({
      ...pending,
      status: 'Pending Approval',
      ...(transferReference.trim() ? { transferReference: transferReference.trim() } : {}),
    });
    sessionStorage.removeItem('pendingOrder');
    clearCart();
    toast.success(
      requiresReference
        ? 'Payment reference submitted! Admin will verify and confirm your order.'
        : 'Order submitted! We will notify you once confirmed.'
    );
    navigate('/customer/tracking');
  };

  const formattedDeliveryDate = pending?.deliveryDate
    ? new Date(`${pending.deliveryDate}T00:00:00`).toLocaleDateString('en-MY', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const paymentLabel: Record<string, string> = {
    cash: 'Cash',
    tng: "Touch 'n Go eWallet",
    debit: 'Bank Transfer / DuitNow',
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
              <p className="font-semibold">{pending.deliveryMethod === 'delivery' ? 'Delivery' : 'Pickup'}</p>
            </div>

            {pending.deliveryMethod === 'delivery' && pending.deliveryAddress && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Delivery Address</p>
                <p className="font-semibold">{pending.deliveryAddress}</p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm text-gray-600">Payment Method</p>
              <p className="font-semibold">{paymentLabel[pending.paymentMethod] ?? pending.paymentMethod}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-600">Items</p>
              {(pending.items || []).map((it: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <span>{it.name} × {it.quantity}</span>
                  <span>RM {((it.price || 0) * (it.quantity || 0)).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Subtotal</span>
                <span className="font-semibold">RM {(pending.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Delivery Charge</span>
                <span className="font-semibold">
                  {pending.deliveryCharge === 0 ? 'FREE' : `RM ${(pending.deliveryCharge || 0).toFixed(2)}`}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-orange-600 text-lg">RM {(pending.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment instructions */}
        {pending.paymentMethod === 'cash' && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-yellow-800">
                <Banknote className="w-5 h-5" />
                Cash Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-yellow-800">
              <p>Please prepare <strong>RM {(pending.total || 0).toFixed(2)}</strong> in cash and pay upon pickup or delivery.</p>
            </CardContent>
          </Card>
        )}

        {pending.paymentMethod === 'tng' && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-green-800">
                <Smartphone className="w-5 h-5" />
                Touch 'n Go eWallet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-green-800">
              {settings?.tngQr ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="bg-white rounded-xl p-4 border-2 border-green-300 shadow-sm">
                    <img src={settings.tngQr} alt="TNG QR Code" className="w-52 h-52 object-contain mx-auto" />
                  </div>
                  <p className="text-center font-semibold">Scan with Touch 'n Go app</p>
                </div>
              ) : settings?.eWallet ? (
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-gray-500 mb-1">TNG number (QR not uploaded yet — transfer manually)</p>
                  <p className="text-xl font-bold text-gray-900">{settings.eWallet}</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg p-3 border border-green-200 text-gray-500 text-xs">TNG QR not uploaded yet. Contact admin for payment details.</div>
              )}
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <p className="text-xs text-gray-500 mb-1">Amount to pay</p>
                <p className="text-2xl font-bold text-orange-600">RM {(pending.total || 0).toFixed(2)}</p>
              </div>
              <ol className="space-y-1 list-decimal list-inside leading-relaxed">
                <li>Open Touch 'n Go app and scan the QR above</li>
                <li>After paying, note the <strong>transaction / reference number</strong> shown by TNG</li>
                <li>Enter it below and click Submit — admin will verify before confirming</li>
              </ol>
              {settings?.paymentInstructions && (
                <p className="leading-relaxed text-xs border-t border-green-200 pt-3">{settings.paymentInstructions}</p>
              )}
              <div className="space-y-1.5 pt-1">
                <Label className="text-sm font-semibold text-green-900">Transaction Reference *</Label>
                <Input placeholder="e.g. TT12345678 or name used in transfer" value={transferReference} onChange={(e) => setTransferReference(e.target.value)} className="bg-white" />
              </div>
            </CardContent>
          </Card>
        )}


        {pending.paymentMethod === 'debit' && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-blue-800">
                <Wallet className="w-5 h-5" />
                Bank Transfer / DuitNow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-blue-800">
              {settings?.duitnowQr ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="bg-white rounded-xl p-4 border-2 border-blue-300 shadow-sm">
                    <img src={settings.duitnowQr} alt="DuitNow QR Code" className="w-52 h-52 object-contain mx-auto" />
                  </div>
                  <p className="text-center font-semibold">Scan with your banking app to transfer</p>
                </div>
              ) : settings?.bankAccount ? (
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-gray-500 mb-1">Bank Account Number</p>
                  <p className="text-xl font-bold text-gray-900">{settings.bankAccount}</p>
                </div>
              ) : null}
              <div className="bg-white rounded-lg p-3 border border-blue-200">
                <p className="text-xs text-gray-500 mb-1">Amount to transfer</p>
                <p className="text-2xl font-bold text-orange-600">RM {(pending.total || 0).toFixed(2)}</p>
              </div>
              <ol className="space-y-1 list-decimal list-inside leading-relaxed">
                <li>Open banking app → DuitNow / Fund Transfer → scan QR or enter account number above</li>
                <li>Transfer exactly <strong>RM {(pending.total || 0).toFixed(2)}</strong></li>
                <li>Note the <strong>transaction / reference number</strong>, then enter below</li>
              </ol>
              {settings?.paymentInstructions && (
                <p className="leading-relaxed text-xs border-t border-blue-200 pt-3">{settings.paymentInstructions}</p>
              )}
              <div className="space-y-1.5 pt-1">
                <Label className="text-sm font-semibold text-blue-900">Transaction Reference *</Label>
                <Input
                  placeholder="e.g. TT12345678 or your name in transfer"
                  value={transferReference}
                  onChange={(e) => setTransferReference(e.target.value)}
                  className="bg-white"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="pt-2">
          <Button
            onClick={handleConfirm}
            disabled={requiresReference && !transferReference.trim()}
            className="w-full brand-button h-14 text-lg"
          >
            {requiresReference ? "I've Made Payment — Submit Order" : 'Confirm & Submit Order'}
          </Button>
          <p className="text-xs text-center text-gray-500 mt-3">
            {requiresReference
              ? 'Your order will be confirmed once admin verifies your payment'
              : 'Orders require admin approval before processing'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Root component — decides which view to show ─────────────────────────────

export default function OrderConfirmationPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'loading' | 'stripe' | 'manual' | 'empty'>('loading');
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const confirmedRaw = sessionStorage.getItem('confirmedOrder');
    const pendingRaw = sessionStorage.getItem('pendingOrder');

    if (confirmedRaw) {
      setConfirmedOrder(JSON.parse(confirmedRaw));
      sessionStorage.removeItem('confirmedOrder');
      setMode('stripe');
    } else if (pendingRaw) {
      const order = JSON.parse(pendingRaw);
      setPendingOrder(order);
      getSettings().then(s => setSettings(s));
      setMode('manual');
    } else {
      setMode('empty');
    }
  }, []);

  if (mode === 'loading') return <LoadingSpinner />;

  if (mode === 'empty') {
    navigate('/customer/home');
    return null;
  }

  if (mode === 'stripe' && confirmedOrder) {
    return <StripeReceiptView confirmed={confirmedOrder} />;
  }

  if (mode === 'manual' && pendingOrder) {
    return <ManualConfirmView pending={pendingOrder} settings={settings} />;
  }

  return null;
}
