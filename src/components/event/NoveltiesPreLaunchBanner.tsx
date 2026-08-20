import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DarkTexturePanel from '@/components/event/DarkTexturePanel';
import NoveltyPublishSteps from '@/components/novelty/NoveltyPublishSteps';

interface NoveltiesPreLaunchBannerProps {
  eventDate: string;
  eventName: string;
  exhibitorCount?: number;
  onNotifyMe?: () => void;
}

/**
 * Lot 12 — variante « au-delà de J-90 » du bloc d'incitation.
 * Même structure en six éléments que la période ouverte : seuls le titre
 * (ouverture annoncée avec la date) et le CTA (notification) changent.
 */
export function NoveltiesPreLaunchBanner({
  eventDate,
  exhibitorCount,
  onNotifyMe,
}: NoveltiesPreLaunchBannerProps) {
  const noveltiesOpenDate = new Date(eventDate);
  noveltiesOpenDate.setDate(noveltiesOpenDate.getDate() - 90);
  const openLabel = format(noveltiesOpenDate, 'd MMMM yyyy', { locale: fr });

  const count =
    typeof exhibitorCount === 'number' && Number.isFinite(exhibitorCount)
      ? exhibitorCount
      : 0;

  const proof =
    count > 1
      ? `${count} exposants sont déjà listés sur ce salon. La première place est libre.`
      : count === 1
        ? '1 exposant est déjà listé sur ce salon. La première place est libre.'
        : 'Les visiteurs qui consultent cette page préparent déjà leur venue.';

  return (
    <DarkTexturePanel className="w-full">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-6 px-6 py-12 sm:px-10 sm:py-14">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-inverse/70">
          Espace exposants
        </span>

        <h2 className="heading-display text-2xl leading-tight text-inverse sm:text-3xl">
          Les nouveautés ouvrent le {openLabel}
        </h2>

        <p className="text-base font-medium leading-snug text-inverse sm:text-lg">{proof}</p>

        <NoveltyPublishSteps className="mt-1" />

        {onNotifyMe && (
          <Button onClick={onNotifyMe} size="lg" className="gap-2">
            <Bell className="h-4 w-4" aria-hidden="true" />
            Me notifier à l'ouverture
          </Button>
        )}

        <p className="text-xs text-inverse/75">
          3 minutes · Gratuit · Visible avant l'ouverture
        </p>
      </div>
    </DarkTexturePanel>
  );
}
