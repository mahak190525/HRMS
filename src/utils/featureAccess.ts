import { DASHBOARD_CONFIG, ROLE_DASHBOARD_MAPPING } from '@/constants';
import type { User, DashboardPermissions, PagePermissions } from '@/types';
import { getAllUserRoleNames, isUserAdmin } from './multipleRoles';
import { supabase } from '@/services/supabase';

/**
 * Check if a user has access to a specific dashboard
 * Uses combination of role-level permissions AND individual user permissions
 * Individual permissions (extra_permissions) can override or supplement role permissions
 */
export function hasUserDashboardAccess(
  user: User, 
  dashboardId: string,
  rolePermissions?: { dashboard_permissions: Record<string, DashboardPermissions> }
): boolean {
  if (!user || !dashboardId) return false;

  // Admin users have access to all dashboards
  if (isUserAdmin(user)) return true;

  // Use OR logic: Grant access if user has permission via ANY method
  // 1. User-level permissions (explicit override)
  // 2. Role-level permissions
  // 3. ROLE_DASHBOARD_MAPPING fallback

  // Check 1: User-level dashboard permissions
  const explicitUserAccess = user.extra_permissions?.dashboards?.[dashboardId];
  if (explicitUserAccess === true) {
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Dashboard access granted via user-level permissions:', {
        dashboardId,
        userId: user.id
      });
    }
    return true;
  }

  // Check 2: Role-level dashboard permissions (OR with user permissions)
  if (rolePermissions?.dashboard_permissions) {
    const perms = rolePermissions.dashboard_permissions[dashboardId];
    if (perms) {
      // Normalize boolean values (handle string "true"/"false" from JSON)
      const normalizeBool = (val: any): boolean => {
        if (typeof val === 'boolean') return val;
        if (val === 'true' || val === true || val === 1) return true;
        return false;
      };
      
      const hasView = normalizeBool(perms.view);
      const hasRead = normalizeBool(perms.read);
      
      if (hasView || hasRead) {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Dashboard access granted via role-level permissions:', {
            dashboardId,
            perms: { view: hasView, read: hasRead, write: normalizeBool(perms.write), delete: normalizeBool(perms.delete) },
            userId: user.id
          });
        }
        return true;
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('❌ Dashboard access denied - role-level permissions explicitly false:', {
            dashboardId,
            perms,
            userId: user.id
          });
        }
      }
    }
  }

  // Check 3: ROLE_DASHBOARD_MAPPING fallback (OR with above)
  const userRoles = getAllUserRoleNames(user);
  const hasRoleAccess = userRoles.some(roleName => {
    const roleBasedDashboards = ROLE_DASHBOARD_MAPPING[roleName as keyof typeof ROLE_DASHBOARD_MAPPING] || [];
    return roleBasedDashboards.includes(dashboardId as any);
  });
  
  if (hasRoleAccess) {
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Dashboard access granted via ROLE_DASHBOARD_MAPPING:', {
        dashboardId,
        userRoles,
        userId: user.id
      });
    }
    return true;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('❌ Dashboard access denied - no permissions found:', {
      dashboardId,
      userId: user.id,
      rolePermissions: rolePermissions?.dashboard_permissions[dashboardId]
    });
  }
  
  return false;
}

/**
 * Check if a user has access to a specific page within a dashboard
 * Uses combination of role-level permissions AND individual user permissions
 * Individual permissions (extra_permissions) can override or supplement role permissions
 */
