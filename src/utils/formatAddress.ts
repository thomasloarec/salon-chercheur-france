
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
  const parts = [address, postal_code, city]
    .filter(Boolean)
    .map(part => part?.trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index); // Supprime les doublons

  const result = parts.join(', ');
  console.log('🏠 formatAddress result:', result);
  
  return result || '—';
}
