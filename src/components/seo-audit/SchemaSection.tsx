import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SeoStatusBadge, getSectionStatus } from './SeoStatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Props { data: any; }

function Check({ ok }: { ok: boolean }) {
  return ok ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-500" />;
}

export default function SchemaSection({ data }: Props) {
  const d = data?.schema;
  if (!d) return <p className="text-center py-8 text-muted-foreground">Lancez un scan pour voir les données structurées.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">4. Données Structurées</h2>
        <SeoStatusBadge status={getSectionStatus(data, 'schema')} />
      </div>

      {/* Coverage overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Event Schema (Salons)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-2">
              <Progress value={d.coverage.eventSchemaPercent} className="flex-1" />
              <span className="font-bold text-sm">{d.coverage.eventSchemaPercent}%</span>
            </div>
            <p className="text-xs text-muted-foreground">des salons ont les données complètes pour le schema Event</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Article Schema (Blog)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-2">
              <Progress value={d.coverage.articleSchemaPercent} className="flex-1" />
              <span className="font-bold text-sm">{d.coverage.articleSchemaPercent}%</span>
            </div>
            <p className="text-xs text-muted-foreground">des articles ont les données complètes pour le schema Article</p>
          </CardContent>
        </Card>
      </div>

      {/* Event schema detail */}
      {d.events?.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Détail Event Schema</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salon</TableHead>
                  <TableHead>name</TableHead>
                  <TableHead>startDate</TableHead>
                  <TableHead>endDate</TableHead>
                  <TableHead>location</TableHead>
                  <TableHead>description</TableHead>
                  <TableHead>Complet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.events.map((e: any) => (
                  <TableRow key={e.url}>
                    <TableCell className="font-mono text-xs max-w-[180px] truncate">{e.name}</TableCell>
                    <TableCell><Check ok={e.hasName} /></TableCell>
                    <TableCell><Check ok={e.hasStartDate} /></TableCell>
                    <TableCell><Check ok={e.hasEndDate} /></TableCell>
                    <TableCell><Check ok={e.hasLocation} /></TableCell>
                    <TableCell><Check ok={e.hasDescription} /></TableCell>
                    <TableCell><Check ok={e.schemaComplete} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Article schema detail */}
      {d.articles?.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Détail Article Schema</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead>headline</TableHead>
                  <TableHead>datePublished</TableHead>
                  <TableHead>description</TableHead>
                  <TableHead>Complet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.articles.map((a: any) => (
                  <TableRow key={a.url}>
                    <TableCell className="font-mono text-xs max-w-[180px] truncate">{a.name}</TableCell>
                    <TableCell><Check ok={a.hasHeadline} /></TableCell>
                    <TableCell><Check ok={a.hasDatePublished} /></TableCell>
                    <TableCell><Check ok={a.hasDescription} /></TableCell>
                    <TableCell><Check ok={a.schemaComplete} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="border-dashed">
        <CardContent className="pt-4">
          <a
            href="https://search.google.com/test/rich-results"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" /> Tester manuellement dans Google Rich Results Test
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
