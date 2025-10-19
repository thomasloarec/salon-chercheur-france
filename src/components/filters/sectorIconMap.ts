import {
  Car,
  Store,
  Sparkles,
  GraduationCap,
  Leaf,
  Factory,
  Shirt,
  HeartPulse,
  Cpu,
  Ticket,
  Banknote,
  Briefcase,
  Landmark,
  UtensilsCrossed,
  Tag,
  LucideIcon
} from "lucide-react";

export const sectorIconMap: Record<string, LucideIcon> = {
  "automobile-mobilite": Car,
  "commerce-distribution": Store,
  "cosmetique-bien-etre": Sparkles,
  "education-formation": GraduationCap,
  "energie-environnement": Leaf,
  "industrie-production": Factory,
  "mode-textile": Shirt,
  "sante-medical": HeartPulse,
  "technologie-innovation": Cpu,
  "tourisme-evenementiel": Ticket,
  "finance-assurance-immobilier": Banknote,
  "services-entreprises-rh": Briefcase,
  "secteur-public-collectivites": Landmark,
  "agroalimentaire-boissons": UtensilsCrossed,
};

export const FallbackIcon: LucideIcon = Tag;
