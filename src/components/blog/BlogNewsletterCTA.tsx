import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { Mail, CheckCircle2, CalendarDays, TrendingUp } from 'lucide-react';
import { useSectors } from '@/hooks/useSectors';
import { useNewsletterSubscribe } from '@/hooks/useNewsletterSubscribe';

const BlogNewsletterCTA = () => {
  const [email, setEmail] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const { data: sectors = [] } = useSectors();
  const { mutate: subscribe, isPending } = useNewsletterSubscribe();

  const sectorOptions = sectors.map(s => ({
    value: s.id,
    label: s.name,
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || selectedSectors.length === 0) return;

    subscribe(
      { email, sectorIds: selectedSectors },
      {
        onSuccess: () => {
          setSubscribed(true);
          setEmail('');
          setSelectedSectors([]);
        },
      }
    );
  };

  if (subscribed) {
    return (
      <section className="mx-auto px-4 max-w-[720px] mb-14">
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 p-8 md:p-10 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.08),transparent_50%)]" />
          <div className="relative">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-foreground mb-2">
              Vous êtes inscrit ! 🎉
            </h3>
            <p className="text-muted-foreground">
              Vous recevrez votre première newsletter dès le mois prochain. À bientôt !
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto px-4 max-w-[720px] mb-14">
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.08),transparent_50%)]" />

        <div className="relative p-8 md:p-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Newsletter gratuite
            </span>
          </div>

          <h3 className="text-2xl md:text-[28px] font-bold text-foreground mb-2 leading-tight">
            Restez informé des prochains salons
          </h3>
          <p className="text-muted-foreground text-[15px] leading-relaxed mb-6 max-w-[540px]">
            Chaque mois, recevez la liste complète des salons professionnels à venir dans vos secteurs d'activité. Gratuit, sans spam, désinscription en 1 clic.
          </p>

          {/* Benefits */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-7 text-sm text-foreground/70">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-primary/70" />
              1 e-mail par mois
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary/70" />
              Tous les salons du mois
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary/70" />
              100 % gratuit
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="email"
                placeholder="Votre adresse e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 flex-1 bg-background/80 backdrop-blur-sm border-border/60"
              />
            </div>

            <MultiSelect
              options={sectorOptions}
              selected={selectedSectors}
              onChange={setSelectedSectors}
              placeholder="Choisissez vos secteurs d'activité"
              className="bg-background/80 backdrop-blur-sm border-border/60"
            />

            <Button
              type="submit"
              disabled={isPending || !email || selectedSectors.length === 0}
              className="w-full sm:w-auto h-11 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all duration-200 hover:shadow-md"
            >
              {isPending ? 'Inscription…' : 'S\'inscrire gratuitement'}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default BlogNewsletterCTA;
