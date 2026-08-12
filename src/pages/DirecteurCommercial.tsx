import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import LeadMagnetChat from '@/components/directeur-commercial/LeadMagnetChat';
import QualificationDialog from '@/components/directeur-commercial/QualificationDialog';

const STEPS = [
  'Vous connectez votre CRM.',
  'Vous et vos équipes voyez les salons où aller pour faire les bonnes rencontres.',
  "Vos commerciaux visitent avec l'intelligence IA de Lotexpo, qui leur dit quelles informations récolter sur chaque stand.",
  'Vous recevez les comptes rendus de visite et les tâches de relance, dans votre tableau de bord ou par email.',
  'Votre pipe se remplit de nouveaux projets grâce aux visites en salon.',
];

const BENEFITS = [
  "Trouver de nouveaux interlocuteurs chez vos clients pour discuter d'autres projets.",
  'Observer ce que votre client met en avant, et suivre l’évolution de son activité.',
  'Repérer les concurrents de vos clients, et les projets potentiels qui vont avec.',
  'Obtenir le bon contact rapidement, directement dans la conversation.',
];

const DirecteurCommercial = () => {
  const [lastSearchedCompany, setLastSearchedCompany] = useState<string | null>(null);

  return (
    <MainLayout
      title="Salons professionnels pour directeurs commerciaux"
      description="Testez gratuitement : indiquez une entreprise de votre portefeuille, Lotexpo vous dit sur quels salons professionnels elle sera présente, et vous propose des prospects du même métier."
      canonical="https://lotexpo.com/directeur-commercial"
    >
      {/* Hero + outil */}
      <section className="mx-auto max-w-4xl py-10 md:py-16">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          Pour les directeurs commerciaux
        </p>
        <h1 className="heading-display mt-3 text-3xl leading-tight md:text-5xl">
          Assurez-vous que vos commerciaux voient les bons clients et prospects sur les salons.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
          Testez maintenant, gratuitement et sans inscription. Tapez le nom d'une entreprise de
          votre portefeuille : Lotexpo vous dit à quels salons professionnels elle sera présente.
          Et si elle n'y va pas, on vous trouve des entreprises du même métier qui, elles, y seront.
        </p>

        <div className="mt-8 rounded-3xl border border-border bg-[#e6e8ec]/40 p-4 md:p-6">
          <LeadMagnetChat onSearched={setLastSearchedCompany} />
        </div>
      </section>

      {/* Parcours */}
      <section className="mx-auto max-w-4xl py-12">
        <h2 className="heading-display text-2xl md:text-3xl">
          Comment Lotexpo équipe votre équipe commerciale
        </h2>
        <ol className="mt-6 space-y-4">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-4 rounded-2xl border border-border bg-card p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {i + 1}
              </span>
              <p className="text-sm text-foreground md:text-base">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Bénéfices */}
      <section className="mx-auto max-w-4xl py-12">
        <h2 className="heading-display text-2xl md:text-3xl">
          Pourquoi les salons sont une mine pour votre pipe
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <div key={b} className="rounded-2xl bg-[#b6e3ff]/25 p-5 text-sm text-foreground md:text-base">
              {b}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto mb-16 max-w-4xl rounded-3xl bg-[#0b132b] p-6 text-white md:p-10">
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
          {/* PLACEHOLDER — à remplacer par le badge officiel « CRM sécurisé » (Lot 3) */}
          <span className="inline-flex items-center gap-2 text-xs text-white/70">
            <Lock className="h-4 w-4" /> Vos données CRM sont protégées.
          </span>
        </div>
      </section>
    </MainLayout>
  );
};

export default DirecteurCommercial;