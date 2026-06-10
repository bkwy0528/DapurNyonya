import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { ArrowLeft, Package, Edit, Calculator } from 'lucide-react';
import { User } from '../../App';
import { getOrders } from '../../utils/db';

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
  name: string;
  count: number;
}

export default function IngredientEstimationPage({ user: _user }: IngredientEstimationPageProps) {
  const [manualMode, setManualMode] = useState(false);
  const [productCounts, setProductCounts] = useState<ProductCount[]>([
    { name: 'Traditional Dumplings', count: 0 },
    { name: 'Festive Cookies', count: 0 },
    { name: 'Traditional Snacks', count: 0 },
  ]);
  const [ingredients, setIngredients] = useState<IngredientEstimate[]>([]);

  useEffect(() => {
    if (!manualMode) {
      calculateFromOrders();
    }
  }, [manualMode]);

  const calculateFromOrders = async () => {
    const orders = await getOrders();
    const counts: { [key: string]: number } = {};

    orders
      .filter((order: any) => order.status !== 'Rejected')
      .forEach((order: any) => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            counts[item.name] = (counts[item.name] || 0) + item.quantity;
          });
        }
      });

    const dumplings = counts['Traditional Dumplings'] || 0;
    const cookies = counts['Festive Cookies'] || 0;
    const snacks = counts['Traditional Snacks'] || 0;

    setProductCounts([
      { name: 'Traditional Dumplings', count: dumplings },
      { name: 'Festive Cookies', count: cookies },
      { name: 'Traditional Snacks', count: snacks },
    ]);

    calculateIngredients(dumplings, cookies, snacks);
  };

  const calculateIngredients = (dumplings: number, cookies: number, snacks: number) => {
    const estimatedIngredients: IngredientEstimate[] = [];

    if (dumplings > 0) {
      estimatedIngredients.push(
        { name: 'Flour', quantity: dumplings * 250, unit: 'g', checked: false },
        { name: 'Ground Meat', quantity: dumplings * 150, unit: 'g', checked: false },
        { name: 'Vegetables (chopped)', quantity: dumplings * 100, unit: 'g', checked: false },
        { name: 'Dumpling Wrappers', quantity: dumplings * 12, unit: 'pieces', checked: false },
      );
    }

    if (cookies > 0) {
      estimatedIngredients.push(
        { name: 'Butter', quantity: cookies * 200, unit: 'g', checked: false },
        { name: 'Sugar', quantity: cookies * 150, unit: 'g', checked: false },
        { name: 'Eggs', quantity: cookies * 2, unit: 'pieces', checked: false },
        { name: 'Flour (cookies)', quantity: cookies * 300, unit: 'g', checked: false },
      );
    }

    if (snacks > 0) {
      estimatedIngredients.push(
        { name: 'Mixed Nuts', quantity: snacks * 200, unit: 'g', checked: false },
        { name: 'Dried Fruits', quantity: snacks * 150, unit: 'g', checked: false },
        { name: 'Seeds', quantity: snacks * 150, unit: 'g', checked: false },
      );
    }

    setIngredients(estimatedIngredients);
  };

  const handleManualCalculate = () => {
    calculateIngredients(productCounts[0].count, productCounts[1].count, productCounts[2].count);
  };

  const updateProductCount = (index: number, value: string) => {
    const numValue = parseInt(value) || 0;
    setProductCounts(prev => prev.map((p, i) => i === index ? { ...p, count: numValue } : p));
  };

  const toggleIngredient = (index: number) => {
    setIngredients(prev => prev.map((ing, i) => i === index ? { ...ing, checked: !ing.checked } : ing));
  };

  const updateQuantity = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setIngredients(prev => prev.map((ing, i) => i === index ? { ...ing, quantity: numValue } : ing));
  };

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

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
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
                : 'Ingredients are automatically calculated from existing orders.'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Quantities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {productCounts.map((product, index) => (
              <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg">
                <Label className="text-base font-semibold">{product.name}</Label>
                <div className="flex items-center space-x-3">
                  {manualMode ? (
                    <Input type="number" value={product.count} onChange={(e) => updateProductCount(index, e.target.value)} className="w-32 h-12 text-lg text-center" min="0" />
                  ) : (
                    <div className="text-3xl font-bold text-orange-600">{product.count}</div>
                  )}
                  <span className="text-gray-600">units</span>
                </div>
              </div>
            ))}
            {manualMode && (
              <Button onClick={handleManualCalculate} size="lg" className="w-full brand-button">
                <Calculator className="w-5 h-5 mr-2" />
                Calculate Ingredients
              </Button>
            )}
          </CardContent>
        </Card>

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
                    <Edit className="w-4 h-4 text-gray-400" />
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
                  : 'Orders will automatically generate ingredient calculations.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
