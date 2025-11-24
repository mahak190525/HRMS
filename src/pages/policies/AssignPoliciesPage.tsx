import React, { useState } from 'react';
import { 
  Send, 
  Search,
  Users,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
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
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { usePolicies } from '@/hooks/usePolicies';
import { useAllEmployees } from '@/hooks/useEmployees';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import type { Policy } from '@/types';

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

export const AssignPoliciesPage: React.FC = () => {
  const { user } = useAuth();
  const { policies } = usePolicies();
  const { data: employees } = useAllEmployees();
  
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assignments, setAssignments] = useState<PolicyAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch assignments
  React.useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
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
      setLoading(false);
    }
  };

  const handleAssignPolicies = async () => {
    if (selectedPolicyIds.length === 0) {
      toast.error('Please select at least one policy');
      return;
    }

    if (selectedUserIds.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }

    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    try {
      setLoading(true);

      // Create assignments for each selected user and policy combination
      const assignmentData = selectedPolicyIds.flatMap(policyId =>
        selectedUserIds.map(userId => ({
          policy_id: policyId,
          user_id: userId,
          assigned_by: user.id,
          due_date: dueDate || null,
          notes: notes || null,
          status: 'pending'
        }))
      );

      const { error } = await supabase
        .from('policy_assignments')
        .insert(assignmentData);

      if (error) throw error;

      // Update policy counts in pending emails for bulk assignments
      if (selectedPolicyIds.length > 1 || selectedUserIds.length > 1) {
        try {
          await supabase.rpc('update_policy_email_counts');
          console.log('✅ Policy email counts updated for bulk assignment');
        } catch (emailCountError) {
          console.warn('Failed to update policy email counts:', emailCountError);
          // Don't throw - this is not critical
        }
      }

      // Notifications and emails will be sent automatically by database triggers
      console.log(`✅ Policy assignments created successfully. Notifications and emails will be sent automatically.`);

      const totalAssignments = selectedPolicyIds.length * selectedUserIds.length;
      toast.success(`Successfully created ${totalAssignments} policy assignment(s) for ${selectedUserIds.length} employee(s) and ${selectedPolicyIds.length} policy/policies`);
      
      // Reset form
      setSelectedPolicyIds([]);
      setSelectedUserIds([]);
      setDueDate('');
      setNotes('');
      setIsAssignDialogOpen(false);
      
      // Refresh assignments
      await fetchAssignments();
    } catch (error: any) {
      console.error('Error assigning policies:', error);
      toast.error(error.message || 'Failed to assign policies');
    } finally {
      setLoading(false);
    }
  };

  // Filter assignments
  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = !searchTerm || 
      assignment.policy?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.user?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.user?.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || assignment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
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

  const filteredEmployees = employees?.filter((emp: any) => 
    emp.status === 'active'
  ) || [];

  const selectedEmployees = filteredEmployees.filter((emp: any) => 
    selectedUserIds.includes(emp.id)
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Send className="h-5 w-5" />
              Assign Policies
            </h2>
            <p className="text-sm text-gray-600">
              Assign policies to employees for review and acknowledgement
            </p>
          </div>
          <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Send className="h-4 w-4 mr-2" />
                Assign Policy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Assign Policy to Employees</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Policies * (Multi-select)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        {selectedPolicyIds.length > 0 
                          ? `${selectedPolicyIds.length} policy/policies selected`
                          : 'Select policies'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent forceMount className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Search policies..." />
                        <CommandEmpty>No policies found.</CommandEmpty>
                        <div className="max-h-[300px] overflow-y-auto" onWheel={(e: React.WheelEvent) => e.stopPropagation()}>
                        <CommandGroup>
                          {/* --- Select All Checkbox Option --- */}
                          <CommandItem
                            onSelect={() => {
                              const activePolicies = policies.filter(p => p.is_active);
                              const allSelected = selectedPolicyIds.length === activePolicies.length;
                              if (allSelected) {
                                setSelectedPolicyIds([]);
                              } else {
                                setSelectedPolicyIds(activePolicies.map(p => p.id));
                              }
                            }}
                            className="flex items-center gap-2"
                          >
                            <Checkbox
                              checked={selectedPolicyIds.length === policies.filter(p => p.is_active).length}
                              aria-label="Select All Policies"
                            />
                            <div className="flex-1">
                              <div className="font-medium">Select All</div>
                              <div className="text-sm text-gray-500">
                                {selectedPolicyIds.length === policies.filter(p => p.is_active).length
                                  ? "Deselect all policies"
                                  : "Select all policies"}
                              </div>
                            </div>
                          </CommandItem>

                          {/* --- Policy List --- */}
                          {policies.filter(p => p.is_active).map((policy) => {
                            const isSelected = selectedPolicyIds.includes(policy.id);
                            return (
                              <CommandItem
                                key={policy.id}
                                value={policy.name}
                                onSelect={() => {
                                  setSelectedPolicyIds((prev) =>
                                    isSelected
                                      ? prev.filter((id) => id !== policy.id)
                                      : [...prev, policy.id]
                                  );
                                }}
                                className="flex items-center gap-2"
                              >
                                <Checkbox checked={isSelected} aria-label={policy.name} />
                                <div className="flex-1">
                                  <div className="font-medium">{policy.name}</div>
                                  <div className="text-sm text-gray-500">Version {policy.version}</div>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                        </div>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedPolicyIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedPolicyIds.map(policyId => {
                        const policy = policies.find(p => p.id === policyId);
                        return policy ? (
                          <Badge key={policy.id} variant="secondary" className="text-xs">
                            {policy.name} (v{policy.version})
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Employees * (Multi-select)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        {selectedUserIds.length > 0 
                          ? `${selectedUserIds.length} employee(s) selected`
                          : 'Select employees'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent forceMount className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Search employees..." />
                        <CommandEmpty>No employees found.</CommandEmpty>
                        <div className="max-h-[300px] overflow-y-auto" onWheel={(e: React.WheelEvent) => e.stopPropagation()}>
                        <CommandGroup>
                          {/* --- Select All Checkbox Option --- */}
                          <CommandItem
                            onSelect={() => {
                              const allSelected = selectedUserIds.length === filteredEmployees.length;
                              if (allSelected) {
                                setSelectedUserIds([]);
                              } else {
                                setSelectedUserIds(filteredEmployees.map((e: any) => e.id));
                              }
                            }}
                            className="flex items-center gap-2"
                          >
                            <Checkbox
                              checked={selectedUserIds.length === filteredEmployees.length}
                              aria-label="Select All"
                            />
                            <div className="flex-1">
                              <div className="font-medium">Select All</div>
                              <div className="text-sm text-gray-500">
                                {selectedUserIds.length === filteredEmployees.length
                                  ? "Deselect all employees"
                                  : "Select all employees"}
                              </div>
                            </div>
                          </CommandItem>

                          {/* --- Employee List --- */}
                          {filteredEmployees.map((employee: any) => {
                            const isSelected = selectedUserIds.includes(employee.id);
                            return (
                              <CommandItem
                                key={employee.id}
                                value={employee.full_name}
                                onSelect={() => {
                                  setSelectedUserIds((prev) =>
                                    isSelected
                                      ? prev.filter((id) => id !== employee.id)
                                      : [...prev, employee.id]
                                  );
                                }}
                                className="flex items-center gap-2"
                              >
                                <Checkbox checked={isSelected} aria-label={employee.full_name} />
                                <div className="flex-1">
                                  <div className="font-medium">{employee.full_name}</div>
                                  <div className="text-sm text-gray-500">{employee.email}</div>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                        </div>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedEmployees.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedEmployees.map((emp: any) => (
                        <Badge key={emp.id} variant="secondary" className="text-xs">
                          {emp.full_name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date (Optional)</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any additional notes or instructions..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAssignDialogOpen(false);
                    setSelectedPolicyIds([]);
                    setSelectedUserIds([]);
                    setDueDate('');
                    setNotes('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAssignPolicies}
                  disabled={loading || selectedPolicyIds.length === 0 || selectedUserIds.length === 0}
                >
                  {loading ? 'Assigning...' : 'Assign Policy'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search assignments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
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
        {loading && assignments.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <Send className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No assignments found
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search terms or filters'
                  : 'Get started by assigning a policy to employees'}
              </p>
              <Button onClick={() => setIsAssignDialogOpen(true)}>
                <Send className="h-4 w-4 mr-2" />
                Assign Policy
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="overflow-x-auto"> 
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Assigned By</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Acknowledged</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map(assignment => (
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

export default AssignPoliciesPage;

