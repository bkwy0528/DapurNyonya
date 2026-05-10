import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { User as UserIconLucide, LogOut, ShoppingCart, Package, UserCircle } from 'lucide-react';
import { User as UserType } from '../../App';
import { useCart } from '../../context/CartContext';
import { useState, useEffect } from 'react';

interface CustomerHomePageProps {
  user: UserType;
  onLogout: () => void;
}

export default function CustomerHomePage({ user, onLogout }: CustomerHomePageProps) {
  const { getCartCount } = useCart();
  const cartCount = getCartCount();
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = () => {
    const storedProducts = localStorage.getItem('products');
    if (storedProducts) {
      setProducts(JSON.parse(storedProducts).filter((p: any) => p.available));
    }
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-6 pb-8">
        <div className="max-w-4xl mx-auto">
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="max-w-4xl mx-auto px-6 -mt-4">
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Festive Season Orders Open!</h3>
                <p className="text-sm text-gray-700">Place your orders now for the upcoming celebrations. Limited slots available!</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Section */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Available Products</h2>
          <div className="flex space-x-3">
            <Link to="/customer/cart">
              <Button variant="outline" className="border-2 relative">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Cart
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link to="/customer/tracking">
              <Button variant="outline" className="border-2">
                <Package className="w-5 h-5 mr-2" />
                Orders
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-6">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="flex flex-col sm:flex-row">
                <div className="sm:w-48 h-48 sm:h-auto overflow-hidden flex-shrink-0">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
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
                        <Button className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
                          View Product
                        </Button>
                      </Link>
                      <Link to={`/customer/order/${product.id}`} className="flex-1 sm:flex-none">
                        <Button className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600">
                          Add to Cart
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-around">
            <Link to="/customer/home" className="flex flex-col items-center space-y-1 text-orange-600">
              <Package className="w-6 h-6" />
              <span className="text-xs">Home</span>
            </Link>
            <Link to="/customer/cart" className="flex flex-col items-center space-y-1 text-gray-600 hover:text-orange-600 relative">
              <ShoppingCart className="w-6 h-6" />
              <span className="text-xs">Cart</span>
              {cartCount > 0 && (
                <span className="absolute -top-1 left-1/2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
            <Link to="/customer/tracking" className="flex flex-col items-center space-y-1 text-gray-600 hover:text-orange-600">
              <Package className="w-6 h-6" />
              <span className="text-xs">Orders</span>
            </Link>
            <Link to="/customer/profile" className="flex flex-col items-center space-y-1 text-gray-600 hover:text-orange-600">
              <UserCircle className="w-6 h-6" />
              <span className="text-xs">Profile</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}