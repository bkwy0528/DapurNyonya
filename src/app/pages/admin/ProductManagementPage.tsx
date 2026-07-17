import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { ArrowLeft, Crop, Plus, Edit, Trash2, Upload, X, Wheat } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../../App';
import { getOrders, getProducts, saveProduct, deleteProduct, getIngredients, saveIngredient } from '../../utils/db';
import { SUPPORTED_UNITS, Ingredient, normalizeIngredientName } from '../../utils/ingredients';
import { fileToDataUrl } from '../../utils/image';
import { onImageError } from '../../utils/imageFallback';
import ImageCropDialog from '../../components/ImageCropDialog';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface ProductManagementPageProps {
  user: User;
}

const INGREDIENT_DATALIST_ID = 'ingredient-master-datalist';

export interface ProductIngredient {
  ingredientId?: string; // references ingredients/{id} in the master list, once matched/created
  name: string;
  quantity: number; // amount needed per 1 unit of the product — derived from batch fields when present
  unit: string; // locked to the matched ingredient's unit once ingredientId is set
  batchAmount?: number; // total amount used for one batch (entry convenience)
  batchYield?: number;  // how many product units that batch makes (entry convenience)
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  unit: string;
  prepDays: number;
  available: boolean;
  // Exempt from the bulk-order minimum (e.g. bottled items) — small quantities
  // of this product alone may still pick any collection date at checkout
  bulkExempt?: boolean;
  // Batch/MOQ production: this product skips the normal cart/checkout flow
  // entirely. Customers pre-order against an admin-opened production date
  // (Production Calendar) and pay nothing until the minimum quantity is met.
  batchTracked?: boolean;
  ingredients?: ProductIngredient[];
}

