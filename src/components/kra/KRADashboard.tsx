import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  CheckCircle,
  FileText,
  Target
} from 'lucide-react';
import { formatDateForDisplay, getCurrentISTDate, parseToISTDate } from '@/utils/dateUtils';
import type { KRATemplate, KRAAssignment } from '@/hooks/useKRA';
import type { KRAPermissions } from '@/hooks/useKRAPermissions';

interface KRADashboardProps {
  templates?: KRATemplate[];
  assignments?: KRAAssignment[];
  teamMembers?: any[];
  permissions: KRAPermissions;
}

export function KRADashboard({ templates = [], assignments = [] }: KRADashboardProps) {
  // Calculate metrics
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'submitted':
        return 'default';
      case 'in_progress':
      case 'assigned':
        return 'secondary';
      case 'draft':
        return 'outline';
      case 'overdue':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getDueStatus = (dueDate: string | null, status: string) => {
    if (!dueDate || ['submitted', 'completed', 'evaluated'].includes(status)) return null;
    
    const now = getCurrentISTDate();
    const due = parseToISTDate(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) return { status: 'overdue', days: Math.abs(daysUntilDue) };
    if (daysUntilDue <= 3) return { status: 'due-soon', days: daysUntilDue };
    return { status: 'on-track', days: daysUntilDue };
  };

  // Calculate dashboard metrics
  const activeTemplates = templates.filter(t => t.status === 'active');
  const pendingReviews = assignments.filter(a => a.status === 'submitted');
  const completedAssignments = assignments.filter(a => a.status === 'submitted');
  const overdueAssignments = assignments.filter(a => {
    const dueStatus = getDueStatus(a.due_date || null, a.status || '');
    return dueStatus?.status === 'overdue';
  });

  return (
    <div className="space-y-6">
      {/* KRA Overview Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            KRA Management Overview
          </CardTitle>
          <CardDescription>
            Quick overview of KRA activities and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{activeTemplates.length}</div>
              <div className="text-sm text-muted-foreground">Active Templates</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{assignments.length}</div>
              <div className="text-sm text-muted-foreground">Total Assignments</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{pendingReviews.length}</div>
              <div className="text-sm text-muted-foreground">Pending Reviews</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{overdueAssignments.length}</div>
              <div className="text-sm text-muted-foreground">Overdue Items</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length > 0 ? (
            <div className="space-y-4">
              {templates.slice(0, 3).map((template) => (
                <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-semibold">{template.template_name}</h4>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <Badge variant={getStatusColor(template.status)}>
                        {template.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {template.goals?.length || 0} goals
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      Created {formatDateForDisplay(template.created_at, 'MMM dd')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No templates created yet.</p>
              <p className="text-sm">Create your first KRA template to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Recent Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length > 0 ? (
            <div className="space-y-4">
              {assignments.slice(0, 5).map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-semibold">{assignment.employee?.full_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {assignment.template?.template_name}
                      </div>
                      {assignment.overall_percentage && (
                        <p className="text-xs text-green-600 mt-1">
                          Current Rating: {assignment.overall_rating}<br/>
                          Overall Percentage: {assignment.overall_percentage}%
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={getStatusColor(assignment.status)}>
                      {assignment.status}
                    </Badge>
                    {assignment.due_date && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Due {formatDateForDisplay(assignment.due_date, 'MMM dd')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No KRA assignments yet.</p>
              <p className="text-sm">Assign KRAs to team members to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Summary */}
      {completedAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Analytics</CardTitle>
            <CardDescription>
              Overview of completed KRA performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {completedAssignments.length}
                </div>
                <div className="text-sm text-muted-foreground">Completed KRAs</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {completedAssignments.reduce((acc, a) => acc + (a.overall_percentage || 0), 0) / completedAssignments.length || 0}%
                </div>
                <div className="text-sm text-muted-foreground">Average Score</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {completedAssignments.filter(a => (a.overall_percentage || 0) >= 80).length}
                </div>
                <div className="text-sm text-muted-foreground">High Performers</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}