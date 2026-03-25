import { Link } from 'react-router-dom';
import { CalendarDays, FileText, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useSectorArticles } from '@/hooks/useSectorArticles';
import type { Event } from '@/types/event';

interface SectorArticlesBlockProps {
  event: Pick<Event, 'secteur'>;
}

/**
 * Shows up to 3 blog articles matching the event's sector(s).
 * Uses the same card style as the Blog listing page for consistency.
 * Hidden if no matching articles found.
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

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        Articles sur ce secteur
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => (
          <Link
            key={article.id}
            to={`/blog/${article.slug}`}
            className="group"
          >
            <Card className="overflow-hidden h-full hover:shadow-lg transition-shadow">
              {article.header_image_url ? (
                <div className="aspect-[16/9] overflow-hidden">
                  <img
                    src={article.header_image_url}
                    alt={article.h1_title || article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="aspect-[16/9] bg-muted flex items-center justify-center">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <CardContent className="p-5 space-y-3">
                <h3 className="text-lg font-semibold group-hover:text-primary transition-colors line-clamp-2">
                  {article.h1_title || article.title}
                </h3>
                {article.intro_text && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {article.intro_text.slice(0, 150)}...
                  </p>
                )}
                {article.published_at && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(article.published_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
};
