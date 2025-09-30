import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useFinanceBillingRecords, 
  useFinanceInvoices, 
  useCreateFinanceBillingRecord, 
  useUpdateFinanceBillingRecord,
  useCreateFinanceInvoice,
  useUpdateFinanceInvoice
} from '@/hooks/useFinance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Calendar as CalendarIcon,
  DollarSign,
  Building,
  Clock,
  User,
  FileText,
  Send
} from 'lucide-react';
import { format } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { CONTRACT_TYPES, BILLING_CYCLES, PAYMENT_TERMS, CURRENCIES } from '@/constants';

const billingSchema = z.object({
  client_name: z.string().min(1, 'Client name is required'),
  project_name: z.string().optional(),
  contract_type: z.string().min(1, 'Contract type is required'),
  billing_cycle: z.string().min(1, 'Billing cycle is required'),
  contract_start_date: z.date({ required_error: 'Start date is required' }),
  contract_end_date: z.date({ required_error: 'End date is required' }),
  contract_value: z.number().min(0, 'Contract value must be positive'),
  billed_to_date: z.number().min(0, 'Billed amount must be positive'),
  next_billing_date: z.date().optional(),
  payment_terms: z.string().min(1, 'Payment terms are required'),
  internal_notes: z.string().optional(),
});

const invoiceSchema = z.object({
  invoice_title: z.string().min(1, 'Invoice title is required'),
  client_name: z.string().min(1, 'Client name is required'),
  project: z.string().optional(),
  billing_reference: z.string().optional(),
  invoice_amount: z.number().min(0.01, 'Invoice amount must be greater than 0'),
  due_date: z.date({ required_error: 'Due date is required' }),
  payment_terms: z.string().min(1, 'Payment terms are required'),
  currency: z.string().min(1, 'Currency is required'),
  notes_to_finance: z.string().optional(),
});

type BillingFormData = z.infer<typeof billingSchema>;
type InvoiceFormData = z.infer<typeof invoiceSchema>;

export function AllBilling() {
  const { user } = useAuth();
  const { data: billingRecords, isLoading: recordsLoading } = useFinanceBillingRecords();
  const { data: invoices, isLoading: invoicesLoading } = useFinanceInvoices();
  const createBillingRecord = useCreateFinanceBillingRecord();
  const updateBillingRecord = useUpdateFinanceBillingRecord();
  const createInvoice = useCreateFinanceInvoice();
  const updateInvoice = useUpdateFinanceInvoice();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isCreateBillingDialogOpen, setIsCreateBillingDialogOpen] = useState(false);
  const [isCreateInvoiceDialogOpen, setIsCreateInvoiceDialogOpen] = useState(false);
  const [isEditBillingDialogOpen, setIsEditBillingDialogOpen] = useState(false);
  const [isEditInvoiceDialogOpen, setIsEditInvoiceDialogOpen] = useState(false);

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
      invoice_title: '',
      client_name: '',
      project: '',
      billing_reference: '',
      invoice_amount: 0,
      payment_terms: 'net_30',
      currency: 'USD',
      notes_to_finance: '',
    },
  });

  const filteredBillingRecords = billingRecords?.filter(record => {
    const matchesSearch = record.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.project_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredInvoices = invoices?.filter(invoice => {
    const matchesSearch = invoice.invoice_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.client_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const onBillingSubmit = async (data: BillingFormData) => {
    if (!user) return;

    const billingData = {
      ...data,
      contract_start_date: data.contract_start_date.toISOString().split('T')[0],
      contract_end_date: data.contract_end_date.toISOString().split('T')[0],
      next_billing_date: data.next_billing_date?.toISOString().split('T')[0],
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

    const invoiceData = {
      ...data,
      due_date: data.due_date.toISOString().split('T')[0],
      created_by: user.id,
      assigned_finance_poc: user.id,
      status: 'assigned',
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
        }
      });
    } else {
      createInvoice.mutate(invoiceData, {
        onSuccess: () => {
          setIsCreateInvoiceDialogOpen(false);
          invoiceForm.reset();
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
      assigned: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      sent: 'bg-purple-100 text-purple-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  if (recordsLoading || invoicesLoading) {
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
          <Dialog open={isCreateBillingDialogOpen} onOpenChange={setIsCreateBillingDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create Billing Record
              </Button>
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

          <Dialog open={isCreateInvoiceDialogOpen} onOpenChange={setIsCreateInvoiceDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Generate Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Generate New Invoice</DialogTitle>
                <DialogDescription>
                  Create a new invoice for client billing
                </DialogDescription>
              </DialogHeader>
              <Form {...invoiceForm}>
                <form onSubmit={invoiceForm.handleSubmit(onInvoiceSubmit)} className="space-y-4">
                  <FormField
                    control={invoiceForm.control}
                    name="invoice_title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice Title *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Jan 2025 - Dev Sprint 1 - Client App" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={invoiceForm.control}
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={invoiceForm.control}
                      name="invoice_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Amount *</FormLabel>
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
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
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

      <Tabs defaultValue="billing" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="billing">Billing Records</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
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
                            {format(new Date(record.contract_start_date), 'MMM dd')} - {format(new Date(record.contract_end_date), 'MMM dd, yyyy')}
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
                              Next: {format(new Date(record.next_billing_date), 'MMM dd, yyyy')}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('');
                    }}
                  >
                    Clear Filters
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
                          <div className="font-medium">{invoice.invoice_title}</div>
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
                          {format(new Date(invoice.due_date), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(invoice.status)}>
                          {invoice.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm">
                            <Send className="h-4 w-4" />
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
    </div>
  );
}