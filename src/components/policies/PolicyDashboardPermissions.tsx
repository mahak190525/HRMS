import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Eye, 
  Edit, 
  Trash, 
  Plus,
  FileText,
  Users,
  Settings,
  Check,
  X,
  AlertTriangle,
  BarChart3,
  Lock,
  Unlock,
  Save,
  RotateCcw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { cn } from '../../lib/utils';
import type { User } from '../../types';
import { 
  useUserPolicyDashboardPermissions, 
  usePolicyDashboardPermissionsManager,
  type PolicyDashboardPermissions 
} from '../../hooks/usePolicyDashboardPermissions';
import { toast } from 'sonner';

interface PolicyDashboardPermissionsProps {
  employee: User;
  onClose: () => void;
  className?: string;
}

interface PermissionConfig {
  key: keyof Omit<PolicyDashboardPermissions, 'permission_source'>;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  dependency?: keyof Omit<PolicyDashboardPermissions, 'permission_source'>;
}

const PERMISSION_CONFIGS: PermissionConfig[] = [
  {
    key: 'can_view_policies',
    label: 'View Policies',
    description: 'Can access and read organizational policies',
    icon: Eye,
    color: 'text-blue-600'
  },
  {
    key: 'can_create_policies',
    label: 'Create Policies',
    description: 'Can create new organizational policies',
    icon: Plus,
    color: 'text-green-600',
    dependency: 'can_view_policies'
  },
  {
    key: 'can_edit_policies',
    label: 'Edit Policies',
    description: 'Can modify existing organizational policies',
    icon: Edit,
    color: 'text-orange-600',
    dependency: 'can_view_policies'
  },
  {
    key: 'can_delete_policies',
    label: 'Delete Policies',
    description: 'Can remove organizational policies',
    icon: Trash,
    color: 'text-red-600',
    dependency: 'can_view_policies'
  },
  {
    key: 'can_manage_permissions',
    label: 'Manage Permissions',
    description: 'Can manage policy access permissions for other users',
    icon: Shield,
    color: 'text-purple-600',
    dependency: 'can_view_policies'
  },
  {
    key: 'can_view_analytics',
    label: 'View Analytics',
    description: 'Can access policy usage analytics and statistics',
    icon: BarChart3,
    color: 'text-indigo-600',
    dependency: 'can_view_policies'
  }
];

