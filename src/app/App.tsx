import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useState, useEffect } from 'react';
import { Toaster } from './components/ui/sonner';
import { CartProvider } from './context/CartContext';

// Import Pages
import WelcomePage from './pages/WelcomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CustomerHomePage from './pages/customer/CustomerHomePage';
import ProductDetailPage from './pages/customer/ProductDetailPage';
import ProductOrderPage from './pages/customer/ProductOrderPage';
import OrderSummaryPage from './pages/customer/OrderSummaryPage';
import CustomerOrderTrackingPage from './pages/customer/CustomerOrderTrackingPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import OrderManagementPage from './pages/admin/OrderManagementPage';
import ProductionSchedulePage from './pages/admin/ProductionSchedulePage';
import IngredientEstimationPage from './pages/admin/IngredientEstimationPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import ProductManagementPage from './pages/admin/ProductManagementPage';
import AdminProfilePage from './pages/admin/AdminProfilePage';
import CartPage from './pages/customer/CartPage';
import CheckoutPage from './pages/customer/CheckoutPage';
import AnalyticsDashboard from './pages/admin/AnalyticsDashboard';

export interface User {
  id: string;
  name: string;
  email?: string;
  phone: string;
  role: 'customer' | 'admin';
  profilePicture?: string;
  address?: string;
  notes?: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);

  // Initialize default products on app load
  useEffect(() => {
    const storedProducts = localStorage.getItem('products');
    if (!storedProducts) {
      const defaultProducts = [
        {
          id: '1',
          name: 'Traditional Dumplings',
          description: 'Handmade with premium ingredients, perfect for festive celebrations',
          price: 25.00,
          image: 'https://images.unsplash.com/photo-1766309416197-5982d32f4ce0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkdW1wbGluZ3MlMjBmb29kJTIwZmVzdGl2ZXxlbnwxfHx8fDE3NjY3NDIxMTF8MA&ixlib=rb-4.1.0&q=80&w=1080',
          unit: 'pack (12 pieces)',
          available: true
        },
        {
          id: '2',
          name: 'Festive Cookies',
          description: 'Assorted cookies with traditional flavors and decorations',
          price: 18.00,
          image: 'https://images.unsplash.com/photo-1627373369962-42fd4fde6504?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb29raWVzJTIwZmVzdGl2ZSUyMHNuYWNrc3xlbnwxfHx8fDE3NjY3NDIxMTJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
          unit: 'box (20 cookies)',
          available: true
        },
        {
          id: '3',
          name: 'Traditional Snacks',
          description: 'Mix of authentic handmade snacks for every occasion',
          price: 22.00,
          image: 'https://images.unsplash.com/photo-1680345576132-9dc2b41636c3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmFkaXRpb25hbCUyMHNuYWNrcyUyMGZvb2R8ZW58MXx8fHwxNzY2NzQyMTEyfDA&ixlib=rb-4.1.0&q=80&w=1080',
          unit: 'pack (500g)',
          available: true
        }
      ];
      localStorage.setItem('products', JSON.stringify(defaultProducts));
    }
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <CartProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<WelcomePage />} />
            <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
            <Route path="/register" element={<RegisterPage onRegister={handleLogin} />} />

            {/* Customer Routes */}
            <Route
              path="/customer/*"
              element={
                user?.role === 'customer' ? (
                  <Routes>
                    <Route path="home" element={<CustomerHomePage user={user} onLogout={handleLogout} />} />
                    <Route path="product/:productId" element={<ProductDetailPage user={user} />} />
                    <Route path="order/:productId" element={<ProductOrderPage user={user} />} />
                    <Route path="cart" element={<CartPage user={user} />} />
                    <Route path="checkout" element={<CheckoutPage user={user} />} />
                    <Route path="order-summary" element={<OrderSummaryPage user={user} />} />
                    <Route path="tracking" element={<CustomerOrderTrackingPage user={user} />} />
                    <Route path="profile" element={<ProfilePage user={user} onLogout={handleLogout} />} />
                  </Routes>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin/*"
              element={
                user?.role === 'admin' ? (
                  <Routes>
                    <Route path="dashboard" element={<AdminDashboard user={user} onLogout={handleLogout} />} />
                    <Route path="orders" element={<OrderManagementPage user={user} />} />
                    <Route path="schedule" element={<ProductionSchedulePage user={user} />} />
                    <Route path="ingredients" element={<IngredientEstimationPage user={user} />} />
                    <Route path="settings" element={<AdminSettingsPage user={user} />} />
                    <Route path="products" element={<ProductManagementPage user={user} />} />
                    <Route path="analytics" element={<AnalyticsDashboard user={user} />} />
                    <Route path="profile" element={<AdminProfilePage user={user} onLogout={handleLogout} />} />
                  </Routes>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </div>
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;