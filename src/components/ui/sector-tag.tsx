
const sectorColorMap: Record<string, string> = {
  "Agroalimentaire & Boissons": "bg-amber-300/60",
  "Automobile & Mobilité": "bg-teal-300/60", 
  "Commerce & Distribution": "bg-pink-300/60",
  "Cosmétique & Bien-être": "bg-rose-300/60",
  "Éducation & Formation": "bg-indigo-300/60",
  "Énergie & Environnement": "bg-green-300/60",
  "Industrie & Production": "bg-slate-300/60",
  "Mode & Textile": "bg-fuchsia-300/60",
  "Santé & Médical": "bg-red-300/60",
  "Technologie & Innovation": "bg-cyan-300/60",
  "Tourisme & Événementiel": "bg-orange-300/60",
  "Finance, Assurance & Immobilier": "bg-yellow-300/60",
  "Services aux Entreprises & RH": "bg-lime-300/60",
  "Secteur Public & Collectivités": "bg-purple-300/60",
  "BTP & Construction": "bg-orange-300/60"
};

interface SectorTagProps {
  label: string;
  className?: string;
}

export const SectorTag = ({ label, className = "" }: SectorTagProps) => {
  const color = sectorColorMap[label] ?? "bg-gray-200";
  
  return (
    <span className={`${color} rounded px-2 py-0.5 text-xs font-medium text-gray-800 ${className}`}>
      {label}
    </span>
  );
};
