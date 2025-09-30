import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exitApi, hrExitApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useExitProcess() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['exit-process', user?.id],
    queryFn: () => exitApi.getExitProcess(user!.id),
    enabled: !!user?.id,
  });
}

export function useCreateExitProcess() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: exitApi.createExitProcess,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exit-process', user?.id] });
      toast.success('Resignation submitted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to submit resignation');
      console.error('Resignation error:', error);
    },
  });
}

// HR Exit Management Hooks
export function useAllExitProcesses() {
  return useQuery({
    queryKey: ['all-exit-processes'],
    queryFn: hrExitApi.getAllExitProcesses,
  });
}

export function useExitProcessById(id: string) {
  return useQuery({
    queryKey: ['exit-process', id],
    queryFn: () => hrExitApi.getExitProcessById(id),
    enabled: !!id,
  });
}

export function useUpdateExitProcess() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      hrExitApi.updateExitProcess(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-exit-processes'] });
      queryClient.invalidateQueries({ queryKey: ['exit-process'] });
      toast.success('Exit process updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update exit process');
      console.error('Exit process update error:', error);
    },
  });
}

export function useDeleteExitProcess() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: hrExitApi.deleteExitProcess,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-exit-processes'] });
      toast.success('Exit process deleted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to delete exit process');
      console.error('Exit process deletion error:', error);
    },
  });
}