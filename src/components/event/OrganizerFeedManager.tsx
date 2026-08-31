import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Archive, Send, Eye, MousePointerClick, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  FEED_CATEGORIES, FEED_CTA_TYPES, INTERNAL_CTA,
  FEED_MESSAGE_MAX, FEED_CTA_LABEL_MAX, categoryLabel,
} from '@/lib/eventFeed';
import {
  useEventFeedAdmin, useEventFeedActions, type FeedUpdateAdmin, type FeedComposerData,
} from '@/hooks/useEventFeed';

interface Props {
  eventId: string;
  /** Fin du salon : sert de valeur par défaut à l'expiration. */
  eventDateFin?: string | null;
}

type ExpiryChoice = 'salon' | '7' | '30' | 'none' | 'custom';

const EMPTY: FeedComposerData = {
  message: '',
  category: 'autre',
  cta_type: 'none',
  cta_label: '',
  cta_url: '',
  expires_at: null,
};

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function endOfDayIso(dateStr: string): string {
  const d = new Date(`${dateStr}T23:59:59`);
  return d.toISOString();
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

const OrganizerFeedManager: React.FC<Props> = ({ eventId, eventDateFin }) => {
  const { data: updates, isLoading } = useEventFeedAdmin(eventId);
  const actions = useEventFeedActions(eventId);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FeedComposerData>(EMPTY);
  const [expiry, setExpiry] = useState<ExpiryChoice>('salon');
  const [customDate, setCustomDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<FeedUpdateAdmin | null>(null);

  // Le salon est-il déjà terminé ? Dans ce cas le Fil n'est plus affiché
  // publiquement : on le dit explicitement plutôt que de laisser publier
  // dans le vide.
  const salonTermine = useMemo(() => {
    if (!eventDateFin) return false;
    return new Date(`${eventDateFin}T23:59:59`).getTime() < Date.now();
  }, [eventDateFin]);

  const groups = useMemo(() => {
    const all = updates ?? [];
    return {
      enLigne: all.filter((u) => u.status === 'published' && !u.is_expired),
      expirees: all.filter((u) => u.status === 'published' && u.is_expired),
      brouillons: all.filter((u) => u.status === 'draft'),
      archivees: all.filter((u) => u.status === 'archived'),
    };
  }, [updates]);

  const remaining = FEED_MESSAGE_MAX - form.message.length;

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setExpiry(eventDateFin && !salonTermine ? 'salon' : 'none');
    setCustomDate('');
    setOpen(true);
  };

  const openEdit = (u: FeedUpdateAdmin) => {
    setEditingId(u.update_id);
    setForm({
      message: u.message,
      category: u.category,
      cta_type: u.cta_type,
      cta_label: u.cta_label ?? '',
      cta_url: u.cta_url ?? '',
      expires_at: u.expires_at,
    });
    setExpiry(u.expires_at ? 'custom' : 'none');
    setCustomDate(u.expires_at ? u.expires_at.slice(0, 10) : '');
    setOpen(true);
  };

  const resolveExpiry = (): string | null => {
    switch (expiry) {
      case 'none':   return null;
      case '7':      return daysFromNow(7);
      case '30':     return daysFromNow(30);
      case 'salon':  return eventDateFin ? endOfDayIso(eventDateFin) : null;
      case 'custom': return customDate ? endOfDayIso(customDate) : null;
    }
  };

  const submit = async (publish: boolean) => {
    if (saving) return;
    if (!form.message.trim()) {
      toast.error('Le message est requis.');
      return;
    }
    setSaving(true);
    try {
      const payload: FeedComposerData = {
        message: form.message,
        category: form.category,
        cta_type: form.cta_type,
        cta_label: form.cta_type === 'external' ? form.cta_label : null,
        cta_url: form.cta_type === 'external' ? form.cta_url : null,
        expires_at: resolveExpiry(),
      };
      if (editingId) {
        await actions.update(editingId, payload);
        toast.success('Annonce mise à jour.');
      } else {
        await actions.create(payload, publish);
        toast.success(publish ? 'Annonce publiée.' : 'Brouillon enregistré.');
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "L'annonce n'a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  };

  const doPublish = async (u: FeedUpdateAdmin) => {
    try {
      await actions.publish(u.update_id);
      toast.success('Annonce publiée.');
    } catch (e: any) {
      toast.error(e?.message || "L'annonce n'a pas pu être publiée.");
    }
  };

  const doArchive = async () => {
    if (!archiveTarget) return;
    const target = archiveTarget;
    setArchiveTarget(null);
    try {
      await actions.archive(target.update_id);
      toast.success('Annonce archivée.');
    } catch (e: any) {
      toast.error(e?.message || "L'annonce n'a pas pu être archivée.");
    }
  };

  const renderRow = (u: FeedUpdateAdmin, opts: { showStats?: boolean } = {}) => (
    <Card key={u.update_id} className="p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{categoryLabel(u.category)}</Badge>
            {u.cta_type !== 'none' && (
              <Badge variant="outline">
                {u.cta_type === 'external'
                  ? u.cta_label
                  : INTERNAL_CTA[u.cta_type as keyof typeof INTERNAL_CTA]?.label}
              </Badge>
            )}
            {u.is_expired && u.status === 'published' && (
              <Badge variant="outline" className="text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                Expirée
              </Badge>
            )}
          </div>
          <p className="text-sm text-foreground break-words">{u.message}</p>
          <p className="text-xs text-muted-foreground">
            {u.published_at ? `Publiée le ${formatDate(u.published_at)}` : 'Non publiée'}
            {u.expires_at ? ` · expire le ${formatDate(u.expires_at)}` : ' · sans expiration'}
          </p>
          {opts.showStats && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {u.impressions} affichage{u.impressions > 1 ? 's' : ''}
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <MousePointerClick className="h-3.5 w-3.5" />
                {u.cta_clicks} clic{u.cta_clicks > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {u.status === 'draft' && (
            <Button size="sm" onClick={() => doPublish(u)}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Publier
            </Button>
          )}
          {u.status !== 'archived' && (
            <>
              <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Modifier
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setArchiveTarget(u)}>
                <Archive className="h-3.5 w-3.5 mr-1.5" />
                Archiver
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Seule l'annonce la plus récente est affichée sous le titre de votre salon.
          Les autres restent consultables juste à côté.
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Publier une annonce
        </Button>
      </div>

      {salonTermine && (
        <Card className="p-4 bg-muted/40">
          <p className="text-sm text-muted-foreground">
            Ce salon est terminé : le Fil n'apparaît plus sur la page publique.
            Vos annonces restent visibles ici.
          </p>
        </Card>
      )}

      {(updates?.length ?? 0) === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium text-foreground">Aucune annonce pour l'instant.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Une phrase suffit : une nouveauté du programme, un intervenant confirmé,
            une date de billetterie.
          </p>
        </Card>
      )}

      {groups.enLigne.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            En ligne ({groups.enLigne.length})
          </h3>
          {groups.enLigne.map((u) => renderRow(u, { showStats: true }))}
        </section>
      )}

      {groups.brouillons.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Brouillons ({groups.brouillons.length})
          </h3>
          {groups.brouillons.map((u) => renderRow(u))}
        </section>
      )}

      {groups.expirees.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Expirées ({groups.expirees.length})
          </h3>
          {groups.expirees.map((u) => renderRow(u, { showStats: true }))}
        </section>
      )}

      {groups.archivees.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Archivées ({groups.archivees.length})
          </h3>
          {groups.archivees.map((u) => renderRow(u, { showStats: true }))}
        </section>
      )}

      {/* ─────────────── Composeur ─────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier l'annonce" : 'Nouvelle annonce'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="feed-message">Message</Label>
              <Textarea
                id="feed-message"
                value={form.message}
                maxLength={FEED_MESSAGE_MAX}
                rows={3}
                placeholder="Ex. : Le programme des conférences est en ligne."
                onChange={(e) =>
                  setForm((f) => ({ ...f, message: e.target.value.replace(/[\r\n]+/g, ' ') }))
                }
              />
              <p className={cn(
                'text-xs',
                remaining < 20 ? 'text-destructive' : 'text-muted-foreground',
              )}>
                {remaining} caractère{remaining > 1 ? 's' : ''} restant{remaining > 1 ? 's' : ''}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FEED_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Bouton</Label>
              <Select
                value={form.cta_type}
                onValueChange={(v) => setForm((f) => ({ ...f, cta_type: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FEED_CTA_TYPES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.cta_type !== 'none' && form.cta_type !== 'external' && (
                <p className="text-xs text-muted-foreground">
                  Le bouton affichera «{' '}
                  {INTERNAL_CTA[form.cta_type as keyof typeof INTERNAL_CTA]?.label} » et mènera
                  à la section correspondante de votre page.
                </p>
              )}
            </div>

            {form.cta_type === 'external' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="feed-cta-label">Libellé du bouton</Label>
                  <Input
                    id="feed-cta-label"
                    value={form.cta_label ?? ''}
                    maxLength={FEED_CTA_LABEL_MAX}
                    placeholder="Ex. : Réserver ma place"
                    onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="feed-cta-url">Lien</Label>
                  <Input
                    id="feed-cta-url"
                    value={form.cta_url ?? ''}
                    placeholder="https://..."
                    onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Seuls les liens en https:// sont acceptés.
                  </p>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label>Durée d'affichage</Label>
              <Select value={expiry} onValueChange={(v) => setExpiry(v as ExpiryChoice)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {eventDateFin && !salonTermine && (
                    <SelectItem value="salon">Jusqu'à la fin du salon</SelectItem>
                  )}
                  <SelectItem value="7">7 jours</SelectItem>
                  <SelectItem value="30">30 jours</SelectItem>
                  <SelectItem value="custom">Date précise</SelectItem>
                  <SelectItem value="none">Sans expiration</SelectItem>
                </SelectContent>
              </Select>
              {expiry === 'custom' && (
                <Input
                  type="date"
                  value={customDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setCustomDate(e.target.value)}
                />
              )}
              {expiry === 'none' && (
                <p className="text-xs text-muted-foreground">
                  Cette annonce restera consultable tant que le salon n'est pas passé.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {!editingId && (
              <Button variant="outline" disabled={saving} onClick={() => submit(false)}>
                Enregistrer en brouillon
              </Button>
            )}
            <Button disabled={saving} onClick={() => submit(true)}>
              {saving ? 'Envoi…' : editingId ? 'Enregistrer' : 'Publier maintenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────── Confirmation d'archivage ─────────────── */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver cette annonce ?</AlertDialogTitle>
            <AlertDialogDescription>
              Elle disparaîtra de votre page salon. L'archivage est définitif : vous ne
              pourrez pas la remettre en ligne, mais vous pourrez en publier une nouvelle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={doArchive}>Archiver</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrganizerFeedManager;
