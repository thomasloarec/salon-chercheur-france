import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bookmark, BookmarkCheck, Building2, CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getExhibitorLogoUrl } from "@/utils/exhibitorLogo";
import { noveltyTypeLabel } from "@/lib/noveltyTypeMeta";
import type { NoveltyWatchRow } from "@/hooks/useNoveltiesWatch";

/**
 * Refonte de la page Nouveautés, run F1.4 : carte « À la une », affichée dans l'en-tête.
 * Même règles de média que NoveltyCardV2 : image entière (jamais recadrée) sur fond neutre,
 * composition texte si display_mode = 'typographic', sans image, image cassée ou minuscule.
 * La provenance (exposant ou Lotexpo) et le choix admin/automatique ne sont jamais affichés.
 */

const MIN_PHOTO_SIZE = 240;

interface NoveltyFeaturedCardProps {
  novelty: NoveltyWatchRow;
  onToggleSave?: (novelty: NoveltyWatchRow) => void;
  saved?: boolean;
  savePending?: boolean;
  onOpen?: (novelty: NoveltyWatchRow) => void;
  className?: string;
}

function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function shortRange(startValue: string | null | undefined, endValue: string | null | undefined): string {
  const start = parseDay(startValue);
  if (!start) return "";
  const end = parseDay(endValue);
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  if (!end || end.getTime() === start.getTime()) return fmt(start);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate() === 1 ? "1er" : start.getDate()} au ${fmt(end)}`;
  }
  return `${fmt(start)} au ${fmt(end)}`;
}

export default function NoveltyFeaturedCard({
  novelty,
  onToggleSave,
  saved = false,
  savePending = false,
  onOpen,
  className,
}: NoveltyFeaturedCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageTooSmall, setImageTooSmall] = useState(false);

  const exhibitor = novelty.exhibitors;
  const event = novelty.events;
  if (!exhibitor || !event) return null;

  const href = novelty.slug ? `/nouveautes/${novelty.slug}` : `/events/${event.slug}?novelty=${novelty.id}`;
  const nature = noveltyTypeLabel(novelty.type);
  const image = (novelty.media_urls?.[0] ?? "").trim() || null;
  const logo = getExhibitorLogoUrl(exhibitor.logo_url, exhibitor.website);
  const stands = (novelty.stands ?? []).map((s) => s.trim()).filter(Boolean);
  const stand = stands.length === 0 ? null : stands.length === 1 ? `Stand ${stands[0]}` : `Stands ${stands.join(" · ")}`;
  const typographic =
    !image ||
    imageFailed ||
    novelty.display_mode === "typographic" ||
    (novelty.display_mode !== "photo" && imageTooSmall);
  const handleOpen = () => onOpen?.(novelty);

  return (
    <article
      className={cn(
        "relative grid overflow-hidden rounded-2xl bg-background text-foreground shadow-2xl ring-1 ring-white/10 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]",
        className,
      )}
    >
      {/* ------------------------------ Média ------------------------------ */}
      <Link
        to={href}
        tabIndex={-1}
        aria-hidden
        className="relative block aspect-[4/3] overflow-hidden bg-muted sm:aspect-auto sm:h-full sm:min-h-[320px]"
        onClick={handleOpen}
      >
        {typographic ? (
          <div className="absolute inset-0 flex flex-col justify-between overflow-hidden bg-surface-inverse p-5 text-inverse">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: "url(/home-texture-plexus.jpg)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                opacity: 0.18,
              }}
            />
            <p className="relative text-[11px] font-bold uppercase tracking-[0.15em] text-inverse-primary">{nature}</p>
            <p className="heading-display relative line-clamp-5 text-xl leading-[1.18]">{novelty.title}</p>
            <span className="relative block h-px w-10 bg-inverse-primary/70" />
          </div>
        ) : (
          <div className="absolute inset-0">
            <img
              src={image!}
              alt={novelty.title}
              decoding="async"
              onError={() => setImageFailed(true)}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth < MIN_PHOTO_SIZE && img.naturalHeight < MIN_PHOTO_SIZE) {
                  setImageTooSmall(true);
                }
              }}
              className="absolute inset-0 h-full w-full object-contain"
            />
          </div>
        )}
      </Link>

      {/* ------------------------------ Texte ------------------------------ */}
      <div className="flex min-w-0 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
            À la une
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">{nature}</span>
        </div>

        <h2 className="heading-display mt-3 line-clamp-4 text-2xl leading-tight text-foreground">
          <Link to={href} tabIndex={-1} className="transition-colors hover:text-primary" onClick={handleOpen}>
            {novelty.title}
          </Link>
        </h2>

        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span className="truncate">
            {event.nom_event}
            {event.date_debut ? ` · ${shortRange(event.date_debut, event.date_fin)}` : ""}
            {event.ville ? ` · ${event.ville}` : ""}
          </span>
        </p>

        {novelty.summary && (
          <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-muted-foreground">{novelty.summary}</p>
        )}

        <div className="mt-4 flex items-center gap-2 text-sm font-medium">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded border bg-white">
            {logo ? (
              <img src={logo} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
            ) : (
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            )}
          </span>
          <span className="truncate">{exhibitor.name}</span>
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {stand ? <span className="font-medium text-foreground">{stand}</span> : <span>Stand à confirmer</span>}
        </p>

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          <Button asChild className="flex-1 gap-1.5">
            <Link to={href} aria-label={`Découvrir : ${novelty.title}`} onClick={handleOpen}>
              Découvrir
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          {onToggleSave && (
            <Button
              type="button"
              variant="outline"
              className={cn("gap-1.5", saved && "border-primary/50 text-primary hover:text-primary")}
              aria-pressed={saved}
              disabled={savePending}
              onClick={() => onToggleSave(novelty)}
            >
              {saved ? (
                <BookmarkCheck className="h-4 w-4 text-primary" aria-hidden />
              ) : (
                <Bookmark className="h-4 w-4" aria-hidden />
              )}
              {saved ? "Enregistrée" : "Enregistrer"}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
