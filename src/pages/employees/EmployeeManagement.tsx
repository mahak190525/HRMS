import React, { useState } from 'react';
import { 
  useFilteredEmployees,
  useAssetMetrics 
} from '@/hooks/useEmployees';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DashboardAccessManager } from '@/components/dashboard/DashboardAccessManager';
import {
  Eye,
  Filter,
  Phone,
  Mail,
  Building,
  Package,
  Shield,
  Edit,
  Monitor,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {getRoleDisplayName} from '@/constants/index';
import { EmployeeDetailsModal } from '@/components/employees/EmployeeDetailsModal';


interface Employee {
  id: string;
  full_name: string;
  employee_id?: string;
  email: string;
  company_email?: string;
  personal_email?: string;
  phone?: string;
  position?: string;
  department?: { name: string };
  role?: { name: string };
  role_id?: string;
  status: string;
  avatar_url?: string;
  auth_provider?: 'microsoft' | 'google' | 'manual';
  provider_user_id?: string;
  extra_permissions?: {
    dashboards?: Record<string, boolean>;
    pages?: Record<string, Record<string, boolean>>;
    [key: string]: any;
  };
  created_at?: string;
  [key: string]: any;
}

export function EmployeeManagement() {
  const { user } = useAuth();
  const permissions = useEmployeePermissions();
  const { data: employees, isLoading: employeesLoading } = useFilteredEmployees();
  const { data: assetMetrics } = useAssetMetrics();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedEmployeeForAccess, setSelectedEmployeeForAccess] = useState<Employee | null>(null);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [employeeModalMode, setEmployeeModalMode] = useState<'view' | 'edit'>('view');

  // Update selectedEmployee when employee data changes (for immediate view updates)
  React.useEffect(() => {
    if (selectedEmployee && employees) {
      const updatedEmployee = employees.find((emp: any) => emp.id === selectedEmployee.id);
      if (updatedEmployee) {
        setSelectedEmployee(updatedEmployee);
      }
    }
  }, [employees, selectedEmployee?.id]);

  // Get departments, roles, and users for dropdowns
  const { data: departmentOptions } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: roleOptions } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });




  const filteredEmployees = employees?.filter((emp: Employee) => {
    const matchesSearch = emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = !departmentFilter || departmentFilter === 'all' || emp.department_id === departmentFilter;
    const matchesRole = !roleFilter || roleFilter === 'all' || emp.role_id === roleFilter;
    
    return matchesSearch && matchesDepartment && matchesRole;
  });

  const handleViewEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setEmployeeModalMode('view');
    setIsEmployeeModalOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setEmployeeModalMode('edit');
    setIsEmployeeModalOpen(true);
  };


  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-red-100 text-red-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };


  if (employeesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee Management</h1>
          <p className="text-muted-foreground">
            {permissions.accessLevel === 'all' 
              ? 'Manage employee information, attendance, and records'
              : permissions.accessLevel === 'team'
              ? 'Manage your team members information and records'
              : 'View and manage your profile information'
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1">
            {employees?.length || 0} {permissions.accessLevel === 'team' ? 'Team Members' : permissions.accessLevel === 'own' ? 'Profile' : 'Total Employees'}
          </Badge>
          {permissions.accessLevel !== 'all' && (
            <Badge variant="secondary" className="px-3 py-1">
              {permissions.accessLevel === 'team' ? 'Manager View' : 'Personal View'}
            </Badge>
          )}
        </div>
      </div>

      

      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList className={`grid w-full ${permissions.canManageAssets ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <TabsTrigger value="employees">
            {permissions.accessLevel === 'all' ? 'All Employees' : permissions.accessLevel === 'team' ? 'My Team' : 'My Profile'}
          </TabsTrigger>
          {permissions.canManageAssets && (
            <TabsTrigger value="assets">Asset Management</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="employees" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters & Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                <Label htmlFor="filter-employee-name" className='mb-2 ml-2'>Employee Name</Label>
                  <Input
                    id="filter-employee-name"
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="filter-department" className='mb-2'>Department</Label>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger >
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departmentOptions?.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="filter-role" className='mb-2'>Role</Label>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger >
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {roleOptions?.map((role) => (
                        <SelectItem key={role.id} value={role.id}>{getRoleDisplayName(role.name)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='mt-4'>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchTerm('');
                      setDepartmentFilter('all');
                      setRoleFilter('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employee List */}
          <Card>
            <CardHeader>
              <CardTitle>Employee Directory</CardTitle>
              <CardDescription>
                Complete list of all employees with their basic information and dashboard access management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees?.map((employee: Employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={employee.avatar_url} />
                            <AvatarFallback>{employee.full_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{employee.full_name}</div>
                            <div className="text-sm text-muted-foreground">{employee.position}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{employee.employee_id || 'Not assigned'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3" />
                            {employee.email}
                          </div>
                          {employee.phone && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {employee.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {employee.department?.name || 'Not assigned'}
                        </div>
                      </TableCell>
                      <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {getRoleDisplayName(employee.role?.name || '') || 'Not assigned'}
                          </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(employee.status)}>
                          {employee.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleViewEmployee(employee)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {/* Edit button - only HR and Admin can edit */}
                          {permissions.canEditAllEmployees && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleEditEmployee(employee)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {/* Access management button - admin/HR only */}
                          {permissions.canManageAccess && (
                            <Button 
                              size="sm"
                              onClick={() => {
                                setSelectedEmployeeForAccess(employee);
                                setIsAccessDialogOpen(true);
                              }}
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Dialog open={isAccessDialogOpen} onOpenChange={setIsAccessDialogOpen}>
                            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Manage Access Permissions</DialogTitle>
                                <DialogDescription>
                                  Configure dashboard and feature-level access permissions for {selectedEmployeeForAccess?.full_name}
                                </DialogDescription>
                              </DialogHeader>
                              {selectedEmployeeForAccess && (
                                <DashboardAccessManager
                                  employee={selectedEmployeeForAccess as any}
                                  onClose={() => {
                                    setIsAccessDialogOpen(false);
                                    setSelectedEmployeeForAccess(null);
                                  }}
                                />
                              )}
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {permissions.canManageAssets && (
          <TabsContent value="assets" className="space-y-6">
  {/* Top-right button */}
  <div className="flex justify-end">
    <Button onClick={() => (window.location.href = '/employees/assets')}>
      <Package className="h-4 w-4 mr-2" />
      Manage Assets
    </Button>
  </div>

  {/* Outer Card */}
  <Card>
    <CardHeader>
      <CardTitle>Asset Management Overview</CardTitle>
      <CardDescription>
        Quick overview of asset assignments and management
      </CardDescription>
    </CardHeader>

    {/* Inner grid for metrics */}
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Total Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assetMetrics?.totalAssets || 0}</div>
            <p className="text-xs text-muted-foreground">Company inventory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Assigned Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assetMetrics?.assignedAssets || 0}</div>
            <p className="text-xs text-muted-foreground">Currently in use</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Available Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assetMetrics?.availableAssets || 0}</div>
            <p className="text-xs text-muted-foreground">Ready for assignment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assetMetrics?.maintenanceAssets || 0}</div>
            <p className="text-xs text-muted-foreground">Under maintenance</p>
          </CardContent>
        </Card>
      </div>

      {/* Footer message */}
      <p className="text-center text-muted-foreground py-8">
        Click "Manage Assets" to access the full asset management dashboard
      </p>
    </CardContent>
  </Card>
</TabsContent>
        )}

      </Tabs>

      {/* Employee Details Modal */}
      <EmployeeDetailsModal
        employee={selectedEmployee}
        isOpen={isEmployeeModalOpen}
        onClose={() => {
          setIsEmployeeModalOpen(false);
          setSelectedEmployee(null);
        }}
        mode={employeeModalMode}
        onModeChange={setEmployeeModalMode}
      />
    </div>
  );
}