
import React from 'react';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface MainLayoutProps {
  title?: string;
  children: React.ReactNode;
}

const MainLayout = ({ title, children }: MainLayoutProps) => {
  return (
    <>
      {title && (
        <Helmet>
          <title>{title} - LotExpo</title>
        </Helmet>
      )}
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
