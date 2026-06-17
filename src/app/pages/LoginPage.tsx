import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import PageContainer from '../components/ui/PageContainer';
import FormSection from '../components/ui/FormSection';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Welcome back!');
      // App.tsx route redirects once onAuthStateChanged updates user state
    } catch (err: any) {
      const code = err.code as string;
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        toast.error('Invalid email or password');
      } else {
        toast.error('Login failed. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <PageContainer narrow>
      <div className="pt-6">
        <Link to="/" className="inline-flex items-center text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span className="text-lg">Back</span>
        </Link>

        <Card className="shadow-xl border-0 mt-6">
          <CardHeader className="space-y-2">
            <CardTitle className="text-3xl text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center text-base">Login to place orders or manage your business</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <FormSection>
                <Label htmlFor="email" className="text-base">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input id="email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-12 text-base" />
                </div>
              </FormSection>

              <FormSection>
                <Label htmlFor="password" className="text-base">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-12 pr-12 text-base" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </FormSection>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" size="lg" disabled={loading} className="w-full text-lg brand-button">
                {loading ? 'Logging in…' : 'Login'}
              </Button>
              <div className="w-full space-y-2 text-sm text-gray-600">
                <p>
                  Don&apos;t have an account?{' '}
                  <Link to="/register" className="font-medium text-orange-600 hover:text-orange-700 hover:underline">
                    Register here
                  </Link>
                </p>
                <Link to="/forgot-password" className="inline-flex text-gray-600 hover:text-gray-800 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}
