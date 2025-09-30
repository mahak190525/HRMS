import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lmsApi } from '@/services/lmsApi';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Dashboard hooks
export function useLMSDashboardStats() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['lms-dashboard-stats', user?.id],
    queryFn: () => lmsApi.getDashboardStats(user!.id),
    enabled: !!user?.id,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

// Module hooks
export function useUserModules() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-modules', user?.id],
    queryFn: () => lmsApi.getUserModules(user!.id),
    enabled: !!user?.id,
  });
}

export function useModuleById(moduleId: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['module', moduleId, user?.id],
    queryFn: () => lmsApi.getModuleById(moduleId, user!.id),
    enabled: !!moduleId && !!user?.id,
  });
}

export function useUpdateModuleProgress() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ moduleId, progressData }: { moduleId: string; progressData: any }) =>
      lmsApi.updateModuleProgress(user!.id, moduleId, progressData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-modules', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['lms-dashboard-stats', user?.id] });
      toast.success('Progress updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update progress');
      console.error('Module progress error:', error);
    },
  });
}

// Quiz hooks
export function useQuizById(quizId: string) {
  return useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => lmsApi.getQuizById(quizId),
    enabled: !!quizId,
  });
}

export function useUserQuizAttempts(quizId: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['quiz-attempts', user?.id, quizId],
    queryFn: () => lmsApi.getUserQuizAttempts(user!.id, quizId),
    enabled: !!user?.id && !!quizId,
  });
}

export function useSubmitQuizAttempt() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: lmsApi.submitQuizAttempt,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quiz-attempts', user?.id, variables.quiz_id] });
      queryClient.invalidateQueries({ queryKey: ['user-modules', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['lms-dashboard-stats', user?.id] });
      toast.success('Quiz submitted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to submit quiz');
      console.error('Quiz submission error:', error);
    },
  });
}

// Document hooks
export function useDocumentRequirements() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['document-requirements', user?.id],
    queryFn: () => lmsApi.getDocumentRequirements(user!.id),
    enabled: !!user?.id,
  });
}

export function useUserDocuments() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-documents', user?.id],
    queryFn: () => lmsApi.getUserDocuments(user!.id),
    enabled: !!user?.id,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: lmsApi.uploadDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-documents', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['document-requirements', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['lms-dashboard-stats', user?.id] });
      toast.success('Document uploaded successfully!');
    },
    onError: (error) => {
      toast.error('Failed to upload document');
      console.error('Document upload error:', error);
    },
  });
}

// Manager/HR hooks
export function useAllCandidatesProgress() {
  return useQuery({
    queryKey: ['all-candidates-progress'],
    queryFn: lmsApi.getAllCandidatesProgress,
  });
}

export function useCandidateProgress(userId: string) {
  return useQuery({
    queryKey: ['candidate-progress', userId],
    queryFn: () => lmsApi.getCandidateProgress(userId),
    enabled: !!userId,
  });
}

export function useUpdateDocumentStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ documentId, status, reviewComments, reviewedBy }: {
      documentId: string;
      status: string;
      reviewComments?: string;
      reviewedBy?: string;
    }) => lmsApi.updateDocumentStatus(documentId, status, reviewComments, reviewedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-candidates-progress'] });
      queryClient.invalidateQueries({ queryKey: ['candidate-progress'] });
      toast.success('Document status updated!');
    },
    onError: (error) => {
      toast.error('Failed to update document status');
      console.error('Document status update error:', error);
    },
  });
}

// Module Management (HR)
export function useAllModules() {
  return useQuery({
    queryKey: ['all-modules'],
    queryFn: lmsApi.getAllModules,
  });
}

export function useCreateModule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: lmsApi.createModule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-modules'] });
      toast.success('Module created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create module');
      console.error('Module creation error:', error);
    },
  });
}

export function useUpdateModule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ moduleId, updates }: { moduleId: string; updates: any }) =>
      lmsApi.updateModule(moduleId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-modules'] });
      toast.success('Module updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update module');
      console.error('Module update error:', error);
    },
  });
}

export function useDeleteModule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: lmsApi.deleteModule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-modules'] });
      toast.success('Module archived successfully!');
    },
    onError: (error) => {
      toast.error('Failed to archive module');
      console.error('Module deletion error:', error);
    },
  });
}

export function useInitializeUserModules() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: lmsApi.initializeUserModules,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-modules'] });
      toast.success('Modules initialized successfully!');
    },
    onError: (error) => {
      toast.error('Failed to initialize modules');
      console.error('Module initialization error:', error);
    },
  });
}

export function useLMSMetrics() {
  return useQuery({
    queryKey: ['lms-metrics'],
    queryFn: lmsApi.getLMSMetrics,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}