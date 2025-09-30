import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { referralsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useJobPositions() {
  return useQuery({
    queryKey: ['job-positions'],
    queryFn: referralsApi.getJobPositions,
  });
}

export function useReferrals() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['referrals', user?.id],
    queryFn: () => referralsApi.getReferrals(user!.id),
    enabled: !!user?.id,
  });
}

export function useCreateReferral() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: referralsApi.createReferral,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referrals', user?.id] });
      toast.success('Referral submitted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to submit referral');
      console.error('Referral error:', error);
    },
  });
}

export function useCreateReferralWithResume() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ referralData, resumeFile }: { 
      referralData: any, 
      resumeFile?: File 
    }) => referralsApi.createReferralWithResume(referralData, resumeFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referrals', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['all-referrals'] });
      toast.success('Referral with resume submitted successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to submit referral');
      console.error('Referral with resume error:', error);
    },
  });
}

export function useUpdateReferralResume() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ id, resumeFile, candidateName }: { 
      id: string, 
      resumeFile: File, 
      candidateName: string 
    }) => referralsApi.updateReferralResume(id, resumeFile, candidateName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referrals', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['all-referrals'] });
      toast.success('Resume updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update resume');
      console.error('Resume update error:', error);
    },
  });
}
