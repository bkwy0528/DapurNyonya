import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { ArrowLeft, Package, Calculator, AlertCircle, Printer, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../../App';
import { getOrders, getProducts, saveProduct, getIngredients, saveIngredient, updateIngredientPurchased } from '../../utils/db';
import { normalizeIngredientName } from '../../utils/ingredients';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface IngredientEstimationPageProps {
  user: User;
}

interface IngredientEstimate {
  id: string; // ingredientId, or a synthetic key for not-yet-migrated legacy rows
  name: string;
  unit: string;
  required: number;
  purchased: number;
  isLegacy: boolean; // true if this row hasn't been migrated to the ingredient master list yet
}

interface ProductCount {
  id: string;
  name: string;
  count: number;
  hasRecipe: boolean;
}

// Only orders that still need cooking matter for shopping: upcoming delivery
// dates, and not rejected/cancelled/already delivered or out the door.
const NEEDS_PREPARATION = ['Pending Approval', 'Order Received', 'In Preparation'];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function IngredientEstimationPage({ user: _user }: IngredientEstimationPageProps) {
  const [manualMode, setManualMode] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [productCounts, setProductCounts] = useState<ProductCount[]>([]);
  const [ingredients, setIngredients] = useState<IngredientEstimate[]>([]);
  const [deletedProductItems, setDeletedProductItems] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    if (!manualMode) calculateFromOrders();
  }, [manualMode]);

  const calculateFromOrders = async () => {
    try {
      await calculateFromOrdersInner();
    } finally {
      setLoading(false);
    }
  };

  const calculateFromOrdersInner = async () => {
    // getIngredients() is allowed to fail on its own (e.g. its Firestore rule
    // isn't deployed yet) without blocking products/orders from loading —
    // legacy (non-migrated) recipe rows still aggregate correctly without it.
    const [allProducts, orders, allIngredients] = await Promise.all([
      getProducts(),
      getOrders(),
      getIngredients().catch(() => []),
    ]);
    setProducts(allProducts);

    const today = todayKey();
    // Match order line items to products by id, so renaming a product no longer
    // orphans its outstanding orders' ingredient needs. Name is only a fallback
    // for legacy orders whose items predate productId being stored.
    const productById = new Map(allProducts.map((p: any) => [p.id, p]));
    const productByName = new Map(allProducts.map((p: any) => [p.name, p]));
    const counts: { [productId: string]: number } = {};
    const unmatched: { [name: string]: number } = {};
    orders
      .filter((order: any) =>
        NEEDS_PREPARATION.includes(order.status)
        && order.deliveryDate
        && order.deliveryDate >= today
      )
      .forEach((order: any) => {
        (order.items || []).forEach((item: any) => {
          const product = productById.get(item.productId) || productByName.get(item.name);
          if (product) {
            counts[product.id] = (counts[product.id] || 0) + (item.quantity || 0);
          } else {
            // The product was deleted after this order was placed — its recipe is
            // gone, so it can't be counted. Surfaced as a warning instead of
            // silently vanishing from the shopping list.
            const label = item.name || 'Unknown product';
            unmatched[label] = (unmatched[label] || 0) + (item.quantity || 0);
          }
        });
      });

    const newCounts: ProductCount[] = allProducts.map((p: any) => ({
      id: p.id,
      name: p.name,
      count: counts[p.id] || 0,
      hasRecipe: Array.isArray(p.ingredients) && p.ingredients.length > 0,
    }));
    setProductCounts(newCounts);
    setDeletedProductItems(Object.entries(unmatched).map(([name, count]) => ({ name, count })));
    calculateIngredients(allProducts, newCounts, allIngredients);
  };

  const calculateIngredients = (allProducts: any[], countList: ProductCount[], allIngredients: any[]) => {
    const ingredientById = new Map(allIngredients.map((i: any) => [i.id, i]));
    // Ingredients already migrated to the master list combine by ingredientId.
    // Rows not yet migrated (no ingredientId — see the migration banner below)
    // still combine the old way (name + unit), so nothing silently vanishes
    // from the shopping list before the admin gets around to migrating.
    const required: { [key: string]: number } = {};
    const rowMeta: { [key: string]: { name: string; unit: string; isLegacy: boolean } } = {};
    countList.forEach(({ id, count }) => {
      if (count <= 0) return;
      const product = allProducts.find((p: any) => p.id === id);
      (product?.ingredients || []).forEach((ing: any) => {
        const key = ing.ingredientId || `legacy:${normalizeIngredientName(ing.name)}|${(ing.unit || '').trim().toLowerCase()}`;
        required[key] = (required[key] || 0) + ing.quantity * count;
        if (!rowMeta[key]) {
          const master = ing.ingredientId ? ingredientById.get(ing.ingredientId) : null;
          rowMeta[key] = {
            name: master?.name || ing.name.trim(),
            unit: master?.unit || (ing.unit || '').trim(),
            isLegacy: !ing.ingredientId,
          };
        }
      });
    });

    const rows: IngredientEstimate[] = Object.entries(required).map(([key, quantity]) => {
      const meta = rowMeta[key];
      const master = !meta.isLegacy ? ingredientById.get(key) : null;
      return {
        id: key,
        name: meta.name,
        unit: meta.unit,
        required: quantity,
        purchased: master?.purchased || 0,
        isLegacy: meta.isLegacy,
      };
    });
    setIngredients(rows);
  };

  const handleManualCalculate = () => calculateIngredients(products, productCounts, []);

  const updateProductCount = (id: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setProductCounts(prev => prev.map(p => p.id === id ? { ...p, count: numValue } : p));
  };

  const updatePurchased = async (id: string, value: string) => {
    const numValue = Math.max(0, parseFloat(value) || 0);
    setIngredients(prev => prev.map(ing => ing.id === id ? { ...ing, purchased: numValue } : ing));
    const row = ingredients.find(ing => ing.id === id);
    if (row && !row.isLegacy) {
      await updateIngredientPurchased(id, numValue);
    }
  };

  const resetPurchased = (id: string) => updatePurchased(id, '0');

  // One-time cleanup for products whose recipes still use free-text ingredient
  // names instead of referencing the shared ingredient master list. Creates one
  // master ingredient per unique name (carrying over any old per-product stock
  // as its starting Purchased amount) and rewrites every product's recipe rows
  // to reference it.
  const legacyIngredientCount = products.reduce((sum, p) => sum + (p.ingredients || []).filter((ing: any) => ing.name && !ing.ingredientId).length, 0);

  const runMigration = async () => {
    setMigrating(true);
    try {
      const [allProducts, allIngredients] = await Promise.all([getProducts(), getIngredients()]);
      const existingByName = new Map(allIngredients.map((i: any) => [normalizeIngredientName(i.name), i]));
      const created = new Map<string, { id: string; name: string; unit: string; purchased: number }>();

      allProducts.forEach((p: any) => {
        (p.ingredients || []).forEach((ing: any) => {
          if (!ing.name || ing.ingredientId) return;
          const key = normalizeIngredientName(ing.name);
          if (existingByName.has(key)) return;
          if (!created.has(key)) {
            created.set(key, {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: ing.name.trim(),
              unit: (ing.unit || 'g').trim(),
              purchased: 0,
            });
          }
          created.get(key)!.purchased += ing.stock || 0;
        });
      });

      await Promise.all(Array.from(created.values()).map(saveIngredient));

      const resolveByName = new Map<string, any>();
      existingByName.forEach((v, k) => resolveByName.set(k, v));
      created.forEach((v, k) => resolveByName.set(k, v));

      let productsUpdated = 0;
      await Promise.all(allProducts.map(async (p: any) => {
        let changed = false;
        const rewritten = (p.ingredients || []).map((ing: any) => {
          if (!ing.name || ing.ingredientId) return ing;
          const match = resolveByName.get(normalizeIngredientName(ing.name));
          if (!match) return ing;
          changed = true;
          const { stock: _stock, ...rest } = ing;
          return { ...rest, ingredientId: match.id, name: match.name, unit: match.unit };
        });
        if (changed) {
          productsUpdated += 1;
          await saveProduct({ ...p, ingredients: rewritten });
        }
      }));

      toast.success(`Migrated ${created.size} ingredient(s) across ${productsUpdated} product(s).`);
      await calculateFromOrdersInner();
    } catch {
      toast.error('Migration failed — check that firestore.rules has been deployed.');
    } finally {
      setMigrating(false);
    }
  };

  const productsWithoutRecipe = productCounts.filter(p => p.count > 0 && !p.hasRecipe);
  const shoppingList = ingredients
    .map(ing => ({ ...ing, shortage: Math.max(0, ing.required - ing.purchased) }))
    .filter(ing => ing.shortage > 0);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen pb-24">
      <style>{`@media print {
        @page { size: A4; margin: 12mm; }
      }`}</style>

      <div className="print:hidden">
        <div className="page-hero">
          <div className="page-hero__inner page-hero__inner--wide">
            <Link to="/admin/dashboard" className="page-back-link">
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="text-lg">Back to Dashboard</span>
            </Link>
            <h1 className="text-2xl flex items-center">
              <Package className="w-7 h-7 mr-3" />
              Ingredient Planning
            </h1>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {legacyIngredientCount > 0 && (
            <div className="warning-box">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-1" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-yellow-800">
                    <strong>{legacyIngredientCount} ingredient row{legacyIngredientCount === 1 ? '' : 's'}</strong> still use{legacyIngredientCount === 1 ? 's' : ''} old-style
                    free-text names instead of the shared ingredient list, so they can't track a Purchased quantity yet.
                  </p>
                  <Button size="sm" onClick={runMigration} disabled={migrating} className="brand-button">
                    {migrating ? 'Migrating…' : 'Migrate Ingredient Data'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Calculation Mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Checkbox id="manualMode" checked={manualMode} onCheckedChange={(checked) => setManualMode(checked as boolean)} />
                <Label htmlFor="manualMode" className="text-base cursor-pointer">
                  Manual input mode (enter quantities manually instead of using orders)
                </Label>
              </div>
              <p className="text-sm text-gray-600">
                {manualMode
                  ? 'You can manually enter the number of products to calculate ingredient needs.'
                  : 'Quantities are calculated from upcoming orders that still need preparation (pending, approved, or in preparation).'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Product Quantities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {productCounts.length === 0 ? (
                <p className="text-gray-600">No products found. Add products in Product Management first.</p>
              ) : (
                productCounts.map((product) => (
                  <div key={product.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <Label className="text-base font-semibold">{product.name}</Label>
                      {!product.hasRecipe && (
                        <p className="text-sm text-orange-700 mt-1">No recipe set — add ingredients to this product in Product Management</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      {manualMode ? (
                        <Input type="number" value={product.count} onChange={(e) => updateProductCount(product.id, e.target.value)} className="w-32 h-12 text-lg text-center" min="0" />
                      ) : (
                        <div className="text-3xl font-bold text-orange-600">{product.count}</div>
                      )}
                      <span className="text-gray-600">units</span>
                    </div>
                  </div>
                ))
              )}
              {manualMode && productCounts.length > 0 && (
                <Button onClick={handleManualCalculate} size="lg" className="w-full brand-button">
                  <Calculator className="w-5 h-5 mr-2" />
                  Calculate Ingredients
                </Button>
              )}
            </CardContent>
          </Card>

          {!manualMode && deletedProductItems.length > 0 && (
            <div className="warning-box">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-1" />
                <p className="text-sm text-yellow-800">
                  <strong>{deletedProductItems.map(d => `${d.name} (${d.count} units)`).join(', ')}</strong> {deletedProductItems.length === 1 ? 'appears' : 'appear'} in
                  upcoming orders, but the {deletedProductItems.length === 1 ? 'product has' : 'products have'} been deleted — the recipe is gone,
                  so those ingredients are not included below.
                </p>
              </div>
            </div>
          )}

          {productsWithoutRecipe.length > 0 && (
            <div className="warning-box">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-1" />
                <p className="text-sm text-yellow-800">
                  <strong>{productsWithoutRecipe.map(p => p.name).join(', ')}</strong> {productsWithoutRecipe.length === 1 ? 'has' : 'have'} upcoming
                  orders but no recipe, so {productsWithoutRecipe.length === 1 ? 'its' : 'their'} ingredients are not included below.
                </p>
              </div>
            </div>
          )}

          {ingredients.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Required Ingredients</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ingredients.map((ingredient) => {
                  const remaining = ingredient.purchased - ingredient.required;
                  return (
                  <div key={ingredient.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <p className="font-semibold text-gray-900">{ingredient.name}</p>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Required</p>
                        <p className="font-semibold text-gray-900">{ingredient.required.toLocaleString(undefined, { maximumFractionDigits: 2 })} {ingredient.unit}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Purchased</p>
                        {ingredient.isLegacy ? (
                          <p className="text-sm text-gray-400 italic">Migrate first</p>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Input type="number" value={ingredient.purchased} onChange={(e) => updatePurchased(ingredient.id, e.target.value)} className="w-20 h-9 text-right" min="0" step="0.1" />
                            <span className="text-gray-600 text-sm">{ingredient.unit}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">{remaining >= 0 ? 'Remaining' : 'Shortage'}</p>
                        <p className={`font-bold ${remaining >= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                          {Math.abs(remaining).toLocaleString(undefined, { maximumFractionDigits: 2 })} {ingredient.unit}
                        </p>
                      </div>
                      {!ingredient.isLegacy && (
                        <Button variant="ghost" size="sm" onClick={() => resetPurchased(ingredient.id)} title="Reset purchased to 0" className="h-9 px-2 text-gray-500 hover:bg-gray-200">
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No ingredients to calculate</h3>
                <p className="text-gray-600">
                  {manualMode
                    ? 'Enter product quantities above and click Calculate to see ingredient needs.'
                    : 'Upcoming orders will automatically generate ingredient calculations once products have recipes.'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 print:px-0 print:max-w-none">
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Shopping List</CardTitle>
            {shoppingList.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => window.print()} className="print:hidden">
                <Printer className="w-4 h-4 mr-2" />Print
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {shoppingList.length === 0 ? (
              <p className="text-gray-600">Nothing left to buy right now.</p>
            ) : (
              shoppingList.map(ing => (
                <div key={ing.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg print:bg-transparent print:border-b print:rounded-none">
                  <p className="font-semibold text-gray-900">{ing.name}</p>
                  <p className="font-bold text-amber-600">{ing.shortage.toLocaleString(undefined, { maximumFractionDigits: 2 })} {ing.unit}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
