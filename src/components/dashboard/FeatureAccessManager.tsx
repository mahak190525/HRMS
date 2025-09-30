import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Settings,
  Shield,
  Search,
  Check,
  X,
  Info,
  Lock,
  Unlock,
  RotateCcw,
  Save,
  ChevronRight,
  ChevronDown,
  Users,
  Target,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  UserCheck,
  GraduationCap,
  LogOut,
  Home,
  Calendar,
  FileText,
  MessageSquare,
  UserPlus,
  Package,
  Clock,
  Building,
  BarChart3,
  MessageCircle,
  List,
  Receipt,
  History,
  Banknote,
  Code,
  HelpCircle,
  BookOpen,
  Upload,
  ClipboardCheck
} from 'lucide-react';
import { DASHBOARD_CONFIG, ROLE_DASHBOARD_MAPPING } from '@/constants';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

interface FeatureAccessManagerProps {
  employee: User;
  onSave: (permissions: Record<string, Record<string, boolean>>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const pageIcons = {
  Home,
  Calendar,
  FileText,
  MessageSquare,
  Target,
  UserPlus,
  Settings,
  Users,
  Package,
  Clock,
  LogOut,
  Building,
  BarChart3,
  MessageCircle,
  List,
  Receipt,
  History,
  UserCheck,
  Code,
  HelpCircle,
  GraduationCap,
  BookOpen,
  Upload,
  ClipboardCheck,
  Banknote,
  TrendingUp,
  DollarSign,
  AlertTriangle,
};

const dashboardIcons = {
  UserIcon: Users,
  Users,
  Target,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  UserCheck,
  GraduationCap,
  LogOut,
};

export function FeatureAccessManager({ 
  employee, 
  onSave, 
  onCancel, 
  isLoading = false 
}: FeatureAccessManagerProps) {
  const roleName = employee.role?.name || employee.role_id || 'employee';
  const roleBasedDashboards = ROLE_DASHBOARD_MAPPING[roleName as keyof typeof ROLE_DASHBOARD_MAPPING] || [];
  
  // Initialize page permissions state
  const [pagePermissions, setPagePermissions] = useState<Record<string, Record<string, boolean>>>(() => {
    const permissions: Record<string, Record<string, boolean>> = {};
    
    // Initialize all dashboard pages
    DASHBOARD_CONFIG.forEach(dashboard => {
      permissions[dashboard.id] = {};
      
      // Set role-based defaults for pages if dashboard is enabled by role
      const isDashboardEnabledByRole = roleBasedDashboards.includes(dashboard.id);
      const isDashboardExplicitlyEnabled = employee.extra_permissions?.dashboards?.[dashboard.id];
      const isDashboardEnabled = isDashboardEnabledByRole || isDashboardExplicitlyEnabled;
      
      dashboard.pages.forEach(page => {
        // Default to true if dashboard is enabled, false otherwise
        permissions[dashboard.id][page.id] = isDashboardEnabled;
      });
    });
    
    // Override with explicit page permissions
    const explicitPagePermissions = employee.extra_permissions?.pages || {};
    Object.keys(explicitPagePermissions).forEach(dashboardId => {
      if (permissions[dashboardId]) {
        Object.keys(explicitPagePermissions[dashboardId]).forEach(pageId => {
          permissions[dashboardId][pageId] = explicitPagePermissions[dashboardId][pageId];
        });
      }
    });
    
    return permissions;
  });

  const [expandedDashboards, setExpandedDashboards] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const handlePageToggle = (dashboardId: string, pageId: string, enabled: boolean) => {
    setPagePermissions(prev => ({
      ...prev,
      [dashboardId]: {
        ...prev[dashboardId],
        [pageId]: enabled
      }
    }));
    setHasChanges(true);
  };

  const handleDashboardToggleAll = (dashboardId: string, enabled: boolean) => {
    const dashboard = DASHBOARD_CONFIG.find(d => d.id === dashboardId);
    if (!dashboard) return;

    setPagePermissions(prev => {
      const newDashboardPermissions = { ...prev[dashboardId] };
      dashboard.pages.forEach(page => {
        newDashboardPermissions[page.id] = enabled;
      });
      
      return {
        ...prev,
        [dashboardId]: newDashboardPermissions
      };
    });
    setHasChanges(true);
  };

  const toggleDashboardExpansion = (dashboardId: string) => {
    setExpandedDashboards(prev => ({
      ...prev,
      [dashboardId]: !prev[dashboardId]
    }));
  };

  const handleSave = () => {
    onSave(pagePermissions);
  };

  const handleReset = () => {
    const permissions: Record<string, Record<string, boolean>> = {};
    
    // Reset to role-based defaults
    DASHBOARD_CONFIG.forEach(dashboard => {
      permissions[dashboard.id] = {};
      const isDashboardEnabledByRole = roleBasedDashboards.includes(dashboard.id);
      
      dashboard.pages.forEach(page => {
        permissions[dashboard.id][page.id] = isDashboardEnabledByRole;
      });
    });
    
    setPagePermissions(permissions);
    setHasChanges(true);
  };

  const getPageAccessLevel = (dashboardId: string, pageId: string) => {
    const isDashboardRoleBased = roleBasedDashboards.includes(dashboardId);
    const isPageEnabled = pagePermissions[dashboardId]?.[pageId];
    
    if (isDashboardRoleBased && isPageEnabled) return 'role';
    if (!isDashboardRoleBased && isPageEnabled) return 'explicit';
    return 'none';
  };

  const getDashboardAccessLevel = (dashboardId: string) => {
    const isDashboardRoleBased = roleBasedDashboards.includes(dashboardId);
    const isDashboardExplicitlyEnabled = employee.extra_permissions?.dashboards?.[dashboardId];
    
    if (isDashboardRoleBased) return 'role';
    if (isDashboardExplicitlyEnabled) return 'explicit';
    return 'none';
  };

  const getEnabledPagesCount = (dashboardId: string) => {
    return Object.values(pagePermissions[dashboardId] || {}).filter(Boolean).length;
  };

  const getTotalPagesCount = (dashboardId: string) => {
    const dashboard = DASHBOARD_CONFIG.find(d => d.id === dashboardId);
    return dashboard?.pages.length || 0;
  };

  // Filter dashboards and pages based on search
  const filteredDashboards = DASHBOARD_CONFIG.filter(dashboard => {
    if (!searchTerm.trim()) return true;
    
    const dashboardMatch = dashboard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          dashboard.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const pageMatch = dashboard.pages.some(page => 
      page.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    return dashboardMatch || pageMatch;
  });

  // Only show dashboards that are accessible (either by role or explicitly enabled)
  const accessibleDashboards = filteredDashboards.filter(dashboard => {
    const isDashboardRoleBased = roleBasedDashboards.includes(dashboard.id);
    const isDashboardExplicitlyEnabled = employee.extra_permissions?.dashboards?.[dashboard.id];
    return isDashboardRoleBased || isDashboardExplicitlyEnabled;
  });

  const totalEnabledPages = Object.values(pagePermissions).reduce((total, dashboardPages) => {
    return total + Object.values(dashboardPages).filter(Boolean).length;
  }, 0);

  return (
    <div className="space-y-5 text-sm w-full">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="p-2 bg-blue-100 rounded-md">
            <Shield className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900">Feature-Level Access Control</h4>
            <p className="text-sm text-muted-foreground">
              Configure specific page access within each dashboard for {employee.full_name}
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-blue-600">{totalEnabledPages}</div>
            <div className="text-xs text-muted-foreground">pages enabled</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search dashboards and pages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-4"
          />
        </div>
      </div>

      {/* Dashboard List */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {accessibleDashboards.length === 0 ? (
          <div className="text-center py-8">
            <div className="p-3 bg-gray-100 rounded-full w-12 h-12 mx-auto mb-3">
              <Lock className="h-6 w-6 text-gray-500" />
            </div>
            <p className="text-muted-foreground">
              No accessible dashboards found. Configure dashboard access first.
            </p>
          </div>
        ) : (
          accessibleDashboards.map((dashboard) => {
            const IconComponent = dashboardIcons[dashboard.icon as keyof typeof dashboardIcons] || Users;
            const isExpanded = expandedDashboards[dashboard.id];
            const enabledCount = getEnabledPagesCount(dashboard.id);
            const totalCount = getTotalPagesCount(dashboard.id);
            const dashboardAccessLevel = getDashboardAccessLevel(dashboard.id);
            
            return (
              <Card key={dashboard.id} className="overflow-hidden">
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleDashboardExpansion(dashboard.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-md",
                      enabledCount > 0 
                        ? "bg-blue-100 text-blue-600" 
                        : "bg-gray-100 text-gray-500"
                    )}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="font-medium text-gray-900 truncate">{dashboard.name}</h5>
                        {dashboardAccessLevel === 'role' && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            Role
                          </Badge>
                        )}
                        {dashboardAccessLevel === 'explicit' && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            Custom
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {dashboard.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {enabledCount}/{totalCount}
                        </div>
                        <div className="text-xs text-muted-foreground">pages</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDashboardToggleAll(dashboard.id, enabledCount < totalCount);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        {enabledCount === totalCount ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </Button>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <Separator className="mb-4" />
                    <div className="space-y-2">
                      {dashboard.pages
                        .filter(page => 
                          !searchTerm.trim() || 
                          page.name.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((page) => {
                          const PageIcon = pageIcons[page.icon as keyof typeof pageIcons] || Settings;
                          const accessLevel = getPageAccessLevel(dashboard.id, page.id);
                          const isEnabled = pagePermissions[dashboard.id]?.[page.id];
                          const isRoleDefault = accessLevel === 'role';
                          
                          return (
                            <div
                              key={page.id}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border text-sm",
                                isEnabled 
                                  ? "bg-green-50 border-green-200" 
                                  : "bg-gray-50 border-gray-200"
                              )}
                            >
                              <div className={cn(
                                "p-1.5 rounded-md",
                                isEnabled 
                                  ? "bg-green-100 text-green-600" 
                                  : "bg-gray-100 text-gray-500"
                              )}>
                                <PageIcon className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <span className="font-medium text-gray-900 truncate">{page.name}</span>
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
                              </div>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(checked) => handlePageToggle(dashboard.id, page.id, checked)}
                                size="sm"
                              />
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={!hasChanges || isLoading}
          className="h-9 text-sm"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onCancel}
          disabled={isLoading}
          className="h-9 text-sm"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isLoading}
          size="sm"
          className="h-9 text-sm bg-blue-600 hover:bg-blue-700"
        >
          <Save className="h-4 w-4 mr-1" />
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
