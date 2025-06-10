
type EventType = 'salon' | 'convention' | 'congres' | 'conference' | 'ceremonie' | 'loisir';

const CLASSIFICATION_RULES: Record<EventType, RegExp[]> = {
  salon: [
    /salon\b/i, 
    /\bexpo\b/i, 
    /\bexposition\b/i,
    /foire\b/i,
    /showroom\b/i,
    /stand\b/i
  ],
  convention: [
    /convention\b/i,
    /rencontre\b/i,
    /meeting\b/i
  ],
  congres: [
    /congr[eè]s\b/i, 
    /symposium\b/i,
    /colloque\b/i,
    /assises\b/i
  ],
  conference: [
    /conf[eé]rence\b/i, 
    /\bforum\b/i, 
    /\bsummit\b/i,
    /\bwebinar\b/i,
    /\bseminaire\b/i,
    /table ronde/i
  ],
  ceremonie: [
    /c[eé]r[eé]monie\b/i, 
    /\bgala\b/i,
    /remise de prix/i,
    /\bawards\b/i,
    /inauguration\b/i
  ],
  loisir: [
    /concert\b/i, 
    /spectacle\b/i, 
    /festival\b/i, 
    /match\b/i,
    /\bshow\b/i,
    /divertissement\b/i,
    /animation\b/i
  ]
};

export function ruleBasedType(text: string): EventType | 'inconnu' {
  const searchText = text.toLowerCase();
  
  for (const [eventType, regexList] of Object.entries(CLASSIFICATION_RULES) as [EventType, RegExp[]][]) {
    if (regexList.some(regex => regex.test(searchText))) {
      return eventType;
    }
  }
  
  return 'inconnu';
}

export function classifyEvent(title: string, description?: string): EventType | 'inconnu' {
  const combinedText = `${title} ${description || ''}`;
  return ruleBasedType(combinedText);
}
