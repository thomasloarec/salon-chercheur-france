import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { getMonogram } from '@/components/event/ExhibitorAvatar';
import { GripVertical, Plus, Search, Trash2, UserPlus, X, Loader2 } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities;

export interface AttachedSpeaker {
  speaker_id: string;
  full_name: string;
  job_title?: string | null;
  company?: string | null;
  photo_url?: string | null;
  role: string;
}

interface EventSpeaker {
  id: string;
  full_name: string;
  job_title: string | null;
  company: string | null;
  bio: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  speaker_position: number | null;
}

const ROLES = [
  { value: 'intervenant', label: 'Intervenant' },
  { value: 'moderateur', label: 'Modérateur' },
  { value: 'interviewe', label: 'Interviewé' },
  { value: 'animateur', label: 'Animateur' },
];

const EMPTY_NEW = { full_name: '', job_title: '', company: '', linkedin_url: '', photo_url: '' };

function Avatar({ url, name, className = '' }: { url?: string | null; name: string; className?: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={cn('h-10 w-10 rounded-full object-cover ring-1 ring-border', className)}
      />
    );
  }
  return (
    <div
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground ring-1 ring-border',
        className,
      )}
    >
      {getMonogram(name)}
    </div>
  );
}

const SessionSpeakersEditor: React.FC<{
  eventId: string;
  value: AttachedSpeaker[];
  onChange: (list: AttachedSpeaker[]) => void;
}> = ({ eventId, value, onChange }) => {
  const { data: existing } = useQuery({
    queryKey: ['event-speakers-admin', eventId],
    enabled: !!eventId,
    staleTime: 0,
    queryFn: async (): Promise<EventSpeaker[]> => {
      const { data, error } = await supabase.rpc('get_event_speakers_admin', { p_event_id: eventId });
      if (error) throw error;
      return (data ?? []) as unknown as EventSpeaker[];
    },
  });

  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [query, setQuery] = useState('');
  const [newSpeaker, setNewSpeaker] = useState(EMPTY_NEW);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  const candidates = useMemo(() => {
    const attached = new Set(value.map((v) => v.speaker_id));
    const q = query.trim().toLowerCase();
    return (existing ?? [])
      .filter((s) => !attached.has(s.id))
      .filter((s) => !q || (s.full_name || '').toLowerCase().includes(q));
  }, [existing, query, value]);

  const attach = (s: EventSpeaker) => {
    onChange([...value, {
      speaker_id: s.id, full_name: s.full_name, job_title: s.job_title,
      company: s.company, photo_url: s.photo_url, role: 'intervenant',
    }]);
    setQuery('');
    setAdding(false);
  };
  const detach = (id: string) => onChange(value.filter((v) => v.speaker_id !== id));
  const setRole = (id: string, role: string) =>
    onChange(value.map((v) => (v.speaker_id === id ? { ...v, role } : v)));

  const handleFile = async (file?: File | null) => {
    if (!file || uploading) return;
    if (!file.type.startsWith('image/')) { toast.error('Choisissez un fichier image.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop lourde (5 Mo maximum).'); return; }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${eventId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('program-speakers').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('program-speakers').getPublicUrl(path);
      setNewSpeaker((s) => ({ ...s, photo_url: data.publicUrl }));
    } catch (e: any) {
      toast.error(e?.message || "L'image n'a pas pu être envoyée.");
    } finally {
      setUploading(false);
    }
  };

  const createAndAttach = async () => {
    if (!newSpeaker.full_name.trim() || creating) return;
    setCreating(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('event-program-manage', {
        body: {
          action: 'speaker.create',
          event_id: eventId,
          data: {
            full_name: newSpeaker.full_name.trim(),
            job_title: newSpeaker.job_title || null,
            company: newSpeaker.company || null,
            linkedin_url: newSpeaker.linkedin_url || null,
            photo_url: newSpeaker.photo_url || null,
          },
        },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.message || res.error);
      onChange([...value, {
        speaker_id: res.id, full_name: newSpeaker.full_name.trim(),
        job_title: newSpeaker.job_title || null, company: newSpeaker.company || null,
        photo_url: newSpeaker.photo_url || null, role: 'intervenant',
      }]);
      setNewSpeaker(EMPTY_NEW);
      setAdding(false);
      setMode('existing');
      toast.success('Intervenant créé et ajouté.');
    } catch (e: any) {
      toast.error(e?.message || "L'intervenant n'a pas pu être créé.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">Intervenants</h4>
        <span className="text-xs text-muted-foreground">{value.length} rattaché{value.length > 1 ? 's' : ''}</span>
      </div>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((sp) => (
            <div key={sp.speaker_id} className="flex items-center gap-3 rounded-md border border-border p-2">
              <Avatar url={sp.photo_url} name={sp.full_name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{sp.full_name}</p>
                {(sp.job_title || sp.company) && (
                  <p className="truncate text-xs text-muted-foreground">
                    {[sp.job_title, sp.company].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <Select value={sp.role} onValueChange={(r) => setRole(sp.speaker_id, r)}>
                <SelectTrigger className="h-8 w-[9.5rem] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => detach(sp.speaker_id)} aria-label="Retirer">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {!adding ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <UserPlus className="mr-1.5 h-4 w-4" /> Ajouter un intervenant
        </Button>
      ) : (
        <div className="space-y-3 rounded-md border border-border p-3">
          <div className="flex items-center gap-2">
            <Button type="button" variant={mode === 'existing' ? 'default' : 'outline'} size="sm" onClick={() => setMode('existing')}>
              Existant
            </Button>
            <Button type="button" variant={mode === 'new' ? 'default' : 'outline'} size="sm" onClick={() => setMode('new')}>
              Nouveau
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8"
              onClick={() => { setAdding(false); setNewSpeaker(EMPTY_NEW); setQuery(''); }}
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {mode === 'existing' ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un intervenant déjà créé…"
                />
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {candidates.length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    Aucun intervenant disponible. Créez-en un via l'onglet « Nouveau ».
                  </p>
                ) : (
                  candidates.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => attach(s)}
                      className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted"
                    >
                      <Avatar url={s.photo_url} name={s.full_name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{s.full_name}</p>
                        {(s.job_title || s.company) && (
                          <p className="truncate text-xs text-muted-foreground">
                            {[s.job_title, s.company].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar url={newSpeaker.photo_url} name={newSpeaker.full_name || '?'} />
                <div className="flex-1">
                  <Label htmlFor="sp-photo" className="cursor-pointer">
                    <Input
                      id="sp-photo"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => handleFile(e.target.files?.[0])}
                    />
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {newSpeaker.photo_url ? 'Changer la photo' : 'Ajouter une photo'}
                    </span>
                  </Label>
                  <p className="text-xs text-muted-foreground">JPG/PNG, 5 Mo max.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sp-name">Nom complet *</Label>
                <Input
                  id="sp-name"
                  value={newSpeaker.full_name}
                  onChange={(e) => setNewSpeaker((s) => ({ ...s, full_name: e.target.value }))}
                  placeholder="Prénom Nom"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sp-job">Fonction</Label>
                  <Input
                    id="sp-job"
                    value={newSpeaker.job_title}
                    onChange={(e) => setNewSpeaker((s) => ({ ...s, job_title: e.target.value }))}
                    placeholder="Directrice marketing"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sp-company">Entreprise</Label>
                  <Input
                    id="sp-company"
                    value={newSpeaker.company}
                    onChange={(e) => setNewSpeaker((s) => ({ ...s, company: e.target.value }))}
                    placeholder="Société"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sp-linkedin">LinkedIn</Label>
                <Input
                  id="sp-linkedin"
                  type="url"
                  value={newSpeaker.linkedin_url}
                  onChange={(e) => setNewSpeaker((s) => ({ ...s, linkedin_url: e.target.value }))}
                  placeholder="https://linkedin.com/in/…"
                />
              </div>

              <Button
                type="button"
                size="sm"
                disabled={!newSpeaker.full_name.trim() || creating}
                onClick={createAndAttach}
              >
                {creating ? 'Création…' : 'Créer et ajouter'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SessionSpeakersEditor;
