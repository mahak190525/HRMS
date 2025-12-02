import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import type { DashboardPermissions, PagePermissions } from '@/types';

interface RolePermissions {
  dashboard_permissions: Record<string, DashboardPermissions>;
  page_permissions: Record<string, Record<string, PagePermissions>>;
}

/**
 * Hook to fetch and cache role-level permissions for the current user
 */
export function useRolePermissions() {
  const { user } = useAuth();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['user-role-permissions', user?.id],
    queryFn: async (): Promise<RolePermissions> => {
      if (!user) {
        return { dashboard_permissions: {}, page_permissions: {} };
      }

      // Get all role IDs for the user
      const allRoleIds: string[] = [];
      if (user.role_id) allRoleIds.push(user.role_id);
      if (user.additional_role_ids && user.additional_role_ids.length > 0) {
        allRoleIds.push(...user.additional_role_ids);
      }

      if (allRoleIds.length === 0) {
        return { dashboard_permissions: {}, page_permissions: {} };
      }

      // Fetch roles with permissions
      const { data: roles, error } = await supabase
        .from('roles')
        .select('dashboard_permissions, page_permissions')
        .in('id', allRoleIds);

      if (error) {
        console.error('Error fetching role permissions:', error);
        return { dashboard_permissions: {}, page_permissions: {} };
      }

      // Aggregate permissions from all roles (OR logic - if any role has permission, user has it)
      const aggregatedDashboardPerms: Record<string, DashboardPermissions> = {};
      const aggregatedPagePerms: Record<string, Record<string, PagePermissions>> = {};

      roles?.forEach(role => {
        const dashPerms = role.dashboard_permissions as Record<string, DashboardPermissions> | undefined;
        const pagePerms = role.page_permissions as Record<string, Record<string, PagePermissions>> | undefined;

        // Aggregate dashboard permissions
        if (dashPerms) {
          // Helper to normalize boolean values (handle string "true"/"false" from JSON)
          const normalizeBool = (val: any): boolean => {
            if (typeof val === 'boolean') return val;
            if (val === 'true' || val === true || val === 1) return true;
            return false;
          };
          
          Object.keys(dashPerms).forEach(dashboardId => {
            if (!aggregatedDashboardPerms[dashboardId]) {
              aggregatedDashboardPerms[dashboardId] = {
                read: false,
                write: false,
                view: false,
                delete: false
              };
            }
            const rolePerms = dashPerms[dashboardId];
            // Use OR logic: if any role has permission, user has it
            aggregatedDashboardPerms[dashboardId] = {
              read: aggregatedDashboardPerms[dashboardId].read || normalizeBool(rolePerms?.read),
              write: aggregatedDashboardPerms[dashboardId].write || normalizeBool(rolePerms?.write),
              view: aggregatedDashboardPerms[dashboardId].view || normalizeBool(rolePerms?.view),
              delete: aggregatedDashboardPerms[dashboardId].delete || normalizeBool(rolePerms?.delete)
            };
          });
        }

        // Aggregate page permissions
        if (pagePerms) {
          // Helper to normalize boolean values (handle string "true"/"false" from JSON)
          const normalizeBool = (val: any): boolean => {
            if (typeof val === 'boolean') return val;
            if (val === 'true' || val === true || val === 1) return true;
            return false;
          };
          
          Object.keys(pagePerms).forEach(dashboardId => {
            if (!aggregatedPagePerms[dashboardId]) {
              aggregatedPagePerms[dashboardId] = {};
            }
            const dashboardPages = pagePerms[dashboardId];
            Object.keys(dashboardPages).forEach(pageId => {
              if (!aggregatedPagePerms[dashboardId][pageId]) {
                aggregatedPagePerms[dashboardId][pageId] = {
                  read: false,
                  write: false,
                  view: false,
                  delete: false
                };
              }
              const rolePagePerms = dashboardPages[pageId];
              // Use OR logic: if any role has permission, user has it
              aggregatedPagePerms[dashboardId][pageId] = {
                read: aggregatedPagePerms[dashboardId][pageId].read || normalizeBool(rolePagePerms?.read),
                write: aggregatedPagePerms[dashboardId][pageId].write || normalizeBool(rolePagePerms?.write),
                view: aggregatedPagePerms[dashboardId][pageId].view || normalizeBool(rolePagePerms?.view),
                delete: aggregatedPagePerms[dashboardId][pageId].delete || normalizeBool(rolePagePerms?.delete)
              };
            });
          });
        }
      });

      return {
        dashboard_permissions: aggregatedDashboardPerms,
        page_permissions: aggregatedPagePerms
      };
    },
    enabled: !!user,
    staleTime: 1 * 60 * 1000, // Cache for 1 minute (reduced for faster updates)
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true // Always refetch on mount to get latest permissions
  });

  return {
    permissions: permissions || { dashboard_permissions: {}, page_permissions: {} },
    isLoading
  };
}

