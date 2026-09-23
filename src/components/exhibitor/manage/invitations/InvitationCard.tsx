import { Link } from 'react-router-dom';
import { CalendarCheck, Clock, Lock, MapPin, PauseCircle, Pencil, Plus, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { dateRangeLabel, parseLocalDate } from '@/components/invitation/invitationDates';
import type { InvitationOverviewRow, InvitationState } from '@/hooks/useInvitationPages';

import SharePanel from './SharePanel';

const STATE_BADGE: Record<InvitationState, { label: string; className: string }> = {
  locked: { label: 'Verrouillée', className: 'bg-muted text-muted-foreground' },
  pending: { label: 'En attente', className: 'bg-warning-surface text-warning-foreground border border-warning/40' },
  ready: { label: 'À créer', className: 'bg-violet-soft text-foreground' },
  draft: { label: 'Brouillon', className: 'bg-muted text-foreground' },
  online: { label: 'En ligne', className: 'bg-primary text-primary-foreground' },
  suspended: { label: 'Hors ligne', className: 'bg-danger-surface text-danger' },
  ended: { label: 'Terminée', className: 'bg-muted text-muted-foreground' },
};

function DateTile({ date }: { date: string }) {
  const d = parseLocalDate(date);
  if (!d) return null;
  return (
    <div className="hidden sm:block w-14 shrink-0 rounded-xl border border-border bg-background text-center overflow-hidden" aria-hidden>
      <div className="bg-surface-inverse text-inverse text-[10px] font-bold uppercase tracking-wider py-0.5">
        {d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}
      </div>
      <div className="text-2xl font-semibold tabular-nums leading-none py-1.5">{d.getDate()}</div>
    </div>
  );
}

interface InvitationCardProps {
  row: InvitationOverviewRow;
  onEdit: (row: InvitationOverviewRow) => void;
  onPublishNovelty: () => void;
  onGoToRendezvous: () => void;
}

export default function InvitationCard({ row, onEdit, onPublishNovelty, onGoToRendezvous }: InvitationCardProps) {
  const badge = STATE_BADGE[row.state];
  const muted = row.state === 'locked' || row.state === 'ended';

  return (
    <Card className={cn('p-4 sm:p-5', row.state === 'online' && 'border-primary/40 shadow-sm', muted && 'bg-muted/30')}>
      <div className="flex items-start gap-4">
        <DateTile date={row.date_debut} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground leading-tight">{row.event_name}</h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                <span className="first-letter:uppercase">{dateRangeLabel(row.date_debut, row.date_fin)}</span>
                {row.ville && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {row.ville}
                  </span>
                )}
              </p>
            </div>
            <Badge className={cn('shrink-0 font-medium hover:bg-inherit', badge.className)}>{badge.label}</Badge>
          </div>

          {row.novelty_title && row.state !== 'locked' && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {row.novelty_title}
            </p>
          )}

          {/* Contenu selon l'état */}
          <div className="mt-4">
            {row.state === 'locked' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-lg border border-dashed border-border bg-background p-3">
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                  Publiez votre Nouveauté pour ce salon pour activer votre page d'invitation.
                </p>
                <Button size="sm" onClick={onPublishNovelty} className="shrink-0">
                  Publier une Nouveauté
                </Button>
              </div>
            )}

            {row.state === 'pending' && (
              <p className="flex items-start gap-2 rounded-lg bg-warning-surface p-3 text-sm text-foreground">
                <Clock className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
                Votre Nouveauté est en cours de validation. Votre page d'invitation sera disponible dès sa publication.
              </p>
            )}

            {row.state === 'ready' && (
              <Button onClick={() => onEdit(row)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Créer ma page d'invitation
              </Button>
            )}

            {row.state === 'draft' && (
              <Button onClick={() => onEdit(row)} variant="outline" className="gap-1.5">
                <Pencil className="h-4 w-4" />
                Continuer
              </Button>
            )}

            {row.state === 'suspended' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-lg bg-danger-surface p-3">
                <p className="flex items-start gap-2 text-sm text-foreground">
                  <PauseCircle className="h-4 w-4 mt-0.5 shrink-0 text-danger" />
                  Votre page est hors ligne tant que votre Nouveauté n'est pas republiée.
                </p>
                <Button size="sm" variant="outline" onClick={onPublishNovelty} className="shrink-0">
                  Voir mes nouveautés
                </Button>
              </div>
            )}

            {row.state === 'online' && (
              <div className="space-y-4">
                <SharePanel row={row} compact />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={onGoToRendezvous}
                    className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-primary"
                  >
                    <CalendarCheck className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{row.requests_count}</span>
                    demande{row.requests_count > 1 ? 's' : ''} de rendez-vous reçue{row.requests_count > 1 ? 's' : ''}
                  </button>
                  <Button size="sm" variant="ghost" onClick={() => onEdit(row)} className="gap-1.5">
                    <Pencil className="h-4 w-4" />
                    Modifier
                  </Button>
                </div>
              </div>
            )}

            {row.state === 'ended' && (
              <p className="text-sm text-muted-foreground">
                Salon terminé.
                {row.requests_count > 0 && ` ${row.requests_count} demande${row.requests_count > 1 ? 's' : ''} reçue${row.requests_count > 1 ? 's' : ''} via la page.`}
                {row.event_slug && (
                  <>
                    {' '}
                    <Link to={`/events/${row.event_slug}`} className="text-primary hover:underline">
                      Voir le salon
                    </Link>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
