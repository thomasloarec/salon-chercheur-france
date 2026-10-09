import { useEffect, useState } from 'react';
import AppButton from '../ui/ChunkyButton';
import BoothChip from '../ui/Chip';
import PotentialBadge from '../ui/PotentialBadge';
import { ArrowLeft, Loader2 } from 'lucide-react';
import VoiceDictation from '../voice/VoiceDictation';
import type { VoiceRecording } from '../voice/useVoiceRecorder';
import { blobToBase64 } from '../voice/base64';
import { addVoice, appendToInteractionNote, linkVoiceNoteLater, removeVoice, useVoiceItems } from '../voice/voiceQueue';
import { boothErrorMessage, voiceNote } from '@/lib/booth/rpc';
import { newId } from '../sync/engine';
import { Button } from '@/components/ui/button';
import PersonBlock from './PersonBlock';
import { dayTimeLabel, primaryLabel, secondaryLabel } from './display';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import type { Interaction } from '@/lib/booth/types';
import type { BoothCache } from '../sync/cache';
import { enqueue, listOutbox } from '../sync/engine';
import { onBoothChange } from '../sync/cache';
import {
  ACTION,
  HORIZON,
  POTENTIAL,
  RELATIONSHIP,
  TOPIC,
  VALUE_BAND,
  fmtDateTime,
  isCompleted,
  ownerOf,
  teammateName,
} from './labels';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function Chip({ selected, onClick, children, disabled }: { selected?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <BoothChip disabled={disabled} selected={selected} onClick={onClick} className="disabled:opacity-60">
      {children}
    </BoothChip>
  );
}

