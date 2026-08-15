import React, { useState } from 'react';
import {
  PlugZap,
  Radar,
  Sparkles,
  ClipboardList,
  TrendingUp,
  UserPlus,
  Eye,
  Target,
  MessagesSquare,
} from 'lucide-react';
import { MotionConfig, motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import LeadMagnetChat from '@/components/directeur-commercial/LeadMagnetChat';
import QualificationDialog from '@/components/directeur-commercial/QualificationDialog';
import CrmSecurityBadge from '@/components/CrmSecurityBadge';

const EASE = [0.22, 1, 0.36, 1] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

const VIEWPORT = { once: true, margin: '-80px' } as const;

const STEPS = [
  { icon: PlugZap, text: 'Vous connectez votre CRM.' },
  {
    icon: Radar,
    text: 'Vous et vos équipes voyez les salons où aller pour faire les bonnes rencontres.',
  },
  {
    icon: Sparkles,
    text: "Vos commerciaux visitent avec l'intelligence IA de Lotexpo, qui leur dit quelles informations récolter sur chaque stand.",
  },
  {
    icon: ClipboardList,
    text: 'Vous recevez les comptes rendus de visite et les tâches de relance, dans votre tableau de bord ou par email.',
  },
  { icon: TrendingUp, text: 'Votre pipe se remplit de nouveaux projets grâce aux visites en salon.' },
];

const BENEFITS = [
  {
    icon: UserPlus,
    title: 'Nouveaux interlocuteurs',
    text: "Trouver de nouveaux interlocuteurs chez vos clients pour discuter d'autres projets.",
  },
  {
    icon: Eye,
    title: 'Veille client',
    text: 'Observer ce que votre client met en avant, et suivre l’évolution de son activité.',
  },
  {
    icon: Target,
    title: 'Concurrents et projets',
    text: 'Repérer les concurrents de vos clients, et les projets potentiels qui vont avec.',
  },
  {
    icon: MessagesSquare,
    title: 'Le bon contact',
    text: 'Obtenir le bon contact rapidement, directement dans la conversation.',
  },
];

const DirecteurCommercial = () => {
  const [lastSearchedCompany, setLastSearchedCompany] = useState<string | null>(null);

  return (
    <MotionConfig reducedMotion="user">
    <MainLayout
      title="Salons professionnels pour directeurs commerciaux"
      description="Testez gratuitement : indiquez une entreprise de votre portefeuille, Lotexpo vous dit sur quels salons professionnels elle sera présente, et vous propose des prospects du même métier."
      canonical="https://lotexpo.com/directeur-commercial"
    >
      {/* Hero + outil */}
      <section className="relative mx-auto max-w-4xl py-10 md:py-16">
        {/* Fond texturé full-bleed, uniquement derrière le hero */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden"
        >
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-70"
            style={{ backgroundImage: "url('/backgrounds/recherche-ia-bg.jpg')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        </div>

        <motion.div initial="hidden" animate="show" variants={container} className="relative">
          <motion.p
            variants={item}
            className="text-xs font-medium uppercase tracking-[0.18em] text-primary"
          >
            Pour les directeurs commerciaux
          </motion.p>
          <motion.h1 variants={item} className="heading-display mt-3 text-3xl leading-tight md:text-5xl">
            Assurez-vous que vos commerciaux voient les bons clients et prospects sur les salons.
          </motion.h1>
          <motion.p variants={item} className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            Testez maintenant, gratuitement et sans inscription. Tapez le nom d'une entreprise de
            votre portefeuille : Lotexpo vous dit à quels salons professionnels elle sera présente.
            Et si elle n'y va pas, on vous trouve des entreprises du même métier qui, elles, y seront.
          </motion.p>

          <motion.div
            variants={item}
            className="mt-8 rounded-3xl border border-border bg-[#e6e8ec]/40 p-4 md:p-6 backdrop-blur-sm"
          >
            <LeadMagnetChat onSearched={setLastSearchedCompany} />
          </motion.div>
        </motion.div>
      </section>

      {/* Parcours */}
      <motion.section
        className="mx-auto max-w-4xl py-12"
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={container}
      >
        <motion.h2 variants={item} className="heading-display text-2xl md:text-3xl">
          Comment Lotexpo équipe votre équipe commerciale
        </motion.h2>
        <motion.ol
          variants={container}
          className="mt-8 flex flex-col gap-4 md:flex-row md:items-stretch md:gap-0"
        >
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.li
                key={step.text}
                variants={item}
                className="relative flex flex-1 gap-4 md:flex-col md:items-center md:gap-3 md:px-2"
              >
                {/* Connecteur */}
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-7 top-16 h-[calc(100%-2rem)] w-px bg-border md:left-auto md:top-7 md:h-px md:w-full md:translate-x-1/2"
                  />
                )}
                <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-primary/10 transition-transform duration-200 hover:-translate-y-1 hover:shadow-md">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div className="md:text-center">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Étape {i + 1}
                  </span>
                  <p className="mt-1 text-sm text-foreground">{step.text}</p>
                </div>
              </motion.li>
            );
          })}
        </motion.ol>
      </motion.section>

      {/* Bénéfices */}
      <motion.section
        className="mx-auto max-w-4xl py-12"
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={container}
      >
        <motion.h2 variants={item} className="heading-display text-2xl md:text-3xl">
          Pourquoi les salons sont une mine pour votre pipe
        </motion.h2>
        <motion.div variants={container} className="mt-6 grid gap-4 sm:grid-cols-2">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <motion.div
                key={b.text}
                variants={item}
                className="rounded-2xl border border-border bg-[#b6e3ff]/25 p-5 text-sm text-foreground transition-transform duration-200 hover:-translate-y-1 hover:shadow-md md:text-base"
              >
                <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#b6e3ff]">
                  <Icon className="h-5 w-5 text-[#0b132b]" />
                </span>
                <p className="font-semibold">{b.title}</p>
                <p className="mt-1 text-muted-foreground">{b.text}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.section>

      {/* CTA */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={item}
        className="mx-auto mb-16 max-w-4xl rounded-3xl bg-[#0b132b] p-6 text-white md:p-10"
      >
        <h2 className="heading-display text-2xl md:text-3xl">
          Passez à la version connectée à votre CRM
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-white/80 md:text-base">
          On ne vous demande rien pour tester autant que vous voulez. Cette étape n'arrive que si
          vous voulez équiper votre équipe. Dites-nous en deux minutes comment vous travaillez, et
          on revient vers vous avec la meilleure façon de brancher vos données, sans vous imposer
          d'import Excel.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <QualificationDialog lastSearchedCompany={lastSearchedCompany} />
          <CrmSecurityBadge variant="dark" />
        </div>
      </motion.section>
    </MainLayout>
    </MotionConfig>
  );
};

export default DirecteurCommercial;