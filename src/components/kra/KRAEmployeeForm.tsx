import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Save, 
  Send, 
  Target, 
  Weight, 
  Calendar,
  CheckCircle,
  Clock,
  MessageSquare,
  User,
  AlertTriangle
} from 'lucide-react';
import { formatDateForDisplay, getCurrentISTDate, parseToISTDate } from '@/utils/dateUtils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { KRAAssignment } from '@/hooks/useKRA';
import { useKRAAssignmentDetails, useUpdateKRAEvaluation, triggerKRAEmail } from '@/hooks/useKRA';
import { supabase } from '@/services/supabase';

interface KRAEmployeeFormProps {
  assignment: KRAAssignment;
  isReadOnly?: boolean;
  onClose: () => void;
}

interface EvaluationFormData {
  [goalId: string]: {
    employee_comments: string;
    selected_level?: number;
    awarded_marks: number;
    awarded_points: number;
    final_rating: string;
  };
}

export function KRAEmployeeForm({ assignment, isReadOnly = false, onClose }: KRAEmployeeFormProps) {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<EvaluationFormData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: detailedAssignment, refetch } = useKRAAssignmentDetails(assignment.id);
  const updateEvaluation = useUpdateKRAEvaluation();

  const updateAssignmentStatus = async (status: string) => {
    const { error } = await supabase
      .from('kra_assignments')
      .update({ 
        status: status,
        submitted_at: status === 'submitted' ? getCurrentISTDate().toISOString() : undefined,
        submitted_by: status === 'submitted' ? user?.id : undefined
      })
      .eq('id', assignment.id);

    if (error) {
      console.error('Failed to update assignment status:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (detailedAssignment?.evaluations) {
      const evaluationData: EvaluationFormData = {};
      detailedAssignment.evaluations.forEach(evaluation => {
        if (evaluation.goal?.id) {
          evaluationData[evaluation.goal.id] = {
            employee_comments: evaluation.employee_comments || '',
            selected_level: evaluation.selected_level,
            awarded_marks: evaluation.awarded_marks ?? 0,
            awarded_points: evaluation.awarded_points ?? 0,
            final_rating: evaluation.final_rating || '',
          };
        }
      });
      setEvaluations(evaluationData);
    }
  }, [detailedAssignment]);

  const handleEvaluationChange = (goalId: string, field: string, value: any) => {
    setEvaluations(prev => ({
      ...prev,
      [goalId]: {
        ...prev[goalId],
        [field]: value,
      },
    }));
  };

  // Level selection is now handled by managers only

  const handleSaveDraft = async () => {
    if (!detailedAssignment?.template?.goals) return;

    setIsSubmitting(true);
    try {
      for (const goal of detailedAssignment.template.goals) {
        const evaluation = evaluations[goal.id];
        if (evaluation) {
          // Find existing evaluation to get the ID
          const existingEvaluation = detailedAssignment.evaluations?.find(
            e => e.goal_id === goal.id
          );
          
          await updateEvaluation.mutateAsync({
            id: existingEvaluation?.id, // Include ID if evaluation exists
            assignment_id: assignment.id,
            goal_id: goal.id,
            employee_comments: evaluation.employee_comments,
            employee_submitted_at: undefined, // Don't mark as submitted for draft
          });
        }
      }
      await refetch();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!detailedAssignment?.template?.goals) return;

    // Validate all goals have employee comments
    const incompleteGoals = detailedAssignment.template.goals.filter(goal => {
      const evaluation = evaluations[goal.id];
      return !evaluation?.employee_comments?.trim();
    });

    if (incompleteGoals.length > 0) {
      alert(`Please provide detailed comments for all goals before submitting. Missing: ${incompleteGoals.map(g => g.goal_id).join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const now = getCurrentISTDate().toISOString();
      
      for (const goal of detailedAssignment.template.goals) {
        const evaluation = evaluations[goal.id];
        if (evaluation) {
          // Find existing evaluation to get the ID
          const existingEvaluation = detailedAssignment.evaluations?.find(
            e => e.goal_id === goal.id
          );
          
          await updateEvaluation.mutateAsync({
            id: existingEvaluation?.id, // Include ID if evaluation exists
            assignment_id: assignment.id,
            goal_id: goal.id,
            employee_comments: evaluation.employee_comments,
            employee_submitted_at: now,
          });
        }
      }

      // Update assignment status to submitted
      await updateAssignmentStatus('submitted');
      
      // Trigger email notification for submission
      console.log('🎯 Triggering submission email for assignment:', assignment.id);
      await triggerKRAEmail('submission', assignment.id, {
        quarter: 'Overall KRA' // This form submits the overall KRA, not quarter-specific
      });
      
      toast.success('KRA submitted for manager review - notifications and emails sent!');
      await refetch();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateProgress = () => {
    if (!detailedAssignment?.template?.goals) return 0;
    
    const completedGoals = detailedAssignment.template.goals.filter(goal => {
      const evaluation = evaluations[goal.id];
      return evaluation?.employee_comments?.trim();
    });
    
    return (completedGoals.length / detailedAssignment.template.goals.length) * 100;
  };

  const isCompleted = assignment.status === 'submitted' || assignment.status === 'evaluated';
  const dueDate = assignment.due_date ? parseToISTDate(assignment.due_date) : null;
  const isOverdue = dueDate && getCurrentISTDate() > dueDate && !isCompleted;

  // Sort goals by display_order for consistent rendering
  const sortedGoals = detailedAssignment?.template?.goals 
    ? [...detailedAssignment.template.goals].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    : [];

  if (!detailedAssignment) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{detailedAssignment.template?.template_name}</CardTitle>
              <CardDescription className="mt-1">
                {detailedAssignment.template?.description}
              </CardDescription>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {detailedAssignment.template?.evaluation_period_start && 
                     detailedAssignment.template?.evaluation_period_end && (
                      <>
                        {formatDateForDisplay(detailedAssignment.template.evaluation_period_start, 'MMM dd')} - {formatDateForDisplay(detailedAssignment.template.evaluation_period_end, 'MMM dd, yyyy')}
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>Assigned by: {assignment.assigned_by_user?.full_name}</span>
                </div>
                {dueDate && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                      Due: {formatDateForDisplay(dueDate, 'MMM dd, yyyy')}
                      {isOverdue && ' (Overdue)'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={
                isCompleted ? 'bg-green-100 text-green-800' :
                isOverdue ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }>
                {assignment.status?.replace('_', ' ')}
              </Badge>
              {isOverdue && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Overdue
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        {!isReadOnly && !isCompleted && (
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Completion Progress</span>
                <span>{calculateProgress().toFixed(0)}%</span>
              </div>
              <Progress value={calculateProgress()} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Complete all goals with evidence and performance levels to submit
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Goals */}
      <div className="space-y-6 w-full max-w-full">
        {sortedGoals.map((goal) => {
          const evaluation = evaluations[goal.id] || {};
          const isGoalComplete = evaluation.employee_comments?.trim();
          
          return (
            <Card key={goal.id} className={`w-full max-w-full overflow-hidden ${
              isGoalComplete ? 'border-green-200 bg-green-50' : 
              isOverdue ? 'border-red-200' : ''
            }`}>
              <CardHeader className="w-full max-w-full">
                <div className="flex items-start justify-between gap-4 w-full min-w-0">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg flex items-start gap-2 flex-wrap">
                      <Badge variant="outline" className="flex-shrink-0">{goal.goal_id}</Badge>
                      <span 
                        className="flex-1 font-medium min-w-0 block" 
                        style={{ wordBreak: 'normal', overflowWrap: 'anywhere', whiteSpace: 'normal', lineHeight: '1.5' }}
                      >
                        {goal.strategic_goal_title}
                      </span>
                      {isGoalComplete && <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />}
                    </CardTitle>
                    {goal.category && (
                      <Badge variant="secondary" className="mt-2">
                        {goal.category.name}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Weight className="h-4 w-4" />
                      <span>{goal.weight}% weight</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Max Score: {goal.max_score}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6 w-full max-w-full overflow-x-hidden">
                {/* Goal Details */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">SMART Goal</Label>
                    <div className="text-sm mt-1 p-3 bg-muted rounded-lg whitespace-pre-wrap break-words" style={{ wordBreak: 'normal', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                      {goal.smart_goal}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Target</Label>
                      <p className="text-sm mt-1 p-3 bg-muted rounded-lg break-words" style={{ wordBreak: 'normal', overflowWrap: 'anywhere' }}>{goal.target}</p>
                    </div>
                    {goal.dependencies && (
                      <div>
                        <Label className="text-sm font-medium">Dependencies</Label>
                        <p className="text-sm mt-1 p-3 bg-muted rounded-lg break-words" style={{ wordBreak: 'normal', overflowWrap: 'anywhere' }}>{goal.dependencies}</p>
                      </div>
                    )}
                  </div>

                  {goal.manager_comments && (
                    <div>
                      <Label className="text-sm font-medium">Manager Comments</Label>
                      <p className="text-sm mt-1 p-3 bg-blue-50 border border-blue-200 rounded-lg break-words" style={{ wordBreak: 'normal', overflowWrap: 'anywhere' }}>
                        {goal.manager_comments}
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Performance Levels - Reference Only */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Performance Levels (Reference)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    These are the performance criteria your manager will use to evaluate your work. Focus on providing detailed evidence in your comments.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map(level => {
                      const marks = goal[`level_${level}_marks` as keyof typeof goal] as string || '';
                      const points = goal[`level_${level}_points` as keyof typeof goal] as number ?? 0;
                      const rating = goal[`level_${level}_rating` as keyof typeof goal] as string || '';
                      const isSelected = evaluation.selected_level === level;

                      return (
                        <div
                          key={level}
                          className={`p-2 border rounded-lg text-center text-xs ${
                            isSelected 
                              ? 'border-green-500 bg-green-50' 
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="font-medium text-center">Level {level}</div>
                          <div className="text-muted-foreground text-center">{rating}</div>
                          <div className="mt-2">
                            <div className="whitespace-pre-line text-start break-words" style={{ wordBreak: 'normal', overflowWrap: 'anywhere' }}>{marks}</div>
                            <div className="text-end mt-2">{points} points</div>
                          </div>
                          {isSelected && (
                            <div className="mt-1 text-green-600 font-medium">
                              ✓ Manager Selected
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {evaluation.selected_level && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-sm font-medium text-green-800 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Manager Evaluation: Level {evaluation.selected_level} - {evaluation.final_rating}
                      </div>
                      <div className="text-xs text-green-600">
                        Awarded: {evaluation.awarded_marks} marks • {evaluation.awarded_points} points
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Employee Comments */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Your Evidence & Comments *
                  </Label>
                  <Textarea
                    value={evaluation.employee_comments || ''}
                    onChange={(e) => handleEvaluationChange(goal.id, 'employee_comments', e.target.value)}
                    placeholder="Provide detailed evidence of your performance for this goal. Include specific examples, metrics, achievements, and any challenges faced..."
                    rows={4}
                    disabled={isReadOnly}
                    className={isReadOnly ? 'bg-muted' : ''}
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide specific evidence and examples that demonstrate your performance against this goal.
                  </p>
                </div>

                {/* Manager Evaluation (if available) */}
                {isCompleted && detailedAssignment.evaluations?.find(e => e.goal_id === goal.id)?.manager_evaluation_comments && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <Label className="text-sm font-medium text-blue-800">Manager Evaluation</Label>
                    <p className="text-sm mt-1 text-blue-700">
                      {detailedAssignment.evaluations.find(e => e.goal_id === goal.id)?.manager_evaluation_comments}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Form Actions */}
      {!isReadOnly && !isCompleted && (
        <div className="flex items-center justify-end gap-3 pt-6 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleSaveDraft}
            disabled={isSubmitting}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button 
            type="button" 
            onClick={handleSubmit}
            disabled={isSubmitting || calculateProgress() < 100}
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Submitting...' : 'Submit KRA'}
          </Button>
        </div>
      )}

      {isCompleted && (
        <div className="flex items-center justify-center p-6 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-green-800 font-medium">KRA Submitted Successfully</p>
            <p className="text-sm text-green-600">
              {assignment.submitted_at && `Submitted on ${formatDateForDisplay(assignment.submitted_at, 'MMM dd, yyyy')}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
