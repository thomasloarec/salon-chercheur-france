import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, Loader2, PartyPopper, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { InvitationPageView } from '@/components/invitation/InvitationPageView';
import {
  useExhibitorStaff,
  useInvitationDraft,
  useInvitationPreview,
  useSaveInvitation,
  type InvitationOverviewRow,
} from '@/hooks/useInvitationPages';

import SharePanel from './SharePanel';
import StaffPicker from './StaffPicker';

const ERRORS: Record<string, string> = {
  no_published_novelty: "Votre Nouveauté n'est plus publiée : la page ne peut pas être mise en ligne.",
  event_over: 'Ce salon est terminé.',
  forbidden: "Vous n'avez pas les droits pour modifier cette page.",
  invalid_staff: 'Une personne sélectionnée a été retirée de votre annuaire. Vérifiez la sélection.',
};

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground">{title}</h3>
          {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </Card>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={value.length > max ? 'text-destructive' : 'text-muted-foreground'}>
      {value.length}/{max}
    </span>
  );
}

interface InvitationEditorProps {
  exhibitorId: string;
  row: InvitationOverviewRow;
  onBack: () => void;
}

export default function InvitationEditor({ exhibitorId, row, onBack }: InvitationEditorProps) {
  const { data: draft, isLoading: draftLoading } = useInvitationDraft(exhibitorId, row.event_id);
  const { data: base, isLoading: previewLoading, isError: previewError } = useInvitationPreview(exhibitorId, row.event_id);
  const { data: staff = [] } = useExhibitorStaff(exhibitorId);
  const save = useSaveInvitation(exhibitorId);

  const [headline, setHeadline] = useState('');
  const [message, setMessage] = useState('');
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [published, setPublished] = useState<InvitationOverviewRow | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Pré-remplissage une seule fois quand le brouillon est chargé.
  useEffect(() => {
    if (draftLoading || loadedFor === row.event_id) return;
    setHeadline(draft?.headline ?? `Retrouvez-nous sur ${row.event_name}`);
    setMessage(draft?.message ?? '');
    setStaffIds(draft?.staff_ids ?? []);
    setLoadedFor(row.event_id);
  }, [draftLoading, draft, loadedFor, row.event_id, row.event_name]);

  const isPublished = draft?.status === 'published';
  const tooLong = headline.length > 80 || message.length > 400;

  const previewData = useMemo(() => {
    if (!base) return null;
    return {
      ...base,
      active: true,
      headline,
      message,
      staff: staffIds
        .map((id) => staff.find((s) => s.id === id))
        .filter(Boolean)
        .map((s) => ({
          first_name: s!.first_name,
          last_name: s!.last_name,
          job_title: s!.job_title,
          photo_url: s!.photo_url,
          linkedin_url: s!.linkedin_url,
        })),
    };
  }, [base, headline, message, staffIds, staff]);

  const doSave = (publish: boolean) => {
    save.mutate(
      { eventId: row.event_id, headline, message, staffIds, publish },
      {
        onSuccess: (saved) => {
          if (publish && !isPublished) {
            setPublished({ ...row, state: 'online', invitation_slug: saved.slug, invitation_status: 'published' });
          } else {
            toast.success(publish ? 'Page mise à jour' : saved.status === 'draft' ? 'Brouillon enregistré' : 'Modifications enregistrées');
            if (!publish && isPublished) toast.message('La page est maintenant hors ligne.');
          }
        },
        onError: (e) => {
          const code = Object.keys(ERRORS).find((k) => String((e as Error)?.message ?? '').includes(k));
          toast.error(code ? ERRORS[code] : "L'enregistrement n'a pas abouti. Réessayez.");
        },
      },
    );
  };

  if (draftLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Toutes mes invitations
        </button>
        <div className="flex items-center gap-2">
          {isPublished && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
              En ligne
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowPreview(true)} className="gap-1.5">
            <Eye className="h-4 w-4" />
            Aperçu
          </Button>
        </div>
      </div>

      <div>
        <h2 className="heading-display text-2xl">Page d'invitation</h2>
        <p className="text-sm text-muted-foreground">{row.event_name}</p>
      </div>

      <div>
        <div className="space-y-4 min-w-0">
          <Step n={1} title="La Nouveauté mise en avant" hint="C'est elle qui donne envie de venir. Elle se modifie depuis « Mes nouveautés ».">
            <div className="flex items-center gap-3 rounded-lg bg-violet-soft/60 p-3">
              <Sparkles className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{row.novelty_title ?? 'Nouveauté'}</p>
                <p className="text-xs text-muted-foreground">{row.event_name}</p>
              </div>
            </div>
          </Step>

          <Step n={2} title="Votre message" hint="Quelques mots personnels donnent envie de réserver.">
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="inv_headline">Titre de la page</Label>
                  <span className="text-xs"><Counter value={headline} max={80} /></span>
                </div>
                <Input id="inv_headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="inv_message">Message d'invitation (facultatif)</Label>
                  <span className="text-xs"><Counter value={message} max={400} /></span>
                </div>
                <Textarea
                  id="inv_message"
                  rows={4}
                  placeholder="Ex. Cette année, nous présentons notre nouvelle gamme. Prenez rendez-vous : nous vous réservons un moment au calme sur le stand."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </div>
          </Step>

          <Step n={3} title="L'équipe sur le stand" hint="Sélectionnez les personnes présentes sur ce salon. Des visages rassurent vos invités.">
            <StaffPicker exhibitorId={exhibitorId} selected={staffIds} onChange={setStaffIds} />
          </Step>

          <Card className="p-4 sm:p-5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 sticky bottom-3 z-10 shadow-md">
            <p className="text-xs text-muted-foreground">
              Vos invités choisiront un jour et un moment. Les demandes arrivent dans l'onglet « Rendez-vous ».
            </p>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button variant="ghost" onClick={() => setShowPreview(true)} className="gap-1.5">
                <Eye className="h-4 w-4" />
                Aperçu
              </Button>
              <Button variant="outline" onClick={() => doSave(false)} disabled={save.isPending || tooLong}>
                {isPublished ? 'Mettre hors ligne' : 'Enregistrer le brouillon'}
              </Button>
              <Button onClick={() => doSave(true)} disabled={save.isPending || tooLong} className="gap-1.5">
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isPublished ? 'Enregistrer' : 'Publier la page'}
              </Button>
            </div>
          </Card>
        </div>

      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-6xl w-[96vw] p-0 overflow-hidden gap-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Aperçu de la page d'invitation</DialogTitle>
            <DialogDescription>Rendu tel que vos invités le verront.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="ml-3 truncate text-xs text-muted-foreground">lotexpo.com/invitation/{draft?.slug ?? '…'}</span>
          </div>
          <div className="h-[80vh] overflow-y-auto">
            {previewLoading ? (
              <Skeleton className="h-full w-full rounded-none" />
            ) : previewError || !previewData ? (
              <p className="p-6 text-sm text-muted-foreground">Aperçu indisponible pour le moment.</p>
            ) : (
              <InvitationPageView data={previewData} preview onSubmit={async () => 'error'} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!published} onOpenChange={(o) => !o && (setPublished(null), onBack())}>
        <DialogContent className="sm:max-w-lg grid-cols-[minmax(0,1fr)] content-start">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-violet-soft">
              <PartyPopper className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">Votre page d'invitation est en ligne</DialogTitle>
            <DialogDescription className="text-center">
              Partagez-la maintenant : chaque invité peut réserver son moment sur votre stand.
            </DialogDescription>
          </DialogHeader>
          {published && <SharePanel row={published} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
