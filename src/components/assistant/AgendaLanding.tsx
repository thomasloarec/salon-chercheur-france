import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarHeart, Check, Info, Sparkles, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { usePublicStats } from '@/hooks/usePublicStats';
import { getDaysUntilStart } from '@/lib/eventCapabilities';
import { ASSISTANT_ONBOARDING_PATH } from '@/components/assistant/config';

const SIGNIN_PATH = '/auth?tab=signin&redirect=%2Fagenda';

/* ================================================================== */
/* Primitives (copiées d'Exposants.tsx et Home.tsx, volontairement)    */
/* ================================================================== */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.14);
  const shown = reduced || inView;
  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}
      className={`transition-all duration-700 ease-out ${
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
    >
      {children}
    </div>
  );
}

const Mock = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`rounded-[20px] border border-border bg-background shadow-[0_12px_34px_-14px_hsl(var(--primary)/0.22)] p-5 ${className}`}
  >
    {children}
  </div>
);

const frThousands = (n: number) => n.toLocaleString('fr-FR');

function CountUp({ target }: { target: number }) {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLSpanElement>(0.4);
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView || target <= 0) return;
    if (reduced) { setValue(target); return; }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min((now - start) / 1300, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * e));
      if (p < 1) raf = requestAnimationFrame(step);
      else setValue(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, reduced]);
  return <span ref={ref}>{value > 0 ? `${frThousands(value)}+` : '0'}</span>;
}

interface SolutionBlock {
  actor: string;
  title: string;
  body: React.ReactNode;
  ecoNote: string;
  cta?: { label: string; to: string };
  visual: React.ReactNode;
}

const SolutionRow = ({
  block,
  reversed,
  muted,
}: {
  block: SolutionBlock;
  reversed: boolean;
  muted?: boolean;
}) => (
  <Reveal className={cn('w-full', muted && 'bg-muted/40')}>
    <div className="max-w-[1180px] mx-auto px-7 py-14 grid grid-cols-1 lg:grid-cols-2 gap-y-[38px] lg:gap-y-0 lg:gap-x-[74px] items-center">
      <div className={reversed ? 'lg:order-last' : ''}>
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary text-primary font-bold text-[0.78rem] uppercase tracking-[0.06em] px-[13px] py-[5px] mb-4">
          {block.actor}
        </span>
        <h3 className="heading-display font-bold text-[clamp(1.7rem,3vw,2.4rem)] leading-[1.12] text-foreground max-w-[16ch]">
          {block.title}
        </h3>
        <p className="mt-[18px] text-[1.08rem] leading-[1.65] text-foreground/70 max-w-[46ch]">
          {block.body}
        </p>
        <div className="mt-5 flex gap-[11px] items-start bg-secondary/25 border-l-[3px] border-primary rounded-r-[10px] px-4 py-[13px] max-w-[46ch]">
          <Info className="h-[18px] w-[18px] text-primary shrink-0 mt-0.5" />
          <p className="text-[0.96rem] leading-relaxed text-foreground/75">{block.ecoNote}</p>
        </div>
        {block.cta && (
          <Link
            to={block.cta.to}
            className="group mt-6 inline-flex items-center gap-2 font-bold text-primary transition-colors hover:text-primary"
          >
            {block.cta.label}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </div>
      <div className={reversed ? 'lg:order-first' : ''}>{block.visual}</div>
    </div>
  </Reveal>
);

/* Apparition une par une des lignes d'une maquette */
function useStagger(count: number, stepMs = 150) {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduced) { setShown(count); return; }
    if (!inView) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= count) window.clearInterval(id);
    }, stepMs);
    return () => window.clearInterval(id);
  }, [inView, reduced, count, stepMs]);
  const cls = (i: number) =>
    cn('transition-all duration-500 ease-out', i < shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3');
  return { ref, shown, cls };
}

/* ================================================================== */
/* Démo réelle                                                         */
/* ================================================================== */
interface DemoItem {
  item_type: 'session' | 'novelty';
  title: string;
  reason: string | null;
  promise?: string | null;
  company: string | null;
  event: { nom_event: string; slug: string; date_debut: string; ville: string | null };
}
interface Demo {
  profile: { label: string | null; interests?: string[] };
  items: DemoItem[];
}

const FALLBACK_DEMO: Demo = {
  profile: { label: "Ingénieur bureau d'études chez un fabricant de machines agricoles" },
  items: [
    {
      item_type: 'session',
      title: "Quand la robotique passe à l'épreuve du terrain",
      reason:
        'La robotique agricole évaluée sur le terrain, avec performances réelles et références techniques, touche directement vos travaux en R&D et automatisation.',
      company: null,
      event: { nom_event: 'VINITECH-SIFEL', slug: 'vinitech-sifel', date_debut: '2026-12-01', ville: 'Bordeaux' },
    },
    {
      item_type: 'novelty',
      title: 'Découvrez nos solutions de récolte et nos chariots',
      reason:
        'Cueilleurs, coupes et chariots compatibles multimarques, directement liés à votre conception d\'équipements de récolte.',
      company: 'NARDI HARVESTING',
      event: { nom_event: "Sommet de l'élevage", slug: 'sommet-de-l-elevage', date_debut: '2026-10-06', ville: "Cournon-d'Auvergne" },
    },
  ],
};

const notPast = (i: DemoItem) => !!i.event?.date_debut && getDaysUntilStart(i.event.date_debut) >= 0;

function useDemo(): Demo {
  const { data } = useQuery({
    queryKey: ['assistant-public-demo'],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Demo | null> => {
      const { data, error } = await (supabase as any).rpc('assistant_public_demo');
      if (error) throw error;
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (!parsed) return null;
      const items: DemoItem[] = Array.isArray(parsed.pepites) ? parsed.pepites : [];
      return { profile: parsed.profile ?? { label: null }, items };
    },
  });
  const live = data ? { ...data, items: data.items.filter(notPast) } : null;
  if (live && live.items.length > 0) return live;
  return { ...FALLBACK_DEMO, items: FALLBACK_DEMO.items.filter(notPast) };
}

const shortDate = (iso: string) => {
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleDateString('fr-FR', { month: 'short' });
  return `${day === 1 ? '1er' : day} ${month}`;
};

export function AgendaDemoMock() {
  const demo = useDemo();
  const groups = Object.values(
    demo.items.reduce<Record<string, DemoItem[]>>((acc, it) => {
      (acc[it.event.slug] ??= []).push(it);
      return acc;
    }, {}),
  )
    .sort((a, b) => a[0].event.date_debut.localeCompare(b[0].event.date_debut))
    .slice(0, 2);
  const total = groups.reduce((n, g) => n + g.length, 0);
  const { ref, cls } = useStagger(total + groups.length, 150);
  const firstNovelty = groups.flat().find((i) => i.item_type === 'novelty');
  let idx = 0;

  return (
    <Mock>
      <div ref={ref}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="heading-display text-xl text-foreground">Mon Agenda</p>
            <p className="text-xs text-muted-foreground">
              Exemple réel{demo.profile.label ? ` · ${demo.profile.label}` : ''}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-secondary text-primary px-2.5 py-1 text-xs font-medium">
            {groups.length > 1 ? `${groups.length} salons pour vous` : '1 salon pour vous'}
          </span>
        </div>

        <div className="space-y-4">
          {groups.map((g) => {
            const ev = g[0].event;
            const days = getDaysUntilStart(ev.date_debut);
            const headIdx = idx++;
            return (
              <div key={ev.slug}>
                <div className={cn('rounded-xl bg-surface-inverse text-inverse px-3 py-2.5 flex items-center gap-3', cls(headIdx))}>
                  <span className="text-inverse-primary" aria-hidden>◆</span>
                  <div className="min-w-0 flex-1">
                    <p className="heading-display text-lg font-bold truncate">{ev.nom_event}</p>
                    <p className="text-xs text-inverse-muted">
                      {[ev.ville, shortDate(ev.date_debut)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-inverse/30 px-2 py-0.5 text-xs font-medium">
                    {days === 0 ? "Aujourd'hui" : `J-${days}`}
                  </span>
                </div>
                <div className="ml-4 pl-3.5 border-l-2 border-primary/40">
                  {g.map((it) => {
                    const i = idx++;
                    const isNovelty = it.item_type === 'novelty';
                    return (
                      <div key={it.title} className={cn('rounded-[14px] border border-border bg-background p-3.5 mt-2.5', cls(i))}>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                            isNovelty ? 'bg-secondary text-primary' : 'bg-info/10 text-info',
                          )}
                        >
                          {isNovelty ? 'Stand à voir' : 'Conférence à suivre'}
                        </span>
                        <p className="mt-1.5 font-medium text-foreground leading-snug">{it.title}</p>
                        {isNovelty && it.company && (
                          <p className="text-xs text-muted-foreground">{it.company}</p>
                        )}
                        {it.reason && (
                          <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-[13px] text-foreground/80">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Pourquoi pour vous</p>
                            {it.reason}
                          </div>
                        )}
                        {it === firstNovelty && (
                          <div className="mt-2.5 flex gap-2" aria-hidden>
                            <span className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Garder</span>
                            <span className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground">Pas pour moi</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Mock>
  );
}

/* ================================================================== */
/* Maquettes des blocs solution                                        */
/* ================================================================== */
const Chip = ({ on, children }: { on?: boolean; children: React.ReactNode }) => (
  <span
    className={cn(
      'inline-flex rounded-full border px-2.5 py-1 text-xs font-medium',
      on ? 'bg-secondary border-primary text-primary' : 'border-border text-foreground/70',
    )}
  >
    {children}
  </span>
);

const TopicsMock = () => {
  const { ref, cls } = useStagger(3, 200);
  return (
    <Mock>
      <div ref={ref} className="space-y-4">
        <div className={cls(0)}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Votre rôle</p>
          <div className="flex flex-wrap gap-2">
            <Chip on>Ingénieur</Chip><Chip>Acheteur</Chip><Chip>Dirigeant</Chip><Chip>Autre…</Chip>
          </div>
        </div>
        <div className={cls(1)}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Vos sujets</p>
          <div className="flex flex-wrap gap-2">
            <Chip on>Robotique agricole</Chip><Chip on>Capteurs embarqués</Chip><Chip on>IA embarquée</Chip>
            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/50 px-2.5 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" /> + Proposés par l'IA
            </span>
          </div>
        </div>
        <div className={cls(2)}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Vos régions</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Nouvelle-Aquitaine', true],
              ['Bretagne', false],
              ['Auvergne-Rhône-Alpes', true],
              ['Grand Est', false],
            ].map(([r, on]) => (
              <span
                key={r as string}
                className={cn(
                  'rounded-lg border px-2.5 py-2 text-xs font-medium',
                  on ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground/70',
                )}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Mock>
  );
};

const ReadMock = () => {
  const { ref, cls } = useStagger(4, 220);
  return (
    <Mock>
      <div ref={ref} className="space-y-2.5">
        {[
          ['Programme', 'VINITECH-SIFEL · lu par l\'IA'],
          ['Nouveautés', "Sommet de l'élevage · lues par l'IA"],
        ].map(([k, v], i) => (
          <div
            key={k}
            className={cn('rounded-xl border border-dashed px-3 py-2.5 text-sm', cls(i))}
            style={{ borderColor: 'hsl(var(--primary) / 0.5)', backgroundColor: 'hsl(var(--primary) / 0.06)' }}
          >
            <span className="font-semibold text-primary">{k}</span>{' '}
            <span className="text-foreground/80">{v}</span>
          </div>
        ))}
        <div className={cn('flex justify-center text-primary', cls(2))}>
          <ArrowRight className="h-5 w-5 rotate-90" />
        </div>
        <div className={cn('rounded-[14px] border border-border p-3.5', cls(3))}>
          <span className="inline-flex rounded-full bg-info/10 text-info px-2 py-0.5 text-[11px] font-medium">Conférence à suivre</span>
          <p className="mt-1.5 font-medium text-foreground leading-snug">
            Discussions scientifiques autour de la proxidétection viticole et la fusion de capteurs
          </p>
          <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-[13px] text-foreground/80">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Pourquoi pour vous</p>
            Fusion de capteurs, analyse d'image et limites de l'IA rejoignent vos intérêts sur les capteurs embarqués.
          </div>
        </div>
      </div>
    </Mock>
  );
};

const EventMock = () => {
  const days = getDaysUntilStart('2026-12-01');
  const { ref, cls } = useStagger(2, 200);
  return (
    <Mock>
      <div ref={ref} className="rounded-2xl bg-surface-inverse text-inverse p-5">
        <span className={cn('inline-flex rounded-full bg-inverse-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-surface-inverse', cls(0))}>
          Salon à ne pas manquer
        </span>
        <p className={cn('heading-display mt-3 text-2xl', cls(0))}>VINITECH-SIFEL</p>
        <p className={cn('text-sm text-inverse-muted', cls(0))}>Bordeaux · 1er au 3 déc. 2026</p>
        <div className={cn('mt-5 grid grid-cols-2 gap-4', cls(1))}>
          <div>
            <div className="heading-display text-3xl tabular-nums"><CountUp target={2} /></div>
            <div className="mt-1 text-[11px] uppercase tracking-wide text-inverse-muted">conférences pour vous</div>
          </div>
          <div>
            <div className="heading-display text-3xl tabular-nums">{days <= 0 ? "Aujourd'hui" : `J-${days}`}</div>
            <div className="mt-1 text-[11px] uppercase tracking-wide text-inverse-muted">avant l'ouverture</div>
          </div>
        </div>
      </div>
    </Mock>
  );
};

const LearnMock = () => {
  const { ref, shown, cls } = useStagger(3, 450);
  return (
    <Mock>
      <div ref={ref} className="space-y-3">
        <div className={cn('rounded-[14px] border border-border p-3.5 transition-opacity duration-500', cls(0), shown >= 2 && 'opacity-45')}>
          <span className="inline-flex rounded-full bg-secondary text-primary px-2 py-0.5 text-[11px] font-medium">Stand à voir</span>
          <p className={cn('mt-1.5 font-medium text-foreground', shown >= 2 && 'line-through')}>Logiciel de gestion d'élevage laitier</p>
          <span className="mt-2 inline-flex rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground">
            Pas pour moi {shown >= 2 ? '✓' : ''}
          </span>
        </div>
        <div className={cn('rounded-[14px] border-2 border-primary p-3.5', cls(2))}>
          <span className="inline-flex rounded-full bg-secondary text-primary px-2 py-0.5 text-[11px] font-medium">Nouvelle suggestion</span>
          <p className="mt-1.5 font-medium text-foreground">Guidage autonome des engins en grandes cultures</p>
          <p className="text-xs text-muted-foreground">Plus proche de vos sujets</p>
        </div>
      </div>
    </Mock>
  );
};

const EmailMock = () => {
  const { ref, cls } = useStagger(4, 180);
  return (
    <Mock>
      <div ref={ref} className="space-y-2.5">
        <p className={cn('text-xs text-muted-foreground', cls(0))}>De : Lotexpo</p>
        <p className={cn('font-medium text-foreground', cls(0))}>Votre récap : 2 nouveautés pour vous</p>
        <div className={cn('rounded-lg border border-border px-3 py-2 text-sm', cls(1))}>
          <span className="text-info font-medium">Conférence à suivre</span> · VINITECH-SIFEL
        </div>
        <div className={cn('rounded-lg border border-border px-3 py-2 text-sm', cls(2))}>
          <span className="text-primary font-medium">Stand à voir</span> · Sommet de l'élevage
        </div>
        <span className={cn('inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground', cls(3))} aria-hidden>
          Ouvrir mon agenda
        </span>
      </div>
    </Mock>
  );
};

const SOLUTION_BLOCKS: SolutionBlock[] = [
  {
    actor: 'Vos sujets',
    title: 'Dites ce qui vous intéresse',
    body: (
      <>
        Votre métier, jusqu'à 12 sujets, vos régions sur la carte de France.{' '}
        <strong className="font-semibold text-primary">L'IA vous propose d'autres sujets</strong> si vous le souhaitez.
      </>
    ),
    ecoNote: 'Plusieurs rôles possibles : acheteur, ingénieur, dirigeant, ou votre propre intitulé.',
    visual: <TopicsMock />,
  },
  {
    actor: "L'IA lit tout",
    title: 'Les programmes et les Nouveautés, lus à votre place',
    body: (
      <>
        L'IA parcourt chaque conférence, chaque atelier et chaque Nouveauté d'exposant. Elle ne garde que ce
        qui vous concerne,{' '}
        <strong className="font-semibold text-primary">avec la raison écrite pour vous.</strong>
      </>
    ),
    ecoNote: "Un stand n'est proposé que si l'exposant a annoncé ce qu'il présente. Personne ne paie pour apparaître.",
    visual: <ReadMock />,
  },
  {
    actor: 'Vos prochains salons',
    title: 'Les salons à ne pas manquer',
    body: (
      <>
        Mon Agenda vous signale les salons où se trouvent vos conférences et vos stands.{' '}
        <strong className="font-semibold text-primary">Vous savez avant de partir pourquoi vous y allez.</strong>
      </>
    ),
    ecoNote: 'Un salon ajouté reste dans votre agenda, avec son compte à rebours.',
    visual: <EventMock />,
  },
  {
    actor: 'Il apprend',
    title: "Plus vous l'utilisez, plus il vise juste",
    body: (
      <>
        Chaque élément gardé, chaque « Pas pour moi » affine les suggestions suivantes.{' '}
        <strong className="font-semibold text-primary">Votre agenda devient le vôtre.</strong>
      </>
    ),
    ecoNote: 'Vous pouvez changer vos sujets et vos régions à tout moment.',
    visual: <LearnMock />,
  },
  {
    actor: 'Il vous prévient',
    title: 'Prévenu quand ça vaut le déplacement',
    body: (
      <>
        Une conférence ou un stand pour vous apparaît sur un salon proche ?{' '}
        <strong className="font-semibold text-primary">Vous recevez un email.</strong> Et chaque mardi matin, un
        récap de la semaine.
      </>
    ),
    ecoNote: 'Au plus 2 emails par semaine, jamais d\'email vide. Désinscription en un clic.',
    cta: { label: 'Créer mon agenda', to: ASSISTANT_ONBOARDING_PATH },
    visual: <EmailMock />,
  },
];

const STEPS = [
  {
    icon: Target,
    n: 'Étape 1',
    title: 'Choisissez vos sujets et vos régions',
    text: 'Votre métier, ce qui vous intéresse, où vous êtes prêt à vous déplacer.',
  },
  {
    icon: Sparkles,
    n: 'Étape 2',
    title: "L'IA prépare votre agenda",
    text: 'Elle lit les programmes et les Nouveautés, puis classe ce qui vous concerne.',
  },
  {
    icon: CalendarHeart,
    n: 'Étape 3',
    title: 'Vous gardez ce qui vous intéresse',
    text: 'Un clic pour garder, un clic pour écarter. Les suggestions suivantes s\'ajustent.',
  },
];

const FAQ = [
  {
    q: 'Est-ce gratuit ?',
    a: 'Oui. Mon Agenda est gratuit, sans carte bancaire. Un email ou un compte Google suffit pour le créer.',
  },
  {
    q: "Comment l'IA choisit-elle ?",
    a: "Elle compare vos sujets et vos régions aux programmes publiés par les salons et aux Nouveautés publiées par les exposants. Un stand n'est proposé que si l'exposant a annoncé ce qu'il présente sur ce salon. Personne ne paie pour apparaître dans votre agenda.",
  },
  {
    q: 'Puis-je changer mes sujets ou mes régions ?',
    a: 'Oui, à tout moment depuis votre agenda. Les suggestions suivantes en tiennent compte.',
  },
  {
    q: 'Quelles données gardez-vous ?',
    a: 'Votre email, vos rôles, vos sujets, vos régions et ce que vous gardez ou écartez. Elles servent à préparer votre agenda et vos alertes. Vous pouvez les modifier depuis votre agenda.',
  },
  {
    q: "Allez-vous m'envoyer des emails ?",
    a: "Seulement si vous l'acceptez. La case est proposée à la création de votre agenda et vous pouvez la décocher. Vous recevez alors un récap le mardi matin, et un email en semaine seulement si une conférence ou un stand très proche de vos sujets apparaît sur un salon dans les trois semaines. Jamais plus de 2 emails par semaine, jamais d'email vide. Vous pouvez arrêter en un clic, depuis l'email ou depuis votre agenda.",
  },
];

const TITLE = 'Mon Agenda : votre assistant salons gratuit | Lotexpo';
const DESCRIPTION =
  "Dites ce qui vous intéresse. L'IA de Lotexpo lit les programmes des salons et les Nouveautés des exposants, puis range dans votre agenda les conférences, les stands et les salons qui valent le déplacement. Gratuit.";

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */
export default function AgendaLanding() {
  const { data: stats } = usePublicStats();
  const salons = (stats as any)?.salons as number | undefined;

  const { data: confCount } = useQuery({
    queryKey: ['public-conference-count'],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('public_conference_count');
      if (error) throw error;
      return Number(data) || 0;
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href="https://lotexpo.com/agenda" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content="https://lotexpo.com/agenda" />
        <meta property="og:site_name" content="Lotexpo" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Salons', item: 'https://lotexpo.com' },
              { '@type': 'ListItem', position: 2, name: 'Mon Agenda', item: 'https://lotexpo.com/agenda' },
            ],
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          })}
        </script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* ============================= HÉROS ============================= */}
        <section className="relative overflow-hidden bg-background">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(70% 70% at 70% 45%, hsl(var(--primary) / 0.16), transparent 70%)' }}
          />
          <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] gap-10 lg:gap-14 items-center">
            <Reveal className="text-left min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-background border border-border shadow-sm pl-2 pr-4 py-1.5 text-sm font-semibold text-primary mb-5">
                <span className="rounded-full bg-primary text-primary-foreground text-[0.7rem] font-bold uppercase tracking-wide px-2 py-0.5">
                  Gratuit
                </span>
                Votre assistant salons
              </span>

              <h1 className="heading-display text-[clamp(1.9rem,3.6vw,3.3rem)] text-foreground max-w-[17ch] text-balance">
                Ne cherchez plus vos salons.
                <span className="block text-primary">Ils viennent à vous.</span>
              </h1>

              <p className="mt-5 text-lg md:text-xl text-muted-foreground max-w-[52ch]">
                Dites-nous ce qui vous intéresse. L'IA de Lotexpo lit les programmes des salons et les
                Nouveautés des exposants, puis range dans votre agenda{' '}
                <b className="text-foreground font-semibold">
                  les conférences, les stands et les salons qui valent votre déplacement.
                </b>
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base gap-2 shadow-lg">
                  <Link to={ASSISTANT_ONBOARDING_PATH}>
                    Créer mon agenda
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-xl px-6 text-base">
                  <Link to={SIGNIN_PATH}>J'ai déjà un compte</Link>
                </Button>
              </div>

              <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                {['100 % gratuit', 'Prêt en 2 minutes', 'Aucune veille à faire'].map((t, i) => (
                  <React.Fragment key={t}>
                    {i > 0 && <span aria-hidden>·</span>}
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="h-4 w-4 text-primary" />
                      {t}
                    </span>
                  </React.Fragment>
                ))}
              </p>
            </Reveal>

            <Reveal delay={120} className="min-w-0">
              <AgendaDemoMock />
            </Reveal>
          </div>
        </section>

        {/* ============================= BANDEAU CHIFFRES ============================= */}
        <section className="border-y border-border bg-secondary/40">
          <div className="max-w-5xl mx-auto px-6 py-11 flex flex-col items-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary mb-6 text-center">
              Ce que l'IA fait pour vous
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10 w-full max-w-3xl">
              {[
                { big: <>2 min</>, lbl: 'pour créer votre agenda' },
                { big: salons && salons > 0 ? <CountUp target={salons} /> : <>500+</>, lbl: 'salons professionnels lus par l\'IA' },
                { big: confCount && confCount > 0 ? <CountUp target={confCount} /> : <>1 500+</>, lbl: 'conférences lues par l\'IA dans les programmes' },
              ].map((c, i) => (
                <Reveal
                  key={c.lbl}
                  delay={i * 80}
                  className={`text-center sm:relative ${
                    i < 2
                      ? 'sm:after:content-[""] sm:after:absolute sm:after:-right-5 sm:after:top-[12%] sm:after:h-[76%] sm:after:w-px sm:after:bg-border'
                      : ''
                  }`}
                >
                  <div className="heading-display text-[clamp(2rem,3.4vw,2.9rem)] text-primary leading-none">{c.big}</div>
                  <div className="mt-2.5 text-muted-foreground font-medium leading-snug">{c.lbl}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============================= LE CONSTAT ============================= */}
        <section className="relative overflow-hidden bg-surface-inverse text-inverse py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'url(/home-texture-plexus.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.28,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(80% 60% at 50% 40%, transparent, hsl(var(--surface-inverse) / 0.85))' }}
          />
          <div className="relative max-w-6xl mx-auto px-6">
            <Reveal className="max-w-[760px] mx-auto text-center mb-[60px]">
              <div className="w-[46px] h-[3px] bg-inverse-primary rounded-full mx-auto mb-5" />
              <p className="text-inverse-primary font-bold uppercase tracking-[0.15em] text-xs mb-3">Le constat</p>
              <h2 className="heading-display text-[clamp(2rem,3.7vw,3rem)]">
                Préparer ses salons est devenu un travail à plein temps.
              </h2>
            </Reveal>

            <Reveal className="max-w-5xl mx-auto">
              <div className="flex flex-col md:flex-row items-stretch gap-4 md:gap-0">
                {[
                  { title: 'Des centaines de salons', text: 'Chaque secteur a les siens, chaque région aussi. Impossible de tout suivre.' },
                  { title: 'Des programmes publiés tard, souvent en PDF', text: "La conférence qui vous concerne est à la page 14, quelques semaines avant l'ouverture." },
                  { title: 'Des nouveautés annoncées partout sauf au bon endroit', text: 'Un post LinkedIn, un communiqué, une page produit. Jamais là où vous préparez votre visite.' },
                ].flatMap((c, i, arr) => {
                  const card = (
                    <Reveal
                      key={c.title}
                      delay={i * 80}
                      className="flex-1 rounded-2xl border border-inverse/15 bg-inverse/5 p-6 text-left"
                    >
                      <h3 className="heading-display text-xl mb-2">{c.title}</h3>
                      <p className="text-sm text-inverse-muted leading-relaxed">{c.text}</p>
                    </Reveal>
                  );
                  if (i < arr.length - 1) {
                    return [
                      card,
                      <div key={`${c.title}-arrow`} className="flex items-center justify-center text-inverse/40 px-2 rotate-90 md:rotate-0">
                        <ArrowRight className="h-6 w-6" />
                      </div>,
                    ];
                  }
                  return [card];
                })}
              </div>
            </Reveal>

            <Reveal className="text-center mt-14">
              <div className="heading-display text-[clamp(1.8rem,4vw,3rem)]">
                Résultat : on rate la conférence, le stand ou le salon{' '}
                <span className="text-inverse-primary">qui comptait.</span>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============================= LA SOLUTION ============================= */}
        <section className="bg-background pt-24 pb-10">
          <Reveal className="max-w-[760px] mx-auto px-6 text-center mb-[60px]">
            <div className="w-[46px] h-[3px] bg-primary rounded-full mx-auto mb-5" />
            <p className="text-primary font-bold uppercase tracking-[0.15em] text-xs mb-3">Mon Agenda</p>
            <h2 className="heading-display text-[clamp(2rem,3.7vw,3rem)] text-foreground">
              Lotexpo fait la veille pour vous.
            </h2>
            <p className="mt-4 text-lg text-foreground/70">
              Vous dites ce qui compte. L'IA lit tout, trie, et vous prévient quand ça vaut le déplacement.
            </p>
          </Reveal>

          <div className="flex flex-col">
            {SOLUTION_BLOCKS.map((b, i) => (
              <SolutionRow key={b.title} block={b} reversed={i % 2 === 1} muted={i % 2 === 0} />
            ))}
          </div>
        </section>

        {/* ============================= ÉTAPES ============================= */}
        <section className="bg-background border-t border-border">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <Reveal className="max-w-[640px] mx-auto text-center mb-14">
              <div className="w-[46px] h-[3px] bg-primary rounded-full mx-auto mb-5" />
              <h2 className="heading-display text-[clamp(1.8rem,3vw,2.6rem)] text-foreground">
                Trois étapes, deux minutes
              </h2>
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 90}>
                  <div className="h-full rounded-2xl border border-border bg-background p-7 transition-colors hover:border-primary/40">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
                      <s.icon className="h-6 w-6" />
                    </div>
                    <p className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">{s.n}</p>
                    <h3 className="heading-display text-xl text-foreground mb-2.5">{s.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal className="mt-12 text-center">
              <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base gap-2">
                <Link to={ASSISTANT_ONBOARDING_PATH}>
                  <CalendarHeart className="h-5 w-5" />
                  Créer mon agenda
                </Link>
              </Button>
            </Reveal>
          </div>
        </section>

        {/* ============================= FAQ ============================= */}
        <section className="bg-background">
          <div className="max-w-3xl mx-auto px-6 py-20">
            <Reveal className="text-center mb-12">
              <div className="w-[46px] h-[3px] bg-primary rounded-full mx-auto mb-5" />
              <h2 className="heading-display text-[clamp(1.8rem,3vw,2.6rem)] text-foreground">Questions fréquentes</h2>
            </Reveal>
            <Reveal>
              <Accordion type="single" collapsible className="space-y-4">
                {FAQ.map((f, i) => (
                  <AccordionItem key={f.q} value={`faq-${i}`} className="rounded-xl border px-6">
                    <AccordionTrigger className="text-left hover:no-underline">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </div>
        </section>

        {/* ============================= CTA FINAL ============================= */}
        <section
          className="relative overflow-hidden text-primary-foreground text-center py-24"
          style={{ background: 'linear-gradient(160deg, hsl(var(--primary)), hsl(218 95% 14%))' }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'url(/home-texture-final.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.3,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(60% 70% at 50% 50%, hsl(var(--primary) / 0.55), hsl(218 95% 14% / 0.9))' }}
          />
          <Reveal className="relative z-10 max-w-3xl mx-auto px-6">
            <h2 className="heading-display text-[clamp(2rem,3.7vw,3rem)]">
              Votre prochain bon salon est déjà quelque part. Laissez l'IA le trouver.
            </h2>
            <p className="mt-4 text-lg text-primary-foreground/80 max-w-[52ch] mx-auto">
              Deux minutes pour dire ce qui compte. Ensuite, Lotexpo fait la veille pour vous.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Button asChild className="h-12 rounded-xl bg-background px-6 text-base text-primary hover:bg-background/90">
                <Link to={ASSISTANT_ONBOARDING_PATH}>
                  Créer mon agenda
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-xl border-primary-foreground/40 bg-transparent px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link to={SIGNIN_PATH}>J'ai déjà un compte</Link>
              </Button>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
