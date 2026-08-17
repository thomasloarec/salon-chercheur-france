import React from 'react';
import { ExhibitorDetailDialog } from '@/components/event/ExhibitorDetailDialog';
import AccessRequestDialog from '@/components/radar-crm/AccessRequestDialog';
import RadarMissionSheet from '@/components/radar-crm/RadarMissionSheet';
import { DEFAULT_RELATIONSHIP } from '@/lib/radarCrm/relationship';
import { useRadarWorkspace } from '@/contexts/RadarWorkspaceContext';

/**
 * Monte une seule fois les quatre dialogues partagés du Radar CRM.
 * Les états d'ouverture vivent dans RadarWorkspaceContext.
 */
const RadarDialogsHost: React.FC = () => {
  const navigate = useNavigate();
  const {
    openExhibitor, setOpenExhibitor,
    mission, setMission,
    accessOpen, setAccessOpen,
    getRel, setRel,
  } = useRadarWorkspace();


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
      <AccessRequestDialog open={accessOpen} onOpenChange={setAccessOpen} />
      <RadarMissionSheet
        target={mission?.target ?? null}
        open={!!mission}
        onOpenChange={(o) => { if (!o) setMission(null); }}
        relationship={mission ? getRel(mission.company) : DEFAULT_RELATIONSHIP}
        onChangeRelationship={(next) => (mission ? setRel(mission.company, next) : undefined)}
      />
    </>
  );
};

export default RadarDialogsHost;
