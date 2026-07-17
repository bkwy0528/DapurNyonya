import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { ArrowLeft, Package, Clock, Truck, AlertCircle, Receipt, Home as HomeIcon, XCircle, Users, Smartphone, Building2, CheckCircle2 } from 'lucide-react';
import { User } from '../../App';
import { getOrdersByCustomer, getBatchOrdersByCustomer, getProductionBatches } from '../../utils/db';
import { getStatusStyle } from '../../utils/statusStyles';
import { onImageError } from '../../utils/imageFallback';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/button';
import { BatchOrder, ProductionBatch, getRemainingToMinimum } from '../../utils/batchOrders';
import PullToRefreshIndicator from '../../components/PullToRefreshIndicator';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

interface CustomerOrderTrackingPageProps {
  user: User;
}

// Progress steps differ by fulfilment method — a delivery order is never
// "Ready for Pickup", it goes out for delivery instead.
const getStatusSteps = (deliveryMethod: string) =>
  deliveryMethod === 'delivery'
    ? [
        { label: 'Order Received', icon: Package },
        { label: 'In Preparation', icon: Clock },
        { label: 'Out for Delivery', icon: Truck },
        { label: 'Delivered', icon: HomeIcon },
      ]
    : [
        { label: 'Order Received', icon: Package },
        { label: 'In Preparation', icon: Clock },
        { label: 'Ready for Pickup', icon: Truck },
      ];

const paymentOptions = [
  { value: 'tng' as const, Icon: Smartphone, label: 'DuitNow QR / E-Wallet' },
  { value: 'fpx' as const, Icon: Building2, label: 'FPX Online Banking' },
];

