import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Calendar as CalendarIcon, ArrowLeft, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { User } from '../../App';
import { Calendar } from '../../components/ui/calendar';
import { getProducts, getProductionBatches, saveProductionBatch, getBatchOrdersForBatch, adminCancelBatchOrder } from '../../utils/db';
import { ProductionBatch, BatchOrder, getBatchStatusLabel } from '../../utils/batchOrders';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface ProductionCalendarPageProps {
  user: User;
}

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const fromDateKey = (dateKey: string) => new Date(`${dateKey}T00:00:00`);

const batchStatusBadgeClass = (batch: ProductionBatch) => {
  if (batch.batchStatus === 'confirmed') return 'bg-green-100 text-green-800';
  if (batch.batchStatus === 'cancelled') return 'bg-gray-200 text-gray-700';
  return 'bg-amber-100 text-amber-800';
};

export default function ProductionCalendarPage({ user: _user }: ProductionCalendarPageProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [drafts, setDrafts] = useState<Record<string, { min: string; max: string }>>({});
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [batchOrdersCache, setBatchOrdersCache] = useState<Record<string, BatchOrder[]>>({});
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [allProducts, allBatches] = await Promise.all([getProducts(), getProductionBatches()]);
      setProducts(allProducts.filter((p: any) => p.batchTracked));
      setBatches(allBatches as ProductionBatch[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const batchesById = useMemo(() => {
    const map: Record<string, ProductionBatch> = {};
    batches.forEach(b => { map[b.id] = b; });
    return map;
  }, [batches]);

  const selectedDateKey = toDateKey(selectedDate);

  // Calendar highlighting: any date with at least one batch (any status)
  // shows amber; a date with at least one confirmed batch shows green.
  const datesWithBatches = useMemo(() => {
    const keys = new Set(batches.map(b => b.productionDate));
    return Array.from(keys).map(fromDateKey);
  }, [batches]);
  const datesWithConfirmed = useMemo(() => {
    const keys = new Set(batches.filter(b => b.batchStatus === 'confirmed').map(b => b.productionDate));
    return Array.from(keys).map(fromDateKey);
  }, [batches]);

  const getDraft = (productId: string, batch: ProductionBatch | undefined) =>
    drafts[productId] || { min: batch ? String(batch.minQuantity) : '', max: batch && batch.maxQuantity > 0 ? String(batch.maxQuantity) : '' };

  const setDraft = (productId: string, field: 'min' | 'max', value: string) => {
    setDrafts(prev => ({ ...prev, [productId]: { ...getDraft(productId, batchesById[`${productId}_${selectedDateKey}`]), [field]: value.replace(/\D/g, '') } }));
  };

  const handleOpenOrSaveDate = async (product: any) => {
    const batchId = `${product.id}_${selectedDateKey}`;
    const existing = batchesById[batchId];
    const draft = getDraft(product.id, existing);
    const min = parseInt(draft.min || '0', 10);
    const max = parseInt(draft.max || '0', 10);
    if (!min || min < 1) {
      return;
    }
    setSaving(batchId);
    try {
      const updated: ProductionBatch = existing
        ? { ...existing, minQuantity: min, maxQuantity: max }
        : {
            id: batchId,
            productId: product.id,
            productName: product.name,
            productionDate: selectedDateKey,
            status: 'open',
            minQuantity: min,
            maxQuantity: max,
            currentQuantity: 0,
            orderCount: 0,
            batchStatus: 'collecting',
            confirmedAt: null,
            paymentDeadline: null,
          };
      await saveProductionBatch(updated);
      setBatches(prev => existing ? prev.map(b => b.id === batchId ? updated : b) : [...prev, updated]);
      setDrafts(prev => { const { [product.id]: _removed, ...rest } = prev; return rest; });
    } finally {
      setSaving(null);
    }
  };

  const toggleOpenClosed = async (batch: ProductionBatch) => {
    setSaving(batch.id);
    try {
      const updated: ProductionBatch = { ...batch, status: batch.status === 'open' ? 'closed' : 'open' };
      await saveProductionBatch(updated);
      setBatches(prev => prev.map(b => b.id === batch.id ? updated : b));
    } finally {
      setSaving(null);
    }
  };

  const handleCancelOrder = async (order: BatchOrder) => {
    if (!window.confirm(`Cancel ${order.customerName}'s pre-order of ${order.quantity} ${order.unit}? This frees up their reserved quantity for other customers.`)) {
      return;
    }
    setSaving(order.id);
    try {
      await adminCancelBatchOrder(order);
      setBatchOrdersCache(prev => ({
        ...prev,
        [order.batchId]: (prev[order.batchId] || []).map(o => o.id === order.id ? { ...o, status: 'cancelled' as const } : o),
      }));
      setBatches(prev => prev.map(b => b.id === order.batchId
        ? { ...b, currentQuantity: Math.max(0, b.currentQuantity - order.quantity), orderCount: Math.max(0, b.orderCount - 1) }
        : b));
    } finally {
      setSaving(null);
    }
  };

  const toggleExpanded = async (batchId: string) => {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null);
      return;
    }
    setExpandedBatchId(batchId);
    if (!batchOrdersCache[batchId]) {
      setOrdersLoading(true);
      try {
        const orders = await getBatchOrdersForBatch(batchId);
        setBatchOrdersCache(prev => ({ ...prev, [batchId]: orders as BatchOrder[] }));
      } finally {
        setOrdersLoading(false);
      }
    }
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
            Pre-Orders
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {products.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-600 text-lg">No batch-tracked products yet.</p>
              <p className="text-sm text-gray-500 mt-2">Turn on "Batch Production" for a product in Product Management to manage its production dates here.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden border-0 shadow-lg bg-white/95">
            <CardHeader className="brand-subtle-header">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="text-2xl">Production Calendar</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">Open production dates for batch products and track minimum-quantity progress.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                  <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1"><span className="h-2 w-2 rounded-full bg-gray-300" />No batches</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-amber-800"><span className="h-2 w-2 rounded-full bg-amber-500" />Waiting for minimum</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-green-800"><span className="h-2 w-2 rounded-full bg-green-500" />Confirmed</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] p-6">
              <div className="rounded-xl border bg-white p-3 shadow-sm">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="w-full"
                  modifiers={{ hasBatches: datesWithBatches, confirmed: datesWithConfirmed }}
                  modifiersClassNames={{
                    hasBatches: 'bg-amber-100 text-amber-900 font-semibold',
                    confirmed: 'bg-green-100 text-green-900 font-semibold',
                  }}
                />
              </div>

              <div className="space-y-4">
                <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl">
                      {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {products.map((product) => {
                      const batchId = `${product.id}_${selectedDateKey}`;
                      const batch = batchesById[batchId];
                      const draft = getDraft(product.id, batch);
                      const isExpanded = expandedBatchId === batchId;
                      const orders = batchOrdersCache[batchId] || [];
                      return (
                        <div key={product.id} className="rounded-lg border bg-white p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-gray-900">{product.name}</p>
                            {batch && <Badge className={batchStatusBadgeClass(batch)}>{getBatchStatusLabel(batch)}</Badge>}
                          </div>

                          {batch ? (
                            <>
                              <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-lg border bg-gray-50 p-3 text-center">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">Progress</p>
                                  <p className="text-lg font-bold text-gray-900">{batch.currentQuantity} / {batch.minQuantity}</p>
                                </div>
                                <div className="rounded-lg border bg-gray-50 p-3 text-center">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">Max</p>
                                  <p className="text-lg font-bold text-gray-900">{batch.maxQuantity > 0 ? batch.maxQuantity : 'Unlimited'}</p>
                                </div>
                                <div className="rounded-lg border bg-gray-50 p-3 text-center">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">Customers</p>
                                  <p className="text-lg font-bold text-gray-900 flex items-center justify-center gap-1"><Users className="w-4 h-4" />{batch.orderCount}</p>
                                </div>
                              </div>

                              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                <div className="flex-1 space-y-1">
                                  <p className="text-xs font-medium text-gray-600">Minimum quantity</p>
                                  <Input value={draft.min} onChange={(e) => setDraft(product.id, 'min', e.target.value)} placeholder="e.g. 20" className="h-10" />
                                </div>
                                <div className="flex-1 space-y-1">
                                  <p className="text-xs font-medium text-gray-600">Maximum (blank = no limit)</p>
                                  <Input value={draft.max} onChange={(e) => setDraft(product.id, 'max', e.target.value)} placeholder="No limit" className="h-10" />
                                </div>
                                <Button size="sm" onClick={() => handleOpenOrSaveDate(product)} disabled={saving === batchId} className="brand-button shrink-0 h-10">Save</Button>
                              </div>

                              <div className="flex items-center justify-between">
                                <Button size="sm" variant="outline" onClick={() => toggleOpenClosed(batch)} disabled={saving === batchId}>
                                  {batch.status === 'open' ? 'Close date' : 'Reopen date'}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => toggleExpanded(batchId)}>
                                  {batch.orderCount} order{batch.orderCount !== 1 ? 's' : ''}
                                  {isExpanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                                </Button>
                              </div>

                              {isExpanded && (
                                <div className="space-y-2 border-t pt-3">
                                  {ordersLoading && !batchOrdersCache[batchId] ? (
                                    <p className="text-sm text-gray-500">Loading…</p>
                                  ) : orders.length === 0 ? (
                                    <p className="text-sm text-gray-500">No pre-orders yet.</p>
                                  ) : (
                                    orders.map((o) => (
                                      <div key={o.id} className="flex items-center justify-between gap-2 rounded bg-gray-50 p-2 text-sm">
                                        <span className="text-gray-700">{o.customerName} — {o.quantity} {o.unit}</span>
                                        <span className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-xs capitalize">{o.status.replace('_', ' ')}</Badge>
                                          {(o.status === 'waiting' || o.status === 'awaiting_payment') && (
                                            <Button size="sm" variant="ghost" onClick={() => handleCancelOrder(o)} disabled={saving === o.id} className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                                              Cancel
                                            </Button>
                                          )}
                                        </span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                              <div className="flex-1 space-y-1">
                                <p className="text-xs font-medium text-gray-600">Minimum quantity</p>
                                <Input value={draft.min} onChange={(e) => setDraft(product.id, 'min', e.target.value)} placeholder="e.g. 20" className="h-10" />
                              </div>
                              <div className="flex-1 space-y-1">
                                <p className="text-xs font-medium text-gray-600">Maximum (blank = no limit)</p>
                                <Input value={draft.max} onChange={(e) => setDraft(product.id, 'max', e.target.value)} placeholder="No limit" className="h-10" />
                              </div>
                              <Button size="sm" onClick={() => handleOpenOrSaveDate(product)} disabled={saving === batchId} className="brand-button shrink-0 h-10">
                                Open this date
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
