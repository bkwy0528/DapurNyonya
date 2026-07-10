import { useState, useEffect } from 'react';
import { getProducts, getSettings } from '../utils/db';
import type { BusinessInfo } from '../components/BusinessAboutCard';
import type { Announcement } from '../components/AnnouncementBanner';

// Shared data for the two storefront views — the public welcome page and the
// logged-in customer home. Products and the settings doc are both publicly
// readable per firestore.rules, so this works without auth.
export function useStorefront() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [announcement, setAnnouncement] = useState<Announcement>({
    enabled: true,
    title: 'Festive Season Orders Open!',
    text: 'Place your orders now for the upcoming celebrations. Limited slots available!',
  });
  const [business, setBusiness] = useState<BusinessInfo>({
    name: 'Dapur Nyonya',
    description: 'Homemade festive delicacies, made with love in a home kitchen.',
    phone: '',
    email: '',
    hours: '',
  });

  useEffect(() => {
    getProducts()
      .then(all => setProducts(all.filter((p: any) => p.available)))
      .finally(() => setLoading(false));
    getSettings().then(s => {
      if (!s) return;
      setAnnouncement({
        enabled: s.announcementEnabled !== false,
        title: s.announcementTitle || 'Festive Season Orders Open!',
        text: s.announcementText || 'Place your orders now for the upcoming celebrations. Limited slots available!',
      });
      setBusiness(prev => ({
        name: s.businessName || prev.name,
        description: s.businessDescription || prev.description,
        phone: s.contactPhone || '',
        email: s.contactEmail || '',
        hours: s.operatingHours || '',
      }));
    });
  }, []);

  return { products, loading, announcement, business };
}
