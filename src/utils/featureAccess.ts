import { DASHBOARD_CONFIG, ROLE_DASHBOARD_MAPPING } from '@/constants';
import type { User } from '@/types';

/**
 * Check if a user has access to a specific dashboard
 */
export function hasUserDashboardAccess(user: User, dashboardId: string): boolean {
  if (!user || !dashboardId) return false;

  const roleName = user.role?.name || user.role_id || 'employee';
  const roleBasedDashboards = ROLE_DASHBOARD_MAPPING[roleName as keyof typeof ROLE_DASHBOARD_MAPPING] || [];
  
  // Check role-based access
  const hasRoleAccess = roleBasedDashboards.includes(dashboardId);
  
  // Check explicit permissions
  const hasExplicitAccess = user.extra_permissions?.dashboards?.[dashboardId] === true;
  
  return hasRoleAccess || hasExplicitAccess;
}

/**
 * Check if a user has access to a specific page within a dashboard
 */
export function hasUserPageAccess(user: User, dashboardId: string, pageId: string): boolean {
  if (!user || !dashboardId || !pageId) return false;

  // First check if user has dashboard access
  if (!hasUserDashboardAccess(user, dashboardId)) return false;

  const roleName = user.role?.name || user.role_id || 'employee';
  const roleBasedDashboards = ROLE_DASHBOARD_MAPPING[roleName as keyof typeof ROLE_DASHBOARD_MAPPING] || [];
  
  // Check if dashboard is role-based (default all pages accessible)
  const isDashboardRoleBased = roleBasedDashboards.includes(dashboardId);
  
  // Check explicit page permissions
  const explicitPageAccess = user.extra_permissions?.pages?.[dashboardId]?.[pageId];
  
  // If explicit permission exists, use it
  if (explicitPageAccess !== undefined) {
    return explicitPageAccess;
  }
  
  // If no explicit permission and dashboard is role-based, allow access
  // If dashboard is only explicitly granted, default to allow all pages
  return isDashboardRoleBased || hasUserDashboardAccess(user, dashboardId);
}

/**
 * Get all accessible dashboards for a user
 */
export function getUserAccessibleDashboards(user: User): string[] {
  if (!user) return [];

  const roleName = user.role?.name || user.role_id || 'employee';
  const roleBasedDashboards = ROLE_DASHBOARD_MAPPING[roleName as keyof typeof ROLE_DASHBOARD_MAPPING] || [];
  
  const explicitDashboards = Object.keys(user.extra_permissions?.dashboards || {})
    .filter(dashboardId => user.extra_permissions?.dashboards?.[dashboardId] === true);
  
  // Combine role-based and explicit permissions, remove duplicates
  return [...new Set([...roleBasedDashboards, ...explicitDashboards])];
}

/**
 * Get all accessible pages for a user within a specific dashboard
 */
export function getUserAccessiblePages(user: User, dashboardId: string): string[] {
  if (!user || !dashboardId) return [];

  const dashboard = DASHBOARD_CONFIG.find(d => d.id === dashboardId);
  if (!dashboard) return [];

  // Check if user has dashboard access first
  if (!hasUserDashboardAccess(user, dashboardId)) return [];

  const accessiblePages: string[] = [];
  
  dashboard.pages.forEach(page => {
    if (hasUserPageAccess(user, dashboardId, page.id)) {
      accessiblePages.push(page.id);
    }
  });

  return accessiblePages;
}

/**
 * Get user's effective permissions (role-based + explicit)
 */
export function getUserEffectivePermissions(user: User): {
  dashboards: Record<string, boolean>;
  pages: Record<string, Record<string, boolean>>;
} {
  if (!user) return { dashboards: {}, pages: {} };

  const roleName = user.role?.name || user.role_id || 'employee';
  const roleBasedDashboards = ROLE_DASHBOARD_MAPPING[roleName as keyof typeof ROLE_DASHBOARD_MAPPING] || [];
  
  // Build effective dashboard permissions
  const effectiveDashboardPermissions: Record<string, boolean> = {};
  
  // Start with role-based permissions
  DASHBOARD_CONFIG.forEach(dashboard => {
    effectiveDashboardPermissions[dashboard.id] = roleBasedDashboards.includes(dashboard.id);
  });
  
  // Override with explicit permissions
  const explicitDashboards = user.extra_permissions?.dashboards || {};
  Object.keys(explicitDashboards).forEach(dashboardId => {
    effectiveDashboardPermissions[dashboardId] = explicitDashboards[dashboardId];
  });
  
  // Build effective page permissions
  const effectivePagePermissions: Record<string, Record<string, boolean>> = {};
  
  DASHBOARD_CONFIG.forEach(dashboard => {
    effectivePagePermissions[dashboard.id] = {};
    
    const isDashboardAccessible = effectiveDashboardPermissions[dashboard.id];
    
    dashboard.pages.forEach(page => {
      // Default to dashboard accessibility
      effectivePagePermissions[dashboard.id][page.id] = isDashboardAccessible;
    });
    
    // Override with explicit page permissions
    const explicitPages = user.extra_permissions?.pages?.[dashboard.id] || {};
    Object.keys(explicitPages).forEach(pageId => {
      effectivePagePermissions[dashboard.id][pageId] = explicitPages[pageId];
    });
  });
  
  return {
    dashboards: effectiveDashboardPermissions,
    pages: effectivePagePermissions
  };
}

