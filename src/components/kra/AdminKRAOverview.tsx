import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useAllKRAAssignments } from '@/hooks/useKRA';
import { useKRAPermissions } from '@/hooks/useKRAPermissions';
import { KRAModal } from './KRAViewModal';
import { format } from 'date-fns';
import { Eye, Search, Filter, Users, BarChart3, Calendar, CheckCircle2, Clock, AlertCircle, UserCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AdminKRAOverview() {
  const { data: assignments = [], isLoading } = useAllKRAAssignments();
  const permissions = useKRAPermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [managerFilter, setManagerFilter] = useState<string>('all');
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [isKRAModalOpen, setIsKRAModalOpen] = useState(false);

  // Check if user has admin/HR permissions
  if (!permissions.canViewAllKRA) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            You don't have permission to view all KRA assignments.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter and search assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter(assignment => {
      const matchesSearch = 
        assignment.employee?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assignment.employee?.employee_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assignment.template?.template_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assignment.assigned_by_user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || assignment.status === statusFilter;
      const matchesManager = managerFilter === 'all' || assignment.assigned_by === managerFilter;

      return matchesSearch && matchesStatus && matchesManager;
    });
  }, [assignments, searchQuery, statusFilter, managerFilter]);

  // Get unique managers for filter
  const managers = useMemo(() => {
    const uniqueManagers = new Map();
    assignments.forEach(assignment => {
      if (assignment.assigned_by_user) {
        uniqueManagers.set(assignment.assigned_by, assignment.assigned_by_user);
      }
    });
    return Array.from(uniqueManagers.values());
  }, [assignments]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    const totalAssignments = assignments.length;
    const assignedCount = assignments.filter(a => a.status === 'assigned').length;
    const inProgressCount = assignments.filter(a => a.status === 'in_progress').length;
    const submittedCount = assignments.filter(a => a.status === 'submitted').length;
    const evaluatedCount = assignments.filter(a => a.status === 'evaluated').length;

    return {
      total: totalAssignments,
      assigned: assignedCount,
      inProgress: inProgressCount,
      submitted: submittedCount,
      evaluated: evaluatedCount,
      completionRate: totalAssignments > 0 ? ((evaluatedCount / totalAssignments) * 100) : 0
    };
  }, [assignments]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'assigned':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
        return <AlertCircle className="h-4 w-4" />;
      case 'submitted':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'evaluated':
        return <UserCheck className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'submitted':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'evaluated':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleViewAssignment = (assignment: any) => {
    setSelectedAssignment(assignment);
    setIsKRAModalOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total KRAs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Across all managers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.submitted}</div>
            <p className="text-xs text-muted-foreground">Awaiting manager evaluation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.evaluated}</div>
            <p className="text-xs text-muted-foreground">Fully evaluated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate.toFixed(1)}%</div>
            <Progress value={stats.completionRate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>All KRA Assignments</CardTitle>
          <CardDescription>
            Comprehensive view of all KRA assignments across the organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by employee name, ID, template, or manager..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="evaluated">Evaluated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={managerFilter} onValueChange={setManagerFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Managers</SelectItem>
                {managers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignments Table */}
          <div className="space-y-4">
            {filteredAssignments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No KRA assignments found matching your criteria.
              </div>
            ) : (
              filteredAssignments.map((assignment) => (
                <Card key={assignment.id} className="border-l-4 border-l-primary/20">
                  <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {assignment.employee?.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{assignment.employee?.full_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {assignment.employee?.employee_id} • {assignment.employee?.position}
                            </div>
                          </div>
                        </div>
                        
                        <div className="pl-11">
                          <div className="text-sm font-medium text-primary">
                            {assignment.template?.template_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Manager: {assignment.assigned_by_user?.full_name} • 
                            Assigned: {format(new Date(assignment.created_at), 'MMM dd, yyyy')}
                            {assignment.template?.evaluation_period_start && assignment.template?.evaluation_period_end && (
                              <> • Period: {format(new Date(assignment.template.evaluation_period_start), 'MMM dd')} - {format(new Date(assignment.template.evaluation_period_end), 'MMM dd, yyyy')}</>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <Badge className={`flex items-center space-x-1 ${getStatusColor(assignment.status)}`}>
                          {getStatusIcon(assignment.status)}
                          <span className="capitalize">{assignment.status.replace('_', ' ')}</span>
                        </Badge>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewAssignment(assignment)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* KRA Modal */}
      <KRAModal
        isOpen={isKRAModalOpen}
        onClose={() => {
          setIsKRAModalOpen(false);
          setSelectedAssignment(null);
        }}
        assignment={selectedAssignment}
        permissions={permissions}
        viewContext="admin"
        title={selectedAssignment ? `KRA Details - ${selectedAssignment.employee?.full_name}` : ''}
        description="Complete KRA assignment details from admin perspective."
      />
    </div>
  );
}
