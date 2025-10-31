import { supabase } from './supabase';
import type { 
  Policy, 
  PolicyVersion, 
  PolicyPermission, 
  PolicyAccessLog,
  PolicyFormData,
  PolicyPermissionFormData,
  PolicySearchFilters,
  PolicyDashboardStats
} from '../types';

export class PolicyApiService {
  // Policy CRUD Operations
  static async getPolicies(filters?: PolicySearchFilters): Promise<Policy[]> {
    try {
      let query = supabase
        .from('policies')
        .select(`
          *,
          permissions:policy_permissions(*)
        `)
        .eq('is_active', true);
      
      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }
      
      if (filters?.search_term) {
        query = query.ilike('name', `%${filters.search_term}%`);
      }
      
      if (filters?.created_by) {
        query = query.eq('created_by', filters.created_by);
      }
      
      if (filters?.date_range) {
        query = query
          .gte('created_at', filters.date_range.start)
          .lte('created_at', filters.date_range.end);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;

      // Log access for each policy (you can implement user tracking as needed)
      // if (data) {
      //   for (const policy of data) {
      //     await this.logPolicyAccess(policy.id, 'read', currentUserId);
      //   }
      // }

      return data || [];
    } catch (error) {
      console.error('Error fetching policies:', error);
      throw error;
    }
  }

