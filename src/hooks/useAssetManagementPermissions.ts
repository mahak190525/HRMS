import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAllUserRoleNames, isUserAdmin, isUserManager, isUserFinance } from '@/utils/multipleRoles';

export interface AssetManagementPermissions {
  // General asset permissions
  canViewAssets: boolean;
  canCreateAssets: boolean;
  canEditAssets: boolean;
  canDeleteAssets: boolean;
  canAssignAssets: boolean;
  
  // VM-specific permissions
  canManageVMs: boolean;
  canViewVMDetails: boolean;
  canCreateVMs: boolean;
  canEditVMs: boolean;
  canDeleteVMs: boolean;
  canAssignVMs: boolean;
  
  // Access control
  canAccessAssetManagement: boolean;
  hasAnyAssetPermission: boolean;
  hasAnyVMPermission: boolean;
  
  // Role information
  userRoles: string[];
  isOfficeAdmin: boolean;
  isITHelpdesk: boolean;
}

/**
 * Hook for managing asset management permissions based on user roles
 * 
 * Rules:
 * - Office Admin: Can CRUD all assets EXCEPT VMs
 * - IT Helpdesk: Can ONLY CRUD VMs
 * - HR/HRM: NO access to asset management unless they have Office Admin or IT Helpdesk roles
 * - Admin: Full access to everything
 */
