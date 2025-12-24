import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '@/services/financeApi';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';

// Dashboard hooks
export function useFinanceDashboardStats() {
  return useQuery({
    queryKey: ['finance-dashboard-stats'],
    queryFn: financeApi.getDashboardStats,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

// Payroll hooks
export function usePayrollData(month?: number, year?: number) {
  return useQuery({
    queryKey: ['payroll-data', month, year],
    queryFn: () => financeApi.getPayrollData(month, year),
    enabled: false, // Disable by default to prevent automatic loading
  });
}

export function useEmployeePayrollDetails(userId: string, month?: number, year?: number) {
  return useQuery({
    queryKey: ['employee-payroll-details', userId, month, year],
    queryFn: () => financeApi.getEmployeePayrollDetails(userId, month, year),
    enabled: !!userId,
  });
}

export function useGeneratePayslips() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      financeApi.generatePayslips(month, year),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-data'] });
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error('Failed to generate payslips');
      console.error('Payslip generation error:', error);
    },
  });
}

// Billing hooks (Finance perspective)
export function useFinanceBillingRecords() {
  return useQuery({
    queryKey: ['finance-billing-records'],
    queryFn: financeApi.getBillingRecords,
  });
}

export function useFinanceInvoices() {
  return useQuery({
    queryKey: ['finance-invoices'],
    queryFn: financeApi.getInvoices,
  });
}

export function useCreateFinanceBillingRecord() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: financeApi.createBillingRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-billing-records'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard-stats'] });
      toast.success('Billing record created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create billing record');
      console.error('Billing record error:', error);
    },
  });
}

export function useUpdateFinanceBillingRecord() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      financeApi.updateBillingRecord(id, updates, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-billing-records'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard-stats'] });
      toast.success('Billing record updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update billing record');
      console.error('Billing record update error:', error);
    },
  });
}

export function useCreateFinanceInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: financeApi.createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard-stats'] });
      toast.success('Invoice created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create invoice');
      console.error('Invoice error:', error);
    },
  });
}

export function useUpdateFinanceInvoice() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      financeApi.updateInvoice(id, updates, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard-stats'] });
      toast.success('Invoice updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update invoice');
      console.error('Invoice update error:', error);
    },
  });
}

export function useDeleteFinanceInvoice() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: (invoiceId: string) => financeApi.deleteInvoice(invoiceId, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard-stats'] });
      toast.success('Invoice deleted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to delete invoice');
      console.error('Invoice deletion error:', error);
    },
  });
}

export function useUpdatePayrollData() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, month, year, adjustments }: { 
      userId: string; 
      month: number; 
      year: number; 
      adjustments: any; 
    }) =>
      financeApi.updatePayrollData(userId, month, year, adjustments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-data'] });
      queryClient.invalidateQueries({ queryKey: ['employee-payroll-details'] });
      toast.success('Payroll data updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update payroll data');
      console.error('Payroll update error:', error);
    },
  });
}

export function usePayrollLogs() {
  return useQuery({
    queryKey: ['payroll-logs'],
    queryFn: financeApi.getPayrollLogs,
  });
}

// Client Master hooks
export function useClientMaster() {
  return useQuery({
    queryKey: ['client-master'],
    queryFn: financeApi.getClientMaster,
  });
}

export function useCreateClientMaster() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: (clientData: any) => {
      console.log('Creating client master with user:', user?.id);
      console.log('Client data:', clientData);
      
      if (!user?.id) {
        throw new Error('User ID is not available');
      }
      
      return financeApi.createClientMaster({
        ...clientData,
        created_by: user.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-master'] });
      toast.success('Client master record created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create client master record');
      console.error('Client master creation error:', error);
    },
  });
}

export function useUpdateClientMaster() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      financeApi.updateClientMaster(id, updates, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-master'] });
      toast.success('Client master record updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update client master record');
      console.error('Client master update error:', error);
    },
  });
}

export function useDeleteClientMaster() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: financeApi.deleteClientMaster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-master'] });
      toast.success('Client master record deleted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to delete client master record');
      console.error('Client master deletion error:', error);
    },
  });
}

// Invoice Logs hooks
export function useInvoiceLogs(invoiceId?: string) {
  return useQuery({
    queryKey: ['invoice-logs', invoiceId],
    queryFn: () => financeApi.getInvoiceLogs(invoiceId),
  });
}

export function useInvoiceTaskLogs(invoiceId?: string, taskId?: string) {
  return useQuery({
    queryKey: ['invoice-task-logs', invoiceId, taskId],
    queryFn: () => financeApi.getInvoiceTaskLogs(invoiceId, taskId),
  });
}

export function useAllInvoiceLogs(limit: number = 100, offset: number = 0) {
  return useQuery({
    queryKey: ['all-invoice-logs', limit, offset],
    queryFn: () => financeApi.getAllInvoiceLogs(limit, offset),
  });
}

// App permissions hook
export function useAppPermissions() {
  return useQuery({
    queryKey: ['app-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_config')
        .select('permissions')
        .eq('id', 1)
        .single();
      
      if (error) throw error;
      return data?.permissions || {};
    },
  });
}

// Testing hooks for logging system
export function useTestLogging() {
  return useQuery({
    queryKey: ['test-logging'],
    queryFn: () => financeApi.testLogging('test-invoice-id', 'test-user-id'),
    enabled: false, // Only run when manually triggered
  });
}

export function useCheckInvoiceLogs(invoiceId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['check-invoice-logs', invoiceId],
    queryFn: () => financeApi.checkInvoiceLogs(invoiceId),
    enabled: enabled && !!invoiceId,
  });
}

export function useTestInvoiceScenario() {
  return useMutation({
    mutationFn: () => financeApi.testInvoiceScenario(),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Test scenario completed successfully!');
        console.log('Test result:', result);
      } else {
        toast.error('Test scenario failed: ' + result.error);
      }
    },
    onError: (error) => {
      toast.error('Failed to run test scenario');
      console.error('Test scenario error:', error);
    },
  });
}

export function useTestRealApiEndpoint() {
  return useMutation({
    mutationFn: () => financeApi.testRealApiEndpoint(),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('API endpoint test completed!');
        console.log('API test result:', result);
      } else {
        toast.error('API test failed: ' + result.error);
      }
    },
    onError: (error) => {
      toast.error('Failed to test API endpoint');
      console.error('API test error:', error);
    },
  });
}