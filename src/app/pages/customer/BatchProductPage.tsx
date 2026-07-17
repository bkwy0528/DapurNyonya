import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Progress } from '../../components/ui/progress';
import { ArrowLeft, Minus, Plus, Users, MapPin, Truck, Home as HomeIcon } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../../App';
import PageContainer from '../../components/ui/PageContainer';
import FormSection from '../../components/ui/FormSection';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { getProducts, getProductionBatchesForProduct } from '../../utils/db';
import { createBatchPreOrder } from '../../utils/submitOrder';
import { onImageError } from '../../utils/imageFallback';
import { vibrate } from '../../utils/haptics';
import { ProductionBatch, getBatchStatusLabel, getRemainingToMinimum, getRemainingCapacity } from '../../utils/batchOrders';

interface BatchProductPageProps {
  user: User | null;
}

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const batchBadgeClass = (batch: ProductionBatch) => {
  if (batch.batchStatus === 'confirmed') return 'bg-green-100 text-green-800';
  return 'bg-amber-100 text-amber-800';
};

export default function BatchProductPage({ user }: BatchProductPageProps) {
  const navigate = useNavigate();
  const { productId } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState(user?.address || '');
  const [postalCode, setPostalCode] = useState('');
  const [contactPhone, setContactPhone] = useState(user?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const homeLink = user ? '/customer/home' : '/';

  useEffect(() => {
    if (!productId) { setLoading(false); return; }
    Promise.all([getProducts(), getProductionBatchesForProduct(productId)])
      .then(([products, productBatches]) => {
        setProduct(products.find((p: any) => p.id === productId) || null);
        const today = todayKey();
        const open = (productBatches as ProductionBatch[])
          .filter(b => b.status === 'open' && b.batchStatus !== 'cancelled' && b.productionDate >= today)
          .sort((a, b) => a.productionDate.localeCompare(b.productionDate));
        setBatches(open);
        if (open.length > 0) setSelectedBatchId(open[0].id);
      })
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!product || !product.batchTracked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Product not found</h2>
          <Link to={homeLink}><Button>Back to Home</Button></Link>
        </div>
      </div>
    );
  }

  const selectedBatch = batches.find(b => b.id === selectedBatchId) || null;
  const remainingCapacity = selectedBatch ? getRemainingCapacity(selectedBatch) : null;

  const handleQuantityChange = (delta: number) => setQuantity(Math.max(1, quantity + delta));
  const handleQuantityInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    setQuantity(digits === '' ? 0 : Math.min(999, parseInt(digits, 10)));
  };

  const showErrors = (errors: string[]) => setFormErrors(errors);

  const handlePlacePreOrder = async () => {
    if (!user) {
      navigate('/login', { state: { from: `/customer/batch-order/${productId}` } });
      return;
    }
    const errors: string[] = [];
    if (!selectedBatch) errors.push('Please select a production date');
    if (quantity < 1) errors.push('Please enter a quantity of at least 1');
    if (selectedBatch && remainingCapacity !== null && quantity > remainingCapacity) {
      errors.push(`Only ${remainingCapacity} left for this date. Please reduce the quantity or choose another date.`);
    }
    if (deliveryMethod === 'delivery' && !deliveryAddress) errors.push('Please fill in your delivery address');
    if (deliveryMethod === 'delivery' && !postalCode) errors.push('Please fill in your postal code');
    if (deliveryMethod === 'delivery' && postalCode && postalCode.length !== 5) errors.push('Postal code must be 5 digits');
    if (!contactPhone) errors.push('Please provide a contact phone number');

    if (errors.length > 0) {
      showErrors(errors);
      return;
    }
    setFormErrors([]);
    setSubmitting(true);
    try {
      await createBatchPreOrder({
        productId: product.id,
        productionDate: selectedBatch!.productionDate,
        quantity,
        notes,
        deliveryMethod,
        deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : undefined,
        postalCode: deliveryMethod === 'delivery' ? postalCode : undefined,
        contactPhone,
        specialInstructions: notes,
        customerName: user.name,
      });
      vibrate([15, 60, 15]);
      toast.success('Pre-order placed! Track its progress in My Orders.');
      navigate('/customer/tracking');
    } catch (err: any) {
      showErrors([err?.message || 'Could not place your pre-order. Please try again.']);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer>
      <div className="page-hero page-hero--rounded">
        <Link to={homeLink} className="page-back-link">
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span className="text-lg">Back to Products</span>
        </Link>
        <h1 className="text-2xl">Pre-Order</h1>
      </div>

      <div className="px-0 py-8 space-y-6">
        <Card className="overflow-hidden">
          <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
            <img src={product.image} alt={product.name} onError={onImageError} className="w-full h-full object-cover" />
          </div>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">{product.name}</h2>
            <p className="text-gray-600 mb-4">{product.description}</p>
            <p className="text-3xl font-bold text-orange-600">RM {product.price.toFixed(2)}</p>
            <p className="text-sm text-gray-500">per {product.unit}</p>
            <div className="info-box mt-4">
              <p className="text-sm text-blue-900">
                <strong>How this works:</strong> this item is only made once enough customers pre-order for a
                production date. No payment is collected now — you'll be asked to pay only once the minimum
                quantity is reached.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Choose a Production Date</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {batches.length === 0 ? (
              <p className="text-gray-600">No production dates are open for this item right now — please check back soon.</p>
            ) : (
              batches.map((batch) => {
                const remaining = getRemainingToMinimum(batch);
                const cap = getRemainingCapacity(batch);
                const progressPct = batch.minQuantity > 0 ? Math.min(100, (batch.currentQuantity / batch.minQuantity) * 100) : 0;
                return (
                  <div
                    key={batch.id}
                    onClick={() => setSelectedBatchId(batch.id)}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all select-none space-y-2 ${selectedBatchId === batch.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-300'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-gray-900">
                        {new Date(`${batch.productionDate}T00:00:00`).toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <Badge className={batchBadgeClass(batch)}>{getBatchStatusLabel(batch)}</Badge>
                    </div>
                    <Progress value={progressPct} className="h-2" />
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{batch.currentQuantity} / {batch.minQuantity} {product.unit}{remaining > 0 ? ` · need ${remaining} more` : ''}</span>
                      <span className="flex items-center gap-1"><Users className="w-4 h-4" />{batch.orderCount} joined</span>
                    </div>
                    {cap !== null && <p className="text-xs text-gray-500">{cap} left before this date is full</p>}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {batches.length > 0 && (
          <>
            <Card>
              <CardContent className="p-6 space-y-6">
                <FormSection>
                  <Label className="text-lg">Quantity</Label>
                  <div className="flex items-center justify-center space-x-4">
                    <Button variant="outline" size="icon" onClick={() => handleQuantityChange(-1)} disabled={quantity <= 1} className="h-14 w-14 shrink-0 border-2"><Minus className="w-5 h-5" /></Button>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Quantity"
                      value={quantity === 0 ? '' : quantity}
                      onChange={(e) => handleQuantityInput(e.target.value)}
                      onBlur={() => { if (quantity < 1) setQuantity(1); }}
                      className="w-full max-w-32 text-center text-4xl font-bold text-gray-900 border-2 border-gray-200 rounded-lg py-1 focus:border-orange-400 focus:outline-none"
                    />
                    <Button variant="outline" size="icon" onClick={() => handleQuantityChange(1)} className="h-14 w-14 shrink-0 border-2"><Plus className="w-5 h-5" /></Button>
                  </div>
                  <div className="text-sm text-gray-500 mt-1 text-center">{product.unit} — tap the number to type an amount</div>
                </FormSection>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Truck className="w-6 h-6 text-orange-600" />
                  Delivery Method
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as 'pickup' | 'delivery')}>
                  <div className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${deliveryMethod === 'pickup' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`} onClick={() => setDeliveryMethod('pickup')}>
                    <RadioGroupItem value="pickup" id="batch-pickup" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="batch-pickup" className="text-lg cursor-pointer flex items-center gap-2">
                        <HomeIcon className="w-5 h-5" />Pickup
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">Pick up your order from our location (Free)</p>
                    </div>
                  </div>
                  <div className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${deliveryMethod === 'delivery' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`} onClick={() => setDeliveryMethod('delivery')}>
                    <RadioGroupItem value="delivery" id="batch-delivery" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="batch-delivery" className="text-lg cursor-pointer flex items-center gap-2">
                        <Truck className="w-5 h-5" />Delivery
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">Get your order delivered to your doorstep</p>
                    </div>
                    <span className="text-sm font-semibold text-orange-600 text-right">Fee via WhatsApp</span>
                  </div>
                </RadioGroup>

                {deliveryMethod === 'delivery' && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="batch-address" className="text-base">Delivery Address *</Label>
                      <Textarea id="batch-address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Enter your complete delivery address" className="min-h-24 text-base" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="batch-postalCode" className="text-base">Postal Code *</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input id="batch-postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, ''))} placeholder="e.g., 50470" className="pl-12 text-base" maxLength={5} />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="batch-phone" className="text-base">Contact Phone *</Label>
                  <Input id="batch-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="60123456789" className="h-12 text-base" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batch-notes" className="text-base">Special Instructions (Optional)</Label>
                  <Textarea id="batch-notes" placeholder="Any special requests or dietary requirements?" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-24 text-base" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between text-xl">
                  <span className="font-bold text-gray-900">Total if confirmed:</span>
                  <span className="font-bold text-orange-600">RM {(product.price * Math.max(1, quantity)).toFixed(2)}</span>
                </div>
                {formErrors.length > 0 && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 space-y-1">
                    <p className="font-semibold text-red-800">Please fix the following before continuing:</p>
                    {formErrors.map((err, idx) => (
                      <p key={idx} className="text-red-700">• {err}</p>
                    ))}
                  </div>
                )}
                <Button size="lg" onClick={handlePlacePreOrder} disabled={submitting} className="w-full brand-button h-14 text-lg">
                  {submitting ? 'Placing Pre-Order…' : 'Place Pre-Order'}
                </Button>
                <p className="text-sm text-center text-gray-600">No payment now — you'll be notified when it's time to pay</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PageContainer>
  );
}
