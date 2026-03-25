import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SeoStatusBadge, getSectionStatus } from './SeoStatusBadge';
import { Progress } from '@/components/ui/progress';

interface Props { data: any; }

export default function InternalLinkingSection({ data }: Props) {
  const d = data?.linking;
  if (!d) return <p className="text-center py-8 text-muted-foreground">Lancez un scan pour voir le maillage interne.</p>;

  const s = d.summary;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">6. Maillage Interne</h2>
        <SeoStatusBadge status={getSectionStatus(data, 'linking')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Articles → Salons</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-2">
              <Progress value={s.articlesLinkingPercentage} className="flex-1" />
              <span className="font-bold text-sm">{s.articlesLinkingPercentage}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {s.articlesLinkingToEvents}/{s.totalArticles} articles lient vers des pages salon
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Liens internes dans articles</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-2">
              <Progress value={s.internalLinksPercentage} className="flex-1" />
              <span className="font-bold text-sm">{s.internalLinksPercentage}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {s.articlesWithInternalLinks}/{s.totalArticles} articles contiennent des liens internes
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600">{s.totalEvents}</div>
              <div className="text-sm text-muted-foreground">Salons publiés</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600">{s.totalArticles}</div>
              <div className="text-sm text-muted-foreground">Articles publiés</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="border-dashed">
        <CardHeader className="pb-2"><CardTitle className="text-base">💡 Recommandations</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          {s.articlesLinkingPercentage < 70 && (
            <p>⚠️ Seulement {s.articlesLinkingPercentage}% des articles lient vers des salons. Objectif : &gt;70%</p>
          )}
          {s.internalLinksPercentage < 50 && (
            <p>⚠️ {100 - s.internalLinksPercentage}% des articles n'ont aucun lien interne. Ajoutez des liens contextuels.</p>
          )}
          <p>• Utilisez des ancres descriptives (nom du salon) plutôt que "cliquez ici"</p>
          <p>• Chaque salon devrait être lié depuis au moins un article ou une page secteur</p>
        </CardContent>
      </Card>
    </div>
  );
}
