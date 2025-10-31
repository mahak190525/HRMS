import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import type { User } from '@/types';

export interface PolicyDashboardPermissions {
  can_view_policies: boolean;
  can_create_policies: boolean;
  can_edit_policies: boolean;
  can_delete_policies: boolean;
  can_manage_permissions: boolean;
  can_view_analytics: boolean;
  permission_source: 'individual' | 'role' | 'default';
}

export interface PolicyDashboardPermissionRow {
  id: string;
  user_id?: string;
  role?: string;
  can_view_policies: boolean;
  can_create_policies: boolean;
  can_edit_policies: boolean;
  can_delete_policies: boolean;
  can_manage_permissions: boolean;
  can_view_analytics: boolean;
  is_active: boolean;
  granted_by?: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
    role?: { name: string };
  };
}

// Hook to get current user's policy dashboard permissions
export function usePolicyDashboardPermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<PolicyDashboardPermissions>({
    can_view_policies: true,
    can_create_policies: false,
    can_edit_policies: false,
    can_delete_policies: false,
    can_manage_permissions: false,
    can_view_analytics: false,
    permission_source: 'default'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const roleName = user.role?.name || user.role_id || 'employee';
      
      const { data, error } = await supabase.rpc('get_user_policy_dashboard_permissions', {
        p_user_id: user.id,
        p_role: roleName
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setPermissions(data[0]);
      } else {
        // Fallback to default permissions
        setPermissions({
          can_view_policies: true,
          can_create_policies: false,
          can_edit_policies: false,
          can_delete_policies: false,
          can_manage_permissions: false,
          can_view_analytics: false,
          permission_source: 'default'
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch policy dashboard permissions';
      setError(errorMessage);
      console.error('Error fetching policy dashboard permissions:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Memoized permission checks for better performance
  const permissionChecks = useMemo(() => ({
    canViewPolicies: permissions.can_view_policies,
    canCreatePolicies: permissions.can_create_policies,
    canEditPolicies: permissions.can_edit_policies,
    canDeletePolicies: permissions.can_delete_policies,
    canManagePermissions: permissions.can_manage_permissions,
    canViewAnalytics: permissions.can_view_analytics,
    hasAnyWriteAccess: permissions.can_create_policies || permissions.can_edit_policies || permissions.can_delete_policies,
    isReadOnly: !permissions.can_create_policies && !permissions.can_edit_policies && !permissions.can_delete_policies,
    permissionSource: permissions.permission_source
  }), [permissions]);

  return {
    permissions,
    ...permissionChecks,
    loading,
    error,
    refetch: fetchPermissions
  };
}

// Hook to manage policy dashboard permissions for all users (admin use)
export function usePolicyDashboardPermissionsManager() {
  const [allPermissions, setAllPermissions] = useState<PolicyDashboardPermissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('policy_dashboard_permissions')
        .select(`
          *,
          user:users!policy_dashboard_permissions_user_id_fkey(
            id,
            full_name,
            email,
            role:roles(name)
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAllPermissions(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch all policy dashboard permissions';
      setError(errorMessage);
      console.error('Error fetching all policy dashboard permissions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllPermissions();
  }, [fetchAllPermissions]);

  const setUserPermissions = useCallback(async (
    userId: string,
    permissions: Omit<PolicyDashboardPermissions, 'permission_source'>,
    grantedBy?: string
  ) => {
    try {
      const { error } = await supabase.rpc('set_user_policy_dashboard_permissions', {
        p_user_id: userId,
        p_can_view_policies: permissions.can_view_policies,
        p_can_create_policies: permissions.can_create_policies,
        p_can_edit_policies: permissions.can_edit_policies,
        p_can_delete_policies: permissions.can_delete_policies,
        p_can_manage_permissions: permissions.can_manage_permissions,
        p_can_view_analytics: permissions.can_view_analytics,
        p_granted_by: grantedBy
      });

      if (error) throw error;

      await fetchAllPermissions(); // Refresh the list
      toast.success('User policy dashboard permissions updated successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update user permissions';
      toast.error(errorMessage);
      throw err;
    }
  }, [fetchAllPermissions]);

  const setRolePermissions = useCallback(async (
    role: string,
    permissions: Omit<PolicyDashboardPermissions, 'permission_source'>,
    grantedBy?: string,
    showToast: boolean = true
  ) => {
    try {
      const { error } = await supabase.rpc('set_role_policy_dashboard_permissions', {
        p_role: role,
        p_can_view_policies: permissions.can_view_policies,
        p_can_create_policies: permissions.can_create_policies,
        p_can_edit_policies: permissions.can_edit_policies,
        p_can_delete_policies: permissions.can_delete_policies,
        p_can_manage_permissions: permissions.can_manage_permissions,
        p_can_view_analytics: permissions.can_view_analytics,
        p_granted_by: grantedBy
      });

      if (error) throw error;

      await fetchAllPermissions(); // Refresh the list
      if (showToast) {
        toast.success('Role policy dashboard permissions updated successfully');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update role permissions';
      if (showToast) {
        toast.error(errorMessage);
      }
      throw err;
    }
  }, [fetchAllPermissions]);

  const removeUserPermissions = useCallback(async (userId: string) => {
    try {
      const { error } = await supabase
        .from('policy_dashboard_permissions')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      await fetchAllPermissions(); // Refresh the list
      toast.success('User policy dashboard permissions removed successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove user permissions';
      toast.error(errorMessage);
      throw err;
    }
  }, [fetchAllPermissions]);

  const getUserPermissions = useCallback(async (userId: string, role: string): Promise<PolicyDashboardPermissions | null> => {
    try {
      const { data, error } = await supabase.rpc('get_user_policy_dashboard_permissions', {
        p_user_id: userId,
        p_role: role
      });

      if (error) throw error;

      return data && data.length > 0 ? data[0] : null;
    } catch (err) {
      console.error('Error fetching user policy dashboard permissions:', err);
      return null;
    }
  }, []);

  return {
    allPermissions,
    loading,
    error,
    refetch: fetchAllPermissions,
    setUserPermissions,
    setRolePermissions,
    removeUserPermissions,
    getUserPermissions
  };
}

// Hook to get policy dashboard permissions for a specific user (for admin interface)
export function useUserPolicyDashboardPermissions(targetUser: User | null) {
  const [permissions, setPermissions] = useState<PolicyDashboardPermissions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserPermissions = useCallback(async () => {
    if (!targetUser) {
      setPermissions(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const roleName = targetUser.role?.name || targetUser.role_id || 'employee';
      
      const { data, error } = await supabase.rpc('get_user_policy_dashboard_permissions', {
        p_user_id: targetUser.id,
        p_role: roleName
      });

      if (error) throw error;

      setPermissions(data && data.length > 0 ? data[0] : null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user policy dashboard permissions';
      setError(errorMessage);
      console.error('Error fetching user policy dashboard permissions:', err);
    } finally {
      setLoading(false);
    }
  }, [targetUser]);

  useEffect(() => {
    fetchUserPermissions();
  }, [fetchUserPermissions]);

  return {
    permissions,
    loading,
    error,
    refetch: fetchUserPermissions
  };
}

export default usePolicyDashboardPermissions;
