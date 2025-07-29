
import { getSectorConfig } from '@/constants/sectors';

interface SectorTagProps {
  label: string;
  className?: string;
}

export const SectorTag = ({ label, className = "" }: SectorTagProps) => {
  const sectorConfig = getSectorConfig(label);
  
  return (
    <span className={`${sectorConfig.color} rounded px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
};
