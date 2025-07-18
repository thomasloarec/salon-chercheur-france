
export const formatAddress = (rue?: string, code_postal?: string, ville?: string): string => {
  const parts = [];
  
  if (rue) {
    parts.push(rue);
  }
  
  if (code_postal || ville) {
    const cityPart = [code_postal, ville].filter(Boolean).join(' ');
    if (cityPart) {
      parts.push(cityPart);
    }
  }
  
  return parts.join(', ') || 'Adresse non précisée';
};