export function hasUserPageAccess(
  user: User, 
  dashboardId: string, 
  pageId: string,
  rolePermissions?: { 
    dashboard_permissions: Record<string, DashboardPermissions>;
    page_permissions: Record<string, Record<string, PagePermissions>>;
  }
): boolean {
  if (!user || !dashboardId || !pageId) return false;

  // Admin users have access to all pages
  if (isUserAdmin(user)) return true;

  // Use OR logic with explicit page permissions taking precedence
  // 1. User-level page permissions (explicit override - true or false)
  // 2. Role-level page permissions (explicit - true or false)
  // 3. Dashboard permissions (inherited ONLY if page has no explicit permissions)
  // 4. ROLE_DASHBOARD_MAPPING fallback (ONLY if page has no explicit permissions)

  // Check 1: User-level page permissions (explicit override)
  // If user-level is explicitly true, grant access immediately
  // If user-level is explicitly false, still check role-level permissions
  // (role-level permissions can override explicit false if they grant access)
  const explicitUserPageAccess = user.extra_permissions?.pages?.[dashboardId]?.[pageId];
  if (explicitUserPageAccess === true) {
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Page access granted via user-level permissions:', {
        dashboardId,
        pageId,
        userId: user.id
      });
    }
    return true;
  }
  // Note: If explicitUserPageAccess === false, we continue to check role-level permissions
  // This allows role-level permissions to override explicit false values

  // Check 2: Role-level page permissions (explicit - true or false)
  if (rolePermissions?.page_permissions && 
      rolePermissions.page_permissions[dashboardId] && 
      rolePermissions.page_permissions[dashboardId][pageId]) {
    const perms = rolePermissions.page_permissions[dashboardId][pageId];
    
    // Normalize boolean values (handle string "true"/"false" from JSON)
    const normalizeBool = (val: any): boolean => {
      if (typeof val === 'boolean') return val;
      if (val === 'true' || val === true || val === 1) return true;
      return false;
    };
    
    // Check if any permission is explicitly set (not just undefined)
    const hasView = normalizeBool(perms.view);
    const hasRead = normalizeBool(perms.read);
    const hasExplicitPermission = perms && (
      perms.view !== undefined || perms.read !== undefined
    );
    
    if (hasExplicitPermission) {
      // Role has explicit page permissions
      if (hasView || hasRead) {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Page access granted via role-level page permissions:', {
            dashboardId,
            pageId,
            perms: { view: hasView, read: hasRead, write: normalizeBool(perms.write), delete: normalizeBool(perms.delete) },
            userId: user.id
          });
        }
        return true;
      } else {
        // Explicit false means deny, even if dashboard has access
        if (process.env.NODE_ENV === 'development') {
          console.log('❌ Page access denied - role-level page permissions explicitly false:', {
            dashboardId,
            pageId,
            perms: { view: hasView, read: hasRead },
            userId: user.id
          });
        }
        return false;
      }
    }
  }

  // Check 3: Dashboard permissions (inherited ONLY if page has no explicit permissions)
  // Only inherit if neither user nor role has explicit page permissions
  const hasDashboardAccess = hasUserDashboardAccess(user, dashboardId, rolePermissions);
  if (hasDashboardAccess) {
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Page access granted via dashboard permissions (inherited):', {
        dashboardId,
        pageId,
        userId: user.id,
        reason: 'No explicit page permissions found, inheriting from dashboard'
      });
    }
    return true;
  }

  // Check 4: ROLE_DASHBOARD_MAPPING fallback (ONLY if page has no explicit permissions)
  const userRoles = getAllUserRoleNames(user);
  const isDashboardRoleBased = userRoles.some(roleName => {
    const roleBasedDashboards = ROLE_DASHBOARD_MAPPING[roleName as keyof typeof ROLE_DASHBOARD_MAPPING] || [];
    return roleBasedDashboards.includes(dashboardId as any);
  });
  
  if (isDashboardRoleBased) {
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Page access granted via ROLE_DASHBOARD_MAPPING fallback:', {
        dashboardId,
        pageId,
        userRoles,
        userId: user.id,
        reason: 'No explicit page permissions found, using role mapping'
      });
    }
    return true;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('❌ Page access denied - no permissions found:', {
      dashboardId,
      pageId,
      userId: user.id,
      rolePermissions: rolePermissions ? {
        dashboard: rolePermissions.dashboard_permissions[dashboardId],
        page: rolePermissions.page_permissions[dashboardId]?.[pageId]
      } : null
    });
  }
  
  return false;
}

/**
 * Get all accessible dashboards for a user
 * Filters based on combination of role-level permissions AND individual user permissions
 */
export function getUserAccessibleDashboards(
  user: User,
  rolePermissions?: { dashboard_permissions: Record<string, DashboardPermissions> }
): string[] {
  if (!user) return [];

  // Admin users have access to all dashboards
  if (isUserAdmin(user)) {
    return DASHBOARD_CONFIG.map(d => d.id);
  }

  // Filter dashboards based on role-level permissions AND individual permissions
  const accessibleDashboards: string[] = [];
  const userRoles = getAllUserRoleNames(user);
  const explicitUserDashboards = user.extra_permissions?.dashboards || {};
  
  DASHBOARD_CONFIG.forEach(dashboard => {
    // Check individual user permissions first (explicit override)
    const explicitAccess = explicitUserDashboards[dashboard.id];
    if (explicitAccess === true) {
      accessibleDashboards.push(dashboard.id);
      return;
    }
    if (explicitAccess === false) {
      // Explicitly denied, skip
      return;
    }

    // Check role-level permissions
    if (rolePermissions?.dashboard_permissions[dashboard.id]) {
      const perms = rolePermissions.dashboard_permissions[dashboard.id];
      if (perms.view || perms.read) {
        accessibleDashboards.push(dashboard.id);
        return;
      }
    }

    // Fallback: Check role-based access from ROLE_DASHBOARD_MAPPING (legacy)
    const hasRoleAccess = userRoles.some(roleName => {
      const roleBasedDashboards = ROLE_DASHBOARD_MAPPING[roleName as keyof typeof ROLE_DASHBOARD_MAPPING] || [];
      return roleBasedDashboards.includes(dashboard.id as any);
    });
    
    if (hasRoleAccess) {
      accessibleDashboards.push(dashboard.id);
    }
  });
  
  return accessibleDashboards;
}

/**
 * Get all accessible pages for a user within a specific dashboard
 * Now filters based on role-level permissions from database
 */
export function getUserAccessiblePages(
  user: User, 
  dashboardId: string,
  rolePermissions?: { 
    dashboard_permissions: Record<string, DashboardPermissions>;
    page_permissions: Record<string, Record<string, PagePermissions>>;
  }
): string[] {
  if (!user || !dashboardId) return [];

  const dashboard = DASHBOARD_CONFIG.find(d => d.id === dashboardId);
  if (!dashboard) return [];

  // Check if user has dashboard access first
  if (!hasUserDashboardAccess(user, dashboardId, rolePermissions)) return [];

  const accessiblePages: string[] = [];
  
  dashboard.pages.forEach(page => {
    if (hasUserPageAccess(user, dashboardId, page.id, rolePermissions)) {
      accessiblePages.push(page.id);
    }
  });

  return accessiblePages;
}

/**
 * Get user's effective permissions (role-based + individual)
 * Uses combination of role-level permissions AND individual user permissions
 */
