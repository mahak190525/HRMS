import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageSquare,
  Calendar,
  Clock,
  AlertTriangle,
  Users,
  Filter,
  Search,
  ExternalLink,
  Grid3X3
} from 'lucide-react';
import { formatDateForDisplay, getCurrentISTDate, parseToISTDate } from '@/utils/dateUtils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

import type { KRAAssignment } from '@/hooks/useKRA';
import type { KRAPermissions } from '@/hooks/useKRAPermissions';
import { KRAComparisonMatrix } from './KRAComparisonMatrix';

interface KRAAssignmentManagerProps {
  assignments: KRAAssignment[];
  isLoading: boolean;
  teamMembers?: any[];
  permissions: KRAPermissions;
  context?: 'team' | 'all'; // Context for determining permissions
}

export function KRAAssignmentManager({ assignments, isLoading, permissions, context = 'team' }: KRAAssignmentManagerProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filter assignments
  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = !searchTerm || 
      assignment.employee?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.template?.template_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || assignment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-orange-100 text-orange-800';
      case 'evaluated':
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'assigned':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDueStatus = (dueDate?: string, status?: string) => {
    if (!dueDate || ['evaluated', 'approved'].includes(status || '')) return null;
    
    const now = getCurrentISTDate();
    const due = parseToISTDate(dueDate);
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) return { status: 'overdue', days: Math.abs(daysUntilDue), color: 'text-red-600' };
    if (daysUntilDue <= 3) return { status: 'due-soon', days: daysUntilDue, color: 'text-orange-600' };
    return { status: 'on-track', days: daysUntilDue, color: 'text-green-600' };
  };

  const handleViewAssignment = (assignment: KRAAssignment) => {
    // For context-aware navigation, we need to determine permissions
    // In 'team' context: admin-managers can edit their direct reports, view-only for others
    // In 'all' context: admin-managers view-only for non-direct reports, edit for direct reports
    
    const isDirectManager = assignment.assigned_by === user?.id;
    const isEmployee = assignment.employee_id === user?.id;
    
    // Determine if user can edit based on context
    let canEdit = false;
    
    if (context === 'team') {
      // Team context: can edit if direct manager or employee
      canEdit = isDirectManager || isEmployee;
    } else if (context === 'all') {
      // All context: can edit only if direct manager or employee
      canEdit = isDirectManager || isEmployee;
    }
    
    if (canEdit && !permissions.isReadOnly) {
      // User can edit - navigate to manager page for evaluation
      navigate(`/performance/kra/manager/${assignment.id}`);
    } else {
      // User can only view - navigate to details page
      navigate(`/performance/kra/details/${assignment.id}`);
    }
  };


  const statusCounts = {
    all: assignments.length,
    assigned: assignments.filter(a => a.status === 'assigned').length,
    in_progress: assignments.filter(a => a.status === 'in_progress').length,
    submitted: assignments.filter(a => a.status === 'submitted').length,
    evaluated: assignments.filter(a => a.status === 'evaluated').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs for different views */}
      <Tabs defaultValue="assignments" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="assignments" className="flex items-center gap-2 cursor-pointer">
            <Users className="h-4 w-4" />
            Team Assignments
          </TabsTrigger>
          <TabsTrigger value="comparison-matrix" className="flex items-center gap-2 cursor-pointer">
            <Grid3X3 className="h-4 w-4" />
            Quarterly Comparison Matrix
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="space-y-6">
          {/* Filters and Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filter Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-3 " />
                    <Input
                      placeholder="Search by employee name or template..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <Button
                      key={status}
                      variant={statusFilter === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter(status)}
                    >
                      {status.replace('_', ' ')} ({count})
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Summary */}
          {filteredAssignments.length > 0 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{statusCounts.submitted}</div>
                    <div className="text-xs text-muted-foreground">Ready to Evaluate</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">{statusCounts.assigned + statusCounts.in_progress}</div>
                    <div className="text-xs text-muted-foreground">Pending Submission</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{statusCounts.evaluated}</div>
                    <div className="text-xs text-muted-foreground">Evaluated</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-600">{statusCounts.all}</div>
                    <div className="text-xs text-muted-foreground">Total Assignments</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Assignments List */}
          {filteredAssignments.length > 0 ? (
            <div className="space-y-4">
              {filteredAssignments.map((assignment) => {
                const dueStatus = getDueStatus(assignment.due_date, assignment.status);
                const progressPercentage = assignment.overall_percentage || 0;
                
                return (
                  <Card key={assignment.id} className={`${
                    dueStatus?.status === 'overdue' ? 'border-red-200 bg-red-50' : ''
                  }`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {assignment.employee?.full_name}
                            {assignment.status === 'submitted' && (
                              <Badge className="bg-orange-100 text-orange-800">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Needs Review
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {assignment.template?.template_name}
                          </CardDescription>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>Assigned: {formatDateForDisplay(assignment.assigned_date, 'MMM dd, yyyy')}</span>
                            </div>
                            {assignment.due_date && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span className={dueStatus?.color}>
                                  Due: {formatDateForDisplay(assignment.due_date, 'MMM dd, yyyy')}
                                  {dueStatus && (
                                    <span className="ml-1">
                                      ({dueStatus.status === 'overdue' ? `${dueStatus.days} days overdue` :
                                        dueStatus.status === 'due-soon' ? `${dueStatus.days} days left` :
                                        `${dueStatus.days} days left`})
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(assignment.status || '')}>
                            {assignment.status?.replace('_', ' ') || 'Unknown'}
                          </Badge>
                          {dueStatus?.status === 'overdue' && (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {/* Progress */}
                      {assignment.status !== 'assigned' && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Completion Progress</span>
                            <span>{progressPercentage.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                          {assignment.overall_rating && (
                            <p className="text-xs text-muted-foreground">
                              Current Rating: {assignment.overall_rating}<br/>
                              Overall Percentage: {assignment.overall_percentage}%
                            </p>
                          )}
                        </div>
                      )}

                      {/* Employee Info */}
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-800">
                              {assignment.employee?.full_name?.charAt(0) || 'U'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium">{assignment.employee?.full_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {assignment.employee?.employee_id && `ID: ${assignment.employee.employee_id}`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {assignment.submitted_at && (
                            <div>Submitted: {formatDateForDisplay(assignment.submitted_at, 'MMM dd')}</div>
                          )}
                          {assignment.evaluated_at && (
                            <div>Evaluated: {formatDateForDisplay(assignment.evaluated_at, 'MMM dd')}</div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={() => handleViewAssignment(assignment)}
                          variant="outline"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          {assignment.status === 'submitted' && !permissions.isReadOnly ? 'Review & Evaluate' : 'View Details'}
                        </Button>
                        
                        {assignment.status === 'submitted' && permissions.canEvaluateTeam && !permissions.isReadOnly && (
                          <Button
                            onClick={() => handleViewAssignment(assignment)}
                            className="bg-orange-600 hover:bg-orange-700"
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Evaluate Now
                          </Button>
                        )}
                        
                        {assignment.status === 'assigned' && (
                          <div className="text-xs text-muted-foreground bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                            Waiting for employee to submit their KRA evaluation
                          </div>
                        )}
                        
                        {assignment.status === 'in_progress' && (
                          <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded px-3 py-2">
                            Employee is working on their KRA
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Assignments Found</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'No assignments match your current filters. Try adjusting your search or filter criteria.'
                    : 'No KRA assignments have been created yet. Create a template and publish it to your team members to get started.'
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="comparison-matrix" className="space-y-6">
          <KRAComparisonMatrix 
            teamAssignments={assignments} 
            isTeamContext={true}
            isLoading={isLoading} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
