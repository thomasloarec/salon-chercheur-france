import { Check, X, Users } from 'lucide-react';
import { LEADS_FEATURES, LEADS_PLANS, LEADS_PLANS_NOTE } from '@/config/leadsPlans';
import { Reveal } from '@/components/ui/reveal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const BETA_LABELS: Record<string, string> = {
  free: 'Commencer gratuitement',
  salon: 'Rejoindre la bêta',
  annual: 'Rejoindre la bêta',
};

interface Props {
  onJoin?: () => void;
  /** Libellé si l'accès Leads est déjà ouvert : « Ouvrir Lotexpo Leads ». */
  ctaLabel?: string;
  hasLeadsAccess?: boolean;
}

export default function LeadsPricingCards({ onJoin, ctaLabel, hasLeadsAccess }: Props) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {LEADS_PLANS.map((p, i) => (
          <Reveal key={p.id} delay={i * 80} className="h-full">
            <div
              data-plan={p.id}
              className={cn(
                'relative flex h-full flex-col rounded-2xl bg-card p-6 shadow-sm',
                p.featured ? 'border-[1.5px] border-primary' : 'border border-border',
              )}
            >
              {p.badge && (
                <span className="absolute -top-3 left-6 rounded-full bg-booth-good-bg px-3 py-0.5 text-xs font-medium text-primary-deep">
                  {p.badge}
                </span>
              )}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-2">
                <span className="text-3xl font-semibold">{p.price}</span>
                {p.priceUnit && <span className="ml-1.5 text-sm text-muted-foreground">{p.priceUnit}</span>}
              </p>
              <p className="mt-1 text-sm text-muted-foreground md:min-h-[2.5rem]">{p.tagline}</p>
              <div className="mt-4 rounded-lg bg-booth-canvas px-3 py-2">
                <p className="flex items-center gap-2 font-medium">
                  <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {p.seatsLabel}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {p.seats === 1 ? "L'administrateur de la fiche exposant" : 'Vous invitez les commerciaux du stand'}
                </p>
              </div>
              <ul className="mb-6 mt-4 text-sm">
                {LEADS_FEATURES.map((f) => {
                  const ok = !!p.includes[f.id];
                  return (
                    <li key={f.id} data-feature={f.id} className="flex min-h-[32px] items-center gap-2">
                      {ok ? (
                        <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      ) : (
                        <X data-excluded="" className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                      )}
                      <span className={cn('md:truncate', !ok && 'text-muted-foreground')}>
                        {f.label}
                        {!ok && <span className="sr-only"> (non inclus)</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Button
                onClick={onJoin}
                variant={p.featured ? 'default' : 'outline'}
                className="mt-auto h-auto min-h-[44px] w-full whitespace-normal rounded-xl text-base shadow-none"
              >
                {hasLeadsAccess && ctaLabel ? ctaLabel : BETA_LABELS[p.id]}
              </Button>
            </div>
          </Reveal>
        ))}
      </div>
      <p className="mt-4 text-center text-sm">Un siège = un utilisateur connecté. Les administrateurs de la fiche exposant gèrent les invitations.</p>
      <p className="mt-2 text-center text-sm text-muted-foreground">{LEADS_PLANS_NOTE}</p>
    </>
  );
}
