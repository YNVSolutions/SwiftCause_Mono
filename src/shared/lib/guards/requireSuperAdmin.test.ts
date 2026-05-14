import { describe, expect, it } from 'vitest';
import { checkSuperAdminAccess } from './requireSuperAdmin';

describe('checkSuperAdminAccess', () => {
  it('returns loading while auth is initialising', () => {
    expect(checkSuperAdminAccess(null, true)).toBe('loading');
    expect(checkSuperAdminAccess('super_admin', true)).toBe('loading');
  });

  it('returns unauthenticated when there is no role', () => {
    expect(checkSuperAdminAccess(null, false)).toBe('unauthenticated');
    expect(checkSuperAdminAccess(undefined, false)).toBe('unauthenticated');
  });

  it('returns forbidden for authenticated non-super-admin roles', () => {
    expect(checkSuperAdminAccess('admin', false)).toBe('forbidden');
    expect(checkSuperAdminAccess('manager', false)).toBe('forbidden');
    expect(checkSuperAdminAccess('operator', false)).toBe('forbidden');
    expect(checkSuperAdminAccess('viewer', false)).toBe('forbidden');
  });

  it('returns allowed for super_admin', () => {
    expect(checkSuperAdminAccess('super_admin', false)).toBe('allowed');
  });
});
