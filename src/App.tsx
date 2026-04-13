
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/hooks/use-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import ScrollToTop from '@/components/ScrollToTop';
import SiteGuard from '@/components/auth/SiteGuard';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import Events from '@/pages/Events';
import HowItWorks from '@/pages/HowItWorks';
import EventPage from '@/pages/EventPage';
import Favorites from '@/pages/Favorites';
import Profile from '@/pages/Profile';
import Auth from '@/pages/Auth';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminOverview from '@/pages/admin/AdminOverview';
import AdminEventsPage from '@/pages/admin/AdminEventsPage';
import AdminEventsSeoPage from '@/pages/admin/AdminEventsSeoPage';
import AdminEventsDiagnosticsPage from '@/pages/admin/AdminEventsDiagnosticsPage';
import AdminNoveltiesPage from '@/pages/admin/AdminNoveltiesPage';
import AdminSystemAiPage from '@/pages/admin/AdminSystemAiPage';
import AdminSystemTestPage from '@/pages/admin/AdminSystemTestPage';
import AdminSystemToolsPage from '@/pages/admin/AdminSystemToolsPage';
import AdminEventDetail from '@/pages/AdminEventDetail';
import AdminExhibitorClaims from '@/pages/AdminExhibitorClaims';
import AdminExhibitors from '@/pages/AdminExhibitors';
import AdminExhibitorCreateRequests from '@/pages/AdminExhibitorCreateRequests';
import AdminImportDiagnostics from '@/pages/AdminImportDiagnostics';
import AdminSeoAudit from '@/pages/AdminSeoAudit';
import AdminIaVisite from '@/pages/AdminIaVisite';
import CrmIntegrations from '@/pages/CrmIntegrations';
import { OAuthCallback } from '@/pages/OAuthCallback';
import OAuthHubspotTest from '@/pages/OAuthHubspotTest';
import LegacyHubspotApiCallback from '@/pages/LegacyHubspotApiCallback';
import ScrapingTest from '@/pages/ScrapingTest';
import Agenda from '@/pages/Agenda';
import Nouveautes from '@/pages/Nouveautes';
import Notifications from '@/pages/Notifications';
import Exposants from '@/pages/Exposants';
import PublierNouveaute from '@/pages/PublierNouveaute';
import CGU from '@/pages/CGU';
import MentionsLegales from '@/pages/MentionsLegales';
import PolitiqueConfidentialite from '@/pages/PolitiqueConfidentialite';
import Contact from '@/pages/Contact';
import AdminEventByText from '@/pages/AdminEventByText';
import AdminBlog from '@/pages/AdminBlog';
import AdminBlogEdit from '@/pages/AdminBlogEdit';
import Blog from '@/pages/Blog';
import BlogArticle from '@/pages/BlogArticle';
import NotFound from '@/pages/NotFound';
import SectorHub from '@/pages/SectorHub';
import CityHub from '@/pages/CityHub';
import './App.css';

// Global listener for pending visit plan redirect after OAuth
function PendingVisitRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (e: Event) => {
      const slug = (e as CustomEvent).detail?.slug;
      if (slug) {
        navigate(`/events/${slug}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
      setTimeout(() => {
        toast({ title: 'Votre liste a bien été enregistrée dans Mon Agenda ✓' });
      }, 500);
    };
    window.addEventListener('pending-visit-saved', handler);
    return () => window.removeEventListener('pending-visit-saved', handler);
  }, [navigate]);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SiteGuard>
          <Router>
            <ScrollToTop />
              <PendingVisitRedirect />
            <div className="App">
              <Routes>
              <Route path="/" element={<Events />} />
              <Route path="/comment-ca-marche" element={<HowItWorks />} />
              <Route path="/events/:slug" element={<EventPage />} />
            <Route path="/nouveautes" element={<Nouveautes />} />
            <Route path="/exposants" element={<Exposants />} />
            <Route path="/premium" element={<Exposants />} />
            <Route path="/publier-nouveaute" element={<PublierNouveaute />} />

            {/* Admin routes with sidebar layout */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="events" element={<AdminEventsPage />} />
              <Route path="events/seo" element={<AdminEventsSeoPage />} />
              <Route path="events/diagnostics" element={<AdminEventsDiagnosticsPage />} />
              <Route path="events/:id" element={<AdminEventDetail />} />
              <Route path="events/by-text/:id_event_text" element={<AdminEventByText />} />
              <Route path="novelties" element={<AdminNoveltiesPage />} />
              <Route path="blog" element={<AdminBlog />} />
              <Route path="blog/new" element={<AdminBlogEdit />} />
              <Route path="blog/edit/:id" element={<AdminBlogEdit />} />
              <Route path="exhibitors" element={<AdminExhibitors />} />
              <Route path="exhibitors/claims" element={<AdminExhibitorClaims />} />
              <Route path="exhibitors/create-requests" element={<AdminExhibitorCreateRequests />} />
              <Route path="import-diagnostics" element={<AdminImportDiagnostics />} />
              <Route path="seo-audit" element={<AdminSeoAudit />} />
              <Route path="ia-visite" element={<AdminIaVisite />} />
              <Route path="system/ai" element={<AdminSystemAiPage />} />
              <Route path="system/test" element={<AdminSystemTestPage />} />
              <Route path="system/tools" element={<AdminSystemToolsPage />} />
            </Route>

              <Route path="/auth" element={<Auth />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogArticle />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/cgu" element={<CGU />} />
              <Route path="/mentions-legales" element={<MentionsLegales />} />
              <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/crm-integrations" element={<CrmIntegrations />} />
              <Route path="/oauth/callback" element={<OAuthCallback />} />
              <Route path="/oauth/hubspot/callback" element={<OAuthCallback />} />
              <Route path="/oauth/hubspot/test" element={<OAuthHubspotTest />} />
              <Route path="/api/oauth/hubspot/callback" element={<LegacyHubspotApiCallback />} />
               <Route path="/secteur/:slug" element={<SectorHub />} />
               <Route path="/ville/:slug" element={<CityHub />} />
               <Route path="*" element={<NotFound />} />
              </Routes>
              <OnboardingTour />
              <Toaster />
            </div>
          </Router>
        </SiteGuard>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
