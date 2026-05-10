import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { ArrowLeft, CheckCircle, Eye, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../../App';

interface OrderManagementPageProps {
  user: User;
}

export default function OrderManagementPage({ user }: OrderManagementPageProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [orderToReject, setOrderToReject] = useState<any>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter(order => order.status === statusFilter));
    }
  }, [statusFilter, orders]);

  const loadOrders = () => {
    const allOrders = JSON.parse(localStorage.getItem('orders') || '[]');
    setOrders(allOrders.reverse());
    setFilteredOrders(allOrders);
  };

  const updateOrderStatus = (orderId: string, newStatus: string) => {
    const allOrders = JSON.parse(localStorage.getItem('orders') || '[]');
    const updatedOrders = allOrders.map((order: any) =>
      order.id === orderId ? { ...order, status: newStatus } : order
    );
    localStorage.setItem('orders', JSON.stringify(updatedOrders));
    loadOrders();
    toast.success('Order status updated!');
  };

  const saveAdminNotes = (orderId: string) => {
    const allOrders = JSON.parse(localStorage.getItem('orders') || '[]');
    const updatedOrders = allOrders.map((order: any) =>
      order.id === orderId ? { ...order, adminNotes } : order
    );
    localStorage.setItem('orders', JSON.stringify(updatedOrders));
    loadOrders();
    toast.success('Notes saved!');
    setSelectedOrder(null);
    setAdminNotes('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending Approval':
        return 'bg-yellow-100 text-yellow-700';
      case 'Order Received':
        return 'bg-blue-100 text-blue-700';
      case 'In Preparation':
        return 'bg-orange-100 text-orange-700';
      case 'Ready for Pickup':
        return 'bg-green-100 text-green-700';
      case 'Delivered':
        return 'bg-gray-100 text-gray-700';
      case 'Rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const rejectOrder = (orderId: string) => {
    const allOrders = JSON.parse(localStorage.getItem('orders') || '[]');
    const updatedOrders = allOrders.map((order: any) =>
      order.id === orderId ? { ...order, status: 'Rejected', rejectReason } : order
    );
    localStorage.setItem('orders', JSON.stringify(updatedOrders));
    loadOrders();
    toast.success('Order rejected!');
    setRejectDialogOpen(false);
    setRejectReason('');
    setOrderToReject(null);
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
          <h1 className="text-2xl">Order Management</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <span className="text-gray-700 font-medium">Filter by Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-64 h-12 text-base">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                  <SelectItem value="Order Received">Order Received</SelectItem>
                  <SelectItem value="In Preparation">In Preparation</SelectItem>
                  <SelectItem value="Ready for Pickup">Ready for Pickup</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-base px-4 py-2">
                {filteredOrders.length} orders
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      <div className="max-w-6xl mx-auto px-6 space-y-4 pb-6">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-600 text-lg">No orders found</p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <CardHeader className="bg-gray-50">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">Order #{order.id.slice(-6)}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {order.customerName} • {order.customerPhone}
                    </p>
                    <p className="text-sm text-gray-600">
                      Order Date: {new Date(order.orderDate || Date.now()).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <Badge className={getStatusColor(order.status)}>
                    {order.status}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="p-6 space-y-4">
                {/* Order Items */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900">Order Items:</h4>
                  {order.items && order.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-start space-x-4 bg-gray-50 rounded-lg p-4">
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <h5 className="font-semibold text-gray-900">{item.name}</h5>
                        <p className="text-sm text-gray-600 mt-1">Quantity: {item.quantity}</p>
                        <p className="text-sm text-gray-600">Unit Price: RM {item.price.toFixed(2)}</p>
                        <p className="font-semibold text-orange-600 mt-1">
                          Subtotal: RM {(item.price * item.quantity).toFixed(2)}
                        </p>
                        {item.notes && (
                          <p className="text-sm text-gray-600 mt-2 italic">Notes: {item.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Subtotal:</span>
                    <span className="font-semibold">RM {order.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Delivery Charge:</span>
                    <span className="font-semibold">
                      {order.deliveryCharge === 0 ? 'FREE' : `RM ${order.deliveryCharge.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-blue-300">
                    <span className="text-lg font-bold text-gray-900">Total:</span>
                    <span className="text-xl font-bold text-orange-600">RM {order.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Delivery Information */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Delivery Method:</p>
                    <p className="font-semibold text-gray-900">{order.deliveryMethod === 'delivery' ? 'Delivery' : 'Pickup'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Delivery Date:</p>
                    <p className="font-semibold text-gray-900">
                      {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      }) : 'Not specified'}
                    </p>
                  </div>
                </div>

                {order.deliveryMethod === 'delivery' && order.deliveryAddress && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Delivery Address:</p>
                    <p className="text-gray-900">{order.deliveryAddress}</p>
                    {order.postalCode && (
                      <p className="text-gray-600 mt-1">Postal Code: {order.postalCode}</p>
                    )}
                  </div>
                )}

                {order.specialInstructions && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Special Instructions:</p>
                    <p className="text-gray-900">{order.specialInstructions}</p>
                  </div>
                )}

                {/* Status Update Section */}
                {order.status !== 'Rejected' && order.status !== 'Delivered' && (
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3">Update Order Status:</h4>
                    <div className="flex flex-wrap gap-2">
                      {order.status === 'Pending Approval' && (
                        <>
                          <Button
                            onClick={() => updateOrderStatus(order.id, 'Order Received')}
                            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Approve Order
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              setOrderToReject(order);
                              setRejectDialogOpen(true);
                            }}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Reject Order
                          </Button>
                        </>
                      )}
                      {order.status === 'Order Received' && (
                        <Button
                          onClick={() => updateOrderStatus(order.id, 'In Preparation')}
                          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                        >
                          Start Preparation
                        </Button>
                      )}
                      {order.status === 'In Preparation' && (
                        <Button
                          onClick={() => updateOrderStatus(order.id, order.deliveryMethod === 'pickup' ? 'Ready for Pickup' : 'Delivered')}
                          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark as {order.deliveryMethod === 'pickup' ? 'Ready' : 'Delivered'}
                        </Button>
                      )}
                      {order.status === 'Ready for Pickup' && (
                        <Button
                          onClick={() => updateOrderStatus(order.id, 'Delivered')}
                          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark as Picked Up
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Admin Notes Section */}
                <div className="pt-4 border-t border-gray-200">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedOrder(order);
                      setAdminNotes(order.adminNotes || '');
                    }}
                    className="w-full sm:w-auto"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {order.adminNotes ? 'View/Edit Notes' : 'Add Notes'}
                  </Button>
                </div>

                {order.adminNotes && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Admin Notes:</p>
                    <p className="text-gray-900">{order.adminNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Admin Notes Dialog */}
      <Dialog open={selectedOrder !== null} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Notes for Order #{selectedOrder?.id.slice(-6)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add internal notes about this order..."
              className="min-h-32"
            />
            <Button
              onClick={() => selectedOrder && saveAdminNotes(selectedOrder.id)}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
            >
              Save Notes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Order Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Order #{orderToReject?.id.slice(-6)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">Please provide a reason for rejecting this order:</p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Out of stock, Cannot meet delivery date..."
              className="min-h-32"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setRejectDialogOpen(false);
                  setRejectReason('');
                  setOrderToReject(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => orderToReject && rejectOrder(orderToReject.id)}
                disabled={!rejectReason.trim()}
                className="flex-1"
              >
                Reject Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}