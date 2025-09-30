import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_DASHBOARD_MAPPING, DASHBOARD_CONFIG, ROLES } from '@/constants';
import { DASHBOARDS } from '@/constants';
import { hasUserDashboardAccess, hasUserPageAccess, getUserAccessiblePages } from '@/utils/featureAccess';

export function usePermissions() {
  const { user } = useAuth();

  const permissions = useMemo(() => {
    if (!user) return { dashboards: [], pages: [] };

    // 1. Get role-based dashboards
    let roleName = '';
    if (user.role?.name) {
      roleName = user.role.name;
    } else if (user.role_id) {
      roleName = user.role_id;
    } else {
      roleName = ROLES.EMPLOYEE;
    }
    
    if (user.isSA || roleName === ROLES.SUPER_ADMIN || roleName === ROLES.ADMIN || 
        roleName === 'super_admin' || roleName === 'admin') {
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
    
    // Get role-based dashboards (primary source of truth)
    const roleDashboards = ROLE_DASHBOARD_MAPPING[roleName as keyof typeof ROLE_DASHBOARD_MAPPING] || [];
    
    // For regular employees, use role-based dashboards + extra permissions
    if (roleName === ROLES.EMPLOYEE || roleName === 'employee') {
      const roleDashboards = ROLE_DASHBOARD_MAPPING[roleName as keyof typeof ROLE_DASHBOARD_MAPPING] || [];
      const baseDashboards = roleDashboards.length > 0 ? roleDashboards : [DASHBOARDS.SELF];
      
      // Add explicit dashboard permissions for employees
      const explicitDashboards = Object.keys(user.extra_permissions?.dashboards || {})
        .filter(dashboardId => user.extra_permissions?.dashboards?.[dashboardId] === true);
      
      // Combine role-based and explicit permissions, removing duplicates
      const finalDashboards = [...new Set([...baseDashboards, ...explicitDashboards])];
      
      const allPages = finalDashboards.flatMap(dashboardId => {
        const dashboard = DASHBOARD_CONFIG.find(d => d.id === dashboardId);
        return dashboard?.pages.map(page => ({
          ...page,
          dashboard: dashboardId,
          fullPath: page.path
        })) || [];
      });

      return {
        dashboards: finalDashboards,
        pages: allPages
      };
    }
    
    // For non-employee roles, allow additional permissions
    // 2. Department-based dashboards (only for non-employees)
    const departmentDashboards = Object.keys(user.extra_permissions?.department_dashboards || {})
      .filter(dashboard => user.extra_permissions.department_dashboards[dashboard] === true);
    
    // 3. Explicit user dashboard permissions (only for non-employees)
    const explicitDashboards = Object.keys(user.extra_permissions?.dashboards || {})
      .filter(dashboard => user.extra_permissions.dashboards[dashboard] === true);
    
    // Combine all three sources (role + department + explicit) for non-employees
    const allDashboards = [...new Set([
      ...roleDashboards,
      ...departmentDashboards, 
      ...explicitDashboards
    ])];
    
    // If no dashboards found, default to self dashboard
    const finalDashboards = allDashboards.length > 0 ? allDashboards : [DASHBOARDS.SELF];

    const allPages = finalDashboards.flatMap(dashboardId => {
      const dashboard = DASHBOARD_CONFIG.find(d => d.id === dashboardId);
      return dashboard?.pages.map(page => ({
        ...page,
        dashboard: dashboardId,
        fullPath: page.path
      })) || [];
    });

    return {
      dashboards: finalDashboards,
      pages: allPages
    };
  }, [user]);

  const hasAccess = (dashboardId: string, pageId?: string) => {
    if (!user) return false;

    // Use the new feature access utilities
    if (pageId) {
      return hasUserPageAccess(user, dashboardId, pageId);
    } else {
      return hasUserDashboardAccess(user, dashboardId);
    }
  };

  const getAccessibleDashboards = () => {
    if (!user) return [];
    
    // Use the new feature access utility to get accessible dashboards
    const accessibleDashboards = DASHBOARD_CONFIG.filter(dashboard => 
      hasUserDashboardAccess(user, dashboard.id)
    ).map(dashboard => {
      // Filter pages based on user permissions
      const accessiblePageIds = getUserAccessiblePages(user, dashboard.id);
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

    // Use the new feature access utility
    return dashboard.pages.filter(page => 
      hasUserPageAccess(user, dashboardId, page.id)
    );
  };

  const hasCRUDAccess = (dashboardId: string, operation: 'create' | 'read' | 'update' | 'delete') => {
    if (!user) return false;

    // Get user role
    let roleName = '';
    if (user.role?.name) {
      roleName = user.role.name;
    } else if (user.role_id) {
      roleName = user.role_id;
    } else {
      roleName = ROLES.EMPLOYEE;
    }
    
    // Super admin and admin have full CRUD access
    if (roleName === 'super_admin' || roleName === 'admin') {
      return true;
    }

    // For employees, restrict CRUD access to only their own data in self dashboard
    if (roleName === ROLES.EMPLOYEE || roleName === 'employee') {
      if (dashboardId === 'self') {
        // Employees can read and update their own data, create some records (like leave applications)
        return ['read', 'create', 'update'].includes(operation);
      }
      return false;
    }

    // Check explicit CRUD permissions
    const explicitCRUD = user.extra_permissions?.crud?.[dashboardId]?.[operation];
    if (explicitCRUD !== undefined) {
      return explicitCRUD;
    }

    // Check department CRUD permissions
    const departmentCRUD = user.extra_permissions?.department_crud?.[dashboardId]?.[operation];
    if (departmentCRUD !== undefined) {
      return departmentCRUD;
    }

    // Default CRUD permissions based on role and dashboard access
    if (permissions.dashboards.includes(dashboardId)) {
      // HR roles typically have full CRUD access to their dashboards
      if (['hr', 'super_admin', 'admin'].includes(roleName)) {
        return true;
      }
      
      // Managers have CRUD access to performance and employee management
      if (['sdm', 'bdm', 'qam'].includes(roleName) && 
          ['performance', 'employee_management'].includes(dashboardId)) {
        return true;
      }
      
      // Non-employee roles have read access and limited create/update
      if (operation === 'read') return true;
    }

    return false;
  };

  return {
    hasAccess,
    hasCRUDAccess,
    getAccessibleDashboards,
    getAccessiblePages,
    permissions
  };
}