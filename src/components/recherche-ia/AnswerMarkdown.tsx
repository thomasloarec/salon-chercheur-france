import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUpRight, Building2, CalendarDays } from 'lucide-react';

/**
 * Rendu markdown des réponses de l'agent Recherche IA.
 *
 * Principes de la refonte :
 * - une seule couleur d'accent, le violet de la charte ; l'orange hors charte est retiré ;
 * - la hiérarchie passe par la taille, la graisse et l'espacement, jamais par la couleur ;
 * - les liens produits par l'agent sont typés : /events/{slug} = salon, /exposants/{slug} =
 *   entreprise. Ils deviennent des pastilles à icône, ce qui rend les listes de salons et
 *   d'exposants lisibles d'un coup d'oeil, sans rien changer au markdown reçu ;
 * - tout lien non reconnu retombe sur un lien texte classique : aucun lien n'est jamais perdu.
 * Le projet n'utilise pas @tailwindcss/typography : chaque élément est stylé ici.
 */

const CALLOUT_RE =
  /^(conseil|notre conseil|à retenir|a retenir|en résumé|en resume|en bref|recommandation|à noter|a noter|prochaine étape|prochaine etape)/i;

/** Texte brut d'un noeud hast, utilisé pour reconnaître les paragraphes de synthèse. */
function hastText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return String(node.value ?? '');
  if (Array.isArray(node.children)) return node.children.map(hastText).join('');
  return '';
}

type ChipKind = 'event' | 'exhibitor';

const CHIP_BASE =
  'inline-flex items-center gap-1 rounded-md border px-1.5 py-[2px] text-[0.95em] font-medium leading-snug no-underline transition-colors';

const ChipLink = ({
  kind,
  href,
  children,
}: {
  kind: ChipKind;
  href: string;
  children: React.ReactNode;
}) => {
  const Icon = kind === 'event' ? CalendarDays : Building2;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${CHIP_BASE} ${
        kind === 'event'
          ? 'border-primary/25 bg-[hsl(var(--violet-soft))] text-primary hover:border-primary/60'
          : 'border-border bg-secondary/60 text-foreground hover:border-primary/40 hover:text-primary'
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
      <span>{children}</span>
    </a>
  );
};

const AnswerMarkdown = ({ children }: { children: string }) => {
  return (
    <div className="answer-reveal max-w-[70ch] text-[15px] leading-[1.7] text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node, children, ...props }) => {
            const first = (node as any)?.children?.[0];
            const isCallout =
              first?.tagName === 'strong' && CALLOUT_RE.test(hastText(first).trim());
            if (isCallout) {
              return (
                <div className="my-5 rounded-xl border border-primary/20 bg-[hsl(var(--violet-soft)/0.6)] px-4 py-3 text-[15px] leading-[1.65]">
                  <p {...props}>{children}</p>
                </div>
              );
            }
            return (
              <p className="my-3.5" {...props}>
                {children}
              </p>
            );
          },
          ul: ({ node, ...props }) => (
            <ul
              className="my-3.5 list-disc space-y-2 pl-5 marker:text-primary/40"
              {...props}
            />
          ),
          ol: ({ node, ...props }) => (
            <ol
              className="my-3.5 list-decimal space-y-2 pl-5 marker:font-medium marker:text-muted-foreground"
              {...props}
            />
          ),
          li: ({ node, ...props }) => <li className="pl-1 leading-[1.65]" {...props} />,
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-foreground" {...props} />
          ),
          em: ({ node, ...props }) => <em className="italic text-foreground/90" {...props} />,
          h1: ({ node, ...props }) => (
            <h3
              className="heading-display mb-2 mt-7 text-[19px] text-foreground"
              {...props}
            />
          ),
          h2: ({ node, ...props }) => (
            <h3
              className="heading-display mb-2 mt-7 border-t border-border/70 pt-5 text-[17px] text-foreground"
              {...props}
            />
          ),
          h3: ({ node, ...props }) => (
            <h4
              className="mb-1.5 mt-5 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground"
              {...props}
            />
          ),
          h4: ({ node, ...props }) => (
            <h5 className="mb-1.5 mt-4 text-[15px] font-semibold text-foreground" {...props} />
          ),
          a: ({ node, href, children, ...props }) => {
            const target = typeof href === 'string' ? href : '';
            if (target.startsWith('/events/')) {
              return (
                <ChipLink kind="event" href={target}>
                  {children}
                </ChipLink>
              );
            }
            if (target.startsWith('/exposants/')) {
              return (
                <ChipLink kind="exhibitor" href={target}>
                  {children}
                </ChipLink>
              );
            }
            const isExternal = /^https?:/i.test(target);
            return (
              <a
                {...props}
                href={target}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary"
              >
                {children}
                {isExternal && (
                  <ArrowUpRight
                    className="ml-0.5 inline h-3 w-3 align-[-0.1em] opacity-70"
                    aria-hidden="true"
                  />
                )}
              </a>
            );
          },
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="my-4 border-l-2 border-primary/40 pl-4 text-muted-foreground"
              {...props}
            />
          ),
          hr: () => <hr className="my-6 border-t border-border/70" />,
          table: ({ node, ...props }) => (
            <div className="my-4 w-full overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-[14px]" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => <thead className="bg-secondary/60" {...props} />,
          th: ({ node, ...props }) => (
            <th
              className="border-b border-border px-3 py-2 text-left font-semibold text-foreground"
              {...props}
            />
          ),
          td: ({ node, ...props }) => (
            <td className="border-b border-border/60 px-3 py-2 align-top" {...props} />
          ),
          code: ({ node, ...props }) => (
            <code className="rounded bg-secondary px-1 py-0.5 text-[13px]" {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};

export default AnswerMarkdown;
