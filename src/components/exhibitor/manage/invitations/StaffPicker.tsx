import { useRef, useState } from 'react';
import { Camera, Check, Linkedin, Loader2, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useArchiveStaff, useExhibitorStaff, useSaveStaff, type StaffMember } from '@/hooks/useInvitationPages';

const MAX_PHOTO = 5 * 1024 * 1024;
const LINKEDIN_RE = /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i;

function Avatar({ m, size = 'md' }: { m: Pick<StaffMember, 'first_name' | 'last_name' | 'photo_url'>; size?: 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-20 w-20 text-xl' : 'h-11 w-11 text-sm';
  return m.photo_url ? (
    <img src={m.photo_url} alt="" className={cn(cls, 'rounded-full object-cover shrink-0')} />
  ) : (
    <div className={cn(cls, 'rounded-full bg-violet-soft text-primary font-semibold flex items-center justify-center shrink-0')}>
      {`${m.first_name.charAt(0)}${m.last_name.charAt(0)}`.toUpperCase() || <UserRound className="h-5 w-5" />}
    </div>
  );
}

const EMPTY = { first_name: '', last_name: '', job_title: '', linkedin_url: '' };

function StaffDialog({
  exhibitorId,
  editing,
  open,
  onOpenChange,
  onSaved,
}: {
  exhibitorId: string;
  editing: StaffMember | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: (id: string) => void;
}) {
  const save = useSaveStaff(exhibitorId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [initFor, setInitFor] = useState<string | null | undefined>(undefined);

  // Réinitialisation à chaque ouverture (création ou modification).
  const key = open ? (editing?.id ?? 'new') : undefined;
  if (key !== initFor) {
    setInitFor(key);
    setForm(editing ? {
      first_name: editing.first_name,
      last_name: editing.last_name,
      job_title: editing.job_title ?? '',
      linkedin_url: editing.linkedin_url ?? '',
    } : EMPTY);
    setPhoto(null);
    setPreview(editing?.photo_url ?? null);
  }

  const linkedinInvalid = form.linkedin_url.trim() !== '' && !LINKEDIN_RE.test(form.linkedin_url.trim());

  const pickPhoto = (f: File | undefined) => {
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return toast.error('Formats acceptés : JPG, PNG ou WebP.');
    if (f.size > MAX_PHOTO) return toast.error('Photo trop lourde (5 Mo maximum).');
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (linkedinInvalid) return;
    save.mutate(
      { id: editing?.id, ...form, photo, photo_url: editing?.photo_url ?? null },
      {
        onSuccess: (id) => {
          toast.success(editing ? 'Fiche mise à jour' : 'Personne ajoutée');
          onSaved(id);
          onOpenChange(false);
        },
        onError: () => toast.error("L'enregistrement n'a pas abouti. Réessayez."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Modifier la personne' : 'Ajouter une personne'}</DialogTitle>
          <DialogDescription>Elle apparaîtra sur vos pages d'invitation quand vous la sélectionnerez.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Choisir une photo"
            >
              <Avatar m={{ first_name: form.first_name || '?', last_name: form.last_name, photo_url: preview }} size="lg" />
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
                <Camera className="h-3.5 w-3.5" />
              </span>
            </button>
            <p className="text-xs text-muted-foreground">
              Photo portrait, de préférence carrée. JPG, PNG ou WebP, 5 Mo maximum.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => pickPhoto(e.target.files?.[0])}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="st_first">Prénom *</Label>
              <Input id="st_first" required maxLength={60} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="st_last">Nom *</Label>
              <Input id="st_last" required maxLength={60} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="st_job">Fonction</Label>
            <Input id="st_job" maxLength={80} placeholder="Ex. Responsable grands comptes" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="st_li">Profil LinkedIn</Label>
            <Input
              id="st_li"
              placeholder="https://www.linkedin.com/in/…"
              value={form.linkedin_url}
              onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
              aria-invalid={linkedinInvalid}
            />
            {linkedinInvalid && <p className="mt-1 text-xs text-destructive">Collez l'adresse complète du profil LinkedIn.</p>}
          </div>
          <p className="rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">
            En ajoutant cette personne, vous confirmez qu'elle a accepté d'apparaître sur vos pages d'invitation.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={save.isPending || linkedinInvalid}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Annuaire des personnes de l'exposant + sélection pour ce salon (décision D2). */
export default function StaffPicker({
  exhibitorId,
  selected,
  onChange,
}: {
  exhibitorId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: staff = [], isLoading } = useExhibitorStaff(exhibitorId);
  const archive = useArchiveStaff(exhibitorId);
  const [dialog, setDialog] = useState<{ open: boolean; editing: StaffMember | null }>({ open: false, editing: null });

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  if (isLoading) return <Skeleton className="h-28 w-full" />;

  return (
    <div className="space-y-3">
      {staff.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Ajoutez les personnes présentes sur votre stand. Vous les retrouverez pour vos prochains salons.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {staff.map((m) => {
            const on = selected.includes(m.id);
            return (
              <li key={m.id}>
                <div
                  className={cn(
                    'group flex items-center gap-3 rounded-xl border p-3 transition-colors',
                    on ? 'border-primary bg-violet-soft/60' : 'border-border hover:border-primary/50',
                  )}
                >
                  <button type="button" onClick={() => toggle(m.id)} className="flex flex-1 min-w-0 items-center gap-3 text-left" aria-pressed={on}>
                    <Avatar m={m} />
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground truncate">
                        {m.first_name} {m.last_name}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                        {m.linkedin_url && <Linkedin className="h-3 w-3 shrink-0" />}
                        {m.job_title ?? 'Fonction non renseignée'}
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setDialog({ open: true, editing: m })}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                      aria-label={`Modifier ${m.first_name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(selected.filter((s) => s !== m.id));
                        archive.mutate(m.id, { onError: () => toast.error('Suppression impossible. Réessayez.') });
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted"
                      aria-label={`Retirer ${m.first_name} de l'annuaire`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <span
                      className={cn(
                        'ml-1 flex h-6 w-6 items-center justify-center rounded-full border',
                        on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                      )}
                      aria-hidden
                    >
                      {on && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => setDialog({ open: true, editing: null })} className="gap-1.5">
        <Plus className="h-4 w-4" />
        Ajouter une personne
      </Button>
      <StaffDialog
        exhibitorId={exhibitorId}
        editing={dialog.editing}
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onSaved={(id) => !dialog.editing && !selected.includes(id) && onChange([...selected, id])}
      />
    </div>
  );
}
