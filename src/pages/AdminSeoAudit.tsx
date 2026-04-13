import React, { useState } from 'react';
import { useSeoAudit } from '@/hooks/useSeoAudit';
import { useSeoAudit } from '@/hooks/useSeoAudit';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { SeoStatusBadge, getSectionStatus, type SeoStatus } from '@/components/seo-audit/SeoStatusBadge';
import CrawlabilitySection from '@/components/seo-audit/CrawlabilitySection';
import PerformanceSection from '@/components/seo-audit/PerformanceSection';
import OnPageSection from '@/components/seo-audit/OnPageSection';
import SchemaSection from '@/components/seo-audit/SchemaSection';
import UrlArchitectureSection from '@/components/seo-audit/UrlArchitectureSection';
import InternalLinkingSection from '@/components/seo-audit/InternalLinkingSection';
import ManualChecklistSection from '@/components/seo-audit/ManualChecklistSection';
import KeywordTrackingSection from '@/components/seo-audit/KeywordTrackingSection';
import QuickWinsSection from '@/components/seo-audit/QuickWinsSection';
import {
  Search, Zap, FileText, Code, Link2, CheckSquare, Target, Rocket,
  Download, RefreshCw, Globe
} from 'lucide-react';

const SECTIONS = [
  { id: 'crawlability', label: 'Crawlabilité', icon: Globe, dataKey: 'crawlability' },
  { id: 'performance', label: 'Performance', icon: Zap, dataKey: 'performance' },
  { id: 'onpage', label: 'On-Page', icon: FileText, dataKey: 'onpage' },
  { id: 'schema', label: 'Données Structurées', icon: Code, dataKey: 'schema' },
  { id: 'urls', label: 'Architecture URL', icon: Search, dataKey: 'urls' },
  { id: 'linking', label: 'Maillage Interne', icon: Link2, dataKey: 'linking' },
  { id: 'checklist', label: 'Checklist', icon: CheckSquare, dataKey: null },
  { id: 'keywords', label: 'Mots-Clés', icon: Target, dataKey: null },
  { id: 'quickwins', label: 'Quick Wins', icon: Rocket, dataKey: null },
];

const AdminSeoAudit = () => {
  const audit = useSeoAudit();
  const [activeSection, setActiveSection] = useState('crawlability');

  const results = audit.lastScan?.results;

  return (
    <div>
      <div className="flex min-h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <nav className="hidden lg:block w-56 border-r bg-card p-4 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Sections</h3>
          <div className="space-y-1">
            {SECTIONS.map(s => {
              const status = s.dataKey ? getSectionStatus(results, s.dataKey) : 'unknown';
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSection(s.id);
                    document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors
                    ${activeSection === s.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-1">{s.label}</span>
                  {s.dataKey && (
                    <span className="text-xs">
                      {status === 'good' && '✅'}
                      {status === 'warning' && '⚠️'}
                      {status === 'critical' && '🔴'}
                      {status === 'unknown' && '⚪'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Main */}
        <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto space-y-8 overflow-x-hidden">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Audit SEO — Lotexpo</h1>
                {audit.lastScan && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Dernier scan : {new Date(audit.lastScan.created_at).toLocaleString('fr-FR')}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={audit.runScan} disabled={audit.scanning}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${audit.scanning ? 'animate-spin' : ''}`} />
                  {audit.scanning ? 'Scan en cours...' : 'Scanner maintenant'}
                </Button>
                {audit.lastScan && (
                  <Button variant="outline" onClick={audit.exportReport}>
                    <Download className="h-4 w-4 mr-2" /> Exporter JSON
                  </Button>
                )}
              </div>
            </div>

            {/* Scan progress */}
            {audit.scanning && (
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{audit.phaseLabel}</span>
                    <span>{Math.round(audit.progress)}%</span>
                  </div>
                  <Progress value={audit.progress} />
                </CardContent>
              </Card>
            )}

            {/* Comparison toggle */}
            {audit.previousScan && (
              <div className="flex items-center gap-2 text-sm">
                <Switch
                  checked={audit.showComparison}
                  onCheckedChange={audit.setShowComparison}
                />
                <span className="text-muted-foreground">Comparer avec le scan précédent</span>
              </div>
            )}
          </div>

          {/* Mobile section selector */}
          <div className="lg:hidden overflow-x-auto">
            <div className="flex gap-1 pb-2">
              {SECTIONS.map(s => {
                const Icon = s.icon;
                return (
                  <Button
                    key={s.id}
                    variant={activeSection === s.id ? 'default' : 'outline'}
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => {
                      setActiveSection(s.id);
                      document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <Icon className="h-3 w-3 mr-1" /> {s.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Sections */}
          <section id="section-crawlability"><CrawlabilitySection data={results} /></section>
          <hr className="border-dashed" />
          <section id="section-performance"><PerformanceSection data={results} /></section>
          <hr className="border-dashed" />
          <section id="section-onpage"><OnPageSection data={results} /></section>
          <hr className="border-dashed" />
          <section id="section-schema"><SchemaSection data={results} /></section>
          <hr className="border-dashed" />
          <section id="section-urls"><UrlArchitectureSection data={results} /></section>
          <hr className="border-dashed" />
          <section id="section-linking"><InternalLinkingSection data={results} /></section>
          <hr className="border-dashed" />
          <section id="section-checklist"><ManualChecklistSection /></section>
          <hr className="border-dashed" />
          <section id="section-keywords"><KeywordTrackingSection /></section>
          <hr className="border-dashed" />
          <section id="section-quickwins"><QuickWinsSection /></section>
        </main>
      </div>
    </div>
  );
};

export default AdminSeoAudit;
