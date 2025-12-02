import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Shield, 
  Save, 
  RotateCcw,
  Search,
  ChevronDown,
  ChevronRight,
  FileText
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Alert, AlertDescription } from '../ui/alert';
import { cn } from '../../lib/utils';
import { DASHBOARD_CONFIG } from '@/constants';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';

interface Role {
  id: string;
  name: string;
  description: string;
  dashboard_permissions?: Record<string, DashboardPermissions>;
  page_permissions?: Record<string, Record<string, PagePermissions>>;
}

interface DashboardPermissions {
  read: boolean;
  write: boolean;
  view: boolean;
  delete: boolean;
}

interface PagePermissions {
  read: boolean;
  write: boolean;
  view: boolean;
  delete: boolean;
}

interface RolePermissionsManagerProps {
  className?: string;
}

const CRUD_OPERATIONS = ['read', 'write', 'view', 'delete'] as const;
type CrudOperation = typeof CRUD_OPERATIONS[number];

export function RolePermissionsManager({ className }: RolePermissionsManagerProps) {
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDashboards, setExpandedDashboards] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch all roles
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async (): Promise<Role[]> => {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, description, dashboard_permissions, page_permissions')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Initialize permissions state
  const [dashboardPermissions, setDashboardPermissions] = useState<Record<string, DashboardPermissions>>({});
  const [pagePermissions, setPagePermissions] = useState<Record<string, Record<string, PagePermissions>>>({});

  // Load permissions when role is selected
  useEffect(() => {
    if (!selectedRoleId || !roles) return;
    
    const selectedRole = roles.find(r => r.id === selectedRoleId);
    if (!selectedRole) return;

    // Initialize dashboard permissions
    const dashPerms: Record<string, DashboardPermissions> = {};
    DASHBOARD_CONFIG.forEach(dashboard => {
      dashPerms[dashboard.id] = selectedRole.dashboard_permissions?.[dashboard.id] || {
        read: false,
        write: false,
        view: false,
        delete: false
      };
    });
    setDashboardPermissions(dashPerms);

    // Initialize page permissions
    const pagePerms: Record<string, Record<string, PagePermissions>> = {};
    DASHBOARD_CONFIG.forEach(dashboard => {
      pagePerms[dashboard.id] = {};
      dashboard.pages.forEach(page => {
        pagePerms[dashboard.id][page.id] = selectedRole.page_permissions?.[dashboard.id]?.[page.id] || {
          read: false,
          write: false,
          view: false,
          delete: false
        };
      });
    });
    setPagePermissions(pagePerms);
    setHasChanges(false);
  }, [selectedRoleId, roles]);

  // Update role permissions mutation
  const updateRolePermissions = useMutation({
    mutationFn: async ({ roleId, dashPerms, pagePerms }: {
      roleId: string;
      dashPerms: Record<string, DashboardPermissions>;
      pagePerms: Record<string, Record<string, PagePermissions>>;
    }) => {
      const { error } = await supabase
        .from('roles')
        .update({
          dashboard_permissions: dashPerms,
          page_permissions: pagePerms,
          updated_at: new Date().toISOString()
        })
        .eq('id', roleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      // Also invalidate user role permissions cache so users get updated permissions
      queryClient.invalidateQueries({ queryKey: ['user-role-permissions'] });
      setHasChanges(false);
      toast.success('Role permissions updated successfully. Users may need to refresh to see changes.');
    },
    onError: (error: any) => {
      toast.error(`Failed to update permissions: ${error.message}`);
    }
  });

  const handleDashboardPermissionChange = (
    dashboardId: string,
    operation: CrudOperation,
    value: boolean
  ) => {
    setDashboardPermissions(prev => ({
      ...prev,
      [dashboardId]: {
        ...prev[dashboardId],
        [operation]: value
      }
    }));
    setHasChanges(true);
  };

  const handlePagePermissionChange = (
    dashboardId: string,
    pageId: string,
    operation: CrudOperation,
    value: boolean
  ) => {
    setPagePermissions(prev => ({
      ...prev,
      [dashboardId]: {
        ...prev[dashboardId],
        [pageId]: {
          ...prev[dashboardId]?.[pageId],
          [operation]: value
        }
      }
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!selectedRoleId) return;
    
    updateRolePermissions.mutate({
      roleId: selectedRoleId,
      dashPerms: dashboardPermissions,
      pagePerms: pagePermissions
    });
  };

  const handleReset = () => {
    if (!selectedRoleId || !roles) return;
    
    const selectedRole = roles.find(r => r.id === selectedRoleId);
    if (!selectedRole) return;

    // Reset to database values
    const dashPerms: Record<string, DashboardPermissions> = {};
    DASHBOARD_CONFIG.forEach(dashboard => {
      dashPerms[dashboard.id] = selectedRole.dashboard_permissions?.[dashboard.id] || {
        read: false,
        write: false,
        view: false,
        delete: false
      };
    });
    setDashboardPermissions(dashPerms);

    const pagePerms: Record<string, Record<string, PagePermissions>> = {};
    DASHBOARD_CONFIG.forEach(dashboard => {
      pagePerms[dashboard.id] = {};
      dashboard.pages.forEach(page => {
        pagePerms[dashboard.id][page.id] = selectedRole.page_permissions?.[dashboard.id]?.[page.id] || {
          read: false,
          write: false,
          view: false,
          delete: false
        };
      });
    });
    setPagePermissions(pagePerms);
    setHasChanges(false);
  };

  const toggleDashboardExpanded = (dashboardId: string) => {
    setExpandedDashboards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dashboardId)) {
        newSet.delete(dashboardId);
      } else {
        newSet.add(dashboardId);
      }
      return newSet;
    });
  };

  const filteredDashboards = DASHBOARD_CONFIG.filter(dashboard =>
    dashboard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dashboard.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedRole = roles?.find(r => r.id === selectedRoleId);

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Role Permissions Management</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure dashboard and page access permissions for each role
          </p>
        </div>
      </div>

      {/* Role Selector */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Select Role
            </label>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger className="w-full cursor-pointer">
                <SelectValue placeholder="Choose a role to configure" />
              </SelectTrigger>
              {/* <SelectContent>
                {roles?.map(role => (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span className="font-medium">{role.name}</span>
                      {role.description && (
                        <span className="text-xs text-gray-500">- {role.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent> */}
              <SelectContent>
                {roles
                    ?.filter(role => role.name !== "super_admin")
                    .map(role => (
                    <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span className="font-medium">{role.name}</span>
                        {role.description && (
                            <span className="text-xs text-gray-500">- {role.description}</span>
                        )}
                        </div>
                    </SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
          {selectedRole && (
            <div className="text-right">
              <Badge variant="secondary" className="text-sm">
                {selectedRole.name}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {!selectedRoleId ? (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Please select a role to configure its permissions
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search dashboards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Permissions Table */}
          <div className="bg-white rounded-lg border">
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Dashboard / Page</TableHead>
                    <TableHead className="text-center">Read</TableHead>
                    <TableHead className="text-center">Write</TableHead>
                    <TableHead className="text-center">View</TableHead>
                    <TableHead className="text-center">Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDashboards.map((dashboard) => {
                    const isExpanded = expandedDashboards.has(dashboard.id);
                    const dashPerms = dashboardPermissions[dashboard.id] || {
                      read: false,
                      write: false,
                      view: false,
                      delete: false
                    };
                    const hasAnyPermission = Object.values(dashPerms).some(Boolean);

                    return (
                      <React.Fragment key={dashboard.id}>
                        {/* Dashboard Row */}
                        <TableRow className={cn(
                          "bg-gray-50 hover:bg-gray-100",
                          hasAnyPermission && "bg-blue-50 hover:bg-blue-100"
                        )}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggleDashboardExpanded(dashboard.id)}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                              <Shield className="h-4 w-4 text-gray-600" />
                              <div>
                                <div className="font-medium text-gray-900">{dashboard.name}</div>
                                <div className="text-xs text-gray-500">{dashboard.description}</div>
                              </div>
                            </div>
                          </TableCell>
                          {CRUD_OPERATIONS.map(operation => (
                            <TableCell key={operation} className="text-center">
                              <Switch
                                checked={dashPerms[operation]}
                                onCheckedChange={(checked) =>
                                  handleDashboardPermissionChange(dashboard.id, operation, checked)
                                }
                              />
                            </TableCell>
                          ))}
                        </TableRow>

                        {/* Page Rows (when expanded) */}
                        {isExpanded && dashboard.pages.map((page) => {
                          const pagePerms = pagePermissions[dashboard.id]?.[page.id] || {
                            read: false,
                            write: false,
                            view: false,
                            delete: false
                          };
                          const pageHasAnyPermission = Object.values(pagePerms).some(Boolean);

                          return (
                            <TableRow
                              key={page.id}
                              className={cn(
                                "bg-white hover:bg-gray-50",
                                pageHasAnyPermission && "bg-green-50 hover:bg-green-100"
                              )}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2 pl-8">
                                  <FileText className="h-4 w-4 text-gray-400" />
                                  <div>
                                    <div className="font-medium text-gray-700">{page.name}</div>
                                    <div className="text-xs text-gray-400">{page.path}</div>
                                  </div>
                                </div>
                              </TableCell>
                              {CRUD_OPERATIONS.map(operation => (
                                <TableCell key={operation} className="text-center">
                                  <Switch
                                    checked={pagePerms[operation]}
                                    onCheckedChange={(checked) =>
                                      handlePagePermissionChange(dashboard.id, page.id, operation, checked)
                                    }
                                  />
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!hasChanges || updateRolePermissions.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateRolePermissions.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Permissions
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

