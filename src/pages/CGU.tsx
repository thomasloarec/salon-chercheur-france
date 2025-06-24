
import { Helmet } from 'react-helmet-async';
import MainLayout from '@/components/layout/MainLayout';

const CGU = () => {
  return (
    <MainLayout title="Conditions Générales d'Utilisation">
      <Helmet>
        <meta name="description" content="Règles d'utilisation du site SalonsPro édité par SalonsPro" />
      </Helmet>
      
      <div className="container mx-auto px-4 py-8 prose prose-lg max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-primary">Conditions Générales d'Utilisation (CGU)</h1>

        {/* 0. Préambule */}
        <section id="preambule" className="mb-8">
          <p className="mb-4">
            Les présentes CGU régissent l'accès et l'utilisation du site <strong>[NOM_Site]</strong> (ci‑après « le Site »), édité par <strong>[NOM_Entreprise]</strong> (entrepreneur individuel) dont les informations légales sont disponibles dans les <a href="/mentions-legales" className="text-primary hover:underline">Mentions légales</a>. Tout internaute reconnaît, en accédant au Site, avoir lu et accepté sans réserve les CGU.
          </p>
        </section>

        {/* 1. Définitions */}
        <section id="definitions" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">1. Définitions</h2>
          <p className="mb-4">
            « Utilisateur » : toute personne naviguant sur le Site. « Contenu » : toute information publiée sur le Site (textes, images, fichiers). « Service » : la liste des salons professionnels et fonctionnalités associées (newsletter, formulaire de suggestion, etc.).
          </p>
        </section>

        {/* 2. Objet du Site */}
        <section id="objet" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">2. Objet du Site</h2>
          <p className="mb-4">
            Le Site a pour objet de [DESCRIPTION_OBJET] (ex : recenser les salons professionnels organisés en France et fournir des outils de prospection).
          </p>
        </section>

        {/* 3. Accès au Site */}
        <section id="acces" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">3. Accès au Site</h2>
          <p className="mb-4">
            Le Site est accessible gratuitement 24 h/24 et 7 j/7, sauf cas de force majeure, pannes ou interventions de maintenance. Les coûts d'accès (matériel, logiciel, connexion) restent à la charge de l'Utilisateur.
          </p>
        </section>

        {/* 4. Inscription / Compte utilisateur */}
        <section id="compte" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">4. Création de compte</h2>
          <p className="mb-4">
            Pour accéder à certaines fonctionnalités, l'Utilisateur peut créer un compte en fournissant des informations exactes, complètes et à jour. L'Utilisateur est responsable de la confidentialité de son mot de passe.
          </p>
        </section>

        {/* 5. Obligations de l'utilisateur */}
        <section id="obligations" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">5. Obligations de l'Utilisateur</h2>
          <ul className="list-disc pl-6 mb-4">
            <li>Respecter les lois françaises et internationales en vigueur.</li>
            <li>Ne pas publier de contenus illicites, diffamatoires, violents, obscènes ou portant atteinte aux droits de tiers.</li>
            <li>Ne pas perturber le fonctionnement du Site (virus, scripts, scraping non autorisé, etc.).</li>
            <li>Fournir des informations exactes et les mettre à jour si nécessaire.</li>
          </ul>
        </section>

        {/* 6. Contribution des utilisateurs */}
        <section id="contenu-utilisateur" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">6. Contenus générés par l'Utilisateur</h2>
          <p className="mb-4">
            Les contributions (ex : suggestions d'événements) restent sous la responsabilité de leur auteur. L'Utilisateur concède à [NOM_Entreprise] une licence non exclusive, gratuite, mondiale, pour reproduire, représenter et adapter ses contributions dans le cadre du Service. [NOM_Entreprise] se réserve le droit de modérer ou supprimer tout contenu contraire aux CGU.
          </p>
        </section>

        {/* 7. Propriété intellectuelle */}
        <section id="propriete-intellectuelle" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">7. Propriété intellectuelle</h2>
          <p className="mb-4">
            Le Site et chacun des éléments qui le composent (structure, textes, images, bases de données, logo) sont protégés par le Code de la propriété intellectuelle. Toute reproduction totale ou partielle sans autorisation écrite est interdite.
          </p>
        </section>

        {/* 8. Responsabilité */}
        <section id="responsabilite" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">8. Responsabilité</h2>
          <p className="mb-4">
            [NOM_Entreprise] s'efforce d'assurer l'exactitude des informations publiées mais ne garantit pas l'absence d'erreur ou d'omission. L'Utilisateur utilise le Site sous sa responsabilité exclusive. [NOM_Entreprise] ne peut être tenue responsable des dommages directs ou indirects résultant de l'utilisation du Site ou de l'impossibilité d'y accéder.
          </p>
        </section>

        {/* 9. Liens hypertextes */}
        <section id="liens" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">9. Liens hypertextes</h2>
          <p className="mb-4">
            Le Site peut contenir des liens vers des sites tiers. [NOM_Entreprise] n'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu.
          </p>
        </section>

        {/* 10. Signalement de contenus illicites */}
        <section id="signalement" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">10. Signalement de contenus illicites</h2>
          <p className="mb-4">
            Conformément à l'article 6 I 5 de la LCEN, tout signalement peut être adressé à <a href="mailto:[EMAIL_Contact]" className="text-primary hover:underline">[EMAIL_Contact]</a> en précisant : la date, vos coordonnées, la description du contenu litigieux, son URL et les motifs juridiques.
          </p>
        </section>

        {/* 11. Données personnelles */}
        <section id="donnees-personnelles" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">11. Données personnelles</h2>
          <p className="mb-4">
            Le traitement des données est régi par la <a href="/politique-confidentialite" className="text-primary hover:underline">Politique de confidentialité</a>.
          </p>
        </section>

        {/* 12. Cookies */}
        <section id="cookies" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">12. Cookies</h2>
          <p className="mb-4">
            La gestion des cookies est détaillée dans la Politique de confidentialité.
          </p>
        </section>

        {/* 13. Modification des CGU */}
        <section id="modification" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">13. Modification des CGU</h2>
          <p className="mb-4">
            [NOM_Entreprise] peut modifier les CGU à tout moment. Les utilisateurs seront informés des mises à jour importantes par tout moyen adapté. Date de dernière mise à jour : [DATE_MAJ].
          </p>
        </section>

        {/* 14. Droit applicable et juridiction compétente */}
        <section id="droit-applicable" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">14. Droit applicable – Litiges</h2>
          <p className="mb-4">
            Les CGU sont régies par le droit français. En cas de litige, compétence exclusive est attribuée aux tribunaux français compétents.
          </p>
        </section>

        {/* 15. Contact */}
        <section id="contact" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">15. Contact</h2>
          <p className="mb-4">
            Pour toute question relative aux CGU, contactez : <a href="mailto:[EMAIL_Contact]" className="text-primary hover:underline">[EMAIL_Contact]</a>.
          </p>
        </section>
      </div>
    </MainLayout>
  );
};

export default CGU;
