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
            <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
              <ExhibitorHero profile={profile} hasAnyActivity={hasAnyActivity} />
              {hasAnyActivity && <ExhibitorStats profile={profile} />}
              <ExhibitorUpcomingEvents profile={profile} />
              <ExhibitorNovelties profile={profile} />
              <ExhibitorAbout profile={profile} />
              <ExhibitorTrustInfo profile={profile} />
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}