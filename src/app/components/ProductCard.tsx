import { Link } from 'react-router';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { onImageError } from '../utils/imageFallback';

interface ProductCardProps {
  product: any;
  orderTo: string;
  orderLabel?: string;
  // When omitted (guest view), the View Details button is hidden — the
  // detail page lives under the logged-in /customer/* routes.
  detailsTo?: string;
}

export default function ProductCard({ product, orderTo, orderLabel = 'Order This', detailsTo }: ProductCardProps) {
  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
      <div className="flex flex-col sm:flex-row">
        <div className="w-full sm:w-64 aspect-[4/3] sm:self-start overflow-hidden flex-shrink-0 bg-gray-100">
          <img src={product.image} alt={product.name} onError={onImageError} loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        </div>
        <div className="flex-1 p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{product.name}</h3>
              <p className="text-gray-600">{product.description}</p>
            </div>
            {product.available && (
              // "Pre-Order" is reserved for batch products (matches their
              // "Pre-Order This" button); everything else is made to order.
              <Badge className="status-badge--available ml-3">{product.batchTracked ? 'Pre-Order' : 'Made to Order'}</Badge>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 gap-3">
            <div className="text-2xl font-bold text-orange-600">RM {product.price.toFixed(2)}</div>
            <div className="flex flex-wrap gap-3 w-full sm:w-auto">
              {detailsTo && (
                <Link to={detailsTo} className="flex-1 sm:flex-none">
                  <Button variant="outline" className="w-full sm:w-auto border-2">View Details</Button>
                </Link>
              )}
              <Link to={orderTo} className="flex-1 sm:flex-none">
                <Button className="w-full sm:w-auto brand-button">{orderLabel}</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
