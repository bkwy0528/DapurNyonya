import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';

import { ArrowLeft, CheckCircle, Eye, Search, ChevronDown, ChevronUp, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../../App';
import { getOrders, updateOrderFields } from '../../utils/db';
import { getStatusStyle } from '../../utils/statusStyles';
import { onImageError } from '../../utils/imageFallback';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface OrderManagementPageProps {
  user: User;
}

export default function OrderManagementPage({ user: _user }: OrderManagementPageProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'deliverySoonest' | 'deliveryLatest'>('newest');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      const all = await getOrders();
      const reversed = [...all].sort((a, b) => new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime());
      setOrders(reversed);
    } finally {
      // Only the first load shows the page spinner — refreshes after a status
      // update keep the current list on screen.
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    let result = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(o =>
        (o.customerName || '').toLowerCase().includes(term)
        || (o.customerPhone || '').toLowerCase().includes(term)
        || (o.finalizedNumber || '').toLowerCase().includes(term)
        || (o.id || '').toLowerCase().includes(term)
      );
    }
    // "Soonest" puts the next collection/delivery at the top so the admin sees
    // what needs preparing first; orders without a date sink to the bottom.
    // deliveryDate is a YYYY-MM-DD string, so plain string comparison sorts it.
    if (sortBy === 'deliverySoonest' || sortBy === 'deliveryLatest') {
      result = [...result].sort((a, b) => {
        if (!a.deliveryDate) return 1;
        if (!b.deliveryDate) return -1;
        return sortBy === 'deliverySoonest'
          ? a.deliveryDate.localeCompare(b.deliveryDate)
          : b.deliveryDate.localeCompare(a.deliveryDate);
      });
    }
    return result; // 'newest' keeps loadOrders' placed-date ordering
  }, [orders, statusFilter, searchTerm, sortBy]);

  // Orders arrive already paid and numbered (submitOrder assigns the
  // finalized number server-side), so status moves only forward through the
  // fulfilment steps — there is no approve/reject step anymore.
  const updateStatus = async (orderId: string, newStatus: string) => {
    if (updatingOrderId) return;
    setUpdatingOrderId(orderId);
    try {
      await updateOrderFields(orderId, { status: newStatus });
      await loadOrders();
      toast.success('Order status updated!');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const saveAdminNotes = async (orderId: string) => {
    await updateOrderFields(orderId, { adminNotes });
    await loadOrders();
    toast.success('Notes saved!');
    setSelectedOrder(null);
    setAdminNotes('');
  };

  const getOrderLabel = (order: any) => order.finalizedNumber || `Order #${order.id.slice(-6)}`;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="page-hero">
        <div className="page-hero__inner page-hero__inner--wide">
          <Link to="/admin/dashboard" className="page-back-link">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl">Order Management</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              <div className="relative w-full lg:flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by customer name, phone, or order number"
                  className="pl-12 h-12 text-base"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-56 h-12 text-base">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="Order Received">Order Received</SelectItem>
                  <SelectItem value="In Preparation">In Preparation</SelectItem>
                  <SelectItem value="Ready for Pickup">Ready for Pickup</SelectItem>
                  <SelectItem value="Out for Delivery">Out for Delivery</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-full lg:w-64 h-12 text-base" aria-label="Sort orders">
                  <SelectValue placeholder="Sort orders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Sort: Recently placed</SelectItem>
                  <SelectItem value="deliverySoonest">Sort: Delivery date — soonest</SelectItem>
                  <SelectItem value="deliveryLatest">Sort: Delivery date — latest</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-base px-4 py-2 shrink-0">{filteredOrders.length} orders</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-4 pb-6">
        {filteredOrders.length === 0 ? (
          <Card><CardContent className="p-12 text-center"><p className="text-gray-600 text-lg">No orders found</p></CardContent></Card>
        ) : (
          filteredOrders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            return (
            <Card key={order.id} className="overflow-hidden">
              <CardHeader
                className="bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{getOrderLabel(order)}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{order.customerName} - {order.customerPhone}</p>
                    <p className="text-sm text-gray-600">
                      Order Date: {new Date(order.orderDate || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {order.deliveryDate && <> · {order.deliveryMethod === 'delivery' ? 'Delivery' : 'Pickup'}: {new Date(order.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-orange-600">RM {(order.total || 0).toFixed(2)}</span>
                    <Badge className={getStatusStyle(order.status)}>{order.status}</Badge>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                  </div>
                </div>
              </CardHeader>
              {isExpanded && (
              <CardContent className="p-6 space-y-4">
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900">Order Items:</h4>
                  {order.items && order.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-start space-x-4 detail-box">
                      {item.image && <img src={item.image} alt={item.name} onError={onImageError} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />}
                      <div className="flex-1">
                        <h5 className="font-semibold text-gray-900">{item.name}</h5>
                        <p className="text-sm text-gray-600 mt-1">Quantity: {item.quantity}</p>
                        <p className="text-sm text-gray-600">Unit Price: RM {item.price.toFixed(2)}</p>
                        <p className="font-semibold text-orange-600 mt-1">Subtotal: RM {(item.price * item.quantity).toFixed(2)}</p>
                        {item.notes && <p className="text-sm text-gray-600 mt-2 italic">Notes: {item.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="info-box space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Subtotal:</span>
                    <span className="font-semibold">RM {(order.subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Delivery Charge:</span>
                    {/* Legacy orders carry a computed charge; new delivery orders
                        settle the Grab fee separately over WhatsApp */}
                    <span className="font-semibold">
                      {(order.deliveryCharge || 0) > 0
                        ? `RM ${order.deliveryCharge.toFixed(2)}`
                        : order.deliveryMethod === 'delivery' ? 'Grab fee via WhatsApp' : 'FREE'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-blue-300">
                    <span className="text-lg font-bold text-gray-900">Total:</span>
                    <span className="text-xl font-bold text-orange-600">RM {(order.total || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="detail-box">
                    <p className="text-sm text-gray-600 mb-1">Delivery Method:</p>
                    <p className="font-semibold text-gray-900">{order.deliveryMethod === 'delivery' ? 'Delivery' : 'Pickup'}</p>
                  </div>
                  <div className="detail-box">
                    <p className="text-sm text-gray-600 mb-1">Delivery Date:</p>
                    <p className="font-semibold text-gray-900">
                      {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Not specified'}
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="detail-box">
                    <p className="text-sm text-gray-600 mb-1">Payment Method:</p>
                    <p className="font-semibold text-gray-900">
                      {({'cash':'Cash','tng':'DuitNow QR / E-Wallet (Online)','fpx':'FPX Online Banking','duitnow':'DuitNow QR','debit':'Bank Transfer','card':'Credit/Debit Card','ewallet':'eWallet'} as Record<string,string>)[order.paymentMethod] || order.paymentMethod || '—'}
                    </p>
                  </div>
                  {(order.transactionId || order.paymentIntentId) ? (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Transaction Reference:</p>
                      <p className="font-semibold font-mono text-orange-800">{order.transactionId || order.paymentIntentId}</p>
                    </div>
                  ) : (
                    <div className="detail-box">
                      <p className="text-sm text-gray-600 mb-1">Transaction Reference:</p>
                      <p className="text-gray-400 text-sm">{order.paymentMethod === 'cash' || order.paymentMethod === 'card' ? 'N/A' : 'Not provided'}</p>
                    </div>
                  )}
                </div>

                {order.paymentNote && (
                  <div className="detail-box">
                    <p className="text-sm text-gray-600 mb-1">Payment Note:</p>
                    <p className="text-gray-900">{order.paymentNote}</p>
                  </div>
                )}

                {order.deliveryMethod === 'delivery' && order.deliveryAddress && (
                  <div className="detail-box">
                    <p className="text-sm text-gray-600 mb-1">Delivery Address:</p>
                    <p className="text-gray-900">{order.deliveryAddress}</p>
                    {order.postalCode && <p className="text-gray-600 mt-1">Postal Code: {order.postalCode}</p>}
                  </div>
                )}

                {order.specialInstructions && (
                  <div className="warning-box">
                    <p className="text-sm text-gray-600 mb-1">Special Instructions:</p>
                    <p className="text-gray-900">{order.specialInstructions}</p>
                  </div>
                )}

                {!['Rejected', 'Delivered', 'Cancelled'].includes(order.status) && (
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3">Update Order Status:</h4>
                    <div className="flex flex-wrap gap-2">
                      {order.status === 'Order Received' && (
                        <Button onClick={() => updateStatus(order.id, 'In Preparation')} className="brand-button">Start Preparation</Button>
                      )}
                      {order.status === 'In Preparation' && (
                        <Button onClick={() => updateStatus(order.id, order.deliveryMethod === 'pickup' ? 'Ready for Pickup' : 'Out for Delivery')} className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700">
                          {order.deliveryMethod === 'pickup'
                            ? <><CheckCircle className="w-4 h-4 mr-2" />Mark as Ready</>
                            : <><Truck className="w-4 h-4 mr-2" />Send Out for Delivery</>}
                        </Button>
                      )}
                      {order.status === 'Ready for Pickup' && (
                        <Button onClick={() => updateStatus(order.id, 'Delivered')} className="success-button">
                          <CheckCircle className="w-4 h-4 mr-2" />Mark as Picked Up
                        </Button>
                      )}
                      {order.status === 'Out for Delivery' && (
                        <Button onClick={() => updateStatus(order.id, 'Delivered')} className="success-button">
                          <CheckCircle className="w-4 h-4 mr-2" />Mark as Delivered
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200">
                  <Button variant="outline" onClick={() => { setSelectedOrder(order); setAdminNotes(order.adminNotes || ''); }} className="w-full sm:w-auto">
                    <Eye className="w-4 h-4 mr-2" />{order.adminNotes ? 'View/Edit Notes' : 'Add Notes'}
                  </Button>
                </div>
                {order.adminNotes && (
                  <div className="detail-box border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Admin Notes:</p>
                    <p className="text-gray-900">{order.adminNotes}</p>
                  </div>
                )}
              </CardContent>
              )}
            </Card>
            );
          })
        )}
      </div>

      <Dialog open={selectedOrder !== null} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Notes for {selectedOrder ? getOrderLabel(selectedOrder) : 'Order'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Add internal notes about this order..." className="min-h-32" />
            <Button onClick={() => selectedOrder && saveAdminNotes(selectedOrder.id)} className="w-full brand-button">Save Notes</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
