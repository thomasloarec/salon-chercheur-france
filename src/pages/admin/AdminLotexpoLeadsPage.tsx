import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, addYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, ExternalLink, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDebounce } from '@/hooks/useDebounce';
import {
  adminListAccess,
  adminReviewAccess,
  boothErrorMessage,
  type BoothAccessStatus,
  type BoothAdminAccessItem,
  type BoothAdminDecision,
} from '@/lib/booth/rpc';

type FilterKey = 'requested' | 'approved' | 'rejected' | 'revoked' | 'all';
type PlanKey = 'beta' | 'free' | 'pass' | 'annual';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'requested', label: 'En attente' },
  { key: 'approved', label: 'Ouverts' },
  { key: 'rejected', label: 'Refusés' },
  { key: 'revoked', label: 'Retirés' },
  { key: 'all', label: 'Tous' },
];

const STATUS_LABEL: Record<BoothAccessStatus, string> = {
  none: 'Aucune demande',
  requested: 'En attente',
  approved: 'Ouvert',
  rejected: 'Refusé',
  revoked: 'Retiré',
};

const PLAN_LABEL: Record<PlanKey, string> = {
  beta: 'Bêta',
  free: 'Gratuit',
  pass: 'Pass Salon',
  annual: 'Annuel',
};

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '';
  try {
    return format(new Date(d), 'd MMMM yyyy', { locale: fr });
  } catch {
    return '';
  }
};

interface Target {
  exhibitorId: string;
  exhibitorName: string;
  decision: BoothAdminDecision;
  targetEventId?: string | null;
  targetEventName?: string | null;
  currentPlan?: PlanKey | null;
  currentEventId?: string | null;
  currentEventName?: string | null;
  currentValidUntil?: string | null;
}

interface EventChoice {
  id: string;
  nom_event: string;
  ville: string | null;
  date_debut: string | null;
}

/* ---------- Dialogue Formule ---------- */

function PlanDialog({ target, onClose, onDone }: { target: Target; onClose: () => void; onDone: () => void }) {
  const [plan, setPlan] = useState<PlanKey>(target.currentPlan ?? 'beta');
  const initialEvent: EventChoice | null = target.currentEventId
    ? { id: target.currentEventId, nom_event: target.currentEventName ?? 'Salon', ville: null, date_debut: null }
    : target.targetEventId
      ? { id: target.targetEventId, nom_event: target.targetEventName ?? 'Salon visé', ville: null, date_debut: null }
      : null;
  const [event, setEvent] = useState<EventChoice | null>(initialEvent);
  const [searching, setSearching] = useState(!initialEvent);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const [validUntil, setValidUntil] = useState<string>(target.currentValidUntil?.slice(0, 10) ?? '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['admin-booth-event-search', debounced],
    enabled: plan === 'pass' && searching && debounced.trim().length >= 2,
    queryFn: async (): Promise<EventChoice[]> => {
      const { data, error } = await supabase.rpc('search_upcoming_events', { p_query: debounced.trim(), p_limit: 10 });
      if (error) throw error;
      return (data ?? []) as EventChoice[];
    },
  });

  const changePlan = (p: PlanKey) => {
    setPlan(p);
    if (p === 'annual' && !validUntil) setValidUntil(format(addYears(new Date(), 1), 'yyyy-MM-dd'));
  };

  const submit = async () => {
    if (plan === 'pass' && !event) {
      toast.error('Choisissez le salon du Pass Salon.');
      return;
    }
    setSaving(true);
    try {
      await adminReviewAccess({
        exhibitorId: target.exhibitorId,
        decision: target.decision,
        plan,
        planEventId: plan === 'pass' ? event!.id : null,
        planValidUntil: plan === 'pass' || plan === 'annual' ? validUntil || null : null,
        note: note.trim() || null,
      });
      toast.success(
        target.decision === 'set_plan' ? 'Formule mise à jour.' : "Enregistré. L'email au demandeur part automatiquement.",
      );
      onDone();
      onClose();
    } catch (e) {
      toast.error(boothErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const title = target.decision === 'set_plan' ? 'Changer la formule' : "Ouvrir l'accès";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {title} · {target.exhibitorName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Formule</Label>
            <Select value={plan} onValueChange={(v) => changePlan(v as PlanKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PLAN_LABEL) as PlanKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {PLAN_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {plan === 'pass' && (
            <div className="space-y-2">
              <Label>Salon (obligatoire)</Label>
              {event && !searching ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-primary bg-primary/5 px-3 py-2 text-sm">
                  <span className="font-medium">{event.nom_event}</span>
                  <button type="button" className="text-primary text-xs hover:underline" onClick={() => setSearching(true)}>
                    Choisir un autre salon
                  </button>
                </div>
              ) : (
                <>
                  <Input autoFocus placeholder="Rechercher un salon à venir" value={query} onChange={(e) => setQuery(e.target.value)} />
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {isFetching && <Skeleton className="h-9 w-full" />}
                    {results.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setEvent(r);
                          setSearching(false);
                        }}
                        className="w-full text-left rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                      >
                        <span className="font-medium">{r.nom_event}</span>
                        <span className="block text-xs text-muted-foreground">
                          {[r.ville, fmtDate(r.date_debut)].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {(plan === 'pass' || plan === 'annual') && (
            <div className="space-y-1.5">
              <Label htmlFor="plan-until">Date de fin{plan === 'pass' ? ' (facultative)' : ''}</Label>
              <Input id="plan-until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="plan-note">Note interne (facultative)</Label>
            <Textarea id="plan-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Refus / retrait ---------- */

function SimpleDecisionDialog({
  item,
  decision,
  onClose,
  onDone,
}: {
  item: BoothAdminAccessItem;
  decision: 'reject' | 'revoke';
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await adminReviewAccess({ exhibitorId: item.exhibitor_id, decision, note: note.trim() || null });
      toast.success("Enregistré. L'email au demandeur part automatiquement.");
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
          <DialogTitle>
            {decision === 'reject' ? 'Refuser la demande' : "Retirer l'accès"} · {item.exhibitor_name}
          </DialogTitle>
        </DialogHeader>
        {decision === 'revoke' && (
          <p className="text-sm text-muted-foreground">
            L'entreprise et ses membres invités perdront l'accès à Lotexpo Leads. Confirmez-vous ?
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="dec-note">Note (facultative)</Label>
          <Textarea id="dec-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {decision === 'reject' ? 'Refuser' : "Retirer l'accès"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Recherche d'entreprise ---------- */

function CompanyPickerDialog({ onClose, onPick }: { onClose: () => void; onPick: (id: string, name: string) => void }) {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const { data = [], isFetching } = useQuery({
    queryKey: ['admin-booth-company-search', debounced],
    enabled: debounced.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exhibitors')
        .select('id, name, slug')
        .ilike('name', `%${debounced.trim()}%`)
        .order('name')
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ouvrir l'accès à une entreprise</DialogTitle>
        </DialogHeader>
        <Input autoFocus placeholder="Nom de l'entreprise (2 caractères minimum)" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="max-h-64 overflow-y-auto space-y-1">
          {isFetching && <Skeleton className="h-9 w-full" />}
          {data.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onPick(e.id, e.name)}
              className="w-full text-left rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              <span className="font-medium">{e.name}</span>
              {e.slug && <span className="block text-xs text-muted-foreground">{e.slug}</span>}
            </button>
          ))}
          {!isFetching && debounced.trim().length >= 2 && data.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune entreprise trouvée.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Page ---------- */

export default function AdminLotexpoLeadsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>('requested');
  const [planTarget, setPlanTarget] = useState<Target | null>(null);
  const [simple, setSimple] = useState<{ item: BoothAdminAccessItem; decision: 'reject' | 'revoke' } | null>(null);
  const [picking, setPicking] = useState(false);

  const query = useQuery({
    queryKey: ['admin-booth-access', filter],
    queryFn: () => adminListAccess(filter === 'all' ? null : filter),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-booth-access'] });
    qc.invalidateQueries({ queryKey: ['admin-pending-counts'] });
  };

  const toTarget = (it: BoothAdminAccessItem, decision: BoothAdminDecision): Target => ({
    exhibitorId: it.exhibitor_id,
    exhibitorName: it.exhibitor_name ?? 'Entreprise',
    decision,
    targetEventId: it.target_event_id,
    targetEventName: it.target_event_name,
    currentPlan: decision === 'set_plan' ? ((it.plan as PlanKey) ?? null) : null,
    currentEventId: decision === 'set_plan' ? it.plan_event_id : null,
    currentEventName: decision === 'set_plan' ? it.plan_event_name : null,
    currentValidUntil: decision === 'set_plan' ? it.plan_valid_until : null,
  });

  const items = query.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Lotexpo Leads</h1>
          <p className="text-sm text-muted-foreground">Demandes d'accès à la bêta et formules des exposants.</p>
        </div>
        <Button onClick={() => setPicking(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Ouvrir l'accès à une entreprise
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)}>
            {f.label}
          </Button>
        ))}
        {query.data && <span className="text-sm text-muted-foreground ml-2">{query.data.total} au total</span>}
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : query.isError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-3">
          <p className="text-destructive">{boothErrorMessage(query.error)}</p>
          <Button size="sm" variant="outline" onClick={() => query.refetch()}>
            Réessayer
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune demande dans cette catégorie.</p>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <Card key={it.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{it.exhibitor_name ?? 'Entreprise'}</CardTitle>
                    {it.exhibitor_slug && (
                      <div className="flex gap-3 text-xs">
                        <Link to={`/exposants/${it.exhibitor_slug}`} target="_blank" className="text-primary hover:underline inline-flex items-center gap-1">
                          Fiche publique <ExternalLink className="h-3 w-3" />
                        </Link>
                        <Link
                          to={`/exposants/${it.exhibitor_slug}/gerer?section=leads`}
                          target="_blank"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Espace exposant <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <Badge variant={it.status === 'approved' ? 'default' : 'secondary'}>{STATUS_LABEL[it.status]}</Badge>
                    {it.status === 'approved' && it.plan && (
                      <Badge variant="outline">
                        {PLAN_LABEL[it.plan as PlanKey]}
                        {it.plan === 'pass' && it.plan_event_name ? ` · ${it.plan_event_name}` : ''}
                        {it.plan_valid_until ? ` · jusqu'au ${fmtDate(it.plan_valid_until)}` : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  <p>
                    <span className="text-muted-foreground">Demandeur : </span>
                    {it.requested_by_email || 'Ouvert par Lotexpo'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Salon visé : </span>
                    {it.target_event_name
                      ? `${it.target_event_name}${it.target_event_start ? ` (${fmtDate(it.target_event_start)})` : ''}`
                      : 'Non précisé'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Équipe : </span>
                    {it.team_size ? `${it.team_size} personne${it.team_size > 1 ? 's' : ''}` : 'Non précisée'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Demande le : </span>
                    {fmtDate(it.created_at)}
                  </p>
                </div>
                {it.message && <p className="bg-muted/40 rounded-md p-3 whitespace-pre-line">{it.message}</p>}
                {it.admin_note && (
                  <p className="text-xs text-muted-foreground">
                    Note admin : {it.admin_note}
                    {it.reviewed_at ? ` (${fmtDate(it.reviewed_at)})` : ''}
                  </p>
                )}
                <div className="flex gap-2 flex-wrap pt-1">
                  {it.status === 'requested' && (
                    <>
                      <Button size="sm" onClick={() => setPlanTarget(toTarget(it, 'approve'))}>
                        <Check className="h-4 w-4 mr-1.5" />
                        Ouvrir l'accès
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSimple({ item: it, decision: 'reject' })}>
                        Refuser
                      </Button>
                    </>
                  )}
                  {it.status === 'approved' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setPlanTarget(toTarget(it, 'set_plan'))}>
                        Changer la formule
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSimple({ item: it, decision: 'revoke' })}>
                        Retirer l'accès
                      </Button>
                    </>
                  )}
                  {(it.status === 'rejected' || it.status === 'revoked') && (
                    <Button size="sm" onClick={() => setPlanTarget(toTarget(it, 'approve'))}>
                      Rouvrir l'accès
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {planTarget && <PlanDialog target={planTarget} onClose={() => setPlanTarget(null)} onDone={refresh} />}
      {simple && (
        <SimpleDecisionDialog item={simple.item} decision={simple.decision} onClose={() => setSimple(null)} onDone={refresh} />
      )}
      {picking && (
        <CompanyPickerDialog
          onClose={() => setPicking(false)}
          onPick={(id, name) => {
            setPicking(false);
            setPlanTarget({ exhibitorId: id, exhibitorName: name, decision: 'approve' });
          }}
        />
      )}
    </div>
  );
}
