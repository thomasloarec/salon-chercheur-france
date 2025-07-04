
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

  const parts: (string | null | undefined)[] = [address, postal_code, city]
    .map(part => part?.trim())
    .filter(Boolean);

  // Supprime les doublons insensibles à la casse/espaces
  const uniqueParts = parts.filter((part, index, arr) =>
    arr.findIndex(p => 
      p!.toLowerCase().replace(/\s+/g, ' ') === part!.toLowerCase().replace(/\s+/g, ' ')
    ) === index
  );
  
  const result = uniqueParts.join(', ');
  console.log('🏠 formatAddress result:', result);
  
  return result;
}