export function getUserEffectivePermissions(
  user: User,
  rolePermissions?: { 
    dashboard_permissions: Record<string, DashboardPermissions>;
    page_permissions: Record<string, Record<string, PagePermissions>>;
  }
): {
  dashboards: Record<string, boolean>;
  pages: Record<string, Record<string, boolean>>;
} {
  if (!user) return { dashboards: {}, pages: {} };

  // Admin users have access to everything
  if (isUserAdmin(user)) {
    const allDashboards: Record<string, boolean> = {};
    const allPages: Record<string, Record<string, boolean>> = {};
    
    DASHBOARD_CONFIG.forEach(dashboard => {
      allDashboards[dashboard.id] = true;
      allPages[dashboard.id] = {};
      dashboard.pages.forEach(page => {
        allPages[dashboard.id][page.id] = true;
      });
    });
    
    return { dashboards: allDashboards, pages: allPages };
  }

  // Build effective dashboard permissions from role-level + individual permissions
  const effectiveDashboardPermissions: Record<string, boolean> = {};
  const userRoles = getAllUserRoleNames(user);
  const explicitUserDashboards = user.extra_permissions?.dashboards || {};
  
  DASHBOARD_CONFIG.forEach(dashboard => {
    // Check individual user permissions first (explicit override)
    if (explicitUserDashboards[dashboard.id] !== undefined) {
      effectiveDashboardPermissions[dashboard.id] = explicitUserDashboards[dashboard.id] === true;
    } else {
      // Check role-level permissions
      if (rolePermissions?.dashboard_permissions[dashboard.id]) {
        const perms = rolePermissions.dashboard_permissions[dashboard.id];
        effectiveDashboardPermissions[dashboard.id] = perms.view || perms.read || false;
      } else {
        // Fallback to ROLE_DASHBOARD_MAPPING
        const roleBasedDashboards = userRoles.flatMap(roleName => 
          ROLE_DASHBOARD_MAPPING[roleName as keyof typeof ROLE_DASHBOARD_MAPPING] || []
        );
        effectiveDashboardPermissions[dashboard.id] = roleBasedDashboards.includes(dashboard.id as any);
      }
    }
  });
  
  // Build effective page permissions from role-level + individual permissions
  const effectivePagePermissions: Record<string, Record<string, boolean>> = {};
  const explicitUserPages = user.extra_permissions?.pages || {};
  
  DASHBOARD_CONFIG.forEach(dashboard => {
    effectivePagePermissions[dashboard.id] = {};
    
    const isDashboardAccessible = effectiveDashboardPermissions[dashboard.id];
    
    dashboard.pages.forEach(page => {
      // Check individual user page permissions first (explicit override)
      if (explicitUserPages[dashboard.id]?.[page.id] !== undefined) {
        effectivePagePermissions[dashboard.id][page.id] = explicitUserPages[dashboard.id][page.id] === true;
      } else {
        // Check role-level page permissions
        if (rolePermissions?.page_permissions[dashboard.id]?.[page.id]) {
          const perms = rolePermissions.page_permissions[dashboard.id][page.id];
          effectivePagePermissions[dashboard.id][page.id] = perms.view || perms.read || false;
        } else {
          // Inherit from dashboard permissions
          effectivePagePermissions[dashboard.id][page.id] = isDashboardAccessible;
        }
      }
    });
  });
  
  return {
    dashboards: effectiveDashboardPermissions,
    pages: effectivePagePermissions
  };
}

/**
 * Check if a path is accessible to a user
 * Now checks role-level permissions from database
 */
export function isPathAccessible(
  user: User, 
  path: string,
  rolePermissions?: { 
    dashboard_permissions: Record<string, DashboardPermissions>;
    page_permissions: Record<string, Record<string, PagePermissions>>;
  }
): boolean {
  if (!user || !path) return false;

  // Normalize path (remove trailing slash, ensure it starts with /)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const cleanPath = normalizedPath.endsWith('/') && normalizedPath.length > 1 
    ? normalizedPath.slice(0, -1) 
    : normalizedPath;

  // Find the dashboard and page that matches the path
  // First, try exact matches (most specific)
  for (const dashboard of DASHBOARD_CONFIG) {
    for (const page of dashboard.pages) {
      // Exact match takes priority
      if (page.path === cleanPath) {
        const hasAccess = hasUserPageAccess(user, dashboard.id, page.id, rolePermissions);
        
        // Debug logging in development
        if (process.env.NODE_ENV === 'development') {
          if (hasAccess) {
            console.log('✅ Page Access Granted (exact match):', {
              path: cleanPath,
              dashboardId: dashboard.id,
              pageId: page.id
            });
          } else {
            console.log('🔒 Page Access Denied (exact match):', {
              path: cleanPath,
              dashboardId: dashboard.id,
              pageId: page.id,
              rolePermissions: rolePermissions ? {
                dashboard: rolePermissions.dashboard_permissions[dashboard.id],
                page: rolePermissions.page_permissions[dashboard.id]?.[page.id]
              } : null
            });
          }
        }
        
        return hasAccess;
      }
    }
  }
  
  // Then try prefix matches, but prioritize longer/more specific paths
  // Sort pages by path length (longest first) to match most specific paths first
  for (const dashboard of DASHBOARD_CONFIG) {
    const sortedPages = [...dashboard.pages].sort((a, b) => b.path.length - a.path.length);
    for (const page of sortedPages) {
      // Path starts with page path followed by /
      if (cleanPath.startsWith(page.path + '/')) {
        const hasAccess = hasUserPageAccess(user, dashboard.id, page.id, rolePermissions);
        
        // Debug logging in development
        if (process.env.NODE_ENV === 'development') {
          if (hasAccess) {
            console.log('✅ Page Access Granted (prefix match):', {
              path: cleanPath,
              dashboardId: dashboard.id,
              pageId: page.id,
              matchedPath: page.path
            });
          } else {
            console.log('🔒 Page Access Denied (prefix match):', {
              path: cleanPath,
              dashboardId: dashboard.id,
              pageId: page.id,
              matchedPath: page.path,
              rolePermissions: rolePermissions ? {
                dashboard: rolePermissions.dashboard_permissions[dashboard.id],
                page: rolePermissions.page_permissions[dashboard.id]?.[page.id]
              } : null
            });
          }
        }
        
        return hasAccess;
      }
    }
  }
  
  // If no specific page found, check if it's a dashboard root path
  for (const dashboard of DASHBOARD_CONFIG) {
    const dashboardPath = `/${dashboard.slug}`;
    if (cleanPath === dashboardPath || cleanPath.startsWith(dashboardPath + '/')) {
      const hasAccess = hasUserDashboardAccess(user, dashboard.id, rolePermissions);
      
      // Debug logging in development
      if (!hasAccess && process.env.NODE_ENV === 'development') {
        console.log('🔒 Dashboard Access Denied:', {
          path: cleanPath,
          dashboardId: dashboard.id,
          rolePermissions: rolePermissions?.dashboard_permissions[dashboard.id]
        });
      }
      
      return hasAccess;
    }
  }
  
  return false;
}

