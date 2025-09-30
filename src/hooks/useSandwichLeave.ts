import { useQuery, useMutation } from '@tanstack/react-query';
import { leaveApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export interface SandwichLeaveCalculation {
  actual_days: number;
  deducted_days: number;
  is_sandwich_leave: boolean;
  reason: string;
  details: {
    total_days: number;
    working_days: number;
    weekend_days: number;
    holiday_days: number;
    sandwich_days: number;
    has_separate_applications?: boolean;
    separate_app_info?: string;
    business_rules?: {
      continuous_fri_mon: string;
      separate_fri_mon: string;
      single_approved: string;
      single_unapproved: string;
      holidays_excluded: string;
    };
  };
}

export interface RelatedApplication {
  related_app_id: string;
  related_start_date: string;
  related_end_date: string;
  related_status: string;
  relationship_type: string;
  combined_deduction: number;
}

// Hook to preview sandwich leave calculation before application
export function useSandwichLeavePreview() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      startDate,
      endDate,
      isHalfDay = false,
    }: {
      startDate: string;
      endDate: string;
      isHalfDay?: boolean;
    }): Promise<SandwichLeaveCalculation | null> => {
      if (!user) throw new Error('User not authenticated');
      
      return leaveApi.previewSandwichLeaveCalculation(
        user.id,
        startDate,
        endDate,
        isHalfDay
      );
    },
  });
}

// Hook to find related Friday/Monday applications
export function useRelatedFridayMondayApplications() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      startDate,
      endDate,
    }: {
      startDate: string;
      endDate: string;
    }): Promise<RelatedApplication[]> => {
      if (!user) throw new Error('User not authenticated');
      
      return leaveApi.findRelatedFridayMondayApplications(
        user.id,
        startDate,
        endDate
      );
    },
  });
}

// Hook to recalculate all approved leave balances
export function useRecalculateAllApprovedLeaveBalances() {
  return useMutation({
    mutationFn: () => leaveApi.recalculateAllApprovedLeaveBalances(),
  });
}

// Hook to get all holidays for a year
export function useHolidays(year?: number) {
  return useQuery({
    queryKey: ['holidays', year],
    queryFn: () => leaveApi.getAllHolidays(year),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

