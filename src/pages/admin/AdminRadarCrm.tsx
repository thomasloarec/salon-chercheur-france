import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Radar } from 'lucide-react';
import RadarCrmRematchPanel from '@/components/admin/RadarCrmRematchPanel';
import RadarCrmCronStatus from '@/components/admin/RadarCrmCronStatus';

type Stats = {
  totalImports: number;
  failedImports: number;
  distinctUsers: number;
  totalCompanies: number;
  totalMatches: number;
  avgCompaniesPerImport: number;
  avgMatchRate: number;
  futureMatches: number;
  pastMatches: number;
  betaUsers?: number;
  alertsEnabledUsers?: number;
  dataDeletions?: number;
  recentImports: Array<{
    id: string; user_email: string | null; file_name: string | null;
    source_type: string; status: string; total_rows: number;
    matched_companies_count: number; unmatched_companies_count: number;
    error_message: string | null; created_at: string;
  }>;
};

const AdminRadarCrm: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('get_radar_crm_admin_stats');
      if (error) { setErr(error.message); return; }
      setStats(data as unknown as Stats);
    })();
  }, []);

  if (err) return <div className="p-6 text-destructive">Erreur: {err}</div>;
  if (!stats) return <div className="p-6 space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;

  const cards = [
    { l: 'Imports totaux', v: stats.totalImports },
    { l: 'Utilisateurs actifs', v: stats.distinctUsers },
    { l: 'Entreprises analysées', v: stats.totalCompanies },
    { l: 'Matches générés', v: stats.totalMatches },
    { l: 'Imports échoués', v: stats.failedImports },
    { l: 'Moy. lignes / import', v: stats.avgCompaniesPerImport },
    { l: 'Taux moyen de matching', v: `${stats.avgMatchRate}%` },
    { l: 'Salons futurs détectés', v: stats.futureMatches },
    { l: 'Salons passés détectés', v: stats.pastMatches },
    { l: 'Utilisateurs Beta Radar CRM', v: stats.betaUsers ?? 0 },
    { l: 'Alertes activées', v: stats.alertsEnabledUsers ?? 0 },
    { l: 'Suppressions de données Radar CRM', v: stats.dataDeletions ?? 0 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Radar className="h-6 w-6 text-primary" /> Radar CRM
        </h1>
        <p className="text-muted-foreground text-sm">Suivi de l'usage et de la performance du Radar CRM.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <Card key={c.l}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground mb-1">{c.l}</p>
              <p className="text-2xl font-bold">{c.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <RadarCrmCronStatus />
      <RadarCrmRematchPanel />

      <Card>
        <CardHeader><CardTitle className="text-base">Derniers imports</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Utilisateur</th>
                <th className="text-left p-2">Fichier</th>
                <th className="text-left p-2">Source</th>
                <th className="text-left p-2">Lignes</th>
                <th className="text-left p-2">Matchées</th>
                <th className="text-left p-2">Non m.</th>
                <th className="text-left p-2">Statut</th>
                <th className="text-left p-2">Erreur</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentImports.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">{new Date(i.created_at).toLocaleString('fr-FR')}</td>
                  <td className="p-2">{i.user_email ?? '—'}</td>
                  <td className="p-2">{i.file_name ?? '—'}</td>
                  <td className="p-2">{i.source_type}</td>
                  <td className="p-2">{i.total_rows}</td>
                  <td className="p-2">{i.matched_companies_count}</td>
                  <td className="p-2">{i.unmatched_companies_count}</td>
                  <td className="p-2">
                    <Badge variant={i.status === 'completed' ? 'secondary' : i.status === 'failed' ? 'destructive' : 'outline'}>{i.status}</Badge>
                  </td>
                  <td className="p-2 text-xs text-destructive max-w-[200px] truncate">{i.error_message ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRadarCrm;
