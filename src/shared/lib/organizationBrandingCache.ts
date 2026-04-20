import { Organization } from '@/shared/types';

const ORG_CACHE_KEY_PREFIX = 'swiftcause:org-branding:';
const LAST_ORG_CACHE_KEY = 'swiftcause:last-org-id';
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_ACCENT = '#0E8F5A';

const getCacheKey = (organizationId: string) => `${ORG_CACHE_KEY_PREFIX}${organizationId}`;

export const normalizeAccentColor = (accentColorHex?: string | null) =>
  typeof accentColorHex === 'string' && HEX_COLOR_REGEX.test(accentColorHex.trim())
    ? accentColorHex.trim().toUpperCase()
    : DEFAULT_ACCENT;

export const getCachedOrganization = (organizationId: string): Organization | null => {
  if (!organizationId || typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(getCacheKey(organizationId));
    if (!raw) return null;
    return JSON.parse(raw) as Organization;
  } catch {
    return null;
  }
};

export const setCachedOrganization = (organizationId: string, organization: Organization) => {
  if (!organizationId || typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(getCacheKey(organizationId), JSON.stringify(organization));
    window.sessionStorage.setItem(LAST_ORG_CACHE_KEY, organizationId);
  } catch {
    // Ignore quota/storage errors in kiosk browsers.
  }
};

export const clearCachedOrganization = (organizationId: string) => {
  if (!organizationId || typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(getCacheKey(organizationId));
  } catch {
    // Ignore storage errors.
  }
};

export const getCachedAccentColor = (organizationId?: string | null) => {
  if (!organizationId) return DEFAULT_ACCENT;
  const cachedOrg = getCachedOrganization(organizationId);
  return normalizeAccentColor(cachedOrg?.settings?.accentColorHex);
};

export const getLastCachedAccentColor = () => {
  if (typeof window === 'undefined') return DEFAULT_ACCENT;
  try {
    const lastOrgId = window.sessionStorage.getItem(LAST_ORG_CACHE_KEY);
    if (!lastOrgId) return DEFAULT_ACCENT;
    return getCachedAccentColor(lastOrgId);
  } catch {
    return DEFAULT_ACCENT;
  }
};
