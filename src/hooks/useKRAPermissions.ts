import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';
import { getAllUserRoleNames, isUserAdmin, isUserHR, isUserManager } from '@/utils/multipleRoles';

export interface KRAPermissions {
  // View permissions
  canViewOwnKRA: boolean;
  canViewTeamKRA: boolean;
  canViewAllKRA: boolean;
  
  // Template permissions
  canCreateTemplates: boolean;
  canEditTemplates: boolean;
  canDeleteTemplates: boolean;
  
  // Assignment permissions
  canAssignKRA: boolean;
  canViewAssignments: boolean;
  canEditAssignments: boolean;
  
  // Evaluation permissions
  canEvaluateOwn: boolean;
  canEvaluateTeam: boolean;
  canEvaluateAll: boolean;
  canEditEvaluations: boolean;
  
  // Manager actions
  canAddManagerComments: boolean;
  canApproveEvaluations: boolean;
  
  // Data access level
  accessLevel: 'none' | 'own' | 'team' | 'all';
  isReadOnly: boolean;
}

export function useKRAPermissions(): KRAPermissions {
  const { user } = useAuth();
  
  return useMemo(() => {
    if (!user) {
      return {
        canViewOwnKRA: false,
        canViewTeamKRA: false,
        canViewAllKRA: false,
        canCreateTemplates: false,
        canEditTemplates: false,
        canDeleteTemplates: false,
        canAssignKRA: false,
        canViewAssignments: false,
        canEditAssignments: false,
        canEvaluateOwn: false,
        canEvaluateTeam: false,
        canEvaluateAll: false,
        canEditEvaluations: false,
        canAddManagerComments: false,
        canApproveEvaluations: false,
        accessLevel: 'none',
        isReadOnly: true,
      };
    }

    // Get all user roles for aggregated permissions
    const userRoles = getAllUserRoleNames(user);
    const userIsAdmin = isUserAdmin(user);
    const userIsHR = isUserHR(user);
    const userIsManager = isUserManager(user);

    // Initialize permissions object - start with employee defaults
    const permissions: KRAPermissions = {
      canViewOwnKRA: true, // Everyone can view their own KRA
      canViewTeamKRA: false,
      canViewAllKRA: false,
      canCreateTemplates: false,
      canEditTemplates: false,
      canDeleteTemplates: false,
      canAssignKRA: false,
      canViewAssignments: false,
      canEditAssignments: false,
      canEvaluateOwn: true, // Everyone can evaluate their own KRA
      canEvaluateTeam: false,
      canEvaluateAll: false,
      canEditEvaluations: false,
      canAddManagerComments: false,
      canApproveEvaluations: false,
      accessLevel: 'own',
      isReadOnly: false,
    };

    // Aggregate permissions from all roles
    for (const roleName of userRoles) {
      // Admin roles grant full access
      if (['admin', 'super_admin'].includes(roleName) || user.isSA) {
        permissions.canViewTeamKRA = true;
        permissions.canViewAllKRA = true;
        permissions.canCreateTemplates = true;
        permissions.canEditTemplates = true;
        permissions.canDeleteTemplates = true;
        permissions.canAssignKRA = true;
        permissions.canViewAssignments = true;
        permissions.canEditAssignments = true;
        permissions.canEvaluateTeam = true;
        permissions.canEvaluateAll = true;
        permissions.canEditEvaluations = true;
        permissions.canAddManagerComments = true;
        permissions.canApproveEvaluations = true;
        permissions.accessLevel = 'all';
      }
      
      // HR roles grant comprehensive access
      if (['hr', 'hrm'].includes(roleName)) {
        permissions.canViewTeamKRA = true;
        permissions.canViewAllKRA = true;
        permissions.canCreateTemplates = true;
        permissions.canEditTemplates = true;
        permissions.canAssignKRA = true;
        permissions.canViewAssignments = true;
        permissions.canApproveEvaluations = true;
        if (permissions.accessLevel === 'own') permissions.accessLevel = 'all';
      }
      
      // Manager roles grant team-level access
      if (['sdm', 'bdm', 'qam', 'manager', 'finance_manager'].includes(roleName)) {
        permissions.canViewTeamKRA = true;
        permissions.canCreateTemplates = true;
        permissions.canEditTemplates = true;
        permissions.canAssignKRA = true;
        permissions.canViewAssignments = true;
        permissions.canEditAssignments = true;
        permissions.canEvaluateTeam = true;
        permissions.canEditEvaluations = true;
        permissions.canAddManagerComments = true;
        if (permissions.accessLevel === 'own') permissions.accessLevel = 'team';
      }
      
      // Finance roles get some viewing access
      if (['finance'].includes(roleName)) {
        permissions.canViewTeamKRA = true;
        permissions.canViewAllKRA = false;
        if (permissions.accessLevel === 'own') permissions.accessLevel = 'all';
      }
    }

    return permissions;
  }, [user?.role_id, user?.role?.name, user?.isSA, user?.additional_role_ids]);
}

export function useCanAccessKRADashboard(): boolean {
  const permissions = useKRAPermissions();
  return permissions.accessLevel !== 'none';
}

export function useCanEditKRA(): boolean {
  const permissions = useKRAPermissions();
  return !permissions.isReadOnly;
}

export function useKRAAccessLevel(): 'none' | 'own' | 'team' | 'all' {
  const permissions = useKRAPermissions();
  return permissions.accessLevel;
}
