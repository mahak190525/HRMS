import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { grievanceApi } from '@/services/api';
import { toast } from 'sonner';

export function useAllComplaints() {
  return useQuery({
    queryKey: ['all-complaints'],
    queryFn: grievanceApi.getAllComplaints,
  });
}

export function useComplaintCategories() {
  return useQuery({
    queryKey: ['complaint-categories'],
    queryFn: grievanceApi.getComplaintCategories,
  });
}

export function useResolverOptions() {
  return useQuery({
    queryKey: ['resolver-options'],
    queryFn: grievanceApi.getResolverOptions,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useApproveComplaint() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, assigned_to, approvedBy }: { 
      id: string; 
      assigned_to: string; 
      approvedBy: string; 
    }) =>
      grievanceApi.approveComplaint(id, assigned_to, approvedBy),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['all-complaints'] });
      
      // Invalidate notifications for the assigned resolver
      queryClient.invalidateQueries({ queryKey: ['notifications', variables.assigned_to] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', variables.assigned_to] });
      
      toast.success('Complaint approved and assigned successfully!');
    },
    onError: (error) => {
      toast.error('Failed to approve complaint');
      console.error('Complaint approval error:', error);
    },
  });
}

export function useRejectComplaint() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, rejectedBy, reason }: { 
      id: string; 
      rejectedBy: string; 
      reason?: string; 
    }) =>
      grievanceApi.rejectComplaint(id, rejectedBy, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-complaints'] });
      toast.success('Complaint rejected successfully!');
    },
    onError: (error) => {
      toast.error('Failed to reject complaint');
      console.error('Complaint rejection error:', error);
    },
  });
}

export function useReassignComplaint() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, new_assigned_to, reassignedBy, reason }: { 
      id: string; 
      new_assigned_to: string; 
      reassignedBy: string; 
      reason?: string; 
    }) =>
      grievanceApi.reassignComplaint(id, new_assigned_to, reassignedBy, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-complaints'] });
      toast.success('Complaint reassigned successfully!');
    },
    onError: (error) => {
      toast.error('Failed to reassign complaint');
      console.error('Complaint reassignment error:', error);
    },
  });
}

export function useUpdateComplaintStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status, resolution, assigned_to }: { 
      id: string; 
      status: string; 
      resolution?: string; 
      assigned_to?: string; 
    }) =>
      grievanceApi.updateComplaintStatus(id, status, resolution, assigned_to),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-complaints'] });
      toast.success('Complaint status updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update complaint status');
      console.error('Complaint update error:', error);
    },
  });
}

export function useComplaintComments(complaintId: string) {
  return useQuery({
    queryKey: ['complaint-comments', complaintId],
    queryFn: () => grievanceApi.getComplaintComments(complaintId),
    enabled: !!complaintId,
  });
}

export function useCreateComplaintComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: grievanceApi.createComplaintComment,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['complaint-comments', variables.complaint_id] });
      toast.success('Comment added successfully!');
    },
    onError: (error) => {
      toast.error('Failed to add comment');
      console.error('Comment error:', error);
    },
  });
}