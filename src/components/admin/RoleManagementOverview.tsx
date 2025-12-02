import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RoleDisplay } from '@/components/ui/role-display';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Users, UserCheck, Shield, Plus } from 'lucide-react';

interface RoleStats {
  total_users: number;
  users_with_additional_roles: number;
  total_role_assignments: number;
  most_common_additional_role: string;
}

interface UserWithRoles {
  id: string;
  full_name: string;
  email: string;
  role: { name: string };
  additional_roles: { id: string; name: string }[];
}

/**
 * Admin component showing role management overview and statistics
 */
export function RoleManagementOverview() {
  // Fetch role statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['role-management-stats'],
    queryFn: async (): Promise<RoleStats> => {
      const { data, error } = await supabase.rpc('get_role_management_stats');
      if (error) throw error;
      return data[0] || {
        total_users: 0,
        users_with_additional_roles: 0,
        total_role_assignments: 0,
        most_common_additional_role: 'None'
      };
    }
  });

  // Fetch users with multiple roles
  const { data: multiRoleUsers, isLoading: usersLoading } = useQuery({
    queryKey: ['users-with-multiple-roles'],
    queryFn: async (): Promise<UserWithRoles[]> => {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          role:roles(name),
          additional_role_ids,
          additional_roles:roles(id, name)
        `)
        .not('additional_role_ids', 'is', null)
        .neq('additional_role_ids', '{}')
        .eq('status', 'active')
        .order('full_name');

      if (error) throw error;
      return data || [];
    }
  });

  if (statsLoading || usersLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <LoadingSpinner size="sm" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const additionalRolePercentage = stats?.total_users 
    ? Math.round((stats.users_with_additional_roles / stats.total_users) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_users || 0}</div>
            <p className="text-xs text-muted-foreground">Active employees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Multiple Roles</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users_with_additional_roles || 0}</div>
            <p className="text-xs text-muted-foreground">
              {additionalRolePercentage}% of all users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_role_assignments || 0}</div>
            <p className="text-xs text-muted-foreground">Additional role assignments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Common</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold capitalize">
              {stats?.most_common_additional_role?.replace('_', ' ') || 'None'}
            </div>
            <p className="text-xs text-muted-foreground">Additional role</p>
          </CardContent>
        </Card>
      </div>

      {/* Users with Multiple Roles */}
      <Card>
        <CardHeader>
          <CardTitle>Users with Multiple Roles</CardTitle>
          <p className="text-sm text-muted-foreground">
            Employees who have been assigned additional roles beyond their primary role
          </p>
        </CardHeader>
        <CardContent>
          {multiRoleUsers && multiRoleUsers.length > 0 ? (
            <div className="space-y-4">
              {multiRoleUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 max-w-md">
                    <RoleDisplay user={user} variant="detailed" showLabels={false} />
                  </div>
                  
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs">
                      {1 + (user.additional_roles?.length || 0)} roles
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No users with multiple roles found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default RoleManagementOverview;
