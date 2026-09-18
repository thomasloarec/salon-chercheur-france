import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSiteHealth, summarizeHealth } from '@/hooks/useSiteHealth';

/**
 * Bandeau global de santé affiché en haut de toute la zone admin.
 * Cliquable, mène à l'onglet Santé du site (/admin?tab=sante).
 */
const SiteHealthBanner = () => {
  const { data, isLoading, isError } = useSiteHealth();
  const location = useLocation();

  // Pas de bandeau sur l'onglet Santé du site lui-même
  const params = new URLSearchParams(location.search);
  if (params.get('tab') === 'sante') return null;

  if (isLoading || isError || !data) return null;

  const summary = summarizeHealth(data);

  const cls =
    summary.level === 'critical'
      ? 'bg-red-100 text-red-900 border-red-300 hover:bg-red-100/80'
      : summary.level === 'warn'
        ? 'bg-warning-surface text-warning-foreground border-warning/40 hover:bg-warning-surface/80'
        : 'bg-green-100 text-green-900 border-green-300 hover:bg-green-100/80';

  const label =
    summary.level === 'critical'
      ? `🔴 ${summary.critical} problème${summary.critical > 1 ? 's' : ''} critique${summary.critical > 1 ? 's' : ''}`
      : summary.level === 'warn'
        ? `🟠 ${summary.warn} alerte${summary.warn > 1 ? 's' : ''}`
        : '🟢 Tout va bien';

  return (
    <Link
      to="/admin?tab=sante"
      className={`block w-full border-b px-4 py-2 text-sm font-medium text-center transition-colors ${cls}`}
    >
      {label}
    </Link>
  );
};

export default SiteHealthBanner;
