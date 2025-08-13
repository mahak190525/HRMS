import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_DASHBOARD_MAPPING, DASHBOARD_CONFIG } from '@/constants';

export function usePermissions() {
  const { user } = useAuth();

  const permissions = useMemo(() => {
    if (!user) return { dashboards: [], pages: [] };

    // Get default dashboards based on role
    const defaultDashboards = ROLE_DASHBOARD_MAPPING[user.role_id as keyof typeof ROLE_DASHBOARD_MAPPING] || [];
    
    // Add extra dashboard permissions
    const extraDashboards = Object.keys(user.extra_permissions?.dashboards || {})
      .filter(dashboard => user.extra_permissions.dashboards[dashboard]);

    // Combine and deduplicate
    const allDashboards = [...new Set([...defaultDashboards, ...extraDashboards])];

    // Get all accessible pages
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
  }, [user]);

  const hasAccess = (dashboardId: string, pageId?: string) => {
    if (!user) return false;

    // Super admin and admin have access to everything
    if (user.role_id === 'super_admin' || user.role_id === 'admin') {
      return true;
    }

    // Check dashboard access
    if (!permissions.dashboards.includes(dashboardId)) {
      return false;
    }

    // If checking specific page access
    if (pageId) {
      const hasPageAccess = permissions.pages.some(
        page => page.dashboard === dashboardId && page.id === pageId
      );
      
      // Check for feature-level restrictions
      const featureRestrictions = user.extra_permissions?.features?.[dashboardId]?.[pageId];
      if (featureRestrictions === false) {
        return false;
      }

      return hasPageAccess;
    }

    return true;
  };

  const getAccessibleDashboards = () => {
    return DASHBOARD_CONFIG.filter(dashboard => 
      permissions.dashboards.includes(dashboard.id)
    );
  };

  const getAccessiblePages = (dashboardId: string) => {
    const dashboard = DASHBOARD_CONFIG.find(d => d.id === dashboardId);
    if (!dashboard) return [];

    return dashboard.pages.filter(page => 
      hasAccess(dashboardId, page.id)
    );
  };

  return {
    hasAccess,
    getAccessibleDashboards,
    getAccessiblePages,
    permissions
  };
}