import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bookmark, BookmarkCheck, Building2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getExhibitorLogoUrl } from "@/utils/exhibitorLogo";
import { noveltyTypeLabel } from "@/lib/noveltyTypeMeta";
import type { NoveltyWatchRow } from "@/hooks/useNoveltiesWatch";

/**
 * Refonte de la page Nouveautés, run F1.2 : carte nouveauté au format 4:5.
 * Nom distinct de NoveltyCard.tsx (ancienne carte, utilisée par la modération admin).
 *
 * Média :
 * - « photo » : image entière (jamais recadrée) sur fond neutre ;
 * - « composition texte » : fond navy, nature et titre en Playfair ;
 * - réglage admin `display_mode` : 'photo' ou 'typographic' imposés, null = automatique ;
 * - automatique : photo si l'image existe, se charge et n'est pas minuscule (logo, icône),
 *   sinon composition texte. Une image cassée bascule toujours en composition texte.
 *
 * Texte : nature, titre, phrase d'intérêt (summary), entreprise, stand
 * (ou « Stand à confirmer »). Le stand vient uniquement de `participation`.
 *
 * Actions : « Découvrir » (fiche détail). « Enregistrer » n'apparaît que si la page
 * fournit onToggleSave (branché sur le like existant au run F1.3).
 * Run F1.3 : badge « Nouveau » (isNew) et signal d'ouverture de fiche (onOpen, mesure).
 * La provenance (exposant ou Lotexpo) n'est jamais affichée au public.
 */

/** En dessous de cette taille (px, largeur ET hauteur), l'image est traitée comme un logo. */
const MIN_PHOTO_SIZE = 240;

interface NoveltyCardV2Props {
  novelty: NoveltyWatchRow;
  /** Affiche le salon sous l'entreprise (inutile quand les cartes sont groupées par salon). */
  showEvent?: boolean;
  /** Fourni au run F1.3 : l'action « Enregistrer » n'apparaît qu'avec ce callback. */
  onToggleSave?: (novelty: NoveltyWatchRow) => void;
  saved?: boolean;
  savePending?: boolean;
  /** Publiée depuis la dernière visite du visiteur sur la page. */
  isNew?: boolean;
  /** Appelé à l'ouverture de la fiche (mesure). */
  onOpen?: (novelty: NoveltyWatchRow) => void;
  className?: string;
}

function standLabel(stands: string[] | undefined): string | null {
  const list = (stands ?? []).map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return null;
  return list.length === 1 ? `Stand ${list[0]}` : `Stands ${list.join(" · ")}`;
}

function shortDate(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function NoveltyCardV2({
  novelty,
  showEvent = false,
  onToggleSave,
  saved = false,
  savePending = false,
  isNew = false,
  onOpen,
  className,
}: NoveltyCardV2Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageTooSmall, setImageTooSmall] = useState(false);

  const exhibitor = novelty.exhibitors;
  const event = novelty.events;
  if (!exhibitor || !event) return null;

  const href = novelty.slug ? `/nouveautes/${novelty.slug}` : `/events/${event.slug}?novelty=${novelty.id}`;
  const nature = noveltyTypeLabel(novelty.type);
  const image = (novelty.media_urls?.[0] ?? "").trim() || null;
  const logo = getExhibitorLogoUrl(exhibitor.logo_url, exhibitor.website);
  const stand = standLabel(novelty.stands);

  const typographic =
    !image ||
    imageFailed ||
    novelty.display_mode === "typographic" ||
    (novelty.display_mode !== "photo" && imageTooSmall);
  const handleOpen = () => onOpen?.(novelty);

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-background transition-shadow hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      {isNew && (
        <span className="absolute right-3 top-3 z-10 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-sm">
          Nouveau
        </span>
      )}

      {/* ------------------------------ Média 4:5 ------------------------------ */}
      <Link to={href} tabIndex={-1} aria-hidden className="block" onClick={handleOpen}>
        {typographic ? (
          <div className="relative aspect-[4/5] overflow-hidden bg-surface-inverse text-inverse">
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
            <div className="relative flex h-full flex-col justify-between p-5 sm:p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-inverse-primary">{nature}</p>
              <p className="heading-display line-clamp-6 text-[1.35rem] leading-[1.18] sm:text-[1.45rem]">
                {novelty.title}
              </p>
              <span className="block h-px w-10 bg-inverse-primary/70" />
            </div>
          </div>
        ) : (
          <div className="relative aspect-[4/5] overflow-hidden bg-muted">
            <img
              src={image!}
              alt={novelty.title}
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth < MIN_PHOTO_SIZE && img.naturalHeight < MIN_PHOTO_SIZE) {
                  setImageTooSmall(true);
                }
              }}
              className="absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </div>
        )}
      </Link>

      {/* ------------------------------ Texte ------------------------------ */}
      <div className="flex flex-1 flex-col p-4">
        {!typographic && (
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">{nature}</p>
        )}
        <h3
          className={
            typographic
              ? "sr-only"
              : "mt-1.5 line-clamp-3 text-base font-semibold leading-snug text-foreground"
          }
        >
          <Link to={href} tabIndex={-1} className="transition-colors hover:text-primary" onClick={handleOpen}>
            {novelty.title}
          </Link>
        </h3>

        {novelty.summary && (
          <p className={cn("line-clamp-3 text-sm leading-relaxed text-muted-foreground", typographic ? "" : "mt-2")}>
            {novelty.summary}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 text-sm font-medium text-foreground">
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
          {stand ? (
            <span className="font-medium text-foreground">{stand}</span>
          ) : (
            <span>Stand à confirmer</span>
          )}
          {showEvent && (
            <span className="truncate">
              {" · "}
              {event.nom_event}
              {event.date_debut ? `, ${shortDate(event.date_debut)}` : ""}
            </span>
          )}
        </p>

        <div className="mt-auto flex gap-2 pt-4">
          <Button asChild size="sm" className="flex-1 gap-1.5">
            <Link to={href} aria-label={`Découvrir : ${novelty.title}`} onClick={handleOpen}>
              Découvrir
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          {onToggleSave && (
            <Button
              type="button"
              size="sm"
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
