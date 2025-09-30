import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { performanceApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function usePerformanceGoals() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['performance-goals', user?.id],
    queryFn: () => performanceApi.getPerformanceGoals(user!.id),
    enabled: !!user?.id,
  });
}

export function useUpdateGoalProgress() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ goalId, progress }: { goalId: string; progress: number }) =>
      performanceApi.updateGoalProgress(goalId, progress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-goals', user?.id] });
      toast.success('Goal progress updated!');
    },
    onError: () => {
      toast.error('Failed to update goal progress');
    },
  });
}

export function usePerformanceEvaluations() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['performance-evaluations', user?.id],
    queryFn: () => performanceApi.getPerformanceEvaluations(user!.id),
    enabled: !!user?.id,
  });
}

export function usePerformanceAppraisals() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['performance-appraisals', user?.id],
    queryFn: () => performanceApi.getPerformanceAppraisals(user!.id),
    enabled: !!user?.id,
  });
}

export function usePerformanceFeedback() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['performance-feedback', user?.id],
    queryFn: () => performanceApi.getPerformanceFeedback(user!.id),
    enabled: !!user?.id,
  });
}