import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/services/supabase';
import { getCurrentISTTimestamp, isPastDate } from '@/utils/dateUtils';

export function useLeaveTypes() {
  return useQuery({
    queryKey: ['leave-types'],
    queryFn: leaveApi.getLeaveTypes,
  });
}

export function useLeaveBalance() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['leave-balance', user?.id],
    queryFn: () => leaveApi.getLeaveBalance(user!.id),
    enabled: !!user?.id,
  });
}

export function useLeaveApplications() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['leave-applications', user?.id],
    queryFn: () => leaveApi.getLeaveApplications(user!.id),
    enabled: !!user?.id,
  });
}

export function useCreateLeaveApplication() {
  const queryClient = useQueryClient();
  const { user, refreshUserRoles } = useAuth();
  
  return useMutation({
    mutationFn: leaveApi.createLeaveApplication,
    onSuccess: () => {
      // Invalidate employee-side leave applications
      queryClient.invalidateQueries({ queryKey: ['leave-applications', user?.id] });
      // Invalidate manager/HR-side leave applications so they see new applications immediately
      queryClient.invalidateQueries({ queryKey: ['all-leave-applications'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['employees-on-leave'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user?.id] });
      
      // Refresh user data to ensure comp_off_balance is up to date
      refreshUserRoles().catch(console.error);
      
      toast.success('Leave application submitted successfully!');
    },
    onError: (error: any) => {
      // Check if it's the specific email function error
      if (error?.code === '42883' && error?.message?.includes('send_leave_email_notification')) {
        toast.success('Leave application submitted successfully! (Email notification system needs database update)');
        console.warn('Leave application created but email trigger failed:', error);
        // Still invalidate queries since the leave was likely created successfully
        queryClient.invalidateQueries({ queryKey: ['leave-applications', user?.id] });
        // Invalidate manager/HR-side leave applications
        queryClient.invalidateQueries({ queryKey: ['all-leave-applications'] });
        queryClient.invalidateQueries({ queryKey: ['leave-balance', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['employees-on-leave'] });
        queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user?.id] });
      } else {
        toast.error('Failed to submit leave application');
        console.error('Leave application error:', error);
      }
    },
  });
}

