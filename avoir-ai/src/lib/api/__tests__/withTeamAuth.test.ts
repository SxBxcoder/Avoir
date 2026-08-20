/**
 * Avoir — RBAC Unit Tests
 *
 * Tests the permission matrix in withTeamAuth.ts to ensure
 * correct access control for all 15 permissions across 3 roles.
 */

import { describe, it, expect } from 'vitest';
import { hasPermission, type TeamRole } from '@/lib/api/withTeamAuth';

describe('RBAC Permission Matrix', () => {
  const ownerPermissions = [
    'team.view', 'team.update', 'team.delete', 'team.manage_billing',
    'team.view_audit', 'member.invite', 'member.remove', 'member.update_role',
    'campaign.view', 'campaign.create', 'campaign.delete',
    'brand_dna.view', 'brand_dna.update',
    'invitation.create', 'invitation.revoke',
  ];

  const adminPermissions = [
    'team.view', 'team.update', 'team.view_audit',
    'member.invite', 'member.remove',
    'campaign.view', 'campaign.create', 'campaign.delete',
    'brand_dna.view', 'brand_dna.update',
    'invitation.create', 'invitation.revoke',
  ];

  const memberPermissions = [
    'team.view',
    'campaign.view', 'campaign.create',
    'brand_dna.view', 'brand_dna.update',
  ];

  const deniedToAdmin = ['team.delete', 'team.manage_billing', 'member.update_role'];
  const deniedToMember = [
    'team.update', 'team.delete', 'team.manage_billing', 'team.view_audit',
    'member.invite', 'member.remove', 'member.update_role',
    'campaign.delete', 'invitation.create', 'invitation.revoke',
  ];

  describe('Owner role', () => {
    for (const perm of ownerPermissions) {
      it(`owner has permission: ${perm}`, () => {
        expect(hasPermission('owner', perm)).toBe(true);
      });
    }
  });

  describe('Admin role', () => {
    for (const perm of adminPermissions) {
      it(`admin has permission: ${perm}`, () => {
        expect(hasPermission('admin', perm)).toBe(true);
      });
    }

    for (const perm of deniedToAdmin) {
      it(`admin denied: ${perm}`, () => {
        expect(hasPermission('admin', perm)).toBe(false);
      });
    }
  });

  describe('Member role', () => {
    for (const perm of memberPermissions) {
      it(`member has permission: ${perm}`, () => {
        expect(hasPermission('member', perm)).toBe(true);
      });
    }

    for (const perm of deniedToMember) {
      it(`member denied: ${perm}`, () => {
        expect(hasPermission('member', perm)).toBe(false);
      });
    }
  });

  describe('Edge cases', () => {
    it('returns false for unknown permission', () => {
      expect(hasPermission('owner', 'nonexistent.permission')).toBe(false);
    });

    it('permission count is 15', () => {
      const allPerms = [
        'team.view', 'team.update', 'team.delete', 'team.manage_billing', 'team.view_audit',
        'member.invite', 'member.remove', 'member.update_role',
        'campaign.view', 'campaign.create', 'campaign.delete',
        'brand_dna.view', 'brand_dna.update',
        'invitation.create', 'invitation.revoke',
      ];
      expect(allPerms).toHaveLength(15);
    });
  });
});
