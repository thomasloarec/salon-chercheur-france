
import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import MainLayout from '@/components/layout/MainLayout';
import { usePublishedArticles } from '@/hooks/useBlogArticles';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays, FileText } from 'lucide-react';

const Blog = () => {
  const { data: articles, isLoading } = usePublishedArticles();

  return (
    <MainLayout title="Blog">
      <Helmet>
        <title>Blog salons professionnels B2B — Lotexpo</title>
        <meta name="description" content="Découvrez nos articles sur les salons professionnels B2B en France : conseils, tendances, guides et événements à ne pas manquer." />
        <link rel="canonical" href="https://lotexpo.com/blog" />
        <meta property="og:title" content="Blog salons professionnels B2B — Lotexpo" />
        <meta property="og:description" content="Découvrez nos articles sur les salons professionnels B2B en France." />
        <meta property="og:url" content="https://lotexpo.com/blog" />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="container mx-auto py-12 px-4">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3">Blog</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Guides, tendances et conseils pour réussir vos salons professionnels B2B.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : !articles?.length ? (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun article publié pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map(article => (
              <Link key={article.id} to={`/blog/${article.slug}`} className="group">
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
                    <h2 className="text-lg font-semibold group-hover:text-primary transition-colors line-clamp-2">
                      {article.h1_title || article.title}
                    </h2>
                    {article.intro_text && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {article.intro_text.slice(0, 150)}...
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                      {article.published_at && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {new Date(article.published_at).toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'long', year: 'numeric'
                          })}
                        </span>
                      )}
                      {article.event_ids?.length > 0 && (
                        <span>{article.event_ids.length} événement{article.event_ids.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Blog;
