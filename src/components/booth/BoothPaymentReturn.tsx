import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { getAccess } from '@/lib/booth/rpc';
import { TEAM_ANCHOR_ID } from '@/features/booth/cockpit/BoothSalonCockpit';
import { accessOpened, readPaymentReturn, startPaymentPolling, type PaymentReturn } from './billing';

type Phase = 'waiting' | 'opened' | 'timeout' | 'cancelled';

/** Bandeau de retour de Stripe : lit l'URL une fois, la nettoie, puis sonde l'ouverture de l'accès. */
export default function BoothPaymentReturn({ exhibitorId }: { exhibitorId: string }) {
  const qc = useQueryClient();
  const [ret] = useState<PaymentReturn>(() =>
    typeof window === 'undefined' ? null : readPaymentReturn(window.location.search).ret,
  );
  const [phase, setPhase] = useState<Phase | null>(ret === 'ok' ? 'waiting' : ret === 'annule' ? 'cancelled' : null);

  useEffect(() => {
    if (!ret) return;
    const { cleaned } = readPaymentReturn(window.location.search);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${cleaned}${window.location.hash}`);
    if (ret !== 'ok') return;
    return startPaymentPolling(
      async () => {
        const a = await getAccess(exhibitorId);
        qc.setQueryData(['booth-access', exhibitorId], a);
        qc.invalidateQueries({ queryKey: ['booth-billing', exhibitorId] });
        return accessOpened(a);
      },
      (r) => setPhase(r),
    );
  }, [ret, exhibitorId, qc]);

  if (!phase) return null;
  const ok = 'rounded-xl border border-success-bright/40 bg-booth-good-bg p-4 text-sm font-medium text-foreground';
  const neutral = 'rounded-xl border border-border bg-muted/50 p-4 text-sm font-medium text-foreground';

  if (phase === 'cancelled') return <div role="status" className={neutral}>Paiement annulé : rien n'a été débité.</div>;
  if (phase === 'waiting') return <div role="status" className={ok}>Paiement reçu. Ouverture de votre accès…</div>;
  if (phase === 'timeout')
    return (
      <div role="status" className={neutral}>
        Le paiement est bien reçu ; l'ouverture prend un peu plus de temps. Rechargez la page dans une minute.
      </div>
    );
  return (
    <div role="status" className={`${ok} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
      <span>Votre accès est ouvert. Invitez votre équipe.</span>
      <Button
        size="sm"
        className="min-h-[44px] rounded-xl"
        onClick={() => document.getElementById(TEAM_ANCHOR_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      >
        Inviter mon équipe
      </Button>
    </div>
  );
}
