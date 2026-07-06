export const LISTING_TYPE_OPTIONS = [
  { value: 'internal', label: 'Internal', hint: 'GoDash app only' },
  { value: 'web', label: 'Web', hint: 'Public career site API' },
  { value: 'external', label: 'External', hint: 'Portal scan / off-site apply' },
];

export function listingTypeLabel(value) {
  return LISTING_TYPE_OPTIONS.find((o) => o.value === value)?.label || value || 'Internal';
}

export function listingTypeBadgeClass(value) {
  switch (value) {
    case 'web':
      return 'info';
    case 'external':
      return 'warning';
    default:
      return 'info';
  }
}
