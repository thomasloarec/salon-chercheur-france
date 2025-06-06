
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, Search } from 'lucide-react';

const CTASection = () => {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="bg-white rounded-2xl p-8 md:p-12 shadow-xl">
          <Bell className="h-16 w-16 text-accent mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6">
            Ne manquez plus aucun salon
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Commencez dès maintenant à explorer tous les salons professionnels en France. 
            Recherchez par secteur, ville ou date pour trouver les événements qui vous intéressent.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Votre secteur d'activité..."
                className="pl-10 h-12"
              />
            </div>
            <Button className="h-12 px-8 bg-accent hover:bg-accent/90">
              Rechercher
            </Button>
          </div>
          
          <p className="text-sm text-gray-500">
            Accès libre et gratuit • Mise à jour quotidienne • Plus de 1200 salons référencés
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
