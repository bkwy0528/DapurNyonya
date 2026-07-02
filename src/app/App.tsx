import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useState, useEffect } from 'react';
import { Toaster } from './components/ui/sonner';
import { CartProvider } from './context/CartContext';
import Header from './components/ui/header';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { ADMIN_EMAIL, getAdminProfile, getUserProfile, saveUserProfile, getProducts, seedDefaultProducts } from './utils/db';
import InstallAppPrompt from './components/pwa/InstallAppPrompt';
import LoadingSpinner from './components/ui/LoadingSpinner';

// Import Pages
import WelcomePage from './pages/WelcomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
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
import OrderConfirmationPage from './pages/customer/OrderConfirmationPage';
import StripePaymentPage from './pages/customer/StripePaymentPage';
import OrderReceiptPage from './pages/customer/OrderReceiptPage';
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
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let latestCall = 0;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const thisCall = ++latestCall;

      if (firebaseUser) {
        if (firebaseUser.email === ADMIN_EMAIL) {
          const profile = await getAdminProfile();
          if (thisCall !== latestCall) return;
          setUser({
            id: firebaseUser.uid,
            name: profile?.name || 'Admin',
            email: firebaseUser.email,
            phone: profile?.phone || '',
            role: 'admin',
            profilePicture: profile?.profilePicture,
          });
          const products = await getProducts();
          if (thisCall !== latestCall) return;
          if (products.length === 0) await seedDefaultProducts();
        } else {
          const profile = await getUserProfile(firebaseUser.uid);
          if (thisCall !== latestCall) return;
          if (profile) {
            setUser({ ...profile, id: firebaseUser.uid, role: 'customer' });
          } else if (firebaseUser.providerData.some(p => p.providerId === 'google.com')) {
            // First Google sign-in — auto-create a profile from Google account data
            const newProfile = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || '',
              email: firebaseUser.email || '',
              phone: '',
              role: 'customer' as const,
              profilePicture: firebaseUser.photoURL || undefined,
            };
            await saveUserProfile(firebaseUser.uid, newProfile);
            if (thisCall !== latestCall) return;
            setUser(newProfile);
          } else {
            setUser(null);
          }
        }
      } else {
        setUser(null);
      }
      if (thisCall === latestCall) setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleProfileUpdate = (updatedUser: User) => {
    setUser(updatedUser);
  };

  if (authLoading) return <LoadingSpinner />;

  return (
    <CartProvider>
      <BrowserRouter>
        <Header user={user} onLogout={handleLogout} />
        <div className="app-shell">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={user ? <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/customer/home'} replace /> : <WelcomePage />} />
            <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/customer/home'} replace /> : <LoginPage />} />
            <Route path="/register" element={user ? <Navigate to="/customer/home" replace /> : <RegisterPage onRegisterSuccess={(u) => setUser(u)} />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Customer Routes */}
            <Route
              path="/customer/*"
              element={
                user?.role === 'customer' ? (
                  <Routes>
                    <Route path="home" element={<CustomerHomePage user={user} />} />
                    <Route path="product/:productId" element={<ProductDetailPage user={user} />} />
                    <Route path="order/:productId" element={<ProductOrderPage user={user} />} />
                    <Route path="cart" element={<CartPage user={user} />} />
                    <Route path="checkout" element={<CheckoutPage user={user} />} />
                    <Route path="payment" element={<StripePaymentPage user={user} />} />
                    <Route path="order-confirmation" element={<OrderConfirmationPage />} />
                    <Route path="order-summary" element={<OrderSummaryPage user={user} />} />
                    <Route path="tracking" element={<CustomerOrderTrackingPage user={user} />} />
                    <Route path="receipt/:orderId" element={<OrderReceiptPage user={user} />} />
                    <Route path="profile" element={<ProfilePage user={user} onLogout={handleLogout} onProfileUpdate={handleProfileUpdate} />} />
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
                    <Route path="dashboard" element={<AdminDashboard user={user} />} />
                    <Route path="orders" element={<OrderManagementPage user={user} />} />
                    <Route path="schedule" element={<ProductionSchedulePage user={user} />} />
                    <Route path="ingredients" element={<IngredientEstimationPage user={user} />} />
                    <Route path="settings" element={<AdminSettingsPage user={user} />} />
                    <Route path="products" element={<ProductManagementPage user={user} />} />
                    <Route path="analytics" element={<AnalyticsDashboard user={user} />} />
                    <Route path="profile" element={<AdminProfilePage user={user} onLogout={handleLogout} onProfileUpdate={handleProfileUpdate} />} />
                  </Routes>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <InstallAppPrompt />
          <Toaster />
        </div>
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;
