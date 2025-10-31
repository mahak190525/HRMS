import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Users,
  Eye,
  Plus,
  Edit,
  Trash2,
  BarChart3,
  Settings,
  Save,
  RotateCcw,
  AlertTriangle,
  Check,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { usePolicyDashboardPermissionsManager } from '@/hooks/usePolicyDashboardPermissions';
import type { PolicyDashboardPermissions } from '@/hooks/usePolicyDashboardPermissions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface RolePermissionConfig {
  role: string;
  displayName: string;
  description: string;
  defaultPermissions: Omit<PolicyDashboardPermissions, 'permission_source'>;
}

const ROLE_CONFIGS: RolePermissionConfig[] = [
  {
    role: 'admin',
    displayName: 'Administrator',
    description: 'Full system access with all permissions',
    defaultPermissions: {
      can_view_policies: true,
      can_create_policies: true,
      can_edit_policies: true,
      can_delete_policies: true,
      can_manage_permissions: true,
      can_view_analytics: true
    }
  },
  {
    role: 'super_admin',
    displayName: 'Super Administrator',
    description: 'Highest level system access',
    defaultPermissions: {
      can_view_policies: true,
      can_create_policies: true,
      can_edit_policies: true,
      can_delete_policies: true,
      can_manage_permissions: true,
      can_view_analytics: true
    }
  },
  {
    role: 'hr',
    displayName: 'HR',
    description: 'Human Resources staff',
    defaultPermissions: {
      can_view_policies: true,
      can_create_policies: true,
      can_edit_policies: true,
      can_delete_policies: true,
      can_manage_permissions: true,
      can_view_analytics: true
    }
  },
  {
    role: 'hrm',
    displayName: 'HR Manager',
    description: 'Human Resources management',
    defaultPermissions: {
      can_view_policies: true,
      can_create_policies: true,
      can_edit_policies: true,
      can_delete_policies: true,
      can_manage_permissions: true,
      can_view_analytics: true
    }
  },
  {
    role: 'manager',
    displayName: 'Manager',
    description: 'General management role',
    defaultPermissions: {
      can_view_policies: true,
      can_create_policies: false,
      can_edit_policies: false,
      can_delete_policies: false,
      can_manage_permissions: false,
      can_view_analytics: true
    }
  },
  {
    role: 'sdm',
    displayName: 'Software Development Manager',
    description: 'Development team management',
    defaultPermissions: {
      can_view_policies: true,
      can_create_policies: false,
      can_edit_policies: false,
      can_delete_policies: false,
      can_manage_permissions: false,
      can_view_analytics: true
    }
  },
  {
    role: 'bdm',
    displayName: 'Business Development Manager',
    description: 'Business development management',
    defaultPermissions: {
      can_view_policies: true,
      can_create_policies: false,
      can_edit_policies: false,
      can_delete_policies: false,
      can_manage_permissions: false,
      can_view_analytics: true
    }
  },
  {
    role: 'qam',
    displayName: 'Quality Assurance Manager',
    description: 'Quality assurance management',
    defaultPermissions: {
      can_view_policies: true,
      can_create_policies: false,
      can_edit_policies: false,
      can_delete_policies: false,
      can_manage_permissions: false,
      can_view_analytics: true
    }
  },
  {
    role: 'finance',
    displayName: 'Finance',
    description: 'Finance department staff',
    defaultPermissions: {
      can_view_policies: true,
      can_create_policies: false,
      can_edit_policies: false,
      can_delete_policies: false,
      can_manage_permissions: false,
      can_view_analytics: false
    }
  },
  {
    role: 'finance_manager',
    displayName: 'Finance Manager',
    description: 'Finance department management',
    defaultPermissions: {
      can_view_policies: true,
      can_create_policies: false,
      can_edit_policies: false,
      can_delete_policies: false,
      can_manage_permissions: false,
      can_view_analytics: true
    }
  },
  {
    role: 'employee',
    displayName: 'Employee',
    description: 'General employee access',
    defaultPermissions: {
      can_view_policies: true,
      can_create_policies: false,
      can_edit_policies: false,
      can_delete_policies: false,
      can_manage_permissions: false,
      can_view_analytics: false
    }
  },
  {
    role: 'intern',
    displayName: 'Intern',
    description: 'Intern access level',
    defaultPermissions: {
      can_view_policies: true,
      can_create_policies: false,
      can_edit_policies: false,
      can_delete_policies: false,
      can_manage_permissions: false,
      can_view_analytics: false
    }
  },
  {
    role: 'contractor',
    displayName: 'Contractor',
    description: 'External contractor access',
    defaultPermissions: {
      can_view_policies: true,
      can_create_policies: false,
      can_edit_policies: false,
      can_delete_policies: false,
      can_manage_permissions: false,
      can_view_analytics: false
    }
  }
];

const PERMISSION_CONFIGS = [
  {
    key: 'can_view_policies' as keyof Omit<PolicyDashboardPermissions, 'permission_source'>,
    label: 'View Policies',
    description: 'Can access and read organizational policies',
    icon: Eye,
    color: 'text-blue-600'
  },
  {
    key: 'can_create_policies' as keyof Omit<PolicyDashboardPermissions, 'permission_source'>,
    label: 'Create Policies',
    description: 'Can create new organizational policies',
    icon: Plus,
    color: 'text-green-600'
  },
  {
    key: 'can_edit_policies' as keyof Omit<PolicyDashboardPermissions, 'permission_source'>,
    label: 'Edit Policies',
    description: 'Can modify existing organizational policies',
    icon: Edit,
    color: 'text-orange-600'
  },
  {
    key: 'can_delete_policies' as keyof Omit<PolicyDashboardPermissions, 'permission_source'>,
    label: 'Delete Policies',
    description: 'Can remove organizational policies',
    icon: Trash2,
    color: 'text-red-600'
  },
  {
    key: 'can_manage_permissions' as keyof Omit<PolicyDashboardPermissions, 'permission_source'>,
    label: 'Manage Permissions',
    description: 'Can manage policy access permissions for other users',
    icon: Shield,
    color: 'text-purple-600'
  },
  {
    key: 'can_view_analytics' as keyof Omit<PolicyDashboardPermissions, 'permission_source'>,
    label: 'View Analytics',
    description: 'Can access policy usage analytics and statistics',
    icon: BarChart3,
    color: 'text-indigo-600'
  }
];

