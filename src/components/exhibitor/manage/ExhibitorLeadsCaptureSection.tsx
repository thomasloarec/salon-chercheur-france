import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { useExhibitorParticipations } from '@/hooks/useExhibitorParticipations';
import { useDebounce } from '@/hooks/useDebounce';
import {
  boothErrorMessage,
  createWorkspace,
  getAccess,
  listWorkspaces,
  requestAccess,
  updateWorkspace,
  type BoothAccess,
  type BoothPhase,
  type BoothWorkspace,
} from '@/lib/booth/rpc';

interface Props {
  exhibitorId: string;
  isAdmin: boolean;
}

const NONE = '__none__';

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '';
  try {
    return format(new Date(d), 'd MMMM yyyy', { locale: fr });
  } catch {
    return '';
  }
};

const fmtRange = (a: string | null, b: string | null) => {
  if (!a) return '';
  if (!b || a === b) return fmtDate(a);
  return `${fmtDate(a)} au ${fmtDate(b)}`;
};

const fmtEuro = (n: number | null) =>
  n == null
    ? 'Non renseigné'
    : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const PHASE_LABEL: Record<BoothPhase, string | null> = {
  before: 'Avant le salon',
  during: 'Pendant le salon',
  after: 'Après le salon',
  unknown: null,
};

function ErrorBox({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-3">
      <p className="text-destructive">{boothErrorMessage(error)}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Réessayer
      </Button>
    </div>
  );
}

function useUpcoming(exhibitorId: string) {
  const { data = [] } = useExhibitorParticipations(exhibitorId);
  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const seen = new Set<string>();
    return data
      .filter((p) => p.event && (p.event.date_fin || p.event.date_debut) >= today)
      .filter((p) => (seen.has(p.event.id) ? false : (seen.add(p.event.id), true)));
  }, [data]);
}

/* ---------- A / B : formulaire de demande ---------- */

