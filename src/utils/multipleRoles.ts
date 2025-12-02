import type { User } from '@/types';

/**
 * Utility functions for handling multiple roles per user
 */

/**
 * Get all role names for a user (primary + additional)
 */
export function getAllUserRoleNames(user: User | null): string[] {
  if (!user) return [];
  
  // Use aggregated role names if available (from database view)
  if (user.all_role_names && user.all_role_names.length > 0) {
    return user.all_role_names;
  }
  
  // Fallback: construct from available data
  const roleNames: string[] = [];
  
  // Add primary role
  if (user.role?.name) {
    roleNames.push(user.role.name);
  } else if (user.role_id) {
    roleNames.push(user.role_id);
  }
  
  // Add additional roles
  if (user.additional_roles) {
    user.additional_roles.forEach(role => {
      if (!roleNames.includes(role.name)) {
        roleNames.push(role.name);
      }
    });
  }
  
  return roleNames;
}

/**
 * Check if user has any of the specified roles
 */
export function userHasAnyRole(user: User | null, targetRoles: string[]): boolean {
  if (!user || !targetRoles || targetRoles.length === 0) return false;
  
  const userRoles = getAllUserRoleNames(user);
  return targetRoles.some(role => userRoles.includes(role));
}

/**
 * Check if user has all of the specified roles
 */
export function userHasAllRoles(user: User | null, targetRoles: string[]): boolean {
  if (!user || !targetRoles || targetRoles.length === 0) return false;
  
  const userRoles = getAllUserRoleNames(user);
  return targetRoles.every(role => userRoles.includes(role));
}

/**
 * Check if user has a specific role (primary or additional)
 */
export function userHasRole(user: User | null, roleName: string): boolean {
  return userHasAnyRole(user, [roleName]);
}

/**
 * Check if user is admin (has admin or super_admin role, or isSA flag)
 */
export function isUserAdmin(user: User | null): boolean {
  if (!user) return false;
  
  // Check isSA flag first
  if (user.isSA) return true;
  
  // Check for admin roles
  return userHasAnyRole(user, ['admin', 'super_admin']);
}

/**
 * Check if user is HR (has hr or hrm role)
 */
export function isUserHR(user: User | null): boolean {
  return userHasAnyRole(user, ['hr', 'hrm']);
}

/**
 * Check if user is manager (has any manager role)
 */
export function isUserManager(user: User | null): boolean {
  return userHasAnyRole(user, ['sdm', 'bdm', 'qam', 'hrm', 'manager']);
}

/**
 * Check if user is finance (has finance role)
 */
export function isUserFinance(user: User | null): boolean {
  return userHasAnyRole(user, ['finance', 'finance_manager']);
}

/**
 * Get user's effective access level based on all roles
 */
export function getUserAccessLevel(user: User | null): 'none' | 'own' | 'team' | 'all' {
  if (!user) return 'none';
  
  // Admin has all access
  if (isUserAdmin(user)) return 'all';
  
  // HR has all access
  if (isUserHR(user)) return 'all';
  
  // Managers have team access
  if (isUserManager(user)) return 'team';
  
  // Regular employees have own access
  return 'own';
}

/**
 * Get aggregated permissions from all user roles
 */
export function getUserAggregatedPermissions(user: User | null): Record<string, any> {
  if (!user) return {};
  
  // Use pre-computed aggregated permissions if available
  if (user.aggregated_permissions) {
    return user.aggregated_permissions;
  }
  
  // Fallback: merge permissions manually
  let aggregatedPermissions: Record<string, any> = {};
  
  // Start with extra permissions (highest priority)
  if (user.extra_permissions) {
    aggregatedPermissions = { ...user.extra_permissions };
  }
  
  return aggregatedPermissions;
}

/**
 * Get aggregated dashboards from all user roles
 */
export function getUserAggregatedDashboards(user: User | null): string[] {
  if (!user) return [];
  
  // Use pre-computed aggregated dashboards if available
  if (user.aggregated_dashboards) {
    return user.aggregated_dashboards;
  }
  
  // Fallback: return empty array (will be handled by role-based logic)
  return [];
}

/**
 * Check if user has elevated privileges (admin, HR, or manager)
 */
export function hasElevatedPrivileges(user: User | null): boolean {
  return isUserAdmin(user) || isUserHR(user) || isUserManager(user);
}

