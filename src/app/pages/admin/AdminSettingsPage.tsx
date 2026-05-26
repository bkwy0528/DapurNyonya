import { useState } from 'react';
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

interface AdminSettingsPageProps {
  user: User;
}

export default function AdminSettingsPage({ user }: AdminSettingsPageProps) {
  const [businessName, setBusinessName] = useState('Festive Delights');
  const [businessDescription, setBusinessDescription] = useState('Homemade Dumplings & Snacks');
  const [contactPhone, setContactPhone] = useState('+1 (555) 123-4567');
  const [contactEmail, setContactEmail] = useState('festive@delights.com');
  const [bankAccount, setBankAccount] = useState('1234-5678-9012');
  const [eWallet, setEWallet] = useState('+1 (555) 123-4567');
  const [paymentInstructions, setPaymentInstructions] = useState(
    'Please transfer to the account above or pay upon delivery.'
  );
  const [orderCutoff, setOrderCutoff] = useState('3');
  const [aiEnabled, setAiEnabled] = useState(false);

  const handleSave = () => {
    // Save settings to localStorage
    const settings = {
      businessName,
      businessDescription,
      contactPhone,
      contactEmail,
      bankAccount,
      eWallet,
      paymentInstructions,
      orderCutoff,
      aiEnabled
    };
    localStorage.setItem('businessSettings', JSON.stringify(settings));
    toast.success('Settings saved successfully!');
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
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

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Business Details */}
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-base">Business Name</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessDescription" className="text-base">Business Description</Label>
              <Input
                id="businessDescription"
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="contactPhone" className="text-base">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactEmail" className="text-base">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="bankAccount" className="text-base">Bank Account Number</Label>
              <Input
                id="bankAccount"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eWallet" className="text-base">E-Wallet Number</Label>
              <Input
                id="eWallet"
                value={eWallet}
                onChange={(e) => setEWallet(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentInstructions" className="text-base">Payment Instructions</Label>
              <Textarea
                id="paymentInstructions"
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                className="min-h-32 text-base"
              />
              <p className="text-sm text-gray-600">
                This message will be shown to customers during checkout
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Order Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Order Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="orderCutoff" className="text-base">Order Cut-off (Days in Advance)</Label>
              <Input
                id="orderCutoff"
                type="number"
                min="1"
                max="30"
                value={orderCutoff}
                onChange={(e) => setOrderCutoff(e.target.value)}
                className="h-12 text-base"
              />
              <p className="text-sm text-gray-600">
                Minimum days required before delivery date for accepting orders
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
              <div className="space-y-1">
                <Label htmlFor="aiEnabled" className="text-base">Enable AI Features (Coming Soon)</Label>
                <p className="text-sm text-gray-600">
                  Auto-calculate ingredients and suggest production schedules
                </p>
              </div>
              <Switch
                id="aiEnabled"
                checked={aiEnabled}
                onCheckedChange={setAiEnabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* About This App */}
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardHeader>
            <CardTitle>About This App</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-gray-700">
              <strong>Festive Order Tracker</strong> - A simple and efficient system for managing your home-based food business.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="bg-white rounded-lg p-4 border border-orange-200">
                <p className="text-sm text-gray-600">Version</p>
                <p className="text-lg font-semibold text-gray-900">1.0.0</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-orange-200">
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="text-lg font-semibold text-gray-900">Dec 2024</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button
          size="lg"
          onClick={handleSave}
          className="w-full h-14 text-lg brand-button"
        >
          <Save className="w-5 h-5 mr-2" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}