import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInvoices, useCreateInvoice, useUpdateInvoice, useFinanceUsers, useInvoiceComments, useCreateInvoiceComment } from '@/hooks/useBDTeam';
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
  FileText,
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
  MessageSquare,
  Paperclip,
  Send,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { PAYMENT_TERMS, CURRENCIES } from '@/constants';

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
  assigned_finance_poc: z.string().optional(),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

export function AllInvoices() {
  const { user } = useAuth();
  const { data: invoices, isLoading: invoicesLoading } = useInvoices();
  const { data: financeUsers } = useFinanceUsers();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const createInvoiceComment = useCreateInvoiceComment();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState('');

  const { data: comments, isLoading: commentsLoading } = useInvoiceComments(selectedInvoice?.id || '');

  const form = useForm<InvoiceFormData>({
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
      assigned_finance_poc: '',
    },
  });

  const filteredInvoices = invoices?.filter(invoice => {
    const matchesSearch = invoice.invoice_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.project?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const onSubmit = async (data: InvoiceFormData) => {
    if (!user) return;

    const invoiceData = {
      ...data,
      due_date: data.due_date.toISOString().split('T')[0],
      created_by: user.id,
      status: 'assigned',
    };

    if (selectedInvoice) {
      updateInvoice.mutate({
        id: selectedInvoice.id,
        updates: invoiceData
      }, {
        onSuccess: () => {
          setIsEditDialogOpen(false);
          setSelectedInvoice(null);
          form.reset();
        }
      });
    } else {
      createInvoice.mutate(invoiceData, {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
          form.reset();
        }
      });
    }
  };

  const handleEdit = (invoice: any) => {
    setSelectedInvoice(invoice);
    form.reset({
      invoice_title: invoice.invoice_title,
      client_name: invoice.client_name,
      project: invoice.project || '',
      billing_reference: invoice.billing_reference || '',
      invoice_amount: invoice.invoice_amount,
      due_date: new Date(invoice.due_date),
      payment_terms: invoice.payment_terms,
      currency: invoice.currency,
      notes_to_finance: invoice.notes_to_finance || '',
      assigned_finance_poc: invoice.assigned_finance_poc || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleAddComment = async () => {
    if (!selectedInvoice || !newComment.trim() || !user) return;

    createInvoiceComment.mutate({
      invoice_id: selectedInvoice.id,
      user_id: user.id,
      comment: newComment.trim(),
      is_internal: true
    }, {
      onSuccess: () => {
        setNewComment('');
      }
    });
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'sent':
        return <Send className="h-4 w-4 text-purple-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  if (invoicesLoading) {
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
          <h1 className="text-3xl font-bold tracking-tight">All Invoices</h1>
          <p className="text-muted-foreground">
            Manage client invoices and track payment status
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
              <DialogDescription>
                Generate a new invoice for client billing
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
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
                    control={form.control}
                    name="billing_reference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Reference</FormLabel>
                        <FormControl>
                          <Input placeholder="Contract/Milestone ID" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
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
                    control={form.control}
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
                </div>

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

                <FormField
                  control={form.control}
                  name="assigned_finance_poc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Finance POC</FormLabel>
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
                  name="notes_to_finance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes to Finance</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add instructions or notes for the finance team..."
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
                      setSelectedInvoice(null);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createInvoice.isPending || updateInvoice.isPending}>
                    {(createInvoice.isPending || updateInvoice.isPending) ? 'Saving...' : selectedInvoice ? 'Update Invoice' : 'Create Invoice'}
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
                <TableHead>Assigned Finance</TableHead>
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
                    <div className="flex items-center gap-2">
                      {getStatusIcon(invoice.status)}
                      <Badge className={getStatusBadge(invoice.status)}>
                        {invoice.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {invoice.assigned_finance_poc_user ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {invoice.assigned_finance_poc_user.full_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{invoice.assigned_finance_poc_user.full_name}</span>
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
                        asChild
                        onClick={() => handleEdit(invoice)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Dialog open={isCommentsDialogOpen} onOpenChange={setIsCommentsDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            asChild
                            onClick={() => setSelectedInvoice(invoice)}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Invoice Communication</DialogTitle>
                            <DialogDescription>
                              BD-Finance communication for {selectedInvoice?.invoice_title}
                            </DialogDescription>
                          </DialogHeader>
                          <Tabs defaultValue="details" className="space-y-4">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="details">Invoice Details</TabsTrigger>
                              <TabsTrigger value="comments">Comments</TabsTrigger>
                            </TabsList>

                            <TabsContent value="details" className="space-y-4">
                              {selectedInvoice && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="font-medium">Client:</p>
                                      <p className="text-muted-foreground">{selectedInvoice.client_name}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Project:</p>
                                      <p className="text-muted-foreground">{selectedInvoice.project || 'Not specified'}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Amount:</p>
                                      <p className="text-muted-foreground">{selectedInvoice.currency} {selectedInvoice.invoice_amount.toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Due Date:</p>
                                      <p className="text-muted-foreground">{format(new Date(selectedInvoice.due_date), 'MMM dd, yyyy')}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">Status:</p>
                                      <Badge className={getStatusBadge(selectedInvoice.status)}>
                                        {selectedInvoice.status.replace('_', ' ')}
                                      </Badge>
                                    </div>
                                    <div>
                                      <p className="font-medium">Payment Terms:</p>
                                      <p className="text-muted-foreground">{selectedInvoice.payment_terms.replace('_', ' ')}</p>
                                    </div>
                                  </div>
                                  
                                  {selectedInvoice.notes_to_finance && (
                                    <div>
                                      <p className="font-medium mb-2">Notes to Finance:</p>
                                      <p className="text-muted-foreground text-sm">{selectedInvoice.notes_to_finance}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </TabsContent>

                            <TabsContent value="comments" className="space-y-4">
                              <div className="max-h-60 overflow-y-auto space-y-3">
                                {commentsLoading ? (
                                  <LoadingSpinner size="sm" />
                                ) : comments && comments.length > 0 ? (
                                  comments.map((comment: any) => (
                                    <div key={comment.id} className="flex gap-3 p-3 border rounded-lg">
                                      <Avatar className="h-8 w-8">
                                        <AvatarImage src={comment.user?.avatar_url} />
                                        <AvatarFallback className="text-xs">
                                          {comment.user?.full_name.charAt(0)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-sm font-medium">{comment.user?.full_name}</span>
                                          <span className="text-xs text-muted-foreground">
                                            {format(new Date(comment.created_at), 'MMM dd, HH:mm')}
                                          </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{comment.comment}</p>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-center text-muted-foreground py-4">
                                    No comments yet
                                  </p>
                                )}
                              </div>
                              
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Add a comment..."
                                  value={newComment}
                                  onChange={(e) => setNewComment(e.target.value)}
                                  className="flex-1"
                                />
                                <Button 
                                  onClick={handleAddComment}
                                  disabled={!newComment.trim() || createInvoiceComment.isPending}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              </div>
                            </TabsContent>
                          </Tabs>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Invoice</DialogTitle>
            <DialogDescription>
              Update invoice details and information
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
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
                  control={form.control}
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
                  control={form.control}
                  name="assigned_finance_poc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Finance POC</FormLabel>
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
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setSelectedInvoice(null);
                    form.reset();
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
    </div>
  );
}