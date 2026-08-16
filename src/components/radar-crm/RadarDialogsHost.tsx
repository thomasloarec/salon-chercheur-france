import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExhibitorDetailDialog } from '@/components/event/ExhibitorDetailDialog';
import RadarCrmSettingsDialog from '@/components/radar-crm/RadarCrmSettingsDialog';
import AccessRequestDialog from '@/components/radar-crm/AccessRequestDialog';
import RadarMissionSheet from '@/components/radar-crm/RadarMissionSheet';
import { DEFAULT_RELATIONSHIP } from '@/lib/radarCrm/relationship';
import { useRadarWorkspace } from '@/contexts/RadarWorkspaceContext';

/**
 * Monte une seule fois les quatre dialogues partagés du Radar CRM.
 * Les états d'ouverture vivent dans RadarWorkspaceContext.
 */
const RadarDialogsHost: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    openExhibitor, setOpenExhibitor,
    mission, setMission,
    settingsOpen, setSettingsOpen,
    accessOpen, setAccessOpen,
    getRel, setRel, loadSpaceMeta, reloadAll, checkOfferProfile,
  } = useRadarWorkspace();

  // Ouvre le dialogue de réglages depuis le menu latéral (?panel=settings).
  React.useEffect(() => {
    if (searchParams.get('panel') === 'settings') setSettingsOpen(true);
  }, [searchParams, setSettingsOpen]);

  return (
    <>
      {openExhibitor && (
        <ExhibitorDetailDialog
          open={!!openExhibitor}
          onOpenChange={(o) => !o && setOpenExhibitor(null)}
          exhibitor={openExhibitor.exhibitor}
          event={openExhibitor.event}
        />
      )}
      <RadarCrmSettingsDialog
        open={settingsOpen}
        onOpenChange={(o) => {
          setSettingsOpen(o);
          if (!o) {
            void loadSpaceMeta();
            if (searchParams.get('panel')) {
              const next = new URLSearchParams(searchParams);
              next.delete('panel');
              setSearchParams(next, { replace: true });
            }
          }
        }}
        onDataDeleted={() => { void reloadAll(); }}
        onOfferProfileSaved={() => { void checkOfferProfile(); }}
      />
      <AccessRequestDialog open={accessOpen} onOpenChange={setAccessOpen} />
      <RadarMissionSheet
        target={mission?.target ?? null}
        open={!!mission}
        onOpenChange={(o) => { if (!o) setMission(null); }}
        relationship={mission ? getRel(mission.company) : DEFAULT_RELATIONSHIP}
        onChangeRelationship={(next) => (mission ? setRel(mission.company, next) : undefined)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    </>
  );
};

export default RadarDialogsHost;
