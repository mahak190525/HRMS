import React, { useState } from 'react';
import { useAllExitProcesses, useExitProcessById, useUpdateExitProcess, useDeleteExitProcess } from '@/hooks/useEmployees';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { ConfirmDelete } from '@/components/ui/confirm-delete';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  LogOut,
  Search,
  Filter,
  Eye,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Building,
  Phone,
  Mail,
  FileText,
  ClipboardCheck,
  Edit,
  Trash2,
  Save
} from 'lucide-react';
import { format } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const exitProcessSchema = z.object({
  resignation_date: z.string().min(1, 'Resignation date is required'),
  last_working_day: z.string().min(1, 'Last working day is required'),
  notice_period_days: z.number().min(1, 'Notice period must be at least 1 day'),
  reason_for_leaving: z.string().optional(),
  new_company: z.string().optional(),
  new_position: z.string().optional(),
  exit_type: z.string().min(1, 'Exit type is required'),
  status: z.string().min(1, 'Status is required'),
});

type ExitProcessFormData = z.infer<typeof exitProcessSchema>;

export function ExitProcess() {
  const { data: exitProcesses, isLoading: exitProcessesLoading } = useAllExitProcesses();
  const updateExitProcess = useUpdateExitProcess();
  const deleteExitProcess = useDeleteExitProcess();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedProcess, setSelectedProcess] = useState<any>(null);
  const [selectedProcessId, setSelectedProcessId] = useState<string>('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<any>(null);
  
  const { data: processDetails, isLoading: detailsLoading } = useExitProcessById(selectedProcessId);

  const form = useForm<ExitProcessFormData>({
    resolver: zodResolver(exitProcessSchema),
    defaultValues: {
      resignation_date: '',
      last_working_day: '',
      notice_period_days: 30,
      reason_for_leaving: '',
      new_company: '',
      new_position: '',
      exit_type: 'resignation',
      status: 'initiated',
    },
  });

  const filteredProcesses = exitProcesses?.filter(process => {
    const matchesSearch = process.user?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         process.user?.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         process.user?.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || process.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'clearance_pending':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'bg-green-100 text-green-800',
      in_progress: 'bg-blue-100 text-blue-800',
      clearance_pending: 'bg-yellow-100 text-yellow-800',
      initiated: 'bg-gray-100 text-gray-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getExitTypeBadge = (exitType: string) => {
    const variants = {
      resignation: 'bg-blue-100 text-blue-800',
      termination: 'bg-red-100 text-red-800',
      retirement: 'bg-purple-100 text-purple-800',
      contract_end: 'bg-orange-100 text-orange-800',
      voluntary: 'bg-green-100 text-green-800',
    };
    return variants[exitType as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const handleEditProcess = (process: any) => {
    setEditingProcess(process);
    form.reset({
      resignation_date: process.resignation_date,
      last_working_day: process.last_working_day,
      notice_period_days: process.notice_period_days,
      reason_for_leaving: process.reason_for_leaving || '',
      new_company: process.new_company || '',
      new_position: process.new_position || '',
      exit_type: process.exit_type,
      status: process.status,
    });
    setIsEditDialogOpen(true);
  };

  const onExitProcessSubmit = async (data: ExitProcessFormData) => {
    if (!editingProcess) return;

    updateExitProcess.mutate({
      id: editingProcess.id,
      updates: data
    }, {
      onSuccess: () => {
        setIsEditDialogOpen(false);
        setEditingProcess(null);
        form.reset();
      }
    });
  };

  const totalExits = exitProcesses?.length || 0;
  const completedExits = exitProcesses?.filter(p => p.status === 'completed').length || 0;
  const pendingExits = exitProcesses?.filter(p => p.status !== 'completed').length || 0;
  const avgNoticePeriod = exitProcesses?.reduce((sum, p) => sum + p.notice_period_days, 0) / (exitProcesses?.length || 1) || 0;

  if (exitProcessesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Exit Process Dashboard</h1>
        <p className="text-muted-foreground">
          Manage employee resignations and exit procedures
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Exits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalExits}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedExits}</div>
            <p className="text-xs text-muted-foreground">
              {totalExits > 0 ? Math.round((completedExits / totalExits) * 100) : 0}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingExits}</div>
            <p className="text-xs text-muted-foreground">Active processes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg Notice Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(avgNoticePeriod)}</div>
            <p className="text-xs text-muted-foreground">Days</p>
          </CardContent>
        </Card>
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
                placeholder="Search employees..."
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
                  <SelectItem value="initiated">Initiated</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="clearance_pending">Clearance Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
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

      {/* Exit Processes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Exit Processes</CardTitle>
          <CardDescription>
            All employee exit processes and their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Exit Type</TableHead>
                <TableHead>Resignation Date</TableHead>
                <TableHead>Last Working Day</TableHead>
                <TableHead>Notice Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProcesses?.map((process) => (
                <TableRow key={process.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{process.user?.full_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{process.user?.full_name}</div>
                        <div className="text-sm text-muted-foreground">{process.user?.employee_id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building className="h-3 w-3" />
                      {process.user?.department?.name || 'Not assigned'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getExitTypeBadge(process.exit_type)}>
                      {process.exit_type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(process.resignation_date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{format(new Date(process.last_working_day), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{process.notice_period_days} days</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(process.status)}
                      <Badge className={getStatusBadge(process.status)}>
                        {process.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            asChild
                            onClick={() => {
                              setSelectedProcess(process);
                              setSelectedProcessId(process.id);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Exit Process Details</DialogTitle>
                            <DialogDescription>
                              Complete exit process information for {selectedProcess?.user?.full_name}
                            </DialogDescription>
                          </DialogHeader>
                          {detailsLoading ? (
                            <LoadingSpinner size="sm" />
                          ) : processDetails && (
                            <Tabs defaultValue="overview" className="space-y-4">
                              <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="overview">Overview</TabsTrigger>
                                <TabsTrigger value="clearance">Clearance</TabsTrigger>
                                <TabsTrigger value="documents">Documents</TabsTrigger>
                                <TabsTrigger value="interview">Interview</TabsTrigger>
                              </TabsList>

                              <TabsContent value="overview" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="font-medium">Employee:</p>
                                    <p className="text-muted-foreground">{processDetails.user?.full_name}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Employee ID:</p>
                                    <p className="text-muted-foreground">{processDetails.user?.employee_id}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Department:</p>
                                    <p className="text-muted-foreground">{processDetails.user?.department?.name}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Role:</p>
                                    <p className="text-muted-foreground">{processDetails.user?.role?.name}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Exit Type:</p>
                                    <Badge className={getExitTypeBadge(processDetails.exit_type)}>
                                      {processDetails.exit_type.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                  <div>
                                    <p className="font-medium">Status:</p>
                                    <Badge className={getStatusBadge(processDetails.status)}>
                                      {processDetails.status.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                  <div>
                                    <p className="font-medium">Resignation Date:</p>
                                    <p className="text-muted-foreground">
                                      {format(new Date(processDetails.resignation_date), 'MMM dd, yyyy')}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Last Working Day:</p>
                                    <p className="text-muted-foreground">
                                      {format(new Date(processDetails.last_working_day), 'MMM dd, yyyy')}
                                    </p>
                                  </div>
                                </div>

                                {processDetails.reason_for_leaving && (
                                  <div>
                                    <p className="font-medium mb-2">Reason for Leaving:</p>
                                    <p className="text-muted-foreground text-sm">{processDetails.reason_for_leaving}</p>
                                  </div>
                                )}

                                {processDetails.new_company && (
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="font-medium">New Company:</p>
                                      <p className="text-muted-foreground">{processDetails.new_company}</p>
                                    </div>
                                    <div>
                                      <p className="font-medium">New Position:</p>
                                      <p className="text-muted-foreground">{processDetails.new_position}</p>
                                    </div>
                                  </div>
                                )}
                              </TabsContent>

                              <TabsContent value="clearance" className="space-y-4">
                                <div className="space-y-3">
                                  {processDetails.clearance_items?.map((item: any) => (
                                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                                      <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${item.is_completed ? 'bg-green-100' : 'bg-gray-100'}`}>
                                          {item.is_completed ? (
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                          ) : (
                                            <Clock className="h-4 w-4 text-gray-600" />
                                          )}
                                        </div>
                                        <div>
                                          <div className="font-medium">{item.item_name}</div>
                                          <div className="text-sm text-muted-foreground">{item.description}</div>
                                        </div>
                                      </div>
                                      <Badge className={item.is_completed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                        {item.is_completed ? 'Completed' : 'Pending'}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </TabsContent>

                              <TabsContent value="documents" className="space-y-4">
                                <div className="space-y-3">
                                  {processDetails.documents?.map((doc: any) => (
                                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                                      <div className="flex items-center gap-3">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                          <div className="font-medium">{doc.document_name}</div>
                                          <div className="text-sm text-muted-foreground">{doc.document_type}</div>
                                        </div>
                                      </div>
                                      <Badge className={getStatusBadge(doc.status)}>
                                        {doc.status}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </TabsContent>

                              <TabsContent value="interview" className="space-y-4">
                                {processDetails.interview ? (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <p className="font-medium">Interviewer:</p>
                                        <p className="text-muted-foreground">{processDetails.interview.interviewer?.full_name}</p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Status:</p>
                                        <Badge className={getStatusBadge(processDetails.interview.status)}>
                                          {processDetails.interview.status}
                                        </Badge>
                                      </div>
                                    </div>
                                    
                                    {processDetails.interview.overall_satisfaction_rating && (
                                      <div>
                                        <p className="font-medium mb-2">Satisfaction Ratings:</p>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                          <div>Overall: {processDetails.interview.overall_satisfaction_rating}/5</div>
                                          <div>Work Environment: {processDetails.interview.work_environment_rating}/5</div>
                                          <div>Management: {processDetails.interview.management_rating}/5</div>
                                          <div>Growth: {processDetails.interview.growth_opportunities_rating}/5</div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-center text-muted-foreground py-8">
                                    Exit interview not scheduled yet
                                  </p>
                                )}
                              </TabsContent>
                            </Tabs>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      <Button 
                        size="sm" 
                        variant="outline"
                        asChild
                        onClick={() => handleEditProcess(process)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      <ConfirmDelete
                        trigger={(
                          <Button size="sm" variant="outline">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        title="Delete Exit Process"
                        description="Are you sure you want to delete this exit process? This action cannot be undone and will remove all associated clearance items and documents."
                        confirmText="Delete Process"
                        onConfirm={() => deleteExitProcess.mutate(process.id)}
                        loading={deleteExitProcess.isPending}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Exit Process Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Exit Process</DialogTitle>
            <DialogDescription>
              Update exit process information and status
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onExitProcessSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="resignation_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resignation Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="last_working_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Working Day *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="notice_period_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notice Period (Days) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="exit_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exit Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select exit type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="resignation">Resignation</SelectItem>
                          <SelectItem value="termination">Termination</SelectItem>
                          <SelectItem value="retirement">Retirement</SelectItem>
                          <SelectItem value="contract_end">Contract End</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="initiated">Initiated</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="clearance_pending">Clearance Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason_for_leaving"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Leaving</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter reason for leaving" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="new_company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Company</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter new company name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="new_position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Position</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter new position" {...field} />
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
                    setIsEditDialogOpen(false);
                    setEditingProcess(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateExitProcess.isPending}>
                  {updateExitProcess.isPending ? 'Updating...' : 'Update Process'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}