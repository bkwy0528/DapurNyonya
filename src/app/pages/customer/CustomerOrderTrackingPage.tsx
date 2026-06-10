import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { ArrowLeft, Package, Clock, Truck, AlertCircle } from 'lucide-react';
import { User } from '../../App';
import { getOrdersByCustomer } from '../../utils/db';

interface CustomerOrderTrackingPageProps {
  user: User;
}

const statusSteps = [
  { label: 'Order Received', icon: Package, color: 'text-blue-600' },
  { label: 'In Preparation', icon: Clock, color: 'text-orange-600' },
  { label: 'Ready for Pickup', icon: Truck, color: 'text-green-600' },
];

export default function CustomerOrderTrackingPage({ user }: CustomerOrderTrackingPageProps) {
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    getOrdersByCustomer(user.id).then(userOrders => {
      setOrders([...userOrders].sort((a, b) => new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime()));
    });
  }, [user.id]);

  const getStatusProgress = (status: string) => {
    switch (status) {
      case 'Pending Approval': return { step: -1, progress: 10 };
      case 'Order Received': return { step: 0, progress: 33 };
      case 'In Preparation': return { step: 1, progress: 66 };
      case 'Ready for Pickup':
      case 'Delivered': return { step: 2, progress: 100 };
      case 'Rejected': return { step: -1, progress: 0 };
      default: return { step: 0, progress: 0 };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending Approval': return 'bg-yellow-100 text-yellow-700';
      case 'Order Received': return 'bg-blue-100 text-blue-700';
      case 'In Preparation': return 'bg-orange-100 text-orange-700';
      case 'Ready for Pickup':
      case 'Delivered': return 'bg-green-100 text-green-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getOrderLabel = (order: any) => order.finalizedNumber || `Order #${order.id.slice(-6)}`;

  return (
    <div className="min-h-screen pb-6">
      <div className="page-hero">
        <div className="page-hero__inner">
          <Link to="/customer/home" className="page-back-link">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back to Home</span>
          </Link>
          <h1 className="text-2xl">My Orders</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No orders yet</h3>
              <p className="text-gray-600 mb-6">Start ordering delicious festive treats!</p>
              <Link to="/customer/home">
                <button className="brand-button rounded-lg px-6 py-3 text-white">Browse Products</button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const { step, progress } = getStatusProgress(order.status);
              return (
                <Card key={order.id} className="overflow-hidden">
                  <CardHeader className="bg-gray-50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{getOrderLabel(order)}</CardTitle>
                      <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Placed on {new Date(order.orderDate || order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-4">
                      {order.items && order.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-start space-x-4">
                          {item.image && <img src={item.image} alt={item.name} className="w-20 h-20 rounded-lg object-cover" />}
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{item.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">Quantity: {item.quantity}</p>
                            <p className="text-lg font-semibold text-orange-600 mt-2">RM {(item.price * item.quantity).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">Order Total:</span>
                        <span className="text-xl font-bold text-orange-600">RM {(order.total || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
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

                    {order.status === 'Pending Approval' && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-1" />
                          <div>
                            <p className="font-semibold text-yellow-800 mb-1">Order Being Processed</p>
                            <p className="text-sm text-yellow-700">Your order is awaiting approval from the seller. You'll be notified once it's confirmed.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {order.status === 'Rejected' && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
                          <div>
                            <p className="font-semibold text-red-800 mb-1">Order Rejected</p>
                            {order.rejectReason && <p className="text-sm text-red-700">{order.rejectReason}</p>}
                          </div>
                        </div>
                      </div>
                    )}

                    {order.status !== 'Pending Approval' && order.status !== 'Rejected' && (
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
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Message from seller:</p>
                        <p className="text-gray-900">{order.adminNotes}</p>
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
