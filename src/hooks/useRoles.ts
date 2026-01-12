import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';

export interface Role {
  id: string;
  name: string;
  description?: string;
  default_dashboards?: string[];
  permissions?: Record<string, any>;
  dashboard_permissions?: Record<string, any>;
  page_permissions?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreateRoleData {
  name: string;
  description?: string;
  default_dashboards?: string[];
  permissions?: Record<string, any>;
}

export interface UpdateRoleData {
  name?: string;
  description?: string;
  default_dashboards?: string[];
  permissions?: Record<string, any>;
  dashboard_permissions?: Record<string, any>;
  page_permissions?: Record<string, any>;
}

// Fetch all roles (excluding super_admin)
export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .neq('name', 'super_admin')
        .order('name');
      
      if (error) throw error;
      return data as Role[];
    },
  });
}

// Fetch a single role by ID
export function useRole(roleId: string) {
  return useQuery({
    queryKey: ['role', roleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('id', roleId)
        .single();
      
      if (error) throw error;
      return data as Role;
    },
    enabled: !!roleId,
  });
}

// Create a new role
export function useCreateRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (roleData: CreateRoleData) => {
      // Check if role name already exists
      const { data: existingRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', roleData.name.toLowerCase())
        .single();
      
      if (existingRole) {
        throw new Error('A role with this name already exists');
      }
      
      const { data, error } = await supabase
        .from('roles')
        .insert({
          name: roleData.name.toLowerCase(),
          description: roleData.description,
          default_dashboards: roleData.default_dashboards || [],
          permissions: roleData.permissions || {},
          dashboard_permissions: {},
          page_permissions: {},
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Role;
    },
    onSuccess: (newRole) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success(`Role "${newRole.name}" created successfully!`);
    },
    onError: (error: any) => {
      console.error('Role creation error:', error);
      if (error.message.includes('already exists')) {
        toast.error('A role with this name already exists. Please choose a different name.');
      } else if (error?.code === '23505') {
        toast.error('A role with this name already exists. Please choose a different name.');
      } else if (error?.code === '42501' || error?.message?.includes('permission')) {
        toast.error('Permission denied. You need admin privileges to create roles.');
      } else {
        toast.error(`Failed to create role: ${error?.message || 'Unknown error'}`);
      }
    },
  });
}

// Update an existing role
export function useUpdateRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ roleId, updates }: { roleId: string; updates: UpdateRoleData }) => {
      // If updating name, check if it already exists
      if (updates.name) {
        const { data: existingRole } = await supabase
          .from('roles')
          .select('id')
          .eq('name', updates.name.toLowerCase())
          .neq('id', roleId)
          .single();
        
        if (existingRole) {
          throw new Error('A role with this name already exists');
        }
        
        // Convert name to lowercase
        updates.name = updates.name.toLowerCase();
      }
      
      const { data, error } = await supabase
        .from('roles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roleId)
        .select()
        .single();
      
      if (error) throw error;
      return data as Role;
    },
    onSuccess: (updatedRole) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['role', updatedRole.id] });
      queryClient.invalidateQueries({ queryKey: ['user-role-permissions'] });
      toast.success(`Role "${updatedRole.name}" updated successfully!`);
    },
    onError: (error: any) => {
      console.error('Role update error:', error);
      if (error.message.includes('already exists')) {
        toast.error('A role with this name already exists. Please choose a different name.');
      } else if (error?.code === '23505') {
        toast.error('A role with this name already exists. Please choose a different name.');
      } else if (error?.code === '42501' || error?.message?.includes('permission')) {
        toast.error('Permission denied. You need admin privileges to update roles.');
      } else {
        toast.error(`Failed to update role: ${error?.message || 'Unknown error'}`);
      }
    },
  });
}

// Delete a role
export function useDeleteRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (roleId: string) => {
      // Check if any users are assigned to this role
      const { data: usersWithRole, error: checkError } = await supabase
        .from('users')
        .select('id, full_name')
        .or(`role_id.eq.${roleId},additional_role_ids.cs.{${roleId}}`);
      
      if (checkError) throw checkError;
      
      if (usersWithRole && usersWithRole.length > 0) {
        throw new Error(`Cannot delete role. ${usersWithRole.length} user(s) are currently assigned to this role.`);
      }
      
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);
      
      if (error) throw error;
      return roleId;
    },
    onSuccess: (deletedRoleId) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.removeQueries({ queryKey: ['role', deletedRoleId] });
      toast.success('Role deleted successfully!');
    },
    onError: (error: any) => {
      console.error('Role deletion error:', error);
      if (error.message.includes('Cannot delete role')) {
        toast.error(error.message);
      } else if (error?.code === '42501' || error?.message?.includes('permission')) {
        toast.error('Permission denied. You need admin privileges to delete roles.');
      } else if (error?.code === '23503') {
        toast.error('Cannot delete role. Users are currently assigned to this role.');
      } else {
        toast.error(`Failed to delete role: ${error?.message || 'Unknown error'}`);
      }
    },
  });
}

// Get role usage statistics
export function useRoleUsage() {
  return useQuery({
    queryKey: ['role-usage'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('role_id, additional_role_ids');
      
      if (error) throw error;
      
      // Count role usage
      const roleUsage: Record<string, number> = {};
      
      data.forEach(user => {
        // Count primary role
        if (user.role_id) {
          roleUsage[user.role_id] = (roleUsage[user.role_id] || 0) + 1;
        }
        
        // Count additional roles
        if (user.additional_role_ids && Array.isArray(user.additional_role_ids)) {
          user.additional_role_ids.forEach((roleId: string) => {
            roleUsage[roleId] = (roleUsage[roleId] || 0) + 1;
          });
        }
      });
      
      return roleUsage;
    },
  });
}
