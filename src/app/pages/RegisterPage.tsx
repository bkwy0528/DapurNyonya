import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ArrowLeft, User as UserIcon, Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { createUserWithEmailAndPassword } from 'firebase/auth';
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
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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
                  <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
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
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input id="phone" type="tel" placeholder="123456789" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className="h-12 pl-12 text-base" required />
                  </div>
                </div>
                <p className="text-xs text-gray-500">Enter phone number without country code</p>
              </FormSection>

              <FormSection>
                <Label htmlFor="email" className="text-base">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input id="email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-12 text-base" required />
                </div>
              </FormSection>

              <FormSection>
                <Label htmlFor="password" className="text-base">Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-12 pr-12 text-base" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </FormSection>

              <FormSection>
                <Label htmlFor="confirmPassword" className="text-base">Confirm Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-12 pr-12 text-base" required />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
              <Button type="submit" size="lg" disabled={loading} className="w-full text-lg bg-gradient-to-r from-orange-500 to-amber-500">
                {loading ? 'Creating account…' : 'Register'}
              </Button>
              <p className="text-center text-gray-600">Already have an account? <Link to="/login" className="text-orange-600 hover:text-orange-700">Login here</Link></p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}
