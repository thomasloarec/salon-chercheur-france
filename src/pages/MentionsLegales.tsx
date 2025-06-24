
import { Helmet } from 'react-helmet-async';
import MainLayout from '@/components/layout/MainLayout';

const MentionsLegales = () => {
  return (
    <MainLayout title="Mentions Légales">
      <Helmet>
        <meta name="description" content="Mentions légales de SalonsPro - Informations légales obligatoires conformes à la législation française" />
      </Helmet>
      
      <div className="container mx-auto px-4 py-8 prose prose-lg max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-primary">Mentions Légales</h1>

        {/* 1. Identification de l'éditeur */}
        <section id="identification" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">1. Éditeur du site</h2>
          <p className="mb-4">
            <strong>[NOM_Responsable]</strong> – [NOM_Entreprise] (entrepreneur individuel, EI)<br/>
            Adresse : [ADRESSE_Entreprise] <br/>
            Téléphone : <a href="tel:[TEL_Entreprise]" className="text-primary hover:underline">[TEL_Entreprise]</a><br/>
            E‑mail : <a href="mailto:[EMAIL_Contact]" className="text-primary hover:underline">[EMAIL_Contact]</a><br/>
            Numéro SIREN : [NUMERO_SIREN]<br/>
            TVA intracommunautaire : [NUMERO_TVA] (le cas échéant)
          </p>
        </section>

        {/* 2. Directeur de publication */}
        <section id="publication" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">2. Directeur·rice de la publication</h2>
          <p className="mb-4">[DIRECTEUR_Publication] (Responsable de la rédaction)</p>
        </section>

        {/* 3. Hébergeur */}
        <section id="hebergeur" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">3. Hébergeur</h2>
          <p className="mb-4">
            [HEBERGEUR_Nom] <br/>
            [HEBERGEUR_Adresse] <br/>
            Téléphone : <a href="tel:[HEBERGEUR_TEL]" className="text-primary hover:underline">[HEBERGEUR_TEL]</a>
          </p>
        </section>

        {/* 4. Propriété intellectuelle */}
        <section id="propriete-intellectuelle" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">4. Propriété intellectuelle</h2>
          <p className="mb-4">
            L'ensemble du contenu du site [NOM_Site] (textes, images, graphismes, logo, icônes, etc.) est protégé par le Code de la propriété intellectuelle. Toute reproduction ou représentation est interdite sans l'autorisation écrite préalable de [NOM_Entreprise].
          </p>
        </section>

        {/* 5. Données personnelles & Cookies */}
        <section id="donnees-personnelles" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">5. Données personnelles & Cookies</h2>
          <p className="mb-4">
            Conformément au Règlement (UE) 2016/679 (RGPD) et à la loi n° 78‑17 du 6 janvier 1978 modifiée, vous disposez d'un droit d'accès, de rectification et de suppression des données vous concernant. Pour l'exercer, contactez : <a href="mailto:[EMAIL_Contact]" className="text-primary hover:underline">[EMAIL_Contact]</a> ou le DPO : [DPO_NOM] – <a href="mailto:[DPO_EMAIL]" className="text-primary hover:underline">[DPO_EMAIL]</a>.<br/>
            La gestion des cookies est détaillée dans la <a href="/politique-confidentialite" className="text-primary hover:underline">Politique de confidentialité</a>.
          </p>
        </section>

        {/* 6. Responsabilité */}
        <section id="responsabilite" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">6. Responsabilité</h2>
          <p className="mb-4">
            [NOM_Entreprise] ne saurait être tenu responsable des dommages directs ou indirects résultant de l'accès ou de l'utilisation du site et/ou de ces informations.
          </p>
        </section>

        {/* 7. Médiation à la consommation (si e‑commerce) */}
        <section id="mediation" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">7. Médiation à la consommation</h2>
          <p className="mb-4">
            En cas de litige, vous pouvez recourir gratuitement au service de médiation : [MEDIATEUR_NOM] – <a href="[MEDIATEUR_SITE]" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">[MEDIATEUR_SITE]</a>.
          </p>
        </section>

        {/* 8. Droit applicable */}
        <section id="droit-applicable" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">8. Droit applicable</h2>
          <p className="mb-4">Le site et ses mentions légales sont régis par le droit français.</p>
        </section>
      </div>
    </MainLayout>
  );
};

export default MentionsLegales;
