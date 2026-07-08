import React from 'react';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import RechercheIAChat from '@/components/recherche-ia/RechercheIAChat';

const RechercheIA = () => {
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Helmet>
        <title>Recherche IA — Trouvez vos salons | Lotexpo</title>
        <meta
          name="description"
          content="Décrivez votre besoin, l'assistant IA de Lotexpo trouve les bons salons professionnels et exposants à visiter. L'IA lit. Vous décidez."
        />
        <link rel="canonical" href="https://lotexpo.com/recherche-ia" />
      </Helmet>
      <Header />

      <main className="flex-1 min-h-0 w-full px-6 mx-auto max-w-3xl py-8 flex flex-col">
        <RechercheIAChat variant="page" headingAs="h1" />
      </main>

      <Footer />
    </div>
  );
};

export default RechercheIA;
