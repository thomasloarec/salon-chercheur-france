import { Link } from "react-router-dom";
import { Calendar, Clock, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { getExhibitorLogoUrl } from "@/utils/exhibitorLogo";
import { noveltyTypeLabel } from "@/lib/noveltyTypeMeta";
import NoveltyImage from "./NoveltyImage";
import type { NoveltyWatchRow } from "@/hooks/useNoveltiesWatch";

interface NoveltyMiniCardProps {
  novelty: NoveltyWatchRow;
  /** "row" = image à gauche (sections salon), "stacked" = image en haut. */
  layout?: "row" | "stacked";
  /** Masque le contexte salon (utile quand la section est déjà groupée par salon). */
  hideEvent?: boolean;
  className?: string;
}

/**
 * Carte nouveauté épurée : badge type, exposant, titre (2 lignes), salon +
 * proximité, et un seul CTA. La description longue n'apparaît pas ici (réservée
 * à la nouveauté principale et à la page détail).
 */
export default function NoveltyMiniCard({
  novelty,
  layout = "stacked",
  hideEvent = false,
  className,
}: NoveltyMiniCardProps) {
  const exhibitor = novelty.exhibitors;
  const event = novelty.events;
  if (!exhibitor || !event) return null;

  const image = novelty.media_urls?.[0];
  const logo = getExhibitorLogoUrl(exhibitor.logo_url, exhibitor.website);
  const noveltyHref = novelty.slug
    ? `/nouveautes/${novelty.slug}`
    : `/events/${event.slug}?novelty=${novelty.id}`;

  const daysUntil = event.date_debut
    ? differenceInDays(new Date(event.date_debut), new Date())
    : null;
  const isImminent = daysUntil !== null && daysUntil >= 0 && daysUntil <= 14;
  const countdownLabel =
    daysUntil === null
      ? null
      : daysUntil <= 0
      ? "En cours"
      : daysUntil === 1
      ? "J-1"
      : `J-${daysUntil}`;

  return (
    <Card
      className={cn(
        "group flex overflow-hidden border-border/60 transition-all hover:border-primary/30 hover:shadow-md",
        layout === "stacked" ? "flex-col" : "flex-row",
        className,
      )}
    >
      <Link
        to={noveltyHref}
        aria-label={`Voir ${novelty.title}`}
        className={cn(
          "block shrink-0",
          layout === "stacked" ? "w-full" : "w-28 sm:w-32",
        )}
      >
        <NoveltyImage
          src={image}
          alt={novelty.title}
          type={novelty.type}
          ratioClassName={layout === "stacked" ? "aspect-[4/5]" : "h-full min-h-full aspect-[3/4]"}
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-medium">
            {noveltyTypeLabel(novelty.type)}
          </Badge>
          {countdownLabel && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
                isImminent
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground/80",
              )}
            >
              <Clock className="h-3 w-3" />
              {countdownLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {logo ? (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border bg-white">
              <img
                src={logo}
                alt={exhibitor.name}
                loading="lazy"
                className="max-h-full max-w-full object-contain"
              />
            </span>
          ) : (
            <Building2 className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{exhibitor.name}</span>
        </div>

        <Link to={noveltyHref} className="block">
          <h3 className="line-clamp-3 text-base font-bold leading-snug tracking-tight transition-colors group-hover:text-primary">
            {novelty.title}
          </h3>
        </Link>

        {!hideEvent && (
          <div className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-primary/70" />
            <span className="truncate">
              {event.nom_event}
              {event.date_debut && (
                <>
                  {" · "}
                  {format(new Date(event.date_debut), "dd MMM", { locale: fr })}
                </>
              )}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}