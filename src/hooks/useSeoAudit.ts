import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const db = supabase as any;

export interface ScanResults {
  crawlability?: any;
  onpage?: any;
  schema?: any;
  urls?: any;
  linking?: any;
  performance?: any;
}

export interface SeoScan {
  id: string;
  created_at: string;
  completed_at: string | null;
  status: string;
  phase: string;
  results: ScanResults;
}

const PHASES = ['crawlability', 'onpage', 'schema', 'urls', 'linking'];

const PHASE_LABELS: Record<string, string> = {
  crawlability: 'Analyse robots.txt & sitemap...',
  onpage: 'Audit on-page SEO...',
  schema: 'Vérification données structurées...',
  urls: 'Analyse architecture URL...',
  linking: 'Analyse maillage interne...',
  performance: 'Tests PageSpeed Insights...',
  completed: 'Scan terminé',
};

export function useSeoAudit() {
  const [lastScan, setLastScan] = useState<SeoScan | null>(null);
  const [previousScan, setPreviousScan] = useState<SeoScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('');
  const [progress, setProgress] = useState(0);
  const [showComparison, setShowComparison] = useState(false);

  const loadScans = useCallback(async () => {
    const { data } = await db
      .from('seo_scans')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(2);

    if (data?.length > 0) {
      setLastScan(data[0]);
      if (data.length > 1) setPreviousScan(data[1]);
    }
  }, []);

  useEffect(() => { loadScans(); }, [loadScans]);

  const runScan = useCallback(async () => {
    setScanning(true);
    setProgress(0);

    const { data: scan, error } = await db
      .from('seo_scans')
      .insert({ status: 'running', phase: 'starting', results: {} })
      .select()
      .single();

    if (error || !scan) {
      toast({ title: 'Erreur', description: 'Impossible de démarrer le scan', variant: 'destructive' });
      setScanning(false);
      return;
    }

    const scanId = scan.id;
    const totalPhases = PHASES.length + 1; // +1 for performance
    let accResults: ScanResults = {};

    for (let i = 0; i < PHASES.length; i++) {
      const phase = PHASES[i];
      setCurrentPhase(phase);
      setProgress(Math.round((i / totalPhases) * 100));

      try {
        const { data: result, error } = await supabase.functions.invoke('seo-audit-scan', {
          body: { phase, scanId },
        });
        if (error) throw error;
        accResults[phase as keyof ScanResults] = result.results;
      } catch (e: any) {
        console.error(`Phase ${phase} failed:`, e);
        accResults[phase as keyof ScanResults] = { error: e.message || 'Erreur inconnue' };
      }
    }

    // Performance (client-side PageSpeed API)
    setCurrentPhase('performance');
    setProgress(Math.round((PHASES.length / totalPhases) * 100));
    try {
      accResults.performance = await runPageSpeedTests();
    } catch (e: any) {
      accResults.performance = { error: e.message };
    }

    await db.from('seo_scans').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      results: accResults,
      phase: 'completed',
    }).eq('id', scanId);

    // Clean old scans (keep last 3)
    const { data: allScans } = await db
      .from('seo_scans')
      .select('id')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (allScans && allScans.length > 3) {
      const toDelete = allScans.slice(3).map((s: any) => s.id);
      await db.from('seo_scans').delete().in('id', toDelete);
    }

    setProgress(100);
    setCurrentPhase('completed');
    setScanning(false);
    await loadScans();
    toast({ title: 'Scan terminé', description: 'Le rapport SEO est prêt.' });
  }, [loadScans]);

  const exportReport = useCallback(() => {
    if (!lastScan) return;
    const report = {
      exportDate: new Date().toISOString(),
      scanDate: lastScan.created_at,
      results: lastScan.results,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lotexpo-seo-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [lastScan]);

  return {
    lastScan, previousScan, scanning, currentPhase, progress,
    showComparison, setShowComparison, runScan, exportReport,
    phaseLabel: PHASE_LABELS[currentPhase] || currentPhase,
  };
}

async function runPageSpeedTests() {
  const pages = [
    { name: 'Accueil', url: 'https://lotexpo.com/' },
    { name: 'Blog', url: 'https://lotexpo.com/blog' },
  ];

  const results = [];
  for (const page of pages) {
    try {
      const [mobileData, desktopData] = await Promise.all([
        fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(page.url)}&strategy=mobile&category=performance`).then(r => r.json()),
        fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(page.url)}&strategy=desktop&category=performance`).then(r => r.json()),
      ]);
      results.push({
        name: page.name,
        url: page.url,
        mobile: extractMetrics(mobileData),
        desktop: extractMetrics(desktopData),
      });
    } catch (e: any) {
      results.push({ name: page.name, url: page.url, error: e.message });
    }
  }
  return { pages: results };
}

function extractMetrics(data: any) {
  const lhr = data?.lighthouseResult;
  if (!lhr) return null;
  const a = lhr.audits || {};
  return {
    score: Math.round((lhr.categories?.performance?.score || 0) * 100),
    lcp: a['largest-contentful-paint']?.numericValue,
    fcp: a['first-contentful-paint']?.numericValue,
    cls: a['cumulative-layout-shift']?.numericValue,
    inp: a['interaction-to-next-paint']?.numericValue || a['total-blocking-time']?.numericValue,
    ttfb: a['server-response-time']?.numericValue,
  };
}
