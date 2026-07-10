import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Clock, Mail, MessageCircle, Phone } from 'lucide-react';

export interface BusinessInfo {
  name: string;
  description: string;
  phone: string;
  email: string;
  hours: string;
}

export default function BusinessAboutCard({ business }: { business: BusinessInfo }) {
  const whatsappNumber = business.phone.replace(/\D/g, '');

  return (
    <Card className="mt-10 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">About {business.name}</h3>
          <p className="text-gray-700 mt-2">{business.description}</p>
          <p className="text-gray-700 mt-2">Every order is homemade in small batches and prepared fresh just for you — that's why each product needs a few days of preparation time.</p>
        </div>

        {business.hours && (
          <div className="flex items-center gap-3 text-gray-700">
            <Clock className="w-5 h-5 text-orange-600 shrink-0" />
            <span>{business.hours}</span>
          </div>
        )}

        {business.email && (
          <div className="flex items-center gap-3 text-gray-700">
            <Mail className="w-5 h-5 text-orange-600 shrink-0" />
            <span className="break-all">{business.email}</span>
          </div>
        )}

        {business.phone && (
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-none">
              <Button className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
                <MessageCircle className="w-5 h-5 mr-2" />
                WhatsApp Us
              </Button>
            </a>
            <a href={`tel:${business.phone.replace(/[^\d+]/g, '')}`} className="flex-1 sm:flex-none">
              <Button variant="outline" className="w-full sm:w-auto border-2">
                <Phone className="w-5 h-5 mr-2" />
                Call {business.phone}
              </Button>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
