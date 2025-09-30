import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import IncidentService, { 
  type EmployeeIncident, 
  type CreateIncidentData, 
  type UpdateIncidentData 
} from '@/services/incidentService';
import { toast } from 'sonner';

// Hook to get incidents for an employee
export function useEmployeeIncidents(employeeId: string) {
  return useQuery({
    queryKey: ['employee-incidents', employeeId],
    queryFn: () => IncidentService.getEmployeeIncidents(employeeId),
    enabled: !!employeeId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook to create incident
export function useCreateIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (incidentData: CreateIncidentData) => 
      IncidentService.createIncident(incidentData),
    onSuccess: (data, variables) => {
      // Invalidate and refetch incidents for this employee
      queryClient.invalidateQueries({ 
        queryKey: ['employee-incidents', variables.employee_id] 
      });
      // Also invalidate employee data to reflect incident changes
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      queryClient.invalidateQueries({ queryKey: ['filtered-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', variables.employee_id] });
      toast.success('Incident created successfully!');
    },
    onError: (error: any) => {
      console.error('Create incident error:', error);
      toast.error(`Failed to create incident: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to update incident
export function useUpdateIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      id, 
      incidentData, 
      employeeId 
    }: { 
      id: string; 
      incidentData: UpdateIncidentData; 
      employeeId: string; 
    }) => IncidentService.updateIncident(id, incidentData),
    onSuccess: (data, variables) => {
      // Invalidate and refetch incidents for this employee
      queryClient.invalidateQueries({ 
        queryKey: ['employee-incidents', variables.employeeId] 
      });
      // Also invalidate employee data to reflect incident changes
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      queryClient.invalidateQueries({ queryKey: ['filtered-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', variables.employeeId] });
      toast.success('Incident updated successfully!');
    },
    onError: (error: any) => {
      console.error('Update incident error:', error);
      toast.error(`Failed to update incident: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to delete incident
export function useDeleteIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      id, 
      employeeId 
    }: { 
      id: string; 
      employeeId: string; 
    }) => IncidentService.deleteIncident(id),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate and refetch incidents for this employee
        queryClient.invalidateQueries({ 
          queryKey: ['employee-incidents', variables.employeeId] 
        });
        // Also invalidate employee data to reflect incident changes
        queryClient.invalidateQueries({ queryKey: ['all-employees'] });
        queryClient.invalidateQueries({ queryKey: ['filtered-employees'] });
        queryClient.invalidateQueries({ queryKey: ['employee', variables.employeeId] });
        toast.success('Incident deleted successfully!');
      } else {
        toast.error(result.error || 'Delete failed');
      }
    },
    onError: (error: any) => {
      console.error('Delete incident error:', error);
      toast.error(`Failed to delete incident: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to upload attachment
export function useUploadIncidentAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      incidentId, 
      file, 
      employeeId, 
      incidentTitle 
    }: { 
      incidentId: string; 
      file: File; 
      employeeId: string; 
      incidentTitle: string; 
    }) => IncidentService.uploadAttachment(incidentId, file, employeeId, incidentTitle),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate and refetch incidents for this employee
        queryClient.invalidateQueries({ 
          queryKey: ['employee-incidents', variables.employeeId] 
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
export function useRemoveIncidentAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      incidentId, 
      employeeId 
    }: { 
      incidentId: string; 
      employeeId: string; 
    }) => IncidentService.removeAttachment(incidentId),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate and refetch incidents for this employee
        queryClient.invalidateQueries({ 
          queryKey: ['employee-incidents', variables.employeeId] 
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
