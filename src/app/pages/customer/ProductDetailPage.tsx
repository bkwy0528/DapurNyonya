import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { User } from '../../App';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { getProducts } from '../../utils/db';
import { onImageError } from '../../utils/imageFallback';

interface ProductDetailPageProps {
  user: User | null;
}

export default function ProductDetailPage({ user }: ProductDetailPageProps) {
  const { productId } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const homeLink = user ? '/customer/home' : '/';

  useEffect(() => {
    getProducts().then(products => {
      setProduct(products.find((p: any) => p.id === productId) || null);
      setLoading(false);
    });
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

  return (
    <div className="min-h-screen pb-24">
      <div className="page-hero">
        <div className="page-hero__inner">
          <Link to={homeLink} className="page-back-link">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back to Products</span>
          </Link>
          <h1 className="text-2xl">Product Details</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Card className="overflow-hidden">
          <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
            <img src={product.image} alt={product.name} onError={onImageError} className="w-full h-full object-cover" />
          </div>

          <CardContent className="p-6 space-y-6">
            <div>
              <div className="flex flex-col sm:flex-row items-start justify-between mb-3 gap-3">
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">{product.name}</h2>
                {product.available && (
                  <Badge className="status-badge--available">{product.batchTracked ? 'Pre-Order' : 'Made to Order'}</Badge>
                )}
              </div>
              <p className="text-gray-600 text-base sm:text-lg leading-relaxed">{product.description}</p>
            </div>

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

            <div className="border-t border-gray-200 pt-6 space-y-4">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Product Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Unit Size</p>
                  <p className="font-semibold text-gray-900">{product.unit}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Availability</p>
                  <p className="font-semibold text-gray-900">{product.available ? (product.batchTracked ? 'Pre-Order' : 'Made to Order') : 'Currently Unavailable'}</p>
                </div>
              </div>
            </div>

            <div className="info-box">
              <h4 className="font-semibold text-blue-900 mb-2">Order Information</h4>
              {product.batchTracked ? (
                // Batch products are governed by production dates, not prepDays
                // advance notice — the generic copy below would be misleading.
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>- Only made once enough customers pre-order for a production date</li>
                  <li>- No payment now — you pay only after the minimum is reached</li>
                  <li>- Pickup or delivery available</li>
                </ul>
              ) : (
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>- Minimum {product.prepDays || 3} days advance notice required</li>
                  <li>- Made fresh to order</li>
                  <li>- Pickup or delivery available</li>
                </ul>
              )}
            </div>

            {product.available && (
              <Link to={product.batchTracked ? `/customer/batch-order/${product.id}` : `/customer/order/${product.id}`} className="block">
                <Button size="lg" className="w-full h-14 text-lg brand-button">
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {product.batchTracked ? 'Pre-Order This Item' : 'Order This Item'}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
