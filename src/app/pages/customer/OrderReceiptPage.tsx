import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ArrowLeft, Printer, CheckCircle2, UtensilsCrossed } from 'lucide-react';
import { Button } from '../../components/ui/button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { getOrderById, getSettings } from '../../utils/db';
import { getStatusStyle } from '../../utils/statusStyles';
import { User } from '../../App';

interface OrderReceiptPageProps {
  user: User;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash on Pickup / Delivery',
  tng: "Touch 'n Go eWallet",
  debit: 'Bank Transfer / DuitNow',
  card: 'Credit / Debit Card (Online)',
};

function paymentStatus(order: any): { label: string; colour: string } {
  if (order.paymentMethod === 'card') return { label: 'Paid Online', colour: 'text-green-700 bg-green-100' };
  if (order.paymentMethod === 'cash') return { label: 'Cash — Pay on Arrival', colour: 'text-yellow-800 bg-yellow-100' };
  const verified = ['Order Received', 'In Preparation', 'Ready for Pickup', 'Delivered'].includes(order.status);
  return verified
    ? { label: 'Payment Verified', colour: 'text-green-700 bg-green-100' }
    : { label: 'Pending Verification', colour: 'text-orange-700 bg-orange-100' };
}

export default function OrderReceiptPage({ user }: OrderReceiptPageProps) {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!orderId) { setNotFound(true); setLoading(false); return; }
    Promise.all([getOrderById(orderId), getSettings()]).then(([ord, s]) => {
      if (!ord || ord.customerId !== user.id) { setNotFound(true); }
      else { setOrder(ord); setSettings(s); }
      setLoading(false);
    });
  }, [orderId, user.id]);

  if (loading) return <LoadingSpinner />;

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4">
      <p className="text-gray-600">Receipt not found.</p>
      <Link to="/customer/tracking"><Button variant="outline">Back to Orders</Button></Link>
    </div>
  );

  const businessName = settings?.businessName || 'DapurNyonya';
  const receiptNo = order.finalizedNumber || `DN-${order.id.slice(-8).toUpperCase()}`;
  const orderDate = new Date(order.orderDate || Date.now());
  const deliveryDate = order.deliveryDate ? new Date(`${order.deliveryDate}T00:00:00`) : null;
  const pStatus = paymentStatus(order);

  return (
    <>
      {/* Print-only page sizing */}
      <style>{`@media print { @page { size: A4; margin: 12mm; } }`}</style>

      {/* Action bar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b shadow-sm px-4 py-3 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate('/customer/tracking')}>
          <ArrowLeft className="w-4 h-4 mr-1" />Back to Orders
        </Button>
        <span className="flex-1" />
        <Button size="sm" className="brand-button" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" />Print / Save PDF
        </Button>
      </div>

      <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
        <div className="max-w-xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden print:shadow-none print:rounded-none">

          {/* ── Brand header ────────────────────────────────────────────── */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <UtensilsCrossed className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white leading-tight">{businessName}</h1>
                  {settings?.businessDescription && (
                    <p className="text-orange-100 text-sm">{settings.businessDescription}</p>
                  )}
                </div>
              </div>
              <div className="text-right text-orange-100 text-xs space-y-1 shrink-0">
                {settings?.contactPhone && <p>{settings.contactPhone}</p>}
                {settings?.contactEmail && <p>{settings.contactEmail}</p>}
              </div>
            </div>
          </div>

          {/* ── Receipt number + date ────────────────────────────────────── */}
          <div className="px-8 py-5 border-b-2 border-dashed border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Order Receipt</p>
                <p className="text-3xl font-bold text-gray-900 mt-1 tracking-tight">{receiptNo}</p>
              </div>
              <span className={`mt-1 text-xs font-semibold px-3 py-1.5 rounded-full ${getStatusStyle(order.status)}`}>
                {order.status}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Date Ordered</p>
                <p className="font-medium text-gray-900 mt-0.5">
                  {orderDate.toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-gray-500">
                  {orderDate.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {deliveryDate && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    {order.deliveryMethod === 'delivery' ? 'Delivery Date' : 'Pickup Date'}
                  </p>
                  <p className="font-medium text-gray-900 mt-0.5">
                    {deliveryDate.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Billed to ────────────────────────────────────────────────── */}
          <div className="px-8 py-4 bg-gray-50 border-b-2 border-dashed border-gray-200">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">Billed To</p>
            <p className="font-semibold text-gray-900 text-base">{order.customerName}</p>
            <p className="text-sm text-gray-600">{order.customerPhone}</p>
            {order.deliveryMethod === 'delivery' && order.deliveryAddress && order.deliveryAddress !== 'Pickup' && (
              <p className="text-sm text-gray-600 mt-1">{order.deliveryAddress}{order.postalCode ? `, ${order.postalCode}` : ''}</p>
            )}
          </div>

          {/* ── Items table ──────────────────────────────────────────────── */}
          <div className="px-8 pt-5 pb-3">
            {/* Table header */}
            <div className="flex items-center pb-2 border-b-2 border-gray-900 text-xs text-gray-500 uppercase tracking-wider font-semibold">
              <span className="flex-1">Description</span>
              <span className="w-10 text-center">Qty</span>
              <span className="w-24 text-right">Unit Price</span>
              <span className="w-24 text-right">Amount</span>
            </div>
            {/* Rows */}
            <div className="divide-y divide-gray-100">
              {(order.items || []).map((item: any, i: number) => (
                <div key={i} className="flex items-center py-3 text-sm">
                  <div className="flex-1 pr-3">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.unit && <p className="text-xs text-gray-400 mt-0.5">{item.unit}</p>}
                  </div>
                  <span className="w-10 text-center text-gray-600">{item.quantity}</span>
                  <span className="w-24 text-right text-gray-600">RM {(item.price || 0).toFixed(2)}</span>
                  <span className="w-24 text-right font-semibold text-gray-900">
                    RM {((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Totals ───────────────────────────────────────────────────── */}
          <div className="px-8 pb-5 border-b-2 border-dashed border-gray-200">
            <div className="ml-auto w-64 space-y-2 text-sm border-t-2 border-dashed border-gray-200 pt-3">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>RM {(order.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery Charge</span>
                <span>{order.deliveryCharge === 0 ? 'FREE' : `RM ${(order.deliveryCharge || 0).toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t-4 border-double border-gray-900">
                <span className="text-base font-bold text-gray-900 uppercase tracking-wide">Total</span>
                <span className="text-2xl font-bold text-orange-600">RM {(order.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* ── Payment details ──────────────────────────────────────────── */}
          <div className="px-8 py-4 border-b-2 border-dashed border-gray-200">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-3">Payment Details</p>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-start">
                <span className="text-gray-500">Method</span>
                <span className="font-medium text-gray-900 text-right">
                  {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}
                </span>
              </div>
              {order.transferReference && (
                <div className="flex justify-between items-start">
                  <span className="text-gray-500">Transaction Ref</span>
                  <span className="font-mono font-semibold text-gray-900">{order.transferReference}</span>
                </div>
              )}
              {order.paymentIntentId && (
                <div className="flex justify-between items-start">
                  <span className="text-gray-500">Stripe Payment ID</span>
                  <span className="font-mono text-xs text-gray-700">…{order.paymentIntentId.slice(-12)}</span>
                </div>
              )}
              {order.paidAt && (
                <div className="flex justify-between items-start">
                  <span className="text-gray-500">Paid At</span>
                  <span className="text-gray-900">
                    {new Date(order.paidAt).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1">
                <span className="text-gray-500">Payment Status</span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${pStatus.colour}`}>
                  {pStatus.label}
                </span>
              </div>
            </div>
          </div>

          {/* ── Fulfilment ───────────────────────────────────────────────── */}
          <div className="px-8 py-4 border-b-2 border-dashed border-gray-200">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-3">Fulfilment</p>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Method</span>
                <span className="font-medium text-gray-900">
                  {order.deliveryMethod === 'delivery' ? 'Home Delivery' : 'Self Pickup'}
                </span>
              </div>
              {deliveryDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{order.deliveryMethod === 'delivery' ? 'Delivery Date' : 'Pickup Date'}</span>
                  <span className="font-medium text-gray-900">
                    {deliveryDate.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}
              {order.specialInstructions && (
                <div className="flex justify-between items-start gap-4">
                  <span className="text-gray-500 shrink-0">Notes</span>
                  <span className="text-gray-700 text-right">{order.specialInstructions}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <div className="px-8 py-7 text-center">
            <CheckCircle2 className="w-10 h-10 text-orange-400 mx-auto mb-3" />
            <p className="text-lg font-bold text-gray-800">Thank you for your order!</p>
            <p className="text-sm text-gray-500 mt-1">
              We look forward to preparing your items. You will be notified once your order is confirmed.
            </p>
            <div className="mt-6 pt-4 border-t border-gray-100 space-y-1">
              <p className="text-xs text-gray-400">
                This is a computer-generated receipt and does not require a signature.
              </p>
              <p className="text-xs text-gray-400">
                {receiptNo} · Issued by {businessName}
              </p>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
