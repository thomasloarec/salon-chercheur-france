
import { Helmet } from 'react-helmet-async';
import MainLayout from '@/components/layout/MainLayout';

const PolitiqueConfidentialite = () => {
  return (
    <MainLayout title="Politique de confidentialité">
      <Helmet>
        <meta name="description" content="Comment SalonsPro collecte, utilise et protège vos données personnelles conformément au RGPD" />
      </Helmet>
      
      <div className="container mx-auto px-4 py-8 prose prose-lg max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-primary">Politique de confidentialité</h1>

        {/* 0. Préambule */}
        <p className="mb-6">
          La présente politique de confidentialité décrit comment [NOM_Entreprise] (« nous », « notre », « nos ») collecte, utilise et protège les données personnelles que vous nous communiquez lorsque vous utilisez le site [NOM_Site] (ci‑après « le Site »).
        </p>

        {/* 1. Responsable du traitement */}
        <section id="responsable-traitement" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">1. Responsable du traitement</h2>
          <p className="mb-4">
            Responsable : <strong>[NOM_Responsable]</strong> – [NOM_Entreprise] (entreprise individuelle)
            <br /> Adresse : [ADRESSE_Entreprise]
            <br /> Email : <a href="mailto:[EMAIL_Contact]" className="text-primary hover:underline">[EMAIL_Contact]</a>
            <br /> Numéro SIREN : [NUMERO_SIREN]
            <br /> Délégué à la protection des données (DPO) : [DPO_NOM] – <a href="mailto:[DPO_EMAIL]" className="text-primary hover:underline">[DPO_EMAIL]</a> (le cas échéant)
          </p>
        </section>

        {/* 2. Données collectées */}
        <section id="donnees-collectees" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">2. Données que nous collectons</h2>
          <ul className="list-disc pl-6 mb-4">
            <li>Données d'identification : nom, prénom, société, fonction</li>
            <li>Données de contact : adresse email, numéro de téléphone</li>
            <li>Données de navigation : adresse IP, logs, pages visitées, cookies</li>
            <li>Préférences (abonnement newsletter, salons suivis)</li>
            <li>Autres données fournies via nos formulaires (ex. suggestions d'événements)</li>
          </ul>
        </section>

        {/* 3. Finalités et bases légales */}
        <section id="finalites" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">3. Finalités et bases légales</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-300 mb-4">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-2 text-left">Finalité</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Base légale (art. 6 RGPD)</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Données concernées</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">Gestion du formulaire de contact</td>
                  <td className="border border-gray-300 px-4 py-2">Consentement (a)</td>
                  <td className="border border-gray-300 px-4 py-2">Données d'identification & contact</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">Envoi de la newsletter</td>
                  <td className="border border-gray-300 px-4 py-2">Consentement (a)</td>
                  <td className="border border-gray-300 px-4 py-2">Email, préférences</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">Statistiques & mesure d'audience</td>
                  <td className="border border-gray-300 px-4 py-2">Intérêt légitime (f)</td>
                  <td className="border border-gray-300 px-4 py-2">Données de navigation</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">Sécurisation du Site</td>
                  <td className="border border-gray-300 px-4 py-2">Intérêt légitime (f)</td>
                  <td className="border border-gray-300 px-4 py-2">Logs, IP</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">Respect des obligations légales</td>
                  <td className="border border-gray-300 px-4 py-2">Obligation légale (c)</td>
                  <td className="border border-gray-300 px-4 py-2">Toute donnée pouvant être requise</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Destinataires & sous‑traitants */}
        <section id="destinataires" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">4. Destinataires</h2>
          <p className="mb-4">
            Les données sont destinées uniquement aux personnes habilitées de [NOM_Entreprise] et à nos prestataires techniques listés ci‑dessous :
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Hébergement : [HEBERGEUR_NOM] ([HEBERGEUR_PAYS])</li>
            <li>Service d'emailing : [EMAILING_FOURNISSEUR] ([EMAILING_PAYS])</li>
            <li>Outil de statistiques : [ANALYTICS_NOM] ([ANALYTICS_PAYS])</li>
          </ul>
        </section>

        {/* 5. Transferts hors UE */}
        <section id="transferts" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">5. Transferts hors Union européenne</h2>
          <p className="mb-4">
            Lorsque des données sont transférées en dehors de l'Espace économique européen, nous veillons à ce que le pays assure un niveau de protection adéquat (décision d'adéquation) ou mettons en œuvre des garanties appropriées (clauses contractuelles types).
          </p>
        </section>

        {/* 6. Durées de conservation */}
        <section id="conservation" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">6. Durées de conservation</h2>
          <p className="mb-4">Nous conservons les données pour les durées suivantes :</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Données de contact : 3 ans après le dernier échange</li>
            <li>Données de newsletter : jusqu'au retrait du consentement</li>
            <li>Logs : 12 mois</li>
            <li>Cookies : voir tableau Cookies</li>
          </ul>
        </section>

        {/* 7. Sécurité */}
        <section id="securite" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">7. Sécurité</h2>
          <p className="mb-4">
            Nous mettons en œuvre des mesures techniques et organisationnelles adaptées (HTTPS, backups, contrôle d'accès, chiffrement en transit et au repos) conformément au <a href="https://www.cnil.fr/fr/guide-de-la-securite-des-donnees-personnelles-nouvelle-edition-2024" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Guide CNIL – sécurité des données personnelles</a>.
          </p>
        </section>

        {/* 8. Vos droits */}
        <section id="droits" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">8. Vos droits</h2>
          <p className="mb-4">
            Conformément au RGPD, vous disposez des droits d'accès, rectification, effacement, opposition, limitation et portabilité. Vous pouvez les exercer auprès de <a href="mailto:[EMAIL_Contact]" className="text-primary hover:underline">[EMAIL_Contact]</a>. En cas de doute raisonnable sur votre identité, une preuve pourra être demandée.
          </p>
          <p className="mb-4">
            Vous disposez également du droit d'introduire une réclamation auprès de la CNIL (www.cnil.fr).
          </p>
        </section>

        {/* 9. Cookies & traceurs */}
        <section id="cookies" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">9. Cookies et traceurs</h2>
          <p className="mb-4">
            Nous utilisons des cookies pour assurer le fonctionnement du Site, mesurer son audience et vous proposer des contenus personnalisés. Vous pouvez gérer vos préférences via le bandeau cookies ou dans votre navigateur.
          </p>
          <details className="mb-4">
            <summary className="cursor-pointer font-medium text-primary hover:text-primary/80 mb-2">Tableau récapitulatif</summary>
            <div className="overflow-x-auto mt-4">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left">Nom</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Finalité</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Durée</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">_ga</td>
                    <td className="border border-gray-300 px-4 py-2">Statistiques Google Analytics</td>
                    <td className="border border-gray-300 px-4 py-2">13 mois</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">cookie_consent</td>
                    <td className="border border-gray-300 px-4 py-2">Stocker vos préférences</td>
                    <td className="border border-gray-300 px-4 py-2">6 mois</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </section>

        {/* 10. Modifications */}
        <section id="modifications" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">10. Modifications de la politique</h2>
          <p className="mb-4">
            Cette politique peut être mise à jour à tout moment. Dernière mise à jour : [DATE_MAJ]. Nous vous invitons à la consulter régulièrement.
          </p>
        </section>

        {/* 11. Contact */}
        <section id="contact" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">11. Nous contacter</h2>
          <p className="mb-4">Pour toute question sur cette politique, contactez‑nous à <a href="mailto:[EMAIL_Contact]" className="text-primary hover:underline">[EMAIL_Contact]</a>.</p>
        </section>
      </div>
    </MainLayout>
  );
};

export default PolitiqueConfidentialite;
