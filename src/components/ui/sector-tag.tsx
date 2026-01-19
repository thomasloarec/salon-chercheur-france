
import { getSectorConfig } from '@/constants/sectors';

interface SectorTagProps {
  label: string;
  className?: string;
}

export const SectorTag = ({ label, className = "" }: SectorTagProps) => {
  const sectorConfig = getSectorConfig(label);
  
  // Utilise des styles inline pour éviter les problèmes de purge Tailwind avec classes dynamiques
  return (
    <span 
      className={`rounded px-2 py-0.5 text-xs font-medium ${className}`}
      style={{
        backgroundColor: sectorConfig.bgColor,
        color: sectorConfig.textColor
      }}
    >
      {label}
    </span>
  );
};
