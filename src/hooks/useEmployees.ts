import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeApi, assetApi, vmApi, hrReferralsApi, hrExitApi } from '@/services/api';
import { authApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/services/supabase';
import { isUserAdmin, isUserHR, isUserManager, isUserFinance, getAllUserRoleNames } from '@/utils/multipleRoles';

export function useAllEmployees() {
  return useQuery({
    queryKey: ['all-employees'],
    queryFn: employeeApi.getAllEmployees,
  });
}

// Hook for getting employees based on user permissions
export function useFilteredEmployees() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['filtered-employees', user?.id, user?.additional_role_ids],
    queryFn: async () => {
      if (!user) return [];

      // Use multiple role utility functions to check permissions
      const userIsAdmin = isUserAdmin(user);
      const userIsHR = isUserHR(user);
      const userIsManager = isUserManager(user);
      const userIsFinance = isUserFinance(user);
      
      // Get all user roles to check for manager roles
      const userRoles = getAllUserRoleNames(user);
      const isManagerRole = ['sdm', 'bdm', 'qam', 'manager'].some(role => userRoles.includes(role));
      const isFinanceRole = ['finance', 'finance_manager'].some(role => userRoles.includes(role));
      
      // Finance roles should see all employees (view-only access)
      // Managers should only see their team members
      const shouldSeeOnlyTeam = (userIsManager || isManagerRole) && !isFinanceRole;

      console.log('🔍 Employee filtering - User roles:', {
        isAdmin: userIsAdmin,
        isHR: userIsHR,
        isManager: userIsManager,
        isFinance: userIsFinance,
        isManagerRole,
        isFinanceRole,
        shouldSeeOnlyTeam,
        primaryRole: user.role?.name,
        additionalRoles: user.additional_roles?.map(r => r.name)
      });

      // Admin, HR, and Finance roles can see all employees
      if (userIsAdmin || userIsHR || isFinanceRole) {
        console.log('✅ User has admin/HR/Finance access - fetching all employees');
        return employeeApi.getAllEmployees();
      }

      // Managers (excluding Finance roles) can only see their team members
      if (shouldSeeOnlyTeam) {
        console.log('📋 User has manager access - fetching team members only');
        const { data, error } = await supabase
          .from('users')
          .select(`
            *,
            department:departments!users_department_id_fkey(id, name),
            role:roles!users_role_id_fkey(id, name)
          `)
          .eq('manager_id', user.id)
          .eq('status', 'active')
          .order('full_name');

        if (error) throw error;
        
        // Enhance with additional roles data
        const enhancedUsers = await Promise.all(
          (data || []).map(async (user) => {
            if (user.additional_role_ids && user.additional_role_ids.length > 0) {
              const { data: additionalRoles } = await supabase
                .from('roles')
                .select('id, name')
                .in('id', user.additional_role_ids);
              
              return {
                ...user,
                additional_roles: additionalRoles || []
              };
            }
            return {
              ...user,
              additional_roles: []
            };
          })
        );
        
        return enhancedUsers;
      }

      // Regular employees can only see themselves
      console.log('👤 User is regular employee - fetching only own data');
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          department:departments!users_department_id_fkey(id, name),
          role:roles!users_role_id_fkey(id, name)
        `)
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      if (!data) return [];
      
      // Enhance with additional roles data
      let enhancedUser = data;
      if (data.additional_role_ids && data.additional_role_ids.length > 0) {
        const { data: additionalRoles } = await supabase
          .from('roles')
          .select('id, name')
          .in('id', data.additional_role_ids);
        
        enhancedUser = {
          ...data,
          additional_roles: additionalRoles || []
        };
      } else {
        enhancedUser = {
          ...data,
          additional_roles: []
        };
      }
      
      return [enhancedUser];
    },
    enabled: !!user?.id,
  });
}

export function useEmployeeById(id: string) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeeApi.getEmployeeById(id),
    enabled: !!id,
  });
}

export function useEmployeeAttendance(userId: string, year?: number) {
  return useQuery({
    queryKey: ['employee-attendance', userId, year],
    queryFn: () => employeeApi.getEmployeeAttendance(userId, year),
    enabled: !!userId,
  });
}

export function useAllEmployeesAttendance(year?: number, month?: number) {
  return useQuery({
    queryKey: ['all-employees-attendance-second-db', year, month],
    queryFn: () => employeeApi.getAllEmployeesAttendanceFromSecondDB(year, month),
    enabled: false, // Disable by default to prevent automatic loading
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2, // Retry failed requests twice
  });
}

export function useEmployeeDaywiseAttendance(employeeId: string, year: number, month: number) {
  return useQuery({
    queryKey: ['employee-daywise-attendance', employeeId, year, month],
    queryFn: () => employeeApi.getEmployeeDaywiseAttendance(employeeId, year, month),
    enabled: false, // Disable by default to prevent automatic loading
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });
}



export function useUpdateUserPermissions() {
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuth();
  
  return useMutation({
    mutationFn: ({ userId, updates }: { userId: string; updates: any }) =>
      authApi.updateProfile(userId, updates),
    onSuccess: async (updatedUser, { userId, updates }) => {
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      
      // If the current user's permissions are being updated, update their session
      if (user && user.id === userId) {
        try {
          // Update the current user's session using the AuthContext
          await updateUser(updates);
          
          // For permission changes, we need a page refresh to ensure all components 
          // re-evaluate permissions and update the dashboard switcher
          if (updates.extra_permissions) {
            toast.success('Dashboard access updated successfully! Refreshing page to apply changes...');
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
            toast.success('Profile updated successfully!');
          }
        } catch (error) {
          console.error('Failed to update current user session:', error);
          if (updates.extra_permissions) {
            toast.success('Dashboard access updated successfully! Please refresh the page to see changes.');
          } else {
            toast.success('Profile updated successfully! Please refresh the page to see changes.');
          }
        }
      } else {
        // When updating another user's permissions
        if (updates.extra_permissions) {
          toast.success('Dashboard access updated successfully!');
        } else {
          toast.success('Employee updated successfully!');
        }
      }
    },
    onError: (error) => {
      toast.error('Failed to update dashboard access');
      console.error('Dashboard access update error:', error);
    },
  });
}

// Asset Management Hooks
export function useAssets() {
  return useQuery({
    queryKey: ['assets'],
    queryFn: assetApi.getAllAssets,
  });
}

export function useAssetAssignments() {
  return useQuery({
    queryKey: ['asset-assignments'],
    queryFn: assetApi.getAssetAssignments,
  });
}

export function useAssetCategories() {
  return useQuery({
    queryKey: ['asset-categories'],
    queryFn: assetApi.getAssetCategories,
  });
}

export function useCreateAssetCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: assetApi.createAssetCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
      toast.success('Category created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create category');
      console.error('Category creation error:', error);
    },
  });
}

export function useAvailableAssets() {
  return useQuery({
    queryKey: ['available-assets'],
    queryFn: assetApi.getAvailableAssets,
  });
}

export function useCreateAssetAssignment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: assetApi.bulkAssignAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['all-asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['available-assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset assigned successfully!');
    },
    onError: (error) => {
      toast.error('Failed to assign asset');
      console.error('Asset assignment error:', error);
    },
  });
}

export function useGetEmployeeDetails() {
  return useMutation({
    mutationFn: assetApi.getEmployeeDetails,
    onError: (error) => {
      console.error('Failed to get employee details:', error);
    },
  });
}

export function useUnassignAsset() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ assetId, returnCondition, returnNotes }: { 
      assetId: string; 
      returnCondition?: string; 
      returnNotes?: string 
    }) => assetApi.unassignAssetFromAll(assetId, returnCondition, returnNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['all-asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['available-assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset unassigned successfully!');
    },
    onError: (error) => {
      toast.error('Failed to unassign asset');
      console.error('Asset unassignment error:', error);
    },
  });
}

export function useUpdateAssignmentCondition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ assignmentId, condition, notes }: { 
      assignmentId: string; 
      condition: string; 
      notes?: string 
    }) => assetApi.updateAssignmentCondition(assignmentId, condition, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['all-asset-assignments'] });
      toast.success('Assignment condition updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update assignment condition');
      console.error('Assignment condition update error:', error);
    },
  });
}

export function useUnassignSpecificUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ assignmentId, returnCondition, returnNotes }: { 
      assignmentId: string; 
      returnCondition?: string; 
      returnNotes?: string 
    }) => assetApi.unassignSpecificUser(assignmentId, returnCondition, returnNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['all-asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['available-assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('User unassigned successfully!');
    },
    onError: (error) => {
      toast.error('Failed to unassign user');
      console.error('User unassignment error:', error);
    },
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: assetApi.createAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['available-assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-metrics'] });
      toast.success('Asset created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create asset');
      console.error('Asset creation error:', error);
    },
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      assetApi.updateAsset(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['available-assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['all-asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['asset-metrics'] });
      toast.success('Asset updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update asset');
      console.error('Asset update error:', error);
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: assetApi.deleteAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['available-assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-metrics'] });
      toast.success('Asset deleted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to delete asset');
      console.error('Asset deletion error:', error);
    },
  });
}

export function useUpdateAssetAssignment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      assetApi.updateAssetAssignment(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['all-asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-metrics'] });
      toast.success('Asset assignment updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update asset assignment');
      console.error('Asset assignment update error:', error);
    },
  });
}

export function useDeleteAssetAssignment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: assetApi.deleteAssetAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['all-asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-metrics'] });
      toast.success('Asset assignment deleted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to delete asset assignment');
      console.error('Asset assignment deletion error:', error);
    },
  });
}

export function useAssetMetrics() {
  return useQuery({
    queryKey: ['asset-metrics'],
    queryFn: assetApi.getAssetMetrics,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Virtual Machine Management Hooks
export function useVMs() {
  return useQuery({
    queryKey: ['vms'],
    queryFn: vmApi.getAllVMs,
  });
}

export function useVMAssignments() {
  return useQuery({
    queryKey: ['vm-assignments'],
    queryFn: vmApi.getVMAssignments,
  });
}

export function useAvailableVMs() {
  return useQuery({
    queryKey: ['available-vms'],
    queryFn: vmApi.getAvailableVMs,
  });
}

export function useUserVMs(userId?: string) {
  return useQuery({
    queryKey: ['user-vms', userId],
    queryFn: () => userId ? vmApi.getUserVMs(userId) : Promise.resolve([]),
    enabled: !!userId,
  });
}

export function useCreateVM() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: vmApi.createVM,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms'] });
      queryClient.invalidateQueries({ queryKey: ['available-vms'] });
      queryClient.invalidateQueries({ queryKey: ['vm-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['vm-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['all-asset-assignments'] });
      toast.success('VM created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create VM');
      console.error('VM creation error:', error);
    },
  });
}

export function useAssignVM() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ vmId, userId, assignedBy, notes }: { 
      vmId: string; 
      userId: string; 
      assignedBy: string; 
      notes?: string 
    }) => vmApi.assignVMToUser(vmId, userId, assignedBy, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vm-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['available-vms'] });
      queryClient.invalidateQueries({ queryKey: ['user-vms'] });
      queryClient.invalidateQueries({ queryKey: ['vm-metrics'] });
      toast.success('VM assigned successfully!');
    },
    onError: (error) => {
      toast.error('Failed to assign VM');
      console.error('VM assignment error:', error);
    },
  });
}

export function useUnassignVM() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ vmId, returnCondition }: { vmId: string; returnCondition?: string }) =>
      vmApi.unassignVMFromUser(vmId, returnCondition),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vm-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['available-vms'] });
      queryClient.invalidateQueries({ queryKey: ['user-vms'] });
      queryClient.invalidateQueries({ queryKey: ['vm-metrics'] });
      toast.success('VM unassigned successfully!');
    },
    onError: (error) => {
      toast.error('Failed to unassign VM');
      console.error('VM unassignment error:', error);
    },
  });
}

export function useUpdateVM() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      vmApi.updateVM(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms'] });
      queryClient.invalidateQueries({ queryKey: ['vm-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['available-vms'] });
      queryClient.invalidateQueries({ queryKey: ['vm-metrics'] });
      toast.success('VM updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update VM');
      console.error('VM update error:', error);
    },
  });
}

export function useDeleteVM() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: vmApi.deleteVM,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms'] });
      queryClient.invalidateQueries({ queryKey: ['available-vms'] });
      queryClient.invalidateQueries({ queryKey: ['vm-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['vm-metrics'] });
      toast.success('VM deleted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to delete VM');
      console.error('VM deletion error:', error);
    },
  });
}

export function useVMMetrics() {
  return useQuery({
    queryKey: ['vm-metrics'],
    queryFn: vmApi.getVMMetrics,
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      authApi.updateProfile(id, updates),
    onSuccess: (updatedEmployee, { id, updates }) => {
      // Invalidate all relevant query keys to ensure immediate UI updates
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
      queryClient.invalidateQueries({ queryKey: ['filtered-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      
      // Also invalidate any queries that might depend on employee data
      queryClient.invalidateQueries({ queryKey: ['document-types', id] });
      queryClient.invalidateQueries({ queryKey: ['employee-documents', id] });
      queryClient.invalidateQueries({ queryKey: ['work-experience', id] });
      
      // If employment_terms was updated, invalidate leave balances since it affects leave rate
      if (updates?.employment_terms !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances-with-manager'] });
        queryClient.invalidateQueries({ queryKey: ['leave-balance', id] });
        queryClient.invalidateQueries({ queryKey: ['user-leave-summary', id] });
      }
      
      toast.success('Employee updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update employee');
      console.error('Employee update error:', error);
    },
  });
}

export function useDeleteExitProcess() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: hrExitApi.deleteExitProcess,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-exit-processes'] });
      toast.success('Exit process deleted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to delete exit process');
      console.error('Exit process deletion error:', error);
    },
  });
}

// HR Referrals Hooks
export function useAllReferrals() {
  return useQuery({
    queryKey: ['all-referrals'],
    queryFn: hrReferralsApi.getAllReferrals,
  });
}

export function useUpdateReferralStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: { 
      id: string; 
      status: string; 
      hrNotes?: string;
      bonusEligible?: boolean;
      bonusAmount?: number | null;
      bonusPaid?: boolean;
    }) =>
      hrReferralsApi.updateReferralStatus(params.id, params.status, params.hrNotes, params.bonusEligible, params.bonusAmount, params.bonusPaid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-referrals'] });
      toast.success('Referral status updated!');
    },
    onError: (error) => {
      toast.error('Failed to update referral status');
      console.error('Referral update error:', error);
    },
  });
}

// Exit Process Hooks
export function useAllExitProcesses() {
  return useQuery({
    queryKey: ['all-exit-processes'],
    queryFn: hrExitApi.getAllExitProcesses,
  });
}

export function useExitProcessById(id: string) {
  return useQuery({
    queryKey: ['exit-process', id],
    queryFn: () => hrExitApi.getExitProcessById(id),
    enabled: !!id,
  });
}

export function useUpdateExitProcess() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      hrExitApi.updateExitProcess(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-exit-processes'] });
      toast.success('Exit process updated!');
    },
    onError: (error) => {
      toast.error('Failed to update exit process');
      console.error('Exit process update error:', error);
    },
  });
}

// Additional VM Hook
export function useVMByAssetId(assetId: string) {
  return useQuery({
    queryKey: ['vm-by-asset', assetId],
    queryFn: () => vmApi.getVMByAssetId(assetId),
    enabled: !!assetId,
    retry: false, // Don't retry if no VM is found
    staleTime: 5 * 60 * 1000, // Keep data fresh for 5 minutes
  });
}

// Notes Guidance hooks
export function useNotesGuidance() {
  return useQuery({
    queryKey: ['notes-guidance'],
    queryFn: assetApi.getCurrentNotesGuidance,
  });
}

export function useAllNotesGuidance() {
  return useQuery({
    queryKey: ['all-notes-guidance'],
    queryFn: assetApi.getAllNotesGuidance,
  });
}

export function useCreateNotesGuidance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ title, guidance_text }: { title: string; guidance_text: string }) =>
      assetApi.createNotesGuidance(title, guidance_text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes-guidance'] });
      queryClient.invalidateQueries({ queryKey: ['all-notes-guidance'] });
      queryClient.invalidateQueries({ queryKey: ['notes-guidance-history'] });
      toast.success('Notes guidance created successfully!');
    },
    onError: (error: any) => {
      console.error('Notes guidance creation error:', error);
      
      // Check for specific permission errors
      if (error?.code === '42501' || error?.message?.includes('permission')) {
        toast.error('Permission denied. You need admin/HR privileges to create guidance.');
      } else if (error?.message?.includes('RLS')) {
        toast.error('Access denied. Please check your user permissions.');
      } else {
        toast.error(`Failed to create notes guidance: ${error?.message || 'Unknown error'}`);
      }
    },
  });
}

export function useUpdateNotesGuidance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, title, guidance_text }: { id: string; title: string; guidance_text: string }) =>
      assetApi.updateNotesGuidance(id, title, guidance_text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes-guidance'] });
      queryClient.invalidateQueries({ queryKey: ['all-notes-guidance'] });
      queryClient.invalidateQueries({ queryKey: ['notes-guidance-history'] });
      toast.success('Notes guidance updated successfully!');
    },
    onError: (error: any) => {
      console.error('Notes guidance update error:', error);
      
      // Check for specific permission errors
      if (error?.code === '42501' || error?.message?.includes('permission')) {
        toast.error('Permission denied. You need admin/HR privileges to update guidance.');
      } else if (error?.message?.includes('RLS') || error?.message?.includes('policy')) {
        toast.error('Access denied. Please check your user permissions.');
      } else {
        toast.error(`Failed to update notes guidance: ${error?.message || 'Unknown error'}`);
      }
    },
  });
}

export function useDeleteNotesGuidance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => assetApi.deleteNotesGuidance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes-guidance'] });
      queryClient.invalidateQueries({ queryKey: ['all-notes-guidance'] });
      queryClient.invalidateQueries({ queryKey: ['notes-guidance-history'] });
      toast.success('Notes guidance deleted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to delete notes guidance');
      console.error('Notes guidance deletion error:', error);
    },
  });
}

export function useNotesGuidanceHistory() {
  return useQuery({
    queryKey: ['notes-guidance-history'],
    queryFn: assetApi.getNotesGuidanceHistory,
  });
}

// Assignment Logs Hooks
export function useUserAssignmentLogs(userId: string) {
  return useQuery({
    queryKey: ['user-assignment-logs', userId],
    queryFn: () => assetApi.getUserAssignmentLogs(userId),
    enabled: !!userId,
  });
}

export function useUsersWithAssignmentHistory() {
  return useQuery({
    queryKey: ['users-with-assignment-history'],
    queryFn: assetApi.getUsersWithAssignmentHistory,
  });
}

export function useAllAssignmentLogs() {
  return useQuery({
    queryKey: ['all-assignment-logs'],
    queryFn: assetApi.getAllAssignmentLogs,
  });
}

export function useAllAssetAssignments() {
  return useQuery({
    queryKey: ['all-asset-assignments'],
    queryFn: assetApi.getAllAssetAssignments,
  });
}

export function useBackfillAssignmentLogs() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: assetApi.backfillAssignmentLogs,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['user-assignment-logs'] });
      queryClient.invalidateQueries({ queryKey: ['users-with-assignment-history'] });
      queryClient.invalidateQueries({ queryKey: ['all-assignment-logs'] });
      toast.success(`Successfully backfilled ${result} assignment logs!`);
    },
    onError: (error) => {
      toast.error('Failed to backfill assignment logs');
      console.error('Backfill error:', error);
    },
  });
}

// User assets hooks
export function useUserAssets(userId?: string) {
  return useQuery({
    queryKey: ['userAssets', userId],
    queryFn: () => assetApi.getUserAssets(userId!),
    enabled: !!userId,
  });
}

export function useCreateAssetComplaint() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: assetApi.createAssetComplaint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userAssetComplaints'] });
      toast.success('Complaint submitted successfully');
    },
    onError: (error) => {
      console.error('Error creating asset complaint:', error);
      toast.error('Failed to submit complaint');
    },
  });
}

export function useUserAssetComplaints(userId?: string) {
  return useQuery({
    queryKey: ['userAssetComplaints', userId],
    queryFn: () => assetApi.getUserAssetComplaints(userId!),
    enabled: !!userId,
  });
}

export function useAllAssetComplaints() {
  return useQuery({
    queryKey: ['allAssetComplaints'],
    queryFn: assetApi.getAllAssetComplaints,
  });
}

export function useUpdateAssetComplaint() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ complaintId, updates }: { complaintId: string; updates: any }) => 
      assetApi.updateAssetComplaint(complaintId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allAssetComplaints'] });
      queryClient.invalidateQueries({ queryKey: ['userAssetComplaints'] });
      toast.success('Complaint updated successfully');
    },
    onError: (error) => {
      console.error('Error updating asset complaint:', error);
      toast.error('Failed to update complaint');
    },
  });
}

// Asset Request hooks
export function useCreateAssetRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: assetApi.createAssetRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userAssetRequests'] });
      queryClient.invalidateQueries({ queryKey: ['allAssetRequests'] });
      queryClient.invalidateQueries({ queryKey: ['managerAssetRequests'] });
      queryClient.invalidateQueries({ queryKey: ['managerAssetAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['managerAssetComplaints'] });
      toast.success('Asset request submitted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to submit asset request');
      console.error('Asset request creation error:', error);
    },
  });
}

export function useUserAssetRequests(userId?: string) {
  return useQuery({
    queryKey: ['userAssetRequests', userId],
    queryFn: () => assetApi.getUserAssetRequests(userId!),
    enabled: !!userId,
  });
}

export function useAllAssetRequests() {
  console.log('Hook: useAllAssetRequests called');
  return useQuery({
    queryKey: ['allAssetRequests'],
    queryFn: () => {
      console.log('Hook: useAllAssetRequests queryFn executing');
      return assetApi.getAllAssetRequests();
    },
  });
}

export function useManagerAssetRequests() {
  console.log('Hook: useManagerAssetRequests called');
  return useQuery({
    queryKey: ['managerAssetRequests'],
    queryFn: () => {
      console.log('Hook: useManagerAssetRequests queryFn executing');
      return assetApi.getManagerAssetRequests();
    },
  });
}

export function useManagerAssetAssignments() {
  return useQuery({
    queryKey: ['managerAssetAssignments'],
    queryFn: assetApi.getManagerAssetAssignments,
  });
}

export function useManagerAssetComplaints() {
  return useQuery({
    queryKey: ['managerAssetComplaints'],
    queryFn: assetApi.getManagerAssetComplaints,
  });
}

export function useUpdateAssetRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ requestId, updates }: { requestId: string; updates: any }) => 
      assetApi.updateAssetRequest(requestId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allAssetRequests'] });
      queryClient.invalidateQueries({ queryKey: ['userAssetRequests'] });
      queryClient.invalidateQueries({ queryKey: ['managerAssetRequests'] });
      queryClient.invalidateQueries({ queryKey: ['managerAssetAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['managerAssetComplaints'] });
      toast.success('Asset request updated successfully');
    },
    onError: (error) => {
      console.error('Error updating asset request:', error);
      toast.error('Failed to update asset request');
    },
  });
}