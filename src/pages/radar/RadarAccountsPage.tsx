import React from 'react';
import RadarPageGate from '@/components/radar-crm/RadarPageGate';
import CompanyAccountsList from '@/components/radar-crm/RadarCompanyAccountsList';
import { useRadarWorkspace } from '@/contexts/RadarWorkspaceContext';

const RadarAccountsPage: React.FC = () => {
  const {
    eventGroups, matchedCompanies, getPref, setPref, getRel, setRel,
    onClickEvent, onOpenMission, radarView,
  } = useRadarWorkspace();

  const summary = radarView?.summary;
  const measures: Array<{ label: string; value: number }> = [
    { label: 'Entreprises analysées', value: summary?.companies_analyzed ?? 0 },
    { label: 'Entreprises détectées', value: summary?.companies_detected ?? matchedCompanies.length },
    { label: 'Salons à venir', value: summary?.future_salons ?? 0 },
    { label: 'Participations futures', value: summary?.future_participations ?? 0 },
  ];

  return (
    <div className="font-body bg-muted/10 min-h-[calc(100vh-200px)]">
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-14 space-y-8">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Mes comptes</h1>
        <RadarPageGate>
          <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 border-y border-border/60 py-4 mb-8">
            {measures.map((m) => (
              <div key={m.label}>
                <p className="font-display text-xl font-semibold leading-none text-foreground">{m.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
              </div>
            ))}
          </div>
          <CompanyAccountsList
            groups={eventGroups}
            companies={matchedCompanies}
            onClickEvent={onClickEvent}
            getPref={getPref}
            onSetPref={setPref}
            getRel={getRel}
            onSetRel={setRel}
            onOpenMission={(company, g) => {
              const cc = g.companies.find((x) => x.company.id === company.id);
              onOpenMission(company, cc?.stand ?? null, g, cc?.nom_exposant ?? null);
            }}
          />
          </>
        </RadarPageGate>
      </div>
    </div>
  );
};

export default RadarAccountsPage;
