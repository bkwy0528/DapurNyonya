import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { validatePassword } from '../utils/business';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [step, setStep] = useState<'find'|'reset'>('find');
  const [userIdx, setUserIdx] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const handleFind = (e: React.FormEvent) => {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const idx = users.findIndex((u: any) => u.phone === identifier || u.email === identifier);
    if (idx === -1) {
      toast.error('No account found with that phone or email');
      return;
    }
    setUserIdx(idx);
    setStep('reset');
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrors(['Passwords do not match']);
      return;
    }
    const pwErrors = validatePassword(password);
    if (pwErrors.length > 0) {
      setErrors(pwErrors);
      return;
    }
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (userIdx === null) return;
    users[userIdx].password = password;
    localStorage.setItem('users', JSON.stringify(users));
    toast.success('Password reset successful');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <Link to="/" className="inline-flex items-center text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span className="text-lg">Back</span>
        </Link>

        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl text-center">Forgot Password</CardTitle>
          </CardHeader>

          {step === 'find' ? (
            <form onSubmit={handleFind}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier" className="text-base">Email or Phone</Label>
                  <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="h-12" />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full">Find Account</Button>
              </CardFooter>
            </form>
          ) : (
            <form onSubmit={handleReset}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-base">New Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-base">Confirm Password</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12" />
                </div>
                {errors.length > 0 && (
                  <div className="text-sm text-red-600">
                    {errors.map((err, i) => <div key={i}>- {err}</div>)}
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full">Reset Password</Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
