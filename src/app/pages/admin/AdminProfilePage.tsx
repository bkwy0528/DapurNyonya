import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ArrowLeft, User as UserIcon, Camera, Save } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../../App';

interface AdminProfilePageProps {
  user: User;
  onLogout: () => void;
}

export default function AdminProfilePage({ user, onLogout }: AdminProfilePageProps) {
  const [name, setName] = useState(user.name);
  const [countryCode, setCountryCode] = useState(user.phone.substring(0, 3));
  const [phone, setPhone] = useState(user.phone.substring(3));
  const [email, setEmail] = useState(user.email || '');
  const [profilePicture, setProfilePicture] = useState(user.profilePicture || '');

  // Load admin profile from localStorage
  useEffect(() => {
    const adminProfile = localStorage.getItem('adminProfile');
    if (adminProfile) {
      const profile = JSON.parse(adminProfile);
      setName(profile.name || user.name);
      setEmail(profile.email || user.email || '');
      setProfilePicture(profile.profilePicture || '');
      if (profile.phone) {
        setCountryCode(profile.phone.substring(0, 3));
        setPhone(profile.phone.substring(3));
      }
    }
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const fullPhone = `${countryCode}${phone}`;
    
    // Save admin profile to localStorage
    const adminProfile = {
      name,
      phone: fullPhone,
      email,
      profilePicture
    };
    localStorage.setItem('adminProfile', JSON.stringify(adminProfile));

    toast.success('Profile updated successfully!');
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="page-hero">
        <div className="page-hero__inner">
          <Link to="/admin/dashboard" className="page-back-link">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl">Admin Profile</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Profile Picture */}
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
                <input
                  id="profile-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
            </div>
            <p className="text-sm text-gray-600">Click camera icon to upload photo</p>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base">Full Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-base">Phone Number *</Label>
              <div className="flex space-x-2">
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger className="w-32 h-12 text-base">
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
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 h-12 text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 text-base"
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-4">
          <Button
            size="lg"
            onClick={handleSave}
            className="w-full h-14 text-lg brand-button"
          >
            <Save className="w-5 h-5 mr-2" />
            Save Changes
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={onLogout}
            className="w-full h-14 text-lg border-2"
          >
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}