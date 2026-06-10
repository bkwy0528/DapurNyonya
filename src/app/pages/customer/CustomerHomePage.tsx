import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { User as UserIconLucide, Package } from 'lucide-react';
import { User as UserType } from '../../App';
import { getProducts, getSettings } from '../../utils/db';

interface CustomerHomePageProps {
  user: UserType;
}

export default function CustomerHomePage({ user }: CustomerHomePageProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [announcement, setAnnouncement] = useState({
    enabled: true,
    title: 'Festive Season Orders Open!',
    text: 'Place your orders now for the upcoming celebrations. Limited slots available!',
  });

  useEffect(() => {
    getProducts().then(all => setProducts(all.filter((p: any) => p.available)));
    getSettings().then(s => {
      if (!s) return;
      setAnnouncement({
        enabled: s.announcementEnabled !== false,
        title: s.announcementTitle || 'Festive Season Orders Open!',
        text: s.announcementText || 'Place your orders now for the upcoming celebrations. Limited slots available!',
      });
    });
  }, []);

  return (
    <div className="min-h-screen pb-12">
      <div className="brand-gradient text-white p-6 pb-8">
        <div className="page-hero__inner">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Link to="/customer/profile" className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center overflow-hidden cursor-pointer hover:bg-opacity-30 transition-all">
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

      {announcement.enabled && (
        <div className="max-w-4xl mx-auto px-6 -mt-4">
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{announcement.title}</h3>
                  <p className="text-sm text-gray-700">{announcement.text}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Available Products</h2>
          <p className="text-sm text-gray-600 mt-1">Use the top navigation for cart, orders, and profile access.</p>
        </div>

        <div className="grid gap-6">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="flex flex-col sm:flex-row">
                <div className="sm:w-48 h-48 sm:h-auto overflow-hidden flex-shrink-0">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">{product.name}</h3>
                      <p className="text-gray-600">{product.description}</p>
                    </div>
                    {product.available && (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 ml-3">Available</Badge>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 gap-3">
                    <div className="text-2xl font-bold text-orange-600">RM {product.price.toFixed(2)}</div>
                    <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                      <Link to={`/customer/product/${product.id}`} className="flex-1 sm:flex-none">
                        <Button className="w-full sm:w-auto brand-button">View Product</Button>
                      </Link>
                      <Link to={`/customer/order/${product.id}`} className="flex-1 sm:flex-none">
                        <Button className="w-full sm:w-auto success-button">Add to Cart</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
