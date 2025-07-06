
import { SectorTag } from './sector-tag';

interface SectorBadgeProps {
  label: string | string[];
  className?: string;
}

const parseSectors = (sectorData: string | string[]): string[] => {
  // Si c'est déjà un tableau
  if (Array.isArray(sectorData)) {
    return sectorData;
  }
  
  // Si c'est une string qui ressemble à du JSON
  if (typeof sectorData === 'string') {
    // Tenter de parser comme JSON d'abord
    if (sectorData.startsWith('[') && sectorData.endsWith(']')) {
      try {
        const parsed = JSON.parse(sectorData);
        return Array.isArray(parsed) ? parsed : [sectorData];
      } catch {
        // Si le parsing JSON échoue, traiter comme string simple
        return [sectorData];
      }
    }
    
    // Si contient des virgules, séparer
    if (sectorData.includes(',')) {
      return sectorData.split(',').map(s => s.trim()).filter(Boolean);
    }
    
    // Sinon, traiter comme secteur unique
    return [sectorData];
  }
  
  return [];
};

export const SectorBadge = ({ label, className = "" }: SectorBadgeProps) => {
  const sectors = parseSectors(label);
  
  if (sectors.length === 0) {
    return null;
  }
  
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {sectors.slice(0, 2).map((sector, index) => (
        <SectorTag key={`${sector}-${index}`} label={sector} />
      ))}
      {sectors.length > 2 && (
        <span className="bg-gray-200 rounded px-2 py-0.5 text-xs font-medium text-gray-800">
          +{sectors.length - 2}
        </span>
      )}
    </div>
  );
};