export const PolicyPermissionsPage: React.FC = () => {
  const [rolePermissions, setRolePermissions] = useState<Record<string, Omit<PolicyDashboardPermissions, 'permission_source'>>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  const { setRolePermissions: saveRolePermissions } = usePolicyDashboardPermissionsManager();

  // Initialize role permissions with defaults
  useEffect(() => {
    const initialPermissions: Record<string, Omit<PolicyDashboardPermissions, 'permission_source'>> = {};
    ROLE_CONFIGS.forEach(config => {
      initialPermissions[config.role] = { ...config.defaultPermissions };
    });
    setRolePermissions(initialPermissions);
  }, []);

  const handlePermissionChange = (
    role: string,
    permission: keyof Omit<PolicyDashboardPermissions, 'permission_source'>,
    value: boolean
  ) => {
    setRolePermissions(prev => {
      const newPermissions = { ...prev };
      if (!newPermissions[role]) {
        newPermissions[role] = { ...ROLE_CONFIGS.find(c => c.role === role)?.defaultPermissions! };
      }
      
      newPermissions[role] = {
        ...newPermissions[role],
        [permission]: value
      };

      // Handle dependencies
      if (!value) {
        // If disabling view, disable all others
        if (permission === 'can_view_policies') {
          newPermissions[role] = {
            can_view_policies: false,
            can_create_policies: false,
            can_edit_policies: false,
            can_delete_policies: false,
            can_manage_permissions: false,
            can_view_analytics: false
          };
        }
      } else {
        // If enabling any permission, ensure view is enabled
        if (permission !== 'can_view_policies') {
          newPermissions[role].can_view_policies = true;
        }
      }

      return newPermissions;
    });
    setHasChanges(true);
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      
      // Save permissions for each role without individual toasts
      for (const [role, permissions] of Object.entries(rolePermissions)) {
        await saveRolePermissions(role, permissions, undefined, false);
      }
      
      setHasChanges(false);
      toast.success('All role permissions updated successfully');
    } catch (error) {
      console.error('Failed to save role permissions:', error);
      toast.error('Failed to save role permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleResetRole = (role: string) => {
    const config = ROLE_CONFIGS.find(c => c.role === role);
    if (config) {
      setRolePermissions(prev => ({
        ...prev,
        [role]: { ...config.defaultPermissions }
      }));
      setHasChanges(true);
    }
  };

  const handleResetAll = () => {
    const initialPermissions: Record<string, Omit<PolicyDashboardPermissions, 'permission_source'>> = {};
    ROLE_CONFIGS.forEach(config => {
      initialPermissions[config.role] = { ...config.defaultPermissions };
    });
    setRolePermissions(initialPermissions);
    setHasChanges(true);
  };

  const getRolePermissionsSummary = (role: string) => {
    const permissions = rolePermissions[role];
    if (!permissions) return { enabled: 0, total: 6 };
    
    const enabled = Object.values(permissions).filter(Boolean).length;
    return { enabled, total: 6 };
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Role-Based Policy Permissions
            </h2>
            <p className="text-sm text-gray-600">
              Configure policy dashboard permissions for each role
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetAll}
              disabled={!hasChanges || saving}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset All
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={!hasChanges || saving}
              size="sm"
            >
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            These permissions apply to all users with the respective roles. Individual user permissions 
            can be managed through the Employee Management dashboard and will override role-based permissions.
          </AlertDescription>
        </Alert>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-6">
            {ROLE_CONFIGS.map(roleConfig => {
              const permissions = rolePermissions[roleConfig.role] || roleConfig.defaultPermissions;
              const summary = getRolePermissionsSummary(roleConfig.role);
              
              return (
                <Card key={roleConfig.role}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          {roleConfig.displayName}
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          {roleConfig.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {summary.enabled}/{summary.total} permissions
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetRole(roleConfig.role)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {PERMISSION_CONFIGS.map(permConfig => {
                        const IconComponent = permConfig.icon;
                        const isEnabled = permissions[permConfig.key];
                        const isViewPermission = permConfig.key === 'can_view_policies';
                        const canDisable = isViewPermission || permissions.can_view_policies;
                        
                        return (
                          <div
                            key={permConfig.key}
                            className={cn(
                              "p-3 rounded-lg border transition-all",
                              isEnabled 
                                ? "bg-blue-50 border-blue-200" 
                                : "bg-gray-50 border-gray-200"
                            )}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "p-1.5 rounded-md",
                                  isEnabled 
                                    ? "bg-blue-100 text-blue-600" 
                                    : "bg-gray-100 text-gray-500"
                                )}>
                                  <IconComponent className="h-4 w-4" />
                                </div>
                                <span className="font-medium text-sm">
                                  {permConfig.label}
                                </span>
                              </div>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(checked) => 
                                  handlePermissionChange(roleConfig.role, permConfig.key, checked)
                                }
                                disabled={!isViewPermission && !permissions.can_view_policies}
                              />
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {permConfig.description}
                            </p>
                            {!isViewPermission && !permissions.can_view_policies && (
                              <div className="mt-2 flex items-center text-xs text-amber-600">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Requires "View Policies"
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default PolicyPermissionsPage;
