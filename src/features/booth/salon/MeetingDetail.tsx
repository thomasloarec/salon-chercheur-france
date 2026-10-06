import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { enqueue } from '../sync/engine';
import {
  ACTION,
  HORIZON,
  POTENTIAL,
  RELATIONSHIP,
  TOPIC,
  VALUE_BAND,
  fmtDateTime,
  fullName,
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
    <Button type="button" size="sm" disabled={disabled} variant={selected ? 'default' : 'outline'} className="min-h-[40px] rounded-full" onClick={onClick}>
      {children}
    </Button>
  );
}

export default function MeetingDetail({
  cache,
  me,
  interactionId,
  onBack,
}: {
  cache: BoothCache;
  me: string;
  interactionId: string;
  onBack: () => void;
}) {
  const i = cache.interactions.find((x) => x.id === interactionId);
  const c = i ? cache.contacts.find((x) => x.id === i.contact_id) : undefined;
  const opp = i
    ? cache.opportunities.find((o) => o.origin_interaction_id === i.id) ??
      cache.opportunities.find((o) => o.contact_id === i.contact_id && o.workspace_id === i.workspace_id)
    : undefined;
  const [note, setNote] = useState(i?.note ?? '');
  const [email, setEmail] = useState(c?.email ?? '');
  const [phone, setPhone] = useState(c?.phone ?? '');
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => setNote(i?.note ?? ''), [i?.note]);
  useEffect(() => {
    setEmail(c?.email ?? '');
    setPhone(c?.phone ?? '');
  }, [c?.email, c?.phone]);

  if (!i) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Rencontre introuvable.</p>
        <Button onClick={onBack}>Retour</Button>
      </div>
    );
  }

  const isManager = cache.role === 'manager';
  const canEdit = isManager || i.created_by === me || ownerOf(i, me) === me || i.next_action_owner_id === me;
  const canEditContact = !!c && (isManager || !c.created_by || c.created_by === me);
  const update = (data: Partial<Interaction> & Record<string, unknown>) =>
    enqueue(me, cache.exhibitorId, 'interaction', i.id, data);
  const { date, time } = fmtDateTime(i.occurred_at);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-2 py-2">
        <Button variant="ghost" className="min-h-[44px] px-2" onClick={onBack}>
          <ArrowLeft className="mr-1 h-5 w-5" /> Rencontres
        </Button>
      </div>
      <div className="space-y-5 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div>
          <h2 className="text-2xl font-bold">{fullName(c) || c?.email || 'Contact'}</h2>
          <p className="text-muted-foreground">
            {[c?.job_title, c?.company_name].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Rencontré le {date} à {time} par {teammateName(cache, ownerOf(i, me), me, false)}
          </p>
        </div>

        <section className="rounded-lg border border-border p-3">
          <h3 className="mb-2 text-sm font-semibold">Coordonnées</h3>
          {canEditContact ? (
            <div className="space-y-2">
              <Input type="email" inputMode="email" placeholder="Email" className="h-12" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input type="tel" inputMode="tel" placeholder="Téléphone" className="h-12" value={phone} onChange={(e) => setPhone(e.target.value)} />
              {(email !== (c?.email ?? '') || phone !== (c?.phone ?? '')) && (
                <Button
                  className="min-h-[44px] w-full"
                  onClick={async () => {
                    await enqueue(me, cache.exhibitorId, 'contact', c!.id, { email: email.trim() || null, phone: phone.trim() || null });
                    toast({ description: 'Coordonnées enregistrées.' });
                  }}
                >
                  Enregistrer les coordonnées
                </Button>
              )}
            </div>
          ) : (
            <>
              <Row label="Email">{c?.email || 'Non renseigné'}</Row>
              <Row label="Téléphone">{c?.phone || 'Non renseigné'}</Row>
            </>
          )}
        </section>

        <section className="rounded-lg border border-border p-3">
          <h3 className="mb-2 text-sm font-semibold">Rencontre</h3>
          <Row label="Relation">{RELATIONSHIP[i.relationship] ?? 'Non renseignée'}</Row>
          {i.customer_topic && <Row label="Sujet">{TOPIC[i.customer_topic]}</Row>}
          {i.relationship !== 'customer' && (
            <div className="py-2">
              <p className="mb-1.5 text-sm text-muted-foreground">Potentiel</p>
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
              {i.next_action_owner_id && (
                <Row label="Responsable">{teammateName(cache, i.next_action_owner_id, me, false)}</Row>
              )}
              {i.next_action_done_at ? (
                <p className="text-sm font-medium text-muted-foreground">Action faite</p>
              ) : (
                canEdit && (
                  <Button variant="outline" className="min-h-[48px] w-full" onClick={() => void update({ next_action_done: true })}>
                    Action faite
                  </Button>
                )
              )}
            </div>
          )}
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">Note</p>
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
              <p className="mb-1.5 text-sm text-muted-foreground">Confier à</p>
              <div className="flex flex-wrap gap-2">
                {cache.team.map((m) => (
                  <Chip key={m.user_id} selected={ownerOf(i, me) === m.user_id} onClick={() => void update({ owner_user_id: m.user_id })}>
                    {m.user_id === me ? 'Moi' : m.name || m.email}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </section>

        {opp && (
          <section className="rounded-lg border border-border p-3">
            <h3 className="mb-2 text-sm font-semibold">Opportunité</h3>
            {opp.title && <Row label="Titre">{opp.title}</Row>}
            {opp.value_band && <Row label="Valeur">{VALUE_BAND[opp.value_band]}</Row>}
            {opp.amount != null && <Row label="Montant">{opp.amount.toLocaleString('fr-FR')} €</Row>}
            {opp.horizon && <Row label="Horizon">{HORIZON[opp.horizon]}</Row>}
          </section>
        )}

        {canEdit && (
          <Button variant="ghost" className="min-h-[48px] w-full text-destructive" onClick={() => setConfirmCancel(true)}>
            Annuler cette rencontre
          </Button>
        )}
        {!canEdit && <p className="text-center text-xs text-muted-foreground">Consultation seule</p>}
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
