import React from 'react';
import { SectorBadge } from './sector-badge';
import { useEventSectors } from '@/hooks/useSectors';
import type { Event } from '@/types/event';
import { SECTOR_CONFIG } from '@/constants/sectors';

interface EventSectorsProps {
  event: Event;
  className?: string;
  sectorClassName?: string;
}

// Liste des noms de secteurs connus pour la séparation
const KNOWN_SECTORS = Object.keys(SECTOR_CONFIG);

// Fonction pour séparer les secteurs concaténés (ex: "Industrie & Production Commerce & Distribution")
const splitConcatenatedSectors = (text: string): string[] => {
  // Trier par longueur décroissante pour matcher les noms les plus longs en premier
  const sortedSectors = [...KNOWN_SECTORS].sort((a, b) => b.length - a.length);
  
  const foundSectors: string[] = [];
  let remaining = text.trim();
  
  while (remaining.length > 0) {
    let found = false;
    for (const sector of sortedSectors) {
      if (remaining.startsWith(sector)) {
        foundSectors.push(sector);
        remaining = remaining.slice(sector.length).trim();
        found = true;
        break;
      }
    }
    // Si aucun secteur n'est trouvé, on arrête pour éviter une boucle infinie
    if (!found) {
      // Retourner le texte original si on ne peut pas parser
      if (foundSectors.length === 0) {
        return [text];
      }
      break;
    }
  }
  
  return foundSectors.length > 0 ? foundSectors : [text];
};

// Fonction utilitaire pour parser les secteurs depuis le champ secteur JSONB
const parseSectorsFromJson = (secteur: string | string[] | unknown): string[] => {
  if (!secteur) return [];
  
  // Fonction helper pour aplatir récursivement
  const flattenToStrings = (arr: unknown[]): string[] => {
    const result: string[] = [];
    for (const item of arr) {
      if (typeof item === 'string') {
        result.push(item);
      } else if (Array.isArray(item)) {
        result.push(...flattenToStrings(item));
      }
    }
    return result;
  };
  
  let rawSectors: string[] = [];
  
  if (Array.isArray(secteur)) {
    // Déjà un tableau - aplatir et extraire les strings
    rawSectors = flattenToStrings(secteur);
  } else if (typeof secteur === 'string') {
    // Si c'est une string qui contient du JSON
    if (secteur.startsWith('[') && secteur.endsWith(']')) {
      try {
        const parsed = JSON.parse(secteur);
        rawSectors = Array.isArray(parsed) ? flattenToStrings(parsed) : [secteur];
      } catch {
        rawSectors = [secteur];
      }
    } else {
      rawSectors = [secteur];
    }
  }
  
  // Nettoyer les secteurs
  const allSectors: string[] = [];
  for (const sector of rawSectors) {
    const cleaned = sector.replace(/^\["|"\]$/g, '').replace(/"/g, '').trim();
    if (cleaned) {
      // Vérifier si c'est un secteur connu directement
      if (KNOWN_SECTORS.includes(cleaned)) {
        allSectors.push(cleaned);
      } else {
        // Sinon essayer de séparer les secteurs concaténés
        allSectors.push(...splitConcatenatedSectors(cleaned));
      }
    }
  }
  
  // Dédupliquer
  return [...new Set(allSectors.filter(Boolean))];
};

export const EventSectors = ({ event, className = "", sectorClassName = "" }: EventSectorsProps) => {
  // Priorité 1 : Utiliser la table normalisée event_sectors
  const { data: eventSectors = [] } = useEventSectors(event.id_event || '');
  
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
