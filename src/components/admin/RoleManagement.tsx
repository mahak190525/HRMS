import React, { useState } from 'react';
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole, useRoleUsage, type Role } from '@/hooks/useRoles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Shield,
  Info,
  AlertTriangle,
} from 'lucide-react';

const roleSchema = z.object({
  name: z.string()
    .min(1, 'Role name is required')
    .max(50, 'Role name must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Role name can only contain letters, numbers, underscores, and hyphens')
    .refine((name) => !['admin', 'super_admin', 'hr', 'employee', 'manager'].includes(name.toLowerCase()), 
      'This role name is reserved. Please choose a different name.'),
  description: z.string().max(200, 'Description must be less than 200 characters').optional(),
});

type RoleFormData = z.infer<typeof roleSchema>;

interface RoleManagementProps {
  className?: string;
}

export function RoleManagement({ className }: RoleManagementProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const { data: roleUsage } = useRoleUsage();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const createForm = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const editForm = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const handleCreateRole = async (data: RoleFormData) => {
    try {
      await createRole.mutateAsync({
        name: data.name,
        description: data.description,
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
    } catch (error) {
      // Error is handled by the mutation's onError
    }
  };

  const handleEditRole = async (data: RoleFormData) => {
    if (!editingRole) return;
    
    try {
      await updateRole.mutateAsync({
        roleId: editingRole.id,
        updates: {
          name: data.name,
          description: data.description,
        },
      });
      setEditingRole(null);
      editForm.reset();
    } catch (error) {
      // Error is handled by the mutation's onError
    }
  };

  const handleDeleteRole = async (role: Role) => {
    try {
      await deleteRole.mutateAsync(role.id);
    } catch (error) {
      // Error is handled by the mutation's onError
    }
  };

  const openEditDialog = (role: Role) => {
    setEditingRole(role);
    editForm.reset({
      name: role.name,
      description: role.description || '',
    });
  };

  const closeEditDialog = () => {
    setEditingRole(null);
    editForm.reset();
  };

  const getRoleUsageCount = (roleId: string) => {
    return roleUsage?.[roleId] || 0;
  };

  const isSystemRole = (roleName: string) => {
    return ['admin', 'super_admin', 'hr', 'employee', 'manager'].includes(roleName.toLowerCase());
  };

  if (rolesLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Role Management
            </CardTitle>
            <CardDescription>
              Create and manage user roles for the HRMS system. Roles define user permissions and access levels.
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Role</DialogTitle>
                <DialogDescription>
                  Add a new role to the system. Role names should be descriptive and unique.
                </DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(handleCreateRole)} className="space-y-4">
                  <FormField
                    control={createForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role Name *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., finance_manager, team_lead" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Brief description of the role and its responsibilities"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsCreateDialogOpen(false);
                        createForm.reset();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createRole.isPending}>
                      {createRole.isPending ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Creating...
                        </>
                      ) : (
                        'Create Role'
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {roles && roles.length > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-4">
              {roles.map((role) => {
                const usageCount = getRoleUsageCount(role.id);
                const isSystem = isSystemRole(role.name);
                
                return (
                  <div key={role.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold capitalize">{role.name}</h3>
                        {isSystem && (
                          <Badge variant="secondary" className="text-xs">
                            System Role
                          </Badge>
                        )}
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{usageCount} user{usageCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      {role.description && (
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Created: {new Date(role.created_at).toLocaleDateString()}</span>
                        {role.updated_at !== role.created_at && (
                          <span>Updated: {new Date(role.updated_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isSystem && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(role)}
                            disabled={updateRole.isPending}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={deleteRole.isPending || usageCount > 0}
                                className={usageCount > 0 ? 'opacity-50' : ''}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <AlertTriangle className="h-5 w-5 text-destructive" />
                                  Delete Role
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the role "{role.name}"? This action cannot be undone.
                                  {usageCount > 0 && (
                                    <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded">
                                      <strong>Warning:</strong> This role is currently assigned to {usageCount} user{usageCount !== 1 ? 's' : ''}. 
                                      You must reassign these users to other roles before deleting this role.
                                    </div>
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteRole(role)}
                                  disabled={usageCount > 0}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete Role
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                      {isSystem && (
                        <div className="text-xs text-muted-foreground px-2">
                          System role - cannot be modified
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Information Card */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Role Management Tips:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Role names are automatically converted to lowercase and must be unique</li>
                    <li>• System roles (admin, hr, employee, etc.) cannot be modified or deleted</li>
                    <li>• Roles with assigned users cannot be deleted - reassign users first</li>
                    <li>• After creating roles, configure their permissions in the Role-Based Access section above</li>
                    <li>• Role names should use underscores or hyphens instead of spaces (e.g., "team_lead" not "team lead")</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No roles found. Create your first role to get started.</p>
          </div>
        )}

        {/* Edit Role Dialog */}
        <Dialog open={!!editingRole} onOpenChange={(open) => !open && closeEditDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Role</DialogTitle>
              <DialogDescription>
                Update the role information. Changes will affect all users assigned to this role.
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditRole)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role Name *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., finance_manager, team_lead" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Brief description of the role and its responsibilities"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={closeEditDialog}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateRole.isPending}>
                    {updateRole.isPending ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Updating...
                      </>
                    ) : (
                      'Update Role'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