  static async getPolicyById(id: string): Promise<Policy | null> {
    try {
      const { data, error } = await supabase
        .from('policies')
        .select(`
          *,
          permissions:policy_permissions(
            *,
            user:users!policy_permissions_user_id_fkey(id, full_name, role_id)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Log access (you can implement user tracking as needed)
      // if (data) {
      //   await this.logPolicyAccess(id, 'read', currentUserId);
      // }

      return data;
    } catch (error) {
      console.error('Error fetching policy:', error);
      throw error;
    }
  }

  static async createPolicy(policyData: PolicyFormData): Promise<Policy> {
    try {
      // Since we're not using auth schema, we'll need to pass user ID from the application
      // For now, we'll create policies without user tracking
      const { data, error } = await supabase
        .from('policies')
        .insert({
          ...policyData,
          // created_by and updated_by can be set from application context later
          created_by: null,
          updated_by: null
        })
        .select()
        .single();

      if (error) throw error;

      // Log creation can be implemented later with proper user context
      // await this.logPolicyAccess(data.id, 'create', userId);

      return data;
    } catch (error) {
      console.error('Error creating policy:', error);
      throw error;
    }
  }

  static async updatePolicy(id: string, policyData: Partial<PolicyFormData>): Promise<Policy> {
    try {
      // Since we're not using auth schema, we'll update without user tracking for now
      const { data, error } = await supabase
        .from('policies')
        .update({
          ...policyData,
          updated_by: null
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log update can be implemented later with proper user context
      // await this.logPolicyAccess(id, 'write', userId);

      return data;
    } catch (error) {
      console.error('Error updating policy:', error);
      throw error;
    }
  }

  static async deletePolicy(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('policies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Log deletion (you can implement user tracking as needed)
      // await this.logPolicyAccess(id, 'delete', currentUserId);
    } catch (error) {
      console.error('Error deleting policy:', error);
      throw error;
    }
  }

  // Policy Versions
  static async getPolicyVersions(policyId: string): Promise<PolicyVersion[]> {
    try {
      const { data, error } = await supabase
        .from('policy_versions')
        .select('*')
        .eq('policy_id', policyId)
        .order('version', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching policy versions:', error);
      throw error;
    }
  }

  static async getPolicyVersion(policyId: string, version: number): Promise<PolicyVersion | null> {
    try {
      const { data, error } = await supabase
        .from('policy_versions')
        .select('*')
        .eq('policy_id', policyId)
        .eq('version', version)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching policy version:', error);
      throw error;
    }
  }

  // Categories removed - using simple policies without categorization

  // Policy Permissions
  static async getPolicyPermissions(policyId: string): Promise<PolicyPermission[]> {
    try {
      const { data, error } = await supabase
        .from('policy_permissions')
        .select(`
          *,
          user:users!policy_permissions_user_id_fkey(id, full_name, role_id, email)
        `)
        .eq('policy_id', policyId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching policy permissions:', error);
      throw error;
    }
  }

  static async createPolicyPermission(permissionData: PolicyPermissionFormData): Promise<PolicyPermission> {
    try {
      // Since we're not using auth schema, we'll create permissions without user tracking for now
      const { data, error } = await supabase
        .from('policy_permissions')
        .insert({
          ...permissionData,
          granted_by: null
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating policy permission:', error);
      throw error;
    }
  }

  static async updatePolicyPermission(id: string, permissionData: Partial<PolicyPermissionFormData>): Promise<PolicyPermission> {
    try {
      const { data, error } = await supabase
        .from('policy_permissions')
        .update(permissionData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating policy permission:', error);
      throw error;
    }
  }

  static async deletePolicyPermission(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('policy_permissions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting policy permission:', error);
      throw error;
    }
  }

  // Bulk permission operations
  static async setRolePermissions(policyId: string, role: string, permissions: { can_read: boolean; can_write: boolean; can_delete: boolean }): Promise<void> {
    try {
      // First, delete existing role permission
      await supabase
        .from('policy_permissions')
        .delete()
        .eq('policy_id', policyId)
        .eq('role', role);

      // Then create new permission
      await this.createPolicyPermission({
        policy_id: policyId,
        role,
        ...permissions
      });
    } catch (error) {
      console.error('Error setting role permissions:', error);
      throw error;
    }
  }

  static async setUserPermissions(policyId: string, userId: string, permissions: { can_read: boolean; can_write: boolean; can_delete: boolean }): Promise<void> {
    try {
      // First, delete existing user permission
      await supabase
        .from('policy_permissions')
        .delete()
        .eq('policy_id', policyId)
        .eq('user_id', userId);

      // Then create new permission
      await this.createPolicyPermission({
        policy_id: policyId,
        user_id: userId,
        ...permissions
      });
    } catch (error) {
      console.error('Error setting user permissions:', error);
      throw error;
    }
  }

  // Policy Access Logs
  static async getPolicyAccessLogs(policyId?: string, userId?: string): Promise<PolicyAccessLog[]> {
    try {
      let query = supabase
        .from('policy_access_logs')
        .select(`
          *,
          policy:policies(id, name),
          user:users!policy_access_logs_user_id_fkey(id, full_name, role_id)
        `)
        .order('created_at', { ascending: false });

      if (policyId) {
        query = query.eq('policy_id', policyId);
      }

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching policy access logs:', error);
      throw error;
    }
  }

  static async logPolicyAccess(policyId: string, action: 'read' | 'write' | 'delete' | 'create', userId?: string): Promise<void> {
    try {
      // Skip logging if no user ID provided (since we're not using auth schema)
      if (!userId) {
        return;
      }

      // Get client IP and user agent (in a real app, you'd get these from the request)
      const userAgent = navigator.userAgent;
      
      const { error } = await supabase.rpc('log_policy_access', {
        p_policy_id: policyId,
        p_user_id: userId,
        p_action: action,
        p_user_agent: userAgent
      });

      if (error) {
        console.warn('Failed to log policy access:', error);
        // Don't throw error for logging failures
      }
    } catch (error) {
      console.warn('Failed to log policy access:', error);
      // Don't throw error for logging failures
    }
  }

  // Dashboard Statistics
  static async getDashboardStats(): Promise<PolicyDashboardStats> {
    try {
      const [
        totalPoliciesResult,
        activePoliciesResult,
        recentUpdatesResult,
        userAccessibleResult
      ] = await Promise.all([
        supabase.from('policies').select('id', { count: 'exact' }),
        supabase.from('policies').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('policies').select('id', { count: 'exact' }).gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        this.getPolicies() // This will return only accessible policies due to RLS
      ]);

      return {
        total_policies: totalPoliciesResult.count || 0,
        active_policies: activePoliciesResult.count || 0,
        recent_updates: recentUpdatesResult.count || 0,
        user_accessible_policies: userAccessibleResult.length
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  // Search and Filter Utilities
  static async searchPolicies(searchTerm: string): Promise<Policy[]> {
    return this.getPolicies({ search_term: searchTerm });
  }

  // Category functionality removed

  static async getUserAccessiblePolicies(): Promise<Policy[]> {
    // RLS will automatically filter based on user permissions
    return this.getPolicies();
  }

  // Policy Content Utilities
  static async duplicatePolicy(id: string, newName: string): Promise<Policy> {
    try {
      const originalPolicy = await this.getPolicyById(id);
      if (!originalPolicy) {
        throw new Error('Policy not found');
      }

      return this.createPolicy({
        name: newName,
        content: originalPolicy.content,
        is_active: true // Start as active by default
      });
    } catch (error) {
      console.error('Error duplicating policy:', error);
      throw error;
    }
  }

  static async togglePolicyStatus(id: string): Promise<Policy> {
    try {
      const policy = await this.getPolicyById(id);
      if (!policy) {
        throw new Error('Policy not found');
      }

      return this.updatePolicy(id, { is_active: !policy.is_active });
    } catch (error) {
      console.error('Error toggling policy status:', error);
      throw error;
    }
  }
}

export default PolicyApiService;
