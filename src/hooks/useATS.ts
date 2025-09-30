import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { atsApi } from '@/services/atsApi';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Dashboard hooks
export function useATSDashboardStats() {
  return useQuery({
    queryKey: ['ats-dashboard-stats'],
    queryFn: atsApi.getDashboardStats,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

// Candidate hooks
export function useAllCandidates() {
  return useQuery({
    queryKey: ['all-candidates'],
    queryFn: atsApi.getAllCandidates,
  });
}

export function useCandidateById(id: string) {
  return useQuery({
    queryKey: ['candidate', id],
    queryFn: () => atsApi.getCandidateById(id),
    enabled: !!id,
  });
}

export function useCreateCandidate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: atsApi.createCandidate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['ats-dashboard-stats'] });
      toast.success('Candidate created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create candidate');
      console.error('Candidate creation error:', error);
    },
  });
}

export function useUpdateCandidate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      atsApi.updateCandidate(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['ats-dashboard-stats'] });
      toast.success('Candidate updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update candidate');
      console.error('Candidate update error:', error);
    },
  });
}

// Interview hooks
export function useInterviews(candidateId?: string) {
  return useQuery({
    queryKey: ['interviews', candidateId],
    queryFn: () => atsApi.getInterviews(candidateId),
    enabled: !!candidateId,
  });
}

export function useMyInterviews() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['my-interviews', user?.id],
    queryFn: () => atsApi.getMyInterviews(user!.id),
    enabled: !!user?.id,
  });
}

export function useCreateInterview() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: atsApi.createInterview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['my-interviews'] });
      toast.success('Interview scheduled successfully!');
    },
    onError: (error) => {
      toast.error('Failed to schedule interview');
      console.error('Interview scheduling error:', error);
    },
  });
}

export function useUpdateInterview() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      atsApi.updateInterview(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['my-interviews'] });
      toast.success('Interview updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update interview');
      console.error('Interview update error:', error);
    },
  });
}

// Assessment hooks
export function useAssessments(candidateId?: string) {
  return useQuery({
    queryKey: ['assessments', candidateId],
    queryFn: () => atsApi.getAssessments(candidateId),
    enabled: !!candidateId,
  });
}

export function useMyAssessments() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['my-assessments', user?.id],
    queryFn: () => atsApi.getMyAssessments(user!.id),
    enabled: !!user?.id,
  });
}

export function useCreateAssessment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: atsApi.createAssessment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['my-assessments'] });
      toast.success('Assessment created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create assessment');
      console.error('Assessment creation error:', error);
    },
  });
}

export function useSubmitAssessment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, answers }: { id: string; answers: any }) =>
      atsApi.submitAssessment(id, answers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['my-assessments'] });
      toast.success('Assessment submitted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to submit assessment');
      console.error('Assessment submission error:', error);
    },
  });
}

// Question Bank hooks
export function useQuestionBank() {
  return useQuery({
    queryKey: ['question-bank'],
    queryFn: atsApi.getQuestionBank,
  });
}

export function useCreateQuestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: atsApi.createQuestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-bank'] });
      toast.success('Question created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create question');
      console.error('Question creation error:', error);
    },
  });
}

export function useUpdateQuestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      atsApi.updateQuestion(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-bank'] });
      toast.success('Question updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update question');
      console.error('Question update error:', error);
    },
  });
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: atsApi.deleteQuestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-bank'] });
      toast.success('Question deleted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to delete question');
      console.error('Question deletion error:', error);
    },
  });
}

// Job Position hooks
export function useJobPositions() {
  return useQuery({
    queryKey: ['job-positions'],
    queryFn: atsApi.getJobPositions,
  });
}

export function useAllJobPositions() {
  return useQuery({
    queryKey: ['all-job-positions'],
    queryFn: atsApi.getAllJobPositions,
  });
}

export function useCreateJobPosition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: atsApi.createJobPosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-job-positions'] });
      queryClient.invalidateQueries({ queryKey: ['job-positions'] });
      toast.success('Job position created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create job position');
      console.error('Job position creation error:', error);
    },
  });
}

export function useUpdateJobPosition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      atsApi.updateJobPosition(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-job-positions'] });
      queryClient.invalidateQueries({ queryKey: ['job-positions'] });
      toast.success('Job position updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update job position');
      console.error('Job position update error:', error);
    },
  });
}

export function useDeleteJobPosition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => atsApi.deleteJobPosition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-job-positions'] });
      queryClient.invalidateQueries({ queryKey: ['job-positions'] });
      toast.success('Job position deleted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to delete job position');
      console.error('Job position deletion error:', error);
    },
  });
}

export function useDepartmentsBasic() {
  return useQuery({
    queryKey: ['departments-basic'],
    queryFn: atsApi.getDepartmentsBasic,
  });
}