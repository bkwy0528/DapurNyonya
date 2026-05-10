import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ShoppingCart, Calendar, Package, Settings, LogOut, User, TrendingUp, Clock, UtensilsCrossed, BarChart } from 'lucide-react';
import { User as UserType } from '../../App';

interface AdminDashboardProps {
  user: UserType;
  onLogout: () => void;
}

export default function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  const [stats, setStats] = useState({
    totalOrdersToday: 0,
    pendingOrders: 0,
    upcomingProduction: 0,
    totalRevenue: 0
  });
  const [adminProfilePicture, setAdminProfilePicture] = useState<string>('');

  useEffect(() => {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const today = new Date().toDateString();
    
    const todayOrders = orders.filter((order: any) => 
      new Date(order.orderDate || order.createdAt || Date.now()).toDateString() === today
    );
    const pending = orders.filter((order: any) => 
      order.status === 'Pending Approval' || (order.status !== 'Delivered' && order.status !== 'Ready for Pickup' && order.status !== 'Rejected')
    );
    const upcoming = orders.filter((order: any) => {
      if (!order.deliveryDate) return false;
      const deliveryDate = new Date(order.deliveryDate);
      const daysUntil = Math.ceil((deliveryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntil <= 7 && daysUntil >= 0;
    });
    
    const revenue = orders
      .filter((order: any) => order.status !== 'Rejected')
      .reduce((sum: number, order: any) => {
        const orderTotal = order.total || 0;
        return sum + (typeof orderTotal === 'number' ? orderTotal : 0);
      }, 0);

    setStats({
      totalOrdersToday: todayOrders.length,
      pendingOrders: pending.length,
      upcomingProduction: upcoming.length,
      totalRevenue: revenue || 0
    });

    // Load admin profile picture
    const adminProfile = localStorage.getItem('adminProfile');
    if (adminProfile) {
      const profile = JSON.parse(adminProfile);
      setAdminProfilePicture(profile.profilePicture || '');
    }
  }, []);

  const statCards = [
    {
      title: 'Orders Today',
      value: stats.totalOrdersToday,
      icon: ShoppingCart,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      title: 'Pending Orders',
      value: stats.pendingOrders,
      icon: Clock,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600'
    },
    {
      title: 'Upcoming Production',
      value: stats.upcomingProduction,
      icon: Package,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600'
    },
    {
      title: 'Total Revenue',
      value: `RM ${stats.totalRevenue.toFixed(2)}`,
      icon: TrendingUp,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600'
    }
  ];

  const quickActions = [
    {
      title: 'View Orders',
      description: 'Manage all customer orders',
      icon: ShoppingCart,
      link: '/admin/orders',
      color: 'from-blue-500 to-blue-600'
    },
    {
      title: 'Analytics & Reports',
      description: 'View business insights and charts',
      icon: BarChart,
      link: '/admin/analytics',
      color: 'from-teal-500 to-cyan-500'
    },
    {
      title: 'Manage Products',
      description: 'Add, edit, and manage products',
      icon: UtensilsCrossed,
      link: '/admin/products',
      color: 'from-pink-500 to-rose-500'
    },
    {
      title: 'Production Schedule',
      description: 'Plan your production timeline',
      icon: Calendar,
      link: '/admin/schedule',
      color: 'from-orange-500 to-amber-500'
    },
    {
      title: 'Ingredient Planning',
      description: 'Calculate ingredient needs',
      icon: Package,
      link: '/admin/ingredients',
      color: 'from-green-500 to-emerald-500'
    },
    {
      title: 'Settings',
      description: 'Manage business settings',
      icon: Settings,
      link: '/admin/settings',
      color: 'from-purple-500 to-pink-500'
    }
  ];

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-6 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Link to="/admin/profile" className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center overflow-hidden cursor-pointer hover:bg-opacity-30 transition-all">
                {adminProfilePicture ? (
                  <img src={adminProfilePicture} alt="Admin Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6" />
                )}
              </Link>
              <div>
                <p className="text-sm opacity-90">Admin Dashboard</p>
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

      {/* Stats Cards */}
      <div className="max-w-6xl mx-auto px-6 -mt-4 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="overflow-hidden shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-full ${stat.bgColor} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${stat.textColor}`} />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link key={index} to={action.link}>
                <Card className="h-full hover:shadow-xl transition-all cursor-pointer border-2 hover:border-orange-300">
                  <CardHeader>
                    <div className="flex items-center space-x-4">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-xl">{action.title}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-around">
            <Link to="/admin/dashboard" className="flex flex-col items-center space-y-1 text-orange-600">
              <User className="w-6 h-6" />
              <span className="text-xs">Dashboard</span>
            </Link>
            <Link to="/admin/orders" className="flex flex-col items-center space-y-1 text-gray-600 hover:text-orange-600">
              <ShoppingCart className="w-6 h-6" />
              <span className="text-xs">Orders</span>
            </Link>
            <Link to="/admin/analytics" className="flex flex-col items-center space-y-1 text-gray-600 hover:text-orange-600">
              <BarChart className="w-6 h-6" />
              <span className="text-xs">Analytics</span>
            </Link>
            <Link to="/admin/schedule" className="flex flex-col items-center space-y-1 text-gray-600 hover:text-orange-600">
              <Calendar className="w-6 h-6" />
              <span className="text-xs">Schedule</span>
            </Link>
            <Link to="/admin/settings" className="flex flex-col items-center space-y-1 text-gray-600 hover:text-orange-600">
              <Settings className="w-6 h-6" />
              <span className="text-xs">Settings</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}