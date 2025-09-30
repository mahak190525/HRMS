import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  ChevronDown,
  UserPlus,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useProjects } from '@/hooks/useProjects';
import type { CreateProjectData, UpdateProjectData, ProjectWithRelations, ProjectAssignment } from '@/services';

const projectSchema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  assignments: z.array(z.object({
    user_id: z.string(),
    role_type: z.enum(['QA', 'Development', 'Design', 'Testing', 'Management', 'Support', 'Other']).nullable(),
    custom_role_name: z.string().optional(),
  })).min(1, 'At least one assignment must be made'),
  status: z.enum(['active', 'completed', 'on-hold', 'cancelled']).default('active'),
});

type ProjectFormData = z.infer<typeof projectSchema>;

export function ProjectManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithRelations | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignmentsOpen, setAssignmentsOpen] = useState(false);

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      project_name: '',
      assignments: [],
      status: 'active',
    },
  });

  // Use the custom hook for all project operations
  const {
    projects,
    allUsers,
    projectsLoading,
    createProject,
    updateProject,
    deleteProject,
  } = useProjects();

  const handleCreateProject = (data: ProjectFormData) => {
    createProject.mutate(data, {
      onSuccess: () => {
        setIsCreateDialogOpen(false);
        form.reset();
      },
    });
  };

  const handleEditProject = (project: ProjectWithRelations) => {
    setEditingProject(project);
    
    // Extract data from project assignments
    const assignments = project.project_assignments?.map(assignment => ({
      user_id: assignment.user_id,
      role_type: assignment.role_type,
      custom_role_name: assignment.custom_role_name || '',
    })) || [];
    
    form.reset({
      project_name: project.project_name,
      assignments: assignments,
      status: project.status,
    });
    
    setIsEditDialogOpen(true);
  };

  const handleUpdateProject = (data: ProjectFormData) => {
    if (!editingProject) return;
    updateProject.mutate({ id: editingProject.id, data }, {
      onSuccess: () => {
        setIsEditDialogOpen(false);
        setEditingProject(null);
        form.reset();
      },
    });
  };

  const handleDeleteProject = (projectId: string) => {
    deleteProject.mutate(projectId);
  };

  const addAssignment = (userId: string, roleType: 'QA' | 'Development' | 'Design' | 'Testing' | 'Management' | 'Support' | 'Other' | null) => {
    const currentAssignments = form.getValues('assignments');
    const existingAssignment = currentAssignments.find(a => a.user_id === userId);
    
    if (existingAssignment) {
      // Update existing assignment
      const updatedAssignments = currentAssignments.map(a => 
        a.user_id === userId ? { ...a, role_type: roleType } : a
      );
      form.setValue('assignments', updatedAssignments);
    } else {
      // Add new assignment
      form.setValue('assignments', [...currentAssignments, { user_id: userId, role_type: roleType }]);
    }
  };

  const removeAssignment = (userId: string) => {
    const currentAssignments = form.getValues('assignments');
    const updatedAssignments = currentAssignments.filter(a => a.user_id !== userId);
    form.setValue('assignments', updatedAssignments);
  };

  const updateCustomRoleName = (userId: string, customRoleName: string) => {
    const currentAssignments = form.getValues('assignments');
    const updatedAssignments = currentAssignments.map(a => 
      a.user_id === userId ? { ...a, custom_role_name: customRoleName } : a
    );
    form.setValue('assignments', updatedAssignments);
  };

  const filteredProjects = projects?.filter(project => {
    const matchesSearch = project.project_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      'on-hold': 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getUserName = (userId: string) => {
    return allUsers?.find(u => u.id === userId)?.full_name || 'Unknown User';
  };

  const getProjectManagers = (project: ProjectWithRelations) => {
    return project.project_assignments?.filter(a => a.role_type === 'Management') || [];
  };

  const getProjectMembers = (project: ProjectWithRelations) => {
    return project.project_assignments?.filter(a => a.role_type !== 'Management') || [];
  };

  if (projectsLoading) {
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
          <h1 className="text-3xl font-bold tracking-tight">Project Management</h1>
          <p className="text-muted-foreground">
            Create, manage, and track projects and their team assignments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1">
            {projects?.length || 0} Total Projects
          </Badge>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Set up a new project with team assignments and roles
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateProject)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="project_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter project name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />



                  <FormField
                    control={form.control}
                    name="assignments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team Assignments *</FormLabel>
                        <FormControl>
                          <div className="space-y-3">
                            {/* Add new assignment button */}
                            <Popover open={assignmentsOpen} onOpenChange={setAssignmentsOpen}>
                              <PopoverTrigger asChild>
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  role="combobox" 
                                  aria-expanded={assignmentsOpen} 
                                  className="w-full justify-start min-h-[3rem] h-auto py-2"
                                >
                                  <div className="flex items-start justify-between w-full">
                                    <div className="flex flex-wrap gap-1 flex-1 mr-2">
                                      {field.value.length > 0 ? (
                                        field.value.map((assignment) => {
                                          const user = allUsers?.find(u => u.id === assignment.user_id);
                                          const roleColor = {
                                            'Development': 'bg-blue-100 text-blue-800',
                                            'QA': 'bg-green-100 text-green-800',
                                            'Design': 'bg-purple-100 text-purple-800',
                                            'Testing': 'bg-yellow-100 text-yellow-800',
                                            'Management': 'bg-red-100 text-red-800',
                                            'Support': 'bg-orange-100 text-orange-800',
                                            'Other': 'bg-gray-100 text-gray-800'
                                          };
                                          
                                          return user ? (
                                            <Badge key={assignment.user_id} variant="secondary" className="text-xs px-2 py-1 mb-1">
                                              {user.full_name}
                                              {assignment.role_type && (
                                                <span className={`ml-1 px-1 rounded text-xs ${roleColor[assignment.role_type] || 'bg-gray-100 text-gray-800'}`}>
                                                  {assignment.role_type}
                                                </span>
                                              )}
                                              <span
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  removeAssignment(assignment.user_id);
                                                }}
                                                className="ml-1 hover:bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center cursor-pointer"
                                              >
                                                ×
                                              </span>
                                            </Badge>
                                          ) : null;
                                        })
                                      ) : (
                                        <span className="text-muted-foreground py-1">Select team members</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <UserPlus className="h-4 w-4" />
                                      <ChevronDown className="h-4 w-4" />
                                    </div>
                                  </div>
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                <Command>
                                  <CommandInput placeholder="Search team members..." />
                                  <CommandEmpty>No users found.</CommandEmpty>
                                  <CommandGroup>
                                    {allUsers?.map((user) => {
                                      const isAssigned = field.value.some(a => a.user_id === user.id);
                                      return (
                                        <CommandItem
                                          key={user.id}
                                          value={user.full_name}
                                          onSelect={() => {
                                            if (!isAssigned) {
                                              addAssignment(user.id, null);
                                            }
                                          }}
                                          className="flex items-center gap-2"
                                        >
                                          <Checkbox checked={isAssigned} aria-label={user.full_name} />
                                          <div className="flex-1">
                                            <div className="font-medium">{user.full_name}</div>
                                            <div className="text-sm text-muted-foreground">{user.email}</div>
                                          </div>
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </Command>
                              </PopoverContent>
                            </Popover>

                            {/* Role assignment for selected users */}
                            {field.value.length > 0 && (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                <Label className="text-sm font-medium">Assign Roles</Label>
                                {field.value.map((assignment) => {
                                  const user = allUsers?.find(u => u.id === assignment.user_id);
                                  return (
                                    <div key={assignment.user_id} className="flex items-center gap-2 p-2 border rounded-md bg-gray-50">
                                      <div className="flex-1 font-medium text-sm">{user?.full_name || 'Unknown User'}</div>
                                      <select
                                        value={assignment.role_type || ''}
                                        onChange={(e) => {
                                          const updatedAssignments = field.value.map(a => 
                                            a.user_id === assignment.user_id 
                                              ? { ...a, role_type: e.target.value === '' ? null : e.target.value as 'QA' | 'Development' | 'Design' | 'Testing' | 'Management' | 'Support' | 'Other' }
                                              : a
                                          );
                                          field.onChange(updatedAssignments);
                                        }}
                                        className="w-32 p-1 border rounded text-xs"
                                      >
                                        <option value="">No Role</option>
                                        <option value="Development">Development</option>
                                        <option value="QA">QA</option>
                                        <option value="Design">Design</option>
                                        <option value="Testing">Testing</option>
                                        <option value="Management">Management</option>
                                        <option value="Support">Support</option>
                                        <option value="Other">Other</option>
                                      </select>
                                      {assignment.role_type === 'Other' && (
                                        <Input
                                          placeholder="Custom role name"
                                          value={assignment.custom_role_name || ''}
                                          onChange={(e) => updateCustomRoleName(assignment.user_id, e.target.value)}
                                          className="w-32 text-xs"
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <FormControl>
                          <select {...field} className="w-full p-2 border rounded-md">
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="on-hold">On Hold</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createProject.isPending}>
                      {createProject.isPending ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Creating...
                        </>
                      ) : (
                        'Create Project'
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="on-hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projects List */}
      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>
            Complete list of all projects with team assignments and management details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Managers</TableHead>
                <TableHead>Team Members</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects?.map((project: ProjectWithRelations) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <div className="font-medium">{project.project_name}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusBadge(project.status)}>
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {getProjectManagers(project).map((assignment) => (
                        <Badge key={assignment.id} variant="default" className="text-xs">
                          {getUserName(assignment.user_id)}
                          {assignment.custom_role_name && (
                            <span className="ml-1 text-xs opacity-75">({assignment.custom_role_name})</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                       {getProjectMembers(project).map((assignment) => (
                         <Badge key={assignment.id} variant="outline" className="text-xs">
                           {getUserName(assignment.user_id)}
                           {assignment.role_type && (
                             <span className="ml-1 text-xs opacity-75">({assignment.role_type})</span>
                           )}
                           {assignment.custom_role_name && (
                             <span className="ml-1 text-xs opacity-75"> - {assignment.custom_role_name}</span>
                           )}
                         </Badge>
                       ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      Created: {new Date(project.created_at).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditProject(project)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Project</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{project.project_name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteProject(project.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update project details and team assignments
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateProject)} className="space-y-4">
              <FormField
                control={form.control}
                name="project_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />



              <FormField
                control={form.control}
                name="assignments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team Assignments *</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        {/* Add new assignment button */}
                        <Popover open={assignmentsOpen} onOpenChange={setAssignmentsOpen}>
                          <PopoverTrigger asChild>
                            <Button 
                              type="button" 
                              variant="outline" 
                              role="combobox" 
                              aria-expanded={assignmentsOpen} 
                              className="w-full justify-start min-h-[3rem] h-auto py-2"
                            >
                              <div className="flex items-start justify-between w-full">
                                <div className="flex flex-wrap gap-1 flex-1 mr-2">
                                  {field.value.length > 0 ? (
                                    field.value.map((assignment) => {
                                      const user = allUsers?.find(u => u.id === assignment.user_id);
                                      const roleColor = {
                                        'Development': 'bg-blue-100 text-blue-800',
                                        'QA': 'bg-green-100 text-green-800',
                                        'Design': 'bg-purple-100 text-purple-800',
                                        'Testing': 'bg-yellow-100 text-yellow-800',
                                        'Management': 'bg-red-100 text-red-800',
                                        'Support': 'bg-orange-100 text-orange-800',
                                        'Other': 'bg-gray-100 text-gray-800'
                                      };
                                      
                                      return user ? (
                                        <Badge key={assignment.user_id} variant="secondary" className="text-xs px-2 py-1 mb-1">
                                          {user.full_name}
                                          {assignment.role_type && (
                                            <span className={`ml-1 px-1 rounded text-xs ${roleColor[assignment.role_type] || 'bg-gray-100 text-gray-800'}`}>
                                              {assignment.role_type}
                                            </span>
                                          )}
                                          <span
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeAssignment(assignment.user_id);
                                            }}
                                            className="ml-1 hover:bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center cursor-pointer"
                                          >
                                            ×
                                          </span>
                                        </Badge>
                                      ) : null;
                                    })
                                  ) : (
                                    <span className="text-muted-foreground py-1">Select team members</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <UserPlus className="h-4 w-4" />
                                  <ChevronDown className="h-4 w-4" />
                                </div>
                              </div>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                            <Command>
                              <CommandInput placeholder="Search team members..." />
                              <CommandEmpty>No users found.</CommandEmpty>
                              <CommandGroup>
                                {allUsers?.map((user) => {
                                  const isAssigned = field.value.some(a => a.user_id === user.id);
                                  return (
                                    <CommandItem
                                      key={user.id}
                                      value={user.full_name}
                                      onSelect={() => {
                                        if (!isAssigned) {
                                          addAssignment(user.id, null);
                                        }
                                      }}
                                      className="flex items-center gap-2"
                                    >
                                      <Checkbox checked={isAssigned} aria-label={user.full_name} />
                                      <div className="flex-1">
                                        <div className="font-medium">{user.full_name}</div>
                                        <div className="text-sm text-muted-foreground">{user.email}</div>
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>

                        {/* Role assignment for selected users */}
                        {field.value.length > 0 && (
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            <Label className="text-sm font-medium">Assign Roles</Label>
                            {field.value.map((assignment) => {
                              const user = allUsers?.find(u => u.id === assignment.user_id);
                              return (
                                <div key={assignment.user_id} className="flex items-center gap-2 p-2 border rounded-md bg-gray-50">
                                  <div className="flex-1 font-medium text-sm">{user?.full_name || 'Unknown User'}</div>
                                  <select
                                    value={assignment.role_type || ''}
                                    onChange={(e) => {
                                      const updatedAssignments = field.value.map(a => 
                                        a.user_id === assignment.user_id 
                                          ? { ...a, role_type: e.target.value === '' ? null : e.target.value as 'QA' | 'Development' | 'Design' | 'Testing' | 'Management' | 'Support' | 'Other' }
                                          : a
                                      );
                                      field.onChange(updatedAssignments);
                                    }}
                                    className="w-32 p-1 border rounded text-xs"
                                  >
                                    <option value="">No Role</option>
                                    <option value="Development">Development</option>
                                    <option value="QA">QA</option>
                                    <option value="Design">Design</option>
                                    <option value="Testing">Testing</option>
                                    <option value="Management">Management</option>
                                    <option value="Support">Support</option>
                                    <option value="Other">Other</option>
                                  </select>
                                  {assignment.role_type === 'Other' && (
                                    <Input
                                      placeholder="Custom role name"
                                      value={assignment.custom_role_name || ''}
                                      onChange={(e) => updateCustomRoleName(assignment.user_id, e.target.value)}
                                      className="w-32 text-xs"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <select {...field} className="w-full p-2 border rounded-md">
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="on-hold">On Hold</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateProject.isPending}>
                  {updateProject.isPending ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Updating...
                    </>
                  ) : (
                    'Update Project'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
