import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { ArrowLeft, Package, Clock, Truck, AlertCircle, Receipt, Home as HomeIcon, XCircle } from 'lucide-react';
import { User } from '../../App';
import { getOrdersByCustomer } from '../../utils/db';
import { getStatusStyle } from '../../utils/statusStyles';
import { onImageError } from '../../utils/imageFallback';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/button';

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

export default function CustomerOrderTrackingPage({ user }: CustomerOrderTrackingPageProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = () => {
    getOrdersByCustomer(user.id)
      .then(userOrders => {
        setOrders([...userOrders].sort((a, b) => new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime()));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrders(); }, [user.id]);

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
      <div className="page-hero">
        <div className="page-hero__inner">
          <Link to="/customer/home" className="page-back-link">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back to Home</span>
          </Link>
          <h1 className="text-2xl">My Orders</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
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
                            return (
                              <div key={index} className="flex flex-col items-center space-y-2">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isActive ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
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
