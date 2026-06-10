import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ArrowLeft, User as UserIcon, Camera, Save } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../../App';
import { getAdminProfile, saveAdminProfile } from '../../utils/db';

interface AdminProfilePageProps {
  user: User;
  onLogout: () => void;
  onProfileUpdate?: (user: User) => void;
}

export default function AdminProfilePage({ user, onLogout, onProfileUpdate }: AdminProfilePageProps) {
  const [name, setName] = useState(user.name);
  const [countryCode, setCountryCode] = useState('+60');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user.email || '');
  const [profilePicture, setProfilePicture] = useState(user.profilePicture || '');

  useEffect(() => {
    getAdminProfile().then(profile => {
      if (!profile) return;
      if (profile.name) setName(profile.name);
      if (profile.email) setEmail(profile.email);
      if (profile.profilePicture) setProfilePicture(profile.profilePicture);
      if (profile.phone) {
        const rawPhone = profile.phone as string;
        if (rawPhone.startsWith('+65')) {
          setCountryCode('+65');
          setPhone(rawPhone.slice(3));
        } else if (rawPhone.startsWith('+60')) {
          setCountryCode('+60');
          setPhone(rawPhone.slice(3));
        } else {
          setPhone(rawPhone);
        }
      }
    });
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfilePicture(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    const fullPhone = `${countryCode}${phone}`;
    await saveAdminProfile({ name, phone: fullPhone, email, profilePicture });
    onProfileUpdate?.({ ...user, name, phone: fullPhone, email, profilePicture });
    toast.success('Profile updated successfully!');
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="page-hero">
        <div className="page-hero__inner">
          <Link to="/admin/dashboard" className="page-back-link">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl">Admin Profile</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-16 h-16 text-white" />
                )}
              </div>
              <label htmlFor="profile-upload" className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg cursor-pointer hover:bg-gray-50 border-2 border-orange-500">
                <Camera className="w-5 h-5 text-orange-600" />
                <input id="profile-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
            <p className="text-sm text-gray-600">Click camera icon to upload photo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base">Full Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 text-base" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-base">Phone Number *</Label>
              <div className="flex space-x-2">
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger className="w-32 h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+60">Malaysia +60</SelectItem>
                    <SelectItem value="+65">Singapore +65</SelectItem>
                    <SelectItem value="+62">Indonesia +62</SelectItem>
                    <SelectItem value="+66">Thailand +66</SelectItem>
                    <SelectItem value="+1">United States +1</SelectItem>
                  </SelectContent>
                </Select>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className="flex-1 h-12 text-base" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">Email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 text-base" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Button size="lg" onClick={handleSave} className="w-full h-14 text-lg brand-button">
            <Save className="w-5 h-5 mr-2" />
            Save Changes
          </Button>
          <Button size="lg" variant="outline" onClick={onLogout} className="w-full h-14 text-lg border-2">
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
