import { Link, useLocation } from 'react-router';
import { Button } from './button';
import { ShoppingCart, User, Menu, Package, BarChart, Calendar, Settings, House, ShoppingBag, UserCircle, Wheat } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useState } from 'react';

export default function Header({ user, onLogout }: { user: any; onLogout?: () => void }) {
  const { getCartCount } = useCart();
  const cartCount = getCartCount();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const customerNavItems = [
    { to: '/customer/home', label: 'Home', icon: House },
    { to: '/customer/tracking', label: 'Orders', icon: Package },
    { to: '/customer/profile', label: 'Profile', icon: UserCircle },
  ];

  const adminNavItems = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: House },
    { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
    { to: '/admin/products', label: 'Products', icon: Package },
    { to: '/admin/schedule', label: 'Schedule', icon: Calendar },
    { to: '/admin/ingredients', label: 'Ingredients', icon: Wheat },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
    { to: '/admin/profile', label: 'Profile', icon: UserCircle },
  ];

  const navItems = user?.role === 'customer' ? customerNavItems : user?.role === 'admin' ? adminNavItems : [];
  const homeLink = user?.role === 'admin' ? '/admin/dashboard' : user?.role === 'customer' ? '/customer/home' : '/';

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__bar">
          <div className="flex items-center space-x-3">
            <Link to={homeLink} className="brand-link">
              <div className="brand-mark">DN</div>
              <span className="brand-name">DapurNyonya</span>
            </Link>
          </div>

          <nav className="app-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`app-nav-link ${isActive(item.to) ? 'app-nav-link--active' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {!user && (
              <>
                <Link to="/login" className={`app-nav-link ${isActive('/login') ? 'app-nav-link--active' : ''}`}>Login</Link>
                <Link to="/register" className={`app-nav-link ${isActive('/register') ? 'app-nav-link--active' : ''}`}>Register</Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {user?.role === 'customer' && (
              <Link to="/customer/cart" aria-label="Cart" className="header-icon-button relative">
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="cart-badge">{cartCount}</span>
                )}
              </Link>
            )}

            {user ? (
              <Button variant="ghost" size="sm" onClick={onLogout} className="hidden sm:inline-flex text-gray-700">Logout</Button>
            ) : (
              <Link to="/login" className="app-nav-link hidden sm:inline-flex">Sign in</Link>
            )}

            <button aria-label="Menu" onClick={() => setOpen(!open)} className="header-icon-button md:hidden">
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {open && (
          <div className="mobile-menu-wrap">
            <div className="mobile-menu-panel">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={`mobile-nav-link ${isActive(item.to) ? 'mobile-nav-link--active' : ''}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              {!user && (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="mobile-nav-link">Login</Link>
                  <Link to="/register" onClick={() => setOpen(false)} className="mobile-nav-link">Register</Link>
                </>
              )}
              {user && (
                <button onClick={() => { setOpen(false); onLogout?.(); }} className="mobile-nav-link text-left">
                  Logout
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
