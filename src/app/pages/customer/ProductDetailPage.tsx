import { useParams, Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, ShoppingCart, Package } from 'lucide-react';
import { User } from '../../App';
import { useCart } from '../../context/CartContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';

interface ProductDetailPageProps {
  user: User;
}

export default function ProductDetailPage({ user }: ProductDetailPageProps) {
  const { productId } = useParams();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  
  // Load products from localStorage
  const storedProducts = JSON.parse(localStorage.getItem('products') || '[]');
  const product = storedProducts.find((p: any) => p.id === productId);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Product not found</h2>
          <Link to="/customer/home">
            <Button>Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <Link to="/customer/home" className="inline-flex items-center text-white hover:text-gray-100 mb-4">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back to Products</span>
          </Link>
          <h1 className="text-2xl">Product Details</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <Card className="overflow-hidden">
          {/* Product Image */}
          <div className="aspect-video w-full overflow-hidden bg-gray-100">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Product Info */}
            <div>
              <div className="flex flex-col sm:flex-row items-start justify-between mb-3 gap-3">
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">{product.name}</h2>
                {product.available && (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Available</Badge>
                )}
              </div>
              <p className="text-gray-600 text-base sm:text-lg leading-relaxed">{product.description}</p>
            </div>

            {/* Price */}
            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-baseline justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Price</p>
                  <p className="text-3xl sm:text-4xl font-bold text-orange-600">RM {product.price.toFixed(2)}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-sm text-gray-600">per {product.unit}</p>
                </div>
              </div>
            </div>

            {/* Product Details */}
            <div className="border-t border-gray-200 pt-6 space-y-4">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Product Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Unit Size</p>
                  <p className="font-semibold text-gray-900">{product.unit}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Availability</p>
                  <p className="font-semibold text-gray-900">
                    {product.available ? 'In Stock' : 'Out of Stock'}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Order Information</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Minimum 3-5 days advance notice required</li>
                <li>• Made fresh to order</li>
                <li>• Pickup or delivery available</li>
              </ul>
            </div>

            {/* Action Buttons */}
            {product.available && (
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  onClick={() => {
                    addToCart({
                      productId: product.id,
                      name: product.name,
                      price: product.price,
                      quantity: 1,
                      image: product.image,
                      unit: product.unit,
                    });
                    toast.success('Added to cart!');
                  }}
                  className="flex-1 h-14 text-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Add to Cart
                </Button>
                <Link to={`/customer/order/${product.id}`} className="flex-1">
                  <Button
                    size="lg"
                    className="w-full h-14 text-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  >
                    <Package className="w-5 h-5 mr-2" />
                    Place Order
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}