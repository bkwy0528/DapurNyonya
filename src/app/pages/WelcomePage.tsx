import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { UtensilsCrossed } from 'lucide-react';
import { useStorefront } from '../hooks/useStorefront';
import AnnouncementBanner from '../components/AnnouncementBanner';
import ProductCard from '../components/ProductCard';
import BusinessAboutCard from '../components/BusinessAboutCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function WelcomePage() {
  const { products, loading, announcement, business } = useStorefront();

  return (
    <div className="min-h-screen pb-24">
      {/* Brand hero + auth actions */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-8 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-amber-500 rounded-3xl flex items-center justify-center shadow-lg">
            <UtensilsCrossed className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900">{business.name}</h1>
            <p className="text-xl text-gray-600 mt-2">Homemade Festive Delicacies</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8 max-w-md mx-auto">
          <Link to="/login" className="flex-1">
            <Button size="lg" className="w-full h-14 text-lg brand-button">Login</Button>
          </Link>
          <Link to="/register" className="flex-1">
            <Button size="lg" variant="outline" className="w-full h-14 text-lg brand-button--outline">Register</Button>
          </Link>
        </div>
      </div>

      <AnnouncementBanner announcement={announcement} className="max-w-4xl mx-auto px-4 sm:px-6" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Our Menu</h2>
          <p className="text-sm text-gray-600 mt-1">Browse freely — login or register when you're ready to order.</p>
        </div>

        {loading ? (
          <LoadingSpinner inline />
        ) : (
          <div className="grid gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                detailsTo={`/customer/product/${product.id}`}
                orderTo={product.batchTracked ? `/customer/batch-order/${product.id}` : `/customer/order/${product.id}`}
                orderLabel={product.batchTracked ? 'Pre-Order This' : 'Order This'}
              />
            ))}
          </div>
        )}

        <BusinessAboutCard business={business} />
      </div>
    </div>
  );
}
