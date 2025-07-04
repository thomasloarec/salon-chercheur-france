
export function formatAddress(
  address?: string | null,
  postal_code?: string | null,
  city?: string | null
) {
  const parts = [address?.trim(), postal_code?.trim(), city?.trim()].filter(Boolean);
  return parts.join(', ');
}
