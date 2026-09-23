import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Linkedin,
  Loader2,
  MapPin,
  Sparkles,
  Store,
  Sun,
  Sunset,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { dateRangeLabel, dayChipLabel, eventDays } from './invitationDates';
import type {
  InvitationPageData,
  InvitationStaff,
  MeetingRequestInput,
  MeetingRequestResult,
} from './types';

/* -------------------------------------------------------------------------- */
/* Petits éléments                                                             */
/* -------------------------------------------------------------------------- */

function Eyebrow({ children, inverse = false }: { children: React.ReactNode; inverse?: boolean }) {
  return (
    <p
      className={cn(
        'text-xs font-bold uppercase tracking-[0.14em]',
        inverse ? 'text-inverse-primary' : 'text-primary',
      )}
    >
      {children}
    </p>
  );
}

/**
 * Logo exposant : logo téléversé, sinon favicon du site (même règle que le reste
 * du site via getExhibitorLogoUrl), sinon initiale. Le service de favicons renvoie
 * un globe générique de 16 px quand le domaine n'en publie pas : on le remplace
 * alors par l'initiale.
 */
function ExhibitorLogo({
  name,
  url,
  website,
  size = 'lg',
}: {
  name: string;
  url?: string | null;
  website?: string | null;
  size?: 'sm' | 'lg';
}) {
  const box = size === 'lg' ? 'h-16 w-16 sm:h-20 sm:w-20' : 'h-9 w-9';
  const resolved = getExhibitorLogoUrl(url, website);
  const [failed, setFailed] = useState(false);
  if (resolved && !failed) {
    return (
      <div className={cn(box, 'shrink-0 rounded-2xl bg-white p-2 shadow-sm flex items-center justify-center overflow-hidden')}>
        <img
          src={resolved}
          alt={`Logo ${name}`}
          className="max-h-full max-w-full object-contain"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            if (!url && e.currentTarget.naturalWidth < 24) setFailed(true);
          }}
        />
      </div>
    );
  }
  return (
    <div
      className={cn(
        box,
        'shrink-0 rounded-2xl bg-white text-surface-inverse font-display font-semibold flex items-center justify-center',
        size === 'lg' ? 'text-2xl' : 'text-sm',
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </div>
  );
}

function StaffAvatar({ person }: { person: InvitationStaff }) {
  const initials = `${person.first_name.charAt(0)}${person.last_name.charAt(0)}`.toUpperCase();
  return person.photo_url ? (
    <img
      src={person.photo_url}
      alt={`${person.first_name} ${person.last_name}`}
      className="h-16 w-16 sm:h-24 sm:w-24 shrink-0 rounded-full object-cover ring-4 ring-violet-soft"
      loading="lazy"
    />
  ) : (
    <div className="h-16 w-16 sm:h-24 sm:w-24 shrink-0 rounded-full bg-violet-soft text-primary font-display text-xl sm:text-2xl font-semibold flex items-center justify-center ring-4 ring-violet-soft">
      {initials}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page active                                                                 */
/* -------------------------------------------------------------------------- */

type Moment = 'any' | 'am' | 'pm';

const MOMENTS: { value: Moment; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'am', label: 'Matin', icon: Sun },
  { value: 'pm', label: 'Après-midi', icon: Sunset },
  { value: 'any', label: 'Indifférent', icon: Clock },
];

const EMPTY_FORM = { first_name: '', last_name: '', email: '', company: '', role: '', phone: '', notes: '' };

export interface InvitationPageViewProps {
  data: InvitationPageData;
  onSubmit: (input: MeetingRequestInput) => Promise<MeetingRequestResult>;
  /** Aperçu dans l'éditeur exposant : formulaire désactivé, pas de barre collante. */
  preview?: boolean;
}

export function InvitationPageView({ data, onSubmit, preview = false }: InvitationPageViewProps) {
  const exhibitor = data.exhibitor!;
  const event = data.event!;
  const novelty = data.novelty;
  const staff = data.staff ?? [];

  const days = useMemo(() => eventDays(event.date_debut, event.date_fin), [event.date_debut, event.date_fin]);
  const [day, setDay] = useState<string>('any');
  const [moment, setMoment] = useState<Moment>('any');
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState<'idle' | 'sending' | MeetingRequestResult>('idle');

  const heroRef = useRef<HTMLElement>(null);
  const bookingRef = useRef<HTMLElement>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  const [bookingVisible, setBookingVisible] = useState(false);
  useEffect(() => {
    if (preview || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.target === heroRef.current) setHeroVisible(e.isIntersecting);
          if (e.target === bookingRef.current) setBookingVisible(e.isIntersecting);
        }),
      { threshold: 0.1 },
    );
    if (heroRef.current) obs.observe(heroRef.current);
    if (bookingRef.current) obs.observe(bookingRef.current);
    return () => obs.disconnect();
  }, [preview]);

  const dayLabel = day === 'any' ? null : dayChipLabel(days[Number(day)]);
  const momentLabel = moment === 'any' ? null : MOMENTS.find((m) => m.value === moment)!.label;
  const slotText =
    dayLabel && momentLabel
      ? `${dayLabel} · ${momentLabel}`
      : dayLabel
        ? `${dayLabel} · Horaire indifférent`
        : momentLabel
          ? `Jour indifférent · ${momentLabel}`
          : null;

  const headline = data.headline?.trim() || `Retrouvez-nous sur ${event.name}`;
  const place = [event.nom_lieu, event.ville].filter(Boolean).join(', ');
  const scrollToBooking = () => bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const setField = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview || status === 'sending') return;
    setStatus('sending');
    const result = await onSubmit({ ...form, preferred_slot: slotText });
    setStatus(result);
  };

  const done = status === 'created' || status === 'duplicate';

  return (
    <div className="bg-background text-foreground">
      {/* ================================ HERO ================================ */}
      <section ref={heroRef} className="relative overflow-hidden bg-surface-inverse text-inverse">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: 'url(/home-texture-plexus.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.28 }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(90% 70% at 30% 30%, transparent, hsl(var(--surface-inverse) / 0.9))' }}
        />

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-10 pb-12 lg:pt-16 lg:pb-20 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              <ExhibitorLogo name={exhibitor.name} url={exhibitor.logo_url} website={exhibitor.website} />
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-inverse/20 bg-inverse/5 px-3 py-1 text-xs font-semibold">
                  <Sparkles className="h-3.5 w-3.5 text-inverse-primary" aria-hidden />
                  Invitation
                </span>
                <p className="mt-2 text-sm text-inverse-muted truncate">{exhibitor.name} vous invite</p>
              </div>
            </div>

            <h1 className="heading-display mt-6 text-[clamp(2rem,4.2vw,3.4rem)] text-balance">{headline}</h1>

            {data.message && (
              <p className="mt-5 max-w-2xl text-base sm:text-lg leading-relaxed text-inverse-muted whitespace-pre-line">
                {data.message}
              </p>
            )}

            <ul className="mt-7 flex flex-wrap gap-2.5 text-sm">
              <li className="inline-flex items-center gap-2 rounded-full bg-inverse/10 px-3.5 py-2">
                <CalendarDays className="h-4 w-4 text-inverse-primary" aria-hidden />
                <span className="first-letter:uppercase">{dateRangeLabel(event.date_debut, event.date_fin)}</span>
              </li>
              {place && (
                <li className="inline-flex items-center gap-2 rounded-full bg-inverse/10 px-3.5 py-2">
                  <MapPin className="h-4 w-4 text-inverse-primary" aria-hidden />
                  {place}
                </li>
              )}
              {data.stand && (
                <li className="inline-flex items-center gap-2 rounded-full bg-inverse/10 px-3.5 py-2">
                  <Store className="h-4 w-4 text-inverse-primary" aria-hidden />
                  Stand {data.stand}
                </li>
              )}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={scrollToBooking} className="gap-2">
                <CalendarPlus className="h-5 w-5" />
                Réserver un rendez-vous
              </Button>
              {novelty && (
                <Button
                  size="lg"
                  variant="outline"
                  className="border-inverse/30 bg-transparent text-inverse hover:bg-inverse/10 hover:text-inverse"
                  onClick={() => document.getElementById('nouveaute')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Découvrir la nouveauté
                </Button>
              )}
            </div>
          </div>

          {/* Billet d'invitation */}
          <div className="relative hidden lg:block" aria-hidden>
            <div className="rounded-3xl bg-background text-foreground shadow-2xl overflow-hidden rotate-[1.5deg]">
              <div className="p-6">
                <Eyebrow>Votre invitation</Eyebrow>
                <p className="heading-display mt-2 text-2xl leading-tight">{event.name}</p>
                <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">
                  {dateRangeLabel(event.date_debut, event.date_fin)}
                </p>
              </div>
              <div className="relative border-t-2 border-dashed border-border">
                <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-surface-inverse" />
                <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-surface-inverse" />
              </div>
              <div className="p-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Exposant</p>
                  <p className="font-semibold truncate">{exhibitor.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stand</p>
                  <p className="font-semibold">{data.stand ?? 'À venir'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Lieu</p>
                  <p className="font-semibold">{place || 'À venir'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== NOUVEAUTÉ ============================== */}
      {novelty && (
        <section id="nouveaute" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 lg:py-20 scroll-mt-6">
          <div className="grid gap-8 lg:gap-14 lg:grid-cols-2 lg:items-center">
            <div className="rounded-3xl overflow-hidden bg-muted aspect-[4/3]">
              {novelty.url_image || event.url_image ? (
                <img
                  src={novelty.url_image ?? event.url_image ?? ''}
                  alt={novelty.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-violet-soft to-info-surface flex items-center justify-center">
                  <Sparkles className="h-12 w-12 text-primary" />
                </div>
              )}
            </div>
            <div>
              <Eyebrow>À découvrir sur notre stand</Eyebrow>
              <h2 className="heading-display mt-3 text-[clamp(1.7rem,3vw,2.5rem)]">{novelty.title}</h2>
              {novelty.summary && (
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">{novelty.summary}</p>
              )}
              {novelty.reasons.length > 0 && (
                <ul className="mt-6 space-y-3">
                  {novelty.reasons.map((r) => (
                    <li key={r} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-soft">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </span>
                      <span className="text-foreground">{r}</span>
                    </li>
                  ))}
                </ul>
              )}
              {novelty.slug && (
                <a
                  href={`/nouveautes/${novelty.slug}`}
                  className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  Voir la nouveauté en détail
                  <ArrowRight className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ================================ ÉQUIPE ================================ */}
      {staff.length > 0 && (
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
            <div className="text-center">
              <Eyebrow>Qui vous accueille</Eyebrow>
              <h2 className="heading-display mt-3 text-[clamp(1.7rem,3vw,2.5rem)]">L'équipe sur le stand</h2>
            </div>
            <ul
              className={cn(
                'mt-10 grid gap-5 sm:gap-6',
                staff.length === 1 ? 'max-w-xs mx-auto' : 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
                staff.length === 2 && 'md:grid-cols-2 max-w-xl mx-auto',
                staff.length === 3 && 'lg:grid-cols-3 max-w-4xl mx-auto',
              )}
            >
              {staff.map((p) => (
                <li
                  key={`${p.first_name}-${p.last_name}`}
                  className="rounded-2xl border border-border bg-card p-4 sm:p-6 flex items-center gap-4 text-left sm:flex-col sm:text-center"
                >
                  <StaffAvatar person={p} />
                  <div className="min-w-0 flex-1 sm:flex-none">
                  <p className="font-semibold text-foreground leading-tight sm:mt-4">
                    {p.first_name} {p.last_name}
                  </p>
                  {p.job_title && <p className="mt-1 text-sm text-muted-foreground leading-snug">{p.job_title}</p>}
                  </div>
                  {p.linkedin_url && (
                    <a
                      href={p.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Profil LinkedIn de ${p.first_name} ${p.last_name}`}
                      className="shrink-0 sm:mt-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                    >
                      <Linkedin className="h-4 w-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ============================ RÉSERVATION ============================ */}
      <section ref={bookingRef} id="rendez-vous" className="bg-muted/50 border-t border-border scroll-mt-4">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="text-center">
            <Eyebrow>Rendez-vous</Eyebrow>
            <h2 className="heading-display mt-3 text-[clamp(1.7rem,3vw,2.5rem)]">Réservez votre moment avec nous</h2>
            <p className="mt-3 text-muted-foreground">
              Choisissez un jour et un moment : {exhibitor.name} vous confirmera l'horaire exact.
            </p>
          </div>

          <div className="mt-10 rounded-3xl border border-border bg-card p-5 sm:p-8 shadow-sm">
            {done ? (
              <div className="py-8 text-center" role="status">
                <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
                <h3 className="heading-display mt-4 text-2xl">
                  {status === 'duplicate' ? 'Demande déjà reçue' : 'Demande envoyée'}
                </h3>
                <p className="mt-2 text-muted-foreground">
                  {status === 'duplicate'
                    ? `${exhibitor.name} a déjà votre demande pour ce salon et reviendra vers vous.`
                    : `${exhibitor.name} a bien reçu votre demande et vous recontactera pour confirmer l'horaire.`}
                </p>
                {slotText && status === 'created' && (
                  <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-violet-soft px-4 py-2 text-sm font-medium">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {slotText}
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-8">
                {/* Étape 1 : jour */}
                {days.length > 1 && (
                  <fieldset>
                    <legend className="text-sm font-semibold text-foreground">
                      <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">1</span>
                      Quel jour ?
                    </legend>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {days.map((d, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-pressed={day === String(i)}
                          onClick={() => setDay(String(i))}
                          className={cn(
                            'rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
                            day === String(i)
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background hover:border-primary/60',
                          )}
                        >
                          {dayChipLabel(d)}
                        </button>
                      ))}
                      <button
                        type="button"
                        aria-pressed={day === 'any'}
                        onClick={() => setDay('any')}
                        className={cn(
                          'rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
                          day === 'any'
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background hover:border-primary/60',
                        )}
                      >
                        Indifférent
                      </button>
                    </div>
                  </fieldset>
                )}

                {/* Étape 2 : moment */}
                <fieldset>
                  <legend className="text-sm font-semibold text-foreground">
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">
                      {days.length > 1 ? 2 : 1}
                    </span>
                    Plutôt le matin ou l'après-midi ?
                  </legend>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {MOMENTS.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={moment === value}
                        onClick={() => setMoment(value)}
                        className={cn(
                          'rounded-xl border px-3 py-3 text-sm font-medium transition-colors flex flex-col items-center gap-1',
                          moment === value
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background hover:border-primary/60',
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {/* Étape 3 : coordonnées */}
                <fieldset>
                  <legend className="text-sm font-semibold text-foreground">
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">
                      {days.length > 1 ? 3 : 2}
                    </span>
                    Vos coordonnées
                  </legend>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="inv_first">Prénom *</Label>
                      <Input id="inv_first" required autoComplete="given-name" value={form.first_name} onChange={setField('first_name')} disabled={preview} />
                    </div>
                    <div>
                      <Label htmlFor="inv_last">Nom *</Label>
                      <Input id="inv_last" required autoComplete="family-name" value={form.last_name} onChange={setField('last_name')} disabled={preview} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="inv_email">Email professionnel *</Label>
                      <Input id="inv_email" type="email" required autoComplete="email" value={form.email} onChange={setField('email')} disabled={preview} />
                    </div>
                    <div>
                      <Label htmlFor="inv_company">Société</Label>
                      <Input id="inv_company" autoComplete="organization" value={form.company} onChange={setField('company')} disabled={preview} />
                    </div>
                    <div>
                      <Label htmlFor="inv_role">Fonction</Label>
                      <Input id="inv_role" autoComplete="organization-title" value={form.role} onChange={setField('role')} disabled={preview} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="inv_phone">Téléphone</Label>
                      <Input id="inv_phone" type="tel" autoComplete="tel" value={form.phone} onChange={setField('phone')} disabled={preview} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="inv_notes">Votre projet en quelques mots</Label>
                      <Textarea id="inv_notes" rows={3} value={form.notes} onChange={setField('notes')} disabled={preview} />
                    </div>
                  </div>
                </fieldset>

                {slotText && (
                  <p className="inline-flex items-center gap-2 rounded-lg bg-violet-soft px-3 py-2 text-sm">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Créneau souhaité : <span className="font-medium">{slotText}</span>
                  </p>
                )}

                {(status === 'error' || status === 'inactive') && (
                  <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {status === 'inactive'
                      ? "Cette invitation n'accepte plus de demandes."
                      : "L'envoi n'a pas abouti. Vérifiez votre connexion et réessayez."}
                  </p>
                )}

                <div>
                  <Button type="submit" size="lg" className="w-full gap-2" disabled={preview || status === 'sending'}>
                    {status === 'sending' ? <Loader2 className="h-5 w-5 animate-spin" /> : <CalendarPlus className="h-5 w-5" />}
                    Envoyer ma demande de rendez-vous
                  </Button>
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Vos coordonnées sont transmises uniquement à {exhibitor.name}.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ================================= PIED ================================= */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          {event.slug ? (
            <a href={`/events/${event.slug}`} className="inline-flex items-center gap-1.5 hover:text-primary">
              Voir tous les exposants de {event.name}
              <ArrowRight className="h-4 w-4" />
            </a>
          ) : (
            <span>{event.name}</span>
          )}
          <a href="/" className="inline-flex items-center gap-1 hover:text-primary">
            Page créée avec <span className="font-display font-semibold text-foreground">Lotexpo</span>
          </a>
        </div>
      </footer>

      {/* Barre collante mobile : visible tant que le formulaire n'est pas à l'écran */}
      {!preview && !done && (
        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur p-3 sm:hidden transition-transform',
            heroVisible || bookingVisible ? 'translate-y-full' : 'translate-y-0',
          )}
        >
          <Button className="w-full gap-2" size="lg" onClick={scrollToBooking}>
            <CalendarPlus className="h-5 w-5" />
            Réserver un rendez-vous
          </Button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page inactive ou introuvable                                                */
/* -------------------------------------------------------------------------- */

export function InvitationInactiveView({ data }: { data: InvitationPageData }) {
  const notFound = data.reason === 'not_found';
  return (
    <section className="relative overflow-hidden bg-surface-inverse text-inverse min-h-[70vh] flex items-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'url(/home-texture-plexus.jpg)', backgroundSize: 'cover', opacity: 0.2 }}
      />
      <div className="relative z-10 mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="heading-display text-[clamp(1.8rem,3.5vw,2.6rem)]">
          {notFound ? 'Invitation introuvable' : "Cette invitation n'est plus active"}
        </h1>
        <p className="mt-4 text-inverse-muted">
          {data.reason === 'event_over'
            ? `Le salon ${data.event?.name ?? ''} est terminé.`
            : notFound
              ? "Le lien est peut-être incomplet. Vérifiez l'adresse reçue."
              : `${data.exhibitor?.name ?? "L'exposant"} a mis cette page en pause.`}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {data.event?.slug && (
            <Button asChild size="lg">
              <a href={`/events/${data.event.slug}`}>Voir le salon {data.event.name}</a>
            </Button>
          )}
          {data.exhibitor?.public_slug && (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-inverse/30 bg-transparent text-inverse hover:bg-inverse/10 hover:text-inverse"
            >
              <a href={`/exposants/${data.exhibitor.public_slug}`}>Voir {data.exhibitor.name}</a>
            </Button>
          )}
          {notFound && (
            <Button asChild size="lg">
              <a href="/">Découvrir Lotexpo</a>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
