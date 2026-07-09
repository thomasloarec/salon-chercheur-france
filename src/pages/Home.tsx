import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search, ArrowRight, Sparkles, Users, Store, Building2, Info,
  RefreshCw, Route, Radar, Rocket, Eye, MapPin, CalendarDays,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import EventCard from '@/components/EventCard';
import { usePublicStats } from '@/hooks/usePublicStats';
import { useUpcomingEvents } from '@/hooks/useUpcomingEvents';

/* ================================================================== */
/* Utils : reduced motion, in-view, typewriter, count-up               */
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
        if (e.isIntersecting) { setInView(true); obs.disconnect(); }
      },
      { threshold }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

const HERO_QUERIES = [
  "Je cherche des fournisseurs d'emballage écoresponsable…",
  'Où exposent mes concurrents en cosmétique bio ?',
  'Sur quel salon rencontrer des directeurs achats agro ?',
  'Quels salons couvrent déjà le marché de la foodtech ?',
];

function useTypewriter(queries: string[], active: boolean) {
  const reduced = usePrefersReducedMotion();
  const [text, setText] = useState(queries[0]);
  useEffect(() => {
    if (!active || reduced) { setText(queries[0]); return; }
    let qi = 0, ci = 0, del = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const f = queries[qi];
      if (!del) {
        ci++;
        setText(f.slice(0, ci));
        if (ci === f.length) { del = true; timer = setTimeout(tick, 1500); return; }
        timer = setTimeout(tick, 52);
      } else {
        ci--;
        setText(f.slice(0, ci));
        if (ci === 0) { del = false; qi = (qi + 1) % queries.length; timer = setTimeout(tick, 260); return; }
        timer = setTimeout(tick, 26);
      }
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [active, reduced, queries]);
  return text;
}

const floorTo = (n: number, step: number) => Math.floor(n / step) * step;
const frThousands = (n: number) => n.toLocaleString('fr-FR');

const LOOP_CARDS = [
  { icon: Users, title: 'Les visiteurs', text: "Perdus dans une offre illisible, ils ne savent plus quel salon mérite le déplacement. Alors ils viennent moins." },
  { icon: Store, title: 'Les exposants', text: "Engager des milliers d'euros sans certitude de rencontrer leur public devient trop risqué. Alors ils investissent moins." },
  { icon: Building2, title: 'Les salons', text: "Moins de visiteurs qualifiés, moins d'exposants engagés : la promesse de faire se rencontrer un écosystème ne tient plus." },
];

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

/* Révélation au scroll */
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.14);
  const shown = reduced || inView;
  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}
      className={`transition-all duration-700 ease-out ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
    >
      {children}
    </div>
  );
}

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */
const Home = () => {
  const navigate = useNavigate();
  const { data: stats } = usePublicStats();
  const { data: upcoming, isLoading: upcomingLoading } = useUpcomingEvents(8);

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const placeholder = useTypewriter(HERO_QUERIES, !focused && query.length === 0);

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const value = query.trim();
    if (!value) return;
    navigate(`/recherche-ia?q=${encodeURIComponent(value)}`);
  };

  const salonsTarget = stats ? floorTo(stats.salons, 50) : 0;
  const exposantsTarget = stats ? floorTo(stats.exposants, 1000) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Salons professionnels en France, lus par l'IA | Lotexpo</title>
        <meta
          name="description"
          content="L'information sur les salons est partout, donc introuvable. L'IA de Lotexpo lit tout — salons, exposants, secteurs — et vous donne la réponse qui compte."
        />
        <link rel="canonical" href="https://lotexpo.com/" />
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* ============================= HERO ============================= */}
        <section className="relative overflow-hidden text-center py-20 md:py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background:
                'radial-gradient(60% 55% at 50% 0%, hsl(var(--secondary) / 0.75) 0%, hsl(var(--secondary) / 0) 62%), radial-gradient(38% 40% at 84% 8%, hsl(var(--accent) / 0.10) 0%, hsl(var(--accent) / 0) 70%)',
            }}
          />
          <div className="relative z-10 max-w-5xl mx-auto px-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-background border border-border shadow-sm pl-2 pr-4 py-1.5 text-sm font-semibold text-primary mb-7">
              <span className="rounded-full bg-primary text-primary-foreground text-[0.7rem] font-bold uppercase tracking-wide px-2 py-0.5">
                Nouveau
              </span>
              Les salons professionnels, lus par l'IA
            </span>

            <h1 className="heading-display text-[clamp(2.5rem,5.4vw,4.4rem)] text-primary max-w-[17ch] mx-auto">
              Le bon salon.
              <span className="block text-accent">Les bonnes rencontres.</span>
            </h1>

            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-[56ch] mx-auto">
              L'information sur les salons est{' '}
              <b className="text-foreground font-semibold">partout, donc introuvable.</b>{' '}
              L'IA de Lotexpo lit tout (salons, exposants, secteurs) et vous donne la réponse qui compte.
            </p>

            {/* Searchbar */}
            <form onSubmit={submitSearch} className="max-w-[680px] mx-auto mt-9">
              <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-border bg-background shadow-lg pl-5 pr-2 py-2 focus-within:border-accent transition-colors">
                <Search className="h-5 w-5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder={placeholder}
                  aria-label="Décrivez votre besoin"
                  className="flex-1 min-w-0 bg-transparent border-0 outline-none text-foreground placeholder:text-foreground/70 text-base py-2.5"
                />
                <Button
                  type="submit"
                  className="shrink-0 bg-accent text-accent-foreground hover:bg-accent/90 h-11 px-4 rounded-xl"
                >
                  <Sparkles className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Chercher avec l'IA</span>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-3.5 text-left px-0.5">
                Acheteur, exposant, commercial ou organisateur, posez votre question comme à un humain.
              </p>
            </form>

            <div className="flex items-center justify-center gap-4 mt-6 flex-wrap">
              <span className="text-sm text-muted-foreground">ou</span>
              <Link to="/salons">
                <Button variant="outline" className="rounded-xl">
                  Voir tous les salons
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ============================= COUNTERS ============================= */}
        <section className="border-y border-border bg-secondary/40">
          <div className="max-w-5xl mx-auto px-6 py-11 flex flex-col items-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent mb-6 text-center">
              L'échelle qu'aucun humain ne peut lire à la main
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10 w-full max-w-3xl">
              {[
                { node: <CountUp target={salonsTarget} />, lbl: 'salons professionnels indexés' },
                { node: <CountUp target={exposantsTarget} />, lbl: 'fiches exposants lues et structurées par l\u2019IA' },
                { node: <span className="text-2xl md:text-3xl">France entière</span>, lbl: 'tous secteurs confondus' },
              ].map((c, i) => (
                <div
                  key={i}
                  className={`text-center sm:relative ${i < 2 ? 'sm:after:content-[""] sm:after:absolute sm:after:-right-5 sm:after:top-[12%] sm:after:h-[76%] sm:after:w-px sm:after:bg-border' : ''}`}
                >
                  <div className="heading-display text-[clamp(2rem,3.4vw,2.9rem)] text-primary leading-none">
                    {c.node}
                  </div>
                  <div className="mt-2.5 text-muted-foreground font-medium leading-snug">{c.lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================= PROBLEM ============================= */}
        <section className="relative overflow-hidden bg-primary text-primary-foreground py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(50% 45% at 80% 0%, hsl(var(--accent) / 0.14), transparent 60%), radial-gradient(45% 40% at 10% 100%, hsl(var(--accent) / 0.08), transparent 60%)',
            }}
          />
          <div className="relative max-w-6xl mx-auto px-6">
            <Reveal className="max-w-[760px] mx-auto text-center mb-14">
              <div className="w-11 h-[3px] bg-accent rounded-full mx-auto mb-5" />
              <p className="text-accent font-bold uppercase tracking-[0.15em] text-xs mb-3">Le constat</p>
              <h2 className="heading-display text-[clamp(2rem,3.7vw,3rem)]">
                Un cercle vicieux menaçait tout l'écosystème
              </h2>
              <p className="mt-4 text-lg text-primary-foreground/75 max-w-[60ch] mx-auto">
                Le salon professionnel repose sur une promesse simple : réunir un marché entier au même
                endroit. Cette promesse était en train de se gripper.
              </p>
            </Reveal>

            <Reveal className="max-w-5xl mx-auto">
              <div className="flex flex-col md:flex-row items-stretch gap-4 md:gap-0">
                {LOOP_CARDS.flatMap((c, i) => {
                  const card = (
                    <div key={c.title} className="flex-1 rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-6 text-left">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent/20 text-accent mb-4">
                        <c.icon className="h-5 w-5" />
                      </div>
                      <h3 className="heading-display text-xl mb-2">{c.title}</h3>
                      <p className="text-sm text-primary-foreground/70 leading-relaxed">{c.text}</p>
                    </div>
                  );
                  if (i < LOOP_CARDS.length - 1) {
                    return [
                      card,
                      <div key={`${c.title}-arrow`} className="flex items-center justify-center text-primary-foreground/40 px-2 rotate-90 md:rotate-0">
                        <ArrowRight className="h-6 w-6" />
                      </div>,
                    ];
                  }
                  return [card];
                })}
              </div>
            </Reveal>

            <Reveal className="text-center mt-8">
              <p className="text-primary-foreground/60">
                <span className="text-accent font-semibold">↺</span> Moins de visiteurs → moins
                d'exposants → salons affaiblis → moins de visiteurs.{' '}
                <b className="text-accent font-semibold">Le cercle se referme.</b>
              </p>
            </Reveal>

            <Reveal className="text-center mt-14">
              <div className="heading-display text-[clamp(2rem,4.4vw,3.4rem)]">
                Un écosystème <em className="not-italic text-accent italic">en danger.</em>
              </div>
              <p className="mt-6 text-lg text-primary-foreground/85">
                Mais il existe une issue. Et c'est{' '}
                <b className="font-bold">l'IA qui la débloque.</b>
              </p>
            </Reveal>
          </div>
        </section>

        {/* ============================= SOLUTION ============================= */}
        <section className="bg-background pt-24 pb-10">
          <Reveal className="max-w-[760px] mx-auto px-6 text-center mb-14">
            <div className="w-11 h-[3px] bg-accent rounded-full mx-auto mb-5" />
            <p className="text-accent font-bold uppercase tracking-[0.15em] text-xs mb-3">La solution</p>
            <h2 className="heading-display text-[clamp(2rem,3.7vw,3rem)] text-primary">
              Rendre le marché lisible. Pour tout le monde.
            </h2>
            <p className="mt-4 text-lg text-foreground/70">
              Lotexpo lit l'intégralité de l'écosystème, chaque salon, chaque exposant, chaque secteur,
              pour transformer ce chaos en information actionnable.{' '}
              <b className="text-primary font-semibold">
                Le même moteur sert le visiteur, l'exposant, le commercial et l'organisateur.
              </b>
            </p>
          </Reveal>

          <div className="flex flex-col">
            {SOLUTION_BLOCKS.map((b, i) => (
              <SolutionRow key={b.title} block={b} reversed={i % 2 === 1} />
            ))}
          </div>
        </section>

        {/* ============================= PROCHAINS SALONS ============================= */}
        <section className="bg-secondary/30 border-t border-border">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="flex items-end justify-between gap-4 mb-10">
              <div>
                <div className="section-rule" />
                <h2 className="heading-display text-[clamp(1.8rem,3vw,2.6rem)] text-primary">
                  Prochains salons
                </h2>
              </div>
              <Link to="/salons" className="hidden sm:block">
                <Button variant="outline">
                  Voir tous les salons
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {upcomingLoading ? (
              <div className="grid gap-6 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 justify-items-center">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-full max-w-[272px] rounded-2xl bg-background p-4 animate-pulse">
                    <div className="h-44 bg-muted rounded-lg mb-4" />
                    <div className="h-4 bg-muted rounded mb-2" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : upcoming && upcoming.length > 0 ? (
              <div className="grid gap-6 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 justify-items-center">
                {upcoming.map((event) => (
                  <EventCard key={event.id} event={event} view="grid" />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Aucun salon à venir pour le moment.</p>
            )}

            <div className="text-center mt-10 sm:hidden">
              <Link to="/salons">
                <Button variant="outline">
                  Voir tous les salons
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ============================= FINAL CTA ============================= */}
        <section
          className="text-primary-foreground text-center py-24"
          style={{ background: 'linear-gradient(160deg, hsl(var(--primary)), hsl(218 95% 14%))' }}
        >
          <Reveal className="max-w-3xl mx-auto px-6">
            <h2 className="heading-display text-[clamp(2rem,3.7vw,3rem)]">Le salon redevient lisible.</h2>
            <p className="mt-4 text-lg text-primary-foreground/80 max-w-[52ch] mx-auto">
              Trouvez le vôtre, préparez-le, faites-le rayonner, quel que soit votre rôle dans
              l'écosystème.
            </p>
            <div className="mt-9 flex items-center justify-center gap-4 flex-wrap">
              <Link to="/recherche-ia">
                <Button className="bg-background text-primary hover:bg-background/90 h-12 px-6 text-base rounded-xl">
                  Essayer la recherche IA
                  <Sparkles className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <span className="text-primary-foreground/60 text-sm">ou</span>
              <Link to="/salons">
                <Button
                  variant="outline"
                  className="h-12 px-6 text-base rounded-xl border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  Voir tous les salons
                </Button>
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
};

/* ================================================================== */
/* Solution blocks                                                     */
/* ================================================================== */
interface SolutionBlock {
  actor: string;
  title: string;
  body: React.ReactNode;
  ecoNote: string;
  cta?: { label: string; to: string };
  visual: React.ReactNode;
}

const SolutionRow = ({ block, reversed }: { block: SolutionBlock; reversed: boolean }) => (
  <Reveal className="w-full">
    <div className="max-w-[1180px] mx-auto px-6 md:px-7 py-14 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
      <div className={reversed ? 'md:order-2' : ''}>
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary text-primary font-bold text-[0.78rem] uppercase tracking-[0.06em] px-3.5 py-1.5 mb-4">
          {block.actor}
        </span>
        <h3 className="heading-display text-[clamp(1.7rem,3vw,2.4rem)] text-primary max-w-[15ch]">
          {block.title}
        </h3>
        <p className="mt-4 text-lg text-foreground/70 max-w-[44ch]">{block.body}</p>
        <div className="mt-5 flex gap-3 items-start bg-secondary/40 border-l-[3px] border-accent rounded-r-xl px-4 py-3 max-w-[46ch]">
          <Info className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/75">{block.ecoNote}</p>
        </div>
        {block.cta && (
          <Link
            to={block.cta.to}
            className="group mt-6 inline-flex items-center gap-2 text-primary font-bold hover:text-accent transition-colors"
          >
            {block.cta.label}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </div>
      <div className={reversed ? 'md:order-1' : ''}>{block.visual}</div>
    </div>
  </Reveal>
);

/* Cadre mock générique */
const Mock = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-[20px] border border-border bg-background shadow-[0_12px_34px_-14px_hsl(var(--primary)/0.22)] p-5 ${className}`}>
    {children}
  </div>
);

