import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi, type CreateProjectData, type UpdateProjectData, type ProjectWithRelations } from '@/services';
import { toast } from 'sonner';

export function useProjects() {
  const queryClient = useQueryClient();

  // Fetch projects
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectApi.getProjects,
  });

  // Fetch all users for dropdowns
  const { data: allUsers } = useQuery({
    queryKey: ['all-users'],
    queryFn: projectApi.getUsers,
  });



  // Create project mutation
  const createProject = useMutation({
    mutationFn: projectApi.createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create project');
      console.error('Create project error:', error);
    },
  });

  // Update project mutation
  const updateProject = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectData }) =>
      projectApi.updateProject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update project');
      console.error('Update project error:', error);
    },
  });

  // Delete project mutation
  const deleteProject = useMutation({
    mutationFn: projectApi.deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to delete project');
      console.error('Delete project error:', error);
    },
  });

  return {
    // Data
    projects,
    allUsers,
    projectsLoading,
    
    // Mutations
    createProject,
    updateProject,
    deleteProject,
  };
}
