import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ArrowLeft, User as UserIcon, Mail, Phone, Lock, Eye, EyeOff, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../../firebase';
import { saveUserProfile } from '../utils/db';
import { validatePassword } from '../utils/business';
import { User } from '../App';
import PageContainer from '../components/ui/PageContainer';
import FormSection from '../components/ui/FormSection';

interface RegisterPageProps {
  onRegisterSuccess?: (user: User) => void;
}

export default function RegisterPage({ onRegisterSuccess }: RegisterPageProps) {
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+60');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const passwordRequirements = useMemo(() => [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains letters and numbers', met: /[A-Za-z]/.test(password) && /[0-9]/.test(password) },
  ], [password]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error('Google sign-in failed. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !phone || !email || !password) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      setErrors(['Passwords do not match']);
      return;
    }

    const pwErrors = validatePassword(password);
    if (pwErrors.length > 0) {
      setErrors(pwErrors);
      return;
    }

    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = credential.user.uid;
      const fullPhone = `${countryCode}${phone}`;
      await saveUserProfile(uid, {
        id: uid,
        name,
        phone: fullPhone,
        email,
        role: 'customer',
      });
      onRegisterSuccess?.({ id: uid, name, phone: fullPhone, email, role: 'customer' });
      toast.success('Registration successful!');
      // App.tsx route redirects to /customer/home once user state is set
    } catch (err: any) {
      const code = err.code as string;
      if (code === 'auth/email-already-in-use') {
        toast.error('An account with this email already exists');
      } else {
        toast.error('Registration failed. Please try again.');
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
            <CardTitle className="text-3xl text-center">Create Account</CardTitle>
            <CardDescription className="text-center text-base">Join us to order delicious homemade treats</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <FormSection>
                <Label htmlFor="name" className="text-base">Full Name *</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input id="name" type="text" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} className="pl-12 text-base" required />
                </div>
              </FormSection>

              <FormSection>
                <Label htmlFor="phone" className="text-base">Phone Number *</Label>
                <div className="flex gap-2 items-center">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="w-32 h-12 text-base shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+60">+60 (Malaysia)</SelectItem>
                      <SelectItem value="+65">+65 (Singapore)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input id="phone" type="tel" placeholder="123456789" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className="h-12 pl-12 text-base" required />
                  </div>
                </div>
                <p className="text-xs text-gray-500">Enter phone number without country code</p>
              </FormSection>

              <FormSection>
                <Label htmlFor="email" className="text-base">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input id="email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-12 text-base" required />
                </div>
              </FormSection>

              <FormSection>
                <Label htmlFor="password" className="text-base">Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    className="pl-12 pr-12 text-base"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {(passwordFocused || password.length > 0) && (
                  <div className="space-y-1 pt-1">
                    {passwordRequirements.map((req) => (
                      <div key={req.label} className={`flex items-center gap-2 text-xs ${req.met ? 'text-green-600' : 'text-gray-500'}`}>
                        {req.met ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                        <span>{req.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </FormSection>

              <FormSection>
                <Label htmlFor="confirmPassword" className="text-base">Confirm Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-12 pr-12 text-base" required />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </FormSection>

              {errors.length > 0 && (
                <div className="space-y-1 text-sm text-red-600">
                  {errors.map((err, idx) => (
                    <div key={idx}>• {err}</div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" size="lg" disabled={loading} className="w-full text-lg brand-button">
                {loading ? 'Creating account…' : 'Register'}
              </Button>

              <div className="auth-divider"><span className="auth-divider__label">or</span></div>

              <Button type="button" variant="outline" size="lg" disabled={loading} onClick={handleGoogleSignIn} className="google-button">
                <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>

              <p className="text-center text-gray-600">Already have an account? <Link to="/login" className="text-orange-600 hover:text-orange-700">Login here</Link></p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}
