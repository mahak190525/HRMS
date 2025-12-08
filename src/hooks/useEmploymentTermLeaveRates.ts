import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface EmploymentTermLeaveRate {
  id: string;
  employment_term: 'full_time' | 'part_time' | 'associate' | 'contract' | 'probation/internship';
  leave_rate: number;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

// Hook to fetch all employment terms from users table
export function useEmploymentTerms() {
  return useQuery({
    queryKey: ['employment-terms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('employment_terms')
        .not('employment_terms', 'is', null);

      if (error) throw error;

      // Get unique employment terms
      const uniqueTerms = Array.from(
        new Set(
          data
            ?.map((user) => user.employment_terms)
            .filter((term): term is string => !!term)
        )
      ) as Array<'full_time' | 'part_time' | 'associate' | 'contract' | 'probation/internship'>;

      return uniqueTerms.sort();
    },
  });
}

// Hook to fetch all employment term leave rates
export function useEmploymentTermLeaveRates() {
  return useQuery({
    queryKey: ['employment-term-leave-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employment_term_leave_rates')
        .select('*')
        .order('employment_term');

      if (error) throw error;
      return (data as EmploymentTermLeaveRate[]) || [];
    },
  });
}

// Hook to update employment term leave rate
export function useUpdateEmploymentTermLeaveRate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      employment_term,
      leave_rate,
      description,
    }: {
      employment_term: string;
      leave_rate: number;
      description?: string;
    }) => {
      // Check if record exists
      const { data: existing } = await supabase
        .from('employment_term_leave_rates')
        .select('id')
        .eq('employment_term', employment_term)
        .single();

      if (existing) {
        // Update existing record
        const { data, error } = await supabase
          .from('employment_term_leave_rates')
          .update({
            leave_rate,
            description,
            updated_by: user?.id,
            updated_at: new Date().toISOString(),
          })
          .eq('employment_term', employment_term)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new record
        const { data, error } = await supabase
          .from('employment_term_leave_rates')
          .insert({
            employment_term,
            leave_rate,
            description,
            created_by: user?.id,
            updated_by: user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employment-term-leave-rates'] });
      // Invalidate leave balances to refresh the Employee Leave Balances page
      queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances-with-manager'] });
      toast.success('Leave rate updated successfully!');
    },
    onError: (error: any) => {
      toast.error('Failed to update leave rate');
      console.error('Error updating leave rate:', error);
    },
  });
}

// Hook to update multiple leave rates at once
export function useUpdateMultipleLeaveRates() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (
      rates: Array<{
        employment_term: string;
        leave_rate: number;
        description?: string;
      }>
    ) => {
      const updates = rates.map((rate) => ({
        ...rate,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      }));

      // Use upsert to update or insert
      const { data, error } = await supabase
        .from('employment_term_leave_rates')
        .upsert(updates, {
          onConflict: 'employment_term',
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employment-term-leave-rates'] });
      // Invalidate leave balances to refresh the Employee Leave Balances page
      queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances-with-manager'] });
      toast.success('Leave rates updated successfully!');
    },
    onError: (error: any) => {
      toast.error('Failed to update leave rates');
      console.error('Error updating leave rates:', error);
    },
  });
}

