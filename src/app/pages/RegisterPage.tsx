import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ArrowLeft, User as UserIcon, Mail, Phone, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../App';
import { validatePassword } from '../utils/business';
import PageContainer from '../components/ui/PageContainer';
import FormSection from '../components/ui/FormSection';

interface RegisterPageProps {
  onRegister: (user: User) => void;
}

export default function RegisterPage({ onRegister }: RegisterPageProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+60');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !phone || !password) {
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

    const fullPhone = `${countryCode}${phone}`;

    // Check if user already exists
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const existingUser = users.find((u: any) => u.phone === fullPhone);
    
    if (existingUser) {
      toast.error('Phone number already registered');
      return;
    }

    // Create new customer user
    const newUser: User = {
      id: Date.now().toString(),
      name,
      phone: fullPhone,
      email: email || undefined,
      role: 'customer'
    };

    // Save to localStorage
    users.push({ ...newUser, password });
    localStorage.setItem('users', JSON.stringify(users));

    onRegister(newUser);
    toast.success('Registration successful!');
    navigate('/customer/home');
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
            <CardContent>
              <FormSection>
                <Label htmlFor="name" className="text-base">Full Name *</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input id="name" type="text" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} className="pl-12 text-base" required />
                </div>
              </FormSection>

              <FormSection>
                <Label htmlFor="phone" className="text-base">Phone Number *</Label>
                <div className="grid grid-cols-[110px_1fr] gap-2 sm:grid-cols-[120px_1fr] items-stretch">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="h-14 text-base rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+60">🇲🇾 +60</SelectItem>
                      <SelectItem value="+65">🇸🇬 +65</SelectItem>
                      <SelectItem value="+62">🇮🇩 +62</SelectItem>
                      <SelectItem value="+66">🇹🇭 +66</SelectItem>
                      <SelectItem value="+1">🇺🇸 +1</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input id="phone" type="tel" placeholder="123456789" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className="pl-12 text-base rounded-xl" required />
                  </div>
                </div>
                <p className="text-xs text-gray-500">Enter phone number without country code</p>
              </FormSection>

              <FormSection>
                <Label htmlFor="email" className="text-base">Email (Optional)</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input id="email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-12 text-base" />
                </div>
              </FormSection>

              <FormSection>
                <Label htmlFor="password" className="text-base">Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input id="password" type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-12 text-base" required />
                </div>
              </FormSection>

              <FormSection>
                <Label htmlFor="confirmPassword" className="text-base">Confirm Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input id="confirmPassword" type="password" placeholder="Confirm your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-12 text-base" required />
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
              <Button type="submit" size="lg" className="w-full text-lg brand-button">Register</Button>
              <p className="text-center text-gray-600">Already have an account? <Link to="/login" className="text-orange-600 hover:text-orange-700">Login here</Link></p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}