export default function CustomerOrderTrackingPage({ user }: CustomerOrderTrackingPageProps) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [preOrders, setPreOrders] = useState<BatchOrder[]>([]);
  const [batchesById, setBatchesById] = useState<Record<string, ProductionBatch>>({});
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'tng' | 'fpx' | ''>('');

  const loadOrders = () => {
    return getOrdersByCustomer(user.id)
      .then(userOrders => {
        setOrders([...userOrders].sort((a, b) => new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime()));
      })
      .finally(() => setLoading(false));
  };

  // Cards needing the customer's action come first; dead cards (expired/
  // cancelled) sink to the bottom and disappear a week after their production
  // date so the list doesn't accumulate clutter forever.
  const PRE_ORDER_SORT: Record<string, number> = { awaiting_payment: 0, waiting: 1, expired: 2, cancelled: 3 };
  const FINISHED_VISIBLE_DAYS = 7;

  const loadPreOrders = () => {
    return Promise.all([getBatchOrdersByCustomer(user.id), getProductionBatches()])
      .then(([customerBatchOrders, allBatches]) => {
        // Paid pre-orders already show up as a real order below — only the
        // still-in-flight states need a card here.
        const hideBefore = new Date();
        hideBefore.setDate(hideBefore.getDate() - FINISHED_VISIBLE_DAYS);
        const active = (customerBatchOrders as BatchOrder[])
          .filter(bo => bo.status !== 'paid')
          .filter(bo => {
            if (bo.status !== 'expired' && bo.status !== 'cancelled') return true;
            return new Date(`${bo.productionDate}T00:00:00`) >= hideBefore;
          })
          .sort((a, b) =>
            (PRE_ORDER_SORT[a.status] ?? 9) - (PRE_ORDER_SORT[b.status] ?? 9)
            || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setPreOrders(active);
        const map: Record<string, ProductionBatch> = {};
        (allBatches as ProductionBatch[]).forEach(b => { map[b.id] = b; });
        setBatchesById(map);
      })
      .catch(() => { /* pre-orders are a supplementary section — a failed read must not block the paid-order list */ });
  };

  useEffect(() => { loadOrders(); loadPreOrders(); }, [user.id]);

  const refresh = () => Promise.all([loadOrders(), loadPreOrders()]).then(() => {});
  const { pullDistance, refreshing } = usePullToRefresh(refresh);

  const openPayNow = (batchOrderId: string) => {
    setPayingId(payingId === batchOrderId ? null : batchOrderId);
    setPaymentMethod('');
  };

  const confirmPayNow = (preOrder: BatchOrder) => {
    if (!paymentMethod) return;
    sessionStorage.setItem('pendingOrder', JSON.stringify({
      kind: 'batchOrder',
      batchOrderId: preOrder.id,
      amount: preOrder.price * preOrder.quantity,
      total: preOrder.price * preOrder.quantity,
      customerName: preOrder.customerName,
      customerPhone: preOrder.customerPhone,
      paymentMethod,
      paymentNote: '',
    }));
    navigate('/customer/payment');
  };

  const getStatusProgress = (status: string, deliveryMethod: string) => {
    const isDelivery = deliveryMethod === 'delivery';
    switch (status) {
      case 'Pending Approval': return { step: -1, progress: 10 };
      case 'Order Received': return { step: 0, progress: isDelivery ? 25 : 33 };
      case 'In Preparation': return { step: 1, progress: isDelivery ? 50 : 66 };
      case 'Out for Delivery': return { step: 2, progress: 75 };
      case 'Ready for Pickup': return { step: 2, progress: 100 };
      case 'Delivered': return { step: isDelivery ? 3 : 2, progress: 100 };
      default: return { step: -1, progress: 0 };
    }
  };

  const getOrderLabel = (order: any) => order.finalizedNumber || `Order #${order.id.slice(-6)}`;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen pb-24">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="page-hero">
        <div className="page-hero__inner">
          <Link to="/customer/home" className="page-back-link">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back to Home</span>
          </Link>
          <h1 className="text-2xl">My Orders</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {preOrders.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Your Pre-Orders</h2>
            {preOrders.map((preOrder) => {
              const batch = batchesById[preOrder.batchId];
              const remaining = batch ? getRemainingToMinimum(batch) : 0;
              const progressPct = batch && batch.minQuantity > 0 ? Math.min(100, (batch.currentQuantity / batch.minQuantity) * 100) : 0;
              const isPaying = payingId === preOrder.id;
              return (
                <Card key={preOrder.id} className="overflow-hidden border-orange-200">
                  <CardHeader className="bg-orange-50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{preOrder.productName} × {preOrder.quantity}</CardTitle>
                      <Badge className={
                        preOrder.status === 'awaiting_payment' ? 'bg-green-100 text-green-800'
                          : preOrder.status === 'expired' ? 'bg-gray-200 text-gray-700'
                          : preOrder.status === 'cancelled' ? 'bg-gray-200 text-gray-700'
                          : 'bg-amber-100 text-amber-800'
                      }>
                        {preOrder.status === 'awaiting_payment' ? 'Payment Open'
                          : preOrder.status === 'waiting' ? 'Waiting for Minimum Quantity'
                          : preOrder.status === 'expired' ? 'Payment Window Expired'
                          : 'Cancelled — Minimum Not Reached'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Production date: {new Date(`${preOrder.productionDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    {batch && preOrder.status === 'waiting' && (
                      <div className="space-y-2">
                        <Progress value={progressPct} className="h-2" />
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>{batch.currentQuantity} / {batch.minQuantity} {preOrder.unit}{remaining > 0 ? ` · need ${remaining} more` : ''}</span>
                          <span className="flex items-center gap-1"><Users className="w-4 h-4" />{batch.orderCount} joined</span>
                        </div>
                      </div>
                    )}

                    {preOrder.status === 'awaiting_payment' && (
                      <div className="space-y-3">
                        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3">
                          Minimum quantity reached! Pay by{' '}
                          {preOrder.paymentDeadline ? new Date(preOrder.paymentDeadline).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'the deadline'}
                          {' '}to keep your spot — RM {(preOrder.price * preOrder.quantity).toFixed(2)}.
                        </p>
                        {!isPaying ? (
                          <Button onClick={() => openPayNow(preOrder.id)} className="w-full success-button h-12">Pay Now</Button>
                        ) : (
                          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                            <p className="font-semibold text-gray-900">Choose a payment method</p>
                            {paymentOptions.map(({ value, Icon, label }) => (
                              <div
                                key={value}
                                onClick={() => setPaymentMethod(value)}
                                className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all select-none ${paymentMethod === value ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-300'}`}
                              >
                                <Icon className="w-5 h-5 text-gray-600" />
                                <span className="flex-1 font-medium text-gray-800">{label}</span>
                                {paymentMethod === value && <CheckCircle2 className="w-5 h-5 text-orange-500" />}
                              </div>
                            ))}
                            <Button onClick={() => confirmPayNow(preOrder)} disabled={!paymentMethod} className="w-full brand-button h-12">
                              Continue to Payment
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {preOrder.status === 'expired' && (
                      <p className="text-sm text-gray-600">The payment window closed before you paid, so this pre-order was released. Feel free to pre-order again if a spot is still open.</p>
                    )}
                    {preOrder.status === 'cancelled' && (
                      <p className="text-sm text-gray-600">This production date didn't reach its minimum quantity, so it was cancelled. No payment was ever collected.</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No orders yet</h3>
              <p className="text-gray-600 mb-6">Start ordering delicious festive treats!</p>
              <Link to="/customer/home">
                <Button className="brand-button">Browse Products</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const { step, progress } = getStatusProgress(order.status, order.deliveryMethod);
              const statusSteps = getStatusSteps(order.deliveryMethod);
              return (
                <Card key={order.id} className="overflow-hidden">
                  <CardHeader className="bg-gray-50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{getOrderLabel(order)}</CardTitle>
                      <Badge className={getStatusStyle(order.status)}>{order.status}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Placed on {new Date(order.orderDate || order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-4">
                      {order.items && order.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-start space-x-4">
                          {item.image && <img src={item.image} alt={item.name} onError={onImageError} className="w-20 h-20 rounded-lg object-cover" />}
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{item.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">Quantity: {item.quantity}</p>
                            <p className="text-lg font-semibold text-orange-600 mt-2">RM {(item.price * item.quantity).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="detail-box border border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">Order Total:</span>
                        <span className="text-xl font-bold text-orange-600">RM {(order.total || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="info-box">
                      <p className="text-sm text-gray-700 mb-1">Delivery Method:</p>
                      <p className="font-semibold text-gray-900">{order.deliveryMethod === 'delivery' ? 'Delivery' : 'Pickup'}</p>
                      {order.deliveryMethod === 'delivery' && (
                        <>
                          <p className="text-sm text-gray-700 mt-2 mb-1">Delivery Address:</p>
                          <p className="text-gray-900">{order.deliveryAddress}</p>
                        </>
                      )}
                      {order.deliveryDate && (
                        <>
                          <p className="text-sm text-gray-700 mt-2 mb-1">Expected Date:</p>
                          <p className="font-semibold text-gray-900">
                            {new Date(order.deliveryDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Legacy display only — new orders are paid online and start
                        at Order Received, so this status can no longer occur. */}
                    {order.status === 'Pending Approval' && (
                      <div className="warning-box">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-1" />
                          <div>
                            <p className="font-semibold text-yellow-800 mb-1">Order Being Processed</p>
                            <p className="text-sm text-yellow-700">Your order is awaiting confirmation from the seller.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {order.status === 'Cancelled' && (
                      <div className="detail-box border border-gray-300">
                        <div className="flex items-start space-x-3">
                          <XCircle className="w-5 h-5 text-gray-500 flex-shrink-0 mt-1" />
                          <div>
                            <p className="font-semibold text-gray-700 mb-1">Order Cancelled</p>
                            <p className="text-sm text-gray-600">You cancelled this order before it was approved.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {order.status === 'Rejected' && (
                      <div className="alert-box">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
                          <div>
                            <p className="font-semibold text-red-800 mb-1">Order Rejected</p>
                            {order.rejectReason && <p className="text-sm text-red-700">{order.rejectReason}</p>}
                          </div>
                        </div>
                      </div>
                    )}

                    {!['Pending Approval', 'Rejected', 'Cancelled'].includes(order.status) && (
                      <div className="space-y-4">
                        <p className="font-semibold text-gray-900">Order Status</p>
                        <Progress value={progress} className="h-3" />
                        <div className="flex justify-between">
                          {statusSteps.map((statusStep, index) => {
                            const Icon = statusStep.icon;
                            const isActive = index <= step;
                            // "Current" only while genuinely in progress — the
                            // final step at 100% is done, not pulsing.
                            const isCurrent = index === step && progress < 100;
                            return (
                              <div key={index} className="flex flex-col items-center space-y-2">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-500 ${isActive ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white' : 'bg-gray-200 text-gray-400'} ${isCurrent ? 'status-step--current' : ''}`}>
                                  <Icon className="w-6 h-6" />
                                </div>
                                <p className={`text-xs text-center max-w-24 ${isActive ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                                  {statusStep.label}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {order.adminNotes && (
                      <div className="detail-box border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Message from seller:</p>
                        <p className="text-gray-900">{order.adminNotes}</p>
                      </div>
                    )}

                    {!['Pending Approval', 'Rejected', 'Cancelled'].includes(order.status) && (
                      <div className="pt-2 border-t border-gray-100">
                        <Link to={`/customer/receipt/${order.id}`}>
                          <Button variant="outline" className="w-full sm:w-auto gap-2">
                            <Receipt className="w-4 h-4" />
                            View Receipt
                          </Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
