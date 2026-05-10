import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { ArrowLeft, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../App';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const navigate = useNavigate();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!emailOrPhone || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    // Demo admin login
    if (emailOrPhone === 'admin@demo.com' && password === 'any') {
      onLogin({
        id: 'admin-001',
        name: 'Admin User',
        phone: '+60123456789',
        email: 'admin@demo.com',
        role: 'admin'
      });
      toast.success('Welcome back, Admin!');
      navigate('/admin/dashboard');
      return;
    }

    // Demo customer login
    if (emailOrPhone === 'customer@demo.com' && password === 'any') {
      onLogin({
        id: 'customer-001',
        name: 'Customer User',
        phone: '+60198765432',
        email: 'customer@demo.com',
        role: 'customer'
      });
      toast.success('Welcome back!');
      navigate('/customer/home');
      return;
    }

    // Check registered users from localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find((u: any) => 
      (u.phone === emailOrPhone || u.email === emailOrPhone) && u.password === password
    );

    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      onLogin(userWithoutPassword);
      toast.success('Welcome back!');
      navigate('/customer/home');
    } else {
      toast.error('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        {/* Back Button */}
        <Link to="/" className="inline-flex items-center text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span className="text-lg">Back</span>
        </Link>

        {/* Login Card */}
        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-2">
            <CardTitle className="text-3xl text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center text-base">
              Login to place orders or manage your business
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base">Email / Phone Number</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="email"
                    type="text"
                    placeholder="Enter your email or phone"
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    className="pl-12 h-14 text-base"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-base">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 h-14 text-base"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                size="lg"
                className="w-full h-14 text-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
              >
                Login
              </Button>
              <p className="text-center text-gray-600">
                Don't have an account?{' '}
                <Link to="/register" className="text-orange-600 hover:text-orange-700">
                  Register here
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}