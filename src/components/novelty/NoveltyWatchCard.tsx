import { Link } from "react-router-dom";
import { Calendar, MapPin, FileText, Building2, ArrowRight, Clock } from "lucide-react";
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
}

export default function NoveltyWatchCard({ novelty, className }: NoveltyWatchCardProps) {
  const exhibitor = novelty.exhibitors;
  const event = novelty.events;
  if (!exhibitor || !event) return null;

  const typeLabel = TYPE_LABELS[novelty.type] || novelty.type;
  const image = novelty.media_urls?.[0];
  const logo = getExhibitorLogoUrl(exhibitor.logo_url, exhibitor.website);

  const daysUntil = event.date_debut
    ? differenceInDays(new Date(event.date_debut), new Date())
    : null;

  const countdownLabel =
    daysUntil === null
      ? null
      : daysUntil <= 0
      ? "En cours"
      : daysUntil === 1
      ? "Dans 1 jour"
      : `Dans ${daysUntil} jours`;

  const eventHref = `/events/${event.slug}#nouveautes`;

  return (
    <Card
      className={cn(
        "group overflow-hidden hover:shadow-md transition-shadow border-border/60",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Visuel : compact, jamais dominant */}
        <Link
          to={eventHref}
          className="relative shrink-0 w-full sm:w-44 md:w-52 aspect-[4/3] sm:aspect-auto sm:h-auto bg-muted overflow-hidden"
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
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/40">
              <Building2 className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
        </Link>

        {/* Zone texte */}
        <div className="flex-1 min-w-0 p-4 sm:p-5 flex flex-col gap-3">
          {/* Méta : badge type + countdown */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="font-medium">
              {typeLabel}
            </Badge>
            {countdownLabel && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {countdownLabel}
              </span>
            )}
            {novelty.doc_url && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                <FileText className="h-3 w-3" />
                Document disponible
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
          {novelty.reason_1 && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {novelty.reason_1}
            </p>
          )}

          {/* Ligne exposant */}
          <div className="flex items-center gap-2 min-w-0">
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
              <div className="w-6 h-6 rounded bg-muted flex items-center justify-center shrink-0">
                <Building2 className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
            <span className="text-sm font-medium truncate">{exhibitor.name}</span>
          </div>

          {/* Ligne salon */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <Calendar className="h-3 w-3 shrink-0" />
            <span className="truncate">{event.nom_event}</span>
            {event.ville && (
              <>
                <span aria-hidden>•</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {event.ville}
                </span>
              </>
            )}
            {event.date_debut && (
              <>
                <span aria-hidden>•</span>
                <span>
                  {format(new Date(event.date_debut), "dd MMM yyyy", { locale: fr })}
                </span>
              </>
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
            <Button asChild size="sm" variant="outline">
              <Link to={`/events/${event.slug}`}>Voir le salon</Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
