import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Helper function to check leave application permissions
export async function checkLeaveApplicationPermissions(userId: string, applicationUserId: string) {
  // Get current user's data to check role and manager status
  const { data: currentUser, error: userError } = await supabase
    .from('users')
    .select('id, "isSA", role:roles(name)')
    .eq('id', userId)
    .single();
  
  if (userError) throw userError;
  
  const userRole = currentUser.role?.name || '';
  const isAdmin = currentUser.isSA || userRole === 'admin' || userRole === 'super_admin';
  const isHR = userRole === 'hr';
  const isFinance = userRole === 'finance' || userRole === 'finance_manager';
  
  // Get the application user's manager info
  const { data: applicationUser, error: appUserError } = await supabase
    .from('users')
    .select('manager_id')
    .eq('id', applicationUserId)
    .single();
  
  if (appUserError) throw appUserError;
  
  // Check if current user is the manager of the application user
  const isManager = applicationUser.manager_id === userId;
  
  console.log('Permission check:', { 
    userId, 
    applicationUserId,
    userRole,
    isAdmin,
    isHR,
    isFinance,
    isManager,
    managerIdFromApp: applicationUser.manager_id 
  });
  
  // NEW RULES: Only manager, HR, finance, and admin roles can approve/reject/edit leave applications
  // 1. ADMIN/SUPER_ADMIN have ALL permissions (highest priority)
  if (isAdmin) {
    return { canView: true, canEdit: true, reason: 'admin' };
  }
  
  // 2. HR can EDIT all applications
  if (isHR) {
    return { canView: true, canEdit: true, reason: 'hr' };
  }
  
  // 3. Finance can EDIT all applications
  if (isFinance) {
    return { canView: true, canEdit: true, reason: 'finance' };
  }
  
  // 4. Managers can EDIT applications of their direct reports
  if (isManager) {
    return { canView: true, canEdit: true, reason: 'manager' };
  }
  
  // No access for other users
  return { canView: false, canEdit: false, reason: 'no_access' };
}

// Hook for HR/Managers to manage leave applications
export function useAllLeaveApplications() {
  const { user } = useAuth();
  
  console.log('useAllLeaveApplications called with user:', user?.id);
  
  return useQuery({
    queryKey: ['all-leave-applications', user?.id],
    queryFn: async () => {
      console.log('useAllLeaveApplications queryFn executing...');
      if (!user) throw new Error('User not authenticated');
      
      // Get current user's data to check role and manager status
      const { data: currentUser, error: userError } = await supabase
        .from('users')
        .select('id, role:roles(name)')
        .eq('id', user.id)
        .single();
      
      if (userError) throw userError;
      
      // Check if current user is admin/super_admin/hr/finance
      const userRole = currentUser.role?.name || '';
      const isAdmin = userRole === 'admin' || userRole === 'super_admin';
      const isHR = userRole === 'hr';
      const isFinance = userRole === 'finance' || userRole === 'finance_manager';
      
      console.log('View permissions:', { 
        userId: user.id, 
        userRole,
        isAdmin,
        isHR,
        isFinance
      });
      
      // Admin, HR, and Finance can view ALL applications
      if (isAdmin || isHR || isFinance) {
        const { data, error } = await supabase
          .rpc('get_leave_applications_with_manager_details');
        
        if (error) throw error;
        
        // Transform the data to match the expected structure
        return data?.map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          leave_type_id: row.leave_type_id,
          start_date: row.start_date,
          end_date: row.end_date,
          days_count: row.days_count,
          reason: row.reason,
          status: row.status,
          applied_at: row.applied_at,
          approved_by: row.approved_by,
          approved_at: row.approved_at,
          comments: row.comments,
          created_at: row.created_at,
          updated_at: row.updated_at,
          user: {
            id: row.user_id,
            full_name: row.user_full_name,
            employee_id: row.user_employee_id,
            email: row.user_email,
            manager_id: row.user_manager_id,
            manager: row.manager_id ? {
              id: row.manager_id,
              full_name: row.manager_full_name,
              email: row.manager_email
            } : null
          },
          leave_type: {
            name: row.leave_type_name,
            description: row.leave_type_description
          },
          approved_by_user: row.approved_by_full_name ? {
            id: row.approved_by,
            full_name: row.approved_by_full_name,
            email: row.approved_by_email
          } : null
        })) || [];
      }
      
      // Check if user is a manager - they can only view applications of their direct reports
      const { data: directReports, error: reportsError } = await supabase
        .from('users')
        .select('id')
        .eq('manager_id', user.id);
      
      if (reportsError) throw reportsError;
      
      const directReportIds = directReports?.map(report => report.id) || [];
      
      // If user has direct reports, they can view their applications
      if (directReportIds.length > 0) {
        const { data, error } = await supabase
          .rpc('get_leave_applications_for_manager', { manager_user_id: user.id });
        
        if (error) throw error;
        
        // Transform the data to match the expected structure
        return data?.map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          leave_type_id: row.leave_type_id,
          start_date: row.start_date,
          end_date: row.end_date,
          days_count: row.days_count,
          reason: row.reason,
          status: row.status,
          applied_at: row.applied_at,
          approved_by: row.approved_by,
          approved_at: row.approved_at,
          comments: row.comments,
          created_at: row.created_at,
          updated_at: row.updated_at,
          user: {
            id: row.user_id,
            full_name: row.user_full_name,
            employee_id: row.user_employee_id,
            email: row.user_email,
            manager_id: row.user_manager_id,
            manager: row.manager_id ? {
              id: row.manager_id,
              full_name: row.manager_full_name,
              email: row.manager_email
            } : null
          },
          leave_type: {
            name: row.leave_type_name,
            description: row.leave_type_description
          },
          approved_by_user: row.approved_by_full_name ? {
            id: row.approved_by,
            full_name: row.approved_by_full_name,
            email: row.approved_by_email
          } : null
        })) || [];
      }
      
      // If user doesn't have permission (not admin, HR, or manager), return empty array
      return [];
    },
    enabled: !!user,
  });
}

export function useUpdateLeaveApplicationStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      applicationId, 
      status, 
      comments 
    }: { 
      applicationId: string; 
      status: 'approved' | 'rejected' | 'cancelled'; 
      comments?: string; 
    }) => {
      if (!user) throw new Error('User not authenticated');
      
      // First, get the leave application to check the user_id
      const { data: application, error: appError } = await supabase
        .from('leave_applications')
        .select('user_id')
        .eq('id', applicationId)
        .single();
      
      if (appError) throw appError;
      
      // Check permissions
      const permissions = await checkLeaveApplicationPermissions(user.id, application.user_id);
      
      if (!permissions.canEdit) {
        throw new Error(`Access denied. You cannot edit this leave application. Reason: ${permissions.reason}`);
      }
      
      // Update the leave application
      const { error: updateError } = await supabase
        .from('leave_applications')
        .update({
          status,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          comments: comments || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);
      
      if (updateError) throw updateError;
      
      // Fetch the updated data using our custom function
      const { data, error } = await supabase
        .rpc('get_leave_applications_with_manager_details');
      
      if (error) throw error;
      
      // Find the specific application that was updated
      const updatedApplication = data?.find((row: any) => row.id === applicationId);
      if (!updatedApplication) throw new Error('Updated application not found');
      
      // Transform to expected structure
      const transformedData = {
        id: updatedApplication.id,
        user_id: updatedApplication.user_id,
        leave_type_id: updatedApplication.leave_type_id,
        start_date: updatedApplication.start_date,
        end_date: updatedApplication.end_date,
        days_count: updatedApplication.days_count,
        reason: updatedApplication.reason,
        status: updatedApplication.status,
        applied_at: updatedApplication.applied_at,
        approved_by: updatedApplication.approved_by,
        approved_at: updatedApplication.approved_at,
        comments: updatedApplication.comments,
        created_at: updatedApplication.created_at,
        updated_at: updatedApplication.updated_at,
        user: {
          id: updatedApplication.user_id,
          full_name: updatedApplication.user_full_name,
          employee_id: updatedApplication.user_employee_id,
          email: updatedApplication.user_email,
          manager_id: updatedApplication.user_manager_id,
          manager: updatedApplication.manager_id ? {
            id: updatedApplication.manager_id,
            full_name: updatedApplication.manager_full_name,
            email: updatedApplication.manager_email
          } : null
        },
        leave_type: {
          name: updatedApplication.leave_type_name,
          description: updatedApplication.leave_type_description
        },
        approved_by_user: updatedApplication.approved_by_full_name ? {
          id: updatedApplication.approved_by,
          full_name: updatedApplication.approved_by_full_name,
          email: updatedApplication.approved_by_email
        } : null
      };
      
      return transformedData;
    },
    onSuccess: async(data) => {
      queryClient.invalidateQueries({ queryKey: ['all-leave-applications'] });
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] });
      
      // IMPORTANT: Also invalidate leave balance queries since approval updates balances
      queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance', data.user_id] });
      queryClient.invalidateQueries({ queryKey: ['user-leave-summary', data.user_id] });
      
      // The database trigger will automatically create the notification
      // and send push notification via the edge function
      // Email notifications are also sent automatically by the database trigger
      
      toast.success(`Leave application ${data.status} successfully! Balance updated.`);
    },
    onError: (error) => {
      toast.error('Failed to update leave application');
      console.error('Leave application update error:', error);
    },
  });
}

// Hook to check leave application permissions for UI components
export function useLeaveApplicationPermissions(applicationUserId?: string) {
  const { user } = useAuth();
  
  console.log('useLeaveApplicationPermissions called:', { userId: user?.id, applicationUserId });
  
  return useQuery({
    queryKey: ['leave-permissions', user?.id, applicationUserId],
    queryFn: async () => {
      console.log('useLeaveApplicationPermissions queryFn executing:', { userId: user?.id, applicationUserId });
      if (!user || !applicationUserId) {
        console.log('Missing user or applicationUserId');
        return { canView: false, canEdit: false, reason: 'no_user_or_application' };
      }
      
      return await checkLeaveApplicationPermissions(user.id, applicationUserId);
    },
    enabled: !!user && !!applicationUserId,
  });
}