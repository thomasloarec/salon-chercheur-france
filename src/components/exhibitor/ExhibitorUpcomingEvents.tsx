import { Skeleton } from '@/components/ui/skeleton';

import {
  useExhibitorUpcomingEvents,
  type PublicExhibitorProfile,
} from '@/hooks/useExhibitorProfile';
import ExhibitorEventCardRow from '@/components/exhibitor/ExhibitorEventCardRow';

/* --------------------------- Upcoming events block ----------------------- */

export default function ExhibitorUpcomingEvents({
  profile,
}: {
  profile: PublicExhibitorProfile;
}) {
  const slug = profile.public_slug || '';
  const { data: events = [], isLoading } = useExhibitorUpcomingEvents(
    profile.exhibitor_id,
    profile.legacy_exposant_id
  );

  if (isLoading) {
    return (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="heading-display section-rule text-xl font-bold">À voir sur les salons</h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (events.length === 0) return null;

  const extra = events.length - 1;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="heading-display section-rule text-xl font-bold">À voir sur les salons</h2>
        <span className="text-sm text-muted-foreground">
          {events.length} salon{events.length > 1 ? 's' : ''} à venir
        </span>
      </div>
      <ExhibitorEventCardRow event={events[0]} slug={slug} featured />
      {extra > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          et {extra} autre{extra > 1 ? 's' : ''} salon{extra > 1 ? 's' : ''} à venir, visible{extra > 1 ? 's' : ''} dans l’historique ci-dessous
        </p>
      )}
    </section>
  );
}