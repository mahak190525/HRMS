import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Hook to get all employees' leave balances
export function useAllEmployeesLeaveBalances(year?: number) {
  return useQuery({
    queryKey: ['all-employees-leave-balances', year],
    queryFn: () => leaveApi.getAllEmployeesLeaveBalances(year),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to get all employees' leave balances with manager information for role-based filtering
export function useAllEmployeesLeaveBalancesWithManager(year?: number) {
  return useQuery({
    queryKey: ['all-employees-leave-balances-with-manager', year],
    queryFn: () => leaveApi.getAllEmployeesLeaveBalancesWithManager(year),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to manually update a leave balance
export function useUpdateLeaveBalance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ balanceId, updates }: {
      balanceId: string;
      updates: {
        allocated_days?: number;
        used_days?: number;
        rate_of_leave?: number;
        comments?: string;
      };
    }) => leaveApi.updateLeaveBalance(balanceId, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances-with-manager'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance', data.user.id] });
      queryClient.invalidateQueries({ queryKey: ['user-leave-summary', data.user.id] });
      toast.success(`Leave balance updated for ${data.user.full_name}`);
    },
    onError: (error) => {
      toast.error('Failed to update leave balance');
      console.error('Leave balance update error:', error);
    },
  });
}

// Hook to adjust leave balance (add/subtract with reason)
export function useAdjustLeaveBalance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ userId, adjustment }: {
      userId: string;
      adjustment: {
        type: 'add' | 'subtract';
        amount: number;
        reason: string;
        year?: number;
      };
    }) => leaveApi.adjustLeaveBalance(userId, adjustment, user?.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance', data.user.id] });
      queryClient.invalidateQueries({ queryKey: ['user-leave-summary', data.user.id] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance-adjustments'] });
      
      const action = data.allocated_days > data.carry_forward_from_previous_year ? 'increased' : 'decreased';
      toast.success(`Leave balance ${action} for ${data.user.full_name}`);
    },
    onError: (error) => {
      toast.error('Failed to adjust leave balance');
      console.error('Leave balance adjustment error:', error);
    },
  });
}

// Hook to adjust comp off balance (add/subtract with reason)
export function useAdjustCompOffBalance() {
  const queryClient = useQueryClient();
  const { user, refreshUserRoles } = useAuth();
  
  return useMutation({
    mutationFn: ({ userId, adjustment }: {
      userId: string;
      adjustment: {
        type: 'add' | 'subtract';
        amount: number;
        reason: string;
      };
    }) => leaveApi.adjustCompOffBalance(userId, adjustment, user?.id),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances-with-manager'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance-adjustments'] });
      
      // If adjusting own balance, refresh user data to get updated comp_off_balance
      if (user?.id === variables.userId) {
        refreshUserRoles().catch(console.error);
      }
      
      toast.success(`Comp off balance ${variables.adjustment.type === 'add' ? 'increased' : 'decreased'} for ${data.full_name}`);
    },
    onError: (error) => {
      toast.error('Failed to adjust comp off balance');
      console.error('Comp off balance adjustment error:', error);
    },
  });
}

// Hook to create a new leave balance for a user
export function useCreateLeaveBalance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, leaveTypeId, allocatedDays, year }: {
      userId: string;
      leaveTypeId: string;
      allocatedDays: number;
      year?: number;
    }) => leaveApi.createLeaveBalanceForUser(userId, leaveTypeId, allocatedDays, year),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance', data.user.id] });
      queryClient.invalidateQueries({ queryKey: ['user-leave-summary', data.user.id] });
      toast.success(`Leave balance created for ${data.user.full_name}`);
    },
    onError: (error) => {
      toast.error('Failed to create leave balance');
      console.error('Leave balance creation error:', error);
    },
  });
}

