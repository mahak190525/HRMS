import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  Shield, 
  Plus, 
  Trash2, 
  Search,
  Eye,
  Edit,
  Trash,
  Settings
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
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
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '../ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { Alert, AlertDescription } from '../ui/alert';
import { cn } from '../../lib/utils';
import type { Policy, PolicyPermission, User } from '../../types';
import { usePolicyPermissions } from '../../hooks/usePolicies';

interface PolicyPermissionsManagerProps {
  policy: Policy;
  onClose: () => void;
  className?: string;
}

interface PermissionFormData {
  user_id?: string;
  role?: string;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

export const PolicyPermissionsManager: React.FC<PolicyPermissionsManagerProps> = ({
  policy,
  onClose,
  className
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingPermission, setIsAddingPermission] = useState(false);
  const [permissionForm, setPermissionForm] = useState<PermissionFormData>({
    can_read: true,
    can_write: false,
    can_delete: false
  });
  const [permissionType, setPermissionType] = useState<'user' | 'role'>('role');

  const { 
    permissions, 
    loading, 
    createPermission, 
    updatePermission, 
    deletePermission,
    setRolePermissions,
    setUserPermissions
  } = usePolicyPermissions(policy.id);

  // Available roles (you might want to fetch this from your roles table)
  const availableRoles = [
    'admin', 'hr', 'manager', 'employee', 'intern', 'contractor'
  ];

  const filteredPermissions = permissions.filter(permission => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      permission.role?.toLowerCase().includes(searchLower) ||
      permission.user?.full_name?.toLowerCase().includes(searchLower) ||
      permission.user?.email?.toLowerCase().includes(searchLower)
    );
  });

  const handleAddPermission = async () => {
    try {
      if (permissionType === 'role' && permissionForm.role) {
        await setRolePermissions(permissionForm.role, {
          can_read: permissionForm.can_read,
          can_write: permissionForm.can_write,
          can_delete: permissionForm.can_delete
        });
      } else if (permissionType === 'user' && permissionForm.user_id) {
        await setUserPermissions(permissionForm.user_id, {
          can_read: permissionForm.can_read,
          can_write: permissionForm.can_write,
          can_delete: permissionForm.can_delete
        });
      }
      
      setIsAddingPermission(false);
      setPermissionForm({
        can_read: true,
        can_write: false,
        can_delete: false
      });
    } catch (error) {
      console.error('Failed to add permission:', error);
    }
  };

  const handleUpdatePermission = async (
    permission: PolicyPermission, 
    field: 'can_read' | 'can_write' | 'can_delete', 
    value: boolean
  ) => {
    try {
      await updatePermission(permission.id, { [field]: value });
    } catch (error) {
      console.error('Failed to update permission:', error);
    }
  };

  const handleDeletePermission = async (permission: PolicyPermission) => {
    if (window.confirm('Are you sure you want to remove this permission?')) {
      try {
        await deletePermission(permission.id);
      } catch (error) {
        console.error('Failed to delete permission:', error);
      }
    }
  };

  const PermissionRow: React.FC<{ permission: PolicyPermission }> = ({ permission }) => (
    <TableRow>
      <TableCell>
        <div className="flex items-center space-x-2">
          {permission.role ? (
            <>
              <Shield className="h-4 w-4 text-blue-500" />
              <div>
                <p className="font-medium">{permission.role}</p>
                <p className="text-xs text-gray-500">Role-based</p>
              </div>
            </>
          ) : (
            <>
              <UserCheck className="h-4 w-4 text-green-500" />
              <div>
                <p className="font-medium">{permission.user?.full_name}</p>
                <p className="text-xs text-gray-500">{permission.user?.email}</p>
              </div>
            </>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Switch
          checked={permission.can_read}
          onCheckedChange={(checked) => handleUpdatePermission(permission, 'can_read', checked)}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={permission.can_write}
          onCheckedChange={(checked) => handleUpdatePermission(permission, 'can_write', checked)}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={permission.can_delete}
          onCheckedChange={(checked) => handleUpdatePermission(permission, 'can_delete', checked)}
        />
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDeletePermission(permission)}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );

  const AddPermissionDialog: React.FC = () => (
    <Dialog open={isAddingPermission} onOpenChange={setIsAddingPermission}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Permission</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Permission Type</Label>
            <Tabs value={permissionType} onValueChange={(value) => setPermissionType(value as 'user' | 'role')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="role">Role-based</TabsTrigger>
                <TabsTrigger value="user">Individual</TabsTrigger>
              </TabsList>
              
              <TabsContent value="role" className="space-y-4">
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={permissionForm.role || ''}
                    onValueChange={(value) => setPermissionForm(prev => ({ ...prev, role: value, user_id: undefined }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center space-x-2">
                            <Shield className="h-4 w-4" />
                            <span className="capitalize">{role}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
              
              <TabsContent value="user" className="space-y-4">
                <div>
                  <Label htmlFor="user">User</Label>
                  <Select
                    value={permissionForm.user_id || ''}
                    onValueChange={(value) => setPermissionForm(prev => ({ ...prev, user_id: value, role: undefined }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="placeholder">
                        <div className="text-gray-500">User selection will be implemented with users table</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          <div className="space-y-3">
            <Label>Permissions</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Eye className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Read</span>
                </div>
                <Switch
                  checked={permissionForm.can_read}
                  onCheckedChange={(checked) => setPermissionForm(prev => ({ ...prev, can_read: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Edit className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Write</span>
                </div>
                <Switch
                  checked={permissionForm.can_write}
                  onCheckedChange={(checked) => setPermissionForm(prev => ({ ...prev, can_write: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Trash className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Delete</span>
                </div>
                <Switch
                  checked={permissionForm.can_delete}
                  onCheckedChange={(checked) => setPermissionForm(prev => ({ ...prev, can_delete: checked }))}
                />
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsAddingPermission(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddPermission}
            disabled={!permissionForm.role && !permissionForm.user_id}
          >
            Add Permission
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Manage Permissions - {policy.name}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Configure who can read, write, or delete this policy. Role-based permissions apply to all users with that role, while individual permissions override role-based settings.
            </AlertDescription>
          </Alert>
          
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search permissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setIsAddingPermission(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Permission
            </Button>
          </div>
          
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User/Role</TableHead>
                  <TableHead className="text-center">Read</TableHead>
                  <TableHead className="text-center">Write</TableHead>
                  <TableHead className="text-center">Delete</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                    </TableCell>
                  </TableRow>
                ) : filteredPermissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="text-gray-500">
                        {searchTerm ? 'No permissions found' : 'No permissions configured'}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPermissions.map((permission) => (
                    <PermissionRow key={permission.id} permission={permission} />
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
        
        <AddPermissionDialog />
      </DialogContent>
    </Dialog>
  );
};

export default PolicyPermissionsManager;
