import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBillingRecords, useCreateBillingRecord, useUpdateBillingRecord, useFinanceUsers } from '@/hooks/useBDTeam';
import { notificationApi } from '@/services/api';
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
  User
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
  assigned_to_finance: z.string().optional(),
}).refine((data) => data.contract_end_date > data.contract_start_date, {
  message: "End date must be after start date",
  path: ["contract_end_date"],
}).refine((data) => data.billed_to_date <= data.contract_value, {
  message: "Billed amount cannot exceed contract value",
  path: ["billed_to_date"],
});

type BillingFormData = z.infer<typeof billingSchema>;

export function AllBillings() {
  const { user } = useAuth();
  const { data: billingRecords, isLoading: recordsLoading } = useBillingRecords();
  const { data: financeUsers } = useFinanceUsers();
  const createBillingRecord = useCreateBillingRecord();
  const updateBillingRecord = useUpdateBillingRecord();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [contractTypeFilter, setContractTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const form = useForm<BillingFormData>({
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
      assigned_to_finance: '',
    },
  });

  const filteredRecords = billingRecords?.filter(record => {
    const matchesSearch = record.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.project_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesContractType = !contractTypeFilter || contractTypeFilter === 'all' || record.contract_type === contractTypeFilter;
    
    return matchesSearch && matchesContractType;
  });

  const onSubmit = async (data: BillingFormData) => {
    if (!user) return;

    const billingData = {
      ...data,
      contract_start_date: data.contract_start_date.toISOString().split('T')[0],
      contract_end_date: data.contract_end_date.toISOString().split('T')[0],
      next_billing_date: data.next_billing_date?.toISOString().split('T')[0],
      created_by: user.id,
    };

    if (selectedRecord) {
      updateBillingRecord.mutate({
        id: selectedRecord.id,
        updates: billingData
      }, {
        onSuccess: async (updatedRecord) => {
          // Send notification if finance assignment changed
          if (data.assigned_to_finance && data.assigned_to_finance !== selectedRecord.assigned_to_finance) {
            try {
              await notificationApi.createNotification({
                user_id: data.assigned_to_finance,
                title: 'Billing Record Assigned',
                message: `You have been assigned to manage the billing record for ${data.client_name}${data.project_name ? ` - ${data.project_name}` : ''}. Contract value: $${data.contract_value.toLocaleString()}`,
                type: 'general',
                data: { 
                  billing_record_id: updatedRecord.id, 
                  action: 'manage',
                  target: 'bd/billing'
                }
              });
            } catch (error) {
              console.error('Failed to send assignment notification:', error);
            }
          }
          
          setIsEditDialogOpen(false);
          setSelectedRecord(null);
          form.reset();
        }
      });
    } else {
      createBillingRecord.mutate(billingData, {
        onSuccess: async (newRecord) => {
          // Send notification if finance user is assigned
          if (data.assigned_to_finance) {
            try {
              await notificationApi.createNotification({
                user_id: data.assigned_to_finance,
                title: 'New Billing Record Assigned',
                message: `You have been assigned to manage a new billing record for ${data.client_name}${data.project_name ? ` - ${data.project_name}` : ''}. Contract value: $${data.contract_value.toLocaleString()}`,
                type: 'general',
                data: { 
                  billing_record_id: newRecord.id, 
                  action: 'manage',
                  target: 'bd/billing'
                }
              });
            } catch (error) {
              console.error('Failed to send assignment notification:', error);
            }
          }
          
          setIsCreateDialogOpen(false);
          form.reset();
        }
      });
    }
  };

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    form.reset({
      client_name: record.client_name,
      project_name: record.project_name || '',
      contract_type: record.contract_type,
      billing_cycle: record.billing_cycle,
      contract_start_date: new Date(record.contract_start_date),
      contract_end_date: new Date(record.contract_end_date),
      contract_value: record.contract_value,
      billed_to_date: record.billed_to_date,
      next_billing_date: record.next_billing_date ? new Date(record.next_billing_date) : undefined,
      payment_terms: record.payment_terms,
      internal_notes: record.internal_notes || '',
      assigned_to_finance: record.assigned_to_finance || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleDownloadClientHistory = (clientName: string) => {
    const clientRecords = billingRecords?.filter(r => r.client_name === clientName);
    if (!clientRecords) return;
    
    // Create CSV content
    const headers = ['Client Name', 'Project', 'Contract Type', 'Contract Value', 'Billed To Date', 'Remaining', 'Start Date', 'End Date', 'Payment Terms'];
    const csvContent = [
      headers.join(','),
      ...clientRecords.map(record => [
        record.client_name,
        record.project_name || '',
        record.contract_type,
        record.contract_value,
        record.billed_to_date,
        record.remaining_amount,
        record.contract_start_date,
        record.contract_end_date,
        record.payment_terms
      ].join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${clientName.replace(/\s+/g, '_')}_billing_history.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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

  if (recordsLoading) {
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
          <h1 className="text-3xl font-bold tracking-tight">All Billings</h1>
          <p className="text-muted-foreground">
            Manage client billing records and contracts
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
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
                    control={form.control}
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
                    control={form.control}
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
                    control={form.control}
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
                    control={form.control}
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
                    control={form.control}
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
                              disabled={(date) => date < (form.getValues('contract_start_date') || new Date())}
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
                    control={form.control}
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
                    control={form.control}
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="next_billing_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Next Billing Date</FormLabel>
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
                                {field.value ? format(field.value, "PPP") : "Pick billing date"}
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
                    control={form.control}
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
                </div>

                <FormField
                  control={form.control}
                  name="assigned_to_finance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned to Finance</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select finance contact" />
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

                <FormField
                  control={form.control}
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
                      setIsCreateDialogOpen(false);
                      setIsEditDialogOpen(false);
                      setSelectedRecord(null);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createBillingRecord.isPending || updateBillingRecord.isPending}>
                    {(createBillingRecord.isPending || updateBillingRecord.isPending) ? 'Saving...' : selectedRecord ? 'Update Record' : 'Create Record'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
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
                placeholder="Search clients or projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Select value={contractTypeFilter} onValueChange={setContractTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Contract Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contract Types</SelectItem>
                  {CONTRACT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setContractTypeFilter('');
                }}
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
                <TableHead>Assigned Finance</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords?.map((record) => (
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
                    {record.assigned_to_finance_user ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {record.assigned_to_finance_user.full_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{record.assigned_to_finance_user.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unassigned</span>
                    )}
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
                        onClick={() => handleEdit(record)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => handleDownloadClientHistory(record.client_name)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Dialog */}
<Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
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
              {format(new Date(selectedRecord.contract_start_date), 'PPP')}
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Contract End Date</Label>
            <div className="text-sm font-semibold">
              {format(new Date(selectedRecord.contract_end_date), 'PPP')}
            </div>
          </div>
          {selectedRecord.next_billing_date && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Next Billing Date</Label>
              <div className="text-sm font-semibold">
                {format(new Date(selectedRecord.next_billing_date), 'PPP')}
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
                    handleEdit(selectedRecord);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Record
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleDownloadClientHistory(selectedRecord.client_name)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download History
                </Button>
                <Button onClick={() => setIsViewDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Billing Record</DialogTitle>
            <DialogDescription>
              Update billing contract details
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                            disabled={(date) => date < (form.getValues('contract_start_date') || new Date())}
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
                  control={form.control}
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
                  control={form.control}
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="next_billing_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Billing Date</FormLabel>
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
                              {field.value ? format(field.value, "PPP") : "Pick billing date"}
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
                  control={form.control}
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
              </div>

              <FormField
                control={form.control}
                name="assigned_to_finance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned to Finance</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select finance contact" />
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

              <FormField
                control={form.control}
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
                    setIsEditDialogOpen(false);
                    setSelectedRecord(null);
                    form.reset();
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
    </div>
  );
}