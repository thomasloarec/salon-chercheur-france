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
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 id="alaune-heading" className="text-2xl font-bold tracking-tight md:text-3xl">
          À la une
        </h2>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        La sélection à ne pas manquer avant les prochains salons.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
        <FeaturedMain novelty={main} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {secondary.map((n) => (
            <NoveltyMiniCard key={n.id} novelty={n} className="h-full" />
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

  const images = (novelty.media_urls ?? []).filter(Boolean).slice(0, 3);
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
    <Card className="group flex flex-col overflow-hidden border-border/60 transition-all hover:border-primary/30 hover:shadow-lg">
      <Link
        to={noveltyHref}
        aria-label={`Voir ${novelty.title}`}
        className="block"
      >
        <FeaturedMosaic images={images} type={novelty.type} alt={novelty.title} />
      </Link>

      <div className="flex min-w-0 flex-col gap-3 p-5">
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

        <Link to={noveltyHref} className="block">
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
          to={noveltyHref}
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

        <div className="pt-1">
          <Button asChild size="sm" className="gap-1">
            <Link to={noveltyHref}>
              Voir la nouveauté
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Bloc visuel de la nouveauté principale, adapté au nombre d'images réellement
 * disponibles (0 à 3). Les images verticales restent lisibles :
 * - 0 image  → placeholder qualitatif lié au type
 * - 1 image  → grande image entière sur fond flouté (aucun recadrage violent)
 * - 2 images → côte à côte, principale plus large
 * - 3 images → mosaïque éditoriale (principale 60% + 2 vignettes empilées)
 */
function FeaturedMosaic({
  images,
  type,
  alt,
}: {
  images: string[];
  type?: string | null;
  alt: string;
}) {
  const count = images.length;

  if (count <= 1) {
    return (
      <NoveltyImage
        src={images[0]}
        alt={alt}
        type={type}
        fit="contain"
        ratioClassName="aspect-[4/3]"
      />
    );
  }

  if (count === 2) {
    return (
      <div className="grid aspect-[4/3] grid-cols-5 gap-1 bg-muted">
        <MosaicCell src={images[0]} alt={alt} className="col-span-3" priority />
        <MosaicCell src={images[1]} alt={alt} className="col-span-2" />
      </div>
    );
  }

  return (
    <div className="grid aspect-[4/3] grid-cols-5 grid-rows-2 gap-1 bg-muted">
      <MosaicCell src={images[0]} alt={alt} className="col-span-3 row-span-2" priority />
      <MosaicCell src={images[1]} alt={alt} className="col-span-2" />
      <MosaicCell src={images[2]} alt={alt} className="col-span-2" />
    </div>
  );
}

function MosaicCell({
  src,
  alt,
  className,
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <img
        src={src}
        alt={alt}
        loading={priority ? undefined : "lazy"}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
    </div>
  );
}