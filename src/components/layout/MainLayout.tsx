
import React from 'react';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface MainLayoutProps {
  title?: string;
  /** Le title fourni est déjà complet (suffixe marque inclus) : ne rien ajouter. */
  rawTitle?: boolean;
  description?: string;
  canonical?: string;
  children: React.ReactNode;
}

const MainLayout = ({ title, rawTitle, description, canonical, children }: MainLayoutProps) => {
  const fullTitle = rawTitle && title
    ? title
    : title
      ? `${title} – Lotexpo`
      : 'Salons professionnels en France, lus par l\'IA | Lotexpo';
  const metaDescription = description || 'Créez votre agenda gratuit : l\'IA de Lotexpo lit les salons pros, leurs conférences et les Nouveautés des exposants, et vous signale ce qui compte.';

  return (
    <>
      <Helmet>
        <title>{fullTitle}</title>
        <meta name="description" content={metaDescription} />
        {canonical && <link rel="canonical" href={canonical} />}
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:site_name" content="Lotexpo" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Lotexpo",
            "url": "https://lotexpo.com"
          })}
        </script>
      </Helmet>
      <div className="min-h-screen flex flex-col w-full px-6 mx-auto">
        <Header />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </div>
    </>
  );
};

export default MainLayout;
