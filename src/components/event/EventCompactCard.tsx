import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, MapPin, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CompactEventCardProps {
  slug: string;
  name: string;
  dateDebut?: string | null;
  ville?: string | null;
  imageUrl?: string | null;
  badge?: string | null;
  /** Badge secteur (variante 'row' uniquement) : nom du secteur partagé. */
  sectorBadge?: string | null;
  /** Infobulle du badge secteur (ex. second secteur partagé). */
  sectorBadgeTitle?: string | null;
  /** 'row' : vignette à gauche (dense). 'tile' : image en haut (rangée pleine largeur). */
  variant?: 'row' | 'tile';
  className?: string;
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, 'dd MMM yyyy', { locale: fr });
};

/**
 * Carte événement compacte, commune aux rangées de bas de page (lot 9).
 * Toujours un <a href> crawlable vers /events/:slug.
 */
export const EventCompactCard = ({
  slug,
  name,
  dateDebut,
  ville,
  imageUrl,
  badge,
  variant = 'row',
  className,
}: CompactEventCardProps) => {
  const dateLabel = dateDebut ? formatDate(dateDebut) : null;

  if (variant === 'row') {
    return (
      <Link
        to={`/events/${slug}`}
        className={cn(
          'group flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 transition-[background-color,border-color,box-shadow,transform] duration-200 hover:border-primary/40 hover:bg-accent/40 hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0',
          className,
        )}
      >
        <div className="h-14 w-20 flex-none overflow-hidden rounded-lg bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-4 w-4 text-muted-foreground/60" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
            {name}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {dateLabel && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {dateLabel}
              </span>
            )}
            {ville && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {ville}
              </span>
            )}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/events/${slug}`}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-[box-shadow,transform] duration-200 hover:shadow-md hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        className,
      )}
    >
      <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="line-clamp-2 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
          {name}
        </h3>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {dateLabel && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {dateLabel}
            </span>
          )}
          {ville && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {ville}
            </span>
          )}
        </p>
        {badge && (
          <span className="mt-auto inline-flex w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {badge}
          </span>
        )}
      </div>
    </Link>
  );
};

export default EventCompactCard;
