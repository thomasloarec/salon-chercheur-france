
import { Helmet } from 'react-helmet-async';
import MainLayout from '@/components/layout/MainLayout';

const MentionsLegales = () => {
  return (
    <MainLayout title="Mentions Légales">
      <Helmet>
        <meta name="description" content="Mentions légales de Lotexpo - Informations légales obligatoires conformes à la législation française" />
      </Helmet>
      
      <div className="container mx-auto px-4 py-8 prose prose-lg max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-primary">Mentions Légales</h1>

        {/* 1. Identification de l'éditeur */}
        <section id="identification" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">1. Éditeur du site</h2>
          <p className="mb-4">
            <strong>Cécile Noël</strong> – CECILE NOEL COMMUNICATION (entrepreneur individuel, EI)<br/>
            Adresse : 12 allée des Longrais, 14200 Hérouville Saint Clair<br/>
            Téléphone : <a href="tel:0623765293" className="text-primary hover:underline">06.23.76.52.93</a><br/>
            E‑mail : <a href="mailto:admin@lotexpo.com" className="text-primary hover:underline">admin@lotexpo.com</a><br/>
            Numéro SIREN : 929562320<br/>
            TVA intracommunautaire : FR22929562320
          </p>
        </section>

        {/* 2. Directeur de publication */}
        <section id="publication" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">2. Directrice de la publication</h2>
          <p className="mb-4">Cécile Noël</p>
        </section>

        {/* 3. Hébergeur */}
        <section id="hebergeur" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">3. Hébergeur</h2>
          <p className="mb-4">
            GoDaddy<br/>
            003, Tower 4A, DLF Corporate Park, MG Road Gurgaon Gurgaon HR IN 122002<br/>
            Téléphone : <a href="tel:0970019353" className="text-primary hover:underline">09 70 01 93 53</a>
          </p>
        </section>

        {/* 4. Propriété intellectuelle */}
        <section id="propriete-intellectuelle" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">4. Propriété intellectuelle</h2>
          <p className="mb-4">
            L'ensemble du contenu du site Lotexpo (textes, images, graphismes, logo, icônes, etc.) est protégé par le Code de la propriété intellectuelle. Toute reproduction ou représentation est interdite sans l'autorisation écrite préalable de CECILE NOEL COMMUNICATION.
          </p>
        </section>

        {/* 5. Données personnelles & Cookies */}
        <section id="donnees-personnelles" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">5. Données personnelles & Cookies</h2>
          <p className="mb-4">
            Conformément au Règlement (UE) 2016/679 (RGPD) et à la loi n° 78‑17 du 6 janvier 1978 modifiée, vous disposez d'un droit d'accès, de rectification et de suppression des données vous concernant. Pour l'exercer, contactez : <a href="mailto:admin@lotexpo.com" className="text-primary hover:underline">admin@lotexpo.com</a>.<br/>
            La gestion des cookies est détaillée dans la <a href="/politique-confidentialite" className="text-primary hover:underline">Politique de confidentialité</a>.
          </p>
        </section>

        {/* 6. Responsabilité */}
        <section id="responsabilite" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">6. Responsabilité</h2>
          <p className="mb-4">
            CECILE NOEL COMMUNICATION ne saurait être tenu responsable des dommages directs ou indirects résultant de l'accès ou de l'utilisation du site et/ou de ces informations.
          </p>
        </section>

        {/* 7. Droit applicable */}
        <section id="droit-applicable" className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">7. Droit applicable</h2>
          <p className="mb-4">Le site et ses mentions légales sont régis par le droit français.</p>
        </section>

        <p className="text-sm text-muted-foreground mt-8">Dernière mise à jour : 08/01/2026</p>
      </div>
    </MainLayout>
  );
};

export default MentionsLegales;
