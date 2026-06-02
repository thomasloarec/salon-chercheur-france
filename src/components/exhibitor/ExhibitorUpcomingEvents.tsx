import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import {
  useExhibitorUpcomingEvents,
  type PublicExhibitorProfile,
} from '@/hooks/useExhibitorProfile';
import ExhibitorEventCardRow from '@/components/exhibitor/ExhibitorEventCardRow';

const EVENTS_PAGE_SIZE = 6;

/* --------------------------- Upcoming events block ----------------------- */

export default function ExhibitorUpcomingEvents({
  profile,
}: {
  profile: PublicExhibitorProfile;
}) {
  const slug = profile.public_slug || '';
  const [visible, setVisible] = useState(EVENTS_PAGE_SIZE);
  const { data: events = [], isLoading } = useExhibitorUpcomingEvents(
    profile.exhibitor_id,
    profile.legacy_exposant_id
  );

  const shown = events.slice(0, visible);
  const remaining = events.length - shown.length;

  return (
    <section>
      <h2 className="text-xl font-bold mb-4">À voir sur les salons</h2>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground">
          Aucun salon à venir identifié pour le moment.
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {shown.map((e) => (
              <ExhibitorEventCardRow key={e.id} event={e} slug={slug} />
            ))}
          </div>
          {remaining > 0 && (
            <div className="mt-4 text-center">
              <Button
                variant="ghost"
                onClick={() => setVisible((v) => v + EVENTS_PAGE_SIZE)}
              >
                Voir les {remaining} salon{remaining > 1 ? 's' : ''} suivant
                {remaining > 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}