
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import MainLayout from '@/components/layout/MainLayout';
import { useBlogArticleBySlug, usePublishedArticles, BlogEventLink } from '@/hooks/useBlogArticles';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, MapPin, ArrowRight, FileText } from 'lucide-react';

interface LinkedEvent {
  id: string;
  nom_event: string;
  date_debut: string | null;
  date_fin: string | null;
  ville: string | null;
  url_image: string | null;
  slug: string | null;
  secteur: any;
  description?: string; // contextual description from article
}

const BlogArticle = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: article, isLoading, error } = useBlogArticleBySlug(slug);
  const { data: allArticles } = usePublishedArticles();
  const [linkedEvents, setLinkedEvents] = useState<LinkedEvent[]>([]);

  // Load linked events
  useEffect(() => {
    if (!article?.event_ids?.length) {
      setLinkedEvents([]);
      return;
    }
    const eventLinks: BlogEventLink[] = article.event_ids;
    const ids = eventLinks.map(l => l.event_id);
    const load = async () => {
      const { data } = await supabase
        .from('events')
        .select('id, nom_event, date_debut, date_fin, ville, url_image, slug, secteur')
        .in('id', ids);
      if (data) {
        // Sort: upcoming first by date
        const now = new Date();
        const withDesc = data.map(e => {
          const link = eventLinks.find(l => l.event_id === e.id);
          return { ...e, description: link?.description || '' } as LinkedEvent;
        });
        withDesc.sort((a, b) => {
          const aDate = a.date_debut ? new Date(a.date_debut) : new Date('9999-01-01');
          const bDate = b.date_debut ? new Date(b.date_debut) : new Date('9999-01-01');
          const aFuture = aDate >= now;
          const bFuture = bDate >= now;
          if (aFuture && !bFuture) return -1;
          if (!aFuture && bFuture) return 1;
          return aDate.getTime() - bDate.getTime();
        });
        setLinkedEvents(withDesc);
      }
    };
    load();
  }, [article?.event_ids]);

  // Similar articles
  const similarArticles = allArticles
    ?.filter(a => a.id !== article?.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  if (isLoading) {
    return (
      <MainLayout title="Chargement...">
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  if (error || !article) {
    return (
      <MainLayout title="Article introuvable">
        <div className="container mx-auto py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Article introuvable</h1>
          <Link to="/blog"><Button>Retour au blog</Button></Link>
        </div>
      </MainLayout>
    );
  }

  const isPast = (dateStr: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const publishedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const updatedDate = article.updated_at && article.published_at && article.updated_at !== article.published_at
    ? new Date(article.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const getSectors = (secteur: any): string[] => {
    if (!secteur) return [];
    if (Array.isArray(secteur)) return secteur.flat();
    return [];
  };

  const faqItems = article.faq?.filter(f => f.question && f.answer) || [];

  // FAQ Schema for SEO
  const faqSchema = faqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  } : null;

  return (
    <MainLayout title={article.h1_title || article.title}>
      <Helmet>
        <title>{article.meta_title || article.title}</title>
        <meta name="description" content={article.meta_description || ''} />
        <link rel="canonical" href={`https://lotexpo.com/blog/${article.slug}`} />
        {article.header_image_url && <meta property="og:image" content={article.header_image_url} />}
        <meta property="og:title" content={article.meta_title || article.title} />
        <meta property="og:description" content={article.meta_description || ''} />
        <meta property="og:url" content={`https://lotexpo.com/blog/${article.slug}`} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Lotexpo" />
        <meta property="og:locale" content="fr_FR" />
        {faqSchema && (
          <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        )}
      </Helmet>

      <article>
        {/* 1. Header image - full width with gradient overlay */}
        {article.header_image_url && (
          <div className="relative w-full aspect-[1.91/1] max-h-[500px] overflow-hidden">
            <img
              src={article.header_image_url}
              alt={article.h1_title || article.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
        )}

        <div className="container mx-auto px-4 max-w-4xl py-8">
          {/* 2. Publication metadata */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            {publishedDate && (
              <time className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                Publié le {publishedDate}
              </time>
            )}
            {updatedDate && <span>· Mis à jour le {updatedDate}</span>}
          </div>

          {/* 3. H1 Title */}
          <h1 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
            {article.h1_title || article.title}
          </h1>

          {/* 4. Intro hook */}
          {article.intro_text && (
            <div className="text-lg text-muted-foreground leading-relaxed mb-10 border-l-4 border-primary pl-5 py-3 bg-muted/30 rounded-r-lg">
              {article.intro_text.split('\n').map((p, i) => (
                <p key={i} className={i > 0 ? 'mt-2' : ''}>{p}</p>
              ))}
            </div>
          )}

          {/* 5. Events integrated in flow */}
          {linkedEvents.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold mb-6">Les salons de cet article</h2>
              <div className="space-y-4">
                {linkedEvents.map(event => (
                  <div key={event.id}>
                    <div className="flex items-center gap-4 p-4 border rounded-xl hover:shadow-md transition-shadow">
                      {event.url_image ? (
                        <img src={event.url_image} alt={event.nom_event} className="h-20 w-28 object-cover rounded-lg flex-shrink-0" />
                      ) : (
                        <div className="h-20 w-28 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{event.nom_event}</h3>
                          {isPast(event.date_fin || event.date_debut) && (
                            <Badge variant="outline" className="text-xs shrink-0">Événement passé</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {event.date_debut && (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {new Date(event.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                          )}
                          {event.ville && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {event.ville}
                            </span>
                          )}
                        </div>
                        {getSectors(event.secteur).length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {getSectors(event.secteur).slice(0, 3).map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {event.slug && (
                        <Link to={`/events/${event.slug}`}>
                          <Button variant="outline" size="sm">
                            Voir <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </div>
                    {/* Event contextual description */}
                    {event.description && (
                      <p className="text-sm italic text-muted-foreground mt-2 ml-4 pl-4 border-l-2 border-muted">
                        {event.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 6. Why visit block */}
          {article.why_visit_text && (
            <section className="mb-12 bg-muted/40 rounded-xl p-6 md:p-8">
              <h2 className="text-2xl font-bold mb-4">Pourquoi visiter ces salons ?</h2>
              <div className="prose prose-lg max-w-none">
                {article.why_visit_text.split('\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          )}

          {/* 7. FAQ section with native details/summary */}
          {faqItems.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold mb-6">Questions fréquentes</h2>
              <div className="space-y-3">
                {faqItems.map((faq, i) => (
                  <details
                    key={i}
                    className="group border rounded-lg overflow-hidden"
                  >
                    <summary className="flex items-center justify-between p-4 cursor-pointer font-semibold text-foreground hover:bg-muted/50 transition-colors list-none [&::-webkit-details-marker]:hidden">
                      <span>{faq.question}</span>
                      <span className="ml-2 text-muted-foreground group-open:rotate-180 transition-transform duration-200">
                        ▾
                      </span>
                    </summary>
                    <div className="px-4 pb-4 pt-0 text-muted-foreground leading-relaxed">
                      {faq.answer.split('\n').map((p, j) => (
                        <p key={j} className={j > 0 ? 'mt-2' : ''}>{p}</p>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* 8. Similar articles */}
          {similarArticles && similarArticles.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-6">Articles similaires</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {similarArticles.map(a => (
                  <Link key={a.id} to={`/blog/${a.slug}`} className="group">
                    <Card className="overflow-hidden h-full hover:shadow-lg transition-shadow">
                      {a.header_image_url ? (
                        <div className="aspect-[16/9] overflow-hidden">
                          <img
                            src={a.header_image_url}
                            alt={a.h1_title || a.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="aspect-[16/9] bg-muted flex items-center justify-center">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <CardContent className="p-4">
                        <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-2">
                          {a.h1_title || a.title}
                        </h3>
                        {a.published_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(a.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>
    </MainLayout>
  );
};

export default BlogArticle;
