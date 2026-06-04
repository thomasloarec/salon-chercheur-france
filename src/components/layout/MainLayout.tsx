
import React from 'react';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface MainLayoutProps {
  title?: string;
  description?: string;
  canonical?: string;
  children: React.ReactNode;
}

const MainLayout = ({ title, description, canonical, children }: MainLayoutProps) => {
  const fullTitle = title ? `${title} – Lotexpo` : 'Lotexpo | Tous les salons professionnels en France';
  const metaDescription = description || 'Lotexpo centralise les salons professionnels B2B en France : découvrez les événements, repérez les exposants, suivez les nouveautés et préparez vos visites ou votre présence sur les salons.';

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
