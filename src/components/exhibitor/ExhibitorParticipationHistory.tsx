import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Radio } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import {
  useExhibitorParticipationHistory,
  type ExhibitorParticipation,
  type PublicExhibitorProfile,
} from '@/hooks/useExhibitorProfile';
import { trackExhibitorEvent } from '@/lib/exhibitorTracking';

const HISTORY_PAGE_SIZE = 8;

function daysUntil(start: string | null): number | null {
  if (!start) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const ms = d.getTime() - now.getTime();
  if (Number.isNaN(ms)) return null;
  return Math.round(ms / 86_400_000);
}

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

function StatusBadge({
  status,
  dateDebut,
}: {
  status: ExhibitorParticipation['status'];
  dateDebut: string | null;
}) {
  if (status === 'ongoing') {
    return (
      <Badge className="gap-1 bg-primary text-primary-foreground">
        <Radio className="h-3 w-3 animate-pulse" />
        En cours
      </Badge>
    );
  }
  if (status === 'upcoming') {
    const days = daysUntil(dateDebut);
    const label = days === null ? 'À venir' : days <= 0 ? "Aujourd'hui" : `J-${days}`;
    return <Badge variant="secondary">{label}</Badge>;
  }
  return null;
}

function ParticipationRow({
  item,
  slug,
}: {
  item: ExhibitorParticipation;
  slug: string;
}) {
  const place = [item.ville, item.nom_lieu].filter(Boolean).join(' · ');
  const future = item.status === 'ongoing' || item.status === 'upcoming';

  return (
    <article className="group relative pl-8 pr-3 py-3 border-b border-border/60 last:border-b-0 transition-colors duration-200 ease-out hover:bg-muted/40 motion-reduce:transition-none">
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-0 top-[1.4rem] h-2.5 w-2.5 rounded-full ring-4 ring-background',
          future ? 'bg-primary' : 'border-2 border-muted-foreground/40 bg-background'
        )}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
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
                className="heading-display text-[1.05rem] leading-tight text-foreground group-hover:text-primary transition-colors after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
              >
                {item.nom_event}
              </Link>
            ) : (
              <span className="heading-display text-[1.05rem] leading-tight text-foreground">{item.nom_event}</span>
            )}
            <StatusBadge status={item.status} dateDebut={item.date_debut} />
          </div>
          <div className="mt-1.5 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 shrink-0" />
              {formatPeriod(item.date_debut, item.date_fin) || 'Date à confirmer'}
            </span>
            {place && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" />
                {place}
              </span>
            )}
          </div>
        </div>
        {item.stand && (
          <span className="text-xs font-medium text-primary shrink-0 self-start rounded-full bg-bubble border border-bubble-border px-2.5 py-1 sm:text-right">
            Stand {item.stand}
          </span>
        )}
      </div>
    </article>
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="heading-display section-rule text-xl font-bold">Présence sur les salons</h2>
        </div>
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
        <h2 className="heading-display section-rule text-xl font-bold">Présence sur les salons</h2>
        <span className="text-sm text-muted-foreground shrink-0">
          {items.length} participation{items.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute left-[5px] top-2 bottom-2 w-px bg-border"
        />
        {groups.map((group) => (
          <div key={group.year}>
            <div className="relative flex items-center gap-3 pl-8 pt-7 pb-2 first:pt-0">
              <span
                aria-hidden="true"
                className="absolute left-0 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-muted-foreground/30 ring-4 ring-background"
              />
              <h3 className="heading-display text-xl md:text-2xl text-foreground capitalize">
                {group.year}
              </h3>
              <span className="flex-1 h-px bg-border/70" aria-hidden="true" />
              <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground text-xs font-medium px-2.5 py-1 shrink-0">
                {group.items.length} participation{group.items.length > 1 ? 's' : ''}
              </span>
            </div>
            <div>
              {group.items.map((item) => (
                <ParticipationRow key={item.id} item={item} slug={slug} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {remaining > 0 && (
        <div className="mt-5 text-center">
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