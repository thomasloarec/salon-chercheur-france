import { useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';

import Header from '@/components/Header';
import Footer from '@/components/Footer';

import { useExhibitorProfile } from '@/hooks/useExhibitorProfile';
import ExhibitorProfileSEO from '@/components/exhibitor/ExhibitorProfileSEO';
import ExhibitorProfileSkeleton from '@/components/exhibitor/ExhibitorProfileSkeleton';
import ExhibitorNotFoundView from '@/components/exhibitor/ExhibitorNotFoundView';
import ExhibitorHero from '@/components/exhibitor/ExhibitorHero';
import ExhibitorStats from '@/components/exhibitor/ExhibitorStats';
import ExhibitorUpcomingEvents from '@/components/exhibitor/ExhibitorUpcomingEvents';
import ExhibitorNovelties from '@/components/exhibitor/ExhibitorNovelties';
import ExhibitorParticipationHistory from '@/components/exhibitor/ExhibitorParticipationHistory';
import ExhibitorAbout from '@/components/exhibitor/ExhibitorAbout';
import ExhibitorTrustInfo from '@/components/exhibitor/ExhibitorTrustInfo';
import { trackExhibitorEvent } from '@/lib/exhibitorTracking';

/* --------------------------------- Page ---------------------------------- */

export default function ExhibitorProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { data: profile, isLoading, isError } = useExhibitorProfile(slug);

  // Analytics: fire profile_view exactly once per mount, as soon as a
  // visible (non-test) profile is available. The ref guard guarantees a
  // single call regardless of rerenders.
  const profileSlug = profile?.public_slug;
  const isVisibleProfile = !!profile && profile.is_test !== true;
  const viewTracked = useRef(false);
  useEffect(() => {
    if (!viewTracked.current && isVisibleProfile && profileSlug) {
      viewTracked.current = true;
      trackExhibitorEvent('profile_view', profileSlug);
    }
  }, [isVisibleProfile, profileSlug]);

  const hasAnyActivity = useMemo(() => {
    if (!profile) return false;
    return (
      (profile.future_participations_count ?? 0) > 0 ||
      (profile.past_participations_count ?? 0) > 0 ||
      (profile.published_novelties_count ?? 0) > 0 ||
      (profile.total_participations ?? 0) > 0
    );
  }, [profile]);

  // Product decision: test profiles 404 for everyone (incl. admins).
  const notFound = !isLoading && (isError || !profile || profile.is_test === true);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {isLoading ? (
          <ExhibitorProfileSkeleton />
        ) : notFound || !profile ? (
          <ExhibitorNotFoundView />
        ) : (
          <>
            <ExhibitorProfileSEO profile={profile} />
            <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
              {/* A. Header exposant — pleine largeur */}
              <ExhibitorHero profile={profile} hasAnyActivity={hasAnyActivity} />

              {/* B. Statistiques principales — pleine largeur */}
              {hasAnyActivity && <ExhibitorStats profile={profile} />}

              {/* C. Layout 2 colonnes (desktop) / 1 colonne (mobile) */}
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-8 space-y-8">
                  <ExhibitorUpcomingEvents profile={profile} />
                  <ExhibitorNovelties profile={profile} />
                  {/* Historique complet des participations (passées + à venir),
                      avec liens internes crawlables vers /events/:slug. */}
                  <ExhibitorParticipationHistory profile={profile} />
                  {/* À propos : ne s'affiche que si le contenu n'est pas redondant
                      avec la description du header (sécurité SEO garantie côté composant). */}
                  <ExhibitorAbout profile={profile} />
                </div>

                <aside className="col-span-12 lg:col-span-4 space-y-6">
                  <ExhibitorTrustInfo profile={profile} />
                </aside>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}