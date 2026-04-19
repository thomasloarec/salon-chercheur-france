import { Link } from "react-router-dom";
import { Calendar, MapPin, FileText, Building2, ArrowRight, Clock, ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getExhibitorLogoUrl } from "@/utils/exhibitorLogo";
import { differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import type { NoveltyWatchRow } from "@/hooks/useNoveltiesWatch";

const TYPE_LABELS: Record<string, string> = {
  Launch: "Lancement produit",
  Update: "Mise à jour",
  Demo: "Démonstration",
  Special_Offer: "Offre spéciale",
  Partnership: "Partenariat",
  Innovation: "Innovation",
};

interface NoveltyWatchCardProps {
  novelty: NoveltyWatchRow;
  className?: string;
  /** "compact" réduit encore le visuel (utilisé dans "À surveiller maintenant") */
  variant?: "default" | "compact";
}

export default function NoveltyWatchCard({
  novelty,
  className,
  variant = "default",
}: NoveltyWatchCardProps) {
  const exhibitor = novelty.exhibitors;
  const event = novelty.events;
  if (!exhibitor || !event) return null;

  const typeLabel = TYPE_LABELS[novelty.type] || novelty.type;
  const image = novelty.media_urls?.[0];
  const logo = getExhibitorLogoUrl(exhibitor.logo_url, exhibitor.website);

  const daysUntil = event.date_debut
    ? differenceInDays(new Date(event.date_debut), new Date())
    : null;

  const isUrgent = daysUntil !== null && daysUntil >= 0 && daysUntil <= 14;
  const countdownLabel =
    daysUntil === null
      ? null
      : daysUntil <= 0
      ? "En cours"
      : daysUntil === 1
      ? "Dans 1 jour"
      : `Dans ${daysUntil} jours`;

  const eventHref = `/events/${event.slug}#nouveautes`;

  // Image plus large et ratio plus proche du vertical (type post LinkedIn)
  const imageSize =
    variant === "compact"
      ? "w-full sm:w-48 md:w-52 aspect-[4/3] sm:aspect-[4/5]"
      : "w-full sm:w-56 md:w-60 aspect-[4/3] sm:aspect-[4/5]";

  return (
    <Card
      className={cn(
        "group overflow-hidden hover:shadow-md hover:border-primary/30 transition-all border-border/60",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Visuel : compact, jamais dominant */}
        <Link
          to={eventHref}
          className={cn(
            "relative shrink-0 bg-muted overflow-hidden",
            imageSize
          )}
          aria-label={`Voir ${novelty.title}`}
        >
          {image ? (
            <img
              src={image}
              alt={novelty.title}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-muted to-muted/40">
              <Building2 className="h-8 w-8 text-muted-foreground/40" />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
                {typeLabel}
              </span>
            </div>
          )}
        </Link>

        {/* Zone texte */}
        <div className="flex-1 min-w-0 p-4 sm:p-5 flex flex-col gap-2.5">
          {/* Méta haute : type + countdown bien visible */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="font-medium">
              {typeLabel}
            </Badge>
            {countdownLabel && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border",
                  isUrgent
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-muted text-foreground/80 border-border"
                )}
              >
                <Clock className="h-3 w-3" />
                {countdownLabel}
              </span>
            )}
          </div>

          {/* Titre */}
          <Link to={eventHref} className="block">
            <h3 className="font-semibold text-base sm:text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {novelty.title}
            </h3>
          </Link>

          {/* Description courte */}
          {novelty.reason_1 && variant !== "compact" && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {novelty.reason_1}
            </p>
          )}

          {/* Contexte salon — rendu léger, sans aplat */}
          <div className="flex flex-col gap-1 pt-0.5">
            <Link
              to={eventHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors min-w-0"
            >
              <Calendar className="h-3.5 w-3.5 shrink-0 text-primary/70" />
              <span className="truncate">{event.nom_event}</span>
            </Link>
            <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground flex-wrap pl-5">
              {event.date_debut && (
                <span>
                  {format(new Date(event.date_debut), "dd MMM yyyy", { locale: fr })}
                </span>
              )}
              {event.ville && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {event.ville}
                </span>
              )}
            </div>
          </div>

          {/* Séparateur subtil */}
          <div className="h-px bg-border/60" />

          {/* Ligne exposant + signal document */}
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {logo ? (
                <div className="w-6 h-6 rounded bg-white border flex items-center justify-center shrink-0">
                  <img
                    src={logo}
                    alt={exhibitor.name}
                    className="max-w-full max-h-full object-contain"
                    loading="lazy"
                  />
                </div>
              ) : (
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className="text-sm font-medium truncate">{exhibitor.name}</span>
            </div>

            {novelty.doc_url && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                <FileText className="h-3 w-3" />
                Document disponible
              </span>
            )}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-2 pt-1 mt-auto">
            <Button asChild size="sm" className="gap-1">
              <Link to={eventHref}>
                Voir la nouveauté
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="text-muted-foreground">
              <Link to={`/events/${event.slug}`}>Voir le salon</Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
