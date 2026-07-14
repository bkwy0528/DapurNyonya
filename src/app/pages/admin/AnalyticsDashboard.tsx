import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ArrowLeft, TrendingUp, DollarSign, ShoppingBag, Users, Calendar } from 'lucide-react';
import { User } from '../../App';
import { getOrders } from '../../utils/db';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface AnalyticsDashboardProps {
  user: User;
}

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  monthlyRevenue: Array<{ month: string; revenue: number }>;
  productSales: Array<{ name: string; sales: number; revenue: number }>;
  statusBreakdown: Array<{ name: string; value: number }>;
  recentRevenue: number;
  growthRate: number;
}

const COLORS = ['#f97316', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AnalyticsDashboard({ user: _user }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalRevenue: 0,
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    monthlyRevenue: [],
    productSales: [],
    statusBreakdown: [],
    recentRevenue: 0,
    growthRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateAnalytics().finally(() => setLoading(false));
  }, []);

  const calculateAnalytics = async () => {
    const orders = await getOrders();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // One revenue rule everywhere: only approved orders count — pending,
    // rejected and cancelled orders haven't earned anything
    const isRevenueOrder = (o: any) => !['Rejected', 'Cancelled', 'Pending Approval'].includes(o.status);
    const revenueOrders = orders.filter(isRevenueOrder);

    const totalRevenue = revenueOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const totalOrders = orders.length;
    // Approval no longer exists (orders arrive paid) — count orders still being
    // worked on instead.
    const pendingOrders = orders.filter((o: any) => ['Order Received', 'In Preparation'].includes(o.status)).length;
    const completedOrders = orders.filter((o: any) => o.status === 'Delivered').length;

    // Keyed by sortable "YYYY-MM" so months chart in chronological order
    const monthlyData: { [key: string]: number } = {};
    revenueOrders.forEach((order: any) => {
      if (order.orderDate) {
        const date = new Date(order.orderDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (order.total || 0);
      }
    });
    const monthlyRevenue = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, revenue]) => {
        const [year, month] = key.split('-');
        return { month: `${monthNames[Number(month) - 1]} ${year}`, revenue };
      });

    const productSalesMap: { [key: string]: { sales: number; revenue: number } } = {};
    revenueOrders.forEach((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          if (!productSalesMap[item.name]) productSalesMap[item.name] = { sales: 0, revenue: 0 };
          productSalesMap[item.name].sales += item.quantity;
          productSalesMap[item.name].revenue += item.price * item.quantity;
        });
      }
    });
    const productSales = Object.entries(productSalesMap)
      .map(([name, data]) => ({ name, sales: data.sales, revenue: data.revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    const statusMap: { [key: string]: number } = {};
    orders.forEach((order: any) => { statusMap[order.status] = (statusMap[order.status] || 0) + 1; });
    const statusBreakdown = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRevenue = revenueOrders
      .filter((o: any) => new Date(o.orderDate) >= thirtyDaysAgo)
      .reduce((sum: number, o: any) => sum + (o.total || 0), 0);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const previousRevenue = revenueOrders
      .filter((o: any) => {
        const d = new Date(o.orderDate);
        return d >= sixtyDaysAgo && d < thirtyDaysAgo;
      })
      .reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const growthRate = previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    setAnalytics({ totalRevenue, totalOrders, pendingOrders, completedOrders, monthlyRevenue, productSales, statusBreakdown, recentRevenue, growthRate });
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="page-hero">
        <div className="page-hero__inner page-hero__inner--wide">
          <Link to="/admin/dashboard" className="page-back-link">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl">Analytics & Reports</h1>
          <p className="text-sm opacity-90 mt-1">Track your business performance and insights</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">RM {analytics.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center text-sm">
                <TrendingUp className={`w-4 h-4 mr-1 ${analytics.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                <span className={analytics.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {analytics.growthRate >= 0 ? '+' : ''}{analytics.growthRate.toFixed(1)}%
                </span>
                <span className="text-gray-500 ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.totalOrders}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">All time orders</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">In Progress</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.pendingOrders}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">Paid orders being prepared</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Completed Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.completedOrders}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">Successfully delivered</p>
            </CardContent>
          </Card>
        </div>

        {analytics.monthlyRevenue.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analytics.monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `RM ${value.toFixed(2)}`} contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#f97316" fill="#fed7aa" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {analytics.productSales.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Top Products by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  {/* No <Legend> here — the card title already says what this
                      chart is, and a legend label would collide with the
                      rotated product-name ticks on narrow phone screens. */}
                  <BarChart data={analytics.productSales} margin={{ bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={70}
                      interval={0}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(name: string) => name.length > 12 ? `${name.slice(0, 12)}…` : name}
                    />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `RM ${value.toFixed(2)}`} labelFormatter={(name: string) => name} contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }} />
                    <Bar dataKey="revenue" fill="#10b981" name="Revenue (RM)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {analytics.statusBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Order Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Slice labels only carry the count — the long status names
                    ("Ready for Pickup: 3") overflowed the chart on phone
                    screens, so names live in the legend below instead. */}
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie data={analytics.statusBreakdown} cx="50%" cy="50%" labelLine={false} label={(entry) => `${entry.value}`} outerRadius={90} fill="#8884d8" dataKey="value">
                      {analytics.statusBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }} />
                    <Legend wrapperStyle={{ fontSize: '13px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {analytics.productSales.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Product Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-semibold text-gray-700">Product</th>
                      <th className="text-right p-3 text-sm font-semibold text-gray-700">Units Sold</th>
                      <th className="text-right p-3 text-sm font-semibold text-gray-700">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.productSales.map((product, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-gray-900">{product.name}</td>
                        <td className="p-3 text-right text-gray-900">{product.sales}</td>
                        <td className="p-3 text-right font-semibold text-orange-600">RM {product.revenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