export default function ProductManagementPage({ user: _user }: ProductManagementPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [outstandingUnits, setOutstandingUnits] = useState<number | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [duplicateNameWarning, setDuplicateNameWarning] = useState(false);

  // When the delete dialog opens, check whether the product still appears in
  // upcoming orders that need preparation — deleting it also deletes its recipe,
  // which would silently drop those orders from Ingredient Planning.
  useEffect(() => {
    if (!productToDelete) { setOutstandingUnits(null); return; }
    let cancelled = false;
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    getOrders()
      .then(orders => {
        if (cancelled) return;
        const units = orders
          .filter((o: any) => ['Pending Approval', 'Order Received', 'In Preparation'].includes(o.status) && o.deliveryDate && o.deliveryDate >= today)
          .reduce((sum: number, o: any) => sum + (o.items || [])
            .filter((it: any) => it.productId === productToDelete.id || it.name === productToDelete.name)
            .reduce((s: number, it: any) => s + (it.quantity || 0), 0), 0);
        setOutstandingUnits(units);
      })
      .catch(() => { if (!cancelled) setOutstandingUnits(0); });
    return () => { cancelled = true; };
  }, [productToDelete]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    image: '',
    unit: '',
    prepDays: '3',
    available: true,
    bulkExempt: false,
    batchTracked: false,
  });
  const [ingredients, setIngredients] = useState<ProductIngredient[]>([]);
  const [masterIngredients, setMasterIngredients] = useState<Ingredient[]>([]);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
    // Independent of the products load: the ingredient master list is only
    // needed for the recipe picker, so a failure here (e.g. rules not yet
    // deployed) must never block the product list itself from rendering.
    getIngredients()
      .then(setMasterIngredients)
      .catch(() => {});
  }, []);

  // Selecting a photo opens the crop dialog first; the cropped result is
  // resized/compressed before storing — Firestore documents cap at 1 MiB, so
  // raw camera photos saved as base64 would silently fail to write
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow picking the same file again after cancelling the crop
    e.target.value = '';
    if (!file) return;
    try {
      setCropSrc(await fileToDataUrl(file));
    } catch (err: any) {
      toast.error(err.message || 'Could not process the image. Please try another photo.');
    }
  };

  const handleCropConfirm = (cropped: string) => {
    setFormData(prev => ({ ...prev, image: cropped }));
    setImagePreview(cropped);
    setCropSrc(null);
  };

  const addIngredientRow = () => setIngredients(prev => [...prev, { name: '', quantity: 0, unit: 'g' }]);
  const removeIngredientRow = (index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const NUMERIC_INGREDIENT_FIELDS = ['quantity', 'batchAmount', 'batchYield'];
  const updateIngredientRow = (index: number, field: keyof ProductIngredient, value: string) => {
    setIngredients(prev => prev.map((ing, i) => {
      if (i !== index) return ing;
      const isNumeric = NUMERIC_INGREDIENT_FIELDS.includes(field as string);
      const updated = { ...ing, [field]: isNumeric ? (parseFloat(value) || 0) : value } as ProductIngredient;
      // Batch mode derives the per-unit quantity from amount ÷ yield so the admin
      // never has to do that division herself
      if (field === 'batchAmount' || field === 'batchYield') {
        if (updated.batchYield) updated.quantity = (updated.batchAmount || 0) / updated.batchYield;
      }
      // Typing a name that matches an existing master ingredient locks onto its
      // id and unit (one default unit per ingredient — no per-recipe override).
      // Typing something new clears ingredientId so the Unit field becomes
      // editable again, ready to define a brand-new ingredient on save.
      if (field === 'name') {
        const match = masterIngredients.find(mi => normalizeIngredientName(mi.name) === normalizeIngredientName(value));
        updated.ingredientId = match?.id;
        if (match) updated.unit = match.unit;
      }
      return updated;
    }));
  };

  // Batch mode is inferred from the presence of batchAmount/batchYield rather than
  // a separate stored flag, so switching back to "per unit" just drops those fields
  const setIngredientMode = (index: number, mode: 'unit' | 'batch') => {
    setIngredients(prev => prev.map((ing, i) => {
      if (i !== index) return ing;
      if (mode === 'batch') {
        return ing.batchAmount !== undefined ? ing : { ...ing, batchAmount: ing.quantity || 0, batchYield: 1 };
      }
      const { batchAmount, batchYield, ...rest } = ing;
      return rest;
    }));
  };

  const handleSaveProduct = async () => {
    if (!formData.name || !formData.price || !formData.unit || !formData.prepDays) {
      toast.error('Please fill in all required fields');
      return;
    }
    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid price');
      return;
    }
    const prepDays = parseInt(formData.prepDays, 10);
    if (isNaN(prepDays) || prepDays < 1) {
      toast.error('Preparation days must be at least 1');
      return;
    }

    // Analytics and the Ingredient Planner both aggregate by product name, so two
    // products sharing a name silently merge their reporting — warn once and let
    // the admin decide (a second press saves anyway).
    const trimmedName = formData.name.trim().toLowerCase();
    const nameTaken = products.some(p => p.name.trim().toLowerCase() === trimmedName && p.id !== editingProduct?.id);
    if (nameTaken && !duplicateNameWarning) {
      setDuplicateNameWarning(true);
      return;
    }
    setDuplicateNameWarning(false);

    // Only keep completed ingredient rows
    const cleanIngredients = ingredients.filter(ing => ing.name.trim() && ing.quantity > 0);

    // Resolve each row to a master ingredient, creating a new one if the typed
    // name doesn't match anything (locks in the unit chosen for it here as its
    // default going forward). Rows already matched to an existing ingredient
    // (ingredientId set) are left untouched — their unit is not editable.
    const newlyCreated: Ingredient[] = [];
    const resolvedIngredients: ProductIngredient[] = [];
    for (const ing of cleanIngredients) {
      let ingredientId = ing.ingredientId;
      if (!ingredientId) {
        const existing = masterIngredients.find(mi => normalizeIngredientName(mi.name) === normalizeIngredientName(ing.name))
          || newlyCreated.find(mi => normalizeIngredientName(mi.name) === normalizeIngredientName(ing.name));
        if (existing) {
          ingredientId = existing.id;
        } else {
          ingredientId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const newIngredient: Ingredient = { id: ingredientId, name: ing.name.trim(), unit: ing.unit || 'g' };
          await saveIngredient(newIngredient);
          newlyCreated.push(newIngredient);
        }
      }
      resolvedIngredients.push({ ...ing, ingredientId, name: ing.name.trim() });
    }
    if (newlyCreated.length > 0) {
      setMasterIngredients(prev => [...prev, ...newlyCreated]);
    }

    if (editingProduct) {
      const updated: Product = { ...editingProduct, ...formData, price, prepDays, ingredients: resolvedIngredients };
      await saveProduct(updated);
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? updated : p));
      toast.success('Product updated successfully!');
    } else {
      const newProduct: Product = {
        id: Date.now().toString(),
        ...formData,
        price,
        prepDays,
        ingredients: resolvedIngredients,
      };
      await saveProduct(newProduct);
      setProducts(prev => [...prev, newProduct]);
      toast.success('Product added successfully!');
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      image: product.image,
      unit: product.unit,
      prepDays: String(product.prepDays || 3),
      available: product.available,
      bulkExempt: product.bulkExempt ?? false,
      batchTracked: product.batchTracked ?? false,
    });
    setIngredients(product.ingredients || []);
    setImagePreview(product.image);
    setIsDialogOpen(true);
  };

  // Unit is read-only once a row is matched to an existing master ingredient
  // (one default unit per ingredient); only a brand-new ingredient lets the
  // admin pick its unit, which then locks in for every future recipe.
  const renderUnitField = (ing: ProductIngredient, index: number) => (
    <div className="space-y-1">
      <Label className="text-sm text-gray-600">Unit</Label>
      {ing.ingredientId ? (
        <div className="h-12 text-base flex items-center px-3 bg-gray-100 border border-gray-200 rounded-md text-gray-700">
          {ing.unit}
        </div>
      ) : (
        <Select value={ing.unit || 'g'} onValueChange={(value) => updateIngredientRow(index, 'unit', value)}>
          <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SUPPORTED_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    await deleteProduct(productToDelete.id);
    setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
    toast.success('Product deleted successfully!');
    setProductToDelete(null);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', price: '', image: '', unit: '', prepDays: '3', available: true, bulkExempt: false, batchTracked: false });
    setIngredients([]);
    setImagePreview('');
    setEditingProduct(null);
    setDuplicateNameWarning(false);
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
          <h1 className="text-2xl">Product Management</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="lg" className="success-button">
              <Plus className="w-5 h-5 mr-2" />
              Add New Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input id="name" value={formData.name} onChange={(e) => { setFormData(prev => ({ ...prev, name: e.target.value })); setDuplicateNameWarning(false); }} placeholder="e.g., Traditional Dumplings" className="h-12" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Describe your product..." className="min-h-24" />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (RM) *</Label>
                  <Input id="price" type="number" step="0.01" value={formData.price} onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))} placeholder="25.00" className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit *</Label>
                  <Input id="unit" value={formData.unit} onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))} placeholder="e.g., pack (12 pieces)" className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prepDays">Preparation Days *</Label>
                  <Input id="prepDays" type="number" min="1" step="1" value={formData.prepDays} onChange={(e) => setFormData(prev => ({ ...prev, prepDays: e.target.value }))} placeholder="3" className="h-12" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Product Image *</Label>
                <div className="space-y-3">
                  {imagePreview && (
                    <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      {/* Re-cropping works from the stored (already-cropped) image, so it can zoom in further but not recover cut-off edges */}
                      {imagePreview.startsWith('data:') && (
                        <Button type="button" variant="secondary" size="sm" className="absolute bottom-2 right-2 shadow" onClick={() => setCropSrc(imagePreview)}>
                          <Crop className="w-4 h-4 mr-1" />Adjust
                        </Button>
                      )}
                      <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => { setImagePreview(''); setFormData(prev => ({ ...prev, image: '' })); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <label className="flex-1">
                      <div className="flex items-center justify-center h-12 px-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
                        <Upload className="w-5 h-5 mr-2 text-gray-600" />
                        <span className="text-sm text-gray-600">Upload Image</span>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </div>
                    </label>
                    <div className="text-sm text-gray-500 flex items-center">or</div>
                    <Input placeholder="Image URL" value={formData.image.startsWith('data:') ? '' : formData.image} onChange={(e) => { setFormData(prev => ({ ...prev, image: e.target.value })); setImagePreview(e.target.value); }} className="flex-1 h-12" />
                  </div>
                  <p className="text-xs text-gray-500">Upload a photo (automatically resized) or enter an image URL</p>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                <div>
                  <Label className="flex items-center gap-2"><Wheat className="w-4 h-4 text-orange-600" />Ingredients per {formData.unit || 'unit'}</Label>
                  <p className="text-xs text-gray-500 mt-1">Used by Ingredient Planning to calculate shopping needs. Pick an existing ingredient or type a new one.</p>
                </div>
                <datalist id={INGREDIENT_DATALIST_ID}>
                  {masterIngredients.map(mi => <option key={mi.id} value={mi.name} />)}
                </datalist>
                {ingredients.length === 0 ? (
                  <p className="text-sm text-gray-500">No ingredients added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {ingredients.map((ing, index) => {
                      const isBatchMode = ing.batchAmount !== undefined || ing.batchYield !== undefined;
                      return (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={`ing-name-${index}`} className="text-sm text-gray-600">Ingredient {index + 1}</Label>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeIngredientRow(index)} className="h-8 px-2 text-red-600 hover:bg-red-50">
                            <X className="w-4 h-4 mr-1" />Remove
                          </Button>
                        </div>
                        <Input id={`ing-name-${index}`} list={INGREDIENT_DATALIST_ID} value={ing.name} onChange={(e) => updateIngredientRow(index, 'name', e.target.value)} placeholder="e.g. Glutinous rice" className="h-12 text-base" />
                        <p className="text-xs text-gray-500">
                          {ing.ingredientId
                            ? `Matched to an existing ingredient — unit is locked to ${ing.unit || '—'}.`
                            : 'New ingredient — choose its unit below (applies to every future recipe using it).'}
                        </p>

                        <div className="flex gap-2">
                          <button type="button" onClick={() => setIngredientMode(index, 'unit')} className={`flex-1 h-9 rounded-md text-sm border transition-colors ${!isBatchMode ? 'bg-orange-50 border-orange-300 text-orange-700 font-semibold' : 'border-gray-200 text-gray-500'}`}>
                            Per unit
                          </button>
                          <button type="button" onClick={() => setIngredientMode(index, 'batch')} className={`flex-1 h-9 rounded-md text-sm border transition-colors ${isBatchMode ? 'bg-orange-50 border-orange-300 text-orange-700 font-semibold' : 'border-gray-200 text-gray-500'}`}>
                            Per batch
                          </button>
                        </div>

                        {isBatchMode ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor={`ing-batchamt-${index}`} className="text-sm text-gray-600">Batch amount</Label>
                              <Input id={`ing-batchamt-${index}`} type="number" inputMode="decimal" value={ing.batchAmount || ''} onChange={(e) => updateIngredientRow(index, 'batchAmount', e.target.value)} placeholder="e.g. 1000" min="0" step="0.1" className="h-12 text-base" />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`ing-batchyield-${index}`} className="text-sm text-gray-600">Yields how many units</Label>
                              <Input id={`ing-batchyield-${index}`} type="number" inputMode="decimal" value={ing.batchYield || ''} onChange={(e) => updateIngredientRow(index, 'batchYield', e.target.value)} placeholder="e.g. 20" min="0" step="1" className="h-12 text-base" />
                            </div>
                            <div className="col-span-2">{renderUnitField(ing, index)}</div>
                            <p className="col-span-2 text-xs text-gray-500">
                              {ing.batchYield
                                ? `= ${(ing.quantity || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${ing.unit || ''} per unit`
                                : 'Enter how many units this batch makes to calculate the amount per unit'}
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor={`ing-qty-${index}`} className="text-sm text-gray-600">Amount</Label>
                              <Input id={`ing-qty-${index}`} type="number" inputMode="decimal" value={ing.quantity || ''} onChange={(e) => updateIngredientRow(index, 'quantity', e.target.value)} placeholder="e.g. 50" min="0" step="0.1" className="h-12 text-base" />
                            </div>
                            {renderUnitField(ing, index)}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
                <Button type="button" variant="outline" onClick={addIngredientRow} className="w-full h-12 border-dashed border-2 text-gray-700">
                  <Plus className="w-4 h-4 mr-2" />Add Ingredient
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <Label htmlFor="available">Product Available</Label>
                <Switch id="available" checked={formData.available} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, available: checked }))} />
              </div>

              <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="bulkExempt">No Minimum Quantity</Label>
                  <p className="text-xs text-gray-500">
                    For pre-packed items (e.g. a bottle of kueh tarts). Small orders of this product can pick any
                    collection date instead of the fixed days set in Business Settings.
                  </p>
                </div>
                <Switch id="bulkExempt" checked={formData.bulkExempt} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, bulkExempt: checked }))} />
              </div>

              <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="batchTracked">Batch Production (Minimum Order Quantity)</Label>
                  <p className="text-xs text-gray-500">
                    This product is only made once enough customers pre-order for a specific production date.
                    Customers won't pay until the minimum is reached — manage dates in Pre-Orders instead of the
                    normal checkout flow. Product Management's other ordering rules above don't apply to it.
                  </p>
                </div>
                <Switch id="batchTracked" checked={formData.batchTracked} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, batchTracked: checked }))} />
              </div>

              {duplicateNameWarning && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  A product with this name already exists — sales analytics and ingredient
                  planning will combine the two. Press the button again to save anyway.
                </p>
              )}
              <Button onClick={handleSaveProduct} size="lg" className="w-full h-12 brand-button">
                {duplicateNameWarning ? 'Save Anyway' : editingProduct ? 'Update Product' : 'Add Product'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid gap-6">
          {products.map((product) => (
            <Card key={product.id}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-56 aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 md:self-start">
                    {product.image ? (
                      <img src={product.image} alt={product.name} onError={onImageError} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{product.name}</h3>
                        <p className="text-gray-600 mt-1">{product.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={product.available ? 'status-badge--available' : 'status-badge--unavailable'}>
                          {product.available ? 'Available' : 'Unavailable'}
                        </Badge>
                        {product.batchTracked && (
                          <Badge variant="outline" className="border-orange-300 text-orange-700">Batch / MOQ</Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Price</p>
                        <p className="text-2xl font-bold text-orange-600">RM {product.price.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Unit</p>
                        <p className="font-semibold text-gray-900">{product.unit}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Preparation</p>
                        <p className="font-semibold text-gray-900">{product.prepDays || 3} day(s)</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Ordering</p>
                        <p className="font-semibold text-gray-900">{product.batchTracked ? 'Batch pre-order (MOQ)' : product.bulkExempt ? 'No minimum quantity' : 'Counts toward bulk minimum'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button variant="outline" onClick={() => handleEditProduct(product)} className="flex-1 border-2">
                        <Edit className="w-4 h-4 mr-2" />Edit
                      </Button>
                      <Button variant="outline" onClick={() => setProductToDelete(product)} className="flex-1 border-2 border-red-200 text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4 mr-2" />Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <ImageCropDialog imageSrc={cropSrc} onCancel={() => setCropSrc(null)} onConfirm={handleCropConfirm} />

      <Dialog open={productToDelete !== null} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this product?</DialogTitle>
          </DialogHeader>
          <p className="text-gray-700">
            Are you sure you want to delete <strong>{productToDelete?.name}</strong>? Customers will no longer be able to order it. This cannot be undone.
          </p>
          {(outstandingUnits ?? 0) > 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              This product still has <strong>{outstandingUnits} unit{outstandingUnits === 1 ? '' : 's'}</strong> in upcoming orders that
              need preparation. Deleting it also deletes its recipe, so those units will no longer be
              counted in Ingredient Planning — prepare or note them first.
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setProductToDelete(null)} className="flex-1 h-12">Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteProduct} className="flex-1 h-12">
              <Trash2 className="w-4 h-4 mr-2" />Delete Product
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