export default function MeetingDetail({
  cache,
  me,
  interactionId,
  split = false,
  onBack,
}: {
  cache: BoothCache;
  me: string;
  interactionId: string;
  onBack: () => void;
  /** Vue côte à côte (lg) : la fiche reste sur une colonne. */
  split?: boolean;
}) {
  const i = cache.interactions.find((x) => x.id === interactionId);
  const c = i ? cache.contacts.find((x) => x.id === i.contact_id) : undefined;
  const opp = i
    ? cache.opportunities.find((o) => o.origin_interaction_id === i.id) ??
      cache.opportunities.find((o) => o.contact_id === i.contact_id && o.workspace_id === i.workspace_id)
    : undefined;
  const [note, setNote] = useState(i?.note ?? '');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const voiceItems = useVoiceItems(me, cache.workspaceId);

  useEffect(() => setNote(i?.note ?? ''), [i?.note]);
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    const read = async () => {
      const items = await listOutbox(me, cache.exhibitorId);
      setRefused(
        items.some(
          (o) => o.id === interactionId && o.state === 'rejected' && /BOOTH_FORBIDDEN|BOOTH_INVALID_INPUT/.test(String(o.error ?? '')),
        ),
      );
    };
    void read();
    return onBoothChange(() => void read());
  }, [me, cache.exhibitorId, interactionId]);

  if (!i) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Rencontre introuvable.</p>
        <AppButton className="max-w-sm" onClick={onBack}>Retour</AppButton>
      </div>
    );
  }

  const isManager = cache.role === 'manager';
  const canEdit = isManager || i.created_by === me || ownerOf(i, me) === me;
  const canMarkDone = canEdit || i.next_action_owner_id === me;
  const memberLabel = (m: BoothCache['team'][number]) => (m.user_id === me ? 'Moi' : m.name || m.email || 'Membre');
  const canEditContact = !!c && (isManager || !c.created_by || c.created_by === me);
  const update = (data: Partial<Interaction> & Record<string, unknown>) =>
    enqueue(me, cache.exhibitorId, 'interaction', i.id, data);
  const voiceMine = voiceItems.filter((v) => v.interactionId === i.id);
  const dictate = async (r: VoiceRecording) => {
    const noteId = newId();
    let audioBase64: string;
    try {
      audioBase64 = await blobToBase64(r.blob);
    } catch {
      toast({ description: 'L\u2019enregistrement n\u2019a pas pu être lu. Réessayez.', variant: 'destructive' });
      return;
    }
    const queue = async () => {
      await addVoice({ noteId, userId: me, exhibitorId: cache.exhibitorId, workspaceId: cache.workspaceId, interactionId: i.id, base64: audioBase64, mediaType: r.mediaType, durationMs: r.durationMs });
      toast({ description: 'Note enregistrée. Elle sera transcrite au retour du réseau.' });
    };
    if (!navigator.onLine) return void (await queue());
    setVoiceBusy(true);
    try {
      const res = await voiceNote({ workspaceId: cache.workspaceId, noteId, mode: 'note', audioBase64, mediaType: r.mediaType, durationMs: r.durationMs });
      const text = (res.transcript ?? '').trim();
      if (res.status !== 'ok' || !text) {
        toast({ description: 'Rien n\u2019a été entendu. Réessayez.' });
        return;
      }
      await appendToInteractionNote(me, cache.exhibitorId, cache.workspaceId, i.id, text);
      linkVoiceNoteLater(me, noteId, i.id);
    } catch (e) {
      const m = String((e as Error)?.message ?? '');
      if (m.includes('BOOTH_NETWORK')) await queue();
      else toast({ description: boothErrorMessage(e), variant: 'destructive' });
    } finally {
      setVoiceBusy(false);
    }
  };
  const { date, time } = fmtDateTime(i.occurred_at);
  const others = cache.interactions
    .filter((o) => o.id !== i.id && o.contact_id === i.contact_id && (o.workspace_id === cache.workspaceId || !o.workspace_id) && isCompleted(o))
    .sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''));

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-2 py-2">
        <Button variant="ghost" className="min-h-[44px] px-2" onClick={onBack}>
          <ArrowLeft className="mr-1 h-5 w-5" /> Rencontres
        </Button>
      </div>
      <div className={`space-y-5 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] ${split ? '' : 'lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0'}`}>
        <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">{primaryLabel(c)}</h2>
          {secondaryLabel(c) && <p className="text-muted-foreground">{secondaryLabel(c)}</p>}
          <p className="mt-1 text-sm font-medium">{dayTimeLabel(i.occurred_at, cache.workspace)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Rencontré le {date} à {time} par {teammateName(cache, ownerOf(i, me), me, false)}
          </p>
        </div>

        {refused && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Ce changement n'a pas été accepté : la personne choisie ne fait plus partie de l'équipe ou vos droits ont changé.
          </p>
        )}
        {c && (
          <PersonBlock cache={cache} me={me} contact={c} canEdit={canEditContact} />
        )}
        {others.length > 0 && (
          <div className="space-y-1 text-sm text-muted-foreground">
            {others.map((o) => (
              <p key={o.id}>
                Aussi rencontrée le {fmtDateTime(o.occurred_at).date} à {fmtDateTime(o.occurred_at).time} par {teammateName(cache, ownerOf(o, me), me)}
              </p>
            ))}
          </div>
        )}
        </div>

        <div className="space-y-5">
        <section className="rounded-xl border border-border bg-background p-3">
          <h3 className="mb-2 text-sm font-semibold">Rencontre</h3>
          <Row label="Relation">{RELATIONSHIP[i.relationship] ?? 'Non renseignée'}</Row>
          {i.customer_topic && <Row label="Sujet">{TOPIC[i.customer_topic]}</Row>}
          {i.relationship !== 'customer' && (
            <div className="py-2">
              <p className="mb-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                Potentiel
                {i.potential && <PotentialBadge value={i.potential} />}
              </p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(POTENTIAL) as NonNullable<Interaction['potential']>[]).map((p) => (
                  <Chip key={p} disabled={!canEdit} selected={i.potential === p} onClick={() => void update({ potential: p })}>
                    {POTENTIAL[p]}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <div className="py-2">
            <p className="mb-1.5 text-sm text-muted-foreground">Prochaine action</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ACTION) as Interaction['next_action'][]).map((a) => (
                <Chip key={a} disabled={!canEdit} selected={i.next_action === a} onClick={() => void update({ next_action: a })}>
                  {ACTION[a]}
                </Chip>
              ))}
            </div>
          </div>
          {i.next_action !== 'none' && (
            <div className="space-y-2 py-2">
              <p className="text-sm text-muted-foreground">Échéance</p>
              <Input
                type="date"
                className="h-12"
                disabled={!canEdit}
                value={i.next_action_due ?? ''}
                onChange={(e) => void update({ next_action_due: e.target.value || null })}
              />
              {isManager && cache.team.length > 0 ? (
                <div className="py-1">
                  <p className="mb-1.5 text-sm text-muted-foreground">Responsable de l'action</p>
                  <div className="flex flex-wrap gap-2">
                    {cache.team.map((m) => (
                      <Chip
                        key={m.user_id}
                        selected={(i.next_action_owner_id ?? ownerOf(i, me)) === m.user_id}
                        onClick={() => void update({ next_action_owner_id: m.user_id })}
                      >
                        {memberLabel(m)}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : i.next_action_owner_id && (
                <Row label="Responsable">{teammateName(cache, i.next_action_owner_id, me, false)}</Row>
              )}
              {i.next_action_done_at ? (
                <p className="text-sm font-medium text-muted-foreground">Action faite</p>
              ) : (
                canMarkDone && (
                  <AppButton variant="secondary" className="md:w-auto md:min-w-[200px]" onClick={() => void update({ next_action_done: true })}>
                    {canEdit ? 'Action faite' : 'Marquer comme faite'}
                  </AppButton>
                )
              )}
            </div>
          )}
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">Note</p>
            {voiceMine.filter((v) => v.state === 'pending').length > 0 && (
              <p className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">Note vocale en attente</p>
            )}
            {voiceMine.filter((v) => v.state === 'blocked').map((v) => (
              <div key={v.noteId} className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <p className="font-medium text-destructive">Note vocale non transcrite</p>
                <p className="text-muted-foreground">{boothErrorMessage(v.error)}</p>
                <Button variant="outline" className="min-h-[44px] w-full md:w-auto" onClick={() => void removeVoice(me, cache.workspaceId, v.noteId)}>
                  Supprimer l'enregistrement
                </Button>
              </div>
            ))}
            {canEdit && cache.full_features && (
              <>
                <VoiceDictation label="Dicter la note" disabled={voiceBusy} onRecorded={(r) => void dictate(r)} />
                {voiceBusy && <p className="flex items-center text-sm"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Transcription…</p>}
              </>
            )}
            {canEdit ? (
              <>
                <Textarea maxLength={2000} rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
                {note !== (i.note ?? '') && (
                  <Button
                    className="min-h-[44px] w-full"
                    onClick={async () => {
                      await update({ note: note.trim() || null });
                      toast({ description: 'Note enregistrée.' });
                    }}
                  >
                    Enregistrer la note
                  </Button>
                )}
              </>
            ) : (
              <p className="whitespace-pre-wrap text-sm">{i.note || 'Aucune note'}</p>
            )}
          </div>
          {isManager && cache.team.length > 1 && (
            <div className="py-2">
              <p className="mb-1.5 text-sm text-muted-foreground">Rencontre suivie par</p>
              <div className="flex flex-wrap gap-2">
                {cache.team.map((m) => (
                  <Chip key={m.user_id} selected={ownerOf(i, me) === m.user_id} onClick={() => void update({ owner_user_id: m.user_id })}>
                    {memberLabel(m)}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </section>

        {opp && (
          <section className="rounded-xl border border-border bg-background p-3">
            <h3 className="mb-2 text-sm font-semibold">Opportunité</h3>
            {opp.title && <Row label="Titre">{opp.title}</Row>}
            {opp.value_band && <Row label="Valeur">{VALUE_BAND[opp.value_band]}</Row>}
            {opp.amount != null && <Row label="Montant">{opp.amount.toLocaleString('fr-FR')} €</Row>}
            {opp.horizon && <Row label="Horizon">{HORIZON[opp.horizon]}</Row>}
          </section>
        )}

        {canEdit && (
          <Button variant="ghost" className="min-h-[48px] w-full text-destructive md:w-auto" onClick={() => setConfirmCancel(true)}>
            Annuler cette rencontre
          </Button>
        )}
        {!canEdit && !canMarkDone && <p className="text-center text-xs text-muted-foreground">Consultation seule</p>}
        </div>
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cette rencontre ?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Garder</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await update({ status: 'cancelled' });
                onBack();
              }}
            >
              Annuler la rencontre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
