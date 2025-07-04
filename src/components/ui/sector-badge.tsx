
import { sectorColors } from '@/utils/sectorColor';

interface SectorBadgeProps {
  label: string;
  className?: string;
}

export const SectorBadge = ({ label, className = "" }: SectorBadgeProps) => (
  <span
    style={{ backgroundColor: sectorColors[label] ?? "#ddd" }}
    className={`text-xs px-2 py-0.5 rounded text-white whitespace-nowrap ${className}`}
  >
    {label}
  </span>
);
