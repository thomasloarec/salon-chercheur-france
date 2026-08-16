import React from 'react';
import RadarPageGate from '@/components/radar-crm/RadarPageGate';
import CompanyAccountsList from '@/components/radar-crm/RadarCompanyAccountsList';
import { useRadarWorkspace } from '@/contexts/RadarWorkspaceContext';

const RadarAccountsPage: React.FC = () => {
  const {
    eventGroups, matchedCompanies, getPref, setPref, getRel, setRel,
    onClickEvent, onOpenMission,
  } = useRadarWorkspace();

  return (
    <div className="font-body bg-muted/10 min-h-[calc(100vh-200px)]">
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-14 space-y-8">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Mes comptes</h1>
        <RadarPageGate>
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
        </RadarPageGate>
      </div>
    </div>
  );
};

export default RadarAccountsPage;
