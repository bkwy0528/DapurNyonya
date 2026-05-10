import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Calendar, ArrowLeft, Clock, ChefHat, Package, AlertCircle } from 'lucide-react';
import { User } from '../../App';

interface ProductionSchedulePageProps {
  user: User;
}

interface GroupedOrders {
  [date: string]: any[];
}

export default function ProductionSchedulePage({ user }: ProductionSchedulePageProps) {
  const [groupedOrders, setGroupedOrders] = useState<GroupedOrders>({});

  useEffect(() => {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    
    // Group orders by delivery date, excluding rejected orders
    const grouped: GroupedOrders = {};
    orders
      .filter((order: any) => order.status !== 'Rejected' && order.deliveryDate)
      .forEach((order: any) => {
        const date = order.deliveryDate;
        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push(order);
      });

    setGroupedOrders(grouped);
  }, []);

  const getDaysUntil = (dateString: string) => {
    const deliveryDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deliveryDate.setHours(0, 0, 0, 0);
    const diffTime = deliveryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPriorityColor = (daysUntil: number) => {
    if (daysUntil < 0) return 'border-red-500 bg-red-50';
    if (daysUntil <= 2) return 'border-orange-500 bg-orange-50';
    if (daysUntil <= 5) return 'border-yellow-500 bg-yellow-50';
    return 'border-green-500 bg-green-50';
  };

  const getPriorityBadge = (daysUntil: number) => {
    if (daysUntil < 0) return { label: 'Overdue', className: 'bg-red-100 text-red-700' };
    if (daysUntil === 0) return { label: 'Today', className: 'bg-orange-100 text-orange-700' };
    if (daysUntil === 1) return { label: 'Tomorrow', className: 'bg-orange-100 text-orange-700' };
    if (daysUntil <= 3) return { label: 'Urgent', className: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Upcoming', className: 'bg-green-100 text-green-700' };
  };

  const sortedDates = Object.keys(groupedOrders).sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  );

  const getProductionStages = (daysUntil: number) => {
    const stages = [];
    if (daysUntil <= 3) {
      stages.push({ icon: AlertCircle, label: 'Prepare Ingredients', color: 'text-red-600', bgColor: 'bg-red-50' });
    }
    if (daysUntil <= 2) {
      stages.push({ icon: ChefHat, label: 'Start Cooking', color: 'text-orange-600', bgColor: 'bg-orange-50' });
    }
    if (daysUntil <= 1) {
      stages.push({ icon: Package, label: 'Packaging Day', color: 'text-green-600', bgColor: 'bg-green-50' });
    }
    return stages;
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <Link to="/admin/dashboard" className="inline-flex items-center text-white hover:text-gray-100 mb-4">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl flex items-center">
            <Calendar className="w-7 h-7 mr-3" />
            Production Schedule
          </h1>
        </div>
      </div>

      {/* Timeline */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {sortedDates.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No orders scheduled</h3>
              <p className="text-gray-600">Orders will appear here once customers place orders</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((date) => {
              const ordersForDate = groupedOrders[date];
              const daysUntil = getDaysUntil(date);
              const priorityBadge = getPriorityBadge(daysUntil);
              const stages = getProductionStages(daysUntil);

              return (
                <Card key={date} className={`border-l-4 ${getPriorityColor(daysUntil)}`}>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-2xl">
                          {new Date(date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days from now`}
                        </p>
                      </div>
                      <Badge className={priorityBadge.className}>
                        {priorityBadge.label}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Production Stages */}
                    {stages.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {stages.map((stage, idx) => {
                          const Icon = stage.icon;
                          return (
                            <div key={idx} className={`${stage.bgColor} border border-gray-200 rounded-lg p-4`}>
                              <div className="flex items-center space-x-3">
                                <Icon className={`w-6 h-6 ${stage.color}`} />
                                <p className={`font-semibold ${stage.color}`}>{stage.label}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Orders for this date */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">
                        {ordersForDate.length} Order{ordersForDate.length !== 1 ? 's' : ''} to Prepare
                      </h4>
                      
                      {ordersForDate.map((order) => (
                        <div key={order.id} className="bg-white border-2 border-gray-200 rounded-lg p-4">
                          <div className="flex flex-col sm:flex-row items-start justify-between gap-3 mb-3">
                            <div>
                              <p className="font-semibold text-gray-900">Order #{order.id.slice(-6)}</p>
                              <p className="text-sm text-gray-600">{order.customerName}</p>
                            </div>
                            <Badge className={
                              order.status === 'Pending Approval' ? 'bg-yellow-100 text-yellow-700' :
                              order.status === 'Order Received' ? 'bg-blue-100 text-blue-700' :
                              order.status === 'In Preparation' ? 'bg-orange-100 text-orange-700' :
                              'bg-green-100 text-green-700'
                            }>
                              {order.status}
                            </Badge>
                          </div>

                          {/* Order Items */}
                          <div className="space-y-2">
                            {order.items && order.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between bg-gray-50 rounded p-3">
                                <div className="flex items-center space-x-3">
                                  {item.image && (
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      className="w-12 h-12 rounded object-cover"
                                    />
                                  )}
                                  <div>
                                    <p className="font-semibold text-gray-900">{item.name}</p>
                                    <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                                  </div>
                                </div>
                                <p className="font-semibold text-orange-600">
                                  RM {(item.price * item.quantity).toFixed(2)}
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <Clock className="w-4 h-4" />
                              <span>{order.deliveryMethod === 'delivery' ? 'Delivery' : 'Pickup'}</span>
                            </div>
                            <p className="text-lg font-bold text-gray-900">
                              Total: RM {order.total.toFixed(2)}
                            </p>
                          </div>

                          {order.specialInstructions && (
                            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
                              <p className="text-xs text-yellow-800 font-semibold mb-1">Special Instructions:</p>
                              <p className="text-sm text-yellow-900">{order.specialInstructions}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Summary */}
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Total Orders</p>
                          <p className="text-2xl font-bold text-gray-900">{ordersForDate.length}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Revenue</p>
                          <p className="text-2xl font-bold text-orange-600">
                            RM {ordersForDate.reduce((sum, order) => sum + (order.total || 0), 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
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