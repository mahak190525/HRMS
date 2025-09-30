import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { leaveApi } from '@/services/api';
import { toast } from 'sonner';

// Fetch all holidays for a specific year or all available holidays
export function useHolidays(year?: number) {
  return useQuery({
    queryKey: ['holidays', year],
    queryFn: () => leaveApi.getAllHolidays(year),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

// Fetch upcoming holidays (convenience hook)
export function useUpcomingHolidays() {
  return useQuery({
    queryKey: ['upcoming-holidays'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .gte('date', today)
        .order('date')
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

// Create a new holiday
export function useCreateHoliday() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (holidayData: { date: string; name: string; is_optional?: boolean }) =>
      leaveApi.createHoliday(holidayData),
    onSuccess: () => {
      // Invalidate and refetch holidays queries
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-holidays'] });
      toast.success('Holiday created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create holiday');
    },
  });
}

// Delete a holiday
export function useDeleteHoliday() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (holidayId: string) => leaveApi.deleteHoliday(holidayId),
    onSuccess: () => {
      // Invalidate and refetch holidays queries
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-holidays'] });
      toast.success('Holiday deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete holiday');
    },
  });
}

