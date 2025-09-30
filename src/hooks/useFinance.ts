import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '@/services/financeApi';
import { useAuth } from '@/contexts/AuthContext';
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