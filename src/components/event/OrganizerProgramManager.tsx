import React, { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEventProgramAdmin, type ProgramSession } from '@/hooks/useEventProgram';
import SessionSpeakersEditor, { type AttachedSpeaker } from '@/components/event/SessionSpeakersEditor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Pencil, Copy, Trash2, MapPin, Clock, Star, Users } from 'lucide-react';

const SESSION_TYPES: { value: string; label: string }[] = [
  { value: 'conference', label: 'Conférence' },
  { value: 'keynote', label: 'Keynote' },
  { value: 'table_ronde', label: 'Table ronde' },
  { value: 'atelier', label: 'Atelier' },
  { value: 'demo', label: 'Démo' },
  { value: 'remise_prix', label: 'Remise de prix' },
  { value: 'networking', label: 'Networking' },
  { value: 'autre', label: 'Autre' },
];
const typeLabel = (t: string | null) =>
  SESSION_TYPES.find((x) => x.value === t)?.label ?? 'Autre';

interface FormState {
  title: string;
  session_type: string;
  day_date: string;
  start_time: string;
  end_time: string;
  location: string;
  track: string;
  registration_url: string;
  description: string;
  is_highlight: boolean;
  status: string;
}

const EMPTY_FORM: FormState = {
  title: '', session_type: 'conference', day_date: '', start_time: '', end_time: '',
  location: '', track: '', registration_url: '', description: '',
  is_highlight: false, status: 'draft',
};

function formatDay(day: string | null): string {
  if (!day) return 'Sans date';
  const d = new Date(day + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return day;
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');

const OrganizerProgramManager: React.FC<{ eventId: string }> = ({ eventId }) => {
  const { data: sessions, isLoading } = useEventProgramAdmin(eventId);
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formSpeakers, setFormSpeakers] = useState<AttachedSpeaker[]>([]);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, ProgramSession[]>();
    for (const s of sessions ?? []) {
      const key = s.day_date ?? '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()];
  }, [sessions]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['event-program-admin', eventId] });
    queryClient.invalidateQueries({ queryKey: ['event-program', eventId] });
    queryClient.invalidateQueries({ queryKey: ['event-program-count', eventId] });
    queryClient.invalidateQueries({ queryKey: ['event-speakers-admin', eventId] });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormSpeakers([]);
    setDialogOpen(true);
  };
  const openEdit = (s: ProgramSession) => {
    setEditingId(s.session_id);
    setForm({
      title: s.title ?? '',
      session_type: s.session_type ?? 'conference',
      day_date: s.day_date ?? '',
      start_time: hhmm(s.start_time),
      end_time: hhmm(s.end_time),
      location: s.location ?? '',
      track: s.track ?? '',
      registration_url: s.registration_url ?? '',
      description: s.description ?? '',
      is_highlight: !!s.is_highlight,
      status: s.status ?? 'draft',
    });
    setFormSpeakers(
      (s.speakers ?? []).map((sp: any) => ({
        speaker_id: sp.id,
        full_name: sp.full_name,
        job_title: sp.job_title,
        company: sp.company,
        photo_url: sp.photo_url,
        role: sp.role || 'intervenant',
      }))
    );
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    const data = {
      title: form.title.trim(),
      session_type: form.session_type,
      day_date: form.day_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location: form.location || null,
      track: form.track || null,
      registration_url: form.registration_url || null,
      description: form.description || null,
      is_highlight: form.is_highlight,
      status: form.status,
    };
    const body = editingId
      ? { action: 'session.update', event_id: eventId, session_id: editingId, data }
      : { action: 'session.create', event_id: eventId, data };
    try {
      const { data: res, error } = await supabase.functions.invoke('event-program-manage', { body });
      if (error) throw error;
      if (res?.error) throw new Error(res.message || res.error);

      const sessionId = editingId ?? res?.id;
      if (sessionId) {
        const { data: spRes, error: spErr } = await supabase.functions.invoke('event-program-manage', {
          body: {
            action: 'session.set_speakers',
            event_id: eventId,
            session_id: sessionId,
            speakers: formSpeakers.map((s, i) => ({ speaker_id: s.speaker_id, role: s.role, position: i })),
          },
        });
        if (spErr) throw spErr;
        if (spRes?.error) throw new Error(spRes.message || spRes.error);
      }

      toast.success(editingId ? 'Session mise à jour.' : 'Session ajoutée.');
      setDialogOpen(false);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "La session n'a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async (s: ProgramSession) => {
    if (duplicatingId) return;
    setDuplicatingId(s.session_id);
    try {
      const { data: res, error } = await supabase.functions.invoke('event-program-manage', {
        body: {
          action: 'session.create',
          event_id: eventId,
          data: {
            title: `${s.title ?? 'Session'} (copie)`,
            session_type: s.session_type,
            day_date: s.day_date,
            start_time: s.start_time,
            end_time: s.end_time,
            location: s.location,
            track: s.track,
            registration_url: s.registration_url,
            description: s.description,
            is_highlight: s.is_highlight,
            status: 'draft',
          },
        },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.message || res.error);

      const speakers = (s.speakers ?? []).map((sp: any, i: number) => ({
        speaker_id: sp.id, role: sp.role || 'intervenant', position: i,
      }));
      if (res?.id && speakers.length > 0) {
        const { data: spRes, error: spErr } = await supabase.functions.invoke('event-program-manage', {
          body: { action: 'session.set_speakers', event_id: eventId, session_id: res.id, speakers },
        });
        if (spErr) throw spErr;
        if (spRes?.error) throw new Error(spRes.message || spRes.error);
      }
      toast.success('Session dupliquée (en brouillon).');
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "La session n'a pas pu être dupliquée.");
    } finally {
      setDuplicatingId(null);
    }
  };

  const remove = async (s: ProgramSession) => {
    if (deletingId) return;
    if (!window.confirm(`Supprimer la session « ${s.title ?? ''} » ? Cette action est définitive.`)) return;
    setDeletingId(s.session_id);
    try {
      const { data: res, error } = await supabase.functions.invoke('event-program-manage', {
        body: { action: 'session.delete', event_id: eventId, session_id: s.session_id },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.message || res.error);
      toast.success('Session supprimée.');
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "La session n'a pas pu être supprimée.");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const total = sessions?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {total === 0 ? 'Aucune session pour le moment.' : `${total} session${total > 1 ? 's' : ''} au programme.`}
        </p>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Ajouter une session
        </Button>
      </div>

      {total === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Construisez le programme de votre événement en ajoutant vos sessions une par une.
        </Card>
      ) : (
        <div className="space-y-8">
          {grouped.map(([day, daySessions]) => (
            <div key={day}>
              <h3 className="heading-display text-lg mb-3">
                {formatDay(day === '__none__' ? null : day)}
              </h3>
              <div className="space-y-2">
                {daySessions.map((s) => {
                  const nbSpeakers = s.speakers?.length ?? 0;
                  return (
                    <Card key={s.session_id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {(s.start_time || s.end_time) && (
                              <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                {hhmm(s.start_time)}{s.end_time ? ` – ${hhmm(s.end_time)}` : ''}
                              </span>
                            )}
                            <Badge variant="secondary">{typeLabel(s.session_type)}</Badge>
                            <Badge variant={s.status === 'published' ? 'default' : 'outline'}>
                              {s.status === 'published' ? 'Publié' : 'Brouillon'}
                            </Badge>
                            {s.is_highlight && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                                <Star className="h-3.5 w-3.5" /> Temps fort
                              </span>
                            )}
                          </div>
                          <p className="font-semibold leading-tight break-words">{s.title}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            {s.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />{s.location}
                              </span>
                            )}
                            {s.track && <span>{s.track}</span>}
                            {nbSpeakers > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3 w-3" />{nbSpeakers}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label="Éditer">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => remove(s)}
                            disabled={deletingId === s.session_id}
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier la session' : 'Ajouter une session'}</DialogTitle>
            <DialogDescription className="sr-only">Formulaire de session du programme</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pm-title">Titre *</Label>
              <Input id="pm-title" value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Titre de la session" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.session_type} onValueChange={(v) => setForm((f) => ({ ...f, session_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SESSION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="published">Publié</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pm-day">Jour</Label>
                <Input id="pm-day" type="date" value={form.day_date}
                  onChange={(e) => setForm((f) => ({ ...f, day_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pm-start">Début</Label>
                <Input id="pm-start" type="time" value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pm-end">Fin</Label>
                <Input id="pm-end" type="time" value={form.end_time}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pm-loc">Lieu</Label>
                <Input id="pm-loc" value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Salle, amphi…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pm-track">Catégorie</Label>
                <Input id="pm-track" value={form.track}
                  onChange={(e) => setForm((f) => ({ ...f, track: e.target.value }))}
                  placeholder="Thématique (optionnel)" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pm-url">Lien d'inscription</Label>
              <Input id="pm-url" type="url" value={form.registration_url}
                onChange={(e) => setForm((f) => ({ ...f, registration_url: e.target.value }))}
                placeholder="https://…" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pm-desc">Description</Label>
              <Textarea id="pm-desc" rows={3} value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>

            <SessionSpeakersEditor eventId={eventId} value={formSpeakers} onChange={setFormSpeakers} />

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="pm-hl">Temps fort</Label>
                <p className="text-xs text-muted-foreground">
                  Met la session en avant sur la page publique : fond coloré et bordure
                  distinctive. À réserver aux moments marquants (keynote, cérémonie,
                  session phare). Optionnel : laissez désactivé pour une session standard.
                </p>
              </div>
              <Switch id="pm-hl" checked={form.is_highlight}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_highlight: v }))}
                className="mt-1 shrink-0" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.title.trim()}>
              {saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrganizerProgramManager;