// Hook to get leave balance adjustments (audit trail)
export function useLeaveBalanceAdjustments(userId?: string, limit?: number) {
  return useQuery({
    queryKey: ['leave-balance-adjustments', userId, limit],
    queryFn: () => leaveApi.getLeaveBalanceAdjustments(userId, limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to recalculate balance for specific user
export function useRecalculateSpecificUserBalance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userId: string) => leaveApi.recalculateUserBalance(userId),
    onSuccess: (data, userId) => {
      queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance', userId] });
      queryClient.invalidateQueries({ queryKey: ['user-leave-summary', userId] });
      
      if (data.success) {
        toast.success(`Leave balance recalculated for ${data.user?.full_name}`);
      } else {
        toast.error(data.error || 'Failed to recalculate balance');
      }
    },
    onError: (error) => {
      toast.error('Failed to recalculate leave balance');
      console.error('Leave balance recalculation error:', error);
    },
  });
}

// Automatic system-wide leave maintenance has been removed
// HR now manages leave allocations manually once a year

// Hook to get cron settings
export function useCronSettings() {
  return useQuery({
    queryKey: ['leave-cron-settings'],
    queryFn: () => leaveApi.getCronSettings(),
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchInterval: 30000, // Automatically refetch every 30 seconds to get updated last_run_at and next_run_at
    refetchIntervalInBackground: true, // Continue refetching even when tab is in background
  });
}

// Hook to create or update cron settings
export function useCreateOrUpdateCronSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: (settings: {
      cron_schedule: string;
      end_date: string;
      is_active?: boolean;
    }) => leaveApi.createOrUpdateCronSettings(settings, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-cron-settings'] });
      toast.success('Cron settings updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update cron settings');
      console.error('Cron settings update error:', error);
    },
  });
}

// Hook to trigger monthly allocation manually
export function useTriggerMonthlyAllocation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => leaveApi.triggerMonthlyAllocation(),
    onSuccess: (data) => {
      // Invalidate all leave balance related queries to fetch latest data
      queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances-with-manager'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['leave-cron-settings'] }); // Invalidate cron settings to refresh last_run_at and next_run_at
      
      // Also invalidate user-specific queries
      queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
      queryClient.invalidateQueries({ queryKey: ['user-leave-summary'] });
      
      // Refetch the data immediately
      queryClient.refetchQueries({ queryKey: ['all-employees-leave-balances'] });
      queryClient.refetchQueries({ queryKey: ['all-employees-leave-balances-with-manager'] });
      queryClient.refetchQueries({ queryKey: ['leave-cron-settings'] }); // Refetch cron settings to get updated timestamps
      
      const successCount = data?.filter((r: any) => r.success).length || 0;
      const failureCount = data?.filter((r: any) => r.success === false).length || 0;
      
      if (successCount > 0) {
        toast.success(`Monthly allocation completed. ${successCount} employee${successCount > 1 ? 's' : ''} processed successfully.${failureCount > 0 ? ` ${failureCount} failed.` : ''}`);
      } else if (failureCount > 0) {
        toast.error(`Monthly allocation failed for ${failureCount} employee${failureCount > 1 ? 's' : ''}.`);
      } else {
        toast.info('No employees found with rate_of_leave > 0 to process.');
      }
    },
    onError: (error) => {
      toast.error('Failed to trigger monthly allocation');
      console.error('Monthly allocation error:', error);
    },
  });
}

// Hook to manage the pg_cron job
export function useManageCronJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => leaveApi.manageCronJob(),
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ['leave-cron-settings'] });
      queryClient.refetchQueries({ queryKey: ['leave-cron-settings'] }); // Refetch to get updated next_run_at
      if (message?.startsWith('SUCCESS')) {
        toast.success(message);
      } else if (message?.startsWith('ERROR')) {
        toast.error(message);
      } else {
        toast.info(message);
      }
    },
    onError: (error) => {
      toast.error('Failed to manage cron job');
      console.error('Cron job management error:', error);
    },
  });
}
