import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { Mail } from 'lucide-react';
import { useSectors } from '@/hooks/useSectors';
import { useNewsletterSubscribe } from '@/hooks/useNewsletterSubscribe';

const NewsletterImproved = () => {
  const [email, setEmail] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const { data: sectors = [] } = useSectors();
  const { mutate: subscribe, isPending } = useNewsletterSubscribe();

  const sectorOptions = sectors.map(s => ({
    value: s.id,
    label: s.name,
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || selectedSectors.length === 0) {
      return;
    }

    subscribe({
      email,
      sectorIds: selectedSectors,
    }, {
      onSuccess: () => {
        setEmail('');
        setSelectedSectors([]);
      }
    });
  };

  return (
    <section className="bg-gradient-to-br from-accent/10 via-primary/10 to-accent/10 py-20 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-8">
          <Mail className="h-16 w-16 text-accent mx-auto mb-4" />
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Ne manquez rien de votre secteur
          </h2>
          <p className="text-xl text-muted-foreground">
            Recevez chaque mois les nouveaux salons et nouveautés de vos secteurs d'activité
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="space-y-4">
              <Input
                type="email"
                placeholder="Votre email professionnel"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 text-lg"
              />

              <MultiSelect
                options={sectorOptions}
                selected={selectedSectors}
                onChange={setSelectedSectors}
                placeholder="Sélectionnez vos secteurs d'activité *"
                className="h-12"
              />

              <p className="text-sm text-muted-foreground text-left">
                Vous pouvez vous abonner à plusieurs secteurs. 1 e-mail / mois, désinscription en 1 clic.
              </p>

              <Button 
                type="submit"
                disabled={isPending || !email || selectedSectors.length === 0}
                className="w-full h-12 bg-accent hover:bg-accent/90 text-lg font-semibold"
              >
                {isPending ? 'Inscription en cours...' : 'S\'abonner à la newsletter'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
};

export default NewsletterImproved;
