import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowDown, Users, Store, Building2, Info, Rocket, Check,
  CalendarHeart, CalendarClock, Megaphone, ExternalLink,
} from 'lucide-react';
import { ASSISTANT_ONBOARDING_PATH } from '@/components/assistant/config';
import { AgendaDemoMock } from '@/components/assistant/AgendaLanding';
import { cn } from '@/lib/utils';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import EventCard from '@/components/EventCard';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
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
  const { data: stats } = usePublicStats();
  const { data: upcoming, isLoading: upcomingLoading } = useUpcomingEvents(10);

  const salonsTarget = stats ? floorTo(stats.salons, 50) : 0;
  const exposantsTarget = stats ? floorTo(stats.exposants, 1000) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Salons professionnels en France, lus par l'IA | Lotexpo</title>
        <meta
          name="description"
          content="L'information sur les salons est partout, donc introuvable. Créez votre agenda gratuit : l'IA de Lotexpo vous signale les salons, les conférences et les stands qui comptent pour vous."
        />
        <link rel="canonical" href="https://lotexpo.com/" />
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* ============================= HERO ============================= */}
        <section className="relative overflow-hidden">
          {/* IMAGE calée à droite, fondue sur son bord gauche */}
          <div aria-hidden className="absolute inset-y-0 right-0 z-0 hidden lg:block w-[64%]">
            <img
              src="/home-texture-wave.jpg"
              alt=""
              className="w-full h-full object-cover object-center"
              style={{
                maskImage: 'linear-gradient(90deg, transparent 0%, transparent 18%, black 42%)',
                WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, transparent 18%, black 42%)',
              }}
            />
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 lg:min-h-[calc(100vh-64px)] lg:py-0 flex flex-col justify-center">
            <Reveal className="text-left max-w-[540px]">
              <span className="inline-flex items-center gap-2 rounded-full bg-background border border-border shadow-sm pl-2 pr-4 py-1.5 text-sm font-semibold text-primary mb-5">
                <span className="rounded-full bg-primary text-primary-foreground text-[0.7rem] font-bold uppercase tracking-wide px-2 py-0.5">
                  Gratuit
                </span>
                Votre assistant salons
              </span>

              <h1 className="heading-display text-[clamp(1.9rem,3.6vw,3.3rem)] text-foreground max-w-[16ch] text-balance">
                Toutes les opportunités des salons professionnels,
                <span className="block text-primary">révélées par l'IA.</span>
              </h1>

              <p className="mt-5 text-lg md:text-xl text-muted-foreground max-w-[56ch]">
                L'information sur les salons est{' '}
                <b className="text-foreground font-semibold">partout, donc introuvable.</b>{' '}
                Créez votre compte et dites ce qui vous intéresse : l'IA de Lotexpo lit les salons, leurs
                programmes et les Nouveautés des exposants, et vous signale les conférences, les stands et les
                salons à ne pas manquer.{' '}
                <b className="text-foreground font-semibold">Plus besoin de faire votre veille.</b>
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base gap-2 shadow-lg">
                  <Link to={ASSISTANT_ONBOARDING_PATH}>
                    <CalendarHeart className="h-5 w-5" />
                    Créer mon agenda
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-xl px-6 text-base">
                  <Link to="/salons">Voir tous les salons</Link>
                </Button>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                {['100 % gratuit', 'Prêt en 2 minutes', 'Aucune veille à faire'].map((m, i) => (
                  <React.Fragment key={m}>
                    {i > 0 && <span aria-hidden>·</span>}
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="h-4 w-4 text-primary" />
                      {m}
                    </span>
                  </React.Fragment>
                ))}
              </div>

              <p className="mt-4 text-sm">
                <span className="text-muted-foreground">Vous cherchez quelque chose de précis ? </span>
                <Link to="/recherche-ia" className="inline-flex items-center gap-1 font-semibold text-primary">
                  Posez votre question à l'IA
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </p>
            </Reveal>
          </div>
        </section>

        {/* ============================= COUNTERS ============================= */}
        <section className="border-y border-border bg-secondary/40">
          <div className="max-w-5xl mx-auto px-6 py-11 flex flex-col items-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary mb-6 text-center">
              L'échelle qu'aucun humain ne peut lire à la main
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10 w-full max-w-3xl">
              {[
                { node: <CountUp target={salonsTarget} />, lbl: 'salons professionnels indexés' },
                { node: <CountUp target={exposantsTarget} />, lbl: 'fiches exposants lues et structurées par l\u2019IA' },
                { node: <span className="text-2xl md:text-3xl">France entière</span>, lbl: 'tous secteurs confondus' },
              ].map((c, i) => (
                <Reveal
                  key={i}
                  delay={i * 80}
                  className={`text-center sm:relative ${i < 2 ? 'sm:after:content-[""] sm:after:absolute sm:after:-right-5 sm:after:top-[12%] sm:after:h-[76%] sm:after:w-px sm:after:bg-border' : ''}`}
                >
                  <div className="heading-display text-[clamp(2rem,3.4vw,2.9rem)] text-primary leading-none">
                    {c.node}
                  </div>
                  <div className="mt-2.5 text-muted-foreground font-medium leading-snug">{c.lbl}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============================= PROBLEM ============================= */}
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
                    <Reveal key={c.title} delay={i * 80} className="flex-1 rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-6 text-left">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-inverse/10 text-inverse mb-4">
                        <c.icon className="h-5 w-5" />
                      </div>
                      <h3 className="heading-display text-xl mb-2">{c.title}</h3>
                      <p className="text-sm text-primary-foreground/70 leading-relaxed">{c.text}</p>
                    </Reveal>
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
                <span className="text-inverse-primary font-semibold">↺</span> Moins de visiteurs → moins
                d'exposants → salons affaiblis → moins de visiteurs.{' '}
                <b className="text-inverse-primary font-semibold">Le cercle se referme.</b>
              </p>
            </Reveal>

            <Reveal className="text-center mt-14">
              <div className="heading-display text-[clamp(2rem,4.4vw,3.4rem)]">
                Un écosystème <em className="not-italic text-inverse-primary italic">en danger.</em>
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
          <Reveal className="max-w-[760px] mx-auto px-6 text-center mb-[60px]">
            <div className="w-[46px] h-[3px] bg-primary rounded-full mx-auto mb-5" />
            <p className="text-primary font-bold uppercase tracking-[0.15em] text-xs mb-3">La solution</p>
            <h2 className="heading-display text-[clamp(2rem,3.7vw,3rem)] text-foreground">
              Rendre le marché lisible. Pour tout le monde.
            </h2>
            <p className="mt-4 text-lg text-foreground/70">
              Lotexpo lit l'intégralité de l'écosystème, chaque salon, chaque programme, chaque exposant,
              pour transformer ce chaos en information utile.{' '}
              <b className="text-primary font-semibold">
                Chacun y trouve son intérêt : le visiteur, l'exposant, le commercial et l'organisateur.
              </b>
            </p>
          </Reveal>

          <div className="flex flex-col">
            {SOLUTION_BLOCKS.map((b, i) => (
              <SolutionRow key={b.title} block={b} reversed={i % 2 === 1} muted={i % 2 === 0} />
            ))}
          </div>
        </section>

        {/* ============================= PROCHAINS SALONS ============================= */}
        <section className="bg-background">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="flex items-end justify-between gap-4 mb-10">
              <Reveal>
                <div className="section-rule" />
                <h2 className="heading-display text-[clamp(1.8rem,3vw,2.6rem)] text-foreground">
                  Prochains salons
                </h2>
              </Reveal>
              <Link to="/salons" className="hidden sm:block">
                <Button variant="outline">
                  Voir tous les salons
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {upcomingLoading ? (
              <div className="flex gap-6 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-full max-w-[272px] shrink-0 rounded-2xl bg-background p-4 animate-pulse">
                    <div className="h-44 bg-muted rounded-lg mb-4" />
                    <div className="h-4 bg-muted rounded mb-2" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : upcoming && upcoming.length > 0 ? (
              <Carousel opts={{ align: 'start' }} className="w-full">
                <CarouselContent className="-ml-6">
                  {upcoming.map((event) => (
                    <CarouselItem
                      key={event.id}
                      className="pl-6 basis-[85%] xs:basis-1/2 lg:basis-1/4"
                    >
                      <EventCard event={event} view="grid" />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="hidden sm:flex" />
                <CarouselNext className="hidden sm:flex" />
              </Carousel>
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
            <h2 className="heading-display text-[clamp(2rem,3.7vw,3rem)]">Le salon redevient lisible.</h2>
            <p className="mt-4 text-lg text-primary-foreground/80 max-w-[52ch] mx-auto">
              Trouvez le vôtre, préparez-le, faites-le rayonner, quel que soit votre rôle dans
              l'écosystème.
            </p>
            <div className="mt-9 flex items-center justify-center gap-4 flex-wrap">
              <Link to={ASSISTANT_ONBOARDING_PATH}>
                <Button className="bg-background text-primary hover:bg-background/90 h-12 px-6 text-base rounded-xl">
                  Créer mon agenda
                  <CalendarHeart className="ml-2 h-4 w-4" />
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

const SolutionRow = ({ block, reversed, muted }: { block: SolutionBlock; reversed: boolean; muted?: boolean }) => (
  <Reveal className={cn('w-full', muted && 'bg-muted/40')}>
    <div className="max-w-[1180px] mx-auto px-7 py-14 grid grid-cols-1 lg:grid-cols-2 gap-y-[38px] lg:gap-y-0 lg:gap-x-[74px] items-center">
      {/* Texte : toujours en premier dans le DOM (mobile => au-dessus partout) */}
      <div className={reversed ? 'lg:order-last' : ''}>
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary text-primary font-bold text-[0.78rem] uppercase tracking-[0.06em] px-[13px] py-[5px] mb-4">
          {block.actor}
        </span>
        <h3 className="heading-display font-bold text-[clamp(1.7rem,3vw,2.4rem)] leading-[1.12] text-foreground max-w-[15ch]">
          {block.title}
        </h3>
        <p className="mt-[18px] text-[1.08rem] leading-[1.65] text-foreground/70 max-w-[44ch]">{block.body}</p>
        <div className="mt-5 flex gap-[11px] items-start bg-secondary/25 border-l-[3px] border-primary rounded-r-[10px] px-4 py-[13px] max-w-[46ch]">
          <Info className="h-[18px] w-[18px] text-primary shrink-0 mt-0.5" />
          <p className="text-[0.96rem] leading-relaxed text-foreground/75">{block.ecoNote}</p>
        </div>
        {block.cta && (
          <Link
            to={block.cta.to}
            className="group mt-6 inline-flex items-center gap-2 text-primary font-bold hover:text-primary transition-colors"
          >
            {block.cta.label}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </div>
      {/* Visuel : après le texte dans le DOM ; passe à gauche en desktop pour les blocs pairs */}
      <div className={reversed ? 'lg:order-first' : ''}>{block.visual}</div>
    </div>
  </Reveal>
);

/* Cadre mock générique */
const Mock = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-[20px] border border-border bg-background shadow-[0_12px_34px_-14px_hsl(var(--primary)/0.22)] p-5 ${className}`}>
    {children}
  </div>
);


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
    <div className="rounded-[13px] border border-border p-[15px] mb-[11px]">
      <div className="flex justify-between items-center gap-2.5 mb-0.5">
        <span className="font-bold text-primary">Adoria</span>
        <span className="text-[0.72rem] font-bold px-2 py-1 rounded-full bg-info/10 text-info">Client · renouvellement</span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">Contrat à échéance dans 4 mois, sécuriser le renouvellement.</p>
      <ul className="space-y-1.5">
        {['Où en est la roadmap module stocks 2026 ?', 'Le passage multi-sites est-il à l\u2019ordre du jour ?', 'Qui décide du budget cette année ?'].map((q, i) => (
          <li key={i} className="flex gap-2 text-xs text-foreground">
            <span className="text-primary font-bold shrink-0">{i + 1}.</span>
            {q}
          </li>
        ))}
      </ul>
    </div>
    {[
      { name: 'Inpulse', chip: 'Prospect chaud', cls: 'bg-primary/15 text-primary', why: 'A ouvert vos 3 derniers emails, relance de vive voix.' },
      { name: 'HUBENCY', chip: 'À qualifier', cls: 'bg-muted text-muted-foreground', why: 'Nouveau sur votre marché, premier contact.' },
    ].map((s) => (
      <div key={s.name} className="rounded-[13px] border border-border p-[15px] mb-[11px] opacity-60">
        <div className="flex justify-between items-center gap-2.5">
          <span className="font-bold text-primary">{s.name}</span>
          <span className={`text-[0.72rem] font-bold px-2 py-1 rounded-full ${s.cls}`}>{s.chip}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{s.why}</p>
      </div>
    ))}
  </Mock>
);

/* ---- Block 2 : nouveautés ---- */
const NoveltyMock = () => (
  <Mock className="max-w-[460px] mx-auto">
    <div className="flex gap-4">
      <div
        className="w-24 sm:w-28 shrink-0 aspect-[3/4] rounded-xl flex items-center justify-center text-primary overflow-hidden"
        style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.25), hsl(var(--secondary)))' }}
      >
        <Rocket className="h-10 w-10 opacity-50" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="inline-block bg-primary text-primary-foreground text-[0.72rem] font-bold uppercase tracking-wide px-3 py-1 rounded-full mb-2.5">
          Nouveauté
        </span>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-extrabold text-sm shrink-0">A</div>
          <div className="min-w-0">
            <div className="font-bold text-primary text-sm leading-tight">Adoria</div>
            <div className="text-xs text-muted-foreground">présentée à Food Hotel Tech</div>
          </div>
        </div>
        <div className="font-bold text-foreground mb-2.5 leading-snug">Borne de commande autonome nouvelle génération</div>
        <div className="flex flex-wrap gap-[6px]">
          {['Démo live sur stand', '-30% temps de commande', 'Intégration caisse native'].map((c) => (
            <span key={c} className="text-[0.74rem] font-medium text-primary bg-secondary/40 border border-secondary rounded-full px-[10px] py-0.5">
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2 text-xs font-semibold text-info border-t border-border pt-3 mt-4">
      <CalendarHeart className="h-4 w-4 shrink-0" />
      Proposée dans l'agenda des visiteurs concernés
    </div>
  </Mock>
);

/* ---- Block 4 : organisateurs ---- */
const OrganizerHomeMock = () => {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const shown = reduced || inView;
  const rows = [
    { icon: CalendarClock, label: 'Programme publié · 14 sessions' },
    { icon: Megaphone, label: 'Nouveautés de vos exposants · 9 publiées' },
    { icon: ExternalLink, label: 'Bouton vers votre site officiel' },
  ];
  const cls = (i: number) =>
    cn('transition-all duration-500', shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2');
  const delay = (i: number) => ({ transitionDelay: reduced ? '0ms' : `${160 + i * 190}ms` });
  return (
    <Mock>
      <div ref={ref}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <span className="heading-display text-lg text-foreground">Votre salon sur Lotexpo</span>
          <div className="flex items-center gap-1.5">
            <span className="bg-secondary text-primary text-[11px] font-medium rounded-full px-2 py-0.5">Page revendiquée</span>
            <span className="text-[11px] text-muted-foreground border border-border rounded-full px-2">Exemple</span>
          </div>
        </div>
        <div className="space-y-2.5">
          {rows.map((r, i) => (
            <div
              key={r.label}
              style={delay(i)}
              className={cn('rounded-xl border border-border px-3 py-2.5 flex items-center gap-2.5 text-sm font-medium text-foreground', cls(i))}
            >
              <r.icon className="h-4 w-4 text-primary shrink-0" />
              {r.label}
            </div>
          ))}
        </div>
        <div style={delay(3)} className={cn('flex justify-center py-2.5 text-primary', cls(3))}>
          <ArrowDown className="h-5 w-5" />
        </div>
        <div style={delay(4)} className={cn('rounded-xl bg-surface-inverse text-inverse p-4', cls(4))}>
          <span className="inline-block bg-inverse-primary text-surface-inverse text-[11px] font-bold uppercase tracking-wide rounded-full px-2.5 py-0.5">
            Salon à ne pas manquer
          </span>
          <p className="text-sm mt-2">Proposé aux visiteurs dont les sujets correspondent</p>
        </div>
      </div>
    </Mock>
  );
};

const SOLUTION_BLOCKS: SolutionBlock[] = [
  {
    actor: 'Pour les visiteurs & acheteurs',
    title: "Le bon salon, même celui auquel vous n'auriez jamais pensé",
    body: (
      <>
        Dites une fois ce qui vous intéresse : votre métier, vos sujets, vos régions. L'IA lit en continu
        les salons, leurs programmes et les Nouveautés des exposants, puis range dans votre agenda{' '}
        <strong className="text-primary font-semibold">les conférences, les stands et les salons à ne pas manquer</strong>,
        avec la raison écrite pour vous.
      </>
    ),
    ecoNote: 'Gratuit et prêt en 2 minutes. Un email quand ça vaut le déplacement, 2 par semaine au plus.',
    cta: { label: 'Créer mon agenda', to: ASSISTANT_ONBOARDING_PATH },
    visual: <AgendaDemoMock />,
  },
  {
    actor: 'Pour les exposants',
    title: "Soyez découvert avant même l'ouverture des portes",
    body: (
      <>
        Publiez votre Nouveauté : un lancement, une innovation, une démo. L'IA la rédige avec vous à partir
        de vos documents, puis{' '}
        <strong className="text-primary font-semibold">la propose dans l'agenda des visiteurs qu'elle concerne.</strong>{' '}
        Vous partagez votre page d'invitation, et les demandes de rendez-vous arrivent avant l'ouverture.
      </>
    ),
    ecoNote:
      'Pour les visiteurs : savoir quoi voir et pourquoi. Pour les salons : un contenu vivant qui donne envie de venir.',
    cta: { label: 'Publier une Nouveauté', to: '/exposants' },
    visual: <NoveltyMock />,
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
    actor: 'Pour les organisateurs',
    title: 'Votre salon, sur le radar des bons visiteurs',
    body: (
      <>
        Revendiquez gratuitement la page de votre salon : vos informations font foi. Publiez votre programme,
        invitez vos exposants à annoncer leurs Nouveautés :{' '}
        <strong className="text-primary font-semibold">plus votre salon est vivant, plus il est proposé aux visiteurs qu'il concerne.</strong>{' '}
        Des outils gratuits vous aident à créer de l'intérêt et à amener du trafic vers votre site avant l'ouverture.
      </>
    ),
    ecoNote: "La visibilité ne s'achète pas, elle se gagne. Votre site officiel reste la destination.",
    cta: { label: 'Revendiquer mon salon', to: '/organisateurs' },
    visual: <OrganizerHomeMock />,
  },
];

export default Home;