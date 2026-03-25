import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SeoStatusBadge, getSectionStatus } from './SeoStatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface Props { data: any; }

const metricInfo: Record<string, { label: string; unit: string; threshold: number; desc: string }> = {
  score: { label: 'Score', unit: '/100', threshold: 80, desc: 'Score global de performance Google Lighthouse' },
  lcp: { label: 'LCP', unit: 'ms', threshold: 2500, desc: 'Largest Contentful Paint – temps de chargement du plus grand élément visible. Cible < 2.5s' },
  fcp: { label: 'FCP', unit: 'ms', threshold: 1800, desc: 'First Contentful Paint – premier rendu de contenu. Cible < 1.8s' },
  cls: { label: 'CLS', unit: '', threshold: 0.1, desc: 'Cumulative Layout Shift – stabilité visuelle. Cible < 0.1' },
  inp: { label: 'INP/TBT', unit: 'ms', threshold: 200, desc: 'Interaction to Next Paint – réactivité. Cible < 200ms' },
  ttfb: { label: 'TTFB', unit: 'ms', threshold: 800, desc: 'Time to First Byte – réponse serveur. Cible < 800ms' },
};

function MetricValue({ value, metric }: { value: number | undefined; metric: string }) {
  if (value === undefined || value === null) return <span className="text-muted-foreground">—</span>;
  const info = metricInfo[metric];
  const isMs = info.unit === 'ms';
  const display = metric === 'cls' ? value.toFixed(3) : isMs ? Math.round(value) : value;
  const isBad = metric === 'score' ? value < info.threshold : value > info.threshold;
  return (
    <span className={isBad ? 'text-red-600 font-semibold' : 'text-green-700'}>
      {display}{info.unit}
    </span>
  );
}

function MetricHeader({ metric }: { metric: string }) {
  const info = metricInfo[metric];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="flex items-center gap-1 cursor-help">
          {info.label} <HelpCircle className="h-3 w-3 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs"><p className="text-xs">{info.desc}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function PerformanceSection({ data }: Props) {
  const d = data?.performance;
  if (!d) return <p className="text-center py-8 text-muted-foreground">Lancez un scan pour voir les performances.</p>;
  if (d.error) return <p className="text-center py-8 text-red-600">Erreur : {d.error}</p>;

  const pages = d.pages || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">2. Core Web Vitals & Performance</h2>
        <SeoStatusBadge status={getSectionStatus(data, 'performance')} />
      </div>

      {pages.length === 0 ? (
        <p className="text-muted-foreground">Aucune page testée.</p>
      ) : (
        <>
          {/* Mobile */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">📱 Mobile</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    {Object.keys(metricInfo).map(k => <TableHead key={k}><MetricHeader metric={k} /></TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map((p: any) => (
                    <TableRow key={p.name}>
                      <TableCell className="font-medium max-w-[200px] truncate">{p.name}</TableCell>
                      {p.error ? (
                        <TableCell colSpan={6} className="text-red-600 text-sm">{p.error}</TableCell>
                      ) : p.mobile ? (
                        <>
                          {Object.keys(metricInfo).map(k => (
                            <TableCell key={k}><MetricValue value={p.mobile[k]} metric={k} /></TableCell>
                          ))}
                        </>
                      ) : (
                        <TableCell colSpan={6} className="text-muted-foreground">Données indisponibles</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Desktop */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">🖥️ Desktop</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    {Object.keys(metricInfo).map(k => <TableHead key={k}><MetricHeader metric={k} /></TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map((p: any) => (
                    <TableRow key={p.name}>
                      <TableCell className="font-medium max-w-[200px] truncate">{p.name}</TableCell>
                      {p.error ? (
                        <TableCell colSpan={6} className="text-red-600 text-sm">{p.error}</TableCell>
                      ) : p.desktop ? (
                        <>
                          {Object.keys(metricInfo).map(k => (
                            <TableCell key={k}><MetricValue value={p.desktop[k]} metric={k} /></TableCell>
                          ))}
                        </>
                      ) : (
                        <TableCell colSpan={6} className="text-muted-foreground">Données indisponibles</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