export function useWithdrawLeaveApplication() {
  const queryClient = useQueryClient();
  const { user, refreshUserRoles } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      applicationId, 
      reason 
    }: { 
      applicationId: string; 
      reason: string; 
    }) => {
      if (!user) throw new Error('User not authenticated');
      
      // First, get the leave application to check ownership and current status
      const { data: application, error: appError } = await supabase
        .from('leave_applications')
        .select('*')
        .eq('id', applicationId)
        .single();
      
      if (appError) throw appError;
      
      // Check if user owns this application or has admin/hr/manager privileges
      const { data: currentUser, error: userError } = await supabase
        .from('users')
        .select('id, "isSA", role:roles(name)')
        .eq('id', user.id)
        .single();
      
      if (userError) throw userError;
      
      const userRole = currentUser.role?.name || '';
      const isAdmin = currentUser.isSA || userRole === 'admin' || userRole === 'super_admin';
      const isHR = userRole === 'hr';
      const isOwner = application.user_id === user.id;
      
      // Check if current user is the manager of the application user
      const { data: applicationUser, error: appUserError } = await supabase
        .from('users')
        .select('manager_id')
        .eq('id', application.user_id)
        .single();
      
      if (appUserError) throw appUserError;
      
      const isManager = applicationUser.manager_id === user.id;
      
      if (!isOwner && !isAdmin && !isHR && !isManager) {
        throw new Error('You can only withdraw your own leave applications or applications of your team members if you are a manager/HR/admin');
      }
      
      // Check if application can be withdrawn (pending or approved)
      if (!['pending', 'approved'].includes(application.status)) {
        console.log('Status discrepancy:', { user_id: application.user_id, status: application.status });
        throw new Error(`Only pending or approved leave applications can be withdrawn`);
      }
      
      // Check if the leave is in the past (cannot withdraw past leaves)
      // Check if the leave start date is in the future (using IST)
      if (isPastDate(application.start_date)) {
        throw new Error('Cannot withdraw leave applications that have already started or are in the past');
      }
      
      // Re-check status right before update to prevent race conditions
      // This ensures the status hasn't changed between the check and the update
      const { data: currentApplication, error: currentAppError } = await supabase
        .from('leave_applications')
        .select('status, user_id')
        .eq('id', applicationId)
        .single();
      
      if (currentAppError) throw currentAppError;
      
      // Final status check right before update
      if (!['pending', 'approved'].includes(currentApplication.status)) {
        console.log('Status discrepancy:', { user_id: currentApplication.user_id || application.user_id, status: currentApplication.status });
        throw new Error(`This leave application is ${currentApplication.status} and cannot be withdrawn`);
      }
      
      // Update the leave application status to 'withdrawn'
      // Use optimistic locking: only update if status is still 'pending' or 'approved'
      const { data: updatedData, error: updateError } = await supabase
        .from('leave_applications')
        .update({
          status: 'withdrawn',
          withdrawn_at: getCurrentISTTimestamp(),
          withdrawn_by: user.id,
          withdrawal_reason: reason,
          updated_at: getCurrentISTTimestamp()
        })
        .eq('id', applicationId)
        .in('status', ['pending', 'approved']) // Only update if status is still pending or approved
        .select();
      
      if (updateError) {
        // Check if it's the email function error, but still allow withdrawal
        if (updateError.code === '42883' && updateError.message?.includes('send_leave_email_notification')) {
          console.warn('Leave withdrawn successfully but email trigger failed:', updateError);
          // Continue execution - the withdrawal was successful
        } else {
          throw updateError;
        }
      }
      
      // Check if update actually affected any rows (optimistic locking check)
      if (!updatedData || updatedData.length === 0) {
        // Status must have changed between our check and the update
        // Re-fetch to see current status and provide accurate error message
        const { data: latestApplication } = await supabase
          .from('leave_applications')
          .select('status, user_id')
          .eq('id', applicationId)
          .single();
        
        if (latestApplication) {
          console.log('Status discrepancy:', { user_id: latestApplication.user_id, status: latestApplication.status });
          
          if (latestApplication.status === 'withdrawn') {
            throw new Error('This leave application has already been withdrawn');
          }
          if (!['pending', 'approved'].includes(latestApplication.status)) {
            throw new Error(`Cannot withdraw: This leave application is now ${latestApplication.status}`);
          }
        }
        
        throw new Error('Failed to withdraw leave application: Status may have changed');
      }
      
      // Create a withdrawal log entry
      const { error: logError } = await supabase
        .from('leave_withdrawal_logs')
        .insert({
          leave_application_id: applicationId,
          withdrawn_by: user.id,
          withdrawal_reason: reason,
          previous_status: application.status,
          withdrawn_at: getCurrentISTTimestamp()
        });
      
      if (logError) {
        console.warn('Failed to create withdrawal log:', logError);
        // Don't throw error here as the main operation succeeded
      }
      
      return { applicationId, previousStatus: application.status, userId: application.user_id };
    },
    onSuccess: (data) => {
      // Invalidate with specific user ID if available
      if (data.userId) {
        queryClient.invalidateQueries({ queryKey: ['leave-applications', data.userId] });
        queryClient.invalidateQueries({ queryKey: ['leave-balance', data.userId] });
        queryClient.invalidateQueries({ queryKey: ['user-leave-summary', data.userId] });
      }
      
      // Also invalidate all queries (for broader coverage)
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] });
      queryClient.invalidateQueries({ queryKey: ['all-leave-applications'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
      queryClient.invalidateQueries({ queryKey: ['employees-on-leave'] });
      queryClient.invalidateQueries({ queryKey: ['user-leave-summary'] });
      
      // Refresh user data to get updated comp_off_balance if it was restored
      refreshUserRoles().catch(console.error);
      
      toast.success('Leave application withdrawn successfully!');
    },
    onError: (error: any) => {
      // Check if it's the specific email function error
      if (error?.code === '42883' && error?.message?.includes('send_leave_email_notification')) {
        toast.success('Leave application withdrawn successfully! (Email notification system needs database update)');
        console.warn('Leave withdrawal completed but email trigger failed:', error);
        // Still invalidate queries since the withdrawal was likely successful
        queryClient.invalidateQueries({ queryKey: ['leave-applications'] });
        queryClient.invalidateQueries({ queryKey: ['all-leave-applications'] });
        queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
        queryClient.invalidateQueries({ queryKey: ['employees-on-leave'] });
        queryClient.invalidateQueries({ queryKey: ['user-leave-summary'] });
      } else {
        toast.error(`Failed to withdraw leave application: ${error.message || 'Unknown error'}`);
        console.error('Leave withdrawal error:', error);
      }
    },
  });
}

export function useEmployeesOnLeave(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['employees-on-leave', startDate, endDate],
    queryFn: () => leaveApi.getEmployeesOnLeave(startDate, endDate),
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

export function useUserLeaveSummary() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-leave-summary', user?.id],
    queryFn: () => leaveApi.getUserLeaveSummary(user!.id),
    enabled: !!user?.id,
  });
}

export function useRecalculateUserBalance() {
  const queryClient = useQueryClient();
  const { user, refreshUserRoles } = useAuth();
  
  return useMutation({
    mutationFn: (userId?: string) => leaveApi.recalculateUserBalance(userId || user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-balance', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['user-leave-summary', user?.id] });
      // Refresh user data to get updated comp_off_balance if it changed
      refreshUserRoles().catch(console.error);
      toast.success('Leave balance recalculated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to recalculate leave balance');
      console.error('Leave balance recalculation error:', error);
    },
  });
}

export function useLeaveWithdrawalLogs(applicationId?: string) {
  return useQuery({
    queryKey: ['leave-withdrawal-logs', applicationId],
    queryFn: async () => {
      const query = supabase
        .from('leave_withdrawal_logs')
        .select(`
          *,
          leave_application:leave_applications!leave_application_id(
            id,
            start_date,
            end_date,
            days_count,
            user:users!user_id(id, full_name, employee_id, manager_id),
            leave_type:leave_types!leave_type_id(name)
          ),
          withdrawn_by_user:users!withdrawn_by(full_name, email)
        `)
        .order('withdrawn_at', { ascending: false });
      
      if (applicationId) {
        query.eq('leave_application_id', applicationId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
    enabled: true,
  });
}

// Automatic leave maintenance has been removed
// HR now manages leave allocations manually once a year