import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Radio } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import {
  useExhibitorParticipationHistory,
  type ExhibitorParticipation,
  type PublicExhibitorProfile,
} from '@/hooks/useExhibitorProfile';
import { trackExhibitorEvent } from '@/lib/exhibitorTracking';

const HISTORY_PAGE_SIZE = 8;

function formatPeriod(start: string | null, end: string | null) {
  if (!start) return '';
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : startDate;
  const sameMonth =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth();
  if (sameMonth) return format(startDate, 'MMMM yyyy', { locale: fr });
  const s = format(startDate, 'dd MMM yyyy', { locale: fr });
  const e = format(endDate, 'dd MMM yyyy', { locale: fr });
  return `${s} – ${e}`;
}

function StatusBadge({ status }: { status: ExhibitorParticipation['status'] }) {
  if (status === 'ongoing') {
    return (
      <Badge className="gap-1 bg-primary text-primary-foreground">
        <Radio className="h-3 w-3 animate-pulse" />
        En cours
      </Badge>
    );
  }
  if (status === 'upcoming') {
    return <Badge variant="secondary">À venir</Badge>;
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Passé
    </Badge>
  );
}

function ParticipationRow({
  item,
  slug,
}: {
  item: ExhibitorParticipation;
  slug: string;
}) {
  const place = [item.ville, item.nom_lieu].filter(Boolean).join(' · ');

  return (
    <li className="relative pl-6">
      {/* timeline dot */}
      <span
        className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {item.slug ? (
              <Link
                to={`/events/${item.slug}`}
                onClick={() =>
                  trackExhibitorEvent('event_click', slug, {
                    event_slug: item.slug,
                  })
                }
                className="font-semibold leading-snug hover:text-primary hover:underline"
              >
                {item.nom_event}
              </Link>
            ) : (
              <span className="font-semibold leading-snug">{item.nom_event}</span>
            )}
            <StatusBadge status={item.status} />
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <CalendarDays className="h-4 w-4 shrink-0" />
            {formatPeriod(item.date_debut, item.date_fin) || 'Date à confirmer'}
          </p>
          {place && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" />
              {place}
            </p>
          )}
        </div>
        {item.stand && (
          <span className="text-sm font-medium text-primary shrink-0 sm:text-right">
            Stand {item.stand}
          </span>
        )}
      </div>
    </li>
  );
}

/* ----------------------- Participation history block --------------------- */

/**
 * "Présence sur les salons" — full chronological history (past, ongoing &
 * upcoming) grouped by year. Event names are crawlable internal <Link>s to
 * /events/:slug to strengthen internal linking. Hidden entirely when the
 * exhibitor has no known participation.
 */
export default function ExhibitorParticipationHistory({
  profile,
}: {
  profile: PublicExhibitorProfile;
}) {
  const slug = profile.public_slug || '';
  const [visible, setVisible] = useState(HISTORY_PAGE_SIZE);
  const { data: items = [], isLoading } = useExhibitorParticipationHistory(
    profile.exhibitor_id,
    profile.legacy_exposant_id
  );

  if (isLoading) {
    return (
      <section>
        <h2 className="text-xl font-bold mb-4">Présence sur les salons</h2>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  // Nothing known → hide the block entirely (cleaner than an empty state).
  if (items.length === 0) return null;

  const shown = items.slice(0, visible);
  const remaining = items.length - shown.length;

  // Group the shown items by year, preserving the ordered sequence.
  const groups: { year: string; items: ExhibitorParticipation[] }[] = [];
  for (const item of shown) {
    const yearLabel = item.year ? String(item.year) : 'Date inconnue';
    const last = groups[groups.length - 1];
    if (last && last.year === yearLabel) last.items.push(item);
    else groups.push({ year: yearLabel, items: [item] });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Présence sur les salons</h2>
        <span className="text-sm text-muted-foreground">
          {items.length} participation{items.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.year}>
            <p className="text-sm font-semibold text-muted-foreground mb-2">
              {group.year}
            </p>
            <ul className="space-y-4 border-l border-border pl-3">
              {group.items.map((item) => (
                <ParticipationRow key={item.id} item={item} slug={slug} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {remaining > 0 && (
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            onClick={() => setVisible((v) => v + HISTORY_PAGE_SIZE)}
          >
            Voir {remaining} participation{remaining > 1 ? 's' : ''} de plus
          </Button>
        </div>
      )}
    </section>
  );
}