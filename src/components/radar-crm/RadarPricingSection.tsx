import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import ConnectCrmDialog from '@/components/crm/ConnectCrmDialog';
import { Sparkles } from 'lucide-react';

interface RadarPricing {
  seats_sold: number;
  tier: number;
  discount_pct: number;
  price_month: number;
  price_year: number;
  full_price_month: number;
  full_price_year: number;
  tier_capacity: number;
  seats_remaining: number;
  is_last_tier: boolean;
}

interface RadarPricingSectionProps {
  /** Chemin de retour après authentification (passé à ConnectCrmDialog). */
  redirectPath?: string;
  /** Variante visuelle : pleine largeur navy ou card encastrée. */
  variant?: 'navy' | 'card';
}

const formatPrice = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const RadarPricingSection: React.FC<RadarPricingSectionProps> = ({
  redirectPath = '/radar-crm',
  variant = 'navy',
}) => {
  const [pricing, setPricing] = useState<RadarPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('get_radar_crm_pricing');
        if (cancelled) return;
        if (rpcError) throw rpcError;
        setPricing((data as unknown as RadarPricing) ?? null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement du tarif');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const placesText = (() => {
    if (!pricing) return null;
    if (pricing.is_last_tier) return 'Tarif standard.';
    if (pricing.seats_remaining > 0) {
      return `Tarif réservé aux premières entreprises inscrites. Plus que ${pricing.seats_remaining} entreprise${pricing.seats_remaining > 1 ? 's' : ''} à ce tarif de lancement.`;
    }
    return 'Tarif de lancement complet.';
  })();

  const wrapperClass =
    variant === 'navy'
      ? 'bg-surface-inverse text-inverse'
      : 'rounded-3xl bg-surface-inverse text-inverse';

  return (
    <section className={wrapperClass}>
      <div className="mx-auto max-w-5xl px-4 py-14 md:py-20">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-inverse">
              Tarif de lancement
            </p>
            <h2 className="heading-display mb-4 text-2xl text-inverse md:text-3xl">
              Faites partie des premières entreprises et bloquez un tarif réduit à vie, par
              utilisateur.
            </h2>
            {placesText && (
              <p className="mt-4 flex items-center gap-2 text-sm font-medium text-surface-accent">
                <Sparkles className="h-4 w-4" />
                {placesText}
              </p>
            )}
            {error && (
              <p className="mt-4 text-sm text-destructive-foreground">{error}</p>
            )}
          </div>

          <div className="rounded-2xl border border-inverse/10 bg-inverse/5 p-6 md:p-8">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-16 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : pricing ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {pricing.discount_pct > 0 && (
                    <Badge className="bg-surface-accent text-surface-accent-foreground">
                      −{pricing.discount_pct} %
                    </Badge>
                  )}
                  {pricing.discount_pct > 0 && (
                    <span className="text-sm text-inverse/60 line-through">
                      au lieu de {formatPrice(pricing.full_price_month)} € par utilisateur / mois
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-display text-5xl font-semibold text-inverse">
                    {formatPrice(pricing.price_month)} €
                  </span>
                  <span className="text-sm text-inverse/80">par utilisateur / mois</span>
                </div>
                <p className="mt-1 text-sm text-inverse/70">
                  facturé annuellement, soit {formatPrice(pricing.price_year)} € par utilisateur / an
                </p>

                <p className="mt-4 text-sm text-inverse/80">
                  Vous payez par utilisateur. Chaque commercial que vous ajoutez à votre espace
                  bénéficie du tarif de lancement de votre entreprise. Par exemple, 3 commerciaux au
                  tarif ci-dessus reviennent à 3 × {formatPrice(pricing.price_month)} € par mois.
                </p>

                <Button
                  size="lg"
                  className="mt-6 w-full rounded-full px-7 sm:w-auto"
                  onClick={() => setConnectOpen(true)}
                >
                  Essayez gratuitement pendant 7 jours
                </Button>
              </>
            ) : (
              <p className="text-sm text-inverse/70">
                Tarif indisponible pour le moment. Rechargez la page ou contactez-nous.
              </p>
            )}
          </div>
        </div>
      </div>

      <ConnectCrmDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        redirectPath={redirectPath}
      />
    </section>
  );
};

export default RadarPricingSection;