/**
 * Get primary role name for display purposes
 */
export function getPrimaryRoleName(user: User | null): string {
  if (!user) return 'employee';
  
  if (user.role?.name) {
    return user.role.name;
  }
  
  if (user.role_id) {
    return user.role_id;
  }
  
  return 'employee';
}

/**
 * Get all role IDs for a user (primary + additional)
 */
export function getAllUserRoleIds(user: User | null): string[] {
  if (!user) return [];
  
  const roleIds: string[] = [];
  
  // Add primary role ID
  if (user.role_id) {
    roleIds.push(user.role_id);
  }
  
  // Add additional role IDs
  if (user.additional_role_ids) {
    user.additional_role_ids.forEach(roleId => {
      if (!roleIds.includes(roleId)) {
        roleIds.push(roleId);
      }
    });
  }
  
  return roleIds;
}

/**
 * Get a summary of all permissions a user has from their roles
 * Useful for debugging and admin interfaces
 */
export function getUserPermissionSummary(user: User | null): {
  roles: string[];
  accessLevel: 'none' | 'own' | 'team' | 'all';
  capabilities: string[];
  dashboards: string[];
} {
  if (!user) {
    return {
      roles: [],
      accessLevel: 'none',
      capabilities: [],
      dashboards: []
    };
  }
  
  const roles = getAllUserRoleNames(user);
  const accessLevel = getUserAccessLevel(user);
  const capabilities: string[] = [];
  
  // Determine capabilities based on roles
  if (isUserAdmin(user)) {
    capabilities.push('Full System Access', 'User Management', 'Role Management', 'All CRUD Operations');
  }
  
  if (isUserHR(user)) {
    capabilities.push('Employee Management', 'Department Management', 'Leave Management', 'Performance Reviews');
  }
  
  if (isUserManager(user)) {
    capabilities.push('Team Management', 'Performance Evaluation', 'KRA Assignment', 'Team Reports');
  }
  
  if (isUserFinance(user)) {
    capabilities.push('Financial Data Access', 'Salary Information', 'Asset Management', 'Expense Reports');
  }
  
  // Get accessible dashboards
  const dashboards = user.aggregated_dashboards || [];
  
  return {
    roles,
    accessLevel,
    capabilities,
    dashboards
  };
}

/**
 * Check if user can perform a specific action based on all their roles
 * This is a high-level permission checker that aggregates from all roles
 */
export function canUserPerformAction(user: User | null, action: string, resource?: string): boolean {
  if (!user) return false;
  
  // Admin can do everything
  if (isUserAdmin(user)) return true;
  
  const roles = getAllUserRoleNames(user);
  
  // Define action-role mappings
  const actionPermissions: Record<string, string[]> = {
    'create_employee': ['hr', 'hrm', 'admin', 'super_admin'],
    'edit_employee': ['hr', 'hrm', 'admin', 'super_admin', 'sdm', 'bdm', 'qam'],
    'delete_employee': ['admin', 'super_admin'],
    'view_all_employees': ['hr', 'hrm', 'admin', 'super_admin', 'finance'],
    'manage_roles': ['admin', 'super_admin'],
    'manage_departments': ['hr', 'hrm', 'admin', 'super_admin'],
    'view_salary': ['hr', 'hrm', 'admin', 'super_admin', 'finance', 'finance_manager'],
    'assign_kra': ['hr', 'hrm', 'admin', 'super_admin', 'sdm', 'bdm', 'qam'],
    'evaluate_performance': ['hr', 'hrm', 'admin', 'super_admin', 'sdm', 'bdm', 'qam'],
    'manage_assets': ['hr', 'hrm', 'admin', 'super_admin', 'finance', 'finance_manager', 'sdm', 'bdm', 'qam'],
  };
  
  const allowedRoles = actionPermissions[action];
  if (!allowedRoles) return false;
  
  return roles.some(role => allowedRoles.includes(role));
}

/**
 * Check if user has office admin role
 */
export function isUserOfficeAdmin(user: User | null): boolean {
  if (!user) return false;
  
  const userRoles = getAllUserRoleNames(user);
  return userRoles.includes('office_admin');
}

/**
 * Check if user has IT helpdesk role
 */
export function isUserITHelpdesk(user: User | null): boolean {
  if (!user) return false;
  
  const userRoles = getAllUserRoleNames(user);
  return userRoles.includes('it_helpdesk');
}
