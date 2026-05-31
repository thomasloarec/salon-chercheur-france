import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackExhibitorEvent } from '@/lib/exhibitorTracking';

export type FullProfileSurface =
  | 'event_exhibitor_modal'
  | 'event_exhibitor_list'
  | 'novelty_card';

interface ExhibitorFullProfileCTAProps {
  /** Public slug from exhibitor_public_identities. CTA is hidden when absent. */
  publicSlug?: string | null;
  /** When false, the link gets rel="nofollow" to save crawl budget. */
  seoIndexable?: boolean;
  /** Test identities must never produce a public link. */
  isTest?: boolean;
  /** Open in a new tab (true on event pages to preserve context). */
  openInNewTab?: boolean;
  /** Analytics surface for full_profile_click tracking. */
  surface: FullProfileSurface;
  /** Optional event slug for analytics metadata. */
  eventSlug?: string;
  /** Render a discreet inline link instead of a full button. */
  variant?: 'button' | 'link';
  className?: string;
  label?: string;
  onNavigate?: () => void;
}

/**
 * Phase 4B — "Voir la fiche complète" CTA towards /exposants/:slug.
 * - Hidden when no public slug or when the identity is a test record.
 * - Adds rel="nofollow" for noindex profiles (keeps UX, saves crawl budget).
 * - Real crawlable <a> link; tracks full_profile_click (fire-and-forget).
 */
export const ExhibitorFullProfileCTA: React.FC<ExhibitorFullProfileCTAProps> = ({
  publicSlug,
  seoIndexable = true,
  isTest = false,
  openInNewTab = false,
  surface,
  eventSlug,
  variant = 'button',
  className,
  label = 'Voir la fiche complète',
  onNavigate,
}) => {
  if (!publicSlug || isTest) return null;

  const href = `/exposants/${publicSlug}`;

  // rel: always noopener/noreferrer when opening a new tab; nofollow when noindex.
  const relParts: string[] = [];
  if (openInNewTab) relParts.push('noopener', 'noreferrer');
  if (!seoIndexable) relParts.push('nofollow');
  const rel = relParts.length > 0 ? relParts.join(' ') : undefined;

  const handleClick = () => {
    trackExhibitorEvent('full_profile_click', publicSlug, {
      source_surface: surface,
      public_slug: publicSlug,
      ...(eventSlug ? { event_slug: eventSlug } : {}),
    });
    onNavigate?.();
  };

  if (variant === 'link') {
    return (
      <a
        href={href}
        target={openInNewTab ? '_blank' : undefined}
        rel={rel}
        onClick={handleClick}
        className={cn(
          'inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline',
          className,
        )}
      >
        {label}
        <ArrowUpRight className="h-3 w-3" />
      </a>
    );
  }

  return (
    <Button asChild variant="secondary" className={className}>
      <a
        href={href}
        target={openInNewTab ? '_blank' : undefined}
        rel={rel}
        onClick={handleClick}
      >
        {label}
        <ArrowUpRight className="ml-1 h-4 w-4" />
      </a>
    </Button>
  );
};

export default ExhibitorFullProfileCTA;