import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Database,
  Lock,
  KeyRound,
  Trash2,
  BadgeCheck,
  ServerCog,
  ArrowRight,
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';

const MEASURES = [
  {
    icon: ShieldCheck,
    title: 'Cloisonnement par compte',
    text: "Vos données ne sont visibles que par vous et les membres que vous invitez. L'isolation est appliquée dans la base de données, sur chaque table et chaque requête. Aucun autre client de Lotexpo n'y accède.",
  },
  {
    icon: Database,
    title: 'Chiffrement au repos',
    text: 'Toutes vos données sont chiffrées au repos (AES-256) sur notre infrastructure.',
  },
  {
    icon: Lock,
    title: 'Chiffrement en transit',
    text: 'Tous les échanges entre votre navigateur et Lotexpo passent en HTTPS/TLS.',
  },
  {
    icon: KeyRound,
    title: 'Connexions CRM chiffrées',
    text: "Quand vous connectez un CRM comme HubSpot, les jetons d'accès sont chiffrés avec une clé dédiée de 256 bits. La clé n'est jamais stockée en base et les jetons ne reviennent jamais vers votre navigateur.",
  },
  {
    icon: Trash2,
    title: 'Effacement à tout moment',
    text: 'Vous pouvez supprimer l’intégralité de vos données CRM importées en une seule action, quand vous voulez. Elles sont définitivement retirées de nos bases.',
  },
  {
    icon: BadgeCheck,
    title: 'Aucune revente',
    text: 'Vos données CRM ne sont jamais vendues, partagées, ni utilisées pour entraîner des modèles. Nous respectons le RGPD.',
  },
  {
    icon: ServerCog,
    title: 'Accès minimal',
    text: 'Nos traitements internes s’exécutent côté serveur, avec des accès strictement limités.',
  },
];

const SecuriteCrm = () => (
  <MainLayout
    title="Sécurité des données CRM"
    description="Comment Lotexpo protège vos données CRM : cloisonnement par compte, chiffrement au repos et en transit, jetons CRM chiffrés, effacement à la demande, conformité RGPD."
    canonical="https://lotexpo.com/securite-crm"
  >
    <section className="mx-auto max-w-4xl px-4 py-12 md:py-16">
      <h1 className="heading-display text-3xl leading-tight md:text-4xl">
        La sécurité de vos données CRM
      </h1>
      <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
        Votre CRM est l'actif le plus précieux de votre équipe commerciale. Voici, concrètement,
        comment Lotexpo le protège.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {MEASURES.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.title} className="rounded-2xl border border-border bg-card p-5">
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </span>
              <h2 className="text-base font-semibold text-foreground">{m.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{m.text}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-6">
        <p className="text-sm text-muted-foreground md:text-base">
          Vous pouvez tester Lotexpo sans engagement : l'essai ne demande aucune connexion à votre
          CRM, et les données que vous importez restent les vôtres, effaçables à tout moment. Si une
          question de sécurité reste ouverte, écrivez-nous avant de connecter quoi que ce soit.
        </p>
        <Link
          to="/directeur-commercial"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          Retour à la page Directeurs commerciaux
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  </MainLayout>
);

export default SecuriteCrm;
