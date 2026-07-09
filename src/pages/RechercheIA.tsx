import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import RechercheIAChat from '@/components/recherche-ia/RechercheIAChat';

const RechercheIA = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? undefined;
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Recherche IA — Posez votre question | Lotexpo</title>
        <meta
          name="description"
          content="Posez votre question : l'assistant IA de Lotexpo cherche parmi tous les salons B2B de France et leurs exposants les réponses qui comptent."
        />
        <link rel="canonical" href="https://lotexpo.com/recherche-ia" />
      </Helmet>
      <Header />

      <main className="flex-1 w-full px-6 mx-auto max-w-3xl py-8 flex flex-col">
        <RechercheIAChat variant="page" headingAs="h1" initialQuery={initialQuery} />
      </main>

      <Footer />
    </div>
  );
};

export default RechercheIA;
