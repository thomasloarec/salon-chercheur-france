import React from 'react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Sparkles, Bell, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DarkTexturePanel from '@/components/event/DarkTexturePanel';

interface NoveltiesPreLaunchBannerProps {
  eventDate: string;
  eventName: string;
  onNotifyMe?: () => void;
}

/**
 * Lot 11 — état « Les nouveautés arrivent bientôt » (au-delà de J-90).
 * Registre sombre texturé de la page d'accueil, traité comme une invitation.
 * Textes strictement inchangés.
 */
export function NoveltiesPreLaunchBanner({
  eventDate,
  eventName,
  onNotifyMe,
}: NoveltiesPreLaunchBannerProps) {
  const daysUntilEvent = differenceInDays(new Date(eventDate), new Date());
  const daysUntilNovelties = Math.max(0, daysUntilEvent - 90);

  // Date d'ouverture des nouveautés (J-90)
  const noveltiesOpenDate = new Date(eventDate);
  noveltiesOpenDate.setDate(noveltiesOpenDate.getDate() - 90);

  return (
    <DarkTexturePanel>
      <div className="px-6 py-10 text-center sm:px-10 sm:py-12">
        <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-inverse-primary/15 ring-1 ring-inverse-primary/30">
          <Sparkles className="h-6 w-6 text-inverse-primary" />
        </div>

        <h3 className="heading-display text-2xl leading-tight text-inverse md:text-3xl">
          Les nouveautés arrivent bientôt
        </h3>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-inverse-muted sm:text-base">
          Les exposants de <strong className="text-inverse">{eventName}</strong> dévoileront leurs innovations{' '}
          <strong className="text-inverse">
            à partir du {format(noveltiesOpenDate, 'dd MMMM yyyy', { locale: fr })}
          </strong>
        </p>

        {/* Repère temporel — statique, aucun compteur animé */}
        <div className="mx-auto mt-6 flex max-w-md items-center gap-3">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-inverse-primary" />
          <span className="h-px flex-1 bg-inverse-muted/30" />
          <span className="whitespace-nowrap rounded-full border border-inverse-muted/30 px-3 py-1 text-xs font-medium tabular-nums text-inverse-muted">
            {daysUntilNovelties} jour{daysUntilNovelties > 1 ? 's' : ''}
          </span>
          <span className="h-px flex-1 bg-inverse-muted/30" />
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-inverse-muted/50" />
        </div>

        {onNotifyMe && (
          <div className="mt-7 flex justify-center">
            <Button onClick={onNotifyMe} size="lg" className="gap-2">
              <Bell className="h-4 w-4" />
              Me notifier à l'ouverture
            </Button>
          </div>
        )}

        <p className="mt-7 flex items-center justify-center gap-2 border-t border-inverse-muted/20 pt-5 text-xs text-inverse-muted sm:text-sm">
          <Lock className="h-4 w-4 shrink-0" />
          <span>
            <strong className="text-inverse">Exposants :</strong> La publication de nouveautés
            ouvrira 90 jours avant l'événement
          </span>
        </p>
      </div>
    </DarkTexturePanel>
  );
}
