import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { ArrowLeft, Package, Calculator, AlertCircle } from 'lucide-react';
import { User } from '../../App';
import { getOrders, getProducts } from '../../utils/db';

interface IngredientEstimationPageProps {
  user: User;
}

interface IngredientEstimate {
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
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

  useEffect(() => {
    if (!manualMode) calculateFromOrders();
  }, [manualMode]);

  const calculateFromOrders = async () => {
    const [allProducts, orders] = await Promise.all([getProducts(), getOrders()]);
    setProducts(allProducts);

    const today = todayKey();
    const counts: { [name: string]: number } = {};
    orders
      .filter((order: any) =>
        NEEDS_PREPARATION.includes(order.status)
        && order.deliveryDate
        && order.deliveryDate >= today
      )
      .forEach((order: any) => {
        (order.items || []).forEach((item: any) => {
          counts[item.name] = (counts[item.name] || 0) + (item.quantity || 0);
        });
      });

    const newCounts: ProductCount[] = allProducts.map((p: any) => ({
      id: p.id,
      name: p.name,
      count: counts[p.name] || 0,
      hasRecipe: Array.isArray(p.ingredients) && p.ingredients.length > 0,
    }));
    setProductCounts(newCounts);
    calculateIngredients(allProducts, newCounts);
  };

  const calculateIngredients = (allProducts: any[], countList: ProductCount[]) => {
    // Same ingredient (name + unit) across products gets summed into one line
    const aggregated: { [key: string]: IngredientEstimate } = {};
    countList.forEach(({ id, count }) => {
      if (count <= 0) return;
      const product = allProducts.find((p: any) => p.id === id);
      (product?.ingredients || []).forEach((ing: any) => {
        const key = `${ing.name.toLowerCase()}|${ing.unit}`;
        if (!aggregated[key]) aggregated[key] = { name: ing.name, quantity: 0, unit: ing.unit, checked: false };
        aggregated[key].quantity += ing.quantity * count;
      });
    });
    setIngredients(Object.values(aggregated));
  };

  const handleManualCalculate = () => calculateIngredients(products, productCounts);

  const updateProductCount = (id: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setProductCounts(prev => prev.map(p => p.id === id ? { ...p, count: numValue } : p));
  };

  const toggleIngredient = (index: number) => {
    setIngredients(prev => prev.map((ing, i) => i === index ? { ...ing, checked: !ing.checked } : ing));
  };

  const updateQuantity = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setIngredients(prev => prev.map((ing, i) => i === index ? { ...ing, quantity: numValue } : ing));
  };

  const productsWithoutRecipe = productCounts.filter(p => p.count > 0 && !p.hasRecipe);

  return (
    <div className="min-h-screen pb-24">
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
              {ingredients.map((ingredient, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-4">
                    <Checkbox checked={ingredient.checked} onCheckedChange={() => toggleIngredient(index)} className="h-6 w-6" />
                    <div>
                      <p className={`font-semibold text-gray-900 ${ingredient.checked ? 'line-through text-gray-400' : ''}`}>
                        {ingredient.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Input type="number" value={ingredient.quantity} onChange={(e) => updateQuantity(index, e.target.value)} className="w-24 h-10 text-right" min="0" step="0.1" />
                    <span className="text-gray-600 min-w-[60px]">{ingredient.unit}</span>
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <p className="text-gray-700">Items completed:</p>
                  <p className="text-xl font-bold text-green-600">{ingredients.filter(i => i.checked).length} / {ingredients.length}</p>
                </div>
              </div>
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
  );
}
