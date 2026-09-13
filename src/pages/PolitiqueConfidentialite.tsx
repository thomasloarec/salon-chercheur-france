
import { Helmet } from 'react-helmet-async';
import MainLayout from '@/components/layout/MainLayout';

const PolitiqueConfidentialite = () => {
  return (
    <MainLayout title="Politique de confidentialité">
      <Helmet>
        <meta name="description" content="Comment Lotexpo collecte, utilise et protège vos données personnelles conformément au RGPD" />
      </Helmet>
      
      <div className="container mx-auto px-4 py-8 prose prose-lg max-w-4xl">
        <h1 className="heading-display text-3xl font-bold mb-6 text-foreground">Politique de confidentialité</h1>

        {/* 0. Préambule */}
        <p className="mb-6">
          La présente politique de confidentialité décrit comment CECILE NOEL COMMUNICATION (« nous », « notre », « nos ») collecte, utilise et protège les données que vous nous fournissez directement (formulaires, compte utilisateur, newsletter) ainsi que les données professionnelles que nous collectons indirectement dans le cadre de la prospection commerciale auprès des entreprises exposantes, lorsque vous utilisez le site Lotexpo (ci‑après « le Site »).
        </p>

        {/* 1. Responsable du traitement */}
        <section id="responsable-traitement" className="mb-8">
          <h2 className="heading-display section-rule text-xl font-semibold mb-4 text-foreground">1. Responsable du traitement</h2>
          <p className="mb-4">
            Responsable : <strong>Cécile Noël</strong> – CECILE NOEL COMMUNICATION (entreprise individuelle)
            <br /> Adresse : 12 allée des Longrais, 14200 Hérouville Saint Clair
            <br /> Téléphone : 06.23.76.52.93
            <br /> Email : <a href="mailto:admin@lotexpo.com" className="text-primary hover:underline">admin@lotexpo.com</a>
            <br /> Numéro SIREN : 929562320
          </p>
        </section>

        {/* 2. Données collectées */}
        <section id="donnees-collectees" className="mb-8">
          <h2 className="heading-display section-rule text-xl font-semibold mb-4 text-foreground">2. Données que nous traitons</h2>
          <ul className="list-disc pl-6 mb-4">
            <li>Données d'identification : nom, prénom, société, fonction</li>
            <li>Données de contact : adresse email (professionnelle ou personnelle), numéro de téléphone</li>
            <li>Données professionnelles liées à la participation aux salons : société exposante, site web, poste occupé, événement concerné, stand</li>
            <li>Données de navigation : adresse IP, logs, pages visitées, cookies</li>
            <li>Préférences (abonnement newsletter, salons suivis)</li>
            <li>Autres données fournies via nos formulaires (ex. suggestions d'événements)</li>
          </ul>
        </section>

        {/* 3. Finalités et bases légales */}
        <section id="finalites" className="mb-8">
          <h2 className="heading-display section-rule text-xl font-semibold mb-4 text-foreground">3. Finalités et bases légales</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-border mb-4">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-border px-4 py-2 text-left">Finalité</th>
                  <th className="border border-border px-4 py-2 text-left">Base légale (art. 6 RGPD)</th>
                  <th className="border border-border px-4 py-2 text-left">Données concernées</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-border px-4 py-2">Prospection commerciale auprès des entreprises exposantes</td>
                  <td className="border border-border px-4 py-2">Intérêt légitime (f)</td>
                  <td className="border border-border px-4 py-2">Email pro, prénom, poste, société, site web</td>
                </tr>
                <tr>
                  <td className="border border-border px-4 py-2">Mise en relation visiteur/exposant (rendez-vous, brochure)</td>
                  <td className="border border-border px-4 py-2">Mesures précontractuelles / intérêt légitime (b, f)</td>
                  <td className="border border-border px-4 py-2">Données d'identification & contact, salon concerné</td>
                </tr>
                <tr>
                  <td className="border border-border px-4 py-2">Gestion du compte et de l'espace exposant</td>
                  <td className="border border-border px-4 py-2">Exécution du contrat (b)</td>
                  <td className="border border-border px-4 py-2">Email, nom, société, données de connexion</td>
                </tr>
                <tr>
                  <td className="border border-border px-4 py-2">Connexion à un CRM tiers (Radar CRM)</td>
                  <td className="border border-border px-4 py-2">Exécution du contrat / consentement (a, b)</td>
                  <td className="border border-border px-4 py-2">Données du compte connecté et contacts synchronisés</td>
                </tr>
                <tr>
                  <td className="border border-border px-4 py-2">Gestion du formulaire de contact</td>
                  <td className="border border-border px-4 py-2">Consentement (a)</td>
                  <td className="border border-border px-4 py-2">Données d'identification & contact</td>
                </tr>
                <tr>
                  <td className="border border-border px-4 py-2">Envoi de la newsletter</td>
                  <td className="border border-border px-4 py-2">Consentement (a)</td>
                  <td className="border border-border px-4 py-2">Email, préférences</td>
                </tr>
                <tr>
                  <td className="border border-border px-4 py-2">Statistiques & mesure d'audience</td>
                  <td className="border border-border px-4 py-2">Consentement (cookies) / intérêt légitime (f)</td>
                  <td className="border border-border px-4 py-2">Données de navigation</td>
                </tr>
                <tr>
                  <td className="border border-border px-4 py-2">Sécurisation du Site</td>
                  <td className="border border-border px-4 py-2">Intérêt légitime (f)</td>
                  <td className="border border-border px-4 py-2">Logs, IP</td>
                </tr>
                <tr>
                  <td className="border border-border px-4 py-2">Respect des obligations légales</td>
                  <td className="border border-border px-4 py-2">Obligation légale (c)</td>
                  <td className="border border-border px-4 py-2">Toute donnée pouvant être requise</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Origine des données (prospection commerciale) */}
        <section id="origine-donnees" className="mb-8">
          <h2 className="heading-display section-rule text-xl font-semibold mb-4 text-foreground">4. Origine des données (prospection commerciale)</h2>
          <p className="mb-4">
            Conformément à l'article 14 du RGPD, certaines coordonnées professionnelles présentes sur le Site sont collectées indirectement auprès de sources publiques ou professionnelles :
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Listes publiques d'exposants publiées par les organisateurs de salons ;</li>
            <li>Sites web des entreprises exposantes ;</li>
            <li>Annuaires et outils professionnels de recherche et de vérification d'emails professionnels (ex. Hunter.io).</li>
          </ul>
          <p className="mb-4">
            Seules des données professionnelles relatives à l'activité des entreprises exposantes sont traitées. Vous pouvez vous opposer à tout moment à cette prospection en nous contactant à <a href="mailto:admin@lotexpo.com" className="text-primary hover:underline">admin@lotexpo.com</a>.
          </p>
        </section>

        {/* 5. Destinataires et sous‑traitants */}
        <section id="destinataires" className="mb-8">
          <h2 className="heading-display section-rule text-xl font-semibold mb-4 text-foreground">5. Destinataires et sous‑traitants</h2>
          <p className="mb-4">
            Les données sont destinées aux personnes habilitées de CECILE NOEL COMMUNICATION, aux entreprises exposantes concernées lorsque vous demandez un rendez-vous ou téléchargez une brochure, ainsi qu'au CRM tiers que l'utilisateur connecte lui‑même.
          </p>
          <p className="mb-4">
            Nos prestataires techniques sont :
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Hébergement application + base de données : Supabase (Union européenne, région Paris)</li>
            <li>Développement et hébergement de l'interface : Lovable</li>
            <li>Envoi d'emails transactionnels et de prospection : Resend (et le cas échéant Microsoft 365 / Outlook)</li>
            <li>Recherche/vérification d'emails professionnels : Hunter.io (États‑Unis)</li>
            <li>Import de données salons/exposants : Airtable (États‑Unis)</li>
            <li>Mesure d'audience : Plausible (UE) et Google Analytics (États‑Unis)</li>
            <li>Enrichissement éditorial par IA : prestataires d'IA, le cas échéant</li>
            <li>Enregistrement du nom de domaine : GoDaddy</li>
          </ul>
          <p className="mb-4">
            Chaque sous‑traitant est encadré par un accord conforme à l'article 28 du RGPD.
          </p>
        </section>

        {/* 6. Transferts hors UE */}
        <section id="transferts" className="mb-8">
          <h2 className="heading-display section-rule text-xl font-semibold mb-4 text-foreground">6. Transferts hors Union européenne</h2>
          <p className="mb-4">
            Certains de nos sous‑traitants sont situés aux États‑Unis, notamment Hunter.io, Google (Google Analytics), Airtable, et le cas échéant Microsoft (Outlook/365) ainsi que les prestataires d'IA utilisés pour l'enrichissement éditorial. Lorsque des données sont transférées en dehors de l'Espace économique européen, nous veillons à ce que le pays assure un niveau de protection adéquat (décision d'adéquation EU‑US Data Privacy Framework) ou mettons en œuvre des garanties appropriées (clauses contractuelles types).
          </p>
        </section>

        {/* 7. Durées de conservation */}
        <section id="conservation" className="mb-8">
          <h2 className="heading-display section-rule text-xl font-semibold mb-4 text-foreground">7. Durées de conservation</h2>
          <p className="mb-4">Nous conservons les données pour les durées suivantes :</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Données de contact : 3 ans après le dernier échange</li>
            <li>Contacts de prospection : 3 ans à compter du dernier contact ; adresses collectées mais jamais sollicitées supprimées au plus tard 12 mois après leur collecte</li>
            <li>Liste d'opposition / de désinscription : conservée le temps nécessaire pour ne plus solliciter la personne</li>
            <li>Données de newsletter : jusqu'au retrait du consentement</li>
            <li>Logs : 12 mois</li>
            <li>Cookies : voir tableau Cookies</li>
          </ul>
        </section>

        {/* 8. Sécurité */}
        <section id="securite" className="mb-8">
          <h2 className="heading-display section-rule text-xl font-semibold mb-4 text-foreground">8. Sécurité</h2>
          <p className="mb-4">
            Nous mettons en œuvre des mesures techniques et organisationnelles adaptées (HTTPS, backups, contrôle d'accès, chiffrement en transit et au repos) conformément au <a href="https://www.cnil.fr/fr/guide-de-la-securite-des-donnees-personnelles-nouvelle-edition-2024" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Guide CNIL – sécurité des données personnelles</a>.
          </p>
        </section>

        {/* 9. Vos droits */}
        <section id="droits" className="mb-8">
          <h2 className="heading-display section-rule text-xl font-semibold mb-4 text-foreground">9. Vos droits</h2>
          <p className="mb-4">
            Conformément au RGPD, vous disposez des droits d'accès, rectification, effacement, opposition, limitation et portabilité. Vous pouvez les exercer auprès de <a href="mailto:admin@lotexpo.com" className="text-primary hover:underline">admin@lotexpo.com</a>. En cas de doute raisonnable sur votre identité, une preuve pourra être demandée.
          </p>
          <p className="mb-4">
            <strong>Opposition à la prospection.</strong> Vous pouvez vous opposer à tout moment à la réception de sollicitations commerciales en utilisant le lien de désinscription présent dans chaque email ou en nous écrivant à <a href="mailto:admin@lotexpo.com" className="text-primary hover:underline">admin@lotexpo.com</a>.
          </p>
          <p className="mb-4">
            Vous disposez également du droit d'introduire une réclamation auprès de la CNIL (www.cnil.fr), 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07.
          </p>
        </section>

        {/* 10. Cookies & traceurs */}
        <section id="cookies" className="mb-8">
          <h2 className="heading-display section-rule text-xl font-semibold mb-4 text-foreground">10. Cookies et traceurs</h2>
          <p className="mb-4">
            Nous utilisons des cookies pour assurer le fonctionnement du Site, mesurer son audience et vous proposer des contenus personnalisés. Vous pouvez gérer vos préférences via le bandeau cookies ou dans votre navigateur.
          </p>
          <details className="mb-4">
            <summary className="cursor-pointer font-medium text-primary hover:text-primary/80 mb-2">Tableau récapitulatif</summary>
            <div className="overflow-x-auto mt-4">
              <table className="min-w-full border-collapse border border-border">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border px-4 py-2 text-left">Nom</th>
                    <th className="border border-border px-4 py-2 text-left">Émetteur</th>
                    <th className="border border-border px-4 py-2 text-left">Finalité</th>
                    <th className="border border-border px-4 py-2 text-left">Durée</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border px-4 py-2">cookie_consent</td>
                    <td className="border border-border px-4 py-2">Lotexpo</td>
                    <td className="border border-border px-4 py-2">Stocker vos préférences</td>
                    <td className="border border-border px-4 py-2">6 mois</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">_ga, _ga_*</td>
                    <td className="border border-border px-4 py-2">Google Analytics</td>
                    <td className="border border-border px-4 py-2">Mesure d'audience (soumise au consentement)</td>
                    <td className="border border-border px-4 py-2">13 mois</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">—</td>
                    <td className="border border-border px-4 py-2">Plausible</td>
                    <td className="border border-border px-4 py-2">Mesure d'audience sans cookie</td>
                    <td className="border border-border px-4 py-2">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </section>

        {/* 11. Modifications */}
        <section id="modifications" className="mb-8">
          <h2 className="heading-display section-rule text-xl font-semibold mb-4 text-foreground">11. Modifications de la politique</h2>
          <p className="mb-4">
            Cette politique peut être mise à jour à tout moment. Dernière mise à jour : 13/09/2026. Nous vous invitons à la consulter régulièrement.
          </p>
        </section>

        {/* 12. Contact */}
        <section id="contact" className="mb-8">
          <h2 className="heading-display section-rule text-xl font-semibold mb-4 text-foreground">12. Nous contacter</h2>
          <p className="mb-4">Pour toute question sur cette politique, contactez‑nous à <a href="mailto:admin@lotexpo.com" className="text-primary hover:underline">admin@lotexpo.com</a>.</p>
        </section>
      </div>
    </MainLayout>
  );
};

export default PolitiqueConfidentialite;
