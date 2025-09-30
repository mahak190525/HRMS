import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complaintsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useComplaintCategories() {
  return useQuery({
    queryKey: ['complaint-categories'],
    queryFn: complaintsApi.getComplaintCategories,
  });
}

export function useComplaints() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['complaints', user?.id],
    queryFn: () => complaintsApi.getComplaints(user!.id),
    enabled: !!user?.id,
  });
}

export function useCreateComplaint() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: complaintsApi.createComplaint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints', user?.id] });
      toast.success('Complaint submitted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to submit complaint');
      console.error('Complaint error:', error);
    },
  });
}