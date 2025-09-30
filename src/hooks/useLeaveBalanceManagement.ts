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
        comments?: string;
      };
    }) => leaveApi.updateLeaveBalance(balanceId, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances'] });
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
