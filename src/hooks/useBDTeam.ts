import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bdTeamApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Dashboard hooks
export function useBDDashboardStats() {
  return useQuery({
    queryKey: ['bd-dashboard-stats'],
    queryFn: bdTeamApi.getDashboardStats,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

// Billing Records hooks
export function useBillingRecords() {
  return useQuery({
    queryKey: ['billing-records'],
    queryFn: bdTeamApi.getAllBillingRecords,
  });
}

export function useBillingRecordById(id: string) {
  return useQuery({
    queryKey: ['billing-record', id],
    queryFn: () => bdTeamApi.getBillingRecordById(id),
    enabled: !!id,
  });
}

export function useCreateBillingRecord() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: bdTeamApi.createBillingRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-records'] });
      queryClient.invalidateQueries({ queryKey: ['bd-dashboard-stats'] });
      toast.success('Billing record created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create billing record');
      console.error('Billing record error:', error);
    },
  });
}

export function useUpdateBillingRecord() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      bdTeamApi.updateBillingRecord(id, updates, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-records'] });
      queryClient.invalidateQueries({ queryKey: ['bd-dashboard-stats'] });
      toast.success('Billing record updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update billing record');
      console.error('Billing record update error:', error);
    },
  });
}

// Invoice hooks
export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: bdTeamApi.getAllInvoices,
  });
}

export function useInvoiceById(id: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () => bdTeamApi.getInvoiceById(id),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: bdTeamApi.createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['bd-dashboard-stats'] });
      toast.success('Invoice created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create invoice');
      console.error('Invoice error:', error);
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      bdTeamApi.updateInvoice(id, updates, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['bd-dashboard-stats'] });
      toast.success('Invoice updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update invoice');
      console.error('Invoice update error:', error);
    },
  });
}

// Billing Logs hooks
export function useBillingLogs(recordId?: string, invoiceId?: string) {
  return useQuery({
    queryKey: ['billing-logs', recordId, invoiceId],
    queryFn: () => bdTeamApi.getBillingLogs(recordId, invoiceId),
    enabled: true, // Always enabled to show all logs when no filters
    retry: 1, // Only retry once on failure
    retryOnMount: false,
  });
}

// Recent Billing Logs hook
export function useRecentBillingLogs(limit?: number) {
  return useQuery({
    queryKey: ['recent-billing-logs', limit],
    queryFn: () => bdTeamApi.getRecentBillingLogs(limit),
    refetchInterval: 30 * 1000, // Refetch every 30 seconds for real-time updates
    retry: 1, // Only retry once on failure
    retryOnMount: false,
  });
}

// Invoice Comments hooks
export function useInvoiceComments(invoiceId: string) {
  return useQuery({
    queryKey: ['invoice-comments', invoiceId],
    queryFn: () => bdTeamApi.getInvoiceComments(invoiceId),
    enabled: !!invoiceId,
  });
}

export function useCreateInvoiceComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: bdTeamApi.createInvoiceComment,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-comments', variables.invoice_id] });
      toast.success('Comment added successfully!');
    },
    onError: (error) => {
      toast.error('Failed to add comment');
      console.error('Comment error:', error);
    },
  });
}

// Finance Users hook
export function useFinanceUsers() {
  return useQuery({
    queryKey: ['finance-users'],
    queryFn: bdTeamApi.getFinanceUsers,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}