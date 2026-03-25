import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SeoStatusBadge, getSectionStatus } from './SeoStatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Filter } from 'lucide-react';

interface Props { data: any; }

function Check({ ok }: { ok: boolean }) {
  return ok ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-500" />;
}

export default function OnPageSection({ data }: Props) {
  const d = data?.onpage;
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);

  if (!d) return <p className="text-center py-8 text-muted-foreground">Lancez un scan pour voir l'audit on-page.</p>;

  const allPages = [...(d.events || []), ...(d.articles || [])];
  const filtered = showOnlyIssues ? allPages.filter((p: any) => p.isThinContent) : allPages;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">3. Audit On-Page SEO</h2>
        <SeoStatusBadge status={getSectionStatus(data, 'onpage')} />
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{d.summary.totalAnalyzed}</div>
              <div className="text-xs text-muted-foreground">Pages analysées</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{d.summary.passingAll}</div>
              <div className="text-xs text-muted-foreground">Conformes</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${d.summary.thinContentCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {d.summary.thinContentCount}
              </div>
              <div className="text-xs text-muted-foreground">Contenu mince</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          variant={showOnlyIssues ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowOnlyIssues(!showOnlyIssues)}
        >
          <Filter className="h-4 w-4 mr-1" />
          {showOnlyIssues ? 'Voir tout' : 'Pages avec problèmes'}
        </Button>
      </div>

      {/* Events table */}
      {(showOnlyIssues ? d.events?.filter((e: any) => e.isThinContent) : d.events)?.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Salons ({d.events.length} analysés)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Mots</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Slug</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(showOnlyIssues ? d.events.filter((e: any) => e.isThinContent) : d.events).map((e: any) => (
                  <TableRow key={e.url}>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">{e.url}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Check ok={e.titleOk} />
                        <span className="text-xs">{e.titleLength}c</span>
                      </div>
                    </TableCell>
                    <TableCell><Check ok={e.hasDescription} /></TableCell>
                    <TableCell>
                      <span className={e.isThinContent ? 'text-red-600 font-semibold' : 'text-green-700'}>
                        {e.descWordCount}
                      </span>
                    </TableCell>
                    <TableCell><Check ok={e.hasImage} /></TableCell>
                    <TableCell><Check ok={e.hasSlug} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Articles table */}
      {(showOnlyIssues ? d.articles?.filter((a: any) => a.isThinContent) : d.articles)?.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Articles ({d.articles.length} analysés)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>Meta Title</TableHead>
                  <TableHead>Meta Desc</TableHead>
                  <TableHead>H1</TableHead>
                  <TableHead>H1≠Title</TableHead>
                  <TableHead>Mots</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(showOnlyIssues ? d.articles.filter((a: any) => a.isThinContent) : d.articles).map((a: any) => (
                  <TableRow key={a.url}>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">{a.url}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Check ok={a.hasMetaTitle && a.metaTitleOk} />
                        <span className="text-xs">{a.metaTitleLength}c</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Check ok={a.hasMetaDesc && a.metaDescOk} />
                        <span className="text-xs">{a.metaDescLength}c</span>
                      </div>
                    </TableCell>
                    <TableCell><Check ok={a.hasH1} /></TableCell>
                    <TableCell><Check ok={a.h1DiffFromTitle} /></TableCell>
                    <TableCell>
                      <span className={a.isThinContent ? 'text-red-600 font-semibold' : 'text-green-700'}>
                        {a.wordCount}
                      </span>
                    </TableCell>
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
