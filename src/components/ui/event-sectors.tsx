import React from 'react';
import { SectorBadge } from './sector-badge';
import { useEventSectors } from '@/hooks/useSectors';
import type { Event } from '@/types/event';

interface EventSectorsProps {
  event: Event;
  className?: string;
  sectorClassName?: string;
}

// Fonction utilitaire pour parser les secteurs depuis le champ secteur JSONB
const parseSectorsFromJson = (secteur: string | string[] | any): string[] => {
  if (!secteur) return [];
  
  let sectors = [];
  
  if (Array.isArray(secteur)) {
    sectors = secteur;
  } else if (typeof secteur === 'string') {
    // Si c'est une string qui contient du JSON
    if (secteur.startsWith('[') && secteur.endsWith(']')) {
      try {
        const parsed = JSON.parse(secteur);
        sectors = Array.isArray(parsed) ? parsed : [secteur];
      } catch {
        sectors = [secteur];
      }
    } else {
      sectors = [secteur];
    }
  }
  
  // Nettoyer les secteurs - gérer les structures [["secteur"]] et ["secteur1", "secteur2"]
  const cleanedSectors = [];
  for (const sector of sectors) {
    if (Array.isArray(sector)) {
      // Structure [["secteur"]] - prendre le premier élément de chaque sous-tableau
      cleanedSectors.push(...sector);
    } else if (typeof sector === 'string') {
      // Structure ["secteur1", "secteur2"] - garder tel quel
      const cleaned = sector.replace(/^\["|"\]$/g, '').replace(/"/g, '');
      if (cleaned) cleanedSectors.push(cleaned);
    }
  }
  
  return cleanedSectors.filter(Boolean);
};

export const EventSectors = ({ event, className = "", sectorClassName = "" }: EventSectorsProps) => {
  // Priorité 1 : Utiliser la table normalisée event_sectors
  const { data: eventSectors = [] } = useEventSectors(event.id_event || '');
  
  // Debug temporaire
  console.log('EventSectors - Event:', event.nom_event, 'id_event:', event.id_event, 'eventSectors:', eventSectors);
  
  // Priorité 2 : Fallback sur le parsing du champ JSONB secteur  
  const sectorsFromJson = eventSectors.length === 0 ? parseSectorsFromJson(event.secteur) : [];
  
  if (eventSectors.length > 0) {
    // Utiliser les secteurs de la table normalisée
    const sectorNames = eventSectors.map(s => s.name);
    return (
      <div className={className}>
        <SectorBadge label={sectorNames} className={sectorClassName} />
      </div>
    );
  } else if (sectorsFromJson.length > 0) {
    // Fallback sur le parsing JSONB
    return (
      <div className={className}>
        <SectorBadge label={sectorsFromJson} className={sectorClassName} />
      </div>
    );
  }
  
  return null;
};