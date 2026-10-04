import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ASSISTANT_ONBOARDING_PATH } from '@/components/assistant/config';
import { track } from '@/lib/analytics';

export default function BlogAgendaCTA({ slug }: { slug?: string }) {
  const { user, loading } = useAuth();
  if (loading || user) return null;

  return (
    <section className="mx-auto px-4 max-w-[960px] mb-14">
      <div className="relative overflow-hidden rounded-2xl bg-surface-inverse text-inverse">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ backgroundImage: 'url(/home-texture-plexus.jpg)', backgroundSize: 'cover', opacity: 0.28 }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: 'radial-gradient(80% 60% at 50% 40%, transparent, hsl(var(--surface-inverse) / 0.85))' }}
        />
        <div className="relative z-10 flex flex-col gap-5 p-6 md:p-8 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 className="heading-display text-[clamp(1.3rem,2.4vw,1.75rem)] leading-tight">
              Ne cherchez plus vos salons.
              <span className="text-inverse-primary"> Ils viennent à vous.</span>
            </h2>
            <p className="mt-2 text-inverse-muted text-[15px] leading-relaxed max-w-[62ch]">
              Créez votre compte en 2 minutes : votre agenda range automatiquement les conférences, les stands
              et les salons qui comptent pour vous. 100 % gratuit, sans carte bancaire.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Button asChild className="h-11 rounded-xl px-6 text-base gap-2">
              <Link to={ASSISTANT_ONBOARDING_PATH} onClick={() => track('blog_agenda_cta_click', { slug })}>
                Créer mon agenda
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Link to="/agenda" className="text-sm font-semibold text-inverse underline-offset-4 hover:underline">
              Découvrir Mon Agenda
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
