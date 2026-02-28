
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import MainLayout from '@/components/layout/MainLayout';
import { useBlogArticleBySlug, usePublishedArticles, BlogEventLink } from '@/hooks/useBlogArticles';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, MapPin, ArrowRight, FileText, Users } from 'lucide-react';

interface LinkedEvent {
  id: string;
  nom_event: string;
  date_debut: string | null;
  date_fin: string | null;
  ville: string | null;
  url_image: string | null;
  slug: string | null;
  secteur: any;
  affluence: string | null;
  description?: string;
}

const SectionTitle = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`mb-8 ${className}`}>
    <h2 className="text-2xl md:text-[28px] font-bold text-foreground">{children}</h2>
    <div className="w-12 h-[3px] bg-primary mt-3 rounded-full" />
  </div>
);

const BlogArticle = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: article, isLoading, error } = useBlogArticleBySlug(slug);
  const { data: allArticles } = usePublishedArticles();
  const [linkedEvents, setLinkedEvents] = useState<LinkedEvent[]>([]);

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
        .select('id, nom_event, date_debut, date_fin, ville, url_image, slug, secteur, affluence')
        .in('id', ids);
      if (data) {
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

  const blogPostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.h1_title || article.title,
    description: article.meta_description || '',
    ...(article.header_image_url && { image: article.header_image_url }),
    datePublished: article.published_at || article.created_at || '',
    dateModified: article.updated_at || article.published_at || '',
    author: { '@type': 'Organization', name: 'Lotexpo' },
    publisher: { '@type': 'Organization', name: 'Lotexpo', url: 'https://lotexpo.com' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://lotexpo.com/blog/${article.slug}` },
  };

  const eventSchemas = linkedEvents.map(event => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.nom_event,
    ...(event.date_debut && { startDate: event.date_debut }),
    ...(event.date_fin && { endDate: event.date_fin }),
    ...(event.ville && { location: { '@type': 'Place', name: event.ville } }),
    ...(event.slug && { url: `https://lotexpo.com/events/${event.slug}` }),
  }));

  const formattedUpdatedAt = article.updated_at
    ? new Date(article.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const isoPublished = article.published_at ? new Date(article.published_at).toISOString() : undefined;
  const isoModified = article.updated_at ? new Date(article.updated_at).toISOString() : undefined;

  const articleTitle = article.h1_title || article.title;

  return (
    <MainLayout title={articleTitle}>
      <Helmet>
        <title>{article.meta_title || article.title}</title>
        <meta name="description" content={article.meta_description || ''} />
        <link rel="canonical" href={`https://lotexpo.com/blog/${article.slug}`} />
        {article.header_image_url && <meta property="og:image" content={article.header_image_url} />}
        {article.header_image_url && <meta property="og:image:width" content="1200" />}
        {article.header_image_url && <meta property="og:image:height" content="628" />}
        <meta property="og:title" content={article.meta_title || article.title} />
        <meta property="og:description" content={article.meta_description || ''} />
        <meta property="og:url" content={`https://lotexpo.com/blog/${article.slug}`} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Lotexpo" />
        <meta property="og:locale" content="fr_FR" />
        {isoPublished && <meta property="article:published_time" content={isoPublished} />}
        {isoModified && <meta property="article:modified_time" content={isoModified} />}
        <meta property="article:author" content="Lotexpo" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={article.meta_title || article.title} />
        <meta name="twitter:description" content={article.meta_description || ''} />
        <script type="application/ld+json">{JSON.stringify(blogPostingSchema)}</script>
        {faqSchema && (
          <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        )}
        {eventSchemas.length > 0 && (
          <script type="application/ld+json">{JSON.stringify(eventSchemas)}</script>
        )}
      </Helmet>

      <article>
        {/* 1. Header image */}
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

        {/* 2. Metadata */}
        <div className="mx-auto px-4 max-w-[720px] pt-10">
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-5">
            {publishedDate && article.published_at && (
              <time dateTime={new Date(article.published_at).toISOString().split('T')[0]} className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Publié le {publishedDate}
              </time>
            )}
            {updatedDate && <span>· Mis à jour le {updatedDate}</span>}
          </div>

          {/* 3. H1 */}
          <h1 className="text-3xl md:text-[40px] font-bold mb-8 leading-tight tracking-tight text-foreground">
            {article.h1_title || article.title}
          </h1>
        </div>

        {/* 4. Intro hook */}
        {article.intro_text && (
          <div className="mx-auto px-4 max-w-[720px] mb-14">
            <div className="text-[17px] leading-[1.8] text-foreground/80">
              {article.intro_text.split('\n').map((p, i) => (
                <p key={i} className={i > 0 ? 'mt-3' : ''}>{p}</p>
              ))}
            </div>
          </div>
        )}

        {/* 5. Events */}
        {linkedEvents.length > 0 && (
          <section className="mx-auto px-4 max-w-[800px] mb-14">
            <SectionTitle>{articleTitle}</SectionTitle>
            <p className="text-sm text-muted-foreground -mt-5 mb-8">
              {linkedEvents.length} salon{linkedEvents.length > 1 ? 's' : ''} référencé{linkedEvents.length > 1 ? 's' : ''}
              {formattedUpdatedAt && <> — mis à jour le {formattedUpdatedAt}</>}
            </p>

            <div className="space-y-8">
              {linkedEvents.map(event => {
                const eventIsPast = isPast(event.date_fin || event.date_debut);
                return (
                  <div
                    key={event.id}
                    className="flex flex-col sm:flex-row bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300"
                  >
                    {/* Image column */}
                    <div className="relative sm:w-[220px] md:w-[220px] sm:min-h-[180px] w-full h-[160px] sm:h-auto bg-[hsl(var(--muted)/0.15)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {event.url_image ? (
                        <img
                          src={event.url_image}
                          alt={event.nom_event}
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <FileText className="h-10 w-10 text-muted-foreground/40" />
                      )}
                      {eventIsPast && (
                        <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                          <span className="text-white text-[11px] font-semibold tracking-[0.5px] uppercase">
                            Événement passé
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content column */}
                    <div className="flex-1 p-5 sm:px-6 flex flex-col">
                      {/* Badges */}
                      <div className="flex gap-1.5 flex-wrap">
                        {getSectors(event.secteur).slice(0, 3).map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-xs font-medium">{s}</Badge>
                        ))}
                      </div>

                      {/* Name */}
                      <h3 className="text-[17px] font-bold text-foreground mt-2 leading-snug">
                        {event.nom_event}
                      </h3>

                      {/* Date & location */}
                      <div className="flex items-center gap-4 text-[13px] text-muted-foreground mt-1.5">
                        {event.date_debut && (
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {new Date(event.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                        )}
                        {event.ville && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.ville}
                          </span>
                        )}
                      </div>

                      {/* Affluence */}
                      {event.affluence && (
                        <div className="flex items-center gap-1.5 text-[13px] font-medium text-primary/80 mt-1">
                          <Users className="h-3.5 w-3.5" />
                          <span>~{event.affluence} visiteurs attendus</span>
                        </div>
                      )}

                      {/* Contextual description */}
                      {event.description && (
                        <p className="text-sm leading-[1.7] text-muted-foreground mt-3">
                          {event.description}
                        </p>
                      )}

                      {/* CTA */}
                      {event.slug && (
                        <div className="flex justify-end mt-auto pt-4">
                          <Link to={`/events/${event.slug}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-lg px-4 text-[13px] transition-colors"
                            >
                              Voir l'événement <ArrowRight className="h-4 w-4 ml-1.5" />
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 6. Why visit */}
        {article.why_visit_text && (
          <section className="mx-auto px-4 max-w-[720px] mb-14">
            <SectionTitle>Pourquoi visiter ces salons ?</SectionTitle>
            <div className="text-base leading-[1.8] text-foreground/80">
              {article.why_visit_text.split('\n').map((p, i) => (
                <p key={i} className={i > 0 ? 'mt-4' : ''}>{p}</p>
              ))}
            </div>
          </section>
        )}

        {/* 7. FAQ */}
        {faqItems.length > 0 && (
          <section className="mx-auto px-4 max-w-[720px] mb-14">
            <SectionTitle>Questions fréquentes — {articleTitle}</SectionTitle>
            <div className="divide-y divide-border/60">
              {faqItems.map((faq, i) => (
                <details key={i} className="group blog-faq-item">
                  <summary className="flex items-center justify-between py-[18px] cursor-pointer text-base font-semibold text-foreground list-none [&::-webkit-details-marker]:hidden select-none">
                    <span className="pr-4">{faq.question}</span>
                    <span className="shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground text-lg leading-none transition-transform duration-200">
                      <span className="group-open:hidden">+</span>
                      <span className="hidden group-open:inline">−</span>
                    </span>
                  </summary>
                  <div className="pb-[18px] text-[15px] text-muted-foreground leading-[1.7] animate-fade-in-up" style={{ animationDuration: '0.25s' }}>
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
          <section className="mx-auto px-4 max-w-[800px] mb-14">
            <SectionTitle>Articles similaires</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {similarArticles.map(a => (
                <Link key={a.id} to={`/blog/${a.slug}`} className="group">
                  <Card className="overflow-hidden h-full hover:shadow-lg transition-shadow border-border/50">
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
      </article>
    </MainLayout>
  );
};

export default BlogArticle;
