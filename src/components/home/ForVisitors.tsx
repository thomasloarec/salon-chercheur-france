import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useNewsletterSubscribe } from '@/hooks/useNewsletterSubscribe';
import { Bell, Check } from 'lucide-react';

const ForVisitors = () => {
  const [email, setEmail] = useState('');
  const [sector, setSector] = useState('');
  const [consent, setConsent] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { mutate: subscribe, isPending } = useNewsletterSubscribe();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !sector || !consent) {
      return;
    }

    subscribe(
      { email, sectorIds: [sector] },
      {
        onSuccess: () => {
          setIsSubmitted(true);
          setEmail('');
          setSector('');
          setConsent(false);
        }
      }
    );
  };

  if (isSubmitted) {
    return (
      <section className="bg-[#0B0F19] py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-[#0F1424]/60 backdrop-blur-xl rounded-2xl p-12 border border-white/10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#10B981]/10 rounded-full mb-6">
              <Check className="h-8 w-8 text-[#10B981]" />
            </div>
            <h2 className="text-3xl font-bold text-[#E6EAF3] mb-4">
              Merci de votre inscription !
            </h2>
            <p className="text-[#E6EAF3]/70 text-lg">
              Vous recevrez votre première alerte prochainement avec les nouveautés de votre secteur.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#0B0F19] py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#5B9DFF]/10 rounded-full mb-4">
            <Bell className="h-7 w-7 text-[#5B9DFF]" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-[#E6EAF3] mb-4">
            Ne manquez rien de <span className="text-[#5B9DFF]">votre secteur</span>
          </h2>
          <p className="text-[#E6EAF3]/70 text-lg">
            Recevez les nouveautés des salons qui vous intéressent, directement par email.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#0F1424]/60 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
          <div className="space-y-6">
            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-[#E6EAF3] mb-2 block">
                Adresse email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-[#11182A] border-white/10 text-[#E6EAF3] placeholder:text-[#E6EAF3]/40"
              />
            </div>

            {/* Sector */}
            <div>
              <Label htmlFor="sector" className="text-[#E6EAF3] mb-2 block">
                Choisir mon secteur
              </Label>
              <Select value={sector} onValueChange={setSector} required>
                <SelectTrigger className="bg-[#11182A] border-white/10 text-[#E6EAF3]">
                  <SelectValue placeholder="Sélectionnez un secteur" />
                </SelectTrigger>
                <SelectContent className="bg-[#11182A] border-white/10">
                  <SelectItem value="tech">Technologie & Innovation</SelectItem>
                  <SelectItem value="health">Santé & Médical</SelectItem>
                  <SelectItem value="food">Agroalimentaire</SelectItem>
                  <SelectItem value="fashion">Mode & Textile</SelectItem>
                  <SelectItem value="industry">Industrie</SelectItem>
                  <SelectItem value="construction">BTP & Construction</SelectItem>
                  <SelectItem value="energy">Énergie</SelectItem>
                  <SelectItem value="tourism">Tourisme</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Consent */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(checked) => setConsent(checked === true)}
                className="mt-1 border-white/20 data-[state=checked]:bg-[#5B9DFF]"
              />
              <Label htmlFor="consent" className="text-sm text-[#E6EAF3]/70 cursor-pointer leading-relaxed">
                J'accepte de recevoir les alertes de nouveautés par email et j'ai lu la{' '}
                <a href="/politique-confidentialite" className="text-[#5B9DFF] hover:underline">
                  politique de confidentialité
                </a>
                .
              </Label>
            </div>

            <Button 
              type="submit"
              disabled={!email || !sector || !consent || isPending}
              className="w-full bg-[#5B9DFF] hover:bg-[#5B9DFF]/90 text-white text-lg py-6"
            >
              {isPending ? 'Inscription en cours...' : 'Suivre mon secteur'}
            </Button>

            <p className="text-center text-xs text-[#E6EAF3]/50">
              1 e-mail / mois maximum • Désinscription en 1 clic
            </p>
          </div>
        </form>
      </div>
    </section>
  );
};

export default ForVisitors;
