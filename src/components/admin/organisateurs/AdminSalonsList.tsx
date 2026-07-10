import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, CalendarDays, RefreshCw, ExternalLink } from 'lucide-react';
import VerifiedBadge from '@/components/exhibitor/VerifiedBadge';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

export interface AdminSalonRow {
  id: string;
  nom_event: string;
  ville: string | null;
  date_debut: string | null;
  slug: string | null;
  owner_user_id: string | null;
  verified_at: string | null;
  url_image: string | null;
  owner_name: string | null;
  has_pending_claim: boolean;
  has_pending_change: boolean;
}

interface Props {
  onSelectSalon: (id: string) => void;
}

const AdminSalonsList = ({ onSelectSalon }: Props) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data: salons, isLoading, refetch } = useQuery({
    queryKey: ['admin-salons', debouncedSearch],
    queryFn: async (): Promise<AdminSalonRow[]> => {
      let query = supabase
        .from('events')
        .select('id, nom_event, ville, date_debut, slug, owner_user_id, verified_at, url_image')
        .eq('visible', true)
        .eq('is_test', false)
        .order('date_debut', { ascending: false })
        .limit(300);

      if (debouncedSearch.trim()) {
        query = query.ilike('nom_event', `%${debouncedSearch.trim()}%`);
      }

      const { data: eventsData, error } = await query;
      if (error) throw error;

      const columns =
        'id, nom_event, ville, date_debut, slug, owner_user_id, verified_at, url_image';

      // Pending claims & changes (all pending, not limited to the 300 loaded rows)
      const [{ data: pendingClaims }, { data: pendingChanges }] = await Promise.all([
        supabase.from('event_claim_requests').select('event_id').eq('status', 'pending'),
        supabase.from('event_change_requests').select('event_id').eq('status', 'pending'),
      ]);
      const pendingClaimSet = new Set((pendingClaims || []).map((c) => c.event_id));
      const pendingChangeSet = new Set((pendingChanges || []).map((c) => c.event_id));

      let events = eventsData || [];

      // Ensure salons with a pending request are visible even if outside the 300 loaded rows
      const loadedIds = new Set(events.map((e) => e.id));
      const requiredIds = [...new Set([...pendingClaimSet, ...pendingChangeSet])].filter(Boolean);
      const missingIds = requiredIds.filter((id) => !loadedIds.has(id));
      if (missingIds.length) {
        const { data: missingEvents } = await supabase
          .from('events')
          .select(columns)
          .eq('visible', true)
          .eq('is_test', false)
          .in('id', missingIds);
        if (missingEvents?.length) {
          // If a name search is active, respect it for the extra rows too
          const term = debouncedSearch.trim().toLowerCase();
          const filtered = term
            ? missingEvents.filter((e) => (e.nom_event || '').toLowerCase().includes(term))
            : missingEvents;
          events = [...events, ...filtered];
        }
      }

      if (events.length === 0) return [];

      const eventIds = events.map((e) => e.id);
      const ownerIds = [...new Set(events.map((e) => e.owner_user_id).filter(Boolean))] as string[];

      // Owners lookup
      let profilesById: Record<string, string> = {};
      if (ownerIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', ownerIds);
        profilesById = Object.fromEntries(
          (profiles || []).map((p) => [
            p.user_id,
            [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || '—',
          ]),
        );
      }

      const rows: AdminSalonRow[] = events.map((e) => ({
        id: e.id,
        nom_event: e.nom_event,
        ville: e.ville ?? null,
        date_debut: e.date_debut ?? null,
        slug: e.slug ?? null,
        owner_user_id: e.owner_user_id ?? null,
        verified_at: e.verified_at ?? null,
        url_image: e.url_image ?? null,
        owner_name: e.owner_user_id ? profilesById[e.owner_user_id] ?? null : null,
        has_pending_claim: pendingClaimSet.has(e.id),
        has_pending_change: pendingChangeSet.has(e.id),
      }));

      // Salons with a pending request first, then existing order (date_debut desc)
      return rows.sort((a, b) => {
        const aPending = a.has_pending_claim || a.has_pending_change ? 1 : 0;
        const bPending = b.has_pending_claim || b.has_pending_change ? 1 : 0;
        if (aPending !== bPending) return bPending - aPending;
        const aDate = a.date_debut ? new Date(a.date_debut).getTime() : 0;
        const bDate = b.date_debut ? new Date(b.date_debut).getTime() : 0;
        return bDate - aDate;
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Salons
            {salons && <Badge variant="secondary" className="ml-2">{salons.length}</Badge>}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un salon par nom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !salons?.length ? (
          <div className="text-center py-12 text-muted-foreground">Aucun salon trouvé</div>
        ) : (
          <div className="rounded-md border divide-y">
            {salons.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelectSalon(s.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {s.url_image ? (
                    <img src={s.url_image} alt="" className="w-8 h-8 rounded object-contain bg-white border" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.nom_event}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[s.ville, s.date_debut ? new Date(s.date_debut).toLocaleDateString('fr-FR') : null]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {s.owner_user_id ? (
                    <Badge variant="outline" className="text-xs gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                      Revendiqué{s.owner_name ? ` · ${s.owner_name}` : ''}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                      Libre
                    </Badge>
                  )}
                  {s.verified_at && <VerifiedBadge />}
                  {s.has_pending_claim && (
                    <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                      Demande en attente
                    </Badge>
                  )}
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminSalonsList;
