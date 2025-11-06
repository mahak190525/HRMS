import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search,
  Filter,
  Calendar,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { usePolicies } from '@/hooks/usePolicies';
import { useAllEmployees } from '@/hooks/useEmployees';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Policy } from '@/types';

interface PolicyAssignmentHistory {
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
  user?: {
    id: string;
    full_name: string;
    email: string;
    employee_id?: string;
  };
  assigned_by_user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export const PolicyHistoryPage: React.FC = () => {
  const { policies } = usePolicies();
  const { data: employees } = useAllEmployees();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [history, setHistory] = useState<PolicyAssignmentHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<PolicyAssignmentHistory | null>(null);

  // Fetch history
  React.useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('policy_assignments')
        .select(`
          *,
          policy:policies(*),
          user:users!policy_assignments_user_id_fkey(id, full_name, email, employee_id),
          assigned_by_user:users!policy_assignments_assigned_by_fkey(id, full_name, email)
        `)
        .order('assigned_at', { ascending: false });

      if (error) throw error;

      const processedHistory = (data || []).map((assignment: any) => {
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

      setHistory(processedHistory);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Failed to load policy history');
    } finally {
      setLoading(false);
    }
  };

  // Filter history
  const filteredHistory = useMemo(() => {
    return history.filter(assignment => {
      const matchesSearch = !searchTerm || 
        assignment.policy?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.user?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.user?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.assigned_by_user?.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesPolicy = selectedPolicy === 'all' || assignment.policy_id === selectedPolicy;
      const matchesUser = selectedUser === 'all' || assignment.user_id === selectedUser;
      const matchesStatus = statusFilter === 'all' || assignment.status === statusFilter;
      
      return matchesSearch && matchesPolicy && matchesUser && matchesStatus;
    });
  }, [history, searchTerm, selectedPolicy, selectedUser, statusFilter]);

  // Get unique users from history for filter
  const uniqueUsers = useMemo(() => {
    const users = new Map();
    history.forEach(assignment => {
      if (assignment.user_id && assignment.user) {
        users.set(assignment.user_id, {
          id: assignment.user_id,
          name: assignment.user.full_name,
          email: assignment.user.email
        });
      }
    });
    return Array.from(users.values());
  }, [history]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = history.length;
    const pending = history.filter(a => a.status === 'pending').length;
    const acknowledged = history.filter(a => a.status === 'acknowledged').length;
    const overdue = history.filter(a => a.status === 'overdue').length;
    const recent = history.filter(a => {
      const assignedDate = new Date(a.assigned_at);
      const now = new Date();
      const diffInDays = (now.getTime() - assignedDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffInDays <= 7;
    }).length;

    return { total, pending, acknowledged, overdue, recent };
  }, [history]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`;
    
    return formatDate(dateString);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'acknowledged':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Acknowledged
          </Badge>
        );
      case 'overdue':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Overdue
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const AssignmentDetailDialog: React.FC<{ assignment: PolicyAssignmentHistory }> = ({ assignment }) => (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Assignment Details
        </DialogTitle>
      </DialogHeader>
      
      <div className="space-y-4">
        {/* Policy Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Policy</label>
            <p className="mt-1 text-sm font-medium">{assignment.policy?.name || 'N/A'}</p>
            {assignment.policy && (
              <p className="text-xs text-gray-500">Version {assignment.policy.version}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Status</label>
            <div className="mt-1">{getStatusBadge(assignment.status)}</div>
          </div>
        </div>

        {/* Employee Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Employee</label>
            <p className="mt-1 text-sm font-medium">
              {assignment.user?.full_name || 'N/A'}
            </p>
            {assignment.user?.email && (
              <p className="text-xs text-gray-500">{assignment.user.email}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Assigned By</label>
            <p className="mt-1 text-sm font-medium">
              {assignment.assigned_by_user?.full_name || 'N/A'}
            </p>
            {assignment.assigned_by_user?.email && (
              <p className="text-xs text-gray-500">{assignment.assigned_by_user.email}</p>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Assigned At</label>
            <p className="mt-1 text-sm font-medium">{formatDateTime(assignment.assigned_at)}</p>
            <p className="text-xs text-gray-500">{formatTimeAgo(assignment.assigned_at)}</p>
          </div>
          {assignment.due_date && (
            <div>
              <label className="text-sm font-medium text-gray-500">Due Date</label>
              <p className="mt-1 text-sm font-medium">{formatDate(assignment.due_date)}</p>
              {assignment.status === 'overdue' && (
                <p className="text-xs text-red-600">Overdue</p>
              )}
            </div>
          )}
        </div>

        {assignment.acknowledged_at && (
          <div>
            <label className="text-sm font-medium text-gray-500">Acknowledged At</label>
            <p className="mt-1 text-sm font-medium">{formatDateTime(assignment.acknowledged_at)}</p>
            <p className="text-xs text-gray-500">{formatTimeAgo(assignment.acknowledged_at)}</p>
          </div>
        )}

        {assignment.notes && (
          <div>
            <label className="text-sm font-medium text-gray-500">Notes</label>
            <div className="mt-1 p-3 bg-gray-50 rounded-md border">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {assignment.notes}
              </p>
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <History className="h-5 w-5" />
              Policy Assignment History
            </h2>
            <p className="text-sm text-gray-600">
              View all policy assignments and acknowledgements
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchHistory} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <Card>
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{stats.total}</div>
                  <div className="text-xs text-gray-600">Total</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-600">{stats.pending}</div>
                  <div className="text-xs text-gray-600">Pending</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{stats.acknowledged}</div>
                  <div className="text-xs text-gray-600">Acknowledged</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">{stats.overdue}</div>
                  <div className="text-xs text-gray-600">Overdue</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">{stats.recent}</div>
                  <div className="text-xs text-gray-600">Last 7 Days</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search history..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={selectedPolicy} onValueChange={setSelectedPolicy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Policy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Policies</SelectItem>
              {policies.filter(p => p.is_active).map(policy => (
                <SelectItem key={policy.id} value={policy.id}>
                  {policy.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {uniqueUsers.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading && filteredHistory.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <History className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No history found
              </h3>
              <p className="text-gray-600">
                {searchTerm || selectedPolicy !== 'all' || selectedUser !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your search terms or filters'
                  : 'Policy assignment history will appear here'}
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="overflow-x-auto">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Assigned By</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Acknowledged</TableHead>
                    <TableHead className="w-[100px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map(assignment => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{assignment.policy?.name || 'N/A'}</div>
                            {assignment.policy && (
                              <div className="text-xs text-gray-500">v{assignment.policy.version}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {assignment.user ? (
                          <div>
                            <div className="font-medium">{assignment.user.full_name}</div>
                            <div className="text-xs text-gray-500">{assignment.user.email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {assignment.assigned_by_user ? (
                          <div>
                            <div className="font-medium">{assignment.assigned_by_user.full_name}</div>
                            <div className="text-xs text-gray-500">{assignment.assigned_by_user.email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {assignment.due_date ? (
                          <div>
                            <div>{formatDate(assignment.due_date)}</div>
                            {assignment.status === 'overdue' && (
                              <div className="text-xs text-red-600">Overdue</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">No due date</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(assignment.status)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{formatTimeAgo(assignment.assigned_at)}</div>
                          <div className="text-xs text-gray-500">{formatDate(assignment.assigned_at)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {assignment.acknowledged_at ? (
                          <div>
                            <div className="text-sm">{formatTimeAgo(assignment.acknowledged_at)}</div>
                            <div className="text-xs text-gray-500">{formatDate(assignment.acknowledged_at)}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => setSelectedAssignment(assignment)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          {selectedAssignment && (
                            <AssignmentDetailDialog assignment={selectedAssignment} />
                          )}
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PolicyHistoryPage;

