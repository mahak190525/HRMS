import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface EmployeePermissions {
  canViewAllEmployees: boolean;
  canEditAllEmployees: boolean;
  canViewTeamEmployees: boolean;
  canEditTeamEmployees: boolean;
  canViewOwnProfile: boolean;
  canEditOwnProfile: boolean;
  canManageAssets: boolean;
  canManageRoles: boolean;
  canManageDepartments: boolean;
  canViewSalaryInfo: boolean;
  canManageAccess: boolean;
  accessLevel: 'own' | 'team' | 'all';
  isReadOnly: boolean;
}

export function useEmployeePermissions(): EmployeePermissions {
  const { user } = useAuth();
  
  return useMemo(() => {
    if (!user) {
      return {
        canViewAllEmployees: false,
        canEditAllEmployees: false,
        canViewTeamEmployees: false,
        canEditTeamEmployees: false,
        canViewOwnProfile: true,
        canEditOwnProfile: false,
        canManageAssets: false,
        canManageRoles: false,
        canManageDepartments: false,
        canViewSalaryInfo: false,
        canManageAccess: false,
        accessLevel: 'own',
        isReadOnly: true,
      };
    }

    const roleName = user.role?.name || user.role_id || '';
    const isAdmin = user.isSA || roleName === 'admin' || roleName === 'super_admin';
    const isHR = roleName === 'hr' || roleName === 'hrm';
    const isManager = ['sdm', 'bdm', 'qam', 'hrm', 'manager'].includes(roleName);

    // Admin has full access to everything
    if (isAdmin) {
      return {
        canViewAllEmployees: true,
        canEditAllEmployees: true,
        canViewTeamEmployees: true,
        canEditTeamEmployees: true,
        canViewOwnProfile: true,
        canEditOwnProfile: true,
        canManageAssets: true,
        canManageRoles: true,
        canManageDepartments: true,
        canViewSalaryInfo: true,
        canManageAccess: true,
        accessLevel: 'all',
        isReadOnly: false,
      };
    }

    // HR has comprehensive access but limited role management
    if (isHR) {
      return {
        canViewAllEmployees: true,
        canEditAllEmployees: true,
        canViewTeamEmployees: true,
        canEditTeamEmployees: true,
        canViewOwnProfile: true,
        canEditOwnProfile: true,
        canManageAssets: true,
        canManageRoles: false, // HR cannot manage roles (admin only)
        canManageDepartments: true,
        canViewSalaryInfo: true,
        canManageAccess: true,
        accessLevel: 'all',
        isReadOnly: false,
      };
    }

    // Managers can manage their team
    if (isManager) {
      return {
        canViewAllEmployees: false,
        canEditAllEmployees: false,
        canViewTeamEmployees: true,
        canEditTeamEmployees: true,
        canViewOwnProfile: true,
        canEditOwnProfile: true,
        canManageAssets: true, // Managers can manage assets for their team
        canManageRoles: false,
        canManageDepartments: false,
        canViewSalaryInfo: false, // Managers cannot view salary info
        canManageAccess: false,
        accessLevel: 'team',
        isReadOnly: false,
      };
    }

    // Regular employees have minimal access
    return {
      canViewAllEmployees: false,
      canEditAllEmployees: false,
      canViewTeamEmployees: false,
      canEditTeamEmployees: false,
      canViewOwnProfile: true,
      canEditOwnProfile: true, // Allow employees to edit their own profile
      canManageAssets: false,
      canManageRoles: false,
      canManageDepartments: false,
      canViewSalaryInfo: false,
      canManageAccess: false,
      accessLevel: 'own',
      isReadOnly: false,
    };
  }, [user?.role_id, user?.role?.name, user?.isSA]);
}

export function useCanAccessEmployeeManagement(): boolean {
  const permissions = useEmployeePermissions();
  return permissions.canViewAllEmployees || permissions.canViewTeamEmployees;
}
