import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ShoppingCart, Calendar, User, TrendingUp, Clock } from 'lucide-react';
import { User as UserType } from '../../App';
import { getOrders, getAdminProfile } from '../../utils/db';
import { getStatusStyle } from '../../utils/statusStyles';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface AdminDashboardProps {
  user: UserType;
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [stats, setStats] = useState({
    totalOrdersToday: 0,
    pendingOrders: 0,
    upcomingProduction: 0,
    totalRevenue: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminProfilePicture, setAdminProfilePicture] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      const orders = await getOrders();
      const today = new Date().toDateString();

      const todayOrders = orders.filter((o: any) =>
        new Date(o.orderDate || o.createdAt || Date.now()).toDateString() === today
      );
      // Paid orders that still need to be prepared — approval no longer exists,
      // so "what's on my plate" replaces the old Pending Approval count.
      const inProgress = orders.filter((o: any) => ['Order Received', 'In Preparation'].includes(o.status));
      // Rejected/Cancelled orders need no production — excluded the same way
      // Production Schedule already excludes them, so the two counts agree.
      const upcoming = orders.filter((o: any) => {
        if (o.status === 'Rejected' || o.status === 'Cancelled') return false;
        if (!o.deliveryDate) return false;
        const daysUntil = Math.ceil((new Date(o.deliveryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysUntil <= 7 && daysUntil >= 0;
      });
      // Revenue counts approved orders only — pending, rejected and cancelled
      // orders haven't earned anything (same rule as the analytics page)
      const revenue = orders
        .filter((o: any) => !['Rejected', 'Cancelled', 'Pending Approval'].includes(o.status))
        .reduce((sum: number, o: any) => sum + (typeof o.total === 'number' ? o.total : 0), 0);

      setStats({
        totalOrdersToday: todayOrders.length,
        pendingOrders: inProgress.length,
        upcomingProduction: upcoming.length,
        totalRevenue: revenue,
      });

      const recent = [...orders]
        .sort((a: any, b: any) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
        .slice(0, 6);
      setRecentOrders(recent);

      const profile = await getAdminProfile();
      if (profile?.profilePicture) setAdminProfilePicture(profile.profilePicture);
    };
    load().finally(() => setLoading(false));
  }, []);

  const statCards = [
    { title: 'Orders Today', value: stats.totalOrdersToday, icon: ShoppingCart, bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
    { title: 'To Prepare', value: stats.pendingOrders, icon: Clock, bgColor: 'bg-yellow-50', textColor: 'text-yellow-600' },
    { title: 'Upcoming (7 days)', value: stats.upcomingProduction, icon: Calendar, bgColor: 'bg-orange-50', textColor: 'text-orange-600' },
    { title: 'Total Revenue', value: `RM ${stats.totalRevenue.toFixed(2)}`, icon: TrendingUp, bgColor: 'bg-green-50', textColor: 'text-green-600' },
  ];

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="page-hero pb-8">
        <div className="page-hero__inner page-hero__inner--wide">
          <div className="flex items-center space-x-4 mb-2">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center overflow-hidden">
              {adminProfilePicture ? (
                <img src={adminProfilePicture} alt="Admin" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-white" />
              )}
            </div>
            <div>
              <p className="text-sm opacity-80">Admin Dashboard</p>
              <p className="text-xl">{user.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className={`${card.bgColor} border-0`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`w-6 h-6 ${card.textColor}`} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-sm text-gray-600 mt-1">{card.title}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Orders */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
            <Link to="/admin/orders">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">No orders yet</CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {order.finalizedNumber || `Order #${order.id.slice(-6)}`}
                      </p>
                      <p className="text-sm text-gray-500">{order.customerName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-orange-600">RM {(order.total || 0).toFixed(2)}</span>
                      <Badge className={getStatusStyle(order.status)}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
