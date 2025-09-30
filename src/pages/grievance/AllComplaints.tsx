import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAllComplaints, useComplaintCategories, useUpdateComplaintStatus, useRejectComplaint, useApproveComplaint, useReassignComplaint } from '@/hooks/useGrievance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  List,
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  Download,
  Calendar,
  UserCheck,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const categoryColors = {
  harassment: 'bg-red-500',
  discrimination: 'bg-orange-500',
  workplace: 'bg-yellow-500',
  management: 'bg-blue-500',
  policy: 'bg-purple-500',
  safety: 'bg-green-500',
  other: 'bg-gray-500'
};

export function AllComplaints() {
  const { user } = useAuth();
  const { data: complaints, isLoading: complaintsLoading } = useAllComplaints();
  const { data: categories } = useComplaintCategories();
  const updateComplaintStatus = useUpdateComplaintStatus();
  const approveComplaintMutation = useApproveComplaint();
  const rejectComplaintMutation = useRejectComplaint();
  const reassignComplaintMutation = useReassignComplaint();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [newStatus, setNewStatus] = useState('');
  const [resolution, setResolution] = useState('');
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [selectedResolver, setSelectedResolver] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [resolverOptions, setResolverOptions] = useState<any[]>([]);

  const filteredComplaints = complaints?.filter(complaint => {
    const matchesSearch = complaint.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         complaint.user?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         complaint.user?.employee_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || statusFilter === 'all' || complaint.status === statusFilter;
    const matchesPriority = !priorityFilter || priorityFilter === 'all' || complaint.priority === priorityFilter;
    const matchesCategory = !categoryFilter || categoryFilter === 'all' || complaint.category?.name === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'closed':
        return <XCircle className="h-4 w-4 text-gray-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'open':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      open: 'bg-yellow-100 text-yellow-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
    };
    return variants[priority as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const handleStatusUpdate = () => {
    if (!selectedComplaint || !newStatus) return;

    updateComplaintStatus.mutate({
      id: selectedComplaint.id,
      status: newStatus,
      resolution: resolution.trim() || undefined,
      assigned_to: user?.id
    }, {
      onSuccess: () => {
        setIsUpdateDialogOpen(false);
        setNewStatus('');
        setResolution('');
        setSelectedComplaint(null);
      }
    });
  };

  const handleApproveComplaint = () => {
    if (!selectedComplaint || !selectedResolver || !user) return;

    approveComplaintMutation.mutate({
      id: selectedComplaint.id,
      assigned_to: selectedResolver,
      approvedBy: user.id
    }, {
      onSuccess: () => {
        setIsApproveDialogOpen(false);
        setSelectedComplaint(null);
        setSelectedResolver('');
      }
    });
  };

  const handleRejectComplaint = () => {
    if (!selectedComplaint || !rejectionReason.trim() || !user) return;

    rejectComplaintMutation.mutate({
      id: selectedComplaint.id,
      rejectedBy: user.id,
      reason: rejectionReason.trim()
    }, {
      onSuccess: () => {
        setIsRejectDialogOpen(false);
        setSelectedComplaint(null);
        setRejectionReason('');
      }
    });
  };

  const handleReassignComplaint = () => {
    if (!selectedComplaint || !selectedResolver || !user) return;

    reassignComplaintMutation.mutate({
      id: selectedComplaint.id,
      new_assigned_to: selectedResolver,
      reassignedBy: user.id,
      reason: reassignReason.trim() || undefined
    }, {
      onSuccess: () => {
        setIsReassignDialogOpen(false);
        setSelectedComplaint(null);
        setSelectedResolver('');
        setReassignReason('');
      }
    });
  };

  const handleExportComplaints = () => {
    if (!filteredComplaints) return;
    
    // Create CSV content
    const headers = ['ID', 'Title', 'Employee', 'Employee ID', 'Category', 'Priority', 'Status', 'Created Date', 'Assigned To', 'Resolution'];
    const csvContent = [
      headers.join(','),
      ...filteredComplaints.map(complaint => [
        complaint.id,
        `"${complaint.title}"`,
        `"${complaint.user?.full_name || ''}"`,
        complaint.user?.employee_id || '',
        complaint.category?.name || '',
        complaint.priority,
        complaint.status,
        format(new Date(complaint.created_at), 'yyyy-MM-dd'),
        `"${complaint.assigned_to_user?.full_name || 'Unassigned'}"`,
        `"${complaint.resolution || ''}"`
      ].join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `complaints_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (complaintsLoading) {
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
          <h1 className="text-3xl font-bold tracking-tight">All Complaints</h1>
          <p className="text-muted-foreground">
            Complete record of all employee complaints and grievances
          </p>
        </div>
        <Button onClick={handleExportComplaints} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Input
                placeholder="Search complaints..."
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
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
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
                  setStatusFilter('');
                  setPriorityFilter('');
                  setCategoryFilter('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Complaints Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Complaints ({filteredComplaints?.length || 0})</CardTitle>
          <CardDescription>
            Complete record of all employee complaints and their resolution status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Complaint</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredComplaints?.map((complaint) => (
                <TableRow key={complaint.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium line-clamp-1">{complaint.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2">{complaint.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {complaint.user?.full_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{complaint.user?.full_name}</div>
                        <div className="text-sm text-muted-foreground">{complaint.user?.employee_id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${categoryColors[complaint.category?.name as keyof typeof categoryColors] || 'bg-gray-500'}`} />
                      <span className="text-sm">{complaint.category?.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPriorityBadge(complaint.priority)}>
                      {complaint.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(complaint.status)}
                      <Badge className={getStatusBadge(complaint.status)}>
                        {complaint.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {complaint.assigned_to_user ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-xs">
                            {complaint.assigned_to_user.full_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{complaint.assigned_to_user.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>{format(new Date(complaint.created_at), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedComplaint(complaint)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Complaint Details</DialogTitle>
                            <DialogDescription>
                              Complete information about this complaint
                            </DialogDescription>
                          </DialogHeader>
                          {selectedComplaint && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="font-medium">Employee:</p>
                                  <p className="text-muted-foreground">{selectedComplaint.user?.full_name}</p>
                                </div>
                                <div>
                                  <p className="font-medium">Employee ID:</p>
                                  <p className="text-muted-foreground">{selectedComplaint.user?.employee_id}</p>
                                </div>
                                <div>
                                  <p className="font-medium">Department:</p>
                                  <p className="text-muted-foreground">{selectedComplaint.user?.department?.name || 'Not assigned'}</p>
                                </div>
                                <div>
                                  <p className="font-medium">Email:</p>
                                  <p className="text-muted-foreground">{selectedComplaint.user?.email}</p>
                                </div>
                                <div>
                                  <p className="font-medium">Category:</p>
                                  <p className="text-muted-foreground">{selectedComplaint.category?.name}</p>
                                </div>
                                <div>
                                  <p className="font-medium">Priority:</p>
                                  <Badge className={getPriorityBadge(selectedComplaint.priority)}>
                                    {selectedComplaint.priority}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="font-medium">Status:</p>
                                  <Badge className={getStatusBadge(selectedComplaint.status)}>
                                    {selectedComplaint.status.replace('_', ' ')}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="font-medium">Assigned To:</p>
                                  <p className="text-muted-foreground">{selectedComplaint.assigned_to_user?.full_name || 'Unassigned'}</p>
                                </div>
                              </div>
                              
                              <div>
                                <p className="font-medium mb-2">Description:</p>
                                <p className="text-muted-foreground text-sm">{selectedComplaint.description}</p>
                              </div>

                              {selectedComplaint.resolution && (
                                <div>
                                  <p className="font-medium mb-2">Resolution:</p>
                                  <p className="text-muted-foreground text-sm">{selectedComplaint.resolution}</p>
                                </div>
                              )}

                              <div className="flex justify-between text-xs text-muted-foreground pt-4 border-t">
                                <span>Submitted: {format(new Date(selectedComplaint.created_at), 'MMM dd, yyyy HH:mm')}</span>
                                {selectedComplaint.resolved_at && (
                                  <span>Resolved: {format(new Date(selectedComplaint.resolved_at), 'MMM dd, yyyy HH:mm')}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      {/* Action buttons based on complaint status */}
                      {complaint.status === 'open' && (
                        <div className="flex gap-1">
                          <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm"
                                onClick={() => {
                                  setSelectedComplaint(complaint);
                                  setSelectedResolver(complaint.assigned_to || '');
                                }}
                              >
                                <UserCheck className="h-4 w-4 mr-1" />
                                Approve & Assign
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Approve & Assign Complaint</DialogTitle>
                                <DialogDescription>
                                  Approve this complaint and assign it to a resolver
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="p-4 bg-gray-50 rounded-lg">
                                  <h4 className="font-medium mb-2">{selectedComplaint?.title}</h4>
                                  <p className="text-sm text-muted-foreground">{selectedComplaint?.description}</p>
                                </div>
                                
                                <div>
                                  <Label>Assign to Resolver *</Label>
                                  {selectedComplaint?.assigned_to && (
                                    <p className="text-xs text-muted-foreground mb-2">
                                      Resolver pre-selected by complainant
                                    </p>
                                  )}
                                  <Select value={selectedResolver} onValueChange={setSelectedResolver}>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue placeholder="Select resolver" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {resolverOptions?.map((resolver) => (
                                        <SelectItem key={resolver.id} value={resolver.id}>
                                          <div className="flex items-center gap-2">
                                            <span>{resolver.full_name}</span>
                                            <Badge variant="outline" className="text-xs">
                                              {resolver.role?.name?.replace('_', ' ')}
                                            </Badge>
                                            {resolver.department?.name && (
                                              <span className="text-xs text-muted-foreground">
                                                • {resolver.department.name}
                                              </span>
                                            )}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={handleApproveComplaint} 
                                    disabled={!selectedResolver || approveComplaintMutation.isPending}
                                  >
                                    {approveComplaintMutation.isPending ? 'Approving...' : 'Approve & Assign'}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedComplaint(complaint);
                                  setRejectionReason('');
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Reject Complaint</DialogTitle>
                                <DialogDescription>
                                  Reject this complaint with a reason
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="p-4 bg-gray-50 rounded-lg">
                                  <h4 className="font-medium mb-2">{selectedComplaint?.title}</h4>
                                  <p className="text-sm text-muted-foreground">{selectedComplaint?.description}</p>
                                </div>
                                
                                <div>
                                  <Label>Reason for Rejection *</Label>
                                  <Textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Explain why this complaint is being rejected..."
                                    className="mt-1"
                                    rows={3}
                                  />
                                </div>

                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={handleRejectComplaint} 
                                    disabled={!rejectionReason.trim() || rejectComplaintMutation.isPending}
                                    variant="destructive"
                                  >
                                    {rejectComplaintMutation.isPending ? 'Rejecting...' : 'Reject Complaint'}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}

                      {(complaint.status === 'in_progress' || complaint.status === 'approved') && (
                        <>
                          <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedComplaint(complaint);
                                  setSelectedResolver('');
                                  setReassignReason('');
                                }}
                              >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Reassign
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Reassign Complaint</DialogTitle>
                                <DialogDescription>
                                  Reassign this complaint to a different resolver
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="p-4 bg-gray-50 rounded-lg">
                                  <h4 className="font-medium mb-2">{selectedComplaint?.title}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Currently assigned to: {selectedComplaint?.assigned_to_user?.full_name}
                                  </p>
                                </div>
                                
                                <div>
                                  <Label>Reassign to *</Label>
                                  <Select value={selectedResolver} onValueChange={setSelectedResolver}>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue placeholder="Select new resolver" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {resolverOptions?.map((resolver) => (
                                        <SelectItem key={resolver.id} value={resolver.id}>
                                          <div className="flex items-center gap-2">
                                            <span>{resolver.full_name}</span>
                                            <Badge variant="outline" className="text-xs">
                                              {resolver.role?.name?.replace('_', ' ')}
                                            </Badge>
                                            {resolver.department?.name && (
                                              <span className="text-xs text-muted-foreground">
                                                • {resolver.department.name}
                                              </span>
                                            )}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <Label>Reason for Reassignment</Label>
                                  <Textarea
                                    value={reassignReason}
                                    onChange={(e) => setReassignReason(e.target.value)}
                                    placeholder="Explain why this complaint is being reassigned..."
                                    className="mt-1"
                                    rows={3}
                                  />
                                </div>

                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => setIsReassignDialogOpen(false)}>
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={handleReassignComplaint} 
                                    disabled={!selectedResolver || reassignComplaintMutation.isPending}
                                  >
                                    {reassignComplaintMutation.isPending ? 'Reassigning...' : 'Reassign Complaint'}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm"
                                onClick={() => {
                                  setSelectedComplaint(complaint);
                                  setNewStatus(complaint.status);
                                  setResolution(complaint.resolution || '');
                                }}
                              >
                                Update Status
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Update Complaint Status</DialogTitle>
                                <DialogDescription>
                                  Update the status and resolution for {selectedComplaint?.user?.full_name}'s complaint
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Status</Label>
                                  <Select value={newStatus} onValueChange={setNewStatus}>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="in_progress">In Progress</SelectItem>
                                      <SelectItem value="resolved">Resolved</SelectItem>
                                      <SelectItem value="closed">Closed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div>
                                  <Label>Resolution Notes</Label>
                                  <Textarea
                                    value={resolution}
                                    onChange={(e) => setResolution(e.target.value)}
                                    placeholder="Add resolution details or notes..."
                                    className="mt-1"
                                    rows={3}
                                  />
                                </div>

                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>
                                    Cancel
                                  </Button>
                                  <Button onClick={handleStatusUpdate} disabled={updateComplaintStatus.isPending}>
                                    {updateComplaintStatus.isPending ? 'Updating...' : 'Update Status'}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredComplaints?.length === 0 && (
            <div className="text-center py-8">
              <List className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Complaints Found</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter || priorityFilter || categoryFilter
                  ? 'No complaints match your current filters.'
                  : 'No complaints have been submitted yet.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}