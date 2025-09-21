
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import ScrollToTop from '@/components/ScrollToTop';
import Index from '@/pages/Index';
import Events from '@/pages/Events';
import EventPage from '@/pages/EventPage';
import Favorites from '@/pages/Favorites';
import Profile from '@/pages/Profile';
import Auth from '@/pages/Auth';
import Admin from '@/pages/Admin';
import AdminEventDetail from '@/pages/AdminEventDetail';
import CrmIntegrations from '@/pages/CrmIntegrations';
import { OAuthCallback } from '@/pages/OAuthCallback';
import OAuthHubspotTest from '@/pages/OAuthHubspotTest';
import LegacyHubspotApiCallback from '@/pages/LegacyHubspotApiCallback';
import ScrapingTest from '@/pages/ScrapingTest';
import Agenda from '@/pages/Agenda';
import Nouveautes from '@/pages/Nouveautes';
import AdminExhibitorClaims from '@/pages/AdminExhibitorClaims';
import AdminExhibitorCreateRequests from '@/pages/AdminExhibitorCreateRequests';
import CGU from '@/pages/CGU';
import MentionsLegales from '@/pages/MentionsLegales';
import PolitiqueConfidentialite from '@/pages/PolitiqueConfidentialite';
import NotFound from '@/pages/NotFound';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchInterval: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <div className="App">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/:slug" element={<EventPage />} />
            <Route path="/nouveautes" element={<Nouveautes />} />
            <Route path="/admin/exhibitors/claims" element={<AdminExhibitorClaims />} />
            <Route path="/admin/exhibitors/create-requests" element={<AdminExhibitorCreateRequests />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/events/:id" element={<AdminEventDetail />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/cgu" element={<CGU />} />
              <Route path="/mentions-legales" element={<MentionsLegales />} />
              <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
              <Route path="/crm-integrations" element={<CrmIntegrations />} />
              <Route path="/oauth/callback" element={<OAuthCallback />} />
              <Route path="/oauth/hubspot/callback" element={<OAuthCallback />} />
              <Route path="/oauth/hubspot/test" element={<OAuthHubspotTest />} />
              <Route path="/api/oauth/hubspot/callback" element={<LegacyHubspotApiCallback />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
