import { Badge } from '@/components/ui/badge';

export type SeoStatus = 'good' | 'warning' | 'critical' | 'unknown';

const config: Record<SeoStatus, { label: string; emoji: string; className: string }> = {
  good: { label: 'OK', emoji: '✅', className: 'bg-green-100 text-green-800 border-green-200' },
  warning: { label: 'Attention', emoji: '⚠️', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  critical: { label: 'Critique', emoji: '🔴', className: 'bg-red-100 text-red-800 border-red-200' },
  unknown: { label: 'N/A', emoji: '⚪', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export function SeoStatusBadge({ status }: { status: SeoStatus }) {
  const c = config[status];
  return <Badge variant="outline" className={c.className}>{c.emoji} {c.label}</Badge>;
}

export function getSectionStatus(results: any, section: string): SeoStatus {
  if (!results) return 'unknown';
  const d = results[section];
  if (!d || d.error) return 'unknown';

  switch (section) {
    case 'crawlability':
      if (!d.robotsTxt?.exists || !d.sitemap?.exists) return 'critical';
      if (d.robotsTxt?.issues?.length > 0 || d.sitemap?.issues?.length > 0) return 'warning';
      return 'good';
    case 'performance': {
      const pages = d.pages || [];
      if (pages.some((p: any) => (p.mobile?.score ?? 100) < 50)) return 'critical';
      if (pages.some((p: any) => (p.mobile?.score ?? 100) < 80)) return 'warning';
      return pages.length > 0 ? 'good' : 'unknown';
    }
    case 'onpage':
      if (d.summary?.thinContentCount > 3) return 'critical';
      if (d.summary?.thinContentCount > 0) return 'warning';
      return 'good';
    case 'schema':
      if ((d.coverage?.eventSchemaPercent ?? 0) < 50) return 'critical';
      if ((d.coverage?.eventSchemaPercent ?? 0) < 80) return 'warning';
      return 'good';
    case 'urls':
      if ((d.summary?.withIssues ?? 0) > 10) return 'critical';
      if ((d.summary?.withIssues ?? 0) > 0) return 'warning';
      return 'good';
    case 'linking':
      if ((d.summary?.articlesLinkingPercentage ?? 0) < 30) return 'critical';
      if ((d.summary?.articlesLinkingPercentage ?? 0) < 70) return 'warning';
      return 'good';
    default:
      return 'unknown';
  }
}
