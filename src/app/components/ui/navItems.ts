import {
  House,
  Package,
  UserCircle,
  ShoppingBag,
  Wheat,
  Calendar,
  Layers,
  BarChart,
  Settings,
  type LucideIcon,
} from 'lucide-react';

// Single source of truth for the app's navigation, shared by the desktop
// header and the mobile bottom bar so both always present the same grouping:
// the primary items are shown directly, everything else lives behind "More".

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const customerTabs: NavItem[] = [
  { to: '/customer/home', label: 'Home', icon: House },
  { to: '/customer/tracking', label: 'Orders', icon: Package },
  { to: '/customer/profile', label: 'Profile', icon: UserCircle },
];

// Only 4 fit comfortably in a thumb-reachable bar; the rest live behind "More".
export const adminPrimaryTabs: NavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: House },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/ingredients', label: 'Ingredients', icon: Wheat },
];

export const adminMoreItems: NavItem[] = [
  { to: '/admin/schedule', label: 'Schedule', icon: Calendar },
  { to: '/admin/production-calendar', label: 'Pre-Orders', icon: Layers },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/profile', label: 'Profile', icon: UserCircle },
];
