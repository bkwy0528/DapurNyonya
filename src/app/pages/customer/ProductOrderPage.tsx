import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { ArrowLeft, Minus, Plus, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../../App';
import { useCart } from '../../context/CartContext';
import PageContainer from '../../components/ui/PageContainer';
import FormSection from '../../components/ui/FormSection';
import { getProducts } from '../../utils/db';

interface ProductOrderPageProps {
  user: User;
}

export default function ProductOrderPage({ user: _user }: ProductOrderPageProps) {
  const navigate = useNavigate();
  const { productId } = useParams();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (productId) {
      getProducts().then(products => {
        setProduct(products.find((p: any) => p.id === productId) || null);
      });
    }
  }, [productId]);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleQuantityChange = (delta: number) => setQuantity(Math.max(1, quantity + delta));

  const totalPrice = product.price * quantity;

  const handleAddToCart = () => {
    addToCart({ productId: product.id, name: product.name, price: product.price, quantity, image: product.image, unit: product.unit, prepDays: product.prepDays, notes });
    toast.success('Added to cart!');
    navigate('/customer/cart');
  };

  return (
    <PageContainer>
      <div className="page-hero page-hero--rounded">
        <Link to="/customer/home" className="inline-flex items-center text-white hover:text-gray-100 mb-2">
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span className="text-lg">Back to Products</span>
        </Link>
        <h1 className="text-2xl">Add to Cart</h1>
      </div>

      <div className="px-0 py-8 space-y-6">
        <Card className="overflow-hidden">
          <div className="aspect-video w-full overflow-hidden">
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          </div>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">{product.name}</h2>
            <p className="text-gray-600 mb-4">{product.description}</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-orange-600">RM {product.price.toFixed(2)}</p>
                <p className="text-sm text-gray-500">per {product.unit}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-6">
            <FormSection>
              <Label className="text-lg">Quantity</Label>
              <div className="flex items-center space-x-4">
                <Button variant="outline" size="icon" onClick={() => handleQuantityChange(-1)} className="h-14 w-14 border-2"><Minus className="w-5 h-5" /></Button>
                <div className="flex-1 text-center">
                  <div className="text-4xl font-bold text-gray-900">{quantity}</div>
                  <div className="text-sm text-gray-500">{product.unit}</div>
                </div>
                <Button variant="outline" size="icon" onClick={() => handleQuantityChange(1)} className="h-14 w-14 border-2"><Plus className="w-5 h-5" /></Button>
              </div>
            </FormSection>

            <FormSection>
              <Label htmlFor="notes" className="text-lg">Special Instructions (Optional)</Label>
              <Textarea id="notes" placeholder="Any special requests or dietary requirements?" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-32 text-base" />
            </FormSection>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900"><strong>Note:</strong> You can select your preferred pickup/delivery date during checkout.</p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold text-gray-900">Total Amount</span>
                <span className="text-3xl font-bold text-orange-600">RM {totalPrice.toFixed(2)}</span>
              </div>
              <Button size="lg" onClick={handleAddToCart} className="w-full text-lg bg-gradient-to-r from-green-500 to-emerald-500">
                <ShoppingCart className="w-5 h-5 mr-2" />Add to Cart
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
