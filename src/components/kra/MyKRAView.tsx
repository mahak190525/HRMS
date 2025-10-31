import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText,
  Target,
  User,
  ExternalLink
} from 'lucide-react';
import { formatDateForDisplay, getCurrentISTDate, parseToISTDate } from '@/utils/dateUtils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/contexts/AuthContext';

import type { KRAAssignment } from '@/hooks/useKRA';

interface MyKRAViewProps {
  assignments: KRAAssignment[];
  isLoading: boolean;
}

export function MyKRAView({ assignments, isLoading }: MyKRAViewProps) {
  const { user } = useAuth();
  const navigate = useNavigate();


  const getQuarterlyDueStatus = (assignment: KRAAssignment) => {
    // Check all quarters to find the most urgent status
    const quarters = ['q1', 'q2', 'q3', 'q4'];
    let mostUrgentStatus = null;
    
    for (const quarter of quarters) {
      const enabled = assignment[`${quarter}_enabled` as keyof KRAAssignment] as boolean;
      const dueDate = assignment[`${quarter}_due_date` as keyof KRAAssignment] as string;
      const status = assignment[`${quarter}_status` as keyof KRAAssignment] as string;
      
      if (enabled && dueDate && !['submitted', 'evaluated', 'approved'].includes(status || '')) {
        const now = getCurrentISTDate();
        const due = parseToISTDate(dueDate);
        const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        const quarterStatus = {
          quarter: quarter.toUpperCase(),
          status: daysUntilDue < 0 ? 'overdue' : daysUntilDue <= 3 ? 'due-soon' : 'on-track',
          days: Math.abs(daysUntilDue),
          color: daysUntilDue < 0 ? 'text-red-600' : daysUntilDue <= 3 ? 'text-orange-600' : 'text-green-600'
        };
        
        // Prioritize overdue, then due-soon
        if (!mostUrgentStatus || 
            (quarterStatus.status === 'overdue' && mostUrgentStatus.status !== 'overdue') ||
            (quarterStatus.status === 'due-soon' && mostUrgentStatus.status === 'on-track')) {
          mostUrgentStatus = quarterStatus;
        }
      }
    }
    
    return mostUrgentStatus;
  };

  const getActiveQuarters = (assignment: KRAAssignment) => {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    return quarters.filter(quarter => 
      assignment[`${quarter.toLowerCase()}_enabled` as keyof KRAAssignment] as boolean
    );
  };

  const handleViewAssignment = (assignment: KRAAssignment) => {
    navigate(`/dashboard/performance/kra/${assignment.id}`);
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
      {assignments.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {assignments.map((assignment) => {
            const dueStatus = getQuarterlyDueStatus(assignment);
            const activeQuarters = getActiveQuarters(assignment);
            const progressPercentage = assignment.overall_percentage || 0;
            
            return (
              <Card key={assignment.id} className={`${
                dueStatus?.status === 'overdue' ? 'border-red-200 bg-red-50' : ''
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {user?.full_name ? `${user.full_name}'s KRA Sheet` : assignment.template?.template_name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        <div className="font-medium text-sm">{assignment.template?.template_name}</div>
                        <div className="text-xs mt-1">{assignment.template?.description || 'No description available'}</div>
                      </CardDescription>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>Assigned by: {assignment.assigned_by_user?.full_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Assigned: {formatDateForDisplay(assignment.assigned_date, 'MMM dd, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">
                        {activeQuarters.length} Quarter{activeQuarters.length !== 1 ? 's' : ''} Active
                      </Badge>
                      {dueStatus?.status === 'overdue' && (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {dueStatus.quarter} Overdue
                        </Badge>
                      )}
                      {dueStatus?.status === 'due-soon' && (
                        <Badge className="bg-orange-100 text-orange-800">
                          <Clock className="h-3 w-3 mr-1" />
                          {dueStatus.quarter} Due Soon
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Active Quarters Info */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Calendar className="h-4 w-4" />
                      <span>Active Quarters ({activeQuarters.length})</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {activeQuarters.map(quarter => {
                        const qStatus = assignment[`${quarter.toLowerCase()}_status` as keyof KRAAssignment] as string;
                        const qDueDate = assignment[`${quarter.toLowerCase()}_due_date` as keyof KRAAssignment] as string;
                        
                        return (
                          <div key={quarter} className="p-2 bg-muted/30 rounded text-center">
                            <div className="font-medium text-sm">{quarter}</div>
                            <div className="text-xs text-muted-foreground">
                              {qStatus?.replace('_', ' ') || 'Not Started'}
                            </div>
                            {qDueDate && (
                              <div className="text-xs text-muted-foreground">
                                Due: {formatDateForDisplay(qDueDate, 'MMM dd')}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {dueStatus && (
                      <div className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                        dueStatus.status === 'overdue' ? 'bg-red-50 text-red-800' :
                        dueStatus.status === 'due-soon' ? 'bg-orange-50 text-orange-800' :
                        'bg-green-50 text-green-800'
                      }`}>
                        {dueStatus.status === 'overdue' ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                        <span>
                          {dueStatus.quarter}: {dueStatus.status === 'overdue' ? `${dueStatus.days} days overdue` :
                           dueStatus.status === 'due-soon' ? `Due in ${dueStatus.days} days` :
                           `${dueStatus.days} days remaining`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Progress & Scores */}
                  {assignment.status !== 'assigned' && (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Current Progress</span>
                        <span>{progressPercentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={progressPercentage} className="h-2" />
                      
                      {/* Latest Quarter Scores */}
                      {(assignment.q4_cumulative_percentage > 0 || assignment.q3_cumulative_percentage > 0 || 
                        assignment.q2_cumulative_percentage > 0 || assignment.q1_cumulative_percentage > 0) && (
                        <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg">
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">Latest Quarter</div>
                            <div className="font-semibold text-blue-600">
                              {assignment.q4_overall_percentage > 0 ? assignment.q4_overall_percentage.toFixed(1) :
                               assignment.q3_overall_percentage > 0 ? assignment.q3_overall_percentage.toFixed(1) :
                               assignment.q2_overall_percentage > 0 ? assignment.q2_overall_percentage.toFixed(1) :
                               assignment.q1_overall_percentage.toFixed(1)}%
                            </div>
                            <div className="text-xs text-muted-foreground">Quarterly</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">Running Total</div>
                            <div className="font-semibold text-green-600">
                              {assignment.q4_cumulative_percentage > 0 ? assignment.q4_cumulative_percentage.toFixed(1) :
                               assignment.q3_cumulative_percentage > 0 ? assignment.q3_cumulative_percentage.toFixed(1) :
                               assignment.q2_cumulative_percentage > 0 ? assignment.q2_cumulative_percentage.toFixed(1) :
                               assignment.q1_cumulative_percentage.toFixed(1)}%
                            </div>
                            <div className="text-xs text-muted-foreground">Cumulative</div>
                          </div>
                        </div>
                      )}
                      
                      {assignment.overall_rating && (
                        <p className="text-xs text-muted-foreground text-center">
                          Current Rating: {assignment.overall_rating}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Goals Summary */}
                  {assignment.template?.goals && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Target className="h-4 w-4" />
                        <span>KRA Goals ({assignment.template.goals.length})</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {assignment.template.goals.slice(0, 4).map((goal) => (
                          <div key={goal.id} className="text-sm p-2 bg-muted/30 rounded">
                            <div className="font-medium truncate">{goal.strategic_goal_title}</div>
                            <div className="text-xs text-muted-foreground">Weight: {goal.weight}%</div>
                          </div>
                        ))}
                        {assignment.template.goals.length > 4 && (
                          <div className="text-sm p-2 bg-muted/30 rounded flex items-center justify-center text-muted-foreground">
                            +{assignment.template.goals.length - 4} more goals
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quarterly Submission Info */}
                  <div className="space-y-2">
                    {activeQuarters.map(quarter => {
                      const submittedAt = assignment[`${quarter.toLowerCase()}_submitted_at` as keyof KRAAssignment] as string;
                      if (submittedAt) {
                        return (
                          <div key={quarter} className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-800">
                              {quarter} submitted on {formatDateForDisplay(submittedAt, 'MMM dd, yyyy')}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      onClick={() => handleViewAssignment(assignment)}
                      variant="outline"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open KRA Sheet
                    </Button>
                    
                    {dueStatus?.status === 'overdue' && (
                      <Button
                        onClick={() => handleViewAssignment(assignment)}
                        variant="destructive"
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Complete {dueStatus.quarter} Now
                      </Button>
                    )}
                    
                    {dueStatus?.status === 'due-soon' && (
                      <Button
                        onClick={() => handleViewAssignment(assignment)}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Complete {dueStatus.quarter} Soon
                      </Button>
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
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No KRA Assignments</h3>
            <p className="text-muted-foreground text-center max-w-md">
              You don't have any KRA assignments yet. Your manager will assign KRAs when they become available.
            </p>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
