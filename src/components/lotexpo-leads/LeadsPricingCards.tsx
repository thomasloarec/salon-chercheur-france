import { Check } from 'lucide-react';
import { LEADS_PLANS, LEADS_PLANS_NOTE } from '@/config/leadsPlans';
import { cn } from '@/lib/utils';

export default function LeadsPricingCards() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {LEADS_PLANS.map((p) => (
          <div
            key={p.id}
            data-plan={p.id}
            className={cn(
              'relative flex flex-col rounded-2xl bg-card p-6 shadow-sm',
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
            <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">{LEADS_PLANS_NOTE}</p>
    </>
  );
}
