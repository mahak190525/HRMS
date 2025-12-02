import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserPermissionSummary, canUserPerformAction } from '@/utils/multipleRoles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Debug component to show user's aggregated permissions from multiple roles
 * This component helps verify that multiple role permissions are working correctly
 */
export function MultipleRoleDebugger() {
  const { user } = useAuth();
  
  if (!user) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Multiple Role Permissions Debug</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No user logged in</p>
        </CardContent>
      </Card>
    );
  }
  
  const permissionSummary = getUserPermissionSummary(user);
  
  // Test various actions
  const testActions = [
    'create_employee',
    'edit_employee', 
    'delete_employee',
    'view_all_employees',
    'manage_roles',
    'manage_departments',
    'view_salary',
    'assign_kra',
    'evaluate_performance',
    'manage_assets'
  ];
  
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Multiple Role Permissions Debug</CardTitle>
        <p className="text-sm text-muted-foreground">
          Current user: {user.full_name} ({user.email})
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Roles Section */}
        <div>
          <h3 className="font-semibold mb-2">Assigned Roles</h3>
          <div className="flex flex-wrap gap-2">
            {user.role?.name && (
              <Badge variant="default">
                {user.role.name} (Primary)
              </Badge>
            )}
            {user.additional_roles?.map((role) => (
              <Badge key={role.id} variant="secondary">
                {role.name} (Additional)
              </Badge>
            ))}
            {permissionSummary.roles.length === 0 && (
              <Badge variant="outline">No roles assigned</Badge>
            )}
          </div>
        </div>
        
        {/* Access Level */}
        <div>
          <h3 className="font-semibold mb-2">Access Level</h3>
          <Badge variant={
            permissionSummary.accessLevel === 'all' ? 'default' :
            permissionSummary.accessLevel === 'team' ? 'secondary' :
            permissionSummary.accessLevel === 'own' ? 'outline' : 'destructive'
          }>
            {permissionSummary.accessLevel.toUpperCase()}
          </Badge>
        </div>
        
        {/* Capabilities */}
        <div>
          <h3 className="font-semibold mb-2">Capabilities</h3>
          <div className="flex flex-wrap gap-2">
            {permissionSummary.capabilities.map((capability, index) => (
              <Badge key={index} variant="outline">
                {capability}
              </Badge>
            ))}
            {permissionSummary.capabilities.length === 0 && (
              <p className="text-sm text-muted-foreground">No special capabilities</p>
            )}
          </div>
        </div>
        
        {/* Accessible Dashboards */}
        <div>
          <h3 className="font-semibold mb-2">Accessible Dashboards</h3>
          <div className="flex flex-wrap gap-2">
            {permissionSummary.dashboards.map((dashboard) => (
              <Badge key={dashboard} variant="outline">
                {dashboard}
              </Badge>
            ))}
            {permissionSummary.dashboards.length === 0 && (
              <p className="text-sm text-muted-foreground">No dashboards accessible</p>
            )}
          </div>
        </div>
        
        {/* Action Permissions */}
        <div>
          <h3 className="font-semibold mb-2">Action Permissions</h3>
          <div className="grid grid-cols-2 gap-2">
            {testActions.map((action) => {
              const canPerform = canUserPerformAction(user, action);
              return (
                <div key={action} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">{action.replace('_', ' ')}</span>
                  <Badge variant={canPerform ? 'default' : 'destructive'}>
                    {canPerform ? 'Allowed' : 'Denied'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Raw Data */}
        <details className="border rounded p-2">
          <summary className="font-semibold cursor-pointer">Raw User Data</summary>
          <pre className="text-xs mt-2 overflow-auto bg-muted p-2 rounded">
            {JSON.stringify({
              role_id: user.role_id,
              additional_role_ids: user.additional_role_ids,
              role: user.role,
              additional_roles: user.additional_roles,
              aggregated_dashboards: user.aggregated_dashboards,
              isSA: user.isSA
            }, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}
