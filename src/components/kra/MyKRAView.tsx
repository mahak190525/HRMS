import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Eye,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText,
  Target,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/contexts/AuthContext';

import type { KRAAssignment } from '@/hooks/useKRA';
import { KRAModal } from './KRAViewModal';

interface MyKRAViewProps {
  assignments: KRAAssignment[];
  isLoading: boolean;
}

export function MyKRAView({ assignments, isLoading }: MyKRAViewProps) {
  const { user } = useAuth();
  const [selectedAssignment, setSelectedAssignment] = useState<KRAAssignment | null>(null);
  const [isKRAModalOpen, setIsKRAModalOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
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
    if (!dueDate || ['submitted', 'evaluated', 'approved'].includes(status || '')) return null;
    
    const now = new Date();
    const due = new Date(dueDate);
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) return { status: 'overdue', days: Math.abs(daysUntilDue), color: 'text-red-600' };
    if (daysUntilDue <= 3) return { status: 'due-soon', days: daysUntilDue, color: 'text-orange-600' };
    return { status: 'on-track', days: daysUntilDue, color: 'text-green-600' };
  };

  const isEditable = (assignment: KRAAssignment | null) => {
    if (!assignment || !assignment.due_date) return true;
    const now = new Date();
    const dueDate = new Date(assignment.due_date);
    return now <= dueDate && !['submitted', 'evaluated', 'approved'].includes(assignment.status || '');
  };

  const handleViewAssignment = (assignment: KRAAssignment) => {
    setSelectedAssignment(assignment);
    setIsKRAModalOpen(true);
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
            const dueStatus = getDueStatus(assignment.due_date, assignment.status);
            const progressPercentage = assignment.overall_percentage || 0;
            const canEdit = isEditable(assignment);
            
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
                          <span>Assigned: {format(new Date(assignment.assigned_date), 'MMM dd, yyyy')}</span>
                        </div>
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
                  {/* Due Date Info */}
                  {assignment.due_date && (
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          Due: {format(new Date(assignment.due_date), 'MMMM dd, yyyy')}
                        </span>
                      </div>
                      {dueStatus && (
                        <span className={`text-sm font-medium ${dueStatus.color}`}>
                          {dueStatus.status === 'overdue' ? `${dueStatus.days} days overdue` :
                           dueStatus.status === 'due-soon' ? `Due in ${dueStatus.days} days` :
                           `${dueStatus.days} days remaining`}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Progress */}
                  {assignment.status !== 'assigned' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Completion Progress</span>
                        <span>{progressPercentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={progressPercentage} className="h-2" />
                      {assignment.overall_rating && (
                        <p className="text-xs text-muted-foreground">
                          Current Rating: {assignment.overall_rating}<br/>
                          Overall Percentage: {assignment.overall_percentage}%
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

                  {/* Submission Info */}
                  {assignment.submitted_at && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-800">
                        Submitted on {format(new Date(assignment.submitted_at), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      onClick={() => handleViewAssignment(assignment)}
                      variant="outline"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      {canEdit ? 'Complete KRA' : 'View Details'}
                    </Button>
                    
                    {dueStatus?.status === 'overdue' && canEdit && (
                      <Button
                        onClick={() => handleViewAssignment(assignment)}
                        variant="destructive"
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Complete Now
                      </Button>
                    )}
                    
                    {dueStatus?.status === 'due-soon' && canEdit && (
                      <Button
                        onClick={() => handleViewAssignment(assignment)}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Complete Soon
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

      {/* KRA Modal */}
      <KRAModal
        isOpen={isKRAModalOpen}
        onClose={() => {
          setIsKRAModalOpen(false);
          setSelectedAssignment(null);
        }}
        assignment={selectedAssignment}
        viewContext="employee"
        title={user?.full_name ? `${user.full_name}'s KRA Sheet` : selectedAssignment?.template?.template_name}
        description={isEditable(selectedAssignment) 
          ? 'Complete your KRA evaluation by providing evidence and selecting your performance level for each goal.'
          : 'View your KRA submission and manager feedback.'
        }
      />
    </div>
  );
}
