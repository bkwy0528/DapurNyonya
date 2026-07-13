import { Link } from 'react-router';
import { User as UserIconLucide } from 'lucide-react';
import { User as UserType } from '../../App';
import { useStorefront } from '../../hooks/useStorefront';
import AnnouncementBanner from '../../components/AnnouncementBanner';
import ProductCard from '../../components/ProductCard';
import BusinessAboutCard from '../../components/BusinessAboutCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface CustomerHomePageProps {
  user: UserType;
}

export default function CustomerHomePage({ user }: CustomerHomePageProps) {
  const { products, loading, announcement, business } = useStorefront();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="page-hero pb-8">
        <div className="page-hero__inner">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Link to="/customer/profile" className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center overflow-hidden cursor-pointer hover:bg-white/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80">
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
          <p className="text-sm text-gray-600 mt-1">Use the top navigation for cart, orders, and profile access.</p>
        </div>

        <div className="grid gap-6">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              detailsTo={`/customer/product/${product.id}`}
              orderTo={`/customer/order/${product.id}`}
            />
          ))}
        </div>

        <BusinessAboutCard business={business} />
      </div>
    </div>
  );
}
