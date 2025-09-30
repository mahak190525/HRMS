import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import WorkExperienceService, { 
  type WorkExperience, 
  type CreateWorkExperienceData, 
  type UpdateWorkExperienceData 
} from '@/services/workExperienceService';
import { toast } from 'sonner';

// Hook to get work experience for an employee
export function useWorkExperience(employeeId: string) {
  return useQuery({
    queryKey: ['work-experience', employeeId],
    queryFn: () => WorkExperienceService.getWorkExperience(employeeId),
    enabled: !!employeeId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook to create work experience
export function useCreateWorkExperience() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workExperienceData: CreateWorkExperienceData) => 
      WorkExperienceService.createWorkExperience(workExperienceData),
    onSuccess: (data, variables) => {
      // Invalidate and refetch work experience for this employee
      queryClient.invalidateQueries({ 
        queryKey: ['work-experience', variables.employee_id] 
      });
      // Also invalidate employee data to reflect work experience changes
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      queryClient.invalidateQueries({ queryKey: ['filtered-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', variables.employee_id] });
      toast.success('Work experience added successfully!');
    },
    onError: (error: any) => {
      console.error('Create work experience error:', error);
      toast.error(`Failed to add work experience: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to update work experience
export function useUpdateWorkExperience() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      id, 
      workExperienceData, 
      employeeId 
    }: { 
      id: string; 
      workExperienceData: UpdateWorkExperienceData; 
      employeeId: string; 
    }) => WorkExperienceService.updateWorkExperience(id, workExperienceData),
    onSuccess: (data, variables) => {
      // Invalidate and refetch work experience for this employee
      queryClient.invalidateQueries({ 
        queryKey: ['work-experience', variables.employeeId] 
      });
      // Also invalidate employee data to reflect work experience changes
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      queryClient.invalidateQueries({ queryKey: ['filtered-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', variables.employeeId] });
      toast.success('Work experience updated successfully!');
    },
    onError: (error: any) => {
      console.error('Update work experience error:', error);
      toast.error(`Failed to update work experience: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to delete work experience
export function useDeleteWorkExperience() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      id, 
      employeeId 
    }: { 
      id: string; 
      employeeId: string; 
    }) => WorkExperienceService.deleteWorkExperience(id),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate and refetch work experience for this employee
        queryClient.invalidateQueries({ 
          queryKey: ['work-experience', variables.employeeId] 
        });
        // Also invalidate employee data to reflect work experience changes
        queryClient.invalidateQueries({ queryKey: ['all-employees'] });
        queryClient.invalidateQueries({ queryKey: ['filtered-employees'] });
        queryClient.invalidateQueries({ queryKey: ['employee', variables.employeeId] });
        toast.success('Work experience deleted successfully!');
      } else {
        toast.error(result.error || 'Delete failed');
      }
    },
    onError: (error: any) => {
      console.error('Delete work experience error:', error);
      toast.error(`Failed to delete work experience: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to upload attachment
export function useUploadWorkExperienceAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      workExperienceId, 
      file, 
      employeeId, 
      employerName 
    }: { 
      workExperienceId: string; 
      file: File; 
      employeeId: string; 
      employerName: string; 
    }) => WorkExperienceService.uploadAttachment(workExperienceId, file, employeeId, employerName),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate and refetch work experience for this employee
        queryClient.invalidateQueries({ 
          queryKey: ['work-experience', variables.employeeId] 
        });
        toast.success('Attachment uploaded successfully!');
      } else {
        toast.error(result.error || 'Upload failed');
      }
    },
    onError: (error: any) => {
      console.error('Upload attachment error:', error);
      toast.error(`Failed to upload attachment: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to remove attachment
export function useRemoveWorkExperienceAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      workExperienceId, 
      employeeId 
    }: { 
      workExperienceId: string; 
      employeeId: string; 
    }) => WorkExperienceService.removeAttachment(workExperienceId),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate and refetch work experience for this employee
        queryClient.invalidateQueries({ 
          queryKey: ['work-experience', variables.employeeId] 
        });
        toast.success('Attachment removed successfully!');
      } else {
        toast.error(result.error || 'Removal failed');
      }
    },
    onError: (error: any) => {
      console.error('Remove attachment error:', error);
      toast.error(`Failed to remove attachment: ${error.message || 'Unknown error'}`);
    },
  });
}
