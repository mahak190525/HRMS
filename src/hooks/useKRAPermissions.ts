import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

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

    // Get user role
    const roleName = user.role?.name || user.role_id || '';
    const isAdmin = user.isSA || roleName === 'admin' || roleName === 'super_admin';
    const isHR = roleName === 'hr' || roleName === 'hrm';
    const isManager = ['sdm', 'bdm', 'qam'].includes(roleName);

    // Admin and Super Admin have full access
    if (isAdmin) {
      return {
        canViewOwnKRA: true,
        canViewTeamKRA: true,
        canViewAllKRA: true,
        canCreateTemplates: true,
        canEditTemplates: true,
        canDeleteTemplates: true,
        canAssignKRA: true,
        canViewAssignments: true,
        canEditAssignments: true,
        canEvaluateOwn: true,
        canEvaluateTeam: true,
        canEvaluateAll: true,
        canEditEvaluations: true,
        canAddManagerComments: true,
        canApproveEvaluations: true,
        accessLevel: 'all',
        isReadOnly: false,
      };
    }

    // HR has comprehensive access but limited editing
    if (isHR) {
      return {
        canViewOwnKRA: true,
        canViewTeamKRA: true,
        canViewAllKRA: true,
        canCreateTemplates: true,
        canEditTemplates: true,
        canDeleteTemplates: false,
        canAssignKRA: true,
        canViewAssignments: true,
        canEditAssignments: false,
        canEvaluateOwn: true,
        canEvaluateTeam: false,
        canEvaluateAll: false,
        canEditEvaluations: false,
        canAddManagerComments: false,
        canApproveEvaluations: true,
        accessLevel: 'all',
        isReadOnly: false,
      };
    }

    // Managers can manage their team's KRAs
    if (isManager) {
      return {
        canViewOwnKRA: true,
        canViewTeamKRA: true,
        canViewAllKRA: false,
        canCreateTemplates: true,
        canEditTemplates: true,
        canDeleteTemplates: false,
        canAssignKRA: true,
        canViewAssignments: true,
        canEditAssignments: true,
        canEvaluateOwn: true,
        canEvaluateTeam: true,
        canEvaluateAll: false,
        canEditEvaluations: true,
        canAddManagerComments: true,
        canApproveEvaluations: false,
        accessLevel: 'team',
        isReadOnly: false,
      };
    }

    // Regular employees have limited access
    return {
      canViewOwnKRA: true,
      canViewTeamKRA: false,
      canViewAllKRA: false,
      canCreateTemplates: false,
      canEditTemplates: false,
      canDeleteTemplates: false,
      canAssignKRA: false,
      canViewAssignments: false,
      canEditAssignments: false,
      canEvaluateOwn: true,
      canEvaluateTeam: false,
      canEvaluateAll: false,
      canEditEvaluations: false,
      canAddManagerComments: false,
      canApproveEvaluations: false,
      accessLevel: 'own',
      isReadOnly: false,
    };
  }, [user?.role_id, user?.role?.name, user?.isSA]);
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
