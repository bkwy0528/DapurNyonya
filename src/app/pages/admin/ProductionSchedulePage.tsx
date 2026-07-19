import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Calendar as CalendarIcon, ArrowLeft, Clock, ChefHat, Package, AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { User } from '../../App';
import { getStatusStyle } from '../../utils/statusStyles';
import { Calendar } from '../../components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import { getOrders, getSettings, saveSettings } from '../../utils/db';
import { OrderWindow, normalizeOpenOrderRanges, toLocalYMD } from '../../utils/business';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface ProductionSchedulePageProps {
  user: User;
}

interface GroupedOrders {
  [date: string]: any[];
}

export default function ProductionSchedulePage({ user: _user }: ProductionSchedulePageProps) {
  const [groupedOrders, setGroupedOrders] = useState<GroupedOrders>({});
  const [loading, setLoading] = useState(true);
  const [openOrderRanges, setOpenOrderRanges] = useState<OrderWindow[]>([]);
  const [rangeDraft, setRangeDraft] = useState<DateRange | undefined>(undefined);
  const [savingRange, setSavingRange] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const toDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fromDateKey = (dateKey: string) => new Date(`${dateKey}T00:00:00`);
  const getOrderLabel = (order: any) => order.finalizedNumber || `Order #${order.id.slice(-6)}`;
  const formatRangeDate = (ymd: string) =>
    fromDateKey(ymd).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

  const getDaysUntil = (dateKey: string) => {
    const deliveryDate = fromDateKey(dateKey);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deliveryDate.setHours(0, 0, 0, 0);
    return Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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

  const loadData = async () => {
    try {
      await loadDataInner();
    } finally {
      setLoading(false);
    }
  };

  const loadDataInner = async () => {
    const [orders, settings] = await Promise.all([getOrders(), getSettings()]);
    const grouped: GroupedOrders = {};
    orders
      .filter((order: any) => order.status !== 'Rejected' && order.status !== 'Cancelled' && order.deliveryDate)
      .forEach((order: any) => {
        if (!grouped[order.deliveryDate]) grouped[order.deliveryDate] = [];
        grouped[order.deliveryDate].push(order);
      });
    setGroupedOrders(grouped);
    setOpenOrderRanges(normalizeOpenOrderRanges(settings?.openOrderRanges));
  };

  useEffect(() => { loadData(); }, []);

  const handleAddRange = async () => {
    if (!rangeDraft?.from || !rangeDraft?.to) return;
    const updated = [...openOrderRanges, { start: toLocalYMD(rangeDraft.from), end: toLocalYMD(rangeDraft.to) }]
      .sort((a, b) => a.start.localeCompare(b.start));
    setSavingRange(true);
    try {
      await saveSettings({ openOrderRanges: updated });
      setOpenOrderRanges(updated);
      // Keep the range selected (rather than clearing it) so the orders
      // panel below immediately shows what falls inside the window just opened.
    } finally {
      setSavingRange(false);
    }
  };

  const handleRemoveRange = async (index: number) => {
    const updated = openOrderRanges.filter((_, i) => i !== index);
    setSavingRange(true);
    try {
      await saveSettings({ openOrderRanges: updated });
      setOpenOrderRanges(updated);
    } finally {
      setSavingRange(false);
    }
  };

  const hasOrdersDates = useMemo(() => Object.keys(groupedOrders).map(fromDateKey), [groupedOrders]);

  // Orders whose delivery date falls inside the currently selected range,
  // grouped by day and sorted chronologically — each day renders as its own
  // dropdown below so a busy range doesn't dump every order into one list.
  const ordersByDayInRange = useMemo(() => {
    if (!rangeDraft?.from || !rangeDraft?.to) return [] as { dateKey: string; orders: any[] }[];
    const startKey = toLocalYMD(rangeDraft.from);
    const endKey = toLocalYMD(rangeDraft.to);
    return Object.keys(groupedOrders)
      .filter((dateKey) => dateKey >= startKey && dateKey <= endKey)
      .sort()
      .map((dateKey) => ({ dateKey, orders: groupedOrders[dateKey] }));
  }, [groupedOrders, rangeDraft]);

  const toggleExpandedDay = (dateKey: string) => {
    setExpandedDay((prev) => (prev === dateKey ? null : dateKey));
  };

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
          <h1 className="text-2xl flex items-center">
            <CalendarIcon className="w-7 h-7 mr-3" />
            Production Schedule
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Card className="overflow-hidden border-0 shadow-lg bg-white/95">
          <CardHeader className="brand-subtle-header">
            <CardTitle className="text-2xl">General Order Availability</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Choose which dates customers can pick at checkout for regular (non-batch) products, e.g. a festive
              season window. Batch-tracked products are unaffected — they use the Production Calendar tab on the
              Pre-Orders page instead. Selecting a range below also shows the orders placed within it further down
              this page.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {openOrderRanges.length === 0 && (
              <div className="alert-box">
                <p className="text-sm text-red-800">
                  No dates are open yet — customers cannot check out with regular products until you add available dates below.
                </p>
              </div>
            )}
            {openOrderRanges.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {openOrderRanges.map((range, index) => (
                  <div key={`${range.start}_${range.end}`} className="flex items-center justify-between gap-3 rounded-lg border bg-white p-3">
                    <button
                      type="button"
                      onClick={() => setRangeDraft({ from: fromDateKey(range.start), to: fromDateKey(range.end) })}
                      className="flex-1 text-left text-sm font-medium text-gray-900 hover:text-orange-600"
                    >
                      {formatRangeDate(range.start)} – {formatRangeDate(range.end)}
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => handleRemoveRange(index)} disabled={savingRange} className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-900">Add available dates</p>
              <div className="flex justify-center rounded-lg border border-gray-200 bg-white">
                <Calendar
                  mode="range"
                  selected={rangeDraft}
                  onSelect={setRangeDraft}
                  modifiers={{ hasOrders: hasOrdersDates }}
                  modifiersClassNames={{ hasOrders: 'bg-amber-100 text-amber-900 font-semibold' }}
                />
              </div>
              <Button size="sm" onClick={handleAddRange} disabled={savingRange || !rangeDraft?.from || !rangeDraft?.to} className="brand-button">
                Add available dates
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-lg bg-white/95">
          <CardHeader className="brand-subtle-header">
            <CardTitle className="text-2xl">Orders</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Select a date range on the calendar above (or click a saved window) to see the orders placed for those dates, one dropdown per day.
            </p>
          </CardHeader>
          <CardContent className="p-6">
            {!rangeDraft?.from || !rangeDraft?.to ? (
              <p className="text-sm text-gray-600">No date range selected yet.</p>
            ) : ordersByDayInRange.length === 0 ? (
              <p className="text-sm text-gray-600">No orders scheduled between {formatRangeDate(toLocalYMD(rangeDraft.from))} and {formatRangeDate(toLocalYMD(rangeDraft.to))}.</p>
            ) : (
              <div className="space-y-3">
                {ordersByDayInRange.map(({ dateKey, orders }) => {
                  const daysUntil = getDaysUntil(dateKey);
                  const priority = getPriorityBadge(daysUntil);
                  const stages = getProductionStages(daysUntil);
                  const isExpanded = expandedDay === dateKey;
                  return (
                    <div key={dateKey} className="rounded-lg border bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleExpandedDay(dateKey)}
                        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-semibold text-gray-900">
                            {fromDateKey(dateKey).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                          <p className="text-sm text-gray-500">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={priority.className}>{priority.label}</Badge>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="space-y-3 border-t bg-gray-50/50 p-4">
                          {stages.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {stages.map((stage, index) => {
                                const Icon = stage.icon;
                                return (
                                  <div key={index} className={`${stage.bgColor} border border-gray-200 rounded-lg p-3`}>
                                    <div className="flex items-center space-x-3">
                                      <Icon className={`w-5 h-5 ${stage.color}`} />
                                      <p className={`font-semibold text-sm ${stage.color}`}>{stage.label}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {orders.map((order) => (
                            <div key={order.id} className="rounded-lg border border-gray-200 bg-white p-3">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div>
                                  <p className="font-semibold text-gray-900">{getOrderLabel(order)}</p>
                                  <p className="text-sm text-gray-600">{order.customerName}</p>
                                </div>
                                <Badge className={getStatusStyle(order.status)}>
                                  {order.status}
                                </Badge>
                              </div>
                              <div className="space-y-2">
                                {order.items && order.items.map((item: any, index: number) => (
                                  <div key={index} className="flex items-center justify-between rounded bg-gray-50 p-2 text-sm">
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
                                <span className="font-semibold text-gray-900">Total: RM {(order.total || 0).toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
