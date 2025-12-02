import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAllUserRoleNames, isUserAdmin, isUserHR, isUserManager, isUserFinance, isUserOfficeAdmin, isUserITHelpdesk } from '@/utils/multipleRoles';

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
  // Asset management specific permissions
  canAccessAssetManagement: boolean;
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
        canAccessAssetManagement: false,
      };
    }

    // Get all user roles for aggregated permissions
    const userRoles = getAllUserRoleNames(user);
    const isAdmin = isUserAdmin(user);
    const isHR = isUserHR(user);
    const isManager = isUserManager(user);
    const isFinance = isUserFinance(user);

    // Initialize permissions object - start with employee defaults
    const permissions: EmployeePermissions = {
      canViewAllEmployees: false,
      canEditAllEmployees: false,
      canViewTeamEmployees: false,
      canEditTeamEmployees: false,
      canViewOwnProfile: true, // Everyone can view their own profile
      canEditOwnProfile: true, // Everyone can edit their own profile
      canManageAssets: false,
      canManageRoles: false,
      canManageDepartments: false,
      canViewSalaryInfo: false,
      canManageAccess: false,
      accessLevel: 'own',
      isReadOnly: false,
      canAccessAssetManagement: false,
    };

    // Aggregate permissions from all roles
    for (const roleName of userRoles) {
      // Admin roles grant full access
      if (['admin', 'super_admin'].includes(roleName) || user.isSA) {
        permissions.canViewAllEmployees = true;
        permissions.canEditAllEmployees = true;
        permissions.canViewTeamEmployees = true;
        permissions.canEditTeamEmployees = true;
        permissions.canManageAssets = true;
        permissions.canManageRoles = true;
        permissions.canManageDepartments = true;
        permissions.canViewSalaryInfo = true;
        permissions.canManageAccess = true;
        permissions.accessLevel = 'all';
      }
      
      // HR roles grant comprehensive access (but not role management)
      if (['hr', 'hrm'].includes(roleName)) {
        permissions.canViewAllEmployees = true;
        permissions.canEditAllEmployees = true;
        permissions.canViewTeamEmployees = true;
        permissions.canEditTeamEmployees = true;
        permissions.canManageAssets = true;
        permissions.canManageDepartments = true;
        permissions.canViewSalaryInfo = true;
        permissions.canManageAccess = true;
        if (permissions.accessLevel === 'own') permissions.accessLevel = 'all';
      }
      
      // Manager roles grant team-level access
      if (['sdm', 'bdm', 'qam', 'manager'].includes(roleName)) {
        permissions.canViewTeamEmployees = true;
        permissions.canEditTeamEmployees = true;
        permissions.canManageAssets = true; // Managers can manage assets for their team
        if (permissions.accessLevel === 'own') permissions.accessLevel = 'team';
      }
      
      // Finance roles grant financial access
      if (['finance', 'finance_manager'].includes(roleName)) {
        permissions.canViewAllEmployees = true;
        permissions.canManageAssets = true; // Finance can manage assets
        permissions.canViewSalaryInfo = true; // Finance can view salary info
        if (permissions.accessLevel === 'own') permissions.accessLevel = 'all';
      }
      
      // BD roles get some employee viewing access
      if (['bdm', 'bd_team'].includes(roleName)) {
        permissions.canViewTeamEmployees = true;
        if (permissions.accessLevel === 'own') permissions.accessLevel = 'team';
      }
      
      // QA roles get team access
      if (['qam', 'qa'].includes(roleName)) {
        permissions.canViewTeamEmployees = true;
        permissions.canEditTeamEmployees = true;
        if (permissions.accessLevel === 'own') permissions.accessLevel = 'team';
      }
    }

    // Asset Management Access Rules
    // HR/HRM do NOT have asset management access by default
    // Office Admin and IT Helpdesk have role-centered access (see ALL assets of their type)
    // Managers (BDM, QAM, SDM) and Finance Manager have user-centered access (see team members' assets)
    const isOfficeAdmin = isUserOfficeAdmin(user);
    const isITHelpdesk = isUserITHelpdesk(user);
    
    // Role-centered access: Office Admin and IT Helpdesk see ALL assets of their allowed type
    permissions.canAccessAssetManagement = isAdmin || isOfficeAdmin || isITHelpdesk;
    
    // canManageAssets: Allow managers and finance to access asset management (user-centered filtering)
    // This allows them to see assets of people assigned to them
    // The filtering logic in AssetManagement will handle showing only team members' assets
    if (!permissions.canManageAssets) {
      // Check if user has manager or finance role that should have asset access
      const hasManagerRole = ['sdm', 'bdm', 'qam', 'manager'].some(role => userRoles.includes(role));
      const hasFinanceRole = ['finance', 'finance_manager'].some(role => userRoles.includes(role));
      
      if (hasManagerRole || hasFinanceRole) {
        permissions.canManageAssets = true;
      }
    }

    return permissions;
  }, [user?.role_id, user?.role?.name, user?.isSA, user?.additional_role_ids]);
}

export function useCanAccessEmployeeManagement(): boolean {
  const permissions = useEmployeePermissions();
  return permissions.canViewAllEmployees || permissions.canViewTeamEmployees;
}
