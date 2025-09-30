import { useQuery } from '@tanstack/react-query';
import { dashboardApi, timeTrackingApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export function useDashboardStats() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: () => dashboardApi.getDashboardStats(user!.id),
    enabled: !!user?.id,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

export function useUpcomingHolidays() {
  return useQuery({
    queryKey: ['upcoming-holidays'],
    queryFn: dashboardApi.getUpcomingHolidays,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

export function useTodayTimeEntries() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['today-time-entries', user?.id],
    queryFn: () => timeTrackingApi.getTodayTimeEntries(user!.id),
    enabled: !!user?.id,
  });
}