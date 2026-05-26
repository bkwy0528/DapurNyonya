import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { UtensilsCrossed, Heart, Sparkles } from 'lucide-react';

export default function WelcomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center space-y-4">
          <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-amber-500 rounded-3xl flex items-center justify-center shadow-lg">
            <UtensilsCrossed className="w-12 h-12 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Dapur Nyonya</h1>
            <p className="text-xl text-gray-600 mt-2">Homemade Festive Delicacies</p>
          </div>
        </div>

        {/* Banner Image */}
        <div className="rounded-2xl overflow-hidden shadow-xl">
          <img
            src="https://images.unsplash.com/photo-1766309416197-5982d32f4ce0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkdW1wbGluZ3MlMjBmb29kJTIwZmVzdGl2ZXxlbnwxfHx8fDE3NjY3NDIxMTF8MA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Festive Food"
            className="w-full h-64 object-cover"
          />
        </div>

        {/* Description */}
        <div className="space-y-3">
          <div className="flex items-center justify-center space-x-2 text-gray-700">
            <Heart className="w-5 h-5 text-rose-500" />
            <p className="text-lg">Made with love, delivered with care</p>
          </div>
          <div className="flex items-center justify-center space-x-2 text-gray-700">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <p className="text-lg">Perfect for festive celebrations</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 pt-4">
          <Link to="/login" className="block">
            <Button size="lg" className="w-full h-14 text-lg brand-button">
              Login
            </Button>
          </Link>
          <Link to="/register" className="block">
            <Button size="lg" variant="outline" className="w-full h-14 text-lg border-2 border-orange-500 text-orange-600 hover:bg-orange-50">
              Register
            </Button>
          </Link>
        </div>

        <p className="text-sm text-gray-500 mt-6">
          Order your favorite festive treats today!
        </p>
      </div>
    </div>
  );
}