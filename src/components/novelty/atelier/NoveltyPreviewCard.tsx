import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Heart, MessageSquare, Download, Calendar, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

/**
 * Aperçu fidèle de NoveltyCard, SANS aucun hook de données.
 * Volontairement purement présentationnel : aucune requête n'est déclenchée,
 * l'objet affiché n'existe pas encore en base (id factice).
 */

export const NOVELTY_TYPE_LABELS: Record<string, string> = {
  Launch: 'Lancement produit',
  Update: 'Mise à jour',
  Demo: 'Démonstration',
  Special_Offer: 'Offre spéciale',
  Partnership: 'Partenariat',
  Innovation: 'Innovation',
};

export interface NoveltyPreviewData {
  title: string;
  type: string;
  reason_1?: string;
  reason_2?: string;
  reason_3?: string;
  audience_tags?: string[];
  media_urls?: string[];
  doc_url?: string | null;
  exhibitorName: string;
  exhibitorLogoUrl?: string | null;
  standInfo?: string | null;
}

export default function NoveltyPreviewCard({
  data,
  className,
}: {
  data: NoveltyPreviewData;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const images = data.media_urls?.filter(Boolean) ?? [];
  const hasMultiple = images.length > 1;
  const current = Math.min(index, Math.max(images.length - 1, 0));
  const description = [data.reason_1, data.reason_2, data.reason_3].filter(Boolean).join(' ');

  return (
    <div
      className={cn(
        'rounded-2xl border shadow-sm p-5 space-y-4 bg-card w-full max-w-xl mx-auto',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
            <h3
              className={cn(
                'text-lg font-semibold leading-tight',
                !data.title && 'text-muted-foreground/50 italic font-normal',
              )}
            >
              {data.title || 'Votre titre apparaîtra ici'}
            </h3>
            <Badge variant="outline" className="text-xs w-fit">
              {NOVELTY_TYPE_LABELS[data.type] || data.type}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {data.exhibitorLogoUrl ? (
              <div className="w-8 h-8 rounded bg-white flex items-center justify-center flex-shrink-0 border">
                <img
                  src={data.exhibitorLogoUrl}
                  alt={data.exhibitorName}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                <span className="text-xs font-medium">{data.exhibitorName.charAt(0) || '?'}</span>
              </div>
            )}
            <div className="flex flex-col items-start">
              <span className="font-medium text-sm">{data.exhibitorName}</span>
              {data.standInfo && (
                <span className="text-xs text-primary font-medium">Stand {data.standInfo}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="text-sm text-muted-foreground leading-relaxed">
        {description ? (
          <p className="whitespace-pre-line">{description}</p>
        ) : (
          <p className="italic text-muted-foreground/50">
            Votre texte « pourquoi venir la voir » apparaîtra ici.
          </p>
        )}
      </div>

      {/* Media */}
      {images.length > 0 ? (
        <div className="relative rounded-lg overflow-hidden -mx-5">
          <div className="aspect-[4/5] relative overflow-hidden bg-muted">
            <img
              src={images[current]}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
            />
            <div className="absolute inset-0 bg-black/20" />
            <img
              src={images[current]}
              alt={`${data.title || 'Nouveauté'} — image ${current + 1}`}
              className="relative z-10 w-full h-full object-cover"
            />
            {hasMultiple && (
              <>
                <button
                  type="button"
                  onClick={() => setIndex((current - 1 + images.length) % images.length)}
                  className="absolute z-20 left-2 top-1/2 -translate-y-1/2 bg-black/70 text-white p-2 rounded-full"
                  aria-label="Image précédente"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIndex((current + 1) % images.length)}
                  className="absolute z-20 right-2 top-1/2 -translate-y-1/2 bg-black/70 text-white p-2 rounded-full"
                  aria-label="Image suivante"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute z-20 bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'w-2 h-2 rounded-full',
                        i === current ? 'bg-white' : 'bg-white/50',
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="-mx-5">
          <div className="aspect-[4/5] bg-muted/40 border-y flex flex-col items-center justify-center gap-2 text-muted-foreground/60">
            <ImageIcon className="h-8 w-8" />
            <span className="text-xs">Votre image apparaîtra ici</span>
          </div>
        </div>
      )}

      {/* Public cible */}
      {data.audience_tags && data.audience_tags.length > 0 && (
        <div className="pt-2 border-t">
          <h5 className="font-medium text-sm text-muted-foreground mb-1">Public cible</h5>
          <div className="flex flex-wrap gap-1">
            {data.audience_tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Barre d'interaction (inerte en aperçu) */}
      <div className="flex items-center gap-4 pt-3 border-t text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Heart className="h-4 w-4" /> J'aime
        </span>
        <span className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" /> Commenter
        </span>
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" /> Rendez-vous
        </span>
        {data.doc_url && (
          <span className="flex items-center gap-1.5">
            <Download className="h-4 w-4" /> Brochure
          </span>
        )}
      </div>
    </div>
  );
}