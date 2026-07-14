import React from 'react';
import { SeoEnrichmentPanel } from '@/components/admin/SeoEnrichmentPanel';
import { EnrichedDescriptionValidation } from '@/components/admin/EnrichedDescriptionValidation';
import { SeoEnrichmentDashboard } from '@/components/admin/SeoEnrichmentDashboard';
import { SeoEnrichmentSimple } from '@/components/admin/SeoEnrichmentSimple';

const AdminEventsSeoPage = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Enrichissement SEO</h1>
      <SeoEnrichmentSimple />
      <details className="rounded-lg border bg-muted/20 p-4">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
          Outils avancés
        </summary>
        <div className="mt-4 space-y-6">
          <SeoEnrichmentDashboard />
          <EnrichedDescriptionValidation />
          <SeoEnrichmentPanel />
        </div>
      </details>
    </div>
  );
};

export default AdminEventsSeoPage;
