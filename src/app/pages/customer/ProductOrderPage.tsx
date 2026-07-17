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
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { getProducts } from '../../utils/db';
import { onImageError } from '../../utils/imageFallback';
import { vibrate } from '../../utils/haptics';

interface ProductOrderPageProps {
  user: User | null;
}

export default function ProductOrderPage({ user }: ProductOrderPageProps) {
  const navigate = useNavigate();
  const { productId } = useParams();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const homeLink = user ? '/customer/home' : '/';

  useEffect(() => {
    if (productId) {
      getProducts().then(products => {
        setProduct(products.find((p: any) => p.id === productId) || null);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [productId]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Product not found</h2>
          <Link to={homeLink}><Button>Back to Home</Button></Link>
        </div>
      </div>
    );
  }

  const handleQuantityChange = (delta: number) => setQuantity(Math.max(1, quantity + delta));

  // Typing beats pressing "+" twenty times for a bulk order. The field may be
  // momentarily empty mid-edit (represented as 0); blur snaps it back to 1.
  const handleQuantityInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    setQuantity(digits === '' ? 0 : Math.min(999, parseInt(digits, 10)));
  };

  const totalPrice = product.price * quantity;

  const handleAddToCart = () => {
    addToCart({ productId: product.id, name: product.name, price: product.price, quantity: Math.max(1, quantity), image: product.image, unit: product.unit, prepDays: product.prepDays, notes });
    vibrate();
    toast.success('Added to cart!');
    navigate('/customer/cart');
  };

  return (
    <PageContainer>
      <div className="page-hero page-hero--rounded">
        <Link to={homeLink} className="page-back-link">
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span className="text-lg">Back to Products</span>
        </Link>
        <h1 className="text-2xl">Add to Cart</h1>
      </div>

      <div className="px-0 py-8 space-y-6">
        <Card className="overflow-hidden">
          <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
            <img src={product.image} alt={product.name} onError={onImageError} className="w-full h-full object-cover" />
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

            <FormSection>
              <Label htmlFor="notes" className="text-lg">Special Instructions (Optional)</Label>
              <Textarea id="notes" placeholder="Any special requests or dietary requirements?" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-32 text-base" />
            </FormSection>

            <div className="info-box">
              <p className="text-sm text-blue-900"><strong>Note:</strong> You can select your preferred pickup/delivery date during checkout.</p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold text-gray-900">Total Amount</span>
                <span className="text-3xl font-bold text-orange-600">RM {totalPrice.toFixed(2)}</span>
              </div>
              <Button size="lg" onClick={handleAddToCart} className="w-full text-lg success-button">
                <ShoppingCart className="w-5 h-5 mr-2" />Add to Cart
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
