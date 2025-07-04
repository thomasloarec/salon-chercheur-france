
export function formatAddress(
  address?: string | null,
  postal_code?: string | null,
  city?: string | null,
) {
  console.log('🔍 formatAddress called with:', { address, postal_code, city });
  
  const parts: (string | null | undefined)[] = [address, postal_code, city]
    .map(part => part?.trim())
    .filter(Boolean);

  console.log('🔍 formatAddress parts after filtering:', parts);

  // Supprime les doublons insensibles à la casse/espaces
  const uniqueParts = parts.filter((part, index, arr) =>
    arr.findIndex(p => 
      p!.toLowerCase().replace(/\s+/g, ' ') === part!.toLowerCase().replace(/\s+/g, ' ')
    ) === index
  );

  console.log('🔍 formatAddress uniqueParts:', uniqueParts);
  
  const result = uniqueParts.join(', ');
  console.log('🔍 formatAddress result:', result);
  
  return result;
}
