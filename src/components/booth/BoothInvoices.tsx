import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getBillingOverview } from '@/lib/booth/rpc';
import { formatCents } from './billing';

const fmt = (d: string | null) => {
  if (!d) return '';
  try {
    return format(new Date(d), 'd MMM yyyy', { locale: fr });
  } catch {
    return '';
  }
};

/** Carte « Factures » : n'apparaît que s'il existe au moins un paiement. */
export default function BoothInvoices({ exhibitorId }: { exhibitorId: string }) {
  const q = useQuery({
    queryKey: ['booth-billing', exhibitorId],
    queryFn: () => getBillingOverview(exhibitorId),
    retry: false,
  });
  const payments = q.data?.payments ?? [];
  if (payments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Factures</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0 px-4 md:px-6">
        {payments.map((p) => (
          <div key={p.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {p.plan === 'pass' ? 'Pass salon' : 'Annuel'}
                {p.plan === 'pass' && p.event_name ? ` · ${p.event_name}` : ''}
              </p>
              <p className="text-muted-foreground">
                {fmt(p.paid_at ?? p.created_at)} · {formatCents(p.amount_cents, p.currency)}
                {p.status === 'refunded' && (
                  <Badge variant="secondary" className="ml-2">Remboursé</Badge>
                )}
              </p>
            </div>
            <div className="flex gap-4">
              {p.invoice_url && (
                <a href={p.invoice_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-primary hover:underline">
                  Voir la facture
                </a>
              )}
              {p.invoice_pdf && (
                <a href={p.invoice_pdf} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-primary hover:underline">
                  PDF
                </a>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
