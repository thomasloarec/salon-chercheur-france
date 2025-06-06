
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, MapPin, Calendar } from 'lucide-react';

const HeroSection = () => {
  return (
    <section className="gradient-hero text-white py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center animate-fade-in-up">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Tous les salons professionnels
            <span className="block text-accent">en un seul endroit</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto text-gray-200">
            Ne manquez plus jamais une opportunité business. Découvrez tous les événements B2B en France, 
            filtrés par secteur d'activité et géolocalisation.
          </p>

          {/* Search Bar */}
          <div className="max-w-4xl mx-auto bg-white rounded-lg p-6 shadow-2xl animate-scale-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Secteur d'activité, nom du salon..."
                  className="pl-10 h-12 text-gray-900"
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Ville, région..."
                  className="pl-10 h-12 text-gray-900"
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Date de début..."
                  className="pl-10 h-12 text-gray-900"
                  type="date"
                />
              </div>
            </div>
            <Button className="w-full mt-4 h-12 bg-accent hover:bg-accent/90 text-lg font-semibold">
              Rechercher des salons
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-accent">1200+</div>
              <div className="text-gray-300 mt-2">Salons référencés</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-accent">50+</div>
              <div className="text-gray-300 mt-2">Secteurs d'activité</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-accent">100+</div>
              <div className="text-gray-300 mt-2">Lieux en France</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
