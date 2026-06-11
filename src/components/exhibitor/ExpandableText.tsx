import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Bloc E — Texte tronqué à 3 lignes (line-clamp CSS) avec bascule
 * « Voir plus » / « Voir moins ». Le bouton n'apparaît que si le texte
 * dépasse réellement 3 lignes (mesure scrollHeight vs clientHeight en mode
 * tronqué). Aucune découpe JS du contenu : tout le texte reste dans le DOM
 * (sécurité SEO).
 */
export default function ExpandableText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    // On ne mesure le débordement qu'en mode tronqué : une fois déplié,
    // scrollHeight == clientHeight et le bouton doit rester disponible.
    if (!el || expanded) return;
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [text, expanded]);

  return (
    <div className={className}>
      <p
        ref={ref}
        className={cn(
          'text-sm text-muted-foreground max-w-3xl whitespace-pre-line',
          !expanded && 'line-clamp-3',
        )}
      >
        {text}
      </p>
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? 'Voir moins' : 'Voir plus'}
        </button>
      )}
    </div>
  );
}