export const PolicyDashboardPermissions: React.FC<PolicyDashboardPermissionsProps> = ({
  employee,
  onClose,
  className
}) => {
  const { permissions: currentPermissions, loading, refetch } = useUserPolicyDashboardPermissions(employee);
  const { setUserPermissions, removeUserPermissions } = usePolicyDashboardPermissionsManager();
  
  const [localPermissions, setLocalPermissions] = useState<Omit<PolicyDashboardPermissions, 'permission_source'>>({
    can_view_policies: true,
    can_create_policies: false,
    can_edit_policies: false,
    can_delete_policies: false,
    can_manage_permissions: false,
    can_view_analytics: false
  });
  
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize local permissions when current permissions load
  useEffect(() => {
    if (currentPermissions) {
      const { permission_source, ...perms } = currentPermissions;
      setLocalPermissions(perms);
    }
  }, [currentPermissions]);

  const handlePermissionChange = (
    key: keyof Omit<PolicyDashboardPermissions, 'permission_source'>, 
    value: boolean
  ) => {
    setLocalPermissions(prev => {
      const newPermissions = { ...prev, [key]: value };
      
      // Handle dependencies
      if (!value) {
        // If disabling a permission, also disable dependent permissions
        PERMISSION_CONFIGS.forEach(config => {
          if (config.dependency === key) {
            newPermissions[config.key] = false;
          }
        });
      } else {
        // If enabling a permission, ensure dependencies are enabled
        const config = PERMISSION_CONFIGS.find(c => c.key === key);
        if (config?.dependency) {
          newPermissions[config.dependency] = true;
        }
      }
      
      return newPermissions;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await setUserPermissions(employee.id, localPermissions);
      await refetch();
      setHasChanges(false);
      toast.success('Policy dashboard permissions updated successfully');
    } catch (error) {
      console.error('Failed to save policy dashboard permissions:', error);
      toast.error('Failed to save policy dashboard permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (currentPermissions) {
      const { permission_source, ...perms } = currentPermissions;
      setLocalPermissions(perms);
      setHasChanges(false);
    }
  };

  const handleResetToRoleDefaults = async () => {
    try {
      setSaving(true);
      await removeUserPermissions(employee.id);
      await refetch();
      setHasChanges(false);
      toast.success('Reset to role-based permissions successfully');
    } catch (error) {
      console.error('Failed to reset to role defaults:', error);
      toast.error('Failed to reset to role defaults');
    } finally {
      setSaving(false);
    }
  };

  const getPermissionSource = () => {
    if (!currentPermissions) return 'default';
    return currentPermissions.permission_source;
  };

  const getPermissionSourceBadge = () => {
    const source = getPermissionSource();
    switch (source) {
      case 'individual':
        return <Badge variant="default" className="text-xs">Individual</Badge>;
      case 'role':
        return <Badge variant="secondary" className="text-xs">Role-based</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Default</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Policy Dashboard Access</span>
          </h3>
          <p className="text-sm text-gray-600">
            Manage {employee.full_name}'s access to the policies dashboard
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {getPermissionSource() === 'individual' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToRoleDefaults}
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset to Role
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges || saving}
          >
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Employee Info */}
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <span>
              <strong>{employee.full_name}</strong> ({employee.role?.name || 'No Role'})
            </span>
            {getPermissionSourceBadge()}
          </div>
        </AlertDescription>
      </Alert>

      {/* Permissions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PERMISSION_CONFIGS.map((config) => {
          const IconComponent = config.icon;
          const isEnabled = localPermissions[config.key];
          const isDependencyMet = !config.dependency || localPermissions[config.dependency];
          
          return (
            <Card 
              key={config.key}
              className={cn(
                "transition-all duration-200",
                isEnabled 
                  ? "bg-blue-50 border-blue-200 shadow-sm" 
                  : "bg-white border-gray-200 hover:border-gray-300"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className={cn(
                    "p-2 rounded-md",
                    isEnabled 
                      ? "bg-blue-100 text-blue-600" 
                      : "bg-gray-100 text-gray-500"
                  )}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm text-gray-900">
                        {config.label}
                      </h4>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => handlePermissionChange(config.key, checked)}
                        disabled={config.dependency && !isDependencyMet}
                      />
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {config.description}
                    </p>
                    {config.dependency && !isDependencyMet && (
                      <div className="mt-2 flex items-center text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Requires "{PERMISSION_CONFIGS.find(c => c.key === config.dependency)?.label}"
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Permission Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span>Access Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={cn(
                "text-2xl font-bold",
                localPermissions.can_view_policies ? "text-green-600" : "text-gray-400"
              )}>
                {localPermissions.can_view_policies ? <Eye className="h-6 w-6 mx-auto" /> : <X className="h-6 w-6 mx-auto" />}
              </div>
              <div className="text-sm text-gray-600">View Access</div>
            </div>
            <div className="text-center">
              <div className={cn(
                "text-2xl font-bold",
                (localPermissions.can_create_policies || localPermissions.can_edit_policies) ? "text-blue-600" : "text-gray-400"
              )}>
                {(localPermissions.can_create_policies || localPermissions.can_edit_policies) ? <Edit className="h-6 w-6 mx-auto" /> : <X className="h-6 w-6 mx-auto" />}
              </div>
              <div className="text-sm text-gray-600">Write Access</div>
            </div>
            <div className="text-center">
              <div className={cn(
                "text-2xl font-bold",
                localPermissions.can_delete_policies ? "text-red-600" : "text-gray-400"
              )}>
                {localPermissions.can_delete_policies ? <Trash className="h-6 w-6 mx-auto" /> : <X className="h-6 w-6 mx-auto" />}
              </div>
              <div className="text-sm text-gray-600">Delete Access</div>
            </div>
            <div className="text-center">
              <div className={cn(
                "text-2xl font-bold",
                localPermissions.can_manage_permissions ? "text-purple-600" : "text-gray-400"
              )}>
                {localPermissions.can_manage_permissions ? <Shield className="h-6 w-6 mx-auto" /> : <X className="h-6 w-6 mx-auto" />}
              </div>
              <div className="text-sm text-gray-600">Admin Access</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning for dangerous permissions */}
      {(localPermissions.can_delete_policies || localPermissions.can_manage_permissions) && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Warning:</strong> This user will have elevated permissions that can affect organizational policies and other users' access.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default PolicyDashboardPermissions;
