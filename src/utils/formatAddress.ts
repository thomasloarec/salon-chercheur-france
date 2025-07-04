
export function formatAddress(
  address?: string | null,
  postal_code?: string | null,
  city?: string | null,
) {
  const parts: (string | null | undefined)[] = [address, postal_code, city]
    .map(part => part?.trim())
    .filter(Boolean);

  // Supprime les doublons insensibles à la casse/espaces
  const uniqueParts = parts.filter((part, index, arr) =>
    arr.findIndex(p => 
      p!.toLowerCase().replace(/\s+/g, ' ') === part!.toLowerCase().replace(/\s+/g, ' ')
    ) === index
  );
  
  return uniqueParts.join(', ');
}
