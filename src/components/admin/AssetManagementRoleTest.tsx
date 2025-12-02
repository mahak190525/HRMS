import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useAssetManagementPermissions } from '@/hooks/useAssetManagementPermissions';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { getAllUserRoleNames, isUserOfficeAdmin, isUserITHelpdesk } from '@/utils/multipleRoles';
import { Package, Server, Shield, Users, CheckCircle, XCircle } from 'lucide-react';

/**
 * Test component to verify asset management role permissions
 * This component helps verify that the new Office Admin and IT Helpdesk roles work correctly
 */
export function AssetManagementRoleTest() {
  const { user } = useAuth();
  const assetPermissions = useAssetManagementPermissions();
  const employeePermissions = useEmployeePermissions();

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asset Management Role Test</CardTitle>
          <CardDescription>Please log in to test role permissions</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const userRoles = getAllUserRoleNames(user);
  const isOfficeAdmin = isUserOfficeAdmin(user);
  const isITHelpdesk = isUserITHelpdesk(user);

  const PermissionItem = ({ 
    label, 
    hasPermission, 
    icon: Icon 
  }: { 
    label: string; 
    hasPermission: boolean; 
    icon: React.ElementType;
  }) => (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      {hasPermission ? (
        <CheckCircle className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-red-600" />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Asset Management Role Test
          </CardTitle>
          <CardDescription>
            Testing permissions for Office Admin and IT Helpdesk roles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Info */}
          <div className="space-y-2">
            <h3 className="font-semibold">Current User</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Primary: {user.role?.name || 'Unknown'}</Badge>
              {user.additional_role_ids && user.additional_role_ids.length > 0 && (
                <Badge variant="secondary">
                  Additional: {user.additional_role_ids.length} role(s)
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {userRoles.map(role => (
                <Badge key={role} variant={
                  role === 'office_admin' ? 'default' :
                  role === 'it_helpdesk' ? 'destructive' :
                  'outline'
                }>
                  {role}
                </Badge>
              ))}
            </div>
          </div>

          {/* Role Detection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Role Detection</h4>
              <PermissionItem 
                label="Is Office Admin" 
                hasPermission={isOfficeAdmin}
                icon={Users}
              />
              <PermissionItem 
                label="Is IT Helpdesk" 
                hasPermission={isITHelpdesk}
                icon={Server}
              />
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Access Control</h4>
              <PermissionItem 
                label="Can Access Asset Management" 
                hasPermission={assetPermissions.canAccessAssetManagement}
                icon={Package}
              />
              <PermissionItem 
                label="Employee Mgmt Asset Access" 
                hasPermission={employeePermissions.canAccessAssetManagement}
                icon={Users}
              />
            </div>
          </div>

          {/* Asset Permissions */}
          <div className="space-y-2">
            <h4 className="font-medium">Regular Asset Permissions</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              <PermissionItem 
                label="View Assets" 
                hasPermission={assetPermissions.canViewAssets}
                icon={Package}
              />
              <PermissionItem 
                label="Create Assets" 
                hasPermission={assetPermissions.canCreateAssets}
                icon={Package}
              />
              <PermissionItem 
                label="Edit Assets" 
                hasPermission={assetPermissions.canEditAssets}
                icon={Package}
              />
              <PermissionItem 
                label="Delete Assets" 
                hasPermission={assetPermissions.canDeleteAssets}
                icon={Package}
              />
              <PermissionItem 
                label="Assign Assets" 
                hasPermission={assetPermissions.canAssignAssets}
                icon={Package}
              />
            </div>
          </div>

          {/* VM Permissions */}
          <div className="space-y-2">
            <h4 className="font-medium">VM Permissions</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              <PermissionItem 
                label="Manage VMs" 
                hasPermission={assetPermissions.canManageVMs}
                icon={Server}
              />
              <PermissionItem 
                label="View VM Details" 
                hasPermission={assetPermissions.canViewVMDetails}
                icon={Server}
              />
              <PermissionItem 
                label="Create VMs" 
                hasPermission={assetPermissions.canCreateVMs}
                icon={Server}
              />
              <PermissionItem 
                label="Edit VMs" 
                hasPermission={assetPermissions.canEditVMs}
                icon={Server}
              />
              <PermissionItem 
                label="Delete VMs" 
                hasPermission={assetPermissions.canDeleteVMs}
                icon={Server}
              />
              <PermissionItem 
                label="Assign VMs" 
                hasPermission={assetPermissions.canAssignVMs}
                icon={Server}
              />
            </div>
          </div>

          {/* Expected Behavior */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Expected Behavior</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li><strong>Office Admin:</strong> Can CRUD all assets EXCEPT VMs</li>
              <li><strong>IT Helpdesk:</strong> Can ONLY CRUD VMs, no regular assets</li>
              <li><strong>HR/HRM:</strong> NO asset management access unless they have Office Admin or IT Helpdesk roles</li>
              <li><strong>Admin:</strong> Full access to everything</li>
            </ul>
          </div>

          {/* Test Navigation */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/employees'}
              disabled={!employeePermissions.canAccessAssetManagement}
            >
              <Users className="h-4 w-4 mr-2" />
              Go to Employee Management
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/employees/assets'}
              disabled={!assetPermissions.canAccessAssetManagement}
            >
              <Package className="h-4 w-4 mr-2" />
              Go to Asset Management
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AssetManagementRoleTest;
