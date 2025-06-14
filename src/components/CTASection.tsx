
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { Bell } from 'lucide-react';
import { useSectors } from '@/hooks/useSectors';
import { useNewsletterSubscribe } from '@/hooks/useNewsletterSubscribe';

const CTASection = () => {
  const [email, setEmail] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  
  const { data: sectors, isLoading: sectorsLoading } = useSectors();
  const { mutate: subscribe, isPending: isSubscribing } = useNewsletterSubscribe();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || selectedSectors.length === 0) {
      return;
    }

    subscribe({
      email,
      sectorIds: selectedSectors,
    });
  };

  const sectorOptions = sectors?.map(sector => ({
    value: sector.id,
    label: sector.name,
  })) || [];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="bg-white rounded-2xl p-8 md:p-12 shadow-xl">
          <Bell className="h-16 w-16 text-accent mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6">
            Ne manquez plus aucun salon
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Recevez, au début de chaque mois, les salons incontournables de votre secteur ainsi que les nouveaux événements tout juste publiés. 
            Choisissez votre secteur et inscrivez-vous pour ne rien manquer !
          </p>
          
          <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sectors" className="text-left block">
                Secteur d'activité *
              </Label>
              <MultiSelect
                options={sectorOptions}
                selected={selectedSectors}
                onChange={setSelectedSectors}
                placeholder={sectorsLoading ? "Chargement..." : "Sélectionner vos secteurs..."}
                disabled={sectorsLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-left block">
                Adresse e-mail *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="votre.email@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 bg-accent hover:bg-accent/90"
              disabled={isSubscribing || !email || selectedSectors.length === 0}
            >
              {isSubscribing ? 'Abonnement en cours...' : "S'abonner"}
            </Button>
          </form>
          
          <p className="text-sm text-gray-500 mt-6">
            Newsletter gratuite • Envoyée une fois par mois • Désabonnement facile
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
