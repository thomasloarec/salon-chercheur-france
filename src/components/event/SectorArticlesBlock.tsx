import { Link } from 'react-router-dom';
import { CalendarDays, FileText } from 'lucide-react';
import { useSectorArticles } from '@/hooks/useSectorArticles';
import { cn } from '@/lib/utils';
import type { Event } from '@/types/event';

interface SectorArticlesBlockProps {
  event: Pick<Event, 'secteur'>;
}

/**
 * « À lire sur [Secteur] » (lot 9) — rangée distincte, pleine largeur,
 * toujours EN DESSOUS des événements similaires, jamais à côté.
 * Jusqu'à 3 articles publiés. Avec 1 ou 2 articles, la rangée est contenue
 * et centrée plutôt qu'étirée.
 */
export const SectorArticlesBlock = ({ event }: SectorArticlesBlockProps) => {
  const sectors = Array.isArray(event.secteur)
    ? event.secteur
    : event.secteur
      ? [event.secteur]
      : [];

  const { data: articles, isLoading } = useSectorArticles(sectors.length > 0 ? sectors : null);

  if (isLoading || !articles || articles.length === 0) {
    return null;
  }

  const sectorLabel = sectors[0] as string | undefined;
  const count = articles.length;

  return (
    <section className="min-w-0">
      <h2 className="heading-display text-xl font-semibold text-foreground sm:text-2xl">
        {sectorLabel ? `À lire sur ${sectorLabel}` : 'À lire sur ce secteur'}
      </h2>

      <div
        className={cn(
          'mt-4 grid gap-5',
          count === 1 && 'max-w-md',
          count === 2 && 'max-w-3xl sm:grid-cols-2',
          count >= 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {articles.map((article) => (
          <Link
            key={article.id}
            to={`/blog/${article.slug}`}
            className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow duration-200 hover:shadow-md"
          >
            {article.header_image_url ? (
              <div className="aspect-[16/9] overflow-hidden bg-muted">
                <img
                  src={article.header_image_url}
                  alt={article.h1_title || article.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            ) : (
              <div className="flex aspect-[16/9] items-center justify-center bg-muted">
                <FileText className="h-8 w-8 text-muted-foreground/60" />
              </div>
            )}
            <div className="flex flex-1 flex-col gap-2 p-4">
              <h3 className="line-clamp-2 text-base font-semibold text-foreground transition-colors group-hover:text-primary">
                {article.h1_title || article.title}
              </h3>
              {article.intro_text && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {article.intro_text.slice(0, 150)}
                </p>
              )}
              {article.published_at && (
                <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date(article.published_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
