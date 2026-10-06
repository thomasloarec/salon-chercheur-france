import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { searchCompanies, searchContacts, type BoothCompanySearchItem } from '@/lib/booth/rpc';
import type { Interaction } from '@/lib/booth/types';
import type { BoothCache } from '../sync/cache';
import { enqueue, newId } from '../sync/engine';
import { clearDraft, emptyDraft, saveDraft, type FlowStep, type MeetingDraft } from './draft';
import {
  ACTION,
  HORIZON,
  POTENTIAL,
  RELATIONSHIP,
  TOPIC,
  VALUE_BAND,
  fmtDateTime,
  fullName,
  normPhone,
  splitName,
  teammateName,
  ymd,
} from './labels';

const ORDER: FlowStep[] = ['who', 'coord', 'rel', 'pot', 'concrete', 'action', 'details', 'done'];

interface Suggestion {
  id: string;
  name: string;
  company: string | null;
  hint: string | null;
  relationship: Interaction['relationship'] | null;
}

function Choice({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      variant={selected ? 'default' : 'outline'}
      className="min-h-[56px] w-full justify-start text-base"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Chip({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" size="sm" variant={selected ? 'default' : 'outline'} className="min-h-[44px] rounded-full" onClick={onClick}>
      {children}
    </Button>
  );
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export interface FlowPrefill {
  name?: string;
  company?: string;
  email?: string | null;
  inbound_lead_id?: string;
}

export default function NewMeetingFlow({
  cache,
  me,
  online,
  initial,
  onHome,
}: {
  cache: BoothCache;
  me: string;
  online: boolean;
  initial: MeetingDraft;
  onHome: () => void;
}) {
  const [d, setD] = useState<MeetingDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState<{ id: string; label: string; rel: Interaction['relationship'] | null } | null>(null);
  const [companyFocus, setCompanyFocus] = useState(false);
  const [onlineContacts, setOnlineContacts] = useState<Suggestion[]>([]);
  const [companies, setCompanies] = useState<BoothCompanySearchItem[]>([]);
  const [customDate, setCustomDate] = useState(false);
  const wsId = cache.workspaceId;
  const userId = me;

  const patch = (p: Partial<MeetingDraft>) => setD((prev) => ({ ...prev, ...p }));
  const go = (step: FlowStep, p: Partial<MeetingDraft> = {}) =>
    setD((prev) => ({ ...prev, ...p, step, history: [...prev.history, prev.step] }));
  const back = () => {
    if (d.history.length === 0) return onHome();
    setDuplicate(null);
    setD((prev) => ({ ...prev, step: prev.history[prev.history.length - 1], history: prev.history.slice(0, -1) }));
  };

  // Brouillon local dès que la relation est choisie
  useEffect(() => {
    if (d.step !== 'done' && d.relationship) void saveDraft(userId, wsId, d);
  }, [d, userId, wsId]);

  const lastByContact = useMemo(() => {
    const m = new Map<string, Interaction>();
    for (const i of cache.interactions) {
      if (i.status === 'cancelled') continue;
      const prev = m.get(i.contact_id);
      if (!prev || prev.occurred_at < i.occurred_at) m.set(i.contact_id, i);
    }
    return m;
  }, [cache.interactions]);

  const hintFor = (contactId: string, count?: number) => {
    const last = lastByContact.get(contactId);
    if (last) {
      const { date, time } = fmtDateTime(last.occurred_at);
      return `Déjà rencontré par ${teammateName(cache, last.owner_user_id ?? last.created_by ?? me, me)} le ${date} à ${time}`;
    }
    return count ? `Rencontré ${count} fois` : null;
  };

  const q = d.name.trim().toLowerCase();
  const localSuggestions: Suggestion[] = useMemo(() => {
    if (d.step !== 'who' || q.length < 2) return [];
    return cache.contacts
      .filter((c) =>
        [fullName(c), c.company_name, c.email].some((v) => (v ?? '').toLowerCase().includes(q)),
      )
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        name: fullName(c) || c.email || 'Sans nom',
        company: c.company_name,
        hint: hintFor(c.id),
        relationship: lastByContact.get(c.id)?.relationship ?? null,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cache.contacts, d.step, lastByContact]);

  const debName = useDebounced(q);
  useEffect(() => {
    if (d.step !== 'who' || !online || debName.length < 2 || d.contactId) return setOnlineContacts([]);
    let cancelled = false;
    searchContacts(cache.exhibitorId, debName, 10)
      .then((r) => {
        if (cancelled) return;
        setOnlineContacts(
          (r.items ?? []).map((c) => ({
            id: c.id,
            name: fullName(c) || c.email || 'Sans nom',
            company: c.company_name,
            hint: hintFor(c.id, c.interactions_count),
            relationship: lastByContact.get(c.id)?.relationship ?? null,
          })),
        );
      })
      .catch(() => !cancelled && setOnlineContacts([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debName, online, d.step, d.contactId, cache.exhibitorId]);

  const debCompany = useDebounced(d.company.trim());
  useEffect(() => {
    if (!online || !companyFocus || debCompany.length < 2 || d.companyRef) return setCompanies([]);
    let cancelled = false;
    searchCompanies(debCompany, 6)
      .then((r) => !cancelled && setCompanies(r.items ?? []))
      .catch(() => !cancelled && setCompanies([]));
    return () => {
      cancelled = true;
    };
  }, [debCompany, online, companyFocus, d.companyRef]);

  const suggestions = useMemo(() => {
    const ids = new Set(localSuggestions.map((s) => s.id));
    return [...localSuggestions, ...onlineContacts.filter((s) => !ids.has(s.id))].slice(0, 8);
  }, [localSuggestions, onlineContacts]);

  const pickContact = (s: Suggestion) =>
    go('rel', { contactId: s.id, name: s.name, company: s.company ?? '', relationship: s.relationship ?? null });

  const checkDuplicateAndContinue = () => {
    const v = d.coordValue.trim();
    if (d.coordMode === 'email' && v) {
      const c = cache.contacts.find((x) => (x.email ?? '').toLowerCase() === v.toLowerCase());
      if (c) return setDuplicate({ id: c.id, label: [fullName(c), c.company_name].filter(Boolean).join(', '), rel: lastByContact.get(c.id)?.relationship ?? null });
    }
    if (d.coordMode === 'phone' && normPhone(v)) {
      const n = normPhone(v);
      const c = cache.contacts.find((x) => normPhone(x.phone) === n);
      if (c) return setDuplicate({ id: c.id, label: [fullName(c), c.company_name].filter(Boolean).join(', '), rel: lastByContact.get(c.id)?.relationship ?? null });
    }
    go('rel');
  };

  const dueOptions = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const week = new Date(today);
    week.setDate(today.getDate() + 7);
    let after: string | null = null;
    if (cache.workspace.date_fin || cache.workspace.date_debut) {
      const [y, m, dd] = (cache.workspace.date_fin || cache.workspace.date_debut)!.slice(0, 10).split('-').map(Number);
      after = ymd(new Date(y, m - 1, dd + 1));
    }
    return { tomorrow: ymd(tomorrow), after, week: ymd(week) };
  }, [cache.workspace.date_fin, cache.workspace.date_debut]);

  const pickAction = (a: Interaction['next_action']) => {
    if (a === 'none') return go('details', { next_action: a, due: null });
    patch({ next_action: a, due: d.due ?? dueOptions.after ?? dueOptions.tomorrow, owner: d.owner ?? me });
  };

  async function save(override: Partial<MeetingDraft> = {}) {
    const f = { ...d, ...override };
    setSaving(true);
    try {
      let contactId = f.contactId;
      if (!contactId) {
        contactId = newId();
        const { first_name, last_name } = splitName(f.name);
        const data: Record<string, unknown> = {
          first_name,
          last_name,
          company_name: f.company.trim() || null,
          company_domain: f.companyDomain,
          lotexpo_company_ref: f.companyRef,
          source: f.companyRef ? 'search' : 'manual',
        };
        if (f.coordMode === 'email' && f.coordValue.trim()) data.email = f.coordValue.trim();
        if (f.coordMode === 'phone' && f.coordValue.trim()) data.phone = f.coordValue.trim();
        await enqueue(userId, cache.exhibitorId, 'contact', contactId, data);
      }
      const interactionId = newId();
      const action = f.next_action ?? 'none';
      await enqueue(userId, cache.exhibitorId, 'interaction', interactionId, {
        workspace_id: wsId,
        contact_id: contactId,
        occurred_at: new Date().toISOString(),
        relationship: f.relationship,
        customer_topic: f.relationship === 'customer' ? f.customer_topic : null,
        potential: f.relationship === 'customer' ? null : f.potential,
        next_action: action,
        next_action_due: action === 'none' ? null : f.due,
        next_action_owner_id: action === 'none' ? null : f.owner ?? me,
        note: f.note.trim() || null,
        capture_source: 'manual',
        ...(f.inbound_lead_id ? { inbound_lead_id: f.inbound_lead_id } : {}),
      });
      if (f.concrete) {
        const amount = f.amount.trim() ? Number(f.amount.replace(/\s/g, '').replace(',', '.')) : null;
        await enqueue(userId, cache.exhibitorId, 'opportunity', newId(), {
          workspace_id: wsId,
          contact_id: contactId,
          origin_interaction_id: interactionId,
          title: `Projet ${f.company.trim() || f.name.trim()}`,
          value_band: f.value_band,
          amount: amount !== null && Number.isFinite(amount) ? amount : null,
          horizon: f.horizon,
        });
      }
      await clearDraft(userId, wsId);
      setD((prev) => ({ ...prev, ...override, step: 'done', history: [] }));
    } finally {
      setSaving(false);
    }
  }

  const progress = Math.max(0, ORDER.indexOf(d.step === 'topic' ? 'pot' : d.step)) / (ORDER.length - 1);
  const title = d.name.trim() || d.company.trim();

  if (d.step === 'done') {
    const parts = [
      `${title || 'Contact'} enregistré`,
      d.relationship === 'customer'
        ? d.customer_topic && TOPIC[d.customer_topic]
        : d.potential && POTENTIAL[d.potential],
      ACTION[d.next_action ?? 'none'],
    ].filter(Boolean);
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="text-xl font-semibold text-foreground">{parts.join(' · ')}</p>
        <Button size="lg" className="min-h-[64px] w-full max-w-sm text-lg font-semibold" onClick={() => setD(emptyDraft())}>
          Prochaine rencontre
        </Button>
        <Button variant="link" onClick={onHome}>
          Retour à l'accueil
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="h-1 w-full bg-muted">
        <div className="h-1 bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="flex items-center gap-2 px-2 py-2">
        <Button variant="ghost" className="min-h-[44px] px-2" onClick={back}>
          <ArrowLeft className="mr-1 h-5 w-5" /> Retour
        </Button>
        {title && d.step !== 'who' && <span className="truncate text-sm text-muted-foreground">{title}</span>}
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {d.step === 'who' && (
          <>
            <h2 className="text-2xl font-bold">Qui ?</h2>
            <div className="space-y-2">
              <Input
                autoFocus
                placeholder="Nom (prénom et nom)"
                className="h-14 text-base"
                value={d.name}
                autoComplete="off"
                onChange={(e) => patch({ name: e.target.value, contactId: null })}
              />
              {suggestions.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button type="button" className="w-full p-3 text-left hover:bg-muted" onClick={() => pickContact(s)}>
                        <p className="font-medium">
                          {s.name}
                          {s.company ? <span className="font-normal text-muted-foreground"> · {s.company}</span> : null}
                        </p>
                        {s.hint && <p className="text-xs text-muted-foreground">{s.hint}</p>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Entreprise"
                className="h-14 text-base"
                value={d.company}
                autoComplete="off"
                onFocus={() => setCompanyFocus(true)}
                onChange={(e) => patch({ company: e.target.value, companyRef: null, companyDomain: null })}
              />
              {companies.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {companies.map((c) => (
                    <li key={c.public_identity_id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted"
                        onClick={() => {
                          patch({ company: c.name, companyDomain: c.domain, companyRef: c.public_identity_id });
                          setCompanies([]);
                        }}
                      >
                        {c.logo_url ? (
                          <img src={c.logo_url} alt="" className="h-8 w-8 rounded border border-border bg-background object-contain" />
                        ) : (
                          <Building2 className="h-8 w-8 p-1 text-muted-foreground" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{c.name}</span>
                          {c.domain && <span className="block truncate text-xs text-muted-foreground">{c.domain}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button
              size="lg"
              className="mt-auto min-h-[56px] w-full text-base"
              disabled={!d.name.trim() && !d.company.trim()}
              onClick={() => go('coord')}
            >
              Continuer
            </Button>
          </>
        )}

        {d.step === 'coord' && (
          <>
            <h2 className="text-2xl font-bold">Coordonnée</h2>
            {duplicate ? (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="font-medium">Ce contact existe déjà : {duplicate.label}</p>
                <Choice
                  selected
                  onClick={() => {
                    const dup = duplicate;
                    setDuplicate(null);
                    go('rel', { contactId: dup.id, relationship: dup.rel });
                  }}
                >
                  Utiliser cette fiche (recommandé)
                </Choice>
                <Choice
                  onClick={() => {
                    setDuplicate(null);
                    go('rel');
                  }}
                >
                  Créer quand même
                </Choice>
              </div>
            ) : (
              <>
                <div className="grid gap-3">
                  <Choice selected={d.coordMode === 'email'} onClick={() => patch({ coordMode: 'email', coordValue: '' })}>
                    Email
                  </Choice>
                  <Choice selected={d.coordMode === 'phone'} onClick={() => patch({ coordMode: 'phone', coordValue: '' })}>
                    Téléphone
                  </Choice>
                  <Choice onClick={() => go('rel', { coordMode: 'none', coordValue: '' })}>Pas maintenant</Choice>
                </div>
                {(d.coordMode === 'email' || d.coordMode === 'phone') && (
                  <>
                    <Input
                      autoFocus
                      type={d.coordMode === 'email' ? 'email' : 'tel'}
                      inputMode={d.coordMode === 'email' ? 'email' : 'tel'}
                      placeholder={d.coordMode === 'email' ? 'adresse@entreprise.fr' : '06 12 34 56 78'}
                      className="h-14 text-base"
                      value={d.coordValue}
                      onChange={(e) => patch({ coordValue: e.target.value })}
                    />
                    <Button
                      size="lg"
                      className="mt-auto min-h-[56px] w-full text-base"
                      disabled={!d.coordValue.trim()}
                      onClick={checkDuplicateAndContinue}
                    >
                      Continuer
                    </Button>
                  </>
                )}
              </>
            )}
          </>
        )}

        {d.step === 'rel' && (
          <>
            <h2 className="text-2xl font-bold">Relation</h2>
            <div className="grid gap-3">
              {(Object.keys(RELATIONSHIP) as Interaction['relationship'][]).map((r) => (
                <Choice
                  key={r}
                  selected={d.relationship === r}
                  onClick={() => go(r === 'customer' ? 'topic' : 'pot', { relationship: r })}
                >
                  {RELATIONSHIP[r]}
                </Choice>
              ))}
            </div>
          </>
        )}

        {d.step === 'pot' && (
          <>
            <h2 className="text-2xl font-bold">Potentiel</h2>
            <div className="grid gap-3">
              {(Object.keys(POTENTIAL) as NonNullable<Interaction['potential']>[]).map((p) => (
                <Choice
                  key={p}
                  selected={d.potential === p}
                  onClick={() => {
                    if (p === 'none') {
                      void save({ potential: p, next_action: 'none', due: null, concrete: false });
                    } else go('concrete', { potential: p });
                  }}
                >
                  {POTENTIAL[p]}
                </Choice>
              ))}
            </div>
            {saving && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
          </>
        )}

        {d.step === 'topic' && (
          <>
            <h2 className="text-2xl font-bold">Sujet</h2>
            <div className="grid gap-3">
              {(Object.keys(TOPIC) as NonNullable<Interaction['customer_topic']>[]).map((t) => (
                <Choice
                  key={t}
                  selected={d.customer_topic === t}
                  onClick={() =>
                    t === 'new_project'
                      ? go('concrete', { customer_topic: t })
                      : go('action', { customer_topic: t, concrete: false })
                  }
                >
                  {TOPIC[t]}
                </Choice>
              ))}
            </div>
          </>
        )}

        {d.step === 'concrete' && (
          <>
            <h2 className="text-2xl font-bold">Projet concret ?</h2>
            <div className="grid gap-3">
              <Choice selected={d.concrete === true} onClick={() => go('action', { concrete: true })}>
                Oui
              </Choice>
              <Choice selected={d.concrete === false} onClick={() => go('action', { concrete: false })}>
                Pas encore
              </Choice>
            </div>
          </>
        )}

        {d.step === 'action' && (
          <>
            <h2 className="text-2xl font-bold">Prochaine action</h2>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(ACTION) as Interaction['next_action'][]).map((a) => (
                <Choice key={a} selected={d.next_action === a} onClick={() => pickAction(a)}>
                  {ACTION[a]}
                </Choice>
              ))}
            </div>
            {d.next_action && d.next_action !== 'none' && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Échéance</p>
                  <div className="flex flex-wrap gap-2">
                    <Chip selected={!customDate && d.due === dueOptions.tomorrow} onClick={() => { setCustomDate(false); patch({ due: dueOptions.tomorrow }); }}>
                      Demain
                    </Chip>
                    {dueOptions.after && (
                      <Chip selected={!customDate && d.due === dueOptions.after} onClick={() => { setCustomDate(false); patch({ due: dueOptions.after }); }}>
                        Après le salon
                      </Chip>
                    )}
                    <Chip selected={!customDate && d.due === dueOptions.week} onClick={() => { setCustomDate(false); patch({ due: dueOptions.week }); }}>
                      Dans 1 semaine
                    </Chip>
                    <Chip selected={customDate} onClick={() => setCustomDate(true)}>
                      Choisir une date
                    </Chip>
                  </div>
                  {customDate && (
                    <Input type="date" className="h-12" value={d.due ?? ''} onChange={(e) => patch({ due: e.target.value || null })} />
                  )}
                </div>
                {cache.role === 'manager' && cache.team.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Responsable</p>
                    <div className="flex flex-wrap gap-2">
                      {cache.team.map((m) => (
                        <Chip key={m.user_id} selected={(d.owner ?? me) === m.user_id} onClick={() => patch({ owner: m.user_id })}>
                          {m.user_id === me ? 'Moi' : m.name || m.email}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}
                <Button size="lg" className="mt-auto min-h-[56px] w-full text-base" disabled={!d.due} onClick={() => go('details')}>
                  Continuer
                </Button>
              </>
            )}
          </>
        )}

        {d.step === 'details' && (
          <>
            <h2 className="text-2xl font-bold">Détails</h2>
            <p className="-mt-2 text-sm text-muted-foreground">Facultatif</p>
            {d.concrete && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Valeur estimée</p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(VALUE_BAND) as NonNullable<MeetingDraft['value_band']>[]).map((v) => (
                      <Chip key={v} selected={d.value_band === v} onClick={() => patch({ value_band: d.value_band === v ? null : v })}>
                        {VALUE_BAND[v]}
                      </Chip>
                    ))}
                  </div>
                  <Input
                    inputMode="decimal"
                    placeholder="Montant précis en € (facultatif)"
                    className="h-12"
                    value={d.amount}
                    onChange={(e) => patch({ amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Horizon</p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(HORIZON) as NonNullable<MeetingDraft['horizon']>[]).map((h) => (
                      <Chip key={h} selected={d.horizon === h} onClick={() => patch({ horizon: d.horizon === h ? null : h })}>
                        {HORIZON[h]}
                      </Chip>
                    ))}
                  </div>
                </div>
              </>
            )}
            <Textarea
              placeholder="Note"
              maxLength={2000}
              rows={5}
              className="text-base"
              value={d.note}
              onChange={(e) => patch({ note: e.target.value })}
            />
            <div className="sticky bottom-0 mt-auto bg-background pb-2 pt-2">
              <Button size="lg" className="min-h-[64px] w-full text-lg font-semibold" disabled={saving} onClick={() => void save()}>
                {saving && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
