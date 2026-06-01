import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Calendar as CalendarIcon, ArrowLeft, Clock, ChefHat, Package, AlertCircle } from 'lucide-react';
import { User } from '../../App';
import { Calendar } from '../../components/ui/calendar';
import { safeGetJSON } from '../../utils/storage';

interface ProductionSchedulePageProps {
  user: User;
}

interface GroupedOrders {
  [date: string]: any[];
}

export default function ProductionSchedulePage({ user }: ProductionSchedulePageProps) {
  const [groupedOrders, setGroupedOrders] = useState<GroupedOrders>({});
  const [dailyLimits, setDailyLimits] = useState<Record<string, number>>({});
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [tempLimit, setTempLimit] = useState('');

  const toDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fromDateKey = (dateKey: string) => new Date(`${dateKey}T00:00:00`);

  const getOrderLabel = (order: any) => order.finalizedNumber || `Order #${order.id.slice(-6)}`;

  const getOrderCountForDate = (dateKey: string) => {
    const orders = safeGetJSON('orders', []);
    return orders.filter((order: any) => order.deliveryDate === dateKey && order.status !== 'Rejected').length;
  };

  const getDaysUntil = (dateKey: string) => {
    const deliveryDate = fromDateKey(dateKey);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deliveryDate.setHours(0, 0, 0, 0);
    const diffTime = deliveryDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getPriorityBadge = (daysUntil: number) => {
    if (daysUntil < 0) return { label: 'Overdue', className: 'bg-red-100 text-red-700' };
    if (daysUntil === 0) return { label: 'Today', className: 'bg-orange-100 text-orange-700' };
    if (daysUntil === 1) return { label: 'Tomorrow', className: 'bg-orange-100 text-orange-700' };
    if (daysUntil <= 3) return { label: 'Urgent', className: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Upcoming', className: 'bg-green-100 text-green-700' };
  };

  const getProductionStages = (daysUntil: number) => {
    const stages = [];
    if (daysUntil <= 3) stages.push({ icon: AlertCircle, label: 'Prepare Ingredients', color: 'text-red-600', bgColor: 'bg-red-50' });
    if (daysUntil <= 2) stages.push({ icon: ChefHat, label: 'Start Cooking', color: 'text-orange-600', bgColor: 'bg-orange-50' });
    if (daysUntil <= 1) stages.push({ icon: Package, label: 'Packaging Day', color: 'text-green-600', bgColor: 'bg-green-50' });
    return stages;
  };

  const loadData = () => {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const grouped: GroupedOrders = {};

    orders
      .filter((order: any) => order.status !== 'Rejected' && order.deliveryDate)
      .forEach((order: any) => {
        if (!grouped[order.deliveryDate]) grouped[order.deliveryDate] = [];
        grouped[order.deliveryDate].push(order);
      });

    setGroupedOrders(grouped);
    setDailyLimits(safeGetJSON('dailyLimits', {}));
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveLimit = (dateKey: string, limit: number) => {
    const updated = { ...dailyLimits, [dateKey]: limit };
    setDailyLimits(updated);
    localStorage.setItem('dailyLimits', JSON.stringify(updated));
  };

  const clearLimit = (dateKey: string) => {
    const updated = { ...dailyLimits };
    delete updated[dateKey];
    setDailyLimits(updated);
    localStorage.setItem('dailyLimits', JSON.stringify(updated));
  };

  const selectedDateKey = toDateKey(selectedDate);
  const selectedOrders = groupedOrders[selectedDateKey] || [];
  const selectedOrdersCount = getOrderCountForDate(selectedDateKey);
  const selectedLimit = dailyLimits[selectedDateKey] ?? 0;
  const selectedDaysUntil = getDaysUntil(selectedDateKey);
  const selectedPriority = getPriorityBadge(selectedDaysUntil);
  const selectedStages = getProductionStages(selectedDaysUntil);

  const hasOrdersDates = Object.keys(groupedOrders).map(fromDateKey);
  const fullCapacityDates = Object.keys(dailyLimits)
    .filter((dateKey) => {
      const limit = dailyLimits[dateKey] ?? 0;
      const count = getOrderCountForDate(dateKey);
      return limit > 0 && count >= limit;
    })
    .map(fromDateKey);

  return (
    <div className="min-h-screen pb-24">
      <div className="page-hero">
        <div className="page-hero__inner page-hero__inner--wide">
          <Link to="/admin/dashboard" className="page-back-link">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl flex items-center">
            <CalendarIcon className="w-7 h-7 mr-3" />
            Production Schedule
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <Card className="overflow-hidden border-0 shadow-lg bg-white/95">
          <CardHeader className="brand-subtle-header">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="text-2xl">Monthly Production Calendar</CardTitle>
                <p className="text-sm text-gray-600 mt-1">Review capacity, plan production, and see busy dates at a glance.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1"><span className="h-2 w-2 rounded-full bg-gray-300" />No orders</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-amber-800"><span className="h-2 w-2 rounded-full bg-amber-500" />Orders present</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-red-800"><span className="h-2 w-2 rounded-full bg-red-500" />At capacity</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr] p-6">
            <div className="rounded-xl border bg-white p-3 shadow-sm">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="w-full"
                modifiers={{ hasOrders: hasOrdersDates, fullCapacity: fullCapacityDates }}
                modifiersClassNames={{
                  hasOrders: 'bg-amber-100 text-amber-900 font-semibold',
                  fullCapacity: 'bg-red-100 text-red-900 font-semibold',
                }}
              />
            </div>

            <div className="space-y-4">
              <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        {selectedDaysUntil < 0 ? 'Past date' : selectedDaysUntil === 0 ? 'Today' : `${selectedDaysUntil} days from now`}
                      </p>
                    </div>
                    <Badge className={selectedPriority.className}>{selectedPriority.label}</Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-white p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Orders</p>
                      <p className="text-2xl font-bold text-gray-900">{selectedOrdersCount}</p>
                    </div>
                    <div className={`rounded-lg border p-3 ${selectedLimit > 0 && selectedOrdersCount >= selectedLimit ? 'border-red-200 bg-red-50' : 'bg-white'}`}>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Capacity</p>
                      <p className="text-2xl font-bold text-gray-900">{selectedLimit > 0 ? `${Math.max(0, selectedLimit - selectedOrdersCount)} left` : 'Unlimited'}</p>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Set daily capacity</p>
                        <p className="text-sm text-gray-500">Limit how many orders can be accepted on this date.</p>
                      </div>
                      <Badge variant="outline">{selectedDateKey}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Input value={tempLimit} onChange={(e) => setTempLimit(e.target.value.replace(/\D/g, ''))} placeholder="Max orders" className="h-11" />
                      <Button
                        onClick={() => {
                          const parsed = parseInt(tempLimit || '0', 10);
                          if (parsed > 0) saveLimit(selectedDateKey, parsed);
                          else clearLimit(selectedDateKey);
                          setTempLimit('');
                        }}
                        className="brand-button"
                      >
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => { clearLimit(selectedDateKey); setTempLimit(''); }}>Clear</Button>
                    </div>
                  </div>

                  {selectedStages.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {selectedStages.map((stage, index) => {
                        const Icon = stage.icon;
                        return (
                          <div key={index} className={`${stage.bgColor} border border-gray-200 rounded-lg p-4`}>
                            <div className="flex items-center space-x-3">
                              <Icon className={`w-5 h-5 ${stage.color}`} />
                              <p className={`font-semibold ${stage.color}`}>{stage.label}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="rounded-lg border bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900">Orders for selected date</h4>
                      <Badge className={selectedPriority.className}>{selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''}</Badge>
                    </div>

                    {selectedOrders.length === 0 ? (
                      <p className="text-sm text-gray-600">No orders scheduled for this date.</p>
                    ) : (
                      <div className="space-y-3 max-h-[34rem] overflow-y-auto pr-1">
                        {selectedOrders.map((order) => (
                          <div key={order.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div>
                                <p className="font-semibold text-gray-900">{getOrderLabel(order)}</p>
                                <p className="text-sm text-gray-600">{order.customerName}</p>
                              </div>
                              <Badge className={order.status === 'Pending Approval' ? 'bg-yellow-100 text-yellow-700' : order.status === 'Order Received' ? 'bg-blue-100 text-blue-700' : order.status === 'In Preparation' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}>
                                {order.status}
                              </Badge>
                            </div>

                            <div className="space-y-2">
                              {order.items && order.items.map((item: any, index: number) => (
                                <div key={index} className="flex items-center justify-between rounded bg-white p-2 text-sm">
                                  <span className="text-gray-700">{item.name} x {item.quantity}</span>
                                  <span className="font-semibold text-orange-600">RM {(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>

                            <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span>{order.deliveryMethod === 'delivery' ? 'Delivery' : 'Pickup'}</span>
                              </div>
                              <span className="font-semibold text-gray-900">Total: RM {order.total.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <h4 className="font-semibold text-gray-900">Why this layout</h4>
                  <p className="text-sm text-gray-600">A month view is a better operational default than a rolling 14-day strip because it reveals patterns, bottlenecks, and quiet periods at a glance.</p>
                  <p className="text-sm text-gray-600">Google Calendar sync is still a separate integration project and should be added with backend OAuth and a sync endpoint. For this build, a real calendar UI gives the safest and biggest UX win.</p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
