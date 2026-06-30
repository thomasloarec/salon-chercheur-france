import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import {
  useExhibitorNovelties,
  type PublicExhibitorProfile,
} from '@/hooks/useExhibitorProfile';
import NoveltyCard from '@/components/novelty/NoveltyCard';
import type { Novelty } from '@/hooks/useNovelties';
import { trackExhibitorEvent } from '@/lib/exhibitorTracking';

const NOVELTIES_PAGE_SIZE = 4;

/* ------------------------------ Novelties block -------------------------- */

/**
 * Wraps a NoveltyCard and records a single `novelty_click` per novelty per
 * page mount. Clicks that originate inside the image carousel (prev/next/dots)
 * are ignored so navigation does not generate false-positive engagement.
 */
function TrackedNovelty({
  novelty,
  slug,
}: {
  novelty: Novelty;
  slug: string;
}) {
  const tracked = useRef(false);

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tracked.current) return;
    // Ignore carousel navigation (arrows / dots live inside this container).
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-suppress-global-arrows="true"]')) return;
    tracked.current = true;
    trackExhibitorEvent('novelty_click', slug, { novelty_id: novelty.id });
  };

  return (
    <div onClickCapture={handleClickCapture}>
      <NoveltyCard novelty={novelty} />
    </div>
  );
}

export default function ExhibitorNovelties({
  profile,
}: {
  profile: PublicExhibitorProfile;
}) {
  const slug = profile.public_slug || '';
  const [visible, setVisible] = useState(NOVELTIES_PAGE_SIZE);
  const { data: novelties = [], isLoading } = useExhibitorNovelties(
    profile.exhibitor_id
  );

  const shown = novelties.slice(0, visible);
  const remaining = novelties.length - shown.length;

  if (!profile.exhibitor_id) {
    return (
      <section>
        <h2 className="heading-display section-rule text-xl font-bold mb-4">Nouveautés publiées</h2>
        <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center">
          <p className="text-muted-foreground">
            Aucune nouveauté publiée pour le moment.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="heading-display section-rule text-xl font-bold">Nouveautés publiées</h2>
        {!isLoading && novelties.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {novelties.length} nouveauté{novelties.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : novelties.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center">
          <p className="text-muted-foreground">
            Aucune nouveauté publiée pour le moment.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {shown.map((n) => (
              <TrackedNovelty key={n.id} novelty={n} slug={slug} />
            ))}
          </div>
          {remaining > 0 && (
            <div className="mt-4 text-center">
              <Button
                variant="ghost"
                onClick={() => setVisible((v) => v + NOVELTIES_PAGE_SIZE)}
              >
                Voir les {remaining} nouveauté{remaining > 1 ? 's' : ''} suivante
                {remaining > 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}