import { useState } from 'react';
import { Link } from 'react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { ArrowLeft, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';
import PageContainer from '../components/ui/PageContainer';
import FormSection from '../components/ui/FormSection';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        // Deliberately indistinguishable from a real send — confirming that an
        // email is (or isn't) registered would let anyone probe for accounts.
        setSent(true);
      } else {
        toast.error('Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer narrow>
      <div className="pt-6">
        <Link to="/login" className="inline-flex items-center text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span className="text-lg">Back to Login</span>
        </Link>

        <Card className="shadow-xl border-0 mt-6">
          <CardHeader className="space-y-2">
            <CardTitle className="text-3xl text-center">Forgot Password</CardTitle>
            <CardDescription className="text-center text-base">We'll send a reset link to your email</CardDescription>
          </CardHeader>

          {sent ? (
            <CardContent className="space-y-6 text-center pb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <p className="text-gray-700">
                  If an account exists for <strong>{email}</strong>, a reset link has been sent to it.
                </p>
                <p className="text-sm text-gray-500">Check your inbox (and spam folder) and follow the instructions.</p>
              </div>
              <Link to="/login" className="block">
                <Button className="w-full text-lg brand-button">Back to Login</Button>
              </Link>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                <FormSection>
                  <Label htmlFor="email" className="text-base">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your registered email" className="pl-12 text-base" />
                  </div>
                </FormSection>
              </CardContent>
              <CardFooter>
                <Button type="submit" size="lg" disabled={loading} className="w-full text-lg brand-button">
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
