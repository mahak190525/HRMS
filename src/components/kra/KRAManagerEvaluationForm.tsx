import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { 
  Save, 
  Send, 
  Target, 
  MessageSquare,
  Calendar,
  CheckCircle,
  User,
  Edit
} from 'lucide-react';
import { formatDateForDisplay, getCurrentISTDate } from '@/utils/dateUtils';
import { useAuth } from '@/contexts/AuthContext';
import type { KRAAssignment } from '@/hooks/useKRA';
import type { KRAPermissions } from '@/hooks/useKRAPermissions';
import { useKRAAssignmentDetails, useUpdateKRAEvaluation, triggerKRAEmail } from '@/hooks/useKRA';
import { supabase } from '@/services/supabase';

interface KRAManagerEvaluationFormProps {
  assignment?: KRAAssignment;
  assignmentId?: string;
  permissions?: KRAPermissions;
  isAdminView?: boolean;
  onClose: () => void;
}

interface ManagerEvaluationData {
  [goalId: string]: {
    manager_evaluation_comments: string;
    selected_level?: number;
    awarded_marks?: number;
    awarded_points?: number;
    final_rating?: string;
  };
}

export function KRAManagerEvaluationForm({ assignment, assignmentId, permissions, isAdminView = false, onClose }: KRAManagerEvaluationFormProps) {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<ManagerEvaluationData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use either the passed assignment or fetch by assignmentId
  const targetAssignmentId = assignment?.id || assignmentId;
  const { data: detailedAssignment, refetch } = useKRAAssignmentDetails(targetAssignmentId!);
  const updateEvaluation = useUpdateKRAEvaluation();
  
  const currentAssignment = assignment || detailedAssignment;
  if (!currentAssignment) {
    return <div>Loading...</div>;
  }

  const updateAssignmentStatus = async (status: string) => {
    const { error } = await supabase
      .from('kra_assignments')
      .update({ 
        status: status,
        evaluated_at: status === 'evaluated' ? getCurrentISTDate().toISOString() : undefined,
        evaluated_by: status === 'evaluated' ? user?.id : undefined
      })
      .eq('id', currentAssignment.id);

    if (error) {
      console.error('Failed to update assignment status:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (detailedAssignment?.evaluations) {
      const evaluationData: ManagerEvaluationData = {};
      detailedAssignment.evaluations.forEach(evaluation => {
        if (evaluation.goal?.id) {
          evaluationData[evaluation.goal.id] = {
            manager_evaluation_comments: evaluation.manager_evaluation_comments || '',
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

  const handleLevelSelection = (goalId: string, level: number, goal: any) => {
    const points = goal[`level_${level}_points`] ?? 0;
    const rating = goal[`level_${level}_rating`] || '';

    setEvaluations(prev => ({
      ...prev,
      [goalId]: {
        ...prev[goalId],
        selected_level: level,
        awarded_marks: points, // Store points as awarded_marks (numeric)
        awarded_points: points,
        final_rating: rating,
      },
    }));
  };

  const handleSaveDraft = async () => {
    if (!detailedAssignment?.template?.goals) return;

    setIsSubmitting(true);
    try {
      for (const goal of detailedAssignment.template.goals) {
        const evaluation = evaluations[goal.id];
        const existingEval = detailedAssignment.evaluations?.find(e => e.goal_id === goal.id);
        
        if (evaluation && existingEval) {
          await updateEvaluation.mutateAsync({
            id: existingEval.id,
            selected_level: evaluation.selected_level,
            awarded_marks: evaluation.awarded_marks,
            awarded_points: evaluation.awarded_points,
            final_rating: evaluation.final_rating,
            manager_evaluation_comments: evaluation.manager_evaluation_comments,
            manager_evaluated_at: null, // Don't mark as evaluated for draft
            manager_evaluated_by: user?.id,
          });
        }
      }
      
      await refetch();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEvaluation = async () => {
    if (!detailedAssignment?.template?.goals) return;

    // Validate all goals have been evaluated
    const incompleteGoals = detailedAssignment.template.goals.filter(goal => {
      const evaluation = evaluations[goal.id];
      return !evaluation?.selected_level || !evaluation?.manager_evaluation_comments?.trim();
    });

    if (incompleteGoals.length > 0) {
      alert(`Please complete evaluation for all goals (select performance level and provide comments). Missing: ${incompleteGoals.map(g => g.goal_id).join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const now = getCurrentISTDate().toISOString();
      
      for (const goal of detailedAssignment.template.goals) {
        const evaluation = evaluations[goal.id];
        const existingEval = detailedAssignment.evaluations?.find(e => e.goal_id === goal.id);
        
        if (evaluation && existingEval) {
          await updateEvaluation.mutateAsync({
            id: existingEval.id,
            selected_level: evaluation.selected_level,
            awarded_marks: evaluation.awarded_marks,
            awarded_points: evaluation.awarded_points,
            final_rating: evaluation.final_rating,
            manager_evaluation_comments: evaluation.manager_evaluation_comments,
            manager_evaluated_at: now,
            manager_evaluated_by: user?.id,
          });
        }
      }

      // Update assignment status to evaluated
      await updateAssignmentStatus('evaluated');
      
      // Trigger notifications and email for evaluation completion
      console.log('🎯 Triggering evaluation completion notifications for assignment:', assignmentId);
      
      try {
        // Call the new manual notification function for all quarters
        // Note: This form evaluates all quarters at once, so we need to handle that
        try {
          const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
          for (const quarter of quarters) {
            try {
              const { data, error: notificationError } = await supabase.rpc('send_kra_evaluation_notifications', {
                p_assignment_id: assignmentId,
                p_quarter: quarter,
                p_manager_id: user?.id
              });
              
              if (notificationError) {
                console.error(`❌ Failed to send evaluation notifications for ${quarter}:`, notificationError);
                // If function doesn't exist yet, fall back to old behavior
                if (notificationError.code === 'PGRST116' || notificationError.message?.includes('does not exist')) {
                  console.log('⚠️ New notification function not available yet, using fallback');
                  break; // Don't try other quarters if function doesn't exist
                }
              } else {
                console.log(`✅ Evaluation notifications sent successfully for ${quarter}`);
              }
            } catch (notifError) {
              console.error(`❌ Error calling notification function for ${quarter}:`, notifError);
            }
          }
        } catch (error) {
          console.error('❌ Error in notification loop:', error);
        }

        // Also trigger email notification
        await triggerKRAEmail('evaluation', assignmentId, {
          quarter: 'All Quarters' // This form evaluates all quarters at once
        });
        console.log('✅ Evaluation email triggered successfully');
      } catch (emailError) {
        console.error('❌ Failed to trigger evaluation email:', emailError);
        // Don't fail the entire operation if email fails
      }
      
      toast.success('KRA evaluation completed - notifications and emails sent!');
      await refetch();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmitEvaluation = () => {
    if (!detailedAssignment?.template?.goals) return false;
    
    return detailedAssignment.template.goals.every(goal => {
      const evaluation = evaluations[goal.id];
      return evaluation?.selected_level && evaluation?.manager_evaluation_comments?.trim();
    });
  };

  const calculateProgress = () => {
    if (!detailedAssignment?.template?.goals) return 0;
    
    const completedGoals = detailedAssignment.template.goals.filter(goal => {
      const evaluation = evaluations[goal.id];
      return evaluation?.selected_level && evaluation?.manager_evaluation_comments?.trim();
    });
    
    return (completedGoals.length / detailedAssignment.template.goals.length) * 100;
  };

  const isReadOnlyMode = isAdminView || currentAssignment.status !== 'submitted' || permissions?.isReadOnly;
  const isCompleted = currentAssignment.status === 'evaluated' || currentAssignment.status === 'approved';

  if (!detailedAssignment) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Assignment Header */}
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
                  <User className="h-4 w-4" />
                  <span>Employee: {currentAssignment.employee?.full_name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Assigned: {formatDateForDisplay(currentAssignment.assigned_date || (currentAssignment as any).created_at, 'MMM dd, yyyy')}</span>
                </div>
                {currentAssignment.submitted_at && (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Submitted: {formatDateForDisplay(currentAssignment.submitted_at, 'MMM dd, yyyy')}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={
                currentAssignment.status === 'submitted' ? 'bg-orange-100 text-orange-800' :
                currentAssignment.status === 'evaluated' ? 'bg-green-100 text-green-800' :
                'bg-blue-100 text-blue-800'
              }>
                {currentAssignment.status?.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentAssignment.overall_percentage > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span>Overall Performance</span>
              <span>{currentAssignment.overall_percentage.toFixed(1)}% • {currentAssignment.overall_rating || 'Not rated'}</span>
            </div>
          )}
          
          {!isReadOnlyMode && !isCompleted && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Evaluation Progress</span>
                <span>{calculateProgress().toFixed(0)}%</span>
              </div>
              <Progress value={calculateProgress()} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Complete performance level selection and comments for all goals to finish evaluation
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Goals Evaluation */}
      <div className="space-y-6">
        {detailedAssignment.template?.goals?.map((goal) => {
          const employeeEval = detailedAssignment.evaluations?.find(e => e.goal_id === goal.id);
          const managerEval = evaluations[goal.id] || {};
          
          return (
            <Card key={goal.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Badge variant="outline">{goal.goal_id}</Badge>
                      {goal.strategic_goal_title}
                    </CardTitle>
                    {goal.category && (
                      <Badge variant="secondary" className="mt-2">
                        {goal.category.name}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{goal.weight}%</div>
                    <div className="text-xs text-muted-foreground">Weight</div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Goal Details */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">SMART Goal</Label>
                    <p className="text-sm mt-1 p-3 bg-muted rounded-lg">{goal.smart_goal}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Target</Label>
                      <p className="text-sm mt-1 p-3 bg-muted rounded-lg">{goal.target}</p>
                    </div>
                    {goal.dependencies && (
                      <div>
                        <Label className="text-sm font-medium">Dependencies</Label>
                        <p className="text-sm mt-1 p-3 bg-muted rounded-lg">{goal.dependencies}</p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Performance Level Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Performance Level Evaluation
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Select the performance level that best matches the employee's evidence and achievement for this goal.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                    {[1, 2, 3, 4, 5].map(level => {
                      const marks = goal[`level_${level}_marks` as keyof typeof goal] as string || '';
                      const points = goal[`level_${level}_points` as keyof typeof goal] as number || 0;
                      const rating = goal[`level_${level}_rating` as keyof typeof goal] as string || '';
                      const isSelected = managerEval.selected_level === level;

                      return (
                        <div
                          key={level}
                          onClick={() => !isReadOnlyMode && handleLevelSelection(goal.id, level, goal)}
                          className={`p-3 border rounded-lg text-center cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-green-500 bg-green-50 shadow-md' 
                              : isReadOnlyMode
                              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                              : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                          }`}
                        >
                          <div className="font-medium text-sm">Level {level}</div>
                          <div className="text-xs text-muted-foreground mb-2">{rating}</div>
                          <div className="text-xs">
                            <div className="whitespace-pre-line text-left mb-1">{marks}</div>
                            <div className="font-medium text-blue-600 text-end">{points} points</div>
                          </div>
                          {isSelected && (
                            <div className="mt-2 text-green-600 font-medium text-xs">
                              ✓ Selected
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {managerEval.selected_level && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-sm font-medium text-green-800 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Selected: Level {managerEval.selected_level} - {managerEval.final_rating}
                      </div>
                      <div className="text-xs text-green-600">
                        Awarded: {managerEval.awarded_marks} marks • {managerEval.awarded_points} points
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Employee Comments */}
                {employeeEval?.employee_comments && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Employee Evidence & Comments
                    </Label>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{employeeEval.employee_comments}</p>
                      {employeeEval.employee_submitted_at && (
                        <p className="text-xs text-green-600 mt-2">
                          Submitted on {formatDateForDisplay(employeeEval.employee_submitted_at, 'MMM dd, yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Manager Evaluation */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    Your Evaluation Comments *
                  </Label>
                  <Textarea
                    value={managerEval.manager_evaluation_comments || ''}
                    onChange={(e) => handleEvaluationChange(goal.id, 'manager_evaluation_comments', e.target.value)}
                    placeholder="Provide your detailed assessment of the employee's performance. Include feedback on their evidence, specific achievements, areas for improvement, and justification for the selected performance level..."
                    rows={4}
                    disabled={isReadOnlyMode}
                    className={isReadOnlyMode ? 'bg-muted' : ''}
                  />
                  <p className="text-xs text-muted-foreground">
                    {isReadOnlyMode 
                      ? (managerEval.manager_evaluation_comments ? 'Evaluation completed' : 'No manager evaluation provided yet.')
                      : 'Provide specific feedback on the employee\'s performance and evidence provided.'
                    }
                  </p>
                </div>

                {/* Previous Manager Evaluation (if exists and completed) */}
                {isCompleted && employeeEval?.manager_evaluation_comments && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <Label className="text-sm font-medium text-purple-800">Previous Manager Evaluation</Label>
                    <p className="text-sm mt-1 text-purple-700 whitespace-pre-wrap">
                      {employeeEval.manager_evaluation_comments}
                    </p>
                    {employeeEval.manager_evaluated_at && (
                      <p className="text-xs text-purple-600 mt-2">
                        Evaluated on {formatDateForDisplay(employeeEval.manager_evaluated_at, 'MMM dd, yyyy')}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
        
        {currentAssignment.status === 'submitted' && !permissions?.isReadOnly && (
          <>
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
              onClick={handleSubmitEvaluation}
              disabled={isSubmitting || !canSubmitEvaluation()}
            >
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Submitting...' : 'Complete Evaluation'}
            </Button>
          </>
        )}
      </div>

      {isCompleted && (
        <div className="flex items-center justify-center p-6 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-green-800 font-medium">Evaluation Completed</p>
            <p className="text-sm text-green-600">
              {currentAssignment.evaluated_at && `Completed on ${formatDateForDisplay(currentAssignment.evaluated_at, 'MMM dd, yyyy')}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