/**
 * Get user's accessible navigation items
 * Now filters based on role-level permissions from database
 */
export function getUserNavigationItems(
  user: User,
  rolePermissions?: { 
    dashboard_permissions: Record<string, DashboardPermissions>;
    page_permissions: Record<string, Record<string, PagePermissions>>;
  }
): Array<{
  dashboard: typeof DASHBOARD_CONFIG[0];
  pages: typeof DASHBOARD_CONFIG[0]['pages'];
}> {
  if (!user) return [];

  const accessibleItems: Array<{
    dashboard: typeof DASHBOARD_CONFIG[0];
    pages: typeof DASHBOARD_CONFIG[0]['pages'];
  }> = [];

  DASHBOARD_CONFIG.forEach(dashboard => {
    if (hasUserDashboardAccess(user, dashboard.id, rolePermissions)) {
      const accessiblePages = dashboard.pages.filter(page => 
        hasUserPageAccess(user, dashboard.id, page.id, rolePermissions)
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
 * Note: Feature flags should be configured in roles table, not extra_permissions
 * This function is kept for backward compatibility but returns false
 * TODO: Implement feature flags in roles table if needed
 */
export function hasFeatureAccess(user: User, feature: string): boolean {
  if (!user || !feature) return false;
  
  // Admin users have access to all features
  if (isUserAdmin(user)) return true;
  
  // Feature flags should be implemented in roles table
  // For now, return false as we're not using extra_permissions
  return false;
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
 * Uses role-based permissions only (no extra_permissions)
 */
export function hasCrudAccess(user: User, resource: string, operation: string): boolean {
  if (!user || !resource || !operation) return false;
  
  // Check if user is admin (full access)
  if (isUserAdmin(user)) return true;
  
  // Get all user roles for aggregated permissions
  const userRoles = getAllUserRoleNames(user);
  
  // Check role-based CRUD permissions
  for (const roleName of userRoles) {
    // HR roles have CRUD access to most resources
    if (['hr', 'hrm'].includes(roleName)) {
      if (['employees', 'departments', 'leave_applications', 'performance'].includes(resource)) {
        return true;
      }
    }
    
    // Manager roles have CRUD access to team-related resources
    if (['sdm', 'bdm', 'qam', 'manager'].includes(roleName)) {
      if (['team_employees', 'performance', 'kra'].includes(resource)) {
        return true;
      }
      // Managers have read access to employee data
      if (resource === 'employees' && operation === 'read') {
        return true;
      }
    }
    
    // Finance roles have CRUD access to financial resources
    if (['finance', 'finance_manager'].includes(roleName)) {
      if (['assets', 'salary', 'expenses'].includes(resource)) {
        return true;
      }
      // Finance has read access to employee data
      if (resource === 'employees' && operation === 'read') {
        return true;
      }
    }
  }
  
  // No extra_permissions - only role-based access
  return false;
}

/**
 * Check if user has a specific CRUD operation permission on a dashboard
 * This checks role-level permissions from the database
 */
export async function hasDashboardCrudPermission(
  user: User,
  dashboardId: string,
  operation: 'read' | 'write' | 'view' | 'delete'
): Promise<boolean> {
  if (!user || !dashboardId || !operation) return false;
  
  // Admin users have all permissions
  if (isUserAdmin(user)) return true;
  
  try {
    // Get all role IDs for the user
    const allRoleIds: string[] = [];
    if (user.role_id) allRoleIds.push(user.role_id);
    if (user.additional_role_ids && user.additional_role_ids.length > 0) {
      allRoleIds.push(...user.additional_role_ids);
    }
    
    if (allRoleIds.length === 0) return false;
    
    // Fetch roles with dashboard permissions
    const { data: roles, error } = await supabase
      .from('roles')
      .select('dashboard_permissions')
      .in('id', allRoleIds);
    
    if (error) {
      console.error('Error fetching role permissions:', error);
      return false;
    }
    
    // Check if any role has the permission
    for (const role of roles || []) {
      const dashPerms = role.dashboard_permissions as Record<string, DashboardPermissions> | undefined;
      if (dashPerms?.[dashboardId]?.[operation]) {
        return true;
      }
    }
    
    // Fallback to legacy role-based access
    const userRoles = getAllUserRoleNames(user);
    const hasRoleAccess = userRoles.some(roleName => {
      const roleBasedDashboards = ROLE_DASHBOARD_MAPPING[roleName as keyof typeof ROLE_DASHBOARD_MAPPING] || [];
      return roleBasedDashboards.includes(dashboardId as any);
    });
    
    // If role has dashboard access and no explicit CRUD permissions, default to view/read
    if (hasRoleAccess && (operation === 'read' || operation === 'view')) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking dashboard CRUD permission:', error);
    return false;
  }
}

/**
 * Check if user has a specific CRUD operation permission on a page
 * This checks role-level permissions from the database
 * If a page is explicitly enabled (any permission is true), grant all CRUD operations
 */
export async function hasPageCrudPermission(
  user: User,
  dashboardId: string,
  pageId: string,
  operation: 'read' | 'write' | 'view' | 'delete'
): Promise<boolean> {
  if (!user || !dashboardId || !pageId || !operation) return false;
  
  // Admin users have all permissions
  if (isUserAdmin(user)) return true;
  
  // First check dashboard access
  const hasDashboardAccess = await hasDashboardCrudPermission(user, dashboardId, 'view');
  if (!hasDashboardAccess) return false;
  
  try {
    // Check user-level page permissions first (explicit override)
    const explicitUserPageAccess = user.extra_permissions?.pages?.[dashboardId]?.[pageId];
    if (explicitUserPageAccess === true) {
      // If page is explicitly enabled for user, grant all CRUD operations
      return true;
    }
    if (explicitUserPageAccess === false) {
      // Explicitly denied
      return false;
    }
    
    // Get all role IDs for the user
    const allRoleIds: string[] = [];
    if (user.role_id) allRoleIds.push(user.role_id);
    if (user.additional_role_ids && user.additional_role_ids.length > 0) {
      allRoleIds.push(...user.additional_role_ids);
    }
    
    if (allRoleIds.length === 0) return false;
    
    // Fetch roles with page permissions
    const { data: roles, error } = await supabase
      .from('roles')
      .select('page_permissions')
      .in('id', allRoleIds);
    
    if (error) {
      console.error('Error fetching role permissions:', error);
      return false;
    }
    
    // Check if any role has the page explicitly enabled
    for (const role of roles || []) {
      const pagePerms = role.page_permissions as Record<string, Record<string, PagePermissions>> | undefined;
      const pagePermission = pagePerms?.[dashboardId]?.[pageId];
      
      if (pagePermission) {
        // If page has explicit permissions, check if any permission is true
        const isPageEnabled = pagePermission.read === true || 
                             pagePermission.write === true || 
                             pagePermission.view === true || 
                             pagePermission.delete === true;
        
        if (isPageEnabled) {
          // Page is explicitly enabled - grant all CRUD operations
          return true;
        }
        
        // If all permissions are explicitly false, deny access
        if (pagePermission.read === false && 
            pagePermission.write === false && 
            pagePermission.view === false && 
            pagePermission.delete === false) {
          return false;
        }
      }
    }
    
    // Fallback: if dashboard has access and no explicit page permissions, default to view/read
    if (operation === 'read' || operation === 'view') {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking page CRUD permission:', error);
    return false;
  }
}

/**
 * Synchronous version that uses cached role data if available
 * Falls back to async version if needed
 */
export function hasDashboardCrudPermissionSync(
  user: User,
  dashboardId: string,
  operation: 'read' | 'write' | 'view' | 'delete',
  rolePermissions?: {
    dashboard_permissions: Record<string, DashboardPermissions>;
  }
): boolean {
  if (!user || !dashboardId || !operation) return false;
  
  // Admin users have all permissions
  if (isUserAdmin(user)) return true;
  
  // Check role-level dashboard permissions
  if (rolePermissions?.dashboard_permissions && rolePermissions.dashboard_permissions[dashboardId]) {
    const dashPerms = rolePermissions.dashboard_permissions[dashboardId];
    // Map operation to permission
    if (operation === 'read' && dashPerms.read) return true;
    if (operation === 'view' && dashPerms.view) return true;
    if (operation === 'write' && dashPerms.write) return true;
    if (operation === 'delete' && dashPerms.delete) return true;
  }
  
  // Fallback: Check if user has aggregated permissions with role data
  const userRoles = getAllUserRoleNames(user);
  const hasRoleAccess = userRoles.some(roleName => {
    const roleBasedDashboards = ROLE_DASHBOARD_MAPPING[roleName as keyof typeof ROLE_DASHBOARD_MAPPING] || [];
    return roleBasedDashboards.includes(dashboardId as any);
  });
  
  // If role has dashboard access, default to view/read for now
  if (hasRoleAccess && (operation === 'read' || operation === 'view')) {
    return true;
  }
  
  return false;
}

/**
 * Synchronous version for page permissions
 * If a page is explicitly enabled (any permission is true), grant all CRUD operations
 */
export function hasPageCrudPermissionSync(
  user: User,
  dashboardId: string,
  pageId: string,
  operation: 'read' | 'write' | 'view' | 'delete',
  rolePermissions?: {
    dashboard_permissions: Record<string, DashboardPermissions>;
    page_permissions: Record<string, Record<string, PagePermissions>>;
  }
): boolean {
  if (!user || !dashboardId || !pageId || !operation) return false;
  
  // Admin users have all permissions
  if (isUserAdmin(user)) return true;
  
  // Check dashboard access first
  if (!hasDashboardCrudPermissionSync(user, dashboardId, 'view', rolePermissions)) {
    return false;
  }
  
  // Check user-level page permissions first (explicit override)
  const explicitUserPageAccess = user.extra_permissions?.pages?.[dashboardId]?.[pageId];
  if (explicitUserPageAccess === true) {
    // If page is explicitly enabled for user, grant all CRUD operations
    return true;
  }
  if (explicitUserPageAccess === false) {
    // Explicitly denied
    return false;
  }
  
  // Check role-level page permissions
  if (rolePermissions?.page_permissions && 
      rolePermissions.page_permissions[dashboardId] && 
      rolePermissions.page_permissions[dashboardId][pageId]) {
    const pagePerms = rolePermissions.page_permissions[dashboardId][pageId];
    
    // If page has explicit permissions, check if any permission is true
    const isPageEnabled = pagePerms.read === true || 
                         pagePerms.write === true || 
                         pagePerms.view === true || 
                         pagePerms.delete === true;
    
    if (isPageEnabled) {
      // Page is explicitly enabled - grant all CRUD operations
      return true;
    }
    
    // If all permissions are explicitly false, deny access
    if (pagePerms.read === false && 
        pagePerms.write === false && 
        pagePerms.view === false && 
        pagePerms.delete === false) {
      return false;
    }
  }
  
  // Fallback: if dashboard has access and no explicit page permissions, default to view/read
  if (operation === 'read' || operation === 'view') {
    return true;
  }
  
  return false;
}
