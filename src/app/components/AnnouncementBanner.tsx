import { Card, CardContent } from './ui/card';
import { Package } from 'lucide-react';

export interface Announcement {
  enabled: boolean;
  title: string;
  text: string;
}

export default function AnnouncementBanner({ announcement, className }: { announcement: Announcement; className?: string }) {
  if (!announcement.enabled) return null;

  return (
    <div className={className}>
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-lg">
        <CardContent className="p-5">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">{announcement.title}</h3>
              <p className="text-sm text-gray-700">{announcement.text}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
