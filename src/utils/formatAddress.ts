
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

  // Construire l'adresse complète en évitant les doublons
  const parts: string[] = [];
  
  if (address && address.trim()) {
    parts.push(address.trim());
  }
  
  if (postal_code && postal_code.trim()) {
    parts.push(postal_code.trim());
  }
  
  if (city && city.trim()) {
    parts.push(city.trim());
  }

  // Filtrer les doublons (comparaison case-insensitive)
  const uniqueParts = parts.filter((part, index, array) => {
    const lowerPart = part.toLowerCase();
    return array.findIndex(p => p.toLowerCase() === lowerPart) === index;
  });

  const result = uniqueParts.join(', ');
  console.log('🏠 formatAddress result:', result);
  
  return result || '—';
}
