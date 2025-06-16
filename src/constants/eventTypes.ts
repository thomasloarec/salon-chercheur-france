
export const EVENT_TYPES = [
  { value: 'salon', label: 'Salon' },
  { value: 'convention', label: 'Convention' },
  { value: 'congres', label: 'Congrès' },
  { value: 'conference', label: 'Conférence' },
  { value: 'ceremonie', label: 'Cérémonie' },
];

export const getEventTypeLabel = (value: string): string => {
  const eventType = EVENT_TYPES.find(type => type.value === value);
  return eventType ? eventType.label : value;
};
