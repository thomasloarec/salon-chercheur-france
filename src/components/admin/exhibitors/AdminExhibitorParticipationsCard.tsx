import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Pencil, Save, X, ExternalLink, History, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  exhibitorId?: string | null;   // exhibitors.id (uuid)
  exhibitorName?: string | null; // for legacy/name fallback
  legacyId?: string | null;      // exposants.id_exposant (text)
}

interface AdminParticipationRow {
  id_participation: string;
  id_event: string | null;
  stand_exposant: string | null;
  event?: {
    id: string;
    nom_event: string;
    slug: string | null;
    date_debut: string | null;
    date_fin: string | null;
    ville: string | null;
  } | null;
}

const fmt = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const AdminExhibitorParticipationsCard: React.FC<Props> = ({ exhibitorId, exhibitorName, legacyId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['admin-exhibitor-participations', exhibitorId || null, legacyId || null, exhibitorName || null];

  const { data: rows, isLoading } = useQuery({
    queryKey,
    enabled: !!(exhibitorId || legacyId || exhibitorName),
    queryFn: async (): Promise<AdminParticipationRow[]> => {
      const collected = new Map<string, any>();

      if (exhibitorId) {
        const { data } = await supabase
          .from('participation')
          .select('id_participation, id_event, stand_exposant')
          .eq('exhibitor_id', exhibitorId);
        (data || []).forEach((p: any) => collected.set(p.id_participation, p));
      }
      if (legacyId) {
        const { data } = await supabase
          .from('participation')
          .select('id_participation, id_event, stand_exposant')
          .eq('id_exposant', legacyId);
        (data || []).forEach((p: any) => collected.set(p.id_participation, p));
      }
      if (collected.size === 0 && exhibitorName) {
        const { data: a } = await supabase
          .from('participations_with_exhibitors')
          .select('id_participation, id_event, stand_exposant')
          .ilike('name_final', exhibitorName);
        (a || []).forEach((p: any) => collected.set(p.id_participation, p));
        if (collected.size === 0) {
          const { data: b } = await supabase
            .from('participations_with_exhibitors')
            .select('id_participation, id_event, stand_exposant')
            .ilike('legacy_name', exhibitorName);
          (b || []).forEach((p: any) => collected.set(p.id_participation, p));
        }
      }

      const parts = Array.from(collected.values());
      const eventIds = Array.from(new Set(parts.map(p => p.id_event).filter(Boolean)));
      let eventsMap: Record<string, any> = {};
      if (eventIds.length) {
        const { data: events } = await supabase
          .from('events')
          .select('id, nom_event, slug, date_debut, date_fin, ville')
          .in('id', eventIds);
        (events || []).forEach((e: any) => { eventsMap[e.id] = e; });
      }
      return parts.map(p => ({
        id_participation: p.id_participation,
        id_event: p.id_event,
        stand_exposant: p.stand_exposant ?? null,
        event: p.id_event ? eventsMap[p.id_event] || null : null,
      }));
    },
    staleTime: 60_000,
  });

  const updateStand = useMutation({
    mutationFn: async ({ id_participation, stand }: { id_participation: string; stand: string | null }) => {
      const { error } = await supabase
        .from('participation')
        .update({ stand_exposant: stand })
        .eq('id_participation', id_participation);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Numéro de stand mis à jour' });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: any) =>
      toast({ title: 'Erreur', description: err?.message || 'Mise à jour impossible', variant: 'destructive' }),
  });

  const { upcoming, past } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const sorted = [...(rows || [])].sort((a, b) => {
      const ad = a.event?.date_debut || '';
      const bd = b.event?.date_debut || '';
      return ad.localeCompare(bd);
    });
    return {
      upcoming: sorted.filter(p => (p.event?.date_fin || p.event?.date_debut || '') >= today),
      past: sorted.filter(p => (p.event?.date_fin || p.event?.date_debut || '') < today).reverse(),
    };
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Participations aux événements
          {rows && (
            <Badge variant="outline" className="ml-1">
              {rows.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {exhibitorId && <PendingRequestsSection exhibitorId={exhibitorId} participationsKey={queryKey} />}
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4">Chargement…</div>
        ) : (rows?.length ?? 0) === 0 ? (
          <div className="text-sm text-muted-foreground py-4">
            Aucune participation enregistrée pour cette entreprise.
          </div>
        ) : (
          <>
            <Section
              title="À venir"
              icon={<Calendar className="h-4 w-4 text-primary" />}
              items={upcoming}
              onSave={(id, stand) => updateStand.mutate({ id_participation: id, stand })}
              saving={updateStand.isPending}
            />
            <Section
              title="Passés"
              icon={<History className="h-4 w-4 text-muted-foreground" />}
              items={past}
              onSave={(id, stand) => updateStand.mutate({ id_participation: id, stand })}
              saving={updateStand.isPending}
              muted
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};

interface PendingRequestRow {
  id: string;
  stand: string | null;
  message: string | null;
  created_at: string;
  event_id: string | null;
  requested_by: string;
  proposed_event_name: string | null;
  proposed_event_city: string | null;
  proposed_event_start: string | null;
  proposed_event_url: string | null;
  events: { nom_event: string | null; slug: string | null } | null;
}

const PendingRequestsSection: React.FC<{ exhibitorId: string; participationsKey: unknown[] }> = ({
  exhibitorId,
  participationsKey,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const pendingKey = ['admin-exhibitor-pending-participation-requests', exhibitorId];

  const { data: requests = [] } = useQuery({
    queryKey: pendingKey,
    queryFn: async (): Promise<PendingRequestRow[]> => {
      const { data, error } = await supabase
        .from('exhibitor_participation_requests')
        .select(
          'id, stand, message, created_at, event_id, requested_by, proposed_event_name, proposed_event_city, proposed_event_start, proposed_event_url, events(nom_event, slug)',
        )
        .eq('exhibitor_id', exhibitorId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PendingRequestRow[];
    },
  });

  const decide = useMutation({
    mutationFn: async (vars: { id: string; decision: 'approved' | 'rejected' }) => {
      const { data, error } = await supabase.functions.invoke('exhibitor-participation-decide', {
        body: {
          request_id: vars.id,
          decision: vars.decision,
          admin_note: notes[vars.id]?.trim() ? notes[vars.id].trim() : null,
        },
      });
      if (error) throw error;
      if (data && (data as { error?: string }).error) throw new Error((data as { error?: string }).error);
    },
    onSuccess: (_d, vars) => {
      toast({
        title: vars.decision === 'approved' ? 'Participation confirmée' : 'Demande refusée',
      });
      queryClient.invalidateQueries({ queryKey: pendingKey });
      queryClient.invalidateQueries({ queryKey: participationsKey });
      queryClient.invalidateQueries({ queryKey: ['admin-participation-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-counts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exhibitors'] });
    },
    onError: (err: any) =>
      toast({
        title: 'Erreur',
        description: err?.message || "L'action n'a pas pu être appliquée",
        variant: 'destructive',
      }),
    onSettled: () => setBusyId(null),
  });

  if (requests.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4 text-primary" />
        <span>Demandes en attente</span>
        <span className="text-muted-foreground">({requests.length})</span>
      </div>
      <div className="space-y-3">
        {requests.map((r) => {
          const busy = busyId === r.id;
          const salonName = r.event_id
            ? (r.events?.nom_event ?? 'Salon existant')
            : (r.proposed_event_name ?? 'Salon non précisé');
          return (
            <div key={r.id} className="rounded-md border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{salonName}</span>
                {r.stand && <Badge variant="secondary">Stand {r.stand}</Badge>}
                <span className="text-xs text-muted-foreground">Déclarée le {fmt(r.created_at)}</span>
              </div>
              {!r.event_id && (
                <div className="text-xs text-muted-foreground">
                  {[r.proposed_event_city, fmt(r.proposed_event_start)].filter(Boolean).join(' · ')}
                  {r.proposed_event_url && (
                    <>
                      {' · '}
                      <a
                        href={r.proposed_event_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        site officiel
                      </a>
                    </>
                  )}
                </div>
              )}
              {r.message && <p className="text-sm bg-muted/40 rounded-md p-2">{r.message}</p>}
              {!r.event_id && (
                <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2">
                  <AlertTriangle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs">Salon hors Lotexpo, à créer avant de pouvoir confirmer.</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={notes[r.id] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="Note (facultative, utile en cas de refus)"
                  className="h-8 flex-1 min-w-[200px]"
                />
                <Button
                  size="sm"
                  disabled={busy || !r.event_id}
                  onClick={() => {
                    setBusyId(r.id);
                    decide.mutate({ id: r.id, decision: 'approved' });
                  }}
                >
                  Confirmer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setBusyId(r.id);
                    decide.mutate({ id: r.id, decision: 'rejected' });
                  }}
                >
                  Refuser
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: AdminParticipationRow[];
  onSave: (id: string, stand: string | null) => void;
  saving: boolean;
  muted?: boolean;
}> = ({ title, icon, items, onSave, saving, muted }) => {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        <span>{title}</span>
        <span className="text-muted-foreground">({items.length})</span>
      </div>
      <div className="divide-y rounded-md border">
        {items.map(p => (
          <ParticipationRow key={p.id_participation} row={p} onSave={onSave} saving={saving} muted={muted} />
        ))}
      </div>
    </div>
  );
};

const ParticipationRow: React.FC<{
  row: AdminParticipationRow;
  onSave: (id: string, stand: string | null) => void;
  saving: boolean;
  muted?: boolean;
}> = ({ row, onSave, saving, muted }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(row.stand_exposant ?? '');
  const ev = row.event;

  return (
    <div className={`p-3 flex flex-col md:flex-row md:items-center gap-3 ${muted ? 'opacity-80' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {ev?.nom_event || <span className="text-muted-foreground italic">Événement introuvable</span>}
        </div>
        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
          <span>{fmt(ev?.date_debut)}{ev?.date_fin && ev?.date_fin !== ev?.date_debut ? ` → ${fmt(ev.date_fin)}` : ''}</span>
          {ev?.ville && <span>· {ev.ville}</span>}
          {ev?.slug && (
            <a
              href={`/events/${ev.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Voir <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        {editing ? (
          <>
            <Input
              value={val}
              onChange={e => setVal(e.target.value)}
              placeholder="N° de stand"
              className="h-8 w-36"
            />
            <Button
              size="sm"
              onClick={() => { onSave(row.id_participation, val.trim() || null); setEditing(false); }}
              disabled={saving}
            >
              <Save className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setVal(row.stand_exposant ?? ''); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            <span className="text-sm">
              {row.stand_exposant ? (
                <Badge variant="secondary">Stand {row.stand_exposant}</Badge>
              ) : (
                <span className="text-muted-foreground italic">Aucun stand</span>
              )}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminExhibitorParticipationsCard;