import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ASSISTANT_ONBOARDING_PATH } from '@/components/assistant/config';
import { AgendaDemoMock } from '@/components/assistant/AgendaLanding';
import { track } from '@/lib/analytics';

const POINTS = [
  'Vos sujets et vos régions en 2 minutes',
  'Un récap par email le mardi, si vous le souhaitez',
  '100 % gratuit, sans carte bancaire',
];

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
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.1fr_.9fr] gap-8 p-7 md:p-10 items-center">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-inverse/20 bg-inverse/5 pl-2 pr-4 py-1.5 text-sm font-semibold text-inverse">
              <span className="rounded-full bg-inverse-primary px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-surface-inverse">
                Gratuit
              </span>
              Votre assistant salons
            </span>
            <h2 className="heading-display mt-4 text-[clamp(1.6rem,3vw,2.3rem)] leading-tight">
              Ne cherchez plus vos salons.
              <span className="block text-inverse-primary">Ils viennent à vous.</span>
            </h2>
            <p className="mt-4 text-inverse-muted text-[15px] leading-relaxed max-w-[52ch]">
              Créez votre compte et dites ce qui vous intéresse. L'IA de Lotexpo lit les programmes des salons et
              les Nouveautés des exposants, puis range dans votre agenda les conférences, les stands et les salons
              qui comptent pour vous.{' '}
              <span className="text-inverse font-semibold">Plus besoin de faire votre veille.</span>
            </p>
            <ul className="mt-5 space-y-2 text-sm font-medium text-inverse">
              {POINTS.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-inverse-primary" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild className="h-12 rounded-xl px-6 text-base gap-2">
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
          <div className="min-w-0">
            <AgendaDemoMock />
          </div>
        </div>
      </div>
    </section>
  );
}
