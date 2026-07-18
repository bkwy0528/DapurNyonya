import { Link, useLocation } from 'react-router';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { customerTabs, adminPrimaryTabs, adminMoreItems, type NavItem } from './navItems';

function TabLink({ to, label, icon: Icon, active }: NavItem & { active: boolean }) {
  return (
    <Link to={to} className={`bottom-nav-link ${active ? 'bottom-nav-link--active' : ''}`}>
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </Link>
  );
}

export default function BottomNav({ role }: { role: 'customer' | 'admin' }) {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (path: string) => location.pathname === path;

  if (role === 'customer') {
    return (
      <nav className="bottom-nav" aria-label="Primary">
        {customerTabs.map((tab) => (
          <TabLink key={tab.to} {...tab} active={isActive(tab.to)} />
        ))}
      </nav>
    );
  }

  const isMoreActive = adminMoreItems.some((item) => isActive(item.to));

  return (
    <>
      <nav className="bottom-nav" aria-label="Primary">
        {adminPrimaryTabs.map((tab) => (
          <TabLink key={tab.to} {...tab} active={isActive(tab.to)} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`bottom-nav-link ${isMoreActive ? 'bottom-nav-link--active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span>More</span>
        </button>
      </nav>

      <DialogPrimitive.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed inset-x-0 bottom-0 z-[70] rounded-t-2xl border-t border-gray-200 bg-white p-4 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-200" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
            <DialogPrimitive.Title className="sr-only">More admin pages</DialogPrimitive.Title>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-gray-300" aria-hidden="true" />
            <div className="grid grid-cols-3 gap-2">
              {adminMoreItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                return (
                  <DialogPrimitive.Close asChild key={item.to}>
                    <Link
                      to={item.to}
                      className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-all active:scale-95 ${active ? 'bg-orange-100 text-orange-700' : 'text-gray-700 hover:bg-gray-100 active:bg-gray-100'}`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  </DialogPrimitive.Close>
                );
              })}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
