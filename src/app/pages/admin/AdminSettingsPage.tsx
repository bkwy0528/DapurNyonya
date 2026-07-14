import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Calendar as CalendarPicker } from '../../components/ui/calendar';
import { ArrowLeft, Settings, Save, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../../App';
import { getSettings, saveSettings } from '../../utils/db';
import { DEFAULT_ORDERING_RULES, normalizeOrderingRules, toLocalYMD, WEEKDAY_LABELS } from '../../utils/business';

// Monday-first display order for the collection-day picker (values are JS getDay())
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface AdminSettingsPageProps {
  user: User;
}

export default function AdminSettingsPage({ user: _user }: AdminSettingsPageProps) {
  const [businessName, setBusinessName] = useState('Festive Delights');
  const [businessDescription, setBusinessDescription] = useState('Homemade Dumplings & Snacks');
  const [contactPhone, setContactPhone] = useState('+60 12-345 6789');
  const [contactEmail, setContactEmail] = useState('dapurnyonya@email.com');
  const [operatingHours, setOperatingHours] = useState('');
  const [announcementEnabled, setAnnouncementEnabled] = useState(true);
  const [announcementTitle, setAnnouncementTitle] = useState('Festive Season Orders Open!');
  const [announcementText, setAnnouncementText] = useState('Place your orders now for the upcoming celebrations. Limited slots available!');
  const [bulkMinQuantity, setBulkMinQuantity] = useState(String(DEFAULT_ORDERING_RULES.bulkMinQuantity));
  const [smallOrderWeekdays, setSmallOrderWeekdays] = useState<number[]>(DEFAULT_ORDERING_RULES.smallOrderWeekdays);
  const [seasonStart, setSeasonStart] = useState('');
  const [seasonEnd, setSeasonEnd] = useState('');
  const [openSeasonPicker, setOpenSeasonPicker] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    getSettings().then(s => {
      if (!s) return;
      if (s.businessName) setBusinessName(s.businessName);
      if (s.businessDescription) setBusinessDescription(s.businessDescription);
      if (s.contactPhone) setContactPhone(s.contactPhone);
      if (s.contactEmail) setContactEmail(s.contactEmail);
      if (s.operatingHours) setOperatingHours(s.operatingHours);
      if (s.announcementEnabled !== undefined) setAnnouncementEnabled(s.announcementEnabled);
      if (s.announcementTitle) setAnnouncementTitle(s.announcementTitle);
      if (s.announcementText) setAnnouncementText(s.announcementText);
      const rules = normalizeOrderingRules(s.orderingRules);
      setBulkMinQuantity(String(rules.bulkMinQuantity));
      setSmallOrderWeekdays(rules.smallOrderWeekdays);
      setSeasonStart(rules.seasonStart || '');
      setSeasonEnd(rules.seasonEnd || '');
    });
  }, []);

  const toggleWeekday = (day: number) => {
    setSmallOrderWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  // Native <input type="date"> renders inconsistently across mobile
  // browsers (invisible placeholder in dark mode, blank control on some
  // WebKit builds), so this pair uses the same custom CalendarPicker the
  // checkout flow already relies on instead.
  const formatSeasonDate = (ymd: string) =>
    new Date(`${ymd}T00:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

  const handleSave = async () => {
    const minQty = parseInt(bulkMinQuantity, 10);
    if (isNaN(minQty) || minQty < 1) {
      toast.error('Minimum units for flexible dates must be at least 1');
      return;
    }
    if (smallOrderWeekdays.length === 0) {
      toast.error('Select at least one collection day for small orders');
      return;
    }
    if (!!seasonStart !== !!seasonEnd) {
      toast.error('Set both a start and an end date for the festive season, or clear both');
      return;
    }
    if (seasonStart && seasonEnd && seasonStart > seasonEnd) {
      toast.error('The festive season start date must be on or before the end date');
      return;
    }
    try {
      await saveSettings({
        businessName,
        businessDescription,
        contactPhone,
        contactEmail,
        operatingHours,
        announcementEnabled,
        announcementTitle,
        announcementText,
        orderingRules: {
          bulkMinQuantity: minQty,
          smallOrderWeekdays,
          seasonStart: seasonStart || null,
          seasonEnd: seasonEnd || null,
        },
      });
    } catch {
      toast.error('Could not save settings. Please try again.');
      return;
    }
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
            <div className="space-y-2">
              <Label htmlFor="operatingHours" className="text-base">Operating Hours</Label>
              <Input id="operatingHours" value={operatingHours} onChange={(e) => setOperatingHours(e.target.value)} placeholder="e.g. Mon–Sat, 9:00am – 6:00pm" className="h-12 text-base" />
              <p className="text-sm text-gray-600">Shown to customers in the About section on the home page. Leave empty to hide.</p>
            </div>
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
            <CardTitle>Ordering Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="bulkMinQuantity" className="text-base">Minimum Units for Flexible Dates</Label>
              <Input id="bulkMinQuantity" type="number" min="1" step="1" inputMode="numeric" value={bulkMinQuantity} onChange={(e) => setBulkMinQuantity(e.target.value)} className="h-12 text-base" />
              <p className="text-sm text-gray-600">
                Orders with fewer units than this can only choose the collection days below. Orders that meet the
                minimum can pick any date. Products marked "No Minimum Quantity" in Product Management are not counted.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-base">Collection Days for Small Orders</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_ORDER.map((day) => {
                  const selected = smallOrderWeekdays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekday(day)}
                      aria-pressed={selected}
                      className={`h-11 px-4 rounded-full border-2 text-sm font-medium transition-colors ${
                        selected
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300'
                      }`}
                    >
                      {WEEKDAY_LABELS[day].slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-gray-600">Small orders can only be collected on the selected day(s).</p>
            </div>
            <div className="space-y-2 rounded-lg border border-orange-200 bg-orange-50/50 p-4">
              <Label className="text-base">Festive Season — Flexible Dates for Everyone</Label>
              <p className="text-sm text-gray-600">
                During this period (e.g. bak chang season) small orders can also pick any collection date, not just
                the days above. Leave both dates empty when there is no festive season.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2 min-w-0">
                  <Label className="text-sm text-gray-700">Season Starts</Label>
                  <button
                    type="button"
                    onClick={() => setOpenSeasonPicker(openSeasonPicker === 'start' ? null : 'start')}
                    className="h-12 w-full flex items-center justify-between rounded-md border border-input px-3 text-base bg-input-background"
                  >
                    <span className={seasonStart ? 'text-gray-900' : 'text-muted-foreground'}>
                      {seasonStart ? formatSeasonDate(seasonStart) : 'Select date'}
                    </span>
                    <CalendarIcon className="w-4 h-4 text-gray-500 shrink-0" />
                  </button>
                  {openSeasonPicker === 'start' && (
                    <div className="flex justify-center rounded-lg border border-gray-200 bg-white">
                      <CalendarPicker
                        mode="single"
                        selected={seasonStart ? new Date(`${seasonStart}T00:00:00`) : undefined}
                        onSelect={(d) => { setSeasonStart(d ? toLocalYMD(d) : ''); setOpenSeasonPicker(null); }}
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2 min-w-0">
                  <Label className="text-sm text-gray-700">Season Ends</Label>
                  <button
                    type="button"
                    onClick={() => setOpenSeasonPicker(openSeasonPicker === 'end' ? null : 'end')}
                    className="h-12 w-full flex items-center justify-between rounded-md border border-input px-3 text-base bg-input-background"
                  >
                    <span className={seasonEnd ? 'text-gray-900' : 'text-muted-foreground'}>
                      {seasonEnd ? formatSeasonDate(seasonEnd) : 'Select date'}
                    </span>
                    <CalendarIcon className="w-4 h-4 text-gray-500 shrink-0" />
                  </button>
                  {openSeasonPicker === 'end' && (
                    <div className="flex justify-center rounded-lg border border-gray-200 bg-white">
                      <CalendarPicker
                        mode="single"
                        selected={seasonEnd ? new Date(`${seasonEnd}T00:00:00`) : undefined}
                        onSelect={(d) => { setSeasonEnd(d ? toLocalYMD(d) : ''); setOpenSeasonPicker(null); }}
                      />
                    </div>
                  )}
                </div>
              </div>
              {(seasonStart || seasonEnd) && (
                <Button variant="outline" size="sm" onClick={() => { setSeasonStart(''); setSeasonEnd(''); setOpenSeasonPicker(null); }}>
                  Clear Festive Season
                </Button>
              )}
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
