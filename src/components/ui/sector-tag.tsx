interface SectorTagProps {
  label: string;
  className?: string;
}

export const SectorTag = ({ label, className = "" }: SectorTagProps) => {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground ${className}`}
    >
      {label}
    </span>
  );
};