function RequestForm({
  exhibitorId,
  access,
  onDone,
}: {
  exhibitorId: string;
  access: BoothAccess;
  onDone: () => void;
}) {
  const upcoming = useUpcoming(exhibitorId);
  const [eventId, setEventId] = useState<string>(access.target_event_id ?? NONE);
  const [teamSize, setTeamSize] = useState<string>(access.team_size ? String(access.team_size) : '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    let size: number | null = null;
    if (teamSize.trim()) {
      const n = Number(teamSize);
      if (!Number.isInteger(n) || n < 1 || n > 50) {
        toast.error('Le nombre de personnes doit être compris entre 1 et 50.');
        return;
      }
      size = n;
    }
    setSending(true);
    try {
      await requestAccess(exhibitorId, eventId === NONE ? null : eventId, size, message.trim() || null);
      toast.success('Demande envoyée. Nous revenons vers vous par email.');
      onDone();
    } catch (e) {
      toast.error(boothErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Salon où vous exposez prochainement</Label>
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Je ne sais pas encore</SelectItem>
            {upcoming.map((p) => (
              <SelectItem key={p.event.id} value={p.event.id}>
                {p.event.nom_event}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="booth-team">Nombre de personnes sur le stand</Label>
        <Input
          id="booth-team"
          type="number"
          min={1}
          max={50}
          step={1}
          value={teamSize}
          onChange={(e) => setTeamSize(e.target.value)}
          className="max-w-[160px]"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="booth-msg">Message</Label>
        <Textarea
          id="booth-msg"
          value={message}
          maxLength={2000}
          rows={4}
          onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
        />
        <p className="text-xs text-muted-foreground text-right">{message.length} / 2000</p>
      </div>
      <Button onClick={submit} disabled={sending}>
        {sending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
        Demander l'accès
      </Button>
    </div>
  );
}

/* ---------- C : dialogues ---------- */

function EditWorkspaceDialog({
  ws,
  onClose,
  onSaved,
}: {
  ws: BoothWorkspace;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [stand, setStand] = useState(ws.stand_label ?? '');
  const [cost, setCost] = useState(ws.total_cost != null ? String(ws.total_cost) : '');
  const [archived, setArchived] = useState(ws.archived);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const opts: Parameters<typeof updateWorkspace>[1] = { standLabel: stand.trim(), archived };
    if (cost.trim() === '') {
      opts.clearCost = true;
    } else {
      const n = Number(cost.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) {
        toast.error('Le coût doit être un nombre positif.');
        return;
      }
      opts.totalCost = n;
    }
    setSaving(true);
    try {
      await updateWorkspace(ws.workspace_id, opts);
      toast.success('Espace mis à jour');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(boothErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ws.nom_event}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ws-stand">Stand</Label>
            <Input id="ws-stand" value={stand} maxLength={100} onChange={(e) => setStand(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-cost">Coût total du salon (€)</Label>
            <Input
              id="ws-cost"
              type="number"
              min={0}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="Laisser vide pour effacer"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={archived} onCheckedChange={(v) => setArchived(v === true)} />
            Archiver cet espace
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EventChoice {
  id: string;
  nom_event: string;
  ville: string | null;
  date_debut: string | null;
}

function CreateWorkspaceDialog({
  exhibitorId,
  onClose,
  onDone,
}: {
  exhibitorId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const upcoming = useUpcoming(exhibitorId);
  const [searchMode, setSearchMode] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const [selected, setSelected] = useState<EventChoice | null>(null);
  const [stand, setStand] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['booth-search-events', debounced],
    enabled: searchMode && debounced.trim().length >= 2,
    queryFn: async (): Promise<EventChoice[]> => {
      const { data, error } = await supabase.rpc('search_upcoming_events', {
        p_query: debounced.trim(),
        p_limit: 10,
      });
      if (error) throw error;
      return (data ?? []) as EventChoice[];
    },
    staleTime: 30_000,
  });

  const choices: EventChoice[] = searchMode
    ? results
    : upcoming.map((p) => ({
        id: p.event.id,
        nom_event: p.event.nom_event,
        ville: p.event.ville,
        date_debut: p.event.date_debut,
      }));

  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await createWorkspace(exhibitorId, selected.id, stand.trim() || null);
      if (res && res.created === false) {
        toast('Cet espace existe déjà');
      } else {
        toast.success('Espace créé');
        if (res && res.participation_known === false) {
          toast.info("Ce salon n'apparaît pas encore dans vos participations. Pensez à le déclarer dans Mes salons.");
        }
      }
      onDone();
      onClose();
    } catch (e) {
      toast.error(boothErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer l'espace d'un salon</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {searchMode && (
            <Input
              autoFocus
              placeholder="Rechercher un salon à venir"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {searchMode && isFetching && <Skeleton className="h-10 w-full" />}
            {choices.length === 0 && !isFetching && (
              <p className="text-sm text-muted-foreground">
                {searchMode ? 'Tapez au moins 2 lettres.' : 'Aucun salon à venir dans vos participations.'}
              </p>
            )}
            {choices.map((c) => {
              const isSel = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c)}
                  className={`w-full text-left rounded-md border px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                    isSel ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
                  }`}
                >
                  <span>
                    <span className="font-medium text-foreground">{c.nom_event}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[c.ville, fmtDate(c.date_debut)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {isSel && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
          {!searchMode && (
            <button
              type="button"
              className="text-sm text-primary underline-offset-4 hover:underline"
              onClick={() => {
                setSearchMode(true);
                setSelected(null);
              }}
            >
              Mon salon n'est pas dans la liste
            </button>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="new-stand">Stand (facultatif)</Label>
            <Input id="new-stand" value={stand} maxLength={100} onChange={(e) => setStand(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={!selected || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Créer l'espace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceRow({
  ws,
  isManager,
  onEdit,
}: {
  ws: BoothWorkspace;
  isManager: boolean;
  onEdit: () => void;
}) {
  const phase = PHASE_LABEL[ws.phase];
  return (
    <div className="rounded-md border border-border p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          {ws.event_slug ? (
            <Link to={`/events/${ws.event_slug}`} className="font-medium text-foreground hover:underline">
              {ws.nom_event}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{ws.nom_event}</span>
          )}
          <p className="text-xs text-muted-foreground">
            {[ws.ville, fmtRange(ws.date_debut, ws.date_fin)].filter(Boolean).join(' · ')}
          </p>
        </div>
        {phase && <Badge variant="secondary">{phase}</Badge>}
      </div>
      <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
        <span>Stand : {ws.stand_label || 'Non renseigné'}</span>
        <span>
          {ws.interactions_count} rencontre{ws.interactions_count > 1 ? 's' : ''} enregistrée
          {ws.interactions_count > 1 ? 's' : ''}
        </span>
        {isManager && <span>Coût total : {fmtEuro(ws.total_cost)}</span>}
      </div>
      {isManager && (
        <Button size="sm" variant="outline" onClick={onEdit}>
          Modifier
        </Button>
      )}
    </div>
  );
}

function ApprovedView({ exhibitorId, access }: { exhibitorId: string; access: BoothAccess }) {
  const qc = useQueryClient();
  const upcoming = useUpcoming(exhibitorId);
  const wsQuery = useQuery({
    queryKey: ['booth-workspaces', exhibitorId],
    queryFn: () => listWorkspaces(exhibitorId),
  });
  const [editing, setEditing] = useState<BoothWorkspace | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ['booth-workspaces', exhibitorId] });
  const items = wsQuery.data?.items ?? [];
  const isManager = wsQuery.data?.role === 'manager';
  const activeItems = items.filter((w) => !w.archived);
  const archivedItems = items.filter((w) => w.archived);

  const planEventName =
    items.find((w) => w.event_id === access.plan_event_id)?.nom_event ??
    upcoming.find((p) => p.event.id === access.plan_event_id)?.event.nom_event;

  const validUntil = access.plan_valid_until ? `valable jusqu'au ${fmtDate(access.plan_valid_until)}` : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Votre formule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {access.plan === 'beta' && <Badge>Bêta, toutes les fonctions offertes</Badge>}
            {access.plan === 'free' && <Badge variant="secondary">Gratuit, 1 compte</Badge>}
            {access.plan === 'pass' && (
              <>
                <Badge>Pass Salon</Badge>
                {planEventName && <span className="text-foreground">{planEventName}</span>}
                {validUntil && <span className="text-muted-foreground">{validUntil}</span>}
              </>
            )}
            {access.plan === 'annual' && (
              <>
                <Badge>Annuel</Badge>
                {validUntil && <span className="text-muted-foreground">{validUntil}</span>}
              </>
            )}
          </div>
          {!access.is_paid && access.plan && access.plan !== 'free' && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800">
              Votre formule a expiré. Les membres invités n'ont plus accès.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 flex-wrap">
          <CardTitle className="text-base">Vos espaces salon</CardTitle>
          {isManager && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Créer l'espace d'un salon
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {wsQuery.isLoading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : wsQuery.isError ? (
            <ErrorBox error={wsQuery.error} onRetry={() => wsQuery.refetch()} />
          ) : (
            <>
              {activeItems.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun espace salon pour l'instant.</p>
              )}
              {activeItems.map((ws) => (
                <WorkspaceRow key={ws.workspace_id} ws={ws} isManager={isManager} onEdit={() => setEditing(ws)} />
              ))}
              {archivedItems.length > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => setShowArchived((v) => !v)}
                  >
                    Archivés ({archivedItems.length}) {showArchived ? '▲' : '▼'}
                  </button>
                  {showArchived && (
                    <div className="mt-2 space-y-2 opacity-80">
                      {archivedItems.map((ws) => (
                        <WorkspaceRow
                          key={ws.workspace_id}
                          ws={ws}
                          isManager={isManager}
                          onEdit={() => setEditing(ws)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-800">
        L'application de saisie sur le stand et l'invitation de votre équipe arrivent très bientôt dans cette section.
      </div>

      {editing && <EditWorkspaceDialog ws={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      {creating && (
        <CreateWorkspaceDialog exhibitorId={exhibitorId} onClose={() => setCreating(false)} onDone={refresh} />
      )}
    </div>
  );
}

/* ---------- Section ---------- */

export default function ExhibitorLeadsCaptureSection({ exhibitorId }: Props) {
  const qc = useQueryClient();
  const accessQuery = useQuery({
    queryKey: ['booth-access', exhibitorId],
    queryFn: () => getAccess(exhibitorId),
  });
  const [editingRequest, setEditingRequest] = useState(false);

  useEffect(() => {
    setEditingRequest(false);
  }, [accessQuery.data?.requested_at]);

  const refresh = () => {
    setEditingRequest(false);
    qc.invalidateQueries({ queryKey: ['booth-access', exhibitorId] });
  };

  if (accessQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (accessQuery.isError || !accessQuery.data) {
    return <ErrorBox error={accessQuery.error} onRetry={() => accessQuery.refetch()} />;
  }

  const access = accessQuery.data;

  if (access.status === 'approved') {
    return <ApprovedView exhibitorId={exhibitorId} access={access} />;
  }

  if (access.status === 'requested' && !editingRequest) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3 text-sm">
          <div className="rounded-md border border-border bg-muted/40 p-4 text-foreground">
            Demande envoyée le {fmtDate(access.requested_at)}. Nous vous répondons par email.
          </div>
          <button
            type="button"
            className="text-primary underline-offset-4 hover:underline"
            onClick={() => setEditingRequest(true)}
          >
            Modifier ma demande
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lotexpo Leads, en bêta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ul className="space-y-2">
            {[
              'Saisie d\u2019un contact en 10 secondes, même sans réseau',
              'Toute l\u2019équipe partage les mêmes contacts, sans doublon',
              'Les relances après le salon sont suivies : qui fait quoi et quand',
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="font-medium text-foreground">{t}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">Bêta gratuite. Accès validé par l'équipe Lotexpo sous 48 heures.</p>
          {access.status === 'rejected' && (
            <div className="rounded-md border border-border bg-muted/40 p-3">
              Votre précédente demande n'a pas été retenue. Vous pouvez en faire une nouvelle.
            </div>
          )}
          {access.status === 'revoked' && (
            <div className="rounded-md border border-border bg-muted/40 p-3">
              L'accès de votre entreprise a été retiré. Vous pouvez faire une nouvelle demande.
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {access.status === 'requested' ? 'Modifier ma demande' : 'Demander l\u2019accès'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RequestForm exhibitorId={exhibitorId} access={access} onDone={refresh} />
        </CardContent>
      </Card>
    </div>
  );
}
