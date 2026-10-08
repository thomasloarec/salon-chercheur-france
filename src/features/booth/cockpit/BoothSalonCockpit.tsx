import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, Circle, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useExhibitorParticipations } from '@/hooks/useExhibitorParticipations';
import {
  boothErrorMessage,
  listMembers,
  listWorkspaces,
  workspacesSummary,
  type BoothWorkspace,
} from '@/lib/booth/rpc';
import { buildCockpit, type CockpitCard } from './cockpit';

interface Props {
  exhibitorId: string;
  onPrepare?: (eventId: string) => void;
  onCreate?: () => void;
  onEdit?: (ws: BoothWorkspace) => void;
}

export const TEAM_ANCHOR_ID = 'booth-team-panel';

const todayYmd = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const fmtDate = (d: string | null) => {
  if (!d) return '';
  try {
    return format(new Date(d), 'd MMM yyyy', { locale: fr });
  } catch {
    return '';
  }
};
const fmtRange = (a: string | null, b: string | null) =>
  !a ? '' : !b || a.slice(0, 10) === b.slice(0, 10) ? fmtDate(a) : `${fmtDate(a)} au ${fmtDate(b)}`;
const euro = (n: number | null | undefined) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n ?? 0);
const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n > 1 ? p : s}`;

const inDays = (n: number | undefined) =>
  n == null ? 'Avant le salon' : n === 0 ? "Aujourd'hui" : n === 1 ? 'Demain' : `Dans ${n} jours`;

function CardHead({ c, pill }: { c: CockpitCard; pill: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        {c.event.slug ? (
          <Link to={`/events/${c.event.slug}`} className="font-medium text-foreground hover:underline">
            {c.event.nom_event}
          </Link>
        ) : (
          <span className="font-medium text-foreground">{c.event.nom_event}</span>
        )}
        <p className="text-xs text-muted-foreground">
          {[c.event.ville, fmtRange(c.event.date_debut, c.event.date_fin)].filter(Boolean).join(' · ')}
        </p>
      </div>
      {pill}
    </div>
  );
}

function CheckRow({ ok, label, onClick }: { ok: boolean; label: string; onClick?: () => void }) {
  const icon = ok ? (
    <Check className="h-4 w-4 shrink-0 text-primary" />
  ) : (
    <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
  );
  if (!ok && onClick) {
    return (
      <li>
        <button type="button" onClick={onClick} className="flex min-h-[44px] w-full items-center gap-2 text-left text-sm text-primary hover:underline">
          {icon}
          {label}
        </button>
      </li>
    );
  }
  return (
    <li className="flex min-h-[44px] items-center gap-2 text-sm text-foreground">
      {icon}
      {label}
    </li>
  );
}

function SalonLink({ id, label, variant = 'default', className = '' }: { id: string; label: string; variant?: 'default' | 'outline'; className?: string }) {
  return (
    <Button asChild variant={variant} className={`min-h-[44px] ${className}`}>
      <Link to={id}>{label}</Link>
    </Button>
  );
}

export default function BoothSalonCockpit({ exhibitorId, onPrepare, onCreate, onEdit }: Props) {
  const wsQuery = useQuery({ queryKey: ['booth-workspaces', exhibitorId], queryFn: () => listWorkspaces(exhibitorId) });
  const isManager = wsQuery.data?.role === 'manager';

  const summaryQuery = useQuery({
    queryKey: ['booth-summary', exhibitorId],
    queryFn: async () => {
      try {
        return (await workspacesSummary(exhibitorId))?.items ?? null;
      } catch {
        return null; // BOOTH_PLAN_REQUIRED ou autre : on continue sans chiffres
      }
    },
    enabled: isManager,
    staleTime: 60_000,
  });
  const membersQuery = useQuery({
    queryKey: ['booth-members', exhibitorId],
    queryFn: () => listMembers(exhibitorId),
    enabled: isManager,
    retry: false,
  });
  const { data: participations = [] } = useExhibitorParticipations(isManager ? exhibitorId : '');

  const summary = isManager ? summaryQuery.data ?? null : null;
  const activeMembers = (membersQuery.data?.items ?? []).filter((m) => m.status === 'active').length;

  const cards = useMemo(
    () =>
      buildCockpit({
        workspaces: wsQuery.data?.items ?? [],
        upcoming: isManager && onPrepare ? participations : [],
        summary,
        today: todayYmd(),
      }),
    [wsQuery.data, participations, summary, isManager, onPrepare],
  );

  const overdueTotal = summary
    ? summary.filter((s) => !s.archived).reduce((n, s) => n + (s.actions_overdue ?? 0), 0)
    : null;
  const next = cards
    .filter((c) => (c.kind === 'before' || c.kind === 'prepare') && c.daysUntil != null)
    .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0))[0];

  const copyLink = async (wsId: string) => {
    const url = `${window.location.origin}/salon/${wsId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié');
    } catch {
      toast.error(url);
    }
  };
  const scrollTeam = () => document.getElementById(TEAM_ANCHOR_ID)?.scrollIntoView({ behavior: 'smooth' });

  const renderCard = (c: CockpitCard) => {
    const w = c.workspace;
    const s = c.summary;
    const key = w?.workspace_id ?? `p-${c.event.id}`;

    if (c.kind === 'prepare') {
      return (
        <div key={key} className="space-y-3 rounded-md border border-border p-4">
          <CardHead c={c} pill={<Badge variant="secondary">À préparer</Badge>} />
          <p className="text-sm text-muted-foreground">
            Vous exposez {c.daysUntil === 0 ? "aujourd'hui" : c.daysUntil === 1 ? 'demain' : `dans ${c.daysUntil ?? '?'} jours`}. Préparez l'espace du salon pour que votre équipe y enregistre ses rencontres.
          </p>
          {onPrepare && (
            <Button className="min-h-[44px] w-full md:w-auto" onClick={() => onPrepare(c.event.id)}>
              Préparer ce salon
            </Button>
          )}
        </div>
      );
    }
    if (!w) return null;
    const salon = `/salon/${w.workspace_id}`;
    const editBtn = isManager && onEdit && (
      <Button variant="outline" className="min-h-[44px]" onClick={() => onEdit(w)}>
        Modifier
      </Button>
    );

    if (c.kind === 'before') {
      return (
        <div key={key} className="space-y-3 rounded-md border border-border p-4">
          <CardHead c={c} pill={<Badge variant="secondary">{inDays(c.daysUntil)}</Badge>} />
          {isManager && (
            <ul>
              <CheckRow ok={!!w.stand_label} label={w.stand_label ? `Stand : ${w.stand_label}` : 'Stand à renseigner'} onClick={onEdit ? () => onEdit(w) : undefined} />
              <CheckRow ok={w.total_cost != null} label={w.total_cost != null ? 'Coût du salon renseigné' : 'Coût du salon à renseigner'} onClick={onEdit ? () => onEdit(w) : undefined} />
              <CheckRow ok={activeMembers > 1} label={activeMembers > 1 ? `Équipe : ${plural(activeMembers, 'membre')}` : 'Invitez votre équipe'} onClick={scrollTeam} />
            </ul>
          )}
          <p className="text-sm text-muted-foreground">Installez le mode salon sur chaque téléphone avant le salon.</p>
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
            <SalonLink id={salon} label="Ouvrir le mode salon" />
            <Button variant="outline" className="min-h-[44px]" onClick={() => copyLink(w.workspace_id)}>
              Copier le lien du mode salon
            </Button>
            {editBtn}
          </div>
        </div>
      );
    }

    if (c.kind === 'during') {
      const day = c.dayIndex && c.dayCount ? ` · Jour ${c.dayIndex} sur ${c.dayCount}` : '';
      return (
        <div key={key} className="space-y-3 rounded-md border-2 border-primary p-4 lg:col-span-2">
          <CardHead c={c} pill={<Badge>En cours{day}</Badge>} />
          {s ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                [s.meetings, 'rencontres'],
                [s.hot, 'prospects chauds'],
                [s.actions_open, 'actions à faire'],
              ].map(([n, l]) => (
                <div key={l as string} className="rounded-md bg-muted/50 p-2">
                  <div className="text-xl font-semibold text-foreground">{n}</div>
                  <div className="text-xs text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {plural(w.interactions_count, 'rencontre enregistrée', 'rencontres enregistrées')}
            </p>
          )}
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
            <SalonLink id={salon} label="Ouvrir le mode salon" className="min-h-[52px] text-base md:flex-1" />
            {w.full_features && <SalonLink id={`${salon}?ecran=tableau`} label="Tableau de bord" variant="outline" />}
            {editBtn}
          </div>
        </div>
      );
    }

    // after
    const since =
      c.daysSince == null ? 'Terminé' : c.daysSince <= 1 ? 'Terminé hier' : `Terminé il y a ${c.daysSince} jours`;
    const hasActions = s ? s.actions_open > 0 : true;
    const roi = s && w.total_cost && w.total_cost > 0 && (s.won_amount ?? 0) > 0 ? (s.won_amount ?? 0) / w.total_cost : null;
    return (
      <div key={key} className="space-y-3 rounded-md border border-border p-4">
        <CardHead
          c={c}
          pill={c.done ? <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Bilan à jour</Badge> : <Badge variant="secondary">{since}</Badge>}
        />
        {isManager && s && (
          <div className="space-y-1 text-sm text-foreground">
            <p>
              Relances : {s.actions_open} à faire
              {s.actions_overdue > 0 && (
                <>
                  , dont <span className="font-medium text-orange-600 dark:text-orange-400">{s.actions_overdue} en retard</span>
                </>
              )}
            </p>
            <p>
              Projets : {s.projects} · pipeline pondéré {euro(s.weighted_amount)} · gagné {euro(s.won_amount)}
            </p>
            {roi != null && <p>Retour : × {roi.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</p>}
          </div>
        )}
        {isManager && !s && (
          <p className="text-sm text-muted-foreground">
            Le suivi des relances et le bilan sont inclus dans la bêta, le Pass Salon et l'Annuel.
          </p>
        )}
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
          {isManager ? (
            <>
              {hasActions && <SalonLink id={`${salon}?ecran=actions`} label="Actions à faire" />}
              {w.full_features && (
                <SalonLink id={`${salon}?ecran=bilan`} label="Bilan du salon" variant={hasActions ? 'outline' : 'default'} />
              )}
            </>
          ) : (
            <SalonLink id={`${salon}?ecran=actions`} label="Mes actions à faire" />
          )}
          {editBtn}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Vos salons</CardTitle>
        {isManager && onCreate && (
          <Button size="sm" className="min-h-[44px]" onClick={onCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Créer l'espace d'un salon
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {wsQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : wsQuery.isError ? (
          <div className="space-y-2 text-sm">
            <p className="text-destructive">{boothErrorMessage(wsQuery.error)}</p>
            <Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => wsQuery.refetch()}>
              Réessayer
            </Button>
          </div>
        ) : cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun salon pour l'instant.</p>
        ) : (
          <>
            {isManager && summary && (overdueTotal || next) ? (
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {overdueTotal != null && (
                  <span className={overdueTotal > 0 ? 'font-medium text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}>
                    Relances en retard : {overdueTotal}
                  </span>
                )}
                {next && (
                  <span className="text-muted-foreground">
                    Prochain salon : {next.event.nom_event} {next.daysUntil === 0 ? "aujourd'hui" : next.daysUntil === 1 ? 'demain' : `dans ${next.daysUntil} jours`}
                  </span>
                )}
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{cards.map(renderCard)}</div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
