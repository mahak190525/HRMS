import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Eye, 
  Edit, 
  Trash, 
  Search, 
  Plus,
  FileText,
  Users,
  Settings,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '../ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../../lib/utils';
import type { User, Policy, PolicyPermission } from '../../types';
import { usePolicies, usePolicyPermissions } from '../../hooks/usePolicies';
import { toast } from 'sonner';

interface EmployeePolicyPermissionsProps {
  employee: User;
  onClose: () => void;
  className?: string;
}

interface PolicyPermissionRow {
  policy: Policy;
  permission?: PolicyPermission;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
  source: 'role' | 'individual' | 'none';
}

export const EmployeePolicyPermissions: React.FC<EmployeePolicyPermissionsProps> = ({
  employee,
  onClose,
  className
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  // Removed category filtering for simplified version
  const [hasChanges, setHasChanges] = useState(false);
  const [permissionsMap, setPermissionsMap] = useState<Record<string, PolicyPermissionRow>>({});

  const { policies, loading: policiesLoading } = usePolicies();

  // Get permissions for all policies (this will include role-based and individual permissions)
  const { 
    permissions: allPermissions, 
    loading: permissionsLoading,
    setUserPermissions,
    setRolePermissions
  } = usePolicyPermissions(null); // null to get all permissions

  // Build permissions map
  useEffect(() => {
    if (!policies.length || permissionsLoading) return;

    const newPermissionsMap: Record<string, PolicyPermissionRow> = {};

    policies.forEach(policy => {
      // Find individual permission for this user
      const individualPermission = allPermissions.find(
        p => p.policy_id === policy.id && p.user_id === employee.id
      );

      // Find role-based permission
      const rolePermission = allPermissions.find(
        p => p.policy_id === policy.id && p.role === employee.role?.name
      );

      // Determine effective permissions
      let can_read = false;
      let can_write = false;
      let can_delete = false;
      let source: 'role' | 'individual' | 'none' = 'none';

      if (individualPermission) {
        can_read = individualPermission.can_read;
        can_write = individualPermission.can_write;
        can_delete = individualPermission.can_delete;
        source = 'individual';
      } else if (rolePermission) {
        can_read = rolePermission.can_read;
        can_write = rolePermission.can_write;
        can_delete = rolePermission.can_delete;
        source = 'role';
      }

      // Admin and HR have full access by default
      if (employee.role?.name === 'admin' || employee.role?.name === 'hr') {
        can_read = true;
        can_write = true;
        can_delete = true;
        source = 'role';
      }

      newPermissionsMap[policy.id] = {
        policy,
        permission: individualPermission,
        can_read,
        can_write,
        can_delete,
        source
      };
    });

    setPermissionsMap(newPermissionsMap);
  }, [policies, allPermissions, employee, permissionsLoading]);

  const handlePermissionChange = (
    policyId: string, 
    field: 'can_read' | 'can_write' | 'can_delete', 
    value: boolean
  ) => {
    setPermissionsMap(prev => ({
      ...prev,
      [policyId]: {
        ...prev[policyId],
        [field]: value,
        source: 'individual' // Mark as individual permission when changed
      }
    }));
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    try {
      const updates = Object.values(permissionsMap).filter(
        row => row.source === 'individual' && (
          row.can_read || row.can_write || row.can_delete
        )
      );

      for (const row of updates) {
        await setUserPermissions(row.policy.id, employee.id, {
          can_read: row.can_read,
          can_write: row.can_write,
          can_delete: row.can_delete
        });
      }

      setHasChanges(false);
      toast.success('Policy permissions updated successfully');
    } catch (error) {
      console.error('Failed to update permissions:', error);
      toast.error('Failed to update permissions');
    }
  };

  const handleResetToRoleDefaults = () => {
    // Reset all individual permissions to role-based defaults
    const resetMap = { ...permissionsMap };
    
    Object.keys(resetMap).forEach(policyId => {
      const row = resetMap[policyId];
      const rolePermission = allPermissions.find(
        p => p.policy_id === policyId && p.role === employee.role?.name
      );

      if (rolePermission) {
        resetMap[policyId] = {
          ...row,
          can_read: rolePermission.can_read,
          can_write: rolePermission.can_write,
          can_delete: rolePermission.can_delete,
          source: 'role'
        };
      } else {
        // No role permission, reset to none
        resetMap[policyId] = {
          ...row,
          can_read: employee.role?.name === 'admin' || employee.role?.name === 'hr',
          can_write: employee.role?.name === 'admin' || employee.role?.name === 'hr',
          can_delete: employee.role?.name === 'admin' || employee.role?.name === 'hr',
          source: employee.role?.name === 'admin' || employee.role?.name === 'hr' ? 'role' : 'none'
        };
      }
    });

    setPermissionsMap(resetMap);
    setHasChanges(true);
  };

  // Filter policies based on search only
  const filteredPolicies = Object.values(permissionsMap).filter(row => {
    const matchesSearch = !searchTerm || 
      row.policy.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const PermissionRow: React.FC<{ row: PolicyPermissionRow }> = ({ row }) => (
    <TableRow>
      <TableCell>
        <div className="flex items-center space-x-3">
          <FileText className="h-4 w-4 text-gray-400" />
          <div>
            <p className="font-medium text-sm">{row.policy.name}</p>
            <div className="flex items-center space-x-2 mt-1">
              <Badge 
                variant={row.source === 'individual' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {row.source === 'individual' ? 'Individual' : 
                 row.source === 'role' ? 'Role-based' : 'No Access'}
              </Badge>
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={row.can_read}
          onCheckedChange={(checked) => handlePermissionChange(row.policy.id, 'can_read', checked)}
        />
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={row.can_write}
          onCheckedChange={(checked) => handlePermissionChange(row.policy.id, 'can_write', checked)}
        />
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={row.can_delete}
          onCheckedChange={(checked) => handlePermissionChange(row.policy.id, 'can_delete', checked)}
        />
      </TableCell>
    </TableRow>
  );

  if (policiesLoading || permissionsLoading) {
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
            <Shield className="h-5 w-5" />
            <span>Policy Permissions</span>
          </h3>
          <p className="text-sm text-gray-600">
            Manage {employee.full_name}'s access to organizational policies
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToRoleDefaults}
            disabled={!hasChanges}
          >
            Reset to Role Defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSaveChanges}
            disabled={!hasChanges}
          >
            <Check className="h-4 w-4 mr-1" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Employee Info */}
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          <strong>{employee.full_name}</strong> ({employee.role?.name || 'No Role'}) - 
          Individual permissions override role-based permissions.
        </AlertDescription>
      </Alert>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search policies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {/* Category filter removed for simplified version */}
      </div>

      {/* Permissions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policy Access Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy</TableHead>
                  <TableHead className="text-center">Read</TableHead>
                  <TableHead className="text-center">Write</TableHead>
                  <TableHead className="text-center">Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPolicies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                    <div className="text-gray-500">
                      {searchTerm 
                        ? 'No policies match your search' 
                        : 'No policies found'
                      }
                    </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPolicies.map(row => (
                    <PermissionRow key={row.policy.id} row={row} />
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {filteredPolicies.filter(r => r.can_read).length}
              </div>
              <div className="text-sm text-gray-600">Can Read</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {filteredPolicies.filter(r => r.can_write).length}
              </div>
              <div className="text-sm text-gray-600">Can Write</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {filteredPolicies.filter(r => r.can_delete).length}
              </div>
              <div className="text-sm text-gray-600">Can Delete</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmployeePolicyPermissions;
