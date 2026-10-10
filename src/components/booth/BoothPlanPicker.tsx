import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  boothErrorMessage,
  getBillingOverview,
  startCheckout,
  type BoothBillingOverview,
  type BoothCheckoutPlan,
} from '@/lib/booth/rpc';
import { formatCents, runCheckout, vatMention } from './billing';

export interface PlanPickerEvent {
  id: string;
  name: string;
}

interface ViewProps {
  overview: BoothBillingOverview;
  upcoming: PlanPickerEvent[];
  /** 'both' par défaut ; 'annual' pour la prolongation seule. */
  show?: 'both' | 'annual';
  annualActive?: boolean;
  initialEventId?: string | null;
  initialError?: string | null;
  onPay?: (plan: BoothCheckoutPlan, eventId: string | null) => Promise<void>;
}

const card = 'flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:p-5';

export function BoothPlanPickerView({
  overview,
  upcoming,
  show = 'both',
  annualActive = false,
  initialEventId = null,
  initialError = null,
  onPay,
}: ViewProps) {
  const [eventId, setEventId] = useState<string | null>(initialEventId);
  const [busy, setBusy] = useState<BoothCheckoutPlan | null>(null);
  const [error, setError] = useState<{ plan: BoothCheckoutPlan | 'any'; msg: string } | null>(
    initialError ? { plan: 'any', msg: boothErrorMessage(initialError) } : null,
  );
  const pass = formatCents(overview.pass_amount_cents, overview.currency);
  const annual = formatCents(overview.annual_amount_cents, overview.currency);

  const pay = async (plan: BoothCheckoutPlan) => {
    if (!onPay || busy) return;
    setBusy(plan);
    setError(null);
    try {
      await onPay(plan, plan === 'pass' ? eventId : null);
    } catch (e) {
      setError({ plan, msg: boothErrorMessage(e) });
      setBusy(null);
    }
  };

  const errFor = (plan: BoothCheckoutPlan) =>
    error && (error.plan === plan || error.plan === 'any') ? (
      <p role="alert" className="text-sm text-destructive">{error.msg}</p>
    ) : null;

  return (
    <div className="space-y-3">
      {!overview.livemode && (
        <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Mode test : utilisez la carte 4242 4242 4242 4242, date future, code 123.
        </p>
      )}
      <div className={`grid grid-cols-1 gap-3 ${show === 'both' ? 'md:grid-cols-2' : ''}`}>
        {show === 'both' && (
          <div className={card}>
            <div>
              <p className="font-semibold text-foreground">Pass salon</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{pass}</p>
              <p className="text-sm font-medium text-muted-foreground">par salon, jusqu'à 15 utilisateurs</p>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ajoutez d'abord votre prochain salon à votre fiche exposant</p>
            ) : (
              <Select value={eventId ?? undefined} onValueChange={setEventId}>
                <SelectTrigger aria-label="Salon">
                  <SelectValue placeholder="Choisissez le salon" />
                </SelectTrigger>
                <SelectContent>
                  {upcoming.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Valable jusqu'à {overview.pass_grace_days} jours après la fin du salon, pour vos relances et votre export.
            </p>
            <Button
              className="mt-auto h-auto min-h-[44px] w-full whitespace-normal rounded-xl"
              disabled={!eventId || !!busy || !onPay}
              onClick={() => pay('pass')}
              data-plan="pass"
            >
              {busy === 'pass' ? 'Ouverture du paiement…' : `Payer ${pass}`}
            </Button>
            {errFor('pass')}
          </div>
        )}
        <div className={card}>
          <div>
            <p className="font-semibold text-foreground">Annuel</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{annual}</p>
            <p className="text-sm font-medium text-muted-foreground">
              12 mois, tous vos salons, jusqu'à 15 utilisateurs, accompagnement au premier salon
            </p>
          </div>
          <Button
            className="mt-auto h-auto min-h-[44px] w-full whitespace-normal rounded-xl"
            variant={show === 'both' ? 'outline' : 'default'}
            disabled={!!busy || !onPay}
            onClick={() => pay('annual')}
            data-plan="annual"
          >
            {busy === 'annual'
              ? 'Ouverture du paiement…'
              : annualActive
                ? `Prolonger de 12 mois · ${annual}`
                : `Choisir l'Annuel · Payer ${annual}`}
          </Button>
          {errFor('annual')}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{vatMention(overview.vat_mode)}</p>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Paiement sécurisé par Stripe. L'accès s'ouvre dès le paiement validé.
      </p>
    </div>
  );
}

interface Props {
  exhibitorId: string;
  upcoming: PlanPickerEvent[];
  show?: 'both' | 'annual';
  annualActive?: boolean;
}

export default function BoothPlanPicker({ exhibitorId, upcoming, show, annualActive }: Props) {
  const q = useQuery({
    queryKey: ['booth-billing', exhibitorId],
    queryFn: () => getBillingOverview(exhibitorId),
    retry: false,
  });

  if (q.isLoading) return <Skeleton className="h-48 w-full" />;
  if (q.isError || !q.data) {
    const forbidden = String((q.error as Error)?.message ?? '').includes('BOOTH_FORBIDDEN');
    return (
      <p className="text-sm text-muted-foreground">
        {forbidden ? 'Seuls les administrateurs de la fiche peuvent choisir une formule.' : boothErrorMessage(q.error)}
      </p>
    );
  }

  return (
    <BoothPlanPickerView
      overview={q.data}
      upcoming={upcoming}
      show={show}
      annualActive={annualActive}
      onPay={(plan, eventId) =>
        runCheckout((p, e) => startCheckout(exhibitorId, p, e), plan, eventId, (url) => window.location.assign(url))
      }
    />
  );
}
