import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUpdateUserPermissions } from '@/hooks/useEmployees';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeatureAccessManager } from './FeatureAccessManager';
import { PolicyDashboardPermissions } from '../policies/PolicyDashboardPermissions';
import {
  Settings,
  User as UserIcon,
  Users,
  Target,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  UserCheck,
  GraduationCap,
  LogOut,
  Save,
  RotateCcw,
  Search,
  Globe,
  Lock
} from 'lucide-react';
import { DASHBOARD_CONFIG, ROLE_DASHBOARD_MAPPING } from '@/constants';
import type { User } from '@/types';
import { cn } from '@/lib/utils';

interface DashboardAccessManagerProps {
  employee: User;
  onClose: () => void;
}

const dashboardIcons = {
  UserIcon,
  Users,
  Target,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  UserCheck,
  GraduationCap,
  LogOut,
};

export function DashboardAccessManager({ employee, onClose }: DashboardAccessManagerProps) {
  const { user } = useAuth();
  const updateUserPermissions = useUpdateUserPermissions();
  
  // Get role-based default dashboards
  const roleName = (employee.role?.name || employee.role_id || 'employee') as keyof typeof ROLE_DASHBOARD_MAPPING;
  const roleBasedDashboards = ROLE_DASHBOARD_MAPPING[roleName] || [];
  
  // Initialize dashboard permissions state
  const [dashboardPermissions, setDashboardPermissions] = useState<Record<string, boolean>>(() => {
    const permissions: Record<string, boolean> = {};
    
    // Set role-based defaults
    DASHBOARD_CONFIG.forEach(dashboard => {
      permissions[dashboard.id] = roleBasedDashboards.includes(dashboard.id as any);
    });
    
    // Override with explicit permissions
    const explicitPermissions = employee.extra_permissions?.dashboards || {};
    Object.keys(explicitPermissions).forEach(dashboardId => {
      permissions[dashboardId] = explicitPermissions[dashboardId];
    });
    
    return permissions;
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('dashboards');
  const [pagePermissions, setPagePermissions] = useState<Record<string, Record<string, boolean>>>({});

  const handleDashboardToggle = (dashboardId: string, enabled: boolean) => {
    setDashboardPermissions(prev => ({
      ...prev,
      [dashboardId]: enabled
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!user) return;

    const updatedPermissions = {
      ...employee.extra_permissions,
      dashboards: dashboardPermissions,
      ...(Object.keys(pagePermissions).length > 0 && { pages: pagePermissions })
    };

    updateUserPermissions.mutate({
      userId: employee.id,
      updates: {
        extra_permissions: updatedPermissions
      }
    }, {
      onSuccess: () => {
        setHasChanges(false);
        onClose();
      }
    });
  };

  const handlePagePermissionsSave = (permissions: Record<string, Record<string, boolean>>) => {
    setPagePermissions(permissions);
    setHasChanges(true);
    
    // Auto-save page permissions
    if (!user) return;

    const updatedPermissions = {
      ...employee.extra_permissions,
      dashboards: dashboardPermissions,
      pages: permissions
    };

    updateUserPermissions.mutate({
      userId: employee.id,
      updates: {
        extra_permissions: updatedPermissions
      }
    }, {
      onSuccess: () => {
        setHasChanges(false);
        onClose();
      }
    });
  };

  const handleReset = () => {
    const permissions: Record<string, boolean> = {};
    
    // Reset to role-based defaults only
    DASHBOARD_CONFIG.forEach(dashboard => {
      permissions[dashboard.id] = roleBasedDashboards.includes(dashboard.id as any);
    });
    
    setDashboardPermissions(permissions);
    setHasChanges(true);
  };

  const getAccessLevel = (dashboardId: string): 'role' | 'explicit' | 'none' => {
    const isRoleBased = roleBasedDashboards.includes(dashboardId as any);
    const isExplicitlyGranted = dashboardPermissions[dashboardId];
    
    if (isRoleBased && isExplicitlyGranted) return 'role';
    if (!isRoleBased && isExplicitlyGranted) return 'explicit';
    return 'none';
  };

  const filteredDashboards = DASHBOARD_CONFIG.filter(dashboard =>
    dashboard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dashboard.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const enabledDashboards = Object.values(dashboardPermissions).filter(Boolean).length;

  return (
    <div className="space-y-5 text-sm w-full">
      {/* Employee Info Card */}
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border">
        <Avatar className="h-10 w-10 ring-1 ring-white shadow-sm">
          <AvatarImage src={employee.avatar_url} />
          <AvatarFallback className="text-sm font-semibold bg-blue-500 text-white">
            {employee.full_name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{employee.full_name}</h4>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>{employee.employee_id}</span>
            <span>•</span>
            <span>{employee.department?.name}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {employee.email}
          </div>
        </div>
        <div className="text-right">
          <Badge variant="secondary" className="capitalize text-xs">
            {employee.role?.name?.replace('_', ' ')}
          </Badge>
          <div className="text-[11px] text-muted-foreground">
            {enabledDashboards} dashboard{enabledDashboards !== 1 ? 's' : ''} enabled
          </div>
        </div>
      </div>

      {/* Access Management Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboards" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Dashboard Access
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Feature Access
          </TabsTrigger>
          <TabsTrigger value="policy-dashboard" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Policy Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboards" className="space-y-4 mt-6">
          {/* Search for dashboards */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search dashboards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-4"
            />
          </div>

          {/* Dashboard Grid */}
          <div className="space-y-2 max-h-[420px] overflow-y-auto mb-2">
            {filteredDashboards.map((dashboard) => {
              const IconComponent = dashboardIcons[dashboard.icon as keyof typeof dashboardIcons] || UserIcon;
              const accessLevel = getAccessLevel(dashboard.id);
              const isEnabled = dashboardPermissions[dashboard.id];
              const isRoleDefault = accessLevel === 'role';
              
              return (
                <div
                  key={dashboard.id}
                  className={cn(
                    "group flex items-center gap-4 p-3.5 rounded-lg border text-sm",
                    isEnabled 
                      ? "bg-blue-50 border-blue-200 shadow-sm" 
                      : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-md",
                    isEnabled 
                      ? "bg-blue-100 text-blue-600" 
                      : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"
                  )}>
                    <IconComponent className="h-[18px] w-[18px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <h5 className="font-medium text-gray-900 truncate">{dashboard.name}</h5>
                      {isRoleDefault && (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                          Role
                        </Badge>
                      )}
                      {accessLevel === 'explicit' && (
                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                          Custom
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {dashboard.description}
                    </p>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleDashboardToggle(dashboard.id, checked)}
                    disabled={isRoleDefault && isEnabled}
                  />
                </div>
              );
            })}
          </div>

          {/* Dashboard Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!hasChanges}
              className="h-9 text-sm"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button variant="outline" size="sm" onClick={onClose} className="h-9 text-sm">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateUserPermissions.isPending}
              size="sm"
              className="h-9 text-sm bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="features" className="mt-6">
          <FeatureAccessManager
            employee={employee}
            onSave={handlePagePermissionsSave}
            onCancel={onClose}
            isLoading={updateUserPermissions.isPending}
          />
        </TabsContent>

        <TabsContent value="policy-dashboard" className="mt-6">
          <PolicyDashboardPermissions
            employee={employee}
            onClose={onClose}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}