/* ---- Block 1 : recherche ---- */
const SearchMock = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const results = [
    { name: 'SIRHA', pct: 92, meta: 'Restauration & hôtellerie · 23-27 janv. · Lyon', tag: '142 exposants correspondent' },
    { name: 'Food Hotel Tech', pct: 84, meta: 'Tech & digital pour la restauration · 10-11 mars · Paris', tag: '47 exposants correspondent' },
    { name: 'Sandwich & Snack Show', pct: 78, meta: 'Restauration rapide & nomade · 19-20 mai · Paris', tag: '63 exposants correspondent' },
  ];
  return (
    <Mock>
      <div ref={ref}>
        <div className="flex items-center gap-3 bg-secondary/40 border border-secondary rounded-xl px-4 py-3 mb-4">
          <Search className="h-4 w-4 text-accent shrink-0" />
          <span className="text-sm text-foreground truncate">
            Je vends des logiciels de caisse pour restaurants
          </span>
        </div>
        <p className="text-xs font-semibold text-muted-foreground mb-3.5 px-1">
          <b className="text-primary">3 salons</b> correspondent à votre activité
        </p>
        <div className="space-y-3">
          {results.map((r, i) => (
            <div
              key={r.name}
              style={{ transitionDelay: `${260 + i * 200}ms` }}
              className={`rounded-2xl border border-border bg-background px-4 py-3.5 transition-all duration-500 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
            >
              <div className="flex justify-between items-baseline gap-3">
                <span className="font-bold text-primary">{r.name}</span>
                <span className="font-bold text-sm text-accent shrink-0">{r.pct}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{r.meta}</p>
              <div className="h-1.5 bg-muted/60 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent/70 to-accent transition-[width] duration-[1100ms] ease-out"
                  style={{ width: inView ? `${r.pct}%` : '0%', transitionDelay: `${400 + i * 200}ms` }}
                />
              </div>
              <span className="inline-flex items-center mt-3 text-xs font-semibold text-primary bg-secondary rounded-full px-2.5 py-1">
                {r.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Mock>
  );
};

/* ---- Block 2 : parcours ---- */
const ParcoursMock = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const items = [
    { n: 1, name: 'Adoria', loc: 'Hall 3 · Stand C12', obj: 'Innovation', cls: 'bg-accent/15 text-accent' },
    { n: 2, name: 'Inpulse', loc: 'Hall 3 · Stand C40', obj: 'Innovation', cls: 'bg-accent/15 text-accent' },
    { n: 3, name: 'SwiftPay', loc: 'Hall 5 · Stand E08', obj: 'Paiement', cls: 'bg-blue-50 text-blue-700' },
    { n: 4, name: 'BioNature', loc: 'Hall 1 · Stand A22', obj: 'Bio', cls: 'bg-emerald-50 text-emerald-700' },
  ];
  return (
    <Mock>
      <div ref={ref}>
        <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-border">
          <span className="font-bold text-primary">Votre parcours · SIRHA</span>
          <span className="text-xs font-bold text-accent-foreground bg-accent rounded-full px-2.5 py-1 whitespace-nowrap">
            3 200 exposants
          </span>
        </div>
        <div className="flex flex-wrap gap-2 items-center mt-3.5">
          <span className="text-[0.72rem] uppercase tracking-wide font-bold text-muted-foreground">Objectifs</span>
          {['Voir les innovations', 'Solutions de paiement', 'Fournisseurs bio'].map((g) => (
            <span key={g} className="text-xs font-semibold text-primary bg-secondary/50 border border-secondary rounded-full px-2.5 py-1">
              {g}
            </span>
          ))}
        </div>
        <div className="mt-2">
          {items.map((it, i) => (
            <div
              key={it.name}
              style={{ transitionDelay: `${150 + i * 180}ms` }}
              className={`flex gap-3 items-center py-2.5 border-t border-border transition-all duration-500 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {it.n}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-primary text-sm">{it.name}</div>
                <div className="text-xs text-muted-foreground">{it.loc}</div>
              </div>
              <span className={`text-[0.73rem] font-bold px-2 py-1 rounded-md ${it.cls}`}>{it.obj}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
          <Route className="h-4 w-4 text-accent shrink-0" />
          Itinéraire regroupé par hall, vous ne revenez jamais sur vos pas.
        </div>
      </div>
    </Mock>
  );
};

/* ---- Block 3 : radar CRM ---- */
const RadarMock = () => (
  <Mock>
    <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-border mb-1">
      <span className="font-bold text-primary">Votre mission · SIRHA 2026</span>
      <span className="text-xs font-bold text-primary-foreground bg-primary rounded-full px-2.5 py-1">12 comptes</span>
    </div>
    <div className="bg-secondary/40 rounded-xl px-3.5 py-3 my-3.5 text-sm text-primary">
      <b>12 entreprises de votre CRM</b> exposent sur ce salon. Voici par quoi commencer.
    </div>
    <div className="rounded-xl border border-border p-3.5 mb-3">
      <div className="flex justify-between items-center gap-2.5 mb-0.5">
        <span className="font-bold text-primary">Adoria</span>
        <span className="text-[0.72rem] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Client · renouvellement</span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">Contrat à échéance dans 4 mois, sécuriser le renouvellement.</p>
      <ul className="space-y-1">
        {['Où en est la roadmap module stocks 2026 ?', 'Le passage multi-sites est-il à l\u2019ordre du jour ?', 'Qui décide du budget cette année ?'].map((q, i) => (
          <li key={i} className="flex gap-2 text-xs text-foreground">
            <span className="text-accent font-bold shrink-0">{i + 1}.</span>
            {q}
          </li>
        ))}
      </ul>
    </div>
    {[
      { name: 'Inpulse', chip: 'Prospect chaud', cls: 'bg-accent/15 text-accent', why: 'A ouvert vos 3 derniers emails, relance de vive voix.' },
      { name: 'HUBENCY', chip: 'À qualifier', cls: 'bg-muted text-muted-foreground', why: 'Nouveau sur votre marché, premier contact.' },
    ].map((s) => (
      <div key={s.name} className="rounded-xl border border-border p-3.5 mb-3 opacity-60">
        <div className="flex justify-between items-center gap-2.5">
          <span className="font-bold text-primary">{s.name}</span>
          <span className={`text-[0.72rem] font-bold px-2 py-1 rounded-full ${s.cls}`}>{s.chip}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{s.why}</p>
      </div>
    ))}
  </Mock>
);

/* ---- Block 4 : nouveautés ---- */
const NoveltyMock = () => (
  <Mock className="max-w-[420px] mx-auto relative">
    <span className="absolute top-3.5 left-3.5 z-10 bg-accent text-accent-foreground text-[0.72rem] font-bold uppercase tracking-wide px-3 py-1 rounded-full shadow-md">
      Nouveauté
    </span>
    <div
      className="h-[150px] rounded-xl flex items-center justify-center text-accent mb-4 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, hsl(var(--accent) / 0.25), hsl(var(--secondary)))' }}
    >
      <Rocket className="h-12 w-12 opacity-50" />
    </div>
    <div className="flex items-center gap-2.5 mb-2.5">
      <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-extrabold text-sm">A</div>
      <div>
        <div className="font-bold text-primary text-sm leading-tight">Adoria</div>
        <div className="text-xs text-muted-foreground">présentée à Food Hotel Tech</div>
      </div>
    </div>
    <div className="font-bold text-foreground mb-3">Borne de commande autonome nouvelle génération</div>
    <div className="flex flex-wrap gap-2 mb-3.5">
      {['Démo live sur stand', '-30% temps de commande', 'Intégration caisse native'].map((c) => (
        <span key={c} className="text-xs font-semibold text-primary bg-secondary/40 border border-secondary rounded-full px-2.5 py-1">
          {c}
        </span>
      ))}
    </div>
    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 border-t border-border pt-3">
      <Eye className="h-4 w-4" />
      Repérée par 34 visiteurs · 8 prévoient de passer
    </div>
  </Mock>
);

/* ---- Block 5 : moteur / structuration ---- */
const StructMock = () => (
  <Mock>
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
      <div className="flex-1 rounded-xl border border-border p-4">
        <div className="text-[0.72rem] font-bold uppercase tracking-wide text-muted-foreground mb-2.5">Fiche brute</div>
        <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed font-mono">
          « Ns proposons sol. digitales p/ restau : caisse tactile, cmd table, paiement… + de 200 clients franchisés en FR &amp; BENELUX. »
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-1 text-accent text-[0.7rem] font-bold shrink-0">
        <ArrowRight className="h-6 w-6 rotate-90 sm:rotate-0" />
        <span className="whitespace-nowrap">L'IA lit</span>
      </div>
      <div className="flex-1 rounded-xl border border-border p-4">
        <div className="text-[0.72rem] font-bold uppercase tracking-wide text-muted-foreground mb-2.5">Fiche structurée</div>
        {[
          { k: 'Secteur', tags: ['Restauration tech'] },
          { k: 'Produits', tags: ['Caisse', 'Commande', 'Paiement'] },
          { k: 'Cible', tags: ['Franchises', 'Restaurateurs'] },
        ].map((f) => (
          <div key={f.k} className="mb-3 last:mb-0">
            <div className="text-[0.72rem] font-bold uppercase tracking-wide text-primary mb-1.5">{f.k}</div>
            <div className="flex flex-wrap gap-1.5">
              {f.tags.map((t) => (
                <span key={t} className="text-xs font-semibold text-primary bg-secondary rounded-md px-2.5 py-1">{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </Mock>
);

const SOLUTION_BLOCKS: SolutionBlock[] = [
  {
    actor: 'Pour les visiteurs & acheteurs',
    title: "Le bon salon, même celui auquel vous n'auriez jamais pensé",
    body: (
      <>
        Décrivez votre besoin en une phrase. L'IA a lu tous les salons et tous les exposants, et fait
        remonter ceux où se trouve vraiment votre marché,{' '}
        <strong className="text-primary font-semibold">classés par pertinence réelle.</strong>
      </>
    ),
    ecoNote:
      'Côté exposants et organisateurs : être enfin trouvé par les bonnes personnes, sans se battre pour le référencement.',
    cta: { label: 'Essayer la recherche IA', to: '/recherche-ia' },
    visual: <SearchMock />,
  },
  {
    actor: 'Pour les visiteurs · le jour J',
    title: 'Ne tournez plus en rond dans les allées',
    body: (
      <>
        Indiquez vos objectifs : voir les innovations, sourcer un produit précis, rencontrer un profil.
        L'IA établit votre <strong className="text-primary font-semibold">liste d'exposants prioritaires</strong>{' '}
        et l'ordonne stand par stand. Sur un salon de plusieurs milliers d'exposants, vous savez
        exactement où aller, et à qui parler.
      </>
    ),
    ecoNote:
      "Même sur un salon géant, chaque exposant pertinent est vu, et chaque visite devient une vraie rencontre, pas un hasard d'allée.",
    cta: { label: 'Générer mon parcours', to: '/recherche-ia' },
    visual: <ParcoursMock />,
  },
  {
    actor: 'Pour les commerciaux',
    title: 'Arrivez avec un plan de visite, pas une liste de stands',
    body: (
      <>
        Croisez votre fichier clients avec les exposants d'un salon. L'IA génère votre mission :{' '}
        <strong className="text-primary font-semibold">qui rencontrer, pourquoi, et les 3 questions à poser</strong>{' '}
        sur chaque stand.
      </>
    ),
    ecoNote:
      'Un visiteur préparé, c\u2019est un visiteur qui achète, exactement la valeur qui fait vivre exposants et salons.',
    cta: { label: 'Découvrir Radar CRM', to: '/radar-crm' },
    visual: <RadarMock />,
  },
  {
    actor: 'Pour les exposants',
    title: "Soyez découvert avant même l'ouverture des portes",
    body: (
      <>
        Publiez vos nouveautés : un lancement, une innovation, une démo.{' '}
        <strong className="text-primary font-semibold">L'IA les fait remonter aux visiteurs concernés</strong>,
        qui planifient leur passage sur votre stand. Votre visibilité commence des semaines avant le salon.
      </>
    ),
    ecoNote:
      'Pour les visiteurs : savoir quoi voir et pourquoi. Pour les salons : un contenu vivant qui donne envie de venir.',
    cta: { label: 'Publier une nouveauté', to: '/publier-nouveaute' },
    visual: <NoveltyMock />,
  },
  {
    actor: 'Le moteur',
    title: 'Des milliers de fiches, lues et remises au clair, en continu',
    body: (
      <>
        En coulisses, l'IA lit et structure sans relâche les fiches exposants : descriptions, produits,
        secteurs.{' '}
        <strong className="text-primary font-semibold">C'est ce travail invisible qui rend chaque recherche juste</strong>,
        et que personne ne pourrait faire à la main.
      </>
    ),
    ecoNote:
      'La fondation invisible qui fait tenir tout le reste, et le fossé qui se creuse fiche après fiche.',
    visual: <StructMock />,
  },
];

export default Home;