export function useAssetManagementPermissions(): AssetManagementPermissions {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user) {
      return {
        canViewAssets: false,
        canCreateAssets: false,
        canEditAssets: false,
        canDeleteAssets: false,
        canAssignAssets: false,
        canManageVMs: false,
        canViewVMDetails: false,
        canCreateVMs: false,
        canEditVMs: false,
        canDeleteVMs: false,
        canAssignVMs: false,
        canAccessAssetManagement: false,
        hasAnyAssetPermission: false,
        hasAnyVMPermission: false,
        userRoles: [],
        isOfficeAdmin: false,
        isITHelpdesk: false,
      };
    }

    const userRoles = getAllUserRoleNames(user);
    const isAdmin = isUserAdmin(user);
    const isOfficeAdmin = userRoles.includes('office_admin');
    const isITHelpdesk = userRoles.includes('it_helpdesk');
    const isManager = isUserManager(user);
    const isFinance = isUserFinance(user);
    
    // Check if user is a manager (BDM, QAM, SDM) or Finance Manager
    // These roles can VIEW assets but NOT assign them
    const isManagerRole = ['sdm', 'bdm', 'qam', 'manager'].some(role => userRoles.includes(role));
    const isFinanceManager = ['finance', 'finance_manager'].some(role => userRoles.includes(role));
    const isViewOnlyManager = (isManagerRole || isFinanceManager) && !isOfficeAdmin && !isITHelpdesk;

    // Admin has full access to everything
    if (isAdmin) {
      return {
        canViewAssets: true,
        canCreateAssets: true,
        canEditAssets: true,
        canDeleteAssets: true,
        canAssignAssets: true,
        canManageVMs: true,
        canViewVMDetails: true,
        canCreateVMs: true,
        canEditVMs: true,
        canDeleteVMs: true,
        canAssignVMs: true,
        canAccessAssetManagement: true,
        hasAnyAssetPermission: true,
        hasAnyVMPermission: true,
        userRoles,
        isOfficeAdmin,
        isITHelpdesk,
      };
    }

    // Office Admin permissions (all assets EXCEPT VMs)
    const officeAdminPermissions = {
      canViewAssets: isOfficeAdmin,
      canCreateAssets: isOfficeAdmin,
      canEditAssets: isOfficeAdmin,
      canDeleteAssets: isOfficeAdmin,
      canAssignAssets: isOfficeAdmin,
      canManageVMs: false, // Office Admin CANNOT manage VMs
      canViewVMDetails: false,
      canCreateVMs: false,
      canEditVMs: false,
      canDeleteVMs: false,
      canAssignVMs: false,
    };

    // IT Helpdesk permissions (ONLY VMs)
    const itHelpdeskPermissions = {
      canViewAssets: false, // IT Helpdesk CANNOT manage regular assets
      canCreateAssets: false,
      canEditAssets: false,
      canDeleteAssets: false,
      canAssignAssets: false,
      canManageVMs: isITHelpdesk,
      canViewVMDetails: isITHelpdesk,
      canCreateVMs: isITHelpdesk,
      canEditVMs: isITHelpdesk,
      canDeleteVMs: isITHelpdesk,
      canAssignVMs: isITHelpdesk,
    };

    // Manager/Finance Manager permissions (VIEW ONLY - can view but NOT assign)
    const managerViewOnlyPermissions = {
      canViewAssets: isViewOnlyManager, // Managers can VIEW assets
      canCreateAssets: false, // Managers CANNOT create assets
      canEditAssets: false, // Managers CANNOT edit assets
      canDeleteAssets: false, // Managers CANNOT delete assets
      canAssignAssets: false, // Managers CANNOT assign assets
      canManageVMs: false,
      canViewVMDetails: isViewOnlyManager, // Managers can VIEW VMs
      canCreateVMs: false,
      canEditVMs: false,
      canDeleteVMs: false,
      canAssignVMs: false, // Managers CANNOT assign VMs
    };

    // Aggregate permissions (OR operation)
    const aggregatedPermissions = {
      canViewAssets: officeAdminPermissions.canViewAssets || itHelpdeskPermissions.canViewAssets || managerViewOnlyPermissions.canViewAssets,
      canCreateAssets: officeAdminPermissions.canCreateAssets || itHelpdeskPermissions.canCreateAssets || managerViewOnlyPermissions.canCreateAssets,
      canEditAssets: officeAdminPermissions.canEditAssets || itHelpdeskPermissions.canEditAssets || managerViewOnlyPermissions.canEditAssets,
      canDeleteAssets: officeAdminPermissions.canDeleteAssets || itHelpdeskPermissions.canDeleteAssets || managerViewOnlyPermissions.canDeleteAssets,
      canAssignAssets: officeAdminPermissions.canAssignAssets || itHelpdeskPermissions.canAssignAssets || managerViewOnlyPermissions.canAssignAssets,
      canManageVMs: officeAdminPermissions.canManageVMs || itHelpdeskPermissions.canManageVMs || managerViewOnlyPermissions.canManageVMs,
      canViewVMDetails: officeAdminPermissions.canViewVMDetails || itHelpdeskPermissions.canViewVMDetails || managerViewOnlyPermissions.canViewVMDetails,
      canCreateVMs: officeAdminPermissions.canCreateVMs || itHelpdeskPermissions.canCreateVMs || managerViewOnlyPermissions.canCreateVMs,
      canEditVMs: officeAdminPermissions.canEditVMs || itHelpdeskPermissions.canEditVMs || managerViewOnlyPermissions.canEditVMs,
      canDeleteVMs: officeAdminPermissions.canDeleteVMs || itHelpdeskPermissions.canDeleteVMs || managerViewOnlyPermissions.canDeleteVMs,
      canAssignVMs: officeAdminPermissions.canAssignVMs || itHelpdeskPermissions.canAssignVMs || managerViewOnlyPermissions.canAssignVMs,
    };

    const hasAnyAssetPermission = aggregatedPermissions.canViewAssets || 
                                 aggregatedPermissions.canCreateAssets || 
                                 aggregatedPermissions.canEditAssets || 
                                 aggregatedPermissions.canDeleteAssets || 
                                 aggregatedPermissions.canAssignAssets;

    const hasAnyVMPermission = aggregatedPermissions.canManageVMs || 
                              aggregatedPermissions.canViewVMDetails || 
                              aggregatedPermissions.canCreateVMs || 
                              aggregatedPermissions.canEditVMs || 
                              aggregatedPermissions.canDeleteVMs || 
                              aggregatedPermissions.canAssignVMs;

    // Allow access if user has any asset/VM permission OR is a manager/finance (view-only)
    const canAccessAssetManagement = hasAnyAssetPermission || hasAnyVMPermission || isViewOnlyManager;

    return {
      ...aggregatedPermissions,
      canAccessAssetManagement,
      hasAnyAssetPermission,
      hasAnyVMPermission,
      userRoles,
      isOfficeAdmin,
      isITHelpdesk,
    };
  }, [user]);
}

/**
 * Helper function to check if user can access asset management tab
 */
export function useCanAccessAssetManagement(): boolean {
  const permissions = useAssetManagementPermissions();
  return permissions.canAccessAssetManagement;
}

/**
 * Helper function to check specific asset operation permissions
 */
export function useAssetOperationPermissions() {
  const permissions = useAssetManagementPermissions();
  
  return {
    canPerformAssetOperation: (operation: 'view' | 'create' | 'edit' | 'delete' | 'assign', isVM: boolean = false) => {
      if (isVM) {
        switch (operation) {
          case 'view': return permissions.canViewVMDetails;
          case 'create': return permissions.canCreateVMs;
          case 'edit': return permissions.canEditVMs;
          case 'delete': return permissions.canDeleteVMs;
          case 'assign': return permissions.canAssignVMs;
          default: return false;
        }
      } else {
        switch (operation) {
          case 'view': return permissions.canViewAssets;
          case 'create': return permissions.canCreateAssets;
          case 'edit': return permissions.canEditAssets;
          case 'delete': return permissions.canDeleteAssets;
          case 'assign': return permissions.canAssignAssets;
          default: return false;
        }
      }
    },
    permissions
  };
}

export default useAssetManagementPermissions;
