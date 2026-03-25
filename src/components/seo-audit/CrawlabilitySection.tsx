import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SeoStatusBadge, getSectionStatus } from './SeoStatusBadge';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface Props { data: any; }

export default function CrawlabilitySection({ data }: Props) {
  const d = data?.crawlability;
  if (!d) return <EmptyState />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">1. Crawlabilité & Indexation</h2>
        <SeoStatusBadge status={getSectionStatus(data, 'crawlability')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* robots.txt */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {d.robotsTxt.exists ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
              robots.txt
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.robotsTxt.exists ? (
              <div>
                <p className="text-sm text-green-700 mb-2">✅ Fichier trouvé</p>
                {d.robotsTxt.issues.length > 0 && (
                  <div className="space-y-1">
                    {d.robotsTxt.issues.map((issue: string, i: number) => (
                      <p key={i} className="text-sm text-yellow-700 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {issue}
                      </p>
                    ))}
                  </div>
                )}
                {d.robotsTxt.issues.length === 0 && <p className="text-sm text-muted-foreground">Aucun problème détecté</p>}
              </div>
            ) : (
              <p className="text-sm text-red-700">🔴 robots.txt introuvable</p>
            )}
          </CardContent>
        </Card>

        {/* Sitemap */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {d.sitemap.exists ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
              Sitemap XML
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.sitemap.exists ? (
              <div>
                <p className="text-sm text-green-700 mb-1">✅ {d.sitemap.urlCount} URLs trouvées</p>
                {d.sitemap.issues.map((issue: string, i: number) => (
                  <p key={i} className="text-sm text-yellow-700 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {issue}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-red-700">🔴 sitemap.xml introuvable</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Coverage */}
      {d.sitemapCoverage && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Couverture Sitemap vs Base de données</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{d.sitemapCoverage.inSitemap}</div>
                <div className="text-xs text-muted-foreground">URLs dans sitemap</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-600">{d.sitemapCoverage.expectedTotal}</div>
                <div className="text-xs text-muted-foreground">Pages estimées</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${d.sitemapCoverage.ratio >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                  {d.sitemapCoverage.ratio}%
                </div>
                <div className="text-xs text-muted-foreground">Couverture</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DB Counts */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Pages en base de données</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{d.dbCounts.events}</div>
              <div className="text-xs text-muted-foreground">Salons</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{d.dbCounts.articles}</div>
              <div className="text-xs text-muted-foreground">Articles</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{d.dbCounts.exhibitors}</div>
              <div className="text-xs text-muted-foreground">Exposants</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual checklist card */}
      <Card className="border-dashed">
        <CardHeader className="pb-2"><CardTitle className="text-base">📋 Vérifications manuelles</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1 text-muted-foreground">
          <p>☐ Vérifier que le sitemap est soumis dans Google Search Console</p>
          <p>☐ Vérifier qu'il n'y a pas d'erreurs d'exploration dans le rapport Couverture</p>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <p>Lancez un scan pour voir les résultats de crawlabilité.</p>
    </div>
  );
}
