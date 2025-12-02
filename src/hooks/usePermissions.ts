import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_DASHBOARD_MAPPING, DASHBOARD_CONFIG, ROLES } from '@/constants';
import { DASHBOARDS } from '@/constants';
import { hasUserDashboardAccess, hasUserPageAccess, getUserAccessiblePages } from '@/utils/featureAccess';
import { getAllUserRoleNames, isUserAdmin } from '@/utils/multipleRoles';
import { useRolePermissions } from './useRolePermissions';

export function usePermissions() {
  const { user } = useAuth();
  const { permissions: rolePermissions, isLoading: rolePermissionsLoading } = useRolePermissions();

  const permissions = useMemo(() => {
    if (!user) return { dashboards: [], pages: [] };

    // Check if user is admin (has admin privileges through any role or isSA flag)
    if (isUserAdmin(user)) {
      const allDashboards = Object.values(DASHBOARDS);
      const allPages = allDashboards.flatMap(dashboardId => {
        const dashboard = DASHBOARD_CONFIG.find(d => d.id === dashboardId);
        return dashboard?.pages.map(page => ({
          ...page,
          dashboard: dashboardId,
          fullPath: page.path
        })) || [];
      });
      
      return {
        dashboards: allDashboards,
        pages: allPages
      };
    }
    
    // Get accessible dashboards from role-level permissions AND individual permissions
    const accessibleDashboardIds: string[] = [];
    const explicitUserDashboards = user.extra_permissions?.dashboards || {};
    
    DASHBOARD_CONFIG.forEach(dashboard => {
      // Check individual user permissions first (explicit override)
      if (explicitUserDashboards[dashboard.id] === true) {
        accessibleDashboardIds.push(dashboard.id);
        return;
      }
      if (explicitUserDashboards[dashboard.id] === false) {
        // Explicitly denied, skip
        return;
      }
      
      // Check role-level permissions
      if (rolePermissions?.dashboard_permissions[dashboard.id]) {
        const perms = rolePermissions.dashboard_permissions[dashboard.id];
        if (perms.view || perms.read) {
          accessibleDashboardIds.push(dashboard.id);
          return;
        }
      }
      
      // Fallback: Get role-based dashboards from ROLE_DASHBOARD_MAPPING (legacy)
      const userRoles = getAllUserRoleNames(user);
      const roleDashboards = userRoles.flatMap(roleName => 
        ROLE_DASHBOARD_MAPPING[roleName as keyof typeof ROLE_DASHBOARD_MAPPING] || []
      );
      
      if (roleDashboards.includes(dashboard.id as any)) {
        accessibleDashboardIds.push(dashboard.id);
      }
    });
    
    // If no dashboards found, default to self dashboard
    const finalDashboardIds = accessibleDashboardIds.length > 0 ? accessibleDashboardIds : [DASHBOARDS.SELF];
    const explicitUserPages = user.extra_permissions?.pages || {};

    const allPages = finalDashboardIds.flatMap(dashboardId => {
      const dashboard = DASHBOARD_CONFIG.find(d => d.id === dashboardId);
      if (!dashboard) return [];
      
      // Filter pages based on role-level permissions AND individual permissions
      // Explicit page permissions take precedence over dashboard inheritance
      const accessiblePages = dashboard.pages.filter(page => {
        // Check individual user page permissions first (explicit override)
        const explicitUserPageAccess = explicitUserPages[dashboardId]?.[page.id];
        if (explicitUserPageAccess === true) {
          return true;
        }
        if (explicitUserPageAccess === false) {
          return false; // Explicitly denied, don't inherit from dashboard
        }
        
        // Check role-level page permissions
        const rolePagePerms = rolePermissions?.page_permissions[dashboardId]?.[page.id];
        if (rolePagePerms) {
          // Role has explicit page permissions
          const hasPermission = rolePagePerms.view === true || rolePagePerms.read === true;
          if (hasPermission) {
            return true;
          }
          // If role explicitly denies (all false), don't inherit from dashboard
          if (rolePagePerms.view === false && rolePagePerms.read === false) {
            return false;
          }
        }
        
        // If no explicit page permissions (neither user nor role), inherit from dashboard
        // Dashboard is already checked to be accessible at this point
        return true;
      });
      
      return accessiblePages.map(page => ({
        ...page,
        dashboard: dashboardId,
        fullPath: page.path
      }));
    });

    return {
      dashboards: finalDashboardIds,
      pages: allPages
    };
  }, [user, rolePermissions]);

  const hasAccess = (dashboardId: string, pageId?: string) => {
    if (!user) return false;

    // Use the new feature access utilities with role permissions
    if (pageId) {
      return hasUserPageAccess(user, dashboardId, pageId, rolePermissions);
    } else {
      return hasUserDashboardAccess(user, dashboardId, rolePermissions);
    }
  };

  const getAccessibleDashboards = () => {
    if (!user) return [];
    
    // Use the new feature access utility to get accessible dashboards with role permissions
    const accessibleDashboards = DASHBOARD_CONFIG.filter(dashboard => 
      hasUserDashboardAccess(user, dashboard.id, rolePermissions)
    ).map(dashboard => {
      // Filter pages based on user permissions
      const accessiblePageIds = getUserAccessiblePages(user, dashboard.id, rolePermissions);
      const accessiblePages = dashboard.pages.filter(page => 
        accessiblePageIds.includes(page.id)
      );
      
      return {
        ...dashboard,
        pages: accessiblePages
      };
    }).filter(dashboard => dashboard.pages.length > 0); // Only return dashboards with accessible pages
    
    return accessibleDashboards;
  };

  const getAccessiblePages = (dashboardId: string) => {
    if (!user) return [];
    
    const dashboard = DASHBOARD_CONFIG.find(d => d.id === dashboardId);
    if (!dashboard) return [];

    // Use the new feature access utility with role permissions
    return dashboard.pages.filter(page => 
      hasUserPageAccess(user, dashboardId, page.id, rolePermissions)
    );
  };

  const hasCRUDAccess = (dashboardId: string, pageId: string | undefined, operation: 'create' | 'read' | 'update' | 'delete') => {
    if (!user) return false;

    // Admin users have full CRUD access
    if (isUserAdmin(user)) {
      return true;
    }

    // Get all user roles
    const userRoles = getAllUserRoleNames(user);
    
    // For employees, restrict CRUD access to only their own data in self dashboard
    if (userRoles.includes('employee') && userRoles.length === 1) {
      if (dashboardId === 'self') {
        // Employees can read and update their own data, create some records (like leave applications)
        return ['read', 'create', 'update'].includes(operation);
      }
      return false;
    }

    // If pageId is provided, check page-level permissions first
    // If a page is explicitly enabled, grant all CRUD operations
    if (pageId) {
      // Check user-level page permissions (explicit override)
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
    }

    // CRUD permissions: Check individual user permissions first, then role-level permissions
    // Check individual user CRUD permissions (explicit override)
    const explicitCRUD = user.extra_permissions?.crud?.[dashboardId]?.[operation];
    if (explicitCRUD !== undefined) {
      return explicitCRUD === true;
    }
    
    // Check role-level dashboard permissions for CRUD operations
    if (rolePermissions?.dashboard_permissions[dashboardId]) {
      const dashPerms = rolePermissions.dashboard_permissions[dashboardId];
      // Map operation to permission
      if (operation === 'read' && dashPerms.read) return true;
      if (operation === 'update' && dashPerms.write) return true;
      if (operation === 'delete' && dashPerms.delete) return true;
      if (operation === 'create' && dashPerms.write) return true; // Create uses write permission
    }

    // Aggregate CRUD permissions from all roles
    let hasPermission = false;
    
    // Check each role for CRUD permissions
    for (const roleName of userRoles) {
      // Admin roles have full CRUD access
      if (['admin', 'super_admin'].includes(roleName)) {
        hasPermission = true;
        break;
      }
      
      // HR roles have full CRUD access to most dashboards
      if (['hr', 'hrm'].includes(roleName)) {
        if (permissions.dashboards.includes(dashboardId)) {
          hasPermission = true;
          break;
        }
      }
      
      // Manager roles have CRUD access to specific dashboards
      if (['sdm', 'bdm', 'qam', 'manager'].includes(roleName)) {
        if (['performance', 'employee_management', 'self'].includes(dashboardId)) {
          hasPermission = true;
          break;
        }
        // Managers have read access to other dashboards they can view
        if (operation === 'read' && permissions.dashboards.includes(dashboardId)) {
          hasPermission = true;
          break;
        }
      }
      
      // Finance roles have CRUD access to finance-related dashboards
      if (['finance', 'finance_manager'].includes(roleName)) {
        if (['finance', 'employee_management'].includes(dashboardId)) {
          hasPermission = true;
          break;
        }
        // Finance has read access to other dashboards they can view
        if (operation === 'read' && permissions.dashboards.includes(dashboardId)) {
          hasPermission = true;
          break;
        }
      }
      
      // BD roles have access to BD-related dashboards
      if (['bdm', 'bd_team'].includes(roleName)) {
        if (['bd_team', 'performance'].includes(dashboardId)) {
          hasPermission = true;
          break;
        }
      }
      
      // QA roles have access to QA-related dashboards
      if (['qam', 'qa'].includes(roleName)) {
        if (['performance', 'employee_management'].includes(dashboardId)) {
          hasPermission = true;
          break;
        }
      }
    }
    
    // If user has dashboard access but no specific CRUD permission found,
    // grant read access by default for non-employee roles
    if (!hasPermission && permissions.dashboards.includes(dashboardId)) {
      const hasNonEmployeeRole = userRoles.some(role => role !== 'employee');
      if (hasNonEmployeeRole && operation === 'read') {
        hasPermission = true;
      }
    }

    return hasPermission;
  };

  return {
    hasAccess,
    hasCRUDAccess,
    getAccessibleDashboards,
    getAccessiblePages,
    permissions,
    rolePermissionsLoading
  };
}