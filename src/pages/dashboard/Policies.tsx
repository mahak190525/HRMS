import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { 
  FileText, 
  Search, 
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  History,
  Eye,
  Info
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PolicySimpleEditor } from '@/components/ui/policy-simple-editor';
import { usePolicies } from '@/hooks/usePolicies';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import { formatDateForDisplay } from '@/utils/dateUtils';
import type { Policy } from '@/types';
import { cn } from '@/lib/utils';
import { notificationApi } from '@/services/notificationApi';

interface PolicyAssignment {
  id: string;
  policy_id: string;
  user_id: string;
  assigned_by: string;
  assigned_at: string;
  due_date?: string;
  acknowledged_at?: string;
  status: 'pending' | 'acknowledged' | 'overdue';
  notes?: string;
  policy?: Policy;
  assigned_by_user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export function Policies() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [assignments, setAssignments] = useState<PolicyAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [selectedAssignmentDetails, setSelectedAssignmentDetails] = useState<PolicyAssignment | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  const { policies, loading, error } = usePolicies();

  // Handle URL tab parameter - only run once on mount
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['all', 'assigned', 'history'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount to prevent re-runs

  // Memoize fetchAssignments to prevent recreation on every render
  const fetchAssignments = useCallback(async () => {
    if (!user) return;

    try {
      setLoadingAssignments(true);
      const { data, error } = await supabase
        .from('policy_assignments')
        .select(`
          *,
          policy:policies(*),
          assigned_by_user:users!policy_assignments_assigned_by_fkey(id, full_name, email)
        `)
        .eq('user_id', user.id)
        .order('assigned_at', { ascending: false });

      if (error) throw error;

      const processedAssignments = (data || []).map((assignment: any) => {
        const dueDateObj = assignment.due_date ? new Date(assignment.due_date) : null;
        const now = new Date();
        let status: 'pending' | 'acknowledged' | 'overdue' = 'pending';
        
        if (assignment.acknowledged_at) {
          status = 'acknowledged';
        } else if (dueDateObj && dueDateObj < now) {
          status = 'overdue';
        }

        return {
          ...assignment,
          status
        };
      });

      setAssignments(processedAssignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Failed to load policy assignments');
    } finally {
      setLoadingAssignments(false);
    }
  }, [user?.id]); // Only depend on user.id, not the whole user object

  // Fetch assignments for current user - only when tab changes or user changes
  useEffect(() => {
    if (user && (activeTab === 'assigned' || activeTab === 'history')) {
      fetchAssignments();
    }
  }, [user?.id, activeTab, fetchAssignments]);

  const handleAcknowledge = async (assignmentId: string) => {
    if (!user) return;

    try {
      setAcknowledging(assignmentId);
      
      // Get assignment details before updating
      const { data: assignmentData, error: fetchError } = await supabase
        .from('policy_assignments')
        .select(`
          *,
          policy:policies(id, name),
          user:users!policy_assignments_user_id_fkey(id, full_name)
        `)
        .eq('id', assignmentId)
        .eq('user_id', user.id)
        .single();

      if (fetchError) throw fetchError;

      // Update the assignment
      const { error } = await supabase
        .from('policy_assignments')
        .update({
          acknowledged_at: new Date().toISOString(),
          status: 'acknowledged'
        })
        .eq('id', assignmentId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Send notifications to HR and Admin
      if (assignmentData?.policy && assignmentData?.user) {
        try {
          // Get HR and Admin users
          const { data: allUsers, error: usersError } = await supabase
            .from('users')
            .select(`
              id,
              full_name,
              role:roles(name),
              department:departments!users_department_id_fkey(name),
              "isSA"
            `)
            .eq('status', 'active');

          if (!usersError && allUsers) {
            const hrAdminUsers = allUsers
              .filter((u: any) => {
                const isHRRole = u.role?.name && ['hr', 'hrm', 'admin', 'super_admin'].includes(u.role.name);
                const isSuperAdmin = u.isSA === true;
                const isHRDepartment = u.department?.name && u.department.name.toLowerCase().includes('hr');
                return isHRRole || isSuperAdmin || isHRDepartment;
              })
              .map((u: any) => u.id);

            if (hrAdminUsers.length > 0) {
              await notificationApi.createPolicyAcknowledgedNotification({
                employee_id: assignmentData.user.id,
                employee_name: assignmentData.user.full_name || 'Employee',
                policy_name: assignmentData.policy.name,
                policy_id: assignmentData.policy.id,
                hr_admin_user_ids: hrAdminUsers
              });
            }
          }
        } catch (notificationError) {
          console.error('Error sending policy acknowledgment notifications:', notificationError);
          // Don't throw - acknowledgment was successful, notification failure shouldn't break the flow
        }
      }

      toast.success('Policy acknowledged successfully');
      await fetchAssignments();
    } catch (error: any) {
      console.error('Error acknowledging policy:', error);
      toast.error(error.message || 'Failed to acknowledge policy');
    } finally {
      setAcknowledging(null);
    }
  };

  // Memoize filteredPolicies to prevent recalculation on every render
  const filteredPolicies = useMemo(() => {
    return policies.filter(policy => {
      const matchesSearch = policy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           policy.content.toLowerCase().includes(searchTerm.toLowerCase());
      const isActive = policy.is_active;
      return matchesSearch && isActive;
    });
  }, [policies, searchTerm]);

  // Memoize assigned and history policies
  const assignedPolicies = useMemo(() => 
    assignments.filter(a => a.status === 'pending' || a.status === 'overdue'),
    [assignments]
  );

  const historyPolicies = useMemo(() => 
    assignments.filter(a => a.status === 'acknowledged'),
    [assignments]
  );

  // Auto-select first policy when policies load - only run once when data is ready
  useEffect(() => {
    if (activeTab === 'all' && !loading && filteredPolicies.length > 0 && !selectedPolicy) {
      setSelectedPolicy(filteredPolicies[0]);
    }
  }, [loading, filteredPolicies, activeTab, selectedPolicy]);

  // Update selected policy when search changes - only if current selection is invalid
  useEffect(() => {
    if (activeTab === 'all' && !loading && filteredPolicies.length > 0) {
      setSelectedPolicy(prev => {
        // If no previous selection, select first
        if (!prev) return filteredPolicies[0];
        // If previous selection is still in filtered list, keep it
        if (filteredPolicies.find(p => p.id === prev.id)) return prev;
        // Otherwise, select first from filtered list
        return filteredPolicies[0];
      });
    }
  }, [filteredPolicies, activeTab, loading]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'acknowledged':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'overdue':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const variants = {
      acknowledged: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'acknowledged':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Acknowledged</Badge>;
      case 'overdue':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Overdue</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return formatDate(dateString);
  };

  if (loading && activeTab === 'all') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error && activeTab === 'all') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Unable to Load Policies
          </h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Policies</h1>
        <p className="text-muted-foreground">
          View organizational policies and manage your assignments
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Policies</TabsTrigger>
          <TabsTrigger value="assigned">Assigned Policies</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* All Policies Tab */}
        <TabsContent value="all" className="space-y-6">
          <div className="h-full flex bg-white rounded-lg border">
            {/* Left Sidebar - Policy List */}
            <div className="w-80 border-r border-gray-200 flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">All Policies</h2>
                <div className="text-sm text-gray-500 mb-3">
                  {filteredPolicies.length} of {policies.filter(p => p.is_active).length} policies
                </div>
                
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search policies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Policy List */}
              <ScrollArea className="flex-1">
                <div className="p-2">
                  {filteredPolicies.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">
                        {searchTerm ? 'No policies found' : 'No policies available'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredPolicies.map((policy) => (
                        <div
                          key={policy.id}
                          onClick={() => setSelectedPolicy(policy)}
                          className={cn(
                            "p-3 rounded-lg cursor-pointer transition-colors flex items-center gap-3",
                            selectedPolicy?.id === policy.id
                              ? "bg-blue-50 border border-blue-200 text-blue-900"
                              : "hover:bg-gray-50 text-gray-700"
                          )}
                        >
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm font-medium truncate">
                            {policy.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Right Main Content - Policy Details */}
            <div className="flex-1 flex flex-col">
              {selectedPolicy ? (
                <>
                  {/* Policy Header */}
                  <div className="p-2 border-b border-gray-200 bg-gray-50">
                    <h1 className="text-lg font-semibold text-gray-900">
                      {selectedPolicy.name}
                    </h1>
                    <div className="text-sm text-gray-500 mt-1">
                      Version {selectedPolicy.version} • Updated {new Date(selectedPolicy.updated_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Policy Content */}
                  <div className="flex-1 overflow-auto">
                    <div className="p-6">
                      <PolicySimpleEditor
                        content={selectedPolicy.content}
                        onChange={() => {}} // Read-only
                        editable={false}
                        className="w-full"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Select a Policy
                    </h3>
                    <p className="text-gray-600">
                      Choose a policy from the list to view its details
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Assigned Policies Tab */}
        <TabsContent value="assigned" className="space-y-6">
          {loadingAssignments ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : assignedPolicies.length === 0 ? (
            <div className="text-center py-12">
              <Send className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Assigned Policies
              </h3>
              <p className="text-gray-600">
                You don't have any pending policy assignments at the moment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignedPolicies.map((assignment) => (
                <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-medium truncate">
                          {assignment.policy?.name || 'Unknown Policy'}
                        </CardTitle>
                        {assignment.policy && (
                          <CardDescription className="text-xs mt-1">
                            Version {assignment.policy.version}
                          </CardDescription>
                        )}
                      </div>
                      {getStatusBadge(assignment.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-500">Assigned:</span>{' '}
                        <span className="font-medium">{formatTimeAgo(assignment.assigned_at)}</span>
                      </div>
                      {assignment.due_date && (
                        <div>
                          <span className="text-gray-500">Due:</span>{' '}
                          <span className={cn(
                            "font-medium",
                            assignment.status === 'overdue' && "text-red-600"
                          )}>
                            {formatDate(assignment.due_date)}
                          </span>
                        </div>
                      )}
                      {assignment.assigned_by_user && (
                        <div>
                          <span className="text-gray-500">Assigned by:</span>{' '}
                          <span className="font-medium">{assignment.assigned_by_user.full_name}</span>
                        </div>
                      )}
                      {assignment.notes && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-gray-600">{assignment.notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          if (assignment.policy) {
                            setSelectedPolicy(assignment.policy);
                            setActiveTab('all');
                          }
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleAcknowledge(assignment.id)}
                        disabled={acknowledging === assignment.id}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {acknowledging === assignment.id ? 'Acknowledging...' : 'Acknowledge'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Policy History</CardTitle>
              <CardDescription>
                View all your previous policy assignments and their acknowledgement status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAssignments ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : historyPolicies.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No History
                  </h3>
                  <p className="text-gray-600">
                    You haven't acknowledged any policies yet.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Policy</TableHead>
                      <TableHead>Dates</TableHead>
                      {/*<TableHead>Version</TableHead>*/}
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                      {/* <TableHead>Comments</TableHead> */}
                      <TableHead>Assigned</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyPolicies.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-medium">
                          {assignment.policy?.name || 'Unknown Policy'}
                        </TableCell>
                        <TableCell>
                          {formatDateForDisplay(assignment.assigned_at, 'MMM dd')}
                          {assignment.acknowledged_at && (
                            <> - {formatDateForDisplay(assignment.acknowledged_at, 'MMM dd, yyyy')}</>
                          )}
                        </TableCell>
                        {/* <TableCell>
                          {assignment.policy ? (
                            <>
                              v{assignment.policy.version}
                            </>
                          ) : (
                            '-'
                          )}
                        </TableCell> */}
                        <TableCell className="max-w-xs truncate">
                          {assignment.notes || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(assignment.status)}
                            <Badge className={getStatusBadgeClass(assignment.status)}>
                              {assignment.status}
                            </Badge>
                          </div>
                        </TableCell>
                        {/* <TableCell className="max-w-xs">
                          {assignment.notes ? (
                            <div className="text-sm text-gray-600 truncate" title={assignment.notes}>
                              {assignment.notes}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">No comments</span>
                          )}
                        </TableCell> */}
                        <TableCell>
                          {formatDateForDisplay(assignment.assigned_at, 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (assignment.policy) {
                                  setSelectedPolicy(assignment.policy);
                                  setActiveTab('all');
                                }
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Policy
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedAssignmentDetails(assignment);
                                setIsDetailsDialogOpen(true);
                              }}
                            >
                              <Info className="h-4 w-4 mr-1" />
                              Details
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assignment Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assignment Details</DialogTitle>
            <DialogDescription>
              Complete information about this policy assignment
            </DialogDescription>
          </DialogHeader>
          {selectedAssignmentDetails && (
            <div className="space-y-4">
              {/* Policy Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Policy</label>
                  <p className="mt-1 text-sm font-medium">
                    {selectedAssignmentDetails.policy?.name || 'Unknown Policy'}
                  </p>
                  {selectedAssignmentDetails.policy && (
                    <p className="text-xs text-gray-500 mt-1">
                      Version {selectedAssignmentDetails.policy.version}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedAssignmentDetails.status)}
                      <Badge className={getStatusBadgeClass(selectedAssignmentDetails.status)}>
                        {selectedAssignmentDetails.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Assigned At</label>
                  <p className="mt-1 text-sm font-medium">
                    {formatDateForDisplay(selectedAssignmentDetails.assigned_at, 'MMM dd, yyyy')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatTimeAgo(selectedAssignmentDetails.assigned_at)}
                  </p>
                </div>
                {selectedAssignmentDetails.acknowledged_at && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Acknowledged At</label>
                    <p className="mt-1 text-sm font-medium">
                      {formatDateForDisplay(selectedAssignmentDetails.acknowledged_at, 'MMM dd, yyyy')}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatTimeAgo(selectedAssignmentDetails.acknowledged_at)}
                    </p>
                  </div>
                )}
              </div>

              {/* Due Date and Assigned By */}
              <div className="grid grid-cols-2 gap-4">
                {selectedAssignmentDetails.due_date && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Due Date</label>
                    <p className={cn(
                      "mt-1 text-sm font-medium",
                      selectedAssignmentDetails.status === 'overdue' && "text-red-600"
                    )}>
                      {formatDateForDisplay(selectedAssignmentDetails.due_date, 'MMM dd, yyyy')}
                    </p>
                  </div>
                )}
                {selectedAssignmentDetails.assigned_by_user && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Assigned By</label>
                    <p className="mt-1 text-sm font-medium">
                      {selectedAssignmentDetails.assigned_by_user.full_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedAssignmentDetails.assigned_by_user.email}
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedAssignmentDetails.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Notes</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md border">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedAssignmentDetails.notes}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    if (selectedAssignmentDetails.policy) {
                      setSelectedPolicy(selectedAssignmentDetails.policy);
                      setActiveTab('all');
                      setIsDetailsDialogOpen(false);
                    }
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Policy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDetailsDialogOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Policies;
