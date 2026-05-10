import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ArrowLeft, TrendingUp, DollarSign, ShoppingBag, Users, Calendar } from 'lucide-react';
import { User } from '../../App';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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

export default function AnalyticsDashboard({ user }: AnalyticsDashboardProps) {
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

  useEffect(() => {
    calculateAnalytics();
  }, []);

  const calculateAnalytics = () => {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const products = JSON.parse(localStorage.getItem('products') || '[]');

    // Calculate total revenue and orders
    const totalRevenue = orders.reduce((sum: number, order: any) => sum + (order.total || 0), 0);
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o: any) => o.status === 'Pending Approval').length;
    const completedOrders = orders.filter((o: any) => o.status === 'Delivered').length;

    // Calculate monthly revenue (last 6 months)
    const monthlyData: { [key: string]: number } = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    orders.forEach((order: any) => {
      if (order.orderDate) {
        const date = new Date(order.orderDate);
        const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (order.total || 0);
      }
    });

    const monthlyRevenue = Object.entries(monthlyData)
      .slice(-6)
      .map(([month, revenue]) => ({ month, revenue }));

    // Calculate product sales
    const productSalesMap: { [key: string]: { sales: number; revenue: number } } = {};
    
    orders.forEach((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          if (!productSalesMap[item.name]) {
            productSalesMap[item.name] = { sales: 0, revenue: 0 };
          }
          productSalesMap[item.name].sales += item.quantity;
          productSalesMap[item.name].revenue += item.price * item.quantity;
        });
      }
    });

    const productSales = Object.entries(productSalesMap)
      .map(([name, data]) => ({ name, sales: data.sales, revenue: data.revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    // Calculate status breakdown
    const statusMap: { [key: string]: number } = {};
    orders.forEach((order: any) => {
      statusMap[order.status] = (statusMap[order.status] || 0) + 1;
    });

    const statusBreakdown = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

    // Calculate recent revenue (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentRevenue = orders
      .filter((o: any) => new Date(o.orderDate) >= thirtyDaysAgo)
      .reduce((sum: number, order: any) => sum + (order.total || 0), 0);

    // Calculate growth rate (simplified)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const previousRevenue = orders
      .filter((o: any) => {
        const orderDate = new Date(o.orderDate);
        return orderDate >= sixtyDaysAgo && orderDate < thirtyDaysAgo;
      })
      .reduce((sum: number, order: any) => sum + (order.total || 0), 0);

    const growthRate = previousRevenue > 0 
      ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 
      : 0;

    setAnalytics({
      totalRevenue,
      totalOrders,
      pendingOrders,
      completedOrders,
      monthlyRevenue,
      productSales,
      statusBreakdown,
      recentRevenue,
      growthRate,
    });
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <Link to="/admin/dashboard" className="inline-flex items-center text-white hover:text-gray-100 mb-4">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl">Analytics & Reports</h1>
          <p className="text-sm opacity-90 mt-1">Track your business performance and insights</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Key Metrics */}
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
                  <p className="text-sm text-gray-600">Pending Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.pendingOrders}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">Awaiting approval</p>
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

        {/* Revenue Trend Chart */}
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
                  <Tooltip 
                    formatter={(value: number) => `RM ${value.toFixed(2)}`}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#f97316" 
                    fill="#fed7aa" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Sales Chart */}
          {analytics.productSales.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Top Products by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.productSales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === 'revenue') return `RM ${value.toFixed(2)}`;
                        return value;
                      }}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#10b981" name="Revenue (RM)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Order Status Breakdown */}
          {analytics.statusBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Order Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.statusBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analytics.statusBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Product Sales Table */}
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
                        <td className="p-3 text-right font-semibold text-orange-600">
                          RM {product.revenue.toFixed(2)}
                        </td>
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