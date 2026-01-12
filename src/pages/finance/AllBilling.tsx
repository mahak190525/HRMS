import { useState } from 'react';
import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useFinanceBillingRecords, 
  useFinanceInvoices, 
  useCreateFinanceBillingRecord, 
  useUpdateFinanceBillingRecord,
  useCreateFinanceInvoice,
  useUpdateFinanceInvoice,
  useDeleteFinanceInvoice,
  useClientMaster,
  useCreateClientMaster,
  useUpdateClientMaster,
  useDeleteClientMaster,
  useInvoiceLogs,
  useInvoiceTaskLogs,
  useTestLogging,
  useCheckInvoiceLogs,
  useTestInvoiceScenario,
  useTestRealApiEndpoint,
  useAppPermissions
} from '@/hooks/useFinance';
import { useFinanceUsers } from '@/hooks/useBDTeam';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Filter,
  Eye,
  Edit,
  Calendar as CalendarIcon,
  Building,
  Download,
  Users,
  Trash2,
  X,
  Calculator
} from 'lucide-react';
import { format } from 'date-fns';
import { formatDateForDisplay, getCurrentISTDate, parseToISTDate, formatDateForDatabase, getTodayIST } from '@/utils/dateUtils';
import { generateInvoicePDF } from '@/utils/invoicePdfUtils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { CONTRACT_TYPES, BILLING_CYCLES, CURRENCIES, PAYMENT_TERMS } from '@/constants';

const billingSchema = z.object({
  client_name: z.string().min(1, 'Client name is required'),
  project_name: z.string().optional(),
  contract_type: z.string().min(1, 'Contract type is required'),
  billing_cycle: z.string().min(1, 'Billing cycle is required'),
  contract_start_date: z.date({ message: 'Start date is required' }),
  contract_end_date: z.date({ message: 'End date is required' }),
  contract_value: z.number().min(0, 'Contract value must be positive'),
  billed_to_date: z.number().min(0, 'Billed amount must be positive'),
  next_billing_date: z.date().optional(),
  payment_terms: z.string().min(1, 'Payment terms are required'),
  internal_notes: z.string().optional(),
});

const invoiceSchema = z.object({
  invoice_type: z.enum(['Mechlin LLC', 'Mechlin Indian'], { message: 'Invoice type is required' }),
  invoice_number: z.string().min(1, 'Invoice number is required'),
  invoice_title: z.string().optional(),
  client_name: z.string().min(1, 'Client name is required'),
  project: z.string().optional(),
  billing_reference: z.string().optional(),
  invoice_amount: z.number().min(0, 'Invoice amount must be 0 or greater').optional(), // Will be calculated from tasks
  due_date: z.date({ message: 'Due date is required' }),
  payment_terms: z.string().min(1, 'Payment terms are required'),
  currency: z.string().min(1, 'Currency is required'),
  notes_to_finance: z.string().optional(),
  status: z.string().optional(),
  // Auto-filled client details
  client_address: z.string().optional(),
  client_state: z.string().optional(),
  client_zip_code: z.string().optional(),
  // Date fields
  invoice_date: z.date().optional(),
  service_period_start: z.date().optional(),
  service_period_end: z.date().optional(),
  // Reference numbers for LLC
  reference_invoice_numbers: z.array(z.string()).optional(),
  // Payment fields (enabled when status = paid)
  payment_receive_date: z.date().optional(),
  amount_received: z.number().optional(),
  pending_amount: z.number().optional(),
  payment_remarks: z.string().optional(),
  // Finance POC
  assigned_finance_poc: z.string().optional(),
});

// Schema for invoice tasks
const invoiceTaskSchema = z.object({
  id: z.string().optional(),
  task_name: z.string().min(1, 'Task name is required'),
  task_description: z.string().optional(),
  hours: z.number().min(0.01, 'Hours must be greater than 0'),
  rate_per_hour: z.number().min(0.01, 'Rate must be greater than 0'),
  display_order: z.number().optional(),
});

const clientMasterSchema = z.object({
  recipient_email: z.string().email('Please enter a valid recipient email'),
  recipient_name: z.string().min(1, 'Recipient name is required'),
  client_email: z.string().email('Please enter a valid client email'),
  client_name: z.string().min(1, 'Client name is required'),
  address: z.string().min(1, 'Address is required'),
  state: z.string().min(1, 'State is required'),
  zip_code: z.string().min(1, 'ZIP code is required'),
});

type BillingFormData = z.infer<typeof billingSchema>;
type InvoiceFormData = z.infer<typeof invoiceSchema>;
type InvoiceTaskData = z.infer<typeof invoiceTaskSchema>;
type ClientMasterFormData = z.infer<typeof clientMasterSchema>;

