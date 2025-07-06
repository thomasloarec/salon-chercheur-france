
export function formatAddress(
  address?: string | null,
  postal_code?: string | null,
  city?: string | null,
) {
  // 🛂 DIAGNOSTIC: Log des données reçues
  console.log('🏠 formatAddress called with:', {
    address: address,
    postal_code: postal_code,
    city: city
  });

  // Construire l'adresse complète en priorité
  const parts: string[] = [];
  
  if (address && address.trim()) {
    parts.push(address.trim());
  }
  
  // Ajouter code postal et ville ensemble s'ils existent
  const locationParts: string[] = [];
  if (postal_code && postal_code.trim()) {
    locationParts.push(postal_code.trim());
  }
  if (city && city.trim()) {
    locationParts.push(city.trim());
  }
  
  if (locationParts.length > 0) {
    parts.push(locationParts.join(' '));
  }

  const result = parts.join(', ');
  console.log('🏠 formatAddress result:', result);
  
  return result || '—';
}
