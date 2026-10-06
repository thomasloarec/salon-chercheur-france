import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useBoothContext } from '@/hooks/useBoothContext';
import BoothTeamPanel from '@/components/booth/BoothTeamPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { boothErrorMessage, listWorkspaces, type BoothContextItem, type BoothPhase } from '@/lib/booth/rpc';

const PHASE_LABEL: Record<BoothPhase, string | null> = {
  before: 'Avant le salon',
  during: 'Pendant le salon',
  after: 'Après le salon',
  unknown: null,
};

const fmt = (d: string | null) => (d ? format(new Date(d), 'd MMM yyyy', { locale: fr }) : null);

function Workspaces({ exhibitorId }: { exhibitorId: string }) {
  const q = useQuery({ queryKey: ['booth-workspaces', exhibitorId], queryFn: () => listWorkspaces(exhibitorId) });
  if (q.isLoading) return <Skeleton className="h-16 w-full" />;
  if (q.isError)
    return (
      <div className="text-sm space-y-2">
        <p className="text-destructive">{boothErrorMessage(q.error)}</p>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}>
          Réessayer
        </Button>
      </div>
    );
  const items = (q.data?.items ?? []).filter((w) => !w.archived);
  if (items.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Aucun salon ouvert pour l'instant. Votre responsable crée les espaces salon.
      </p>
    );
  return (
    <ul className="space-y-2">
      {items.map((w) => {
        const dates = [fmt(w.date_debut), fmt(w.date_fin)].filter(Boolean).join(' au ');
        const phase = PHASE_LABEL[w.phase];
        return (
          <li key={w.workspace_id} className="rounded-md border p-3 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{w.nom_event}</span>
              {phase && <Badge variant="secondary">{phase}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {[w.ville, dates, w.stand_label ? `Stand ${w.stand_label}` : null].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs text-muted-foreground">
              {w.interactions_count} rencontre{w.interactions_count > 1 ? 's' : ''}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function CompanyCard({ c }: { c: BoothContextItem }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        {c.logo_url ? (
          <img src={c.logo_url} alt="" className="h-10 w-10 rounded-md object-contain border bg-background" />
        ) : (
          <div className="h-10 w-10 rounded-md bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base truncate">{c.exhibitor_name}</CardTitle>
        </div>
        {c.role && <Badge variant="secondary">{c.role === 'manager' ? 'Manager' : 'Commercial terrain'}</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        {c.role === null ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800">
            Votre accès est suspendu : la formule de l'entreprise n'inclut plus l'équipe ou l'accès a été retiré.
            Contactez votre responsable.
          </div>
        ) : (
          <>
            <Workspaces exhibitorId={c.exhibitor_id} />
            {c.is_fiche_manager && c.exhibitor_slug && (
              <Link
                to={`/exposants/${c.exhibitor_slug}/gerer?section=leads`}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Gérer dans l'espace exposant
              </Link>
            )}
            {c.role === 'manager' && !c.is_fiche_manager && (
              <BoothTeamPanel exhibitorId={c.exhibitor_id} isPaid={c.is_paid} />
            )}
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-800">
              L'application de saisie sur le stand arrive très bientôt sur cette page.
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function LeadsHome() {
  const navigate = useNavigate();
  const { isRealUser, loading } = useAuth();
  const q = useBoothContext();

  useEffect(() => {
    if (!loading && !isRealUser) navigate(`/auth?redirect=${encodeURIComponent('/leads')}`, { replace: true });
  }, [loading, isRealUser, navigate]);

  const items = q.data ?? [];

  return (
    <MainLayout title="Lotexpo Leads">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div>
          <h1 className="heading-display text-2xl text-foreground">Lotexpo Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">Vos équipes et vos salons.</p>
        </div>
        {loading || !isRealUser || q.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Vous ne faites encore partie d'aucune équipe Lotexpo Leads. Si vous avez reçu une invitation, ouvrez le
              lien de l'email.
            </CardContent>
          </Card>
        ) : (
          items.map((c) => <CompanyCard key={c.exhibitor_id} c={c} />)
        )}
      </div>
    </MainLayout>
  );
}
