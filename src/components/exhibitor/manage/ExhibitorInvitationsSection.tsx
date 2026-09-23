import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarDays, Mail, Sparkles, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useInvitationOverview, type InvitationOverviewRow } from '@/hooks/useInvitationPages';

import InvitationCard from './invitations/InvitationCard';
import InvitationEditor from './invitations/InvitationEditor';

interface ExhibitorInvitationsSectionProps {
  exhibitorId: string;
  onGoToNovelties: () => void;
  onGoToSalons: () => void;
  onGoToRendezvous: () => void;
}

export default function ExhibitorInvitationsSection({
  exhibitorId,
  onGoToNovelties,
  onGoToSalons,
  onGoToRendezvous,
}: ExhibitorInvitationsSectionProps) {
  const navigate = useNavigate();
  const { data: rows = [], isLoading, isError, refetch } = useInvitationOverview(exhibitorId);
  const [editing, setEditing] = useState<InvitationOverviewRow | null>(null);

  if (editing) {
    return <InvitationEditor exhibitorId={exhibitorId} row={editing} onBack={() => setEditing(null)} />;
  }

  const upcoming = rows.filter((r) => r.state !== 'ended');
  const past = rows.filter((r) => r.state === 'ended');
  const publishNovelty = (row: InvitationOverviewRow) =>
    row.state === 'suspended' ? onGoToNovelties() : navigate('/publier-nouveaute');

  return (
    <div className="space-y-5">
      {/* Explication de la règle (toujours visible) */}
      <Card className="relative overflow-hidden border-0 bg-surface-inverse text-inverse p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: 'url(/home-texture-plexus.jpg)', backgroundSize: 'cover', opacity: 0.22 }}
        />
        <div className="relative">
          <h3 className="heading-display text-xl sm:text-2xl">Une page d'invitation par salon</h3>
          <p className="mt-2 max-w-2xl text-sm text-inverse-muted">
            Invitez vos clients et prospects à venir vous voir. Ils découvrent votre Nouveauté, votre équipe, et
            réservent leur rendez-vous avant l'ouverture.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-3 text-sm">
            <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-inverse-primary shrink-0" />Votre Nouveauté en vitrine</li>
            <li className="flex items-center gap-2"><Users className="h-4 w-4 text-inverse-primary shrink-0" />L'équipe présente sur le stand</li>
            <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-inverse-primary shrink-0" />Prise de rendez-vous par jour</li>
          </ul>
          <p className="mt-4 inline-flex items-start gap-2 rounded-lg bg-inverse/10 px-3 py-2 text-sm">
            <Mail className="h-4 w-4 mt-0.5 shrink-0 text-inverse-primary" />
            <span>
              <strong className="font-semibold">Elle s'active dès qu'une Nouveauté est publiée pour le salon</strong> :
              c'est ce que vos invités viendront découvrir.
            </span>
          </p>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : isError ? (
        <Card className="p-6 flex items-center justify-between gap-4 flex-wrap border-destructive/40">
          <div className="flex items-center gap-3 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            Impossible de charger vos salons pour le moment.
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Réessayer
          </Button>
        </Card>
      ) : upcoming.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Aucun salon à venir</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Déclarez votre participation à un salon, publiez votre Nouveauté, puis créez votre page d'invitation.
          </p>
          <Button variant="outline" onClick={onGoToSalons}>
            Aller à « Mes salons »
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {upcoming.map((row) => (
            <InvitationCard
              key={row.event_id}
              row={row}
              onEdit={setEditing}
              onPublishNovelty={() => publishNovelty(row)}
              onGoToRendezvous={onGoToRendezvous}
            />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Salons terminés ({past.length})
          </summary>
          <div className="mt-3 space-y-3">
            {past.map((row) => (
              <InvitationCard
                key={row.event_id}
                row={row}
                onEdit={setEditing}
                onPublishNovelty={onGoToNovelties}
                onGoToRendezvous={onGoToRendezvous}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
