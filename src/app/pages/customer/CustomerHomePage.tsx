import { Link } from 'react-router';
import { User as UserIconLucide } from 'lucide-react';
import { User as UserType } from '../../App';
import { useStorefront } from '../../hooks/useStorefront';
import AnnouncementBanner from '../../components/AnnouncementBanner';
import ProductCard from '../../components/ProductCard';
import BusinessAboutCard from '../../components/BusinessAboutCard';
import { ProductListSkeleton } from '../../components/ProductCardSkeleton';
import Reveal from '../../components/Reveal';
import PullToRefreshIndicator from '../../components/PullToRefreshIndicator';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

interface CustomerHomePageProps {
  user: UserType;
}

export default function CustomerHomePage({ user }: CustomerHomePageProps) {
  const { products, loading, announcement, business, refetch } = useStorefront();
  const { pullDistance, refreshing } = usePullToRefresh(refetch);

  return (
    <div className="min-h-screen pb-24">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="page-hero pb-8">
        <div className="page-hero__inner">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Link to="/customer/profile" className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center overflow-hidden cursor-pointer hover:bg-white/30 active:bg-white/30 active:scale-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80">
                {user.profilePicture ? (
                  <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UserIconLucide className="w-6 h-6" />
                )}
              </Link>
              <div>
                <p className="text-sm opacity-90">Welcome back,</p>
                <p className="text-xl">{user.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnnouncementBanner announcement={announcement} className="max-w-4xl mx-auto px-4 sm:px-6 -mt-4" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Available Products</h2>
          <p className="text-sm text-gray-600 mt-1">Cart, orders, and profile are just a tap away.</p>
        </div>

        {loading ? (
          <ProductListSkeleton />
        ) : (
          <div className="grid gap-6">
            {products.map((product, index) => (
              <Reveal key={product.id} delayMs={Math.min(index, 8) * 60}>
                <ProductCard
                  product={product}
                  detailsTo={`/customer/product/${product.id}`}
                  orderTo={product.batchTracked ? `/customer/batch-order/${product.id}` : `/customer/order/${product.id}`}
                  orderLabel={product.batchTracked ? 'Pre-Order This' : 'Order This'}
                />
              </Reveal>
            ))}
          </div>
        )}

        <BusinessAboutCard business={business} />
      </div>
    </div>
  );
}
