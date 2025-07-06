

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

  const parts: string[] = [];
  
  if (address) {
    parts.push(address.trim());
  }

  if (postal_code && city) {
    parts.push(`${postal_code.trim()} ${city.trim()}`);
  } else {
    if (postal_code) parts.push(postal_code.trim());
    if (city) parts.push(city.trim());
  }

  // Supprime les doublons
  const uniqueParts = parts.filter(
    (value, idx, arr) => arr.indexOf(value) === idx
  );

  const result = uniqueParts.join(', ');
  console.log('🏠 formatAddress result:', result);
  
  return result || '—';
}

