import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { ArrowLeft, Settings, Save } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../../App';
import { getSettings, saveSettings } from '../../utils/db';

interface AdminSettingsPageProps {
  user: User;
}

export default function AdminSettingsPage({ user: _user }: AdminSettingsPageProps) {
  const [businessName, setBusinessName] = useState('Festive Delights');
  const [businessDescription, setBusinessDescription] = useState('Homemade Dumplings & Snacks');
  const [contactPhone, setContactPhone] = useState('+60 12-345 6789');
  const [contactEmail, setContactEmail] = useState('dapurnyonya@email.com');
  const [toyyibpaySecretKey, setToyyibpaySecretKey] = useState('');
  const [toyyibpayCategoryCode, setToyyibpayCategoryCode] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [announcementEnabled, setAnnouncementEnabled] = useState(true);
  const [announcementTitle, setAnnouncementTitle] = useState('Festive Season Orders Open!');
  const [announcementText, setAnnouncementText] = useState('Place your orders now for the upcoming celebrations. Limited slots available!');

  useEffect(() => {
    getSettings().then(s => {
      if (!s) return;
      if (s.businessName) setBusinessName(s.businessName);
      if (s.businessDescription) setBusinessDescription(s.businessDescription);
      if (s.contactPhone) setContactPhone(s.contactPhone);
      if (s.contactEmail) setContactEmail(s.contactEmail);
      if (s.toyyibpaySecretKey) setToyyibpaySecretKey(s.toyyibpaySecretKey);
      if (s.toyyibpayCategoryCode) setToyyibpayCategoryCode(s.toyyibpayCategoryCode);
      if (s.aiEnabled !== undefined) setAiEnabled(s.aiEnabled);
      if (s.announcementEnabled !== undefined) setAnnouncementEnabled(s.announcementEnabled);
      if (s.announcementTitle) setAnnouncementTitle(s.announcementTitle);
      if (s.announcementText) setAnnouncementText(s.announcementText);
    });
  }, []);

  const handleSave = async () => {
    await saveSettings({
      businessName,
      businessDescription,
      contactPhone,
      contactEmail,
      toyyibpaySecretKey,
      toyyibpayCategoryCode,
      aiEnabled,
      announcementEnabled,
      announcementTitle,
      announcementText,
    });
    toast.success('Settings saved successfully!');
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="page-hero">
        <div className="page-hero__inner page-hero__inner--wide">
          <Link to="/admin/dashboard" className="page-back-link">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-lg">Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl flex items-center">
            <Settings className="w-7 h-7 mr-3" />
            Business Settings
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-base">Business Name</Label>
              <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="h-12 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessDescription" className="text-base">Business Description</Label>
              <Input id="businessDescription" value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)} className="h-12 text-base" />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="contactPhone" className="text-base">Contact Phone</Label>
                <Input id="contactPhone" type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+60 12-345 6789" className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail" className="text-base">Contact Email</Label>
                <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="your@email.com" className="h-12 text-base" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ToyyibPay Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="toyyibpaySecretKey" className="text-base">User Secret Key</Label>
              <Input id="toyyibpaySecretKey" value={toyyibpaySecretKey} onChange={(e) => setToyyibpaySecretKey(e.target.value)} placeholder="Get from ToyyibPay dashboard → Profile" className="h-12 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toyyibpayCategoryCode" className="text-base">Category Code</Label>
              <Input id="toyyibpayCategoryCode" value={toyyibpayCategoryCode} onChange={(e) => setToyyibpayCategoryCode(e.target.value)} placeholder="Get from ToyyibPay dashboard → Category" className="h-12 text-base" />
            </div>
            <p className="text-sm text-gray-600">Sign up at toyyibpay.com, create a Category, then copy these credentials here.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Announcement Banner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="space-y-1">
                <Label htmlFor="announcementEnabled" className="text-base">Show Announcement Banner</Label>
                <p className="text-sm text-gray-600">Display a notice banner on the customer home page</p>
              </div>
              <Switch id="announcementEnabled" checked={announcementEnabled} onCheckedChange={setAnnouncementEnabled} />
            </div>
            {announcementEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="announcementTitle" className="text-base">Banner Title</Label>
                  <Input id="announcementTitle" value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} placeholder="e.g. Festive Season Orders Open!" className="h-12 text-base" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="announcementText" className="text-base">Banner Message</Label>
                  <Textarea id="announcementText" value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} placeholder="e.g. Place your orders now..." className="min-h-24 text-base" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
              <div className="space-y-1">
                <Label htmlFor="aiEnabled" className="text-base">Enable AI Features (Coming Soon)</Label>
                <p className="text-sm text-gray-600">Auto-calculate ingredients and suggest production schedules</p>
              </div>
              <Switch id="aiEnabled" checked={aiEnabled} onCheckedChange={setAiEnabled} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardHeader>
            <CardTitle>About This App</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-gray-700"><strong>DapurNyonya</strong> — A simple and efficient system for managing your home-based food business.</p>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="bg-white rounded-lg p-4 border border-orange-200">
                <p className="text-sm text-gray-600">Version</p>
                <p className="text-lg font-semibold text-gray-900">1.0.0</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-orange-200">
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="text-lg font-semibold text-gray-900">Jun 2026</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button size="lg" onClick={handleSave} className="w-full h-14 text-lg brand-button">
          <Save className="w-5 h-5 mr-2" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}