export function AllBilling() {
  const { user } = useAuth();
  const { data: billingRecords, isLoading: recordsLoading } = useFinanceBillingRecords();
  const { data: invoices, isLoading: invoicesLoading } = useFinanceInvoices();
  const { data: clientMaster, isLoading: clientMasterLoading } = useClientMaster();
  const { data: financeUsers } = useFinanceUsers();
  const { data: appPermissions } = useAppPermissions();
  const createBillingRecord = useCreateFinanceBillingRecord();
  const updateBillingRecord = useUpdateFinanceBillingRecord();
  const createInvoice = useCreateFinanceInvoice();
  const updateInvoice = useUpdateFinanceInvoice();
  const deleteInvoice = useDeleteFinanceInvoice();
  const createClientMaster = useCreateClientMaster();
  const updateClientMaster = useUpdateClientMaster();
  const deleteClientMaster = useDeleteClientMaster();
  
  // Permission checks for invoice editing and deletion
  const canEditInvoices = appPermissions?.finance?.invoices?.edit ?? true;
  const canDeleteInvoices = appPermissions?.finance?.invoices?.delete ?? true;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isCreateBillingDialogOpen, setIsCreateBillingDialogOpen] = useState(false);
  const [isCreateInvoiceDialogOpen, setIsCreateInvoiceDialogOpen] = useState(false);
  const [isEditBillingDialogOpen, setIsEditBillingDialogOpen] = useState(false);
  const [isEditInvoiceDialogOpen, setIsEditInvoiceDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isViewInvoiceDialogOpen, setIsViewInvoiceDialogOpen] = useState(false);
  const [isCreateClientMasterDialogOpen, setIsCreateClientMasterDialogOpen] = useState(false);
  const [isEditClientMasterDialogOpen, setIsEditClientMasterDialogOpen] = useState(false);
  const [isViewClientMasterDialogOpen, setIsViewClientMasterDialogOpen] = useState(false);
  const [selectedClientMaster, setSelectedClientMaster] = useState<any>(null);
  const [isViewLogsDialogOpen, setIsViewLogsDialogOpen] = useState(false);
  const [selectedInvoiceForLogs, setSelectedInvoiceForLogs] = useState<any>(null);
  
  // Invoice tasks state
  const [invoiceTasks, setInvoiceTasks] = useState<InvoiceTaskData[]>([]);
  const [newTask, setNewTask] = useState<InvoiceTaskData>({
    task_name: '',
    task_description: '',
    hours: 0,
    rate_per_hour: 0,
    display_order: 0,
  });
  
  // Helper functions for invoice tasks
  const addTask = () => {
    if (newTask.task_name && newTask.hours > 0 && newTask.rate_per_hour > 0) {
      const task = {
        ...newTask,
        id: `temp_${Date.now()}`,
        display_order: invoiceTasks.length,
      };
      setInvoiceTasks([...invoiceTasks, task]);
      setNewTask({
        task_name: '',
        task_description: '',
        hours: 0,
        rate_per_hour: 0,
        display_order: 0,
      });
      // Update total amount
      updateInvoiceTotal([...invoiceTasks, task]);
    }
  };
  
  const removeTask = (index: number) => {
    const updatedTasks = invoiceTasks.filter((_, i) => i !== index);
    setInvoiceTasks(updatedTasks);
    updateInvoiceTotal(updatedTasks);
  };
  
  const updateInvoiceTotal = (tasks: InvoiceTaskData[]) => {
    const total = tasks.reduce((sum, task) => sum + (task.hours * task.rate_per_hour), 0);
    invoiceForm.setValue('invoice_amount', total);
  };
  
  // Auto-fill client details when client is selected
  const handleClientSelection = (clientName: string) => {
    const client = clientMaster?.find(c => c.client_name === clientName);
    if (client) {
      invoiceForm.setValue('client_address', client.address || '');
      invoiceForm.setValue('client_state', client.state || '');
      invoiceForm.setValue('client_zip_code', client.zip_code || '');
    }
  };
  

  const billingForm = useForm<BillingFormData>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      client_name: '',
      project_name: '',
      contract_type: 'fixed',
      billing_cycle: 'monthly',
      contract_value: 0,
      billed_to_date: 0,
      payment_terms: 'net_30',
      internal_notes: '',
    },
  });

  const invoiceForm = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoice_type: 'Mechlin LLC',
      invoice_number: '',
      invoice_title: '',
      client_name: '',
      project: '',
      billing_reference: '',
      invoice_amount: 0,
      payment_terms: 'net_30',
      currency: 'USD',
      notes_to_finance: '',
      status: 'in_progress',
      client_address: '',
      client_state: '',
      client_zip_code: '',
      invoice_date: getCurrentISTDate(),
      due_date: getCurrentISTDate(),
      service_period_start: undefined,
      service_period_end: undefined,
      reference_invoice_numbers: [],
      payment_receive_date: undefined,
      amount_received: undefined,
      pending_amount: undefined,
      payment_remarks: '',
      assigned_finance_poc: '',
    },
  });
  
  // Watch invoice type for conditional fields (after form declaration)
  const watchedInvoiceType = invoiceForm.watch('invoice_type');
  const watchedStatus = invoiceForm.watch('status');
  const watchedClientName = invoiceForm.watch('client_name');
  const watchedAmountReceived = invoiceForm.watch('amount_received');
  const watchedInvoiceAmount = invoiceForm.watch('invoice_amount');
  
  // Watch for client name changes to auto-fill details
  React.useEffect(() => {
    if (watchedClientName && clientMaster) {
      handleClientSelection(watchedClientName);
    }
  }, [watchedClientName, clientMaster]);

  // Calculate pending_amount dynamically based on invoice_amount and amount_received
  React.useEffect(() => {
    const invoiceAmount = watchedInvoiceAmount || 0;
    const amountReceived = watchedAmountReceived || 0;
    const pendingAmount = Math.max(0, invoiceAmount - amountReceived);
    invoiceForm.setValue('pending_amount', pendingAmount);
  }, [watchedInvoiceAmount, watchedAmountReceived, invoiceForm]);
  
  // Auto-generate invoice number based on INVOICE DATE and COMPANY TYPE
  // Format: PREFIX/MMMXXX (e.g., MT/DEC001 for Indian, MECH/DEC001 for LLC)
  // Numbers reset each month within each company type
  const generateInvoiceNumber = async () => {
    const invoiceDate = invoiceForm.getValues('invoice_date') || getCurrentISTDate();
    const invoiceType = invoiceForm.getValues('invoice_type') || 'Mechlin LLC';
    const monthAbbr = invoiceDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    
    // Determine company prefix based on invoice type
    const companyPrefix = invoiceType === 'Mechlin Indian' ? 'MT/' : 'MECH/';
    const patternPrefix = companyPrefix + monthAbbr;
    
    // Get existing invoices for THIS SPECIFIC month/year/company based on INVOICE_DATE only
    const currentMonth = invoiceDate.getMonth() + 1;
    const currentYear = invoiceDate.getFullYear();
    
    // Filter invoices by invoice_date, company type, and month/year
    const monthInvoices = invoices?.filter(inv => {
      // Use invoice_date if available, otherwise skip (don't fall back to created_at)
      if (!inv.invoice_date) return false;
      const invDate = new Date(inv.invoice_date);
      return invDate.getMonth() + 1 === currentMonth && 
             invDate.getFullYear() === currentYear &&
             inv.invoice_type === invoiceType &&
             inv.invoice_number?.startsWith(patternPrefix);
    }) || [];
    
    // Extract numbers and find the highest for this month/company only
    const numbers = monthInvoices.map(inv => {
      const match = inv.invoice_number?.match(new RegExp(`^${patternPrefix.replace('/', '\\/')}(\\d{3})$`));
      return match ? parseInt(match[1]) : 0;
    });
    
    const nextNumber = Math.max(0, ...numbers) + 1;
    const invoiceNumber = `${companyPrefix}${monthAbbr}${nextNumber.toString().padStart(3, '0')}`;
    
    return invoiceNumber;
  };
  
  // Auto-generate invoice number when opening create dialog
  React.useEffect(() => {
    if (isCreateInvoiceDialogOpen && !selectedInvoice) {
      // Reset form to clean state first
      invoiceForm.reset({
        invoice_type: 'Mechlin LLC',
        invoice_number: '',
        invoice_title: '',
        client_name: '',
        project: '',
        billing_reference: '',
        invoice_amount: 0,
        payment_terms: 'net_30',
        currency: 'USD',
        notes_to_finance: '',
        status: 'in_progress',
        client_address: '',
        client_state: '',
        client_zip_code: '',
        invoice_date: getCurrentISTDate(),
        service_period_start: undefined,
        service_period_end: undefined,
        reference_invoice_numbers: [],
        payment_receive_date: undefined,
        amount_received: undefined,
        pending_amount: undefined,
        payment_remarks: '',
        assigned_finance_poc: '',
      });
      
      // Reset tasks
      setInvoiceTasks([]);
      setNewTask({
        task_name: '',
        task_description: '',
        hours: 0,
        rate_per_hour: 0,
        display_order: 0,
      });
      
      // Then generate invoice number
      generateInvoiceNumber().then(invoiceNumber => {
        invoiceForm.setValue('invoice_number', invoiceNumber);
      });
    }
  }, [isCreateInvoiceDialogOpen, selectedInvoice, invoices]);
  
  // Watch for invoice date and type changes and regenerate invoice number accordingly
  const watchedInvoiceDate = invoiceForm.watch('invoice_date');
  React.useEffect(() => {
    if (isCreateInvoiceDialogOpen && !selectedInvoice && (watchedInvoiceDate || watchedInvoiceType)) {
      generateInvoiceNumber().then(invoiceNumber => {
        invoiceForm.setValue('invoice_number', invoiceNumber);
      });
    }
  }, [watchedInvoiceDate, watchedInvoiceType, isCreateInvoiceDialogOpen, selectedInvoice, invoices]);
  
  // Load existing tasks when editing an invoice
  React.useEffect(() => {
    if (selectedInvoice && selectedInvoice.tasks) {
      const existingTasks = selectedInvoice.tasks.map((task: any, index: number) => ({
        id: task.id,
        task_name: task.task_name,
        task_description: task.task_description || '',
        hours: task.hours,
        rate_per_hour: task.rate_per_hour,
        display_order: task.display_order || index,
      }));
      setInvoiceTasks(existingTasks);
      updateInvoiceTotal(existingTasks);
    }
  }, [selectedInvoice]);

  const clientMasterForm = useForm<ClientMasterFormData>({
    resolver: zodResolver(clientMasterSchema),
    defaultValues: {
      recipient_email: '',
      recipient_name: '',
      client_email: '',
      client_name: '',
      address: '',
      state: '',
      zip_code: '',
    },
  });

  // Get unique client names for filter dropdown
  const uniqueClients = invoices ? [...new Set(invoices.map(invoice => invoice.client_name))].sort() : [];

  const filteredBillingRecords = billingRecords?.filter(record => {
    const matchesSearch = record.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.project_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredInvoices = invoices?.filter(invoice => {
    const matchesSearch = invoice.invoice_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.project?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || statusFilter === 'all' || invoice.status === statusFilter;
    const matchesClient = !clientFilter || clientFilter === 'all' || invoice.client_name === clientFilter;
    const matchesInvoiceType = !invoiceTypeFilter || invoiceTypeFilter === 'all' || invoice.invoice_type === invoiceTypeFilter;
    
    // Date range filter based on invoice_date
    let matchesDateRange = true;
    if (dateRangeFilter.from || dateRangeFilter.to) {
      if (invoice.invoice_date) {
        const invoiceDate = parseToISTDate(invoice.invoice_date);
        if (dateRangeFilter.from && invoiceDate < dateRangeFilter.from) {
          matchesDateRange = false;
        }
        if (dateRangeFilter.to && invoiceDate > dateRangeFilter.to) {
          matchesDateRange = false;
        }
      } else {
        // If no invoice_date, exclude from date range filter
        matchesDateRange = false;
      }
    }
    
    return matchesSearch && matchesStatus && matchesClient && matchesInvoiceType && matchesDateRange;
  });

  const onBillingSubmit = async (data: BillingFormData) => {
    if (!user) return;

    const billingData = {
      ...data,
      contract_start_date: data.contract_start_date ? data.contract_start_date.toISOString().split('T')[0] : getCurrentISTDate().toISOString().split('T')[0],
      contract_end_date: data.contract_end_date ? data.contract_end_date.toISOString().split('T')[0] : getCurrentISTDate().toISOString().split('T')[0],
      next_billing_date: data.next_billing_date ? data.next_billing_date.toISOString().split('T')[0] : undefined,
      created_by: user.id,
      assigned_to_finance: user.id,
    };

    if (selectedRecord) {
      updateBillingRecord.mutate({
        id: selectedRecord.id,
        updates: billingData
      }, {
        onSuccess: () => {
          setIsEditBillingDialogOpen(false);
          setSelectedRecord(null);
          billingForm.reset();
        }
      });
    } else {
      createBillingRecord.mutate(billingData, {
        onSuccess: () => {
          setIsCreateBillingDialogOpen(false);
          billingForm.reset();
        }
      });
    }
  };

  const onInvoiceSubmit = async (data: InvoiceFormData) => {
    if (!user) return;

    // Calculate total from tasks
    const calculatedTotal = invoiceTasks.reduce((sum, task) => sum + (task.hours * task.rate_per_hour), 0);
    
    // Use calculated total if tasks exist, otherwise use manual amount (but allow 0)
    const finalAmount = invoiceTasks.length > 0 ? calculatedTotal : (data.invoice_amount || 0);


    // Prepare invoice data with proper date formatting
    const invoiceData = {
      ...data,
      // Use invoice_number as invoice_title if title is not provided
      invoice_title: data.invoice_title || data.invoice_number,
      // Format dates properly using IST-aware formatting
      due_date: data.due_date ? formatDateForDatabase(data.due_date) : getTodayIST(),
      invoice_date: data.invoice_date ? formatDateForDatabase(data.invoice_date) : getTodayIST(),
      service_period_start: data.service_period_start ? formatDateForDatabase(data.service_period_start) : null,
      service_period_end: data.service_period_end ? formatDateForDatabase(data.service_period_end) : null,
      payment_receive_date: data.payment_receive_date ? formatDateForDatabase(data.payment_receive_date) : null,
      
      // Set user info
      created_by: user.id,
      assigned_finance_poc: data.assigned_finance_poc || user.id,
      status: data.status || 'in_progress',
      
      // Set final calculated amount
      invoice_amount: finalAmount,
      
      // Include tasks data for backend processing
      tasks: invoiceTasks.map((task, index) => ({
        task_name: task.task_name,
        task_description: task.task_description || '',
        hours: task.hours,
        rate_per_hour: task.rate_per_hour,
        display_order: index,
      })),
    };


    if (selectedInvoice) {
      updateInvoice.mutate({
        id: selectedInvoice.id,
        updates: invoiceData
      }, {
        onSuccess: () => {
          setIsEditInvoiceDialogOpen(false);
          setSelectedInvoice(null);
          invoiceForm.reset();
          setInvoiceTasks([]);
          setNewTask({
            task_name: '',
            task_description: '',
            hours: 0,
            rate_per_hour: 0,
            display_order: 0,
          });
        }
      });
    } else {
      createInvoice.mutate(invoiceData, {
        onSuccess: () => {
          setIsCreateInvoiceDialogOpen(false);
          invoiceForm.reset();
          setInvoiceTasks([]);
          setNewTask({
            task_name: '',
            task_description: '',
            hours: 0,
            rate_per_hour: 0,
            display_order: 0,
          });
        }
      });
    }
  };

  const onClientMasterSubmit = async (data: ClientMasterFormData) => {
    if (!user) {
      console.error('User not found in context:', user);
      alert('User authentication error. Please refresh the page and try again.');
      return;
    }

    console.log('Submitting client master data with user:', user.id);

    if (selectedClientMaster) {
      updateClientMaster.mutate({
        id: selectedClientMaster.id,
        updates: data
      }, {
        onSuccess: () => {
          setIsEditClientMasterDialogOpen(false);
          setSelectedClientMaster(null);
          clientMasterForm.reset();
        }
      });
    } else {
      createClientMaster.mutate(data, {
        onSuccess: () => {
          setIsCreateClientMasterDialogOpen(false);
          clientMasterForm.reset();
        }
      });
    }
  };

  const getContractTypeBadge = (type: string) => {
    const variants = {
      fixed: 'bg-blue-100 text-blue-800',
      hourly: 'bg-green-100 text-green-800',
      retainer: 'bg-purple-100 text-purple-800',
      milestone: 'bg-orange-100 text-orange-800',
    };
    return variants[type as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      in_progress: 'bg-blue-100 text-blue-800',
      partially_paid: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-purple-100 text-purple-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const handleDownloadInvoice = async (invoice: any) => {
    try {
      console.log('Download button clicked for invoice:', invoice);
      // Generate PDF using react-pdf/renderer
      await generateInvoicePDF(invoice);
      console.log('PDF generation completed successfully');
    } catch (error: any) {
      console.error('Error generating invoice PDF:', error);
      // Show more detailed error message
      alert(`Failed to generate PDF: ${error.message || 'Unknown error'}. Please check the console for details.`);
    }
  };

  const exportInvoicesToCSV = () => {
    if (!filteredInvoices || filteredInvoices.length === 0) {
      alert('No invoices to export');
      return;
    }

    const headers = [
      'Invoice Number',
      'Invoice Title',
      'Invoice Type',
      'Client Name',
      'Project',
      'Amount',
      'Currency',
      'Invoice Date',
      'Due Date',
      'Status',
      'Payment Terms',
      'Assigned Finance POC',
      'Created Date'
    ];

    const csvData = filteredInvoices.map(invoice => [
      invoice.invoice_number || '',
      invoice.invoice_title || '',
      invoice.invoice_type || '',
      invoice.client_name || '',
      invoice.project || '',
      invoice.invoice_amount || 0,
      invoice.currency || '',
      invoice.invoice_date ? formatDateForDisplay(invoice.invoice_date, 'yyyy-MM-dd') : '',
      formatDateForDisplay(invoice.due_date, 'yyyy-MM-dd'),
      invoice.status || '',
      invoice.payment_terms?.replace('_', ' ') || '',
      invoice.assigned_finance_poc_user?.full_name || 'Unassigned',
      formatDateForDisplay(invoice.created_at, 'yyyy-MM-dd HH:mm')
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `finance_invoices_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (recordsLoading || invoicesLoading || clientMasterLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance Billing Management</h1>
          <p className="text-muted-foreground">
            Manage billing records and generate invoices
          </p>
        </div>
        <div className="flex gap-2">
          <LoggingDebugPanel />
          
          <Dialog open={isCreateClientMasterDialogOpen} onOpenChange={(open) => {
            setIsCreateClientMasterDialogOpen(open);
            if (!open) {
              // Reset client master form when dialog is closed
              clientMasterForm.reset({
                recipient_email: '',
                recipient_name: '',
                client_email: '',
                client_name: '',
                address: '',
                state: '',
                zip_code: '',
              });
            } else {
              // Reset form when dialog opens to ensure clean state
              clientMasterForm.reset({
                recipient_email: '',
                recipient_name: '',
                client_email: '',
                client_name: '',
                address: '',
                state: '',
                zip_code: '',
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Manage Clients
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Client Master</DialogTitle>
                <DialogDescription>
                  Add client contact and address information
                </DialogDescription>
              </DialogHeader>
              <Form {...clientMasterForm}>
                <form onSubmit={clientMasterForm.handleSubmit(onClientMasterSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={clientMasterForm.control}
                      name="recipient_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recipient Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter recipient's full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={clientMasterForm.control}
                      name="recipient_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recipient Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="recipient@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={clientMasterForm.control}
                      name="client_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter client organization name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={clientMasterForm.control}
                      name="client_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="client@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={clientMasterForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter complete address..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={clientMasterForm.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter state/province" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={clientMasterForm.control}
                      name="zip_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP Code *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter ZIP/postal code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsCreateClientMasterDialogOpen(false);
                        clientMasterForm.reset();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createClientMaster.isPending}>
                      {createClientMaster.isPending ? 'Creating...' : 'Add Client'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateBillingDialogOpen} onOpenChange={(open) => {
            setIsCreateBillingDialogOpen(open);
            if (!open) {
              // Reset billing form when dialog is closed
              billingForm.reset({
                client_name: '',
                project_name: '',
                contract_type: 'fixed',
                billing_cycle: 'monthly',
                contract_value: 0,
                billed_to_date: 0,
                payment_terms: 'net_30',
                internal_notes: '',
              });
            } else {
              // Reset form when dialog opens to ensure clean state
              billingForm.reset({
                client_name: '',
                project_name: '',
                contract_type: 'fixed',
                billing_cycle: 'monthly',
                contract_value: 0,
                billed_to_date: 0,
                payment_terms: 'net_30',
                internal_notes: '',
              });
            }
          }}>
            <DialogTrigger asChild>
              {/* <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create Billing Record
              </Button> */}
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Billing Record</DialogTitle>
                <DialogDescription>
                  Set up a new client billing contract
                </DialogDescription>
              </DialogHeader>
              <Form {...billingForm}>
                <form onSubmit={billingForm.handleSubmit(onBillingSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={billingForm.control}
                      name="client_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter client name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={billingForm.control}
                      name="project_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter project name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={billingForm.control}
                      name="contract_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract Type *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select contract type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CONTRACT_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={billingForm.control}
                      name="billing_cycle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Cycle *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select billing cycle" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {BILLING_CYCLES.map((cycle) => (
                                <SelectItem key={cycle.value} value={cycle.value}>
                                  {cycle.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={billingForm.control}
                      name="contract_value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract Value *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0.00" 
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={billingForm.control}
                      name="billed_to_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billed To Date *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0.00" 
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={billingForm.control}
                    name="internal_notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Add any internal notes or instructions..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsCreateBillingDialogOpen(false);
                        billingForm.reset();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createBillingRecord.isPending}>
                      {createBillingRecord.isPending ? 'Creating...' : 'Create Record'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateInvoiceDialogOpen} onOpenChange={(open) => {
            setIsCreateInvoiceDialogOpen(open);
            if (!open) {
              // Reset all states when dialog is closed
              invoiceForm.reset({
                invoice_type: 'Mechlin LLC',
                invoice_number: '',
                invoice_title: '',
                client_name: '',
                project: '',
                billing_reference: '',
                invoice_amount: 0,
                payment_terms: 'net_30',
                currency: 'USD',
                notes_to_finance: '',
                status: 'in_progress',
                client_address: '',
                client_state: '',
                client_zip_code: '',
                invoice_date: getCurrentISTDate(),
                service_period_start: undefined,
                service_period_end: undefined,
                reference_invoice_numbers: [],
                payment_receive_date: undefined,
                amount_received: undefined,
                pending_amount: undefined,
                payment_remarks: '',
                assigned_finance_poc: '',
              });
              setInvoiceTasks([]);
              setNewTask({
                task_name: '',
                task_description: '',
                hours: 0,
                rate_per_hour: 0,
                display_order: 0,
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Generate Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Generate New Invoice</DialogTitle>
                <DialogDescription>
                  Create a new invoice for client billing with tasks and comprehensive details
                </DialogDescription>
              </DialogHeader>
              <Form {...invoiceForm}>
                <form onSubmit={invoiceForm.handleSubmit(onInvoiceSubmit)} className="space-y-6 max-h-[80vh] overflow-y-auto">
                  {/* Invoice Type and Number */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={invoiceForm.control}
                      name="invoice_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Type *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select invoice type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Mechlin LLC">Mechlin LLC</SelectItem>
                              <SelectItem value="Mechlin Indian">Mechlin Indian</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="invoice_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Number *</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input 
                                placeholder="e.g., MT/DEC001, MECH/DEC002" 
                                {...field} 
                                readOnly={!selectedInvoice} // Read-only for new invoices
                                className={!selectedInvoice ? "bg-muted" : ""}
                              />
                            </FormControl>
                            {!selectedInvoice && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const newNumber = await generateInvoiceNumber();
                                  field.onChange(newNumber);
                                }}
                                title="Regenerate invoice number"
                              >
                                🔄
                              </Button>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="invoice_title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Title</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Optional - will use invoice number if not provided" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Client Information */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={invoiceForm.control}
                      name="client_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Name *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select client" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clientMaster?.map((client) => (
                                <SelectItem key={client.id} value={client.client_name}>
                                  {client.client_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="project"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter project name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="billing_reference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Reference</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter billing reference" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Auto-filled Client Details */}
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={invoiceForm.control}
                      name="client_address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Address</FormLabel>
                          <FormControl>
                            <Input placeholder="Auto-filled from client master" {...field} readOnly />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={invoiceForm.control}
                        name="client_state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input placeholder="Auto-filled" {...field} readOnly />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={invoiceForm.control}
                        name="client_zip_code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ZIP Code</FormLabel>
                            <FormControl>
                              <Input placeholder="Auto-filled" {...field} readOnly />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Date Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={invoiceForm.control}
                      name="invoice_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Date *</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value ? format(field.value, "PPP") : "Pick invoice date"}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="due_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date *</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value ? format(field.value, "PPP") : "Pick due date"}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date < getCurrentISTDate()}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Service Period (Only for Mechlin Indian) */}
                  {watchedInvoiceType === 'Mechlin Indian' && (
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={invoiceForm.control}
                        name="service_period_start"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Service Period Start</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, "PPP") : "Pick start date"}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={invoiceForm.control}
                        name="service_period_end"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Service Period End</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, "PPP") : "Pick end date"}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Reference Invoice Numbers (Only for Mechlin LLC) */}
                  {watchedInvoiceType === 'Mechlin LLC' && (
                    <FormField
                      control={invoiceForm.control}
                      name="reference_invoice_numbers"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reference Invoice Number(s)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., DEC 001, INV-002, JAN 003 (comma separated)" 
                              value={field.value?.join(', ') || ''}
                              onChange={(e) => {
                                const values = e.target.value.split(',').map(v => v.trim()).filter(v => v);
                                field.onChange(values);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Invoice Tasks Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Invoice Tasks</h3>
                      <Badge variant="secondary">
                        <Calculator className="h-3 w-3 mr-1" />
                        Total: {invoiceForm.watch('currency')} {invoiceForm.watch('invoice_amount')?.toFixed(2) || '0.00'}
                      </Badge>
                    </div>

                    {/* Existing Tasks */}
                    {invoiceTasks.length > 0 && (
                      <div className="space-y-2">
                        {invoiceTasks.map((task, index) => (
                          <div key={task.id || index} className="flex items-center gap-2 p-3 border rounded-lg">
                            <div className="flex-1 grid grid-cols-4 gap-2 text-sm">
                              <div>
                                <strong>{task.task_name}</strong>
                                {task.task_description && <p className="text-muted-foreground">{task.task_description}</p>}
                              </div>
                              <div>{task.hours}h</div>
                              <div>{invoiceForm.watch('currency')} {task.rate_per_hour}/hr</div>
                              <div className="font-medium">{invoiceForm.watch('currency')} {(task.hours * task.rate_per_hour).toFixed(2)}</div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeTask(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add New Task */}
                    <div className="grid grid-cols-12 gap-2 p-3 border rounded-lg bg-muted/50">
                      <div className="col-span-4">
                        <Input
                          placeholder="Task name"
                          value={newTask.task_name}
                          onChange={(e) => setNewTask({...newTask, task_name: e.target.value})}
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          placeholder="Description (optional)"
                          value={newTask.task_description}
                          onChange={(e) => setNewTask({...newTask, task_description: e.target.value})}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.25"
                          placeholder="Hours"
                          value={newTask.hours || ''}
                          onChange={(e) => setNewTask({...newTask, hours: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Rate/hr"
                          value={newTask.rate_per_hour || ''}
                          onChange={(e) => setNewTask({...newTask, rate_per_hour: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          size="sm"
                          onClick={addTask}
                          disabled={!newTask.task_name || newTask.hours <= 0 || newTask.rate_per_hour <= 0}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Payment Terms and Currency */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={invoiceForm.control}
                      name="payment_terms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Terms *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select payment terms" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PAYMENT_TERMS.map((term) => (
                                <SelectItem key={term.value} value={term.value}>
                                  {term.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CURRENCIES.map((currency) => (
                                <SelectItem key={currency.value} value={currency.value}>
                                  {currency.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Payment Fields (Only when status is 'paid') */}
                  {watchedStatus === 'paid' && (
                    <div className="space-y-4 p-4 border rounded-lg bg-green-50">
                      <h3 className="text-lg font-medium text-green-800">Payment Information</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={invoiceForm.control}
                          name="payment_receive_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Payment Received Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {field.value ? format(field.value, "PPP") : "Pick payment date"}
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={invoiceForm.control}
                          name="amount_received"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount Received</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  placeholder="0.00" 
                                  value={field.value || ''}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={invoiceForm.control}
                          name="pending_amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pending Amount</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  placeholder="0.00" 
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={invoiceForm.control}
                          name="assigned_finance_poc"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Assigned Finance POC</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select finance POC" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {financeUsers?.map((user) => (
                                    <SelectItem key={user.id} value={user.id}>
                                      {user.full_name} ({user.employee_id})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={invoiceForm.control}
                        name="payment_remarks"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Remarks</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Add any payment-related remarks..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Notes to Finance */}
                  <FormField
                    control={invoiceForm.control}
                    name="notes_to_finance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes to Finance</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Add any notes or instructions for the finance team..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsCreateInvoiceDialogOpen(false);
                        invoiceForm.reset();
                        setInvoiceTasks([]);
                        setNewTask({
                          task_name: '',
                          task_description: '',
                          hours: 0,
                          rate_per_hour: 0,
                          display_order: 0,
                        });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createInvoice.isPending}>
                      {createInvoice.isPending ? 'Creating...' : 'Generate Invoice'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          {/* <TabsTrigger value="billing">Billing Records</TabsTrigger> */}
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="clients">Client Master</TabsTrigger>
        </TabsList>

        <TabsContent value="billing" className="space-y-6">
          {/* Billing Records Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    placeholder="Search billing records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                  <Button 
                    variant="outline" 
                    onClick={() => setSearchTerm('')}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Billing Records Table */}
          <Card>
            <CardHeader>
              <CardTitle>Billing Records</CardTitle>
              <CardDescription>
                All client billing contracts and their current status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client & Project</TableHead>
                    <TableHead>Contract Details</TableHead>
                    <TableHead>Financial Summary</TableHead>
                    <TableHead>Billing Schedule</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBillingRecords?.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            {record.client_name}
                          </div>
                          {record.project_name && (
                            <div className="text-sm text-muted-foreground">{record.project_name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={getContractTypeBadge(record.contract_type)}>
                            {record.contract_type}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {formatDateForDisplay(record.contract_start_date, 'MMM dd')} - {formatDateForDisplay(record.contract_end_date, 'MMM dd, yyyy')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">${record.contract_value.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">
                            Billed: ${record.billed_to_date.toLocaleString()}
                          </div>
                          <div className="text-xs text-green-600">
                            Remaining: ${record.remaining_amount.toLocaleString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline">{record.billing_cycle.replace('_', ' ')}</Badge>
                          {record.next_billing_date && (
                            <div className="text-xs text-muted-foreground">
                              Next: {formatDateForDisplay(record.next_billing_date, 'MMM dd, yyyy')}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedRecord(record);
                              setIsViewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedRecord(record);
                              billingForm.reset({
                                client_name: record.client_name,
                                project_name: record.project_name || '',
                                contract_type: record.contract_type,
                                billing_cycle: record.billing_cycle,
                                contract_start_date: parseToISTDate(record.contract_start_date),
                                contract_end_date: parseToISTDate(record.contract_end_date),
                                contract_value: record.contract_value,
                                billed_to_date: record.billed_to_date,
                                next_billing_date: record.next_billing_date ? parseToISTDate(record.next_billing_date) : undefined,
                                payment_terms: record.payment_terms,
                                internal_notes: record.internal_notes || '',
                              });
                              setIsEditBillingDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          {/* Invoice Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div>
                  <Input
                    placeholder="Search invoices..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="partially_paid">Partially Paid</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {uniqueClients.map((client) => (
                        <SelectItem key={client} value={client}>
                          {client}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={invoiceTypeFilter} onValueChange={setInvoiceTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="Mechlin LLC">Mechlin LLC</SelectItem>
                      <SelectItem value="Mechlin Indian">Mechlin Indian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="xl:col-span-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          (!dateRangeFilter.from && !dateRangeFilter.to) && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span>
                          {dateRangeFilter.from ? (
                            dateRangeFilter.to ? (
                              <>
                                {formatDateForDisplay(dateRangeFilter.from, "MMM dd, yyyy")} -{" "}
                                {formatDateForDisplay(dateRangeFilter.to, "MMM dd, yyyy")}
                              </>
                            ) : (
                              formatDateForDisplay(dateRangeFilter.from, "MMM dd, yyyy")
                            )
                          ) : (
                            "Invoice Date Range"
                          )}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRangeFilter.from}
                        selected={{
                          from: dateRangeFilter.from,
                          to: dateRangeFilter.to,
                        }}
                        onSelect={(range) => {
                          setDateRangeFilter({
                            from: range?.from,
                            to: range?.to,
                          });
                        }}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('');
                      setClientFilter('');
                      setInvoiceTypeFilter('');
                      setDateRangeFilter({ from: undefined, to: undefined });
                    }}
                  >
                    Clear Filters
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={exportInvoicesToCSV}
                    disabled={!filteredInvoices || filteredInvoices.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export ({filteredInvoices?.length || 0})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoices Table */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Records</CardTitle>
              <CardDescription>
                All client invoices and their payment status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice Details</TableHead>
                    <TableHead>Client & Project</TableHead>
                    <TableHead>Amount & Currency</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices?.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{invoice.invoice_number}</div>
                          {invoice.billing_reference && (
                            <div className="text-sm text-muted-foreground">Ref: {invoice.billing_reference}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            {invoice.client_name}
                          </div>
                          {invoice.project && (
                            <div className="text-sm text-muted-foreground">{invoice.project}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{invoice.currency} {invoice.invoice_amount.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">{invoice.payment_terms.replace('_', ' ')}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDateForDisplay(invoice.due_date, 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(invoice.status)}>
                          {invoice.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setIsViewInvoiceDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            disabled={!canEditInvoices}
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              
                              // Populate form with all invoice fields including new ones
                              invoiceForm.reset({
                                invoice_type: invoice.invoice_type || 'Mechlin LLC',
                                invoice_number: invoice.invoice_number || invoice.invoice_title || '',
                                invoice_title: invoice.invoice_title || '',
                                client_name: invoice.client_name,
                                project: invoice.project || '',
                                billing_reference: invoice.billing_reference || '',
                                invoice_amount: invoice.invoice_amount,
                                due_date: parseToISTDate(invoice.due_date),
                                payment_terms: invoice.payment_terms,
                                currency: invoice.currency,
                                notes_to_finance: invoice.notes_to_finance || '',
                                status: invoice.status || 'in_progress',
                                client_address: invoice.client_address || '',
                                client_state: invoice.client_state || '',
                                client_zip_code: invoice.client_zip_code || '',
                                invoice_date: invoice.invoice_date ? parseToISTDate(invoice.invoice_date) : getCurrentISTDate(),
                                service_period_start: invoice.service_period_start ? parseToISTDate(invoice.service_period_start) : undefined,
                                service_period_end: invoice.service_period_end ? parseToISTDate(invoice.service_period_end) : undefined,
                                reference_invoice_numbers: invoice.reference_invoice_numbers || [],
                                payment_receive_date: invoice.payment_receive_date ? parseToISTDate(invoice.payment_receive_date) : undefined,
                                amount_received: invoice.amount_received || undefined,
                                pending_amount: invoice.pending_amount || undefined,
                                payment_remarks: invoice.payment_remarks || '',
                                assigned_finance_poc: invoice.assigned_finance_poc || '',
                              });
                              
                              // Load existing tasks if available
                              if (invoice.tasks && invoice.tasks.length > 0) {
                                const existingTasks = invoice.tasks.map((task: any, index: number) => ({
                                  id: task.id,
                                  task_name: task.task_name,
                                  task_description: task.task_description || '',
                                  hours: task.hours,
                                  rate_per_hour: task.rate_per_hour,
                                  display_order: task.display_order || index,
                                }));
                                setInvoiceTasks(existingTasks);
                              } else {
                                setInvoiceTasks([]);
                              }
                              
                              setIsEditInvoiceDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadInvoice(invoice)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedInvoiceForLogs(invoice);
                              setIsViewLogsDialogOpen(true);
                            }}
                            title="View Logs"
                          >
                            📋
                          </Button>
                          <Button 
                            size="sm"
                            variant="outline"
                            disabled={!canDeleteInvoices}
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete invoice ${invoice.invoice_number}? This action cannot be undone.`)) {
                                deleteInvoice.mutate(invoice.id);
                              }
                            }}
                            title={canDeleteInvoices ? "Delete Invoice" : "Delete disabled by admin"}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 disabled:text-gray-400 disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="space-y-6">
          {/* Client Master Table */}
          <Card>
            <CardHeader>
              <CardTitle>Client Master Records</CardTitle>
              <CardDescription>
                Manage client contact information and addresses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Information</TableHead>
                    <TableHead>Recipient Details</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientMaster?.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            {client.client_name}
                          </div>
                          <div className="text-sm text-muted-foreground">{client.client_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{client.recipient_name}</div>
                          <div className="text-sm text-muted-foreground">{client.recipient_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">{client.address}</div>
                          <div className="text-xs text-muted-foreground">
                            {client.state}, {client.zip_code}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedClientMaster(client);
                              setIsViewClientMasterDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedClientMaster(client);
                              clientMasterForm.reset({
                                recipient_name: client.recipient_name,
                                recipient_email: client.recipient_email,
                                client_name: client.client_name,
                                client_email: client.client_email,
                                address: client.address,
                                state: client.state,
                                zip_code: client.zip_code,
                              });
                              setIsEditClientMasterDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this client master record?')) {
                                deleteClientMaster.mutate(client.id);
                              }
                            }}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Billing Record Dialog */}
      <Dialog open={isEditBillingDialogOpen} onOpenChange={(open) => {
        setIsEditBillingDialogOpen(open);
        if (!open) {
          // Reset billing form and selected record when dialog is closed
          setSelectedRecord(null);
          billingForm.reset({
            client_name: '',
            project_name: '',
            contract_type: 'fixed',
            billing_cycle: 'monthly',
            contract_value: 0,
            billed_to_date: 0,
            payment_terms: 'net_30',
            internal_notes: '',
          });
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Billing Record</DialogTitle>
            <DialogDescription>
              Update billing contract details
            </DialogDescription>
          </DialogHeader>
          <Form {...billingForm}>
            <form onSubmit={billingForm.handleSubmit(onBillingSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={billingForm.control}
                  name="client_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter client name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={billingForm.control}
                  name="project_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter project name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={billingForm.control}
                  name="contract_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select contract type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CONTRACT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={billingForm.control}
                  name="billing_cycle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Cycle *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select billing cycle" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BILLING_CYCLES.map((cycle) => (
                            <SelectItem key={cycle.value} value={cycle.value}>
                              {cycle.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={billingForm.control}
                  name="contract_start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Start Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : "Pick start date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={billingForm.control}
                  name="contract_end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract End Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : "Pick end date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < (billingForm.getValues('contract_start_date') || getCurrentISTDate())}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={billingForm.control}
                  name="contract_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Value *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={billingForm.control}
                  name="billed_to_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billed To Date *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditBillingDialogOpen(false);
                    setSelectedRecord(null);
                    billingForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateBillingRecord.isPending}>
                  {updateBillingRecord.isPending ? 'Updating...' : 'Update Record'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Dialog - Comprehensive Form */}
      <Dialog open={isEditInvoiceDialogOpen} onOpenChange={(open) => {
        setIsEditInvoiceDialogOpen(open);
        if (!open) {
          // Reset all states when dialog is closed
          setSelectedInvoice(null);
          invoiceForm.reset({
            invoice_type: 'Mechlin LLC',
            invoice_number: '',
            invoice_title: '',
            client_name: '',
            project: '',
            billing_reference: '',
            invoice_amount: 0,
            payment_terms: 'net_30',
            currency: 'USD',
            notes_to_finance: '',
            status: 'in_progress',
            client_address: '',
            client_state: '',
            client_zip_code: '',
            invoice_date: getCurrentISTDate(),
            service_period_start: undefined,
            service_period_end: undefined,
            reference_invoice_numbers: [],
            payment_receive_date: undefined,
            amount_received: undefined,
            pending_amount: undefined,
            payment_remarks: '',
            assigned_finance_poc: '',
          });
          setInvoiceTasks([]);
          setNewTask({
            task_name: '',
            task_description: '',
            hours: 0,
            rate_per_hour: 0,
            display_order: 0,
          });
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Invoice</DialogTitle>
            <DialogDescription>
              Update invoice details, tasks, and comprehensive information
            </DialogDescription>
          </DialogHeader>
          <Form {...invoiceForm}>
            <form onSubmit={invoiceForm.handleSubmit(onInvoiceSubmit)} className="space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Invoice Type and Number */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={invoiceForm.control}
                  name="invoice_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select invoice type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Mechlin LLC">Mechlin LLC</SelectItem>
                          <SelectItem value="Mechlin Indian">Mechlin Indian</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                    <FormField
                      control={invoiceForm.control}
                      name="invoice_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., MT/DEC001, MECH/DEC002" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="invoice_title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Title</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Optional - will use invoice number if not provided" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
              </div>

              {/* Client Information */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={invoiceForm.control}
                  name="client_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clientMaster?.map((client) => (
                            <SelectItem key={client.id} value={client.client_name}>
                              {client.client_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={invoiceForm.control}
                  name="project"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter project name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={invoiceForm.control}
                  name="billing_reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Reference</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter billing reference" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Auto-filled Client Details */}
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={invoiceForm.control}
                  name="client_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Auto-filled from client master" {...field} readOnly />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={invoiceForm.control}
                    name="client_state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="Auto-filled" {...field} readOnly />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={invoiceForm.control}
                    name="client_zip_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code</FormLabel>
                        <FormControl>
                          <Input placeholder="Auto-filled" {...field} readOnly />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Date Fields */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={invoiceForm.control}
                  name="invoice_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : "Pick invoice date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={invoiceForm.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : "Pick due date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Service Period (Only for Mechlin Indian) */}
              {watchedInvoiceType === 'Mechlin Indian' && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={invoiceForm.control}
                    name="service_period_start"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Period Start</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : "Pick start date"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={invoiceForm.control}
                    name="service_period_end"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Period End</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : "Pick end date"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Reference Invoice Numbers (Only for Mechlin LLC) */}
              {watchedInvoiceType === 'Mechlin LLC' && (
                <FormField
                  control={invoiceForm.control}
                  name="reference_invoice_numbers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference Invoice Number(s)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., INV-001, INV-002 (comma separated)" 
                          value={field.value?.join(', ') || ''}
                          onChange={(e) => {
                            const values = e.target.value.split(',').map(v => v.trim()).filter(v => v);
                            field.onChange(values);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Invoice Tasks Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Invoice Tasks</h3>
                  <Badge variant="secondary">
                    <Calculator className="h-3 w-3 mr-1" />
                    Total: {invoiceForm.watch('currency')} {invoiceForm.watch('invoice_amount')?.toFixed(2) || '0.00'}
                  </Badge>
                </div>

                {/* Existing Tasks */}
                {invoiceTasks.length > 0 && (
                  <div className="space-y-2">
                    {invoiceTasks.map((task, index) => (
                      <div key={task.id || index} className="flex items-center gap-2 p-3 border rounded-lg">
                        <div className="flex-1 grid grid-cols-4 gap-2 text-sm">
                          <div>
                            <strong>{task.task_name}</strong>
                            {task.task_description && <p className="text-muted-foreground">{task.task_description}</p>}
                          </div>
                          <div>{task.hours}h</div>
                          <div>{invoiceForm.watch('currency')} {task.rate_per_hour}/hr</div>
                          <div className="font-medium">{invoiceForm.watch('currency')} {(task.hours * task.rate_per_hour).toFixed(2)}</div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTask(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Task */}
                <div className="grid grid-cols-12 gap-2 p-3 border rounded-lg bg-muted/50">
                  <div className="col-span-4">
                    <Input
                      placeholder="Task name"
                      value={newTask.task_name}
                      onChange={(e) => setNewTask({...newTask, task_name: e.target.value})}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      placeholder="Description (optional)"
                      value={newTask.task_description}
                      onChange={(e) => setNewTask({...newTask, task_description: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.25"
                      placeholder="Hours"
                      value={newTask.hours || ''}
                      onChange={(e) => setNewTask({...newTask, hours: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Rate/hr"
                      value={newTask.rate_per_hour || ''}
                      onChange={(e) => setNewTask({...newTask, rate_per_hour: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={addTask}
                      disabled={!newTask.task_name || newTask.hours <= 0 || newTask.rate_per_hour <= 0}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Payment Terms and Currency */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={invoiceForm.control}
                  name="payment_terms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment terms" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PAYMENT_TERMS.map((term) => (
                            <SelectItem key={term.value} value={term.value}>
                              {term.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={invoiceForm.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CURRENCIES.map((currency) => (
                            <SelectItem key={currency.value} value={currency.value}>
                              {currency.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Status Field */}
              <FormField
                control={invoiceForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="partially_paid">Partially Paid</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Payment Fields (Only when status is 'paid') */}
              {watchedStatus === 'paid' && (
                <div className="space-y-4 p-4 border rounded-lg bg-green-50">
                  <h3 className="text-lg font-medium text-green-800">Payment Information</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={invoiceForm.control}
                      name="payment_receive_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Received Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value ? format(field.value, "PPP") : "Pick payment date"}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="amount_received"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount Received</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0.00" 
                              value={field.value || ''}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={invoiceForm.control}
                      name="pending_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pending Amount (Calculated)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0.00" 
                              {...field}
                              value={field.value || 0}
                              disabled
                              className="bg-muted cursor-not-allowed"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Calculated as: Invoice Amount - Amount Received
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="assigned_finance_poc"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned Finance POC</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select finance POC" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {financeUsers?.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.full_name} ({user.employee_id})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={invoiceForm.control}
                    name="payment_remarks"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Remarks</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Add any payment-related remarks..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Notes to Finance */}
              <FormField
                control={invoiceForm.control}
                name="notes_to_finance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes to Finance</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add any notes or instructions for the finance team..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditInvoiceDialogOpen(false);
                    setSelectedInvoice(null);
                    invoiceForm.reset();
                    setInvoiceTasks([]);
                    setNewTask({
                      task_name: '',
                      task_description: '',
                      hours: 0,
                      rate_per_hour: 0,
                      display_order: 0,
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateInvoice.isPending}>
                  {updateInvoice.isPending ? 'Updating...' : 'Update Invoice'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Billing Record Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={(open) => {
        setIsViewDialogOpen(open);
        if (!open) {
          // Reset selected record when view dialog is closed
          setSelectedRecord(null);
        }
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Billing Record Details</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              View complete billing contract information
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-6">
              {/* Client & Project Information */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Client Name</Label>
                    <div className="text-sm font-semibold">{selectedRecord.client_name}</div>
                  </div>
                  {selectedRecord.project_name && (
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">Project Name</Label>
                      <div className="text-sm font-semibold">{selectedRecord.project_name}</div>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Contract Type</Label>
                    <Badge className={getContractTypeBadge(selectedRecord.contract_type)}>
                      {selectedRecord.contract_type}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Billing Cycle</Label>
                    <Badge variant="outline">
                      {selectedRecord.billing_cycle.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Payment Terms</Label>
                    <div className="text-sm font-semibold">
                      {selectedRecord.payment_terms.replace('_', ' ')}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Assigned Finance</Label>
                    <div className="text-sm font-semibold">
                      {selectedRecord.assigned_to_finance_user ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {selectedRecord.assigned_to_finance_user.full_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{selectedRecord.assigned_to_finance_user.full_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contract Dates */}
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Contract Start Date</Label>
                  <div className="text-sm font-semibold">
                    {formatDateForDisplay(selectedRecord.contract_start_date, 'PPP')}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Contract End Date</Label>
                  <div className="text-sm font-semibold">
                    {formatDateForDisplay(selectedRecord.contract_end_date, 'PPP')}
                  </div>
                </div>
                {selectedRecord.next_billing_date && (
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Next Billing Date</Label>
                    <div className="text-sm font-semibold">
                      {formatDateForDisplay(selectedRecord.next_billing_date, 'PPP')}
                    </div>
                  </div>
                )}
              </div>

              {/* Financial Information */}
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Contract Value</Label>
                  <div className="text-sm font-bold text-green-600">
                    ${selectedRecord.contract_value.toLocaleString()}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Billed To Date</Label>
                  <div className="text-sm font-bold">
                    ${selectedRecord.billed_to_date.toLocaleString()}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Remaining Amount</Label>
                  <div className="text-sm font-bold text-blue-600">
                    ${selectedRecord.remaining_amount.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Internal Notes */}
              {selectedRecord.internal_notes && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Internal Notes</Label>
                  <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-700">
                    {selectedRecord.internal_notes}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsViewDialogOpen(false);
                    setSelectedRecord(selectedRecord);
                    billingForm.reset({
                      client_name: selectedRecord.client_name,
                      project_name: selectedRecord.project_name || '',
                      contract_type: selectedRecord.contract_type,
                      billing_cycle: selectedRecord.billing_cycle,
                      contract_start_date: parseToISTDate(selectedRecord.contract_start_date),
                      contract_end_date: parseToISTDate(selectedRecord.contract_end_date),
                      contract_value: selectedRecord.contract_value,
                      billed_to_date: selectedRecord.billed_to_date,
                      next_billing_date: selectedRecord.next_billing_date ? parseToISTDate(selectedRecord.next_billing_date) : undefined,
                      payment_terms: selectedRecord.payment_terms,
                      internal_notes: selectedRecord.internal_notes || '',
                    });
                    setIsEditBillingDialogOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Record
                </Button>
                <Button onClick={() => setIsViewDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog - Comprehensive Form View */}
      <Dialog open={isViewInvoiceDialogOpen} onOpenChange={(open) => {
        setIsViewInvoiceDialogOpen(open);
        if (!open) {
          // Reset selected invoice when view dialog is closed
          setSelectedInvoice(null);
          // Reset tasks state
          setInvoiceTasks([]);
        } else if (selectedInvoice) {
          // Load existing tasks when opening view dialog
          if (selectedInvoice.tasks && selectedInvoice.tasks.length > 0) {
            const existingTasks = selectedInvoice.tasks.map((task: any, index: number) => ({
              id: task.id,
              task_name: task.task_name,
              task_description: task.task_description || '',
              hours: task.hours,
              rate_per_hour: task.rate_per_hour,
              display_order: task.display_order || index,
            }));
            setInvoiceTasks(existingTasks);
          } else {
            setInvoiceTasks([]);
          }
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Invoice Details</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              View complete invoice information and tasks
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Invoice Type and Number */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Invoice Type</Label>
                  <div className="p-2 bg-muted rounded-md">
                    <Badge variant="outline">{selectedInvoice.invoice_type || 'Mechlin LLC'}</Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Invoice Number</Label>
                  <div className="p-2 bg-muted rounded-md text-sm font-semibold text-blue-600">
                    {selectedInvoice.invoice_number || 'Not assigned'}
                  </div>
                </div>

                <div className="col-span-2">
                  <Label className="text-xs font-medium text-muted-foreground">Invoice Title</Label>
                  <div className="p-2 bg-muted rounded-md text-sm">
                    {selectedInvoice.invoice_title || selectedInvoice.invoice_number || 'No title'}
                  </div>
                </div>
              </div>

              {/* Client Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Client Name</Label>
                  <div className="p-2 bg-muted rounded-md text-sm font-semibold">
                    {selectedInvoice.client_name}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Project</Label>
                  <div className="p-2 bg-muted rounded-md text-sm">
                    {selectedInvoice.project || 'No project specified'}
                  </div>
                </div>
              </div>

              {/* Auto-filled Client Details */}
              {(selectedInvoice.client_address || selectedInvoice.client_state || selectedInvoice.client_zip_code) && (
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Client Address</Label>
                    <div className="p-2 bg-muted rounded-md text-sm">
                      {selectedInvoice.client_address || 'No address provided'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">State</Label>
                      <div className="p-2 bg-muted rounded-md text-sm">
                        {selectedInvoice.client_state || 'No state provided'}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">ZIP Code</Label>
                      <div className="p-2 bg-muted rounded-md text-sm">
                        {selectedInvoice.client_zip_code || 'No ZIP code provided'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Date Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Invoice Date</Label>
                  <div className="p-2 bg-muted rounded-md text-sm">
                    {selectedInvoice.invoice_date ? formatDateForDisplay(selectedInvoice.invoice_date, 'PPP') : 'Not set'}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Due Date</Label>
                  <div className="p-2 bg-muted rounded-md text-sm font-semibold">
                    {formatDateForDisplay(selectedInvoice.due_date, 'PPP')}
                  </div>
                </div>
              </div>

              {/* Service Period (Only for Mechlin Indian) */}
              {selectedInvoice.invoice_type === 'Mechlin Indian' && (selectedInvoice.service_period_start || selectedInvoice.service_period_end) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Service Period Start</Label>
                    <div className="p-2 bg-muted rounded-md text-sm">
                      {selectedInvoice.service_period_start ? formatDateForDisplay(selectedInvoice.service_period_start, 'PPP') : 'Not set'}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Service Period End</Label>
                    <div className="p-2 bg-muted rounded-md text-sm">
                      {selectedInvoice.service_period_end ? formatDateForDisplay(selectedInvoice.service_period_end, 'PPP') : 'Not set'}
                    </div>
                  </div>
                </div>
              )}

              {/* Reference Invoice Numbers (Only for Mechlin LLC) */}
              {selectedInvoice.invoice_type === 'Mechlin LLC' && selectedInvoice.reference_invoice_numbers && selectedInvoice.reference_invoice_numbers.length > 0 && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Reference Invoice Numbers</Label>
                  <div className="p-2 bg-muted rounded-md text-sm">
                    {selectedInvoice.reference_invoice_numbers.join(', ')}
                  </div>
                </div>
              )}

              {/* Invoice Tasks Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Invoice Tasks</h3>
                  <Badge variant="secondary">
                    <Calculator className="h-3 w-3 mr-1" />
                    Total: {selectedInvoice.currency} {selectedInvoice.invoice_amount?.toFixed(2) || '0.00'}
                  </Badge>
                </div>

                {/* Display Tasks */}
                {invoiceTasks.length > 0 ? (
                  <div className="space-y-2">
                    {invoiceTasks.map((task, index) => (
                      <div key={task.id || index} className="p-3 border rounded-lg bg-muted/50">
                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div>
                            <strong>{task.task_name}</strong>
                            {task.task_description && <p className="text-muted-foreground mt-1">{task.task_description}</p>}
                          </div>
                          <div className="text-center">{task.hours}h</div>
                          <div className="text-center">{selectedInvoice.currency} {task.rate_per_hour}/hr</div>
                          <div className="text-center font-medium">{selectedInvoice.currency} {(task.hours * task.rate_per_hour).toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 border rounded-lg bg-muted/50 text-center text-muted-foreground">
                    No tasks defined for this invoice
                  </div>
                )}
              </div>

              {/* Payment Terms and Currency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Payment Terms</Label>
                  <div className="p-2 bg-muted rounded-md text-sm">
                    {selectedInvoice.payment_terms?.replace('_', ' ') || 'Not specified'}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Currency</Label>
                  <div className="p-2 bg-muted rounded-md text-sm font-semibold">
                    {selectedInvoice.currency}
                  </div>
                </div>
              </div>

              {/* Status and Finance POC */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                  <div className="p-2 bg-muted rounded-md">
                    <Badge className={getStatusBadge(selectedInvoice.status)}>
                      {selectedInvoice.status?.replace('_', ' ') || 'in progress'}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Assigned Finance POC</Label>
                  <div className="p-2 bg-muted rounded-md text-sm">
                    {selectedInvoice.assigned_finance_poc_user ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {selectedInvoice.assigned_finance_poc_user.full_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{selectedInvoice.assigned_finance_poc_user.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Fields (Only when status is 'paid') */}
              {selectedInvoice.status === 'paid' && (
                <div className="space-y-4 p-4 border rounded-lg bg-green-50">
                  <h3 className="text-lg font-medium text-green-800">Payment Information</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">Payment Received Date</Label>
                      <div className="p-2 bg-white rounded-md text-sm">
                        {selectedInvoice.payment_receive_date ? formatDateForDisplay(selectedInvoice.payment_receive_date, 'PPP') : 'Not set'}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">Amount Received</Label>
                      <div className="p-2 bg-white rounded-md text-sm font-semibold">
                        {selectedInvoice.amount_received ? `${selectedInvoice.currency} ${selectedInvoice.amount_received.toFixed(2)}` : 'Not specified'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">Pending Amount</Label>
                      <div className="p-2 bg-white rounded-md text-sm">
                        {selectedInvoice.pending_amount ? `${selectedInvoice.currency} ${selectedInvoice.pending_amount.toFixed(2)}` : '0.00'}
                      </div>
                    </div>
                  </div>

                  {selectedInvoice.payment_remarks && (
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">Payment Remarks</Label>
                      <div className="p-2 bg-white rounded-md text-sm">
                        {selectedInvoice.payment_remarks}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes to Finance */}
              {selectedInvoice.notes_to_finance && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Notes to Finance</Label>
                  <div className="p-3 bg-muted rounded-md text-sm">
                    {selectedInvoice.notes_to_finance}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  disabled={!canEditInvoices}
                  title={canEditInvoices ? "Edit Invoice" : "Edit disabled by admin"}
                  onClick={() => {
                    setIsViewInvoiceDialogOpen(false);
                    setSelectedInvoice(selectedInvoice);
                    
                    // Populate form with all invoice fields including new ones
                    invoiceForm.reset({
                      invoice_type: selectedInvoice.invoice_type || 'Mechlin LLC',
                      invoice_number: selectedInvoice.invoice_number || selectedInvoice.invoice_title || '',
                      invoice_title: selectedInvoice.invoice_title || '',
                      client_name: selectedInvoice.client_name,
                      project: selectedInvoice.project || '',
                      billing_reference: selectedInvoice.billing_reference || '',
                      invoice_amount: selectedInvoice.invoice_amount,
                      due_date: parseToISTDate(selectedInvoice.due_date),
                      payment_terms: selectedInvoice.payment_terms,
                      currency: selectedInvoice.currency,
                      notes_to_finance: selectedInvoice.notes_to_finance || '',
                      status: selectedInvoice.status || 'in_progress',
                      client_address: selectedInvoice.client_address || '',
                      client_state: selectedInvoice.client_state || '',
                      client_zip_code: selectedInvoice.client_zip_code || '',
                      invoice_date: selectedInvoice.invoice_date ? parseToISTDate(selectedInvoice.invoice_date) : getCurrentISTDate(),
                      service_period_start: selectedInvoice.service_period_start ? parseToISTDate(selectedInvoice.service_period_start) : undefined,
                      service_period_end: selectedInvoice.service_period_end ? parseToISTDate(selectedInvoice.service_period_end) : undefined,
                      reference_invoice_numbers: selectedInvoice.reference_invoice_numbers || [],
                      payment_receive_date: selectedInvoice.payment_receive_date ? parseToISTDate(selectedInvoice.payment_receive_date) : undefined,
                      amount_received: selectedInvoice.amount_received || undefined,
                      pending_amount: selectedInvoice.pending_amount || undefined,
                      payment_remarks: selectedInvoice.payment_remarks || '',
                      assigned_finance_poc: selectedInvoice.assigned_finance_poc || '',
                    });
                    
                    // Tasks are already loaded in invoiceTasks state
                    setIsEditInvoiceDialogOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Invoice
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleDownloadInvoice(selectedInvoice)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button onClick={() => setIsViewInvoiceDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Client Master Dialog */}
      <Dialog open={isEditClientMasterDialogOpen} onOpenChange={(open) => {
        setIsEditClientMasterDialogOpen(open);
        if (!open) {
          // Reset client master form and selected client when dialog is closed
          setSelectedClientMaster(null);
          clientMasterForm.reset({
            recipient_email: '',
            recipient_name: '',
            client_email: '',
            client_name: '',
            address: '',
            state: '',
            zip_code: '',
          });
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Client Master</DialogTitle>
            <DialogDescription>
              Update client contact and address information
            </DialogDescription>
          </DialogHeader>
          <Form {...clientMasterForm}>
            <form onSubmit={clientMasterForm.handleSubmit(onClientMasterSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={clientMasterForm.control}
                  name="recipient_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter recipient's full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={clientMasterForm.control}
                  name="recipient_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="recipient@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={clientMasterForm.control}
                  name="client_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter client organization name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={clientMasterForm.control}
                  name="client_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="client@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={clientMasterForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter complete address..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={clientMasterForm.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter state/province" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={clientMasterForm.control}
                  name="zip_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter ZIP/postal code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditClientMasterDialogOpen(false);
                    setSelectedClientMaster(null);
                    clientMasterForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateClientMaster.isPending}>
                  {updateClientMaster.isPending ? 'Updating...' : 'Update Client'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Client Master Dialog */}
      <Dialog open={isViewClientMasterDialogOpen} onOpenChange={(open) => {
        setIsViewClientMasterDialogOpen(open);
        if (!open) {
          // Reset selected client master when view dialog is closed
          setSelectedClientMaster(null);
        }
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Client Master Details</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              View complete client contact and address information
            </DialogDescription>
          </DialogHeader>
          {selectedClientMaster && (
            <div className="space-y-6">
              {/* Client & Recipient Information */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Client Name</Label>
                    <div className="text-sm font-semibold">{selectedClientMaster.client_name}</div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Client Email</Label>
                    <div className="text-sm font-semibold">{selectedClientMaster.client_email}</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Recipient Name</Label>
                    <div className="text-sm font-semibold">{selectedClientMaster.recipient_name}</div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Recipient Email</Label>
                    <div className="text-sm font-semibold">{selectedClientMaster.recipient_email}</div>
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Address</Label>
                  <div className="text-sm font-semibold">{selectedClientMaster.address}</div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">State</Label>
                    <div className="text-sm font-semibold">{selectedClientMaster.state}</div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">ZIP Code</Label>
                    <div className="text-sm font-semibold">{selectedClientMaster.zip_code}</div>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Created By</Label>
                  <div className="text-sm font-semibold">
                    {selectedClientMaster.created_by_user ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {selectedClientMaster.created_by_user.full_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{selectedClientMaster.created_by_user.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Unknown</span>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Created At</Label>
                  <div className="text-sm font-semibold">
                    {formatDateForDisplay(selectedClientMaster.created_at, 'PPP')}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsViewClientMasterDialogOpen(false);
                    setSelectedClientMaster(selectedClientMaster);
                    clientMasterForm.reset({
                      recipient_name: selectedClientMaster.recipient_name,
                      recipient_email: selectedClientMaster.recipient_email,
                      client_name: selectedClientMaster.client_name,
                      client_email: selectedClientMaster.client_email,
                      address: selectedClientMaster.address,
                      state: selectedClientMaster.state,
                      zip_code: selectedClientMaster.zip_code,
                    });
                    setIsEditClientMasterDialogOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Client
                </Button>
                <Button onClick={() => setIsViewClientMasterDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Invoice Logs Dialog */}
      <Dialog open={isViewLogsDialogOpen} onOpenChange={(open) => {
        setIsViewLogsDialogOpen(open);
        if (!open) {
          setSelectedInvoiceForLogs(null);
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Invoice Change Logs</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {selectedInvoiceForLogs && `View all changes made to invoice ${selectedInvoiceForLogs.invoice_number}`}
            </DialogDescription>
          </DialogHeader>
          {selectedInvoiceForLogs && <InvoiceLogsView invoiceId={selectedInvoiceForLogs.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Component to display invoice logs
function InvoiceLogsView({ invoiceId }: { invoiceId: string }) {
  const { data: invoiceLogs, isLoading: invoiceLogsLoading } = useInvoiceLogs(invoiceId);
  const { data: taskLogs, isLoading: taskLogsLoading } = useInvoiceTaskLogs(invoiceId);

  if (invoiceLogsLoading || taskLogsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Combine and sort logs
  const allLogs = [
    ...(invoiceLogs || []).map((log: any) => ({ ...log, log_type: 'invoice' })),
    ...(taskLogs || []).map((log: any) => ({ ...log, log_type: 'task' }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const getActionBadge = (action: string) => {
    const variants = {
      created: 'bg-green-100 text-green-800',
      updated: 'bg-blue-100 text-blue-800',
      deleted: 'bg-red-100 text-red-800',
      status_changed: 'bg-purple-100 text-purple-800',
    };
    return variants[action as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      {allLogs.length === 0 ? (
        <div className="text-center p-8 text-muted-foreground">
          No change logs found for this invoice.
        </div>
      ) : (
        <div className="space-y-3">
          {allLogs.map((log: any) => (
            <div key={`${log.log_type}-${log.id}`} className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge className={getActionBadge(log.action)}>
                    {log.action.replace('_', ' ')}
                  </Badge>
                  <Badge variant="outline">
              {log.log_type === 'invoice' ? 'Invoice' : 'Task'}
            </Badge>
            {log.log_type === 'task' && log.task_name && (
              <span className="text-sm text-muted-foreground">
                Task: {log.task_name}
              </span>
            )}
            {log.invoice_deleted && (
              <Badge variant="destructive" className="text-xs">
                Invoice Deleted
              </Badge>
            )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDateForDisplay(log.created_at, 'PPP p')}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {log.changed_by_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{log.changed_by_name}</span>
                <span className="text-xs text-muted-foreground">({log.changed_by_email})</span>
              </div>

              {log.field_name && (
                <div className="space-y-1">
                  <div className="text-sm font-medium">Field: {log.field_name}</div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Previous Value</Label>
                      <div className="p-2 bg-red-50 rounded border text-red-800">
                        {formatValue(log.old_value)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">New Value</Label>
                      <div className="p-2 bg-green-50 rounded border text-green-800">
                        {formatValue(log.new_value)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {log.change_reason && (
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">Reason</Label>
                  <div className="text-sm italic text-muted-foreground">
                    {log.change_reason}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Debug component to test logging system
function LoggingDebugPanel() {
  const { data: testResult, refetch: testLogging, isLoading: testingLogging } = useTestLogging();
  const { mutate: testScenario, isPending: testingScenario } = useTestInvoiceScenario();
  const { mutate: testApiEndpoint, isPending: testingApi } = useTestRealApiEndpoint();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const { data: invoiceLogsCheck, refetch: checkLogs } = useCheckInvoiceLogs(selectedInvoiceId, false);

  return (
    <Dialog>
      {/* <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          🔧 Debug Logs
        </Button>
      </DialogTrigger> */}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Logging System Debug Panel</DialogTitle>
          <DialogDescription>
            Test and debug the invoice logging system
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Test Logging System */}
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium mb-2">Test Logging System</h3>
            <div className="flex flex-wrap gap-2 mb-2">
              <Button 
                onClick={() => testLogging()} 
                disabled={testingLogging}
                variant="outline"
                size="sm"
              >
                {testingLogging ? 'Testing...' : 'Test Basic Logging'}
              </Button>
              <Button 
                onClick={() => testScenario()} 
                disabled={testingScenario}
                variant="default"
                size="sm"
              >
                {testingScenario ? 'Testing...' : 'Test Invoice Scenario'}
              </Button>
              <Button 
                onClick={() => testApiEndpoint()} 
                disabled={testingApi}
                variant="secondary"
                size="sm"
              >
                {testingApi ? 'Testing...' : 'Test Real API'}
              </Button>
            </div>
            
            {testResult && (
              <div className="mt-2 p-2 bg-muted rounded text-sm">
                <strong>Basic Test Result:</strong> {JSON.stringify(testResult, null, 2)}
              </div>
            )}
          </div>

          {/* Check Specific Invoice Logs */}
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium mb-2">Check Invoice Logs</h3>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="Enter Invoice ID"
                value={selectedInvoiceId}
                onChange={(e) => setSelectedInvoiceId(e.target.value)}
              />
              <Button 
                onClick={() => checkLogs()}
                disabled={!selectedInvoiceId}
              >
                Check Logs
              </Button>
            </div>
            
            {invoiceLogsCheck && (
              <div className="mt-2 p-2 bg-muted rounded text-sm max-h-40 overflow-y-auto">
                <strong>Logs:</strong>
                <pre>{JSON.stringify(invoiceLogsCheck, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="p-4 border rounded-lg bg-green-50">
            <h3 className="font-medium mb-2">✅ Fixed: DB → DB Comparison Strategy</h3>
            <div className="text-sm space-y-2">
              <p><strong>What's Fixed:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>✅ Now uses proper API endpoint with complete invoice+tasks data</li>
                <li>✅ DB → DB comparison (before update vs after update)</li>
                <li>❌ <span className="line-through">invoice_amount</span> - No longer logged (derived field)</li>
                <li>✅ Only direct edits logged (due_date, client_name, etc.)</li>
                <li>✅ Task changes tracked by ID, not content matching</li>
              </ul>
              
              <p><strong>Test Buttons:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Test Real API</strong> - Validates the API endpoint works</li>
                <li><strong>Test Invoice Scenario</strong> - Mock test with your example data</li>
                <li><strong>Test Basic Logging</strong> - Tests logging functions</li>
              </ul>
              
              <p><strong>Expected Results:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>✅ Task deletion: "LLC Testing" removed</li>
                <li>✅ Direct field changes: client_name, due_date, etc.</li>
                <li>❌ NO invoice_amount logs (derived from tasks)</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}