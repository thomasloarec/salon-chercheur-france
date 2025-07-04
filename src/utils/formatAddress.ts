
export function formatAddress(
  street?: string | null,
  postal_code?: string | null,
  city?: string | null,
) {
  const parts: string[] = [];

  if (street?.trim()) parts.push(street.trim());

  // En FR : « 75015 Paris » ou « 75015 » / « Paris » si l'un des deux manque
  const cpCity =
    postal_code?.trim() && city?.trim()
      ? `${postal_code.trim()} ${city.trim()}`
      : postal_code?.trim() || city?.trim();

  if (cpCity) parts.push(cpCity);

  // supprime les doublons éventuels
  return [...new Set(parts)].join(', ');
}
