import { Location } from './types';

/**
 * Get formatted full address from location
 */
export function getLocationFullAddress(location: Location): string {
  const parts = [
    location.addressLine1,
    location.addressLine2,
    location.city,
    location.postcode,
    location.country,
  ].filter(Boolean);
  return parts.join(', ');
}

/**
 * Get formatted address line for display (address + city + postcode)
 */
export function getLocationDisplayAddress(location: Location): string {
  return [location.addressLine1, location.city, location.postcode].filter(Boolean).join(', ');
}

/**
 * Check if location has valid geo coordinates
 */
export function hasGeoCoordinates(location: Location): boolean {
  if (!location.geo) return false;
  return (
    typeof location.geo.lat === 'number' &&
    Number.isFinite(location.geo.lat) &&
    typeof location.geo.lng === 'number' &&
    Number.isFinite(location.geo.lng)
  );
}

/**
 * Get location type label
 */
export function getLocationTypeLabel(isCommunityBuilding: boolean): string {
  return isCommunityBuilding ? 'Community Building' : 'Standard Location';
}
