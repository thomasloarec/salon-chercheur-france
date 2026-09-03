import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, RefreshCw, Globe, ShieldBan } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import MergeOrganizersDialog from './MergeOrganizersDialog';

export interface OrganizerRow {
  organizer_id: string;
  organizer_name: string;
  primary_domain: string;
  outreach_blocked: boolean;
  nb_domaines: number;
  nb_salons_total: number;
  nb_salons_a_venir: number;
  nb_salons_revendiques: number;
  campaign_id: string | null;
  claim_status: string | null;
  claim_step: number | null;
  hunter_status: string | null;
  last_sent_at: string | null;
  next_event_date: string | null;
  total_count: number;
}

const claimLabel: Record<string, { label: string; className: string }> = {
  pending:   { label: 'À contacter',       className: 'bg-blue-50 text-blue-700 border-blue-200' },
  active:    { label: 'Séquence en cours',  className: 'bg-amber-50 text-amber-700 border-amber-200' },
  claimed:   { label: 'Revendiqué',         className: 'bg-green-50 text-green-700 border-green-200' },
  completed: { label: 'Terminée',           className: 'bg-muted text-muted-foreground' },
  stopped:   { label: 'Bloqué',             className: 'bg-red-50 text-red-700 border-red-200' },
  opted_out: { label: 'Désinscrit',         className: 'bg-red-50 text-red-700 border-red-200' },
};

const AdminOrganizersList = () => {
  const [search, setSearch] = useState('');
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-organizers', debouncedSearch, onlyBlocked],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_list_organizers', {
        p_search: debouncedSearch || null,
        p_only_blocked: onlyBlocked,
        p_limit: 200,
        p_offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as OrganizerRow[];
    },
  });

  const rows = data ?? [];
  const total = rows[0]?.total_count ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base">
            Organisateurs {total > 0 && <span className="text-muted-foreground font-normal">· {total}</span>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <MergeOrganizersDialog onMerged={() => refetch()} />
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou domaine..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant={onlyBlocked ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnlyBlocked((v) => !v)}
            className="gap-2"
          >
            <ShieldBan className="h-4 w-4" />
            Bloqués
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !rows.length ? (
          <div className="text-center py-12 text-muted-foreground">Aucun organisateur trouvé</div>
        ) : (
          <div className="rounded-md border divide-y">
            {rows.map((o) => {
              const meta = o.claim_status ? claimLabel[o.claim_status] : undefined;
              return (
                <div key={o.organizer_id} className="flex items-center justify-between p-3 gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{o.organizer_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {o.primary_domain}
                        {o.nb_domaines > 1 ? ` · ${o.nb_domaines} domaines` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <span className="text-xs text-muted-foreground">
                      {o.nb_salons_total} salon(s){o.nb_salons_a_venir > 0 ? ` · ${o.nb_salons_a_venir} à venir` : ''}
                    </span>
                    {o.nb_salons_revendiques > 0 && (
                      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                        {o.nb_salons_revendiques} revendiqué(s)
                      </Badge>
                    )}
                    {meta && <Badge variant="outline" className={`text-xs ${meta.className}`}>{meta.label}</Badge>}
                    {o.outreach_blocked && (
                      <Badge variant="outline" className="text-xs gap-1 bg-red-50 text-red-700 border-red-200">
                        <ShieldBan className="h-3 w-3" /> Bloqué
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminOrganizersList;
