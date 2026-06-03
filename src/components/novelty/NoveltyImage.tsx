import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { noveltyTypeLabel } from "@/lib/noveltyTypeMeta";

interface NoveltyImageProps {
  src?: string | null;
  alt: string;
  /** Type de nouveauté — affiché dans le placeholder si aucune image. */
  type?: string | null;
  /** Tailwind aspect ratio class, ex: "aspect-[3/4]" ou "aspect-[4/5]". */
  ratioClassName?: string;
  /**
   * "cover" recadre (cartes compactes), "contain" préserve l'image entière
   * sur un fond flouté (nouveauté principale / images verticales mal cadrées).
   */
  fit?: "cover" | "contain";
  className?: string;
}

/**
 * Visuel de nouveauté pensé pour les images verticales uploadées par les
 * utilisateurs. En mode "contain", l'image entière est affichée par-dessus une
 * version floutée d'elle-même : aucun recadrage ne coupe le contenu.
 * Sans image, un placeholder sobre lié au type est rendu.
 */
export default function NoveltyImage({
  src,
  alt,
  type,
  ratioClassName = "aspect-[4/5]",
  fit = "cover",
  className,
}: NoveltyImageProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted",
        ratioClassName,
        className,
      )}
    >
      {src ? (
        <>
          {fit === "contain" && (
            <img
              src={src}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl"
            />
          )}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className={cn(
              "absolute inset-0 h-full w-full transition-transform duration-500",
              fit === "contain"
                ? "object-contain"
                : "object-cover group-hover:scale-[1.03]",
            )}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-muted to-muted/40">
          <Building2 className="h-8 w-8 text-muted-foreground/40" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
            {noveltyTypeLabel(type)}
          </span>
        </div>
      )}
    </div>
  );
}