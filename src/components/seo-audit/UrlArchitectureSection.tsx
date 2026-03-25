import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SeoStatusBadge, getSectionStatus } from './SeoStatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface Props { data: any; }

export default function UrlArchitectureSection({ data }: Props) {
  const d = data?.urls;
  if (!d) return <p className="text-center py-8 text-muted-foreground">Lancez un scan pour voir l'architecture URL.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">5. Architecture URL & Contenu</h2>
        <SeoStatusBadge status={getSectionStatus(data, 'urls')} />
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{d.summary.total}</div>
              <div className="text-xs text-muted-foreground">URLs analysées</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${d.summary.withIssues > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {d.summary.withIssues}
              </div>
              <div className="text-xs text-muted-foreground">Avec problèmes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{d.summary.underscoreCount}</div>
              <div className="text-xs text-muted-foreground">Underscores</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{d.summary.longCount}</div>
              <div className="text-xs text-muted-foreground">Trop longues</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* URLs with issues */}
      {d.urls?.filter((u: any) => u.hasUnderscore || u.isLong || u.hasDynamicParams || !u.isDescriptive).length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">URLs avec problèmes</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Problèmes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.urls.filter((u: any) => u.hasUnderscore || u.isLong || u.hasDynamicParams || !u.isDescriptive).slice(0, 20).map((u: any) => (
                  <TableRow key={u.url}>
                    <TableCell className="font-mono text-xs max-w-[300px] truncate">{u.url}</TableCell>
                    <TableCell><Badge variant="outline">{u.type}</Badge></TableCell>
                    <TableCell className="space-x-1">
                      {u.hasUnderscore && <Badge variant="outline" className="bg-yellow-50 text-yellow-800 text-xs">underscore</Badge>}
                      {u.isLong && <Badge variant="outline" className="bg-orange-50 text-orange-800 text-xs">&gt;100 chars</Badge>}
                      {u.hasDynamicParams && <Badge variant="outline" className="bg-red-50 text-red-800 text-xs">params dynamiques</Badge>}
                      {!u.isDescriptive && <Badge variant="outline" className="bg-red-50 text-red-800 text-xs">non descriptif</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Content gaps */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Lacunes de contenu</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            {d.contentGaps.hasSectorPages ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-500" />}
            Pages hub par secteur (/salons-agroalimentaire/, etc.)
          </div>
          <div className="flex items-center gap-2">
            {d.contentGaps.hasYearPages ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-500" />}
            Pages par année (/salons-professionnels-2026/)
          </div>
          <div className="flex items-center gap-2">
            {d.contentGaps.hasCityPages ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-500" />}
            Pages par ville (/salons-paris/, /salons-lyon/)
          </div>
          {d.contentGaps.sectors?.length > 0 && (
            <div className="mt-3">
              <p className="font-medium mb-1">Secteurs disponibles ({d.contentGaps.sectors.length}) :</p>
              <div className="flex flex-wrap gap-1">
                {d.contentGaps.sectors.map((s: any) => (
                  <Badge key={s.slug || s.name} variant="outline" className="text-xs">{s.name}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Thin content */}
      {d.thinContent?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Contenu mince ({d.thinContent.length} pages &lt; 300 mots)
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salon</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Mots</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.thinContent.slice(0, 15).map((tc: any) => (
                  <TableRow key={tc.url}>
                    <TableCell className="max-w-[200px] truncate">{tc.name}</TableCell>
                    <TableCell className="font-mono text-xs">{tc.url}</TableCell>
                    <TableCell className="text-red-600 font-semibold">{tc.wordCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
