import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Button } from './button';
import { ShoppingCart, ChevronDown } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import NotificationBell from '../NotificationBell';
import { customerTabs, adminPrimaryTabs, adminMoreItems } from './navItems';

export default function Header({ user, onLogout }: { user: any; onLogout?: () => void }) {
  const { getCartCount } = useCart();
  const cartCount = getCartCount();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;

  // The desktop header mirrors the mobile bottom bar: the same primary items
  // inline, everything else behind "More" — so the admin's nav never sprawls.
  const navItems = user?.role === 'customer' ? customerTabs : user?.role === 'admin' ? adminPrimaryTabs : [];
  const moreItems = user?.role === 'admin' ? adminMoreItems : [];
  const isMoreActive = moreItems.some((item) => isActive(item.to));
  const homeLink = user?.role === 'admin' ? '/admin/dashboard' : user?.role === 'customer' ? '/customer/home' : '/';

  // Close the More dropdown on outside click / Escape, like a native menu.
  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [moreOpen]);

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__bar">
          <div className="flex items-center space-x-3">
            <Link to={homeLink} className="brand-link">
              <div className="brand-mark">
                <img src="/pwa/header-512.png" alt="DapurNyonya" className="rounded-md" />
              </div>
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
            {moreItems.length > 0 && (
              <div ref={moreRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMoreOpen(!moreOpen)}
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  className={`app-nav-link ${isMoreActive ? 'app-nav-link--active' : ''}`}
                >
                  <span>More</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                </button>
                {moreOpen && (
                  <div className="absolute right-0 top-12 z-50 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                    {moreItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMoreOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-orange-50 hover:text-orange-700 ${isActive(item.to) ? 'bg-orange-50 font-semibold text-orange-700' : 'text-gray-700'}`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {!user && (
              <>
                <Link to="/login" className={`app-nav-link ${isActive('/login') ? 'app-nav-link--active' : ''}`}>Login</Link>
                <Link to="/register" className={`app-nav-link ${isActive('/register') ? 'app-nav-link--active' : ''}`}>Register</Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {user && <NotificationBell userId={user.id} role={user.role} />}
            {(!user || user.role === 'customer') && (
              <Link to="/customer/cart" aria-label="Cart" className="header-icon-button relative">
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  // key remounts the badge when the count changes so the
                  // badge-pop animation replays
                  <span key={cartCount} className="cart-badge">{cartCount}</span>
                )}
              </Link>
            )}

            {user ? (
              // Mobile has no header logout control — it lives on the Profile
              // page instead, which the bottom nav always keeps one tap away.
              <Button variant="ghost" size="sm" onClick={onLogout} className="hidden sm:inline-flex text-gray-700">Logout</Button>
            ) : (
              // Guests have no bottom nav (it only renders once logged in),
              // so unlike Logout this stays visible at every width.
              <Link to="/login" className="app-nav-link">Sign in</Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