/**
 * Check if a path is accessible to a user
 */
export function isPathAccessible(user: User, path: string): boolean {
  if (!user || !path) return false;

  // Find the dashboard and page that matches the path
  for (const dashboard of DASHBOARD_CONFIG) {
    for (const page of dashboard.pages) {
      if (page.path === path || path.startsWith(page.path + '/')) {
        return hasUserPageAccess(user, dashboard.id, page.id);
      }
    }
  }
  
  // If no specific page found, check if it's a dashboard root path
  for (const dashboard of DASHBOARD_CONFIG) {
    if (path === `/${dashboard.slug}` || path.startsWith(`/${dashboard.slug}/`)) {
      return hasUserDashboardAccess(user, dashboard.id);
    }
  }
  
  return false;
}

/**
 * Get user's accessible navigation items
 */
export function getUserNavigationItems(user: User): Array<{
  dashboard: typeof DASHBOARD_CONFIG[0];
  pages: typeof DASHBOARD_CONFIG[0]['pages'];
}> {
  if (!user) return [];

  const accessibleItems: Array<{
    dashboard: typeof DASHBOARD_CONFIG[0];
    pages: typeof DASHBOARD_CONFIG[0]['pages'];
  }> = [];

  DASHBOARD_CONFIG.forEach(dashboard => {
    if (hasUserDashboardAccess(user, dashboard.id)) {
      const accessiblePages = dashboard.pages.filter(page => 
        hasUserPageAccess(user, dashboard.id, page.id)
      );
      
      if (accessiblePages.length > 0) {
        accessibleItems.push({
          dashboard,
          pages: accessiblePages
        });
      }
    }
  });

  return accessibleItems;
}

/**
 * Permission checking hook-like function for components
 */
export function createPermissionChecker(user: User | null) {
  return {
    canAccessDashboard: (dashboardId: string) => user ? hasUserDashboardAccess(user, dashboardId) : false,
    canAccessPage: (dashboardId: string, pageId: string) => user ? hasUserPageAccess(user, dashboardId, pageId) : false,
    canAccessPath: (path: string) => user ? isPathAccessible(user, path) : false,
    getAccessibleDashboards: () => user ? getUserAccessibleDashboards(user) : [],
    getAccessiblePages: (dashboardId: string) => user ? getUserAccessiblePages(user, dashboardId) : [],
    getNavigationItems: () => user ? getUserNavigationItems(user) : [],
  };
}

/**
 * Feature flags and advanced permissions
 */
export const FEATURE_FLAGS = {
  ASSET_MANAGEMENT: 'asset_management',
  LEAVE_APPROVAL: 'leave_approval', 
  PERFORMANCE_REVIEWS: 'performance_reviews',
  BILLING_MANAGEMENT: 'billing_management',
  USER_MANAGEMENT: 'user_management',
  DEPARTMENT_MANAGEMENT: 'department_management',
  ROLE_MANAGEMENT: 'role_management',
  SYSTEM_SETTINGS: 'system_settings',
  ANALYTICS_ACCESS: 'analytics_access',
  EXPORT_DATA: 'export_data',
  BULK_OPERATIONS: 'bulk_operations',
} as const;

/**
 * Check if user has a specific feature flag enabled
 */
export function hasFeatureAccess(user: User, feature: string): boolean {
  if (!user || !feature) return false;
  
  return user.extra_permissions?.features?.[feature] === true;
}

/**
 * CRUD operation permissions
 */
export const CRUD_OPERATIONS = {
  CREATE: 'create',
  READ: 'read', 
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

/**
 * Check CRUD permissions for a specific resource
 */
export function hasCrudAccess(user: User, resource: string, operation: string): boolean {
  if (!user || !resource || !operation) return false;
  
  return user.extra_permissions?.crud?.[resource]?.[operation] === true;
}
