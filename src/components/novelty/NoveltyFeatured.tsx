import { Link } from "react-router-dom";
import { Calendar, MapPin, Clock, Building2, ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { getExhibitorLogoUrl } from "@/utils/exhibitorLogo";
import { noveltyTypeLabel } from "@/lib/noveltyTypeMeta";
import NoveltyImage from "./NoveltyImage";
import NoveltyMiniCard from "./NoveltyMiniCard";
import type { NoveltyWatchRow } from "@/hooks/useNoveltiesWatch";

interface NoveltyFeaturedProps {
  main: NoveltyWatchRow;
  secondary: NoveltyWatchRow[];
}

/**
 * Bloc éditorial "À la une" : une nouveauté principale au format poster
 * (assume les images verticales) + 3 à 4 nouveautés secondaires. Aucune
 * dépendance aux statistiques de clic.
 */
export default function NoveltyFeatured({ main, secondary }: NoveltyFeaturedProps) {
  return (
    <section aria-labelledby="alaune-heading">
      <div className="mb-5 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 id="alaune-heading" className="text-xl font-bold tracking-tight md:text-2xl">
          À la une
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <FeaturedMain novelty={main} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {secondary.map((n) => (
            <NoveltyMiniCard key={n.id} novelty={n} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedMain({ novelty }: { novelty: NoveltyWatchRow }) {
  const exhibitor = novelty.exhibitors;
  const event = novelty.events;
  if (!exhibitor || !event) return null;

  const image = novelty.media_urls?.[0];
  const logo = getExhibitorLogoUrl(exhibitor.logo_url, exhibitor.website);
  const eventHref = `/events/${event.slug}?novelty=${novelty.id}`;

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
    <Card className="group flex flex-col overflow-hidden border-border/60 transition-all hover:border-primary/30 hover:shadow-lg sm:flex-row lg:flex-col">
      <Link
        to={eventHref}
        aria-label={`Voir ${novelty.title}`}
        className="block shrink-0 sm:w-2/5 lg:w-full"
      >
        <NoveltyImage
          src={image}
          alt={novelty.title}
          type={novelty.type}
          fit="contain"
          ratioClassName="aspect-[4/5] sm:h-full sm:min-h-full lg:aspect-[16/10]"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="font-medium">{noveltyTypeLabel(novelty.type)}</Badge>
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

        <Link to={eventHref} className="block">
          <h3 className="text-xl font-bold leading-tight transition-colors group-hover:text-primary md:text-2xl">
            {novelty.title}
          </h3>
        </Link>

        {novelty.reason_1 && (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {novelty.reason_1}
          </p>
        )}

        <div className="flex items-center gap-2 text-sm font-medium">
          {logo ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border bg-white">
              <img
                src={logo}
                alt={exhibitor.name}
                loading="lazy"
                className="max-h-full max-w-full object-contain"
              />
            </span>
          ) : (
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{exhibitor.name}</span>
        </div>

        <Link
          to={eventHref}
          className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-primary/70" />
            <span className="truncate">{event.nom_event}</span>
          </span>
          {event.date_debut && (
            <span>{format(new Date(event.date_debut), "dd MMM yyyy", { locale: fr })}</span>
          )}
          {event.ville && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {event.ville}
            </span>
          )}
        </Link>

        <div className="mt-auto pt-1">
          <Button asChild size="sm" className="gap-1">
            <Link to={eventHref}>
              Voir la nouveauté
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}