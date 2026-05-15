import { describe, expect, it } from 'vitest';
import { checkSuperAdminAccess } from './requireSuperAdmin';

/**
 * Route integration: GET /admin/approvals
 *
 * ApprovalsLayout (app/admin/approvals/layout.tsx) calls useRequireSuperAdmin(),
 * which delegates to checkSuperAdminAccess(userRole, isLoading). The return value
 * drives rendering:
 *
 *   'loading'         → <Loader /> — auth state still resolving
 *   'unauthenticated' → router.push('/login') + null — 401 equivalent
 *   'forbidden'       → 403 UI with no org data — access denied
 *   'allowed'         → children rendered — ApprovalsPlaceholder (no org data, static copy only)
 */

describe('GET /admin/approvals — route access control', () => {
  describe('unauthenticated request', () => {
    it('produces unauthenticated status (→ redirect to /login, 401 equivalent)', () => {
      expect(checkSuperAdminAccess(null, false)).toBe('unauthenticated');
      expect(checkSuperAdminAccess(undefined, false)).toBe('unauthenticated');
    });
  });

  describe('authenticated non-super-admin request', () => {
    it('produces forbidden status (→ 403 UI, no org data rendered)', () => {
      const nonSuperAdminRoles = ['admin', 'manager', 'operator', 'viewer', 'kiosk'] as const;
      for (const role of nonSuperAdminRoles) {
        expect(checkSuperAdminAccess(role, false)).toBe('forbidden');
      }
    });
  });

  describe('authenticated super_admin request', () => {
    it('produces allowed status (→ 200 placeholder page, no org data rendered)', () => {
      expect(checkSuperAdminAccess('super_admin', false)).toBe('allowed');
    });
  });
});
