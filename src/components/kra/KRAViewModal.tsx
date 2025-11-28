import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { 
  User, 
  Calendar, 
  CheckCircle, 
  Target, 
  MessageSquare,
  Clock,
  AlertTriangle,
  Save,
  Send,
  Edit,
  Settings
} from 'lucide-react';
import { formatDateForDisplay, getCurrentISTDate, parseToISTDate } from '@/utils/dateUtils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { KRAAssignment } from '@/hooks/useKRA';
import type { KRAPermissions } from '@/hooks/useKRAPermissions';
import { useKRAAssignmentDetails, useUpdateKRAEvaluation, triggerKRAEmail } from '@/hooks/useKRA';
import { supabase } from '@/services/supabase';
import { QuarterlySettingsManager } from './QuarterlySettingsManager';

interface KRAModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: KRAAssignment | null;
  permissions?: KRAPermissions;
  title?: string;
  description?: string;
  viewContext?: 'employee' | 'manager' | 'admin' | 'hr'; // Which dashboard context is this being viewed from
}

interface EvaluationFormData {
  [goalId: string]: {
    employee_comments: string;
    manager_evaluation_comments: string;
    selected_level?: number;
    awarded_marks?: number;
    awarded_points?: number;
    final_rating?: string;
  };
}

export function KRAModal({ 
  isOpen, 
  onClose, 
  assignment, 
  permissions,
  title,
  description,
  viewContext = 'employee'
}: KRAModalProps) {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<EvaluationFormData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [showQuarterlySettings, setShowQuarterlySettings] = useState(false);
  
  // Always call hooks - use assignment?.id to handle null cases
  const { data: detailedAssignment, refetch } = useKRAAssignmentDetails(assignment?.id || '');
  const updateEvaluation = useUpdateKRAEvaluation();
  
  // Initialize form data - MUST be called before any conditional logic
  useEffect(() => {
    if (detailedAssignment?.evaluations) {
      const evaluationData: EvaluationFormData = {};
      detailedAssignment.evaluations.forEach(evaluation => {
        if (evaluation.goal?.id) {
          evaluationData[evaluation.goal.id] = {
            employee_comments: evaluation.employee_comments || '',
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
  
  // Early return after all hooks are called
  if (!assignment) return null;
  
  const currentAssignment = detailedAssignment || assignment;

  // Determine user role capabilities
  const isEmployee = currentAssignment.employee_id === user?.id;
  const isManager = currentAssignment.assigned_by === user?.id;
  const isAdmin = permissions?.canViewAllKRA || user?.isSA;
  const isHR = user?.role?.name === 'hr' || user?.role?.name === 'hrm';

  // Determine edit capabilities based on dashboard context and assignment status
  const determineEditCapabilities = () => {
    const dueDate = currentAssignment.due_date ? parseToISTDate(currentAssignment.due_date) : null;
    const isNotOverdue = !dueDate || getCurrentISTDate() <= dueDate;
    const isCompleted = ['evaluated', 'approved'].includes(currentAssignment.status || '');
    
    switch (viewContext) {
      case 'employee':
        // Employee dashboard - can edit their own comments if not submitted and not overdue
        return {
          canEditEmployee: isEmployee && 
                          (currentAssignment.status === 'assigned' || currentAssignment.status === 'in_progress') && 
                          isNotOverdue && !isCompleted,
          canEditManager: false,
          showEmployeeSection: true,
          showManagerSection: true, // Show but read-only
          primaryAction: 'submit' // Submit for review
        };
        
      case 'manager':
        // Manager dashboard - can evaluate submitted KRAs
        return {
          canEditEmployee: false,
          canEditManager: isManager && currentAssignment.status === 'submitted' && !isCompleted,
          showEmployeeSection: true, // Show employee comments read-only
          showManagerSection: true,
          primaryAction: 'evaluate' // Evaluate/approve
        };
        
      case 'admin':
      case 'hr':
        // Admin/HR dashboard - can view everything, edit if needed
        return {
          canEditEmployee: false,
          canEditManager: (isAdmin || isHR) && currentAssignment.status === 'submitted' && !isCompleted,
          showEmployeeSection: true,
          showManagerSection: true,
          primaryAction: 'evaluate' // Evaluate/approve for admin override
        };
        
      default:
        return {
          canEditEmployee: false,
          canEditManager: false,
          showEmployeeSection: true,
          showManagerSection: true,
          primaryAction: 'view'
        };
    }
  };

  const editCapabilities = determineEditCapabilities();


  // Form handlers
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
    if (!editCapabilities.canEditManager) return;
    
    const points = goal[`level_${level}_points`] ?? 0;
    const rating = goal[`level_${level}_rating`] || '';

    setEvaluations(prev => ({
      ...prev,
      [goalId]: {
        ...prev[goalId],
        selected_level: level,
        awarded_marks: points,
        awarded_points: points,
        final_rating: rating,
      },
    }));
  };

  // Save employee draft
  const handleSaveEmployeeDraft = async () => {
    if (!currentAssignment?.template?.goals) return;

    setIsSubmitting(true);
    try {
      for (const goal of currentAssignment.template.goals) {
        const evaluation = evaluations[goal.id];
        const existingEval = currentAssignment.evaluations?.find(e => e.goal_id === goal.id);
        
        if (evaluation?.employee_comments?.trim()) {
          if (existingEval) {
            // Update existing evaluation
            await updateEvaluation.mutateAsync({
              id: existingEval.id,
              employee_comments: evaluation.employee_comments,
              employee_submitted_at: undefined, // Don't mark as submitted for draft
            });
          } else {
            // Create new evaluation
            await updateEvaluation.mutateAsync({
              assignment_id: currentAssignment.id,
              goal_id: goal.id,
              employee_comments: evaluation.employee_comments,
              awarded_marks: 0,
              awarded_points: 0,
              weighted_score: 0,
              employee_submitted_at: undefined, // Don't mark as submitted for draft
            });
          }
        }
      }
      
      await updateAssignmentStatus('in_progress');
      toast.success('Draft saved successfully');
      await refetch();
    } catch (error) {
      toast.error('Failed to save draft');
      console.error('Save draft error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit employee evaluation
  const handleSubmitEmployeeEvaluation = async () => {
    if (!currentAssignment?.template?.goals) return;

    // Validate all goals have employee comments
    const incompleteGoals = currentAssignment.template.goals.filter(goal => {
      const evaluation = evaluations[goal.id];
      return !evaluation?.employee_comments?.trim();
    });

    if (incompleteGoals.length > 0) {
      toast.error(`Please provide evidence for all goals. Missing: ${incompleteGoals.map(g => g.goal_id).join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const now = getCurrentISTDate().toISOString();
      
      for (const goal of currentAssignment.template.goals) {
        const evaluation = evaluations[goal.id];
        const existingEval = currentAssignment.evaluations?.find(e => e.goal_id === goal.id);
        
        if (evaluation?.employee_comments?.trim()) {
          if (existingEval) {
            // Update existing evaluation
            await updateEvaluation.mutateAsync({
              id: existingEval.id,
              employee_comments: evaluation.employee_comments,
              employee_submitted_at: now,
            });
          } else {
            // Create new evaluation
            await updateEvaluation.mutateAsync({
              assignment_id: currentAssignment.id,
              goal_id: goal.id,
              employee_comments: evaluation.employee_comments,
              awarded_marks: 0,
              awarded_points: 0,
              weighted_score: 0,
              employee_submitted_at: now,
            });
          }
        }
      }

      await updateAssignmentStatus('submitted');
      
      // Trigger email notification for submission
      console.log('🎯 Triggering submission email for assignment:', currentAssignment.id);
      await triggerKRAEmail('submission', currentAssignment.id, {
        quarter: selectedQuarter
      });
      
      toast.success('KRA submitted for manager review - notifications and emails sent!');
      await refetch();
      onClose();
    } catch (error) {
      toast.error('Failed to submit KRA');
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit manager evaluation
  const handleSubmitManagerEvaluation = async () => {
    if (!currentAssignment?.template?.goals) return;

    // Validate all goals have been evaluated
    const incompleteGoals = currentAssignment.template.goals.filter(goal => {
      const evaluation = evaluations[goal.id];
      return !evaluation?.selected_level || !evaluation?.manager_evaluation_comments?.trim();
    });

    if (incompleteGoals.length > 0) {
      toast.error(`Please complete evaluation for all goals (select performance level and provide comments). Missing: ${incompleteGoals.map(g => g.goal_id).join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const now = getCurrentISTDate().toISOString();
      
      for (const goal of currentAssignment.template.goals) {
        const evaluation = evaluations[goal.id];
        const existingEval = currentAssignment.evaluations?.find(e => e.goal_id === goal.id);
        
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

      await updateAssignmentStatus('evaluated');
      
      // Trigger notifications and email for evaluation
      console.log('🎯 Triggering evaluation notifications for assignment:', currentAssignment.id);
      
      try {
        // Call the new manual notification function
        try {
          const { data, error: notificationError } = await supabase.rpc('send_kra_evaluation_notifications', {
            p_assignment_id: currentAssignment.id,
            p_quarter: selectedQuarter,
            p_manager_id: user?.id
          });
          
          if (notificationError) {
            console.error('❌ Failed to send evaluation notifications:', notificationError);
            // If function doesn't exist yet, fall back to old behavior
            if (notificationError.code === 'PGRST116' || notificationError.message?.includes('does not exist')) {
              console.log('⚠️ New notification function not available yet, using fallback');
            }
          } else {
            console.log('✅ Evaluation notifications sent successfully');
          }
        } catch (notifError) {
          console.error('❌ Error calling notification function:', notifError);
        }

        // Also trigger email notification
        await triggerKRAEmail('evaluation', currentAssignment.id, {
          quarter: selectedQuarter
        });
        console.log('✅ Evaluation email triggered successfully');
      } catch (emailError) {
        console.error('❌ Failed to trigger evaluation email:', emailError);
        // Don't fail the entire operation if email fails
      }
      
      toast.success('KRA evaluation completed - notifications and emails sent!');
      await refetch();
      onClose();
    } catch (error) {
      toast.error('Failed to complete evaluation');
      console.error('Evaluation error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if employee can submit
  const canSubmitEmployee = () => {
    if (!currentAssignment?.template?.goals) return false;
    return currentAssignment.template.goals.every(goal => {
      const evaluation = evaluations[goal.id];
      return evaluation?.employee_comments?.trim();
    });
  };

  // Check if manager can submit evaluation
  const canSubmitManager = () => {
    if (!currentAssignment?.template?.goals) return false;
    return currentAssignment.template.goals.every(goal => {
      const evaluation = evaluations[goal.id];
      return evaluation?.selected_level && evaluation?.manager_evaluation_comments?.trim();
    });
  };

  // Update assignment status
  const updateAssignmentStatus = async (status: string) => {
    const updates: any = { 
      status: status,
      updated_at: getCurrentISTDate().toISOString()
    };

    if (status === 'submitted') {
      updates.submitted_at = getCurrentISTDate().toISOString();
      updates.submitted_by = user?.id;
    } else if (status === 'evaluated') {
      updates.evaluated_at = getCurrentISTDate().toISOString();
      updates.evaluated_by = user?.id;
    }

    const { error } = await supabase
      .from('kra_assignments')
      .update(updates)
      .eq('id', currentAssignment.id);

    if (error) {
      console.error('Failed to update assignment status:', error);
      throw error;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'evaluated':
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'assigned':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'assigned':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
        return <AlertTriangle className="h-4 w-4" />;
      case 'submitted':
        return <CheckCircle className="h-4 w-4" />;
      case 'evaluated':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getDueStatus = (dueDate?: string, status?: string) => {
    if (!dueDate || ['submitted', 'evaluated', 'approved'].includes(status || '')) return null;
    
    const now = getCurrentISTDate();
    const due = parseToISTDate(dueDate);
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) return { status: 'overdue', days: Math.abs(daysUntilDue), color: 'text-red-600' };
    if (daysUntilDue <= 3) return { status: 'due-soon', days: daysUntilDue, color: 'text-orange-600' };
    return { status: 'on-track', days: daysUntilDue, color: 'text-green-600' };
  };

  const dueStatus = getDueStatus(currentAssignment.due_date, currentAssignment.status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {title || `KRA Details - ${currentAssignment.employee?.full_name}`}
          </DialogTitle>
          <DialogDescription>
            {description || 'View complete KRA assignment details and current progress.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Assignment Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl">{currentAssignment.template?.template_name}</CardTitle>
                  <CardDescription className="mt-1">
                    {currentAssignment.template?.description}
                  </CardDescription>
                  
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>Employee: {currentAssignment.employee?.full_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Assigned: {formatDateForDisplay(currentAssignment.assigned_date || getCurrentISTDate(), 'MMM dd, yyyy')}</span>
                    </div>
                    {currentAssignment.due_date && (
                      <div className="flex items-center gap-1">
                        <Clock className={`h-4 w-4 ${dueStatus?.color || ''}`} />
                        <span className={dueStatus?.color}>
                          Due: {formatDateForDisplay(currentAssignment.due_date, 'MMM dd, yyyy')}
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
                    {currentAssignment.submitted_at && (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Submitted: {formatDateForDisplay(currentAssignment.submitted_at, 'MMM dd, yyyy')}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge className={`flex items-center gap-1 ${getStatusColor(currentAssignment.status || '')}`}>
                    {getStatusIcon(currentAssignment.status || '')}
                    <span className="capitalize">{currentAssignment.status?.replace('_', ' ')}</span>
                  </Badge>
                  {viewContext === 'manager' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQuarterlySettings(!showQuarterlySettings)}
                      className="flex items-center gap-1"
                    >
                      <Settings className="h-3 w-3" />
                      Quarterly Settings
                    </Button>
                  )}
                  {dueStatus?.status === 'overdue' && (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Overdue
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {/* Employee Info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {currentAssignment.employee?.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{currentAssignment.employee?.full_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {currentAssignment.employee?.employee_id && `ID: ${currentAssignment.employee.employee_id}`}
                  </div>
                </div>
              </div>

              {/* Progress Information */}
              {assignment.overall_percentage > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Overall Performance</span>
                    <span className="font-medium">
                      {assignment.overall_percentage.toFixed(1)}% • {assignment.overall_rating || 'Not rated'}
                    </span>
                  </div>
                  <Progress value={assignment.overall_percentage} className="h-2" />
                </div>
              )}

              {/* Manager Information */}
              {assignment.assigned_by_user && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm">
                    <span className="font-medium text-blue-800">Assigned by: </span>
                    <span className="text-blue-700">{assignment.assigned_by_user.full_name}</span>
                    {assignment.evaluated_at && (
                      <div className="mt-1">
                        <span className="font-medium text-blue-800">Evaluated on: </span>
                        <span className="text-blue-700">{formatDateForDisplay(assignment.evaluated_at, 'MMM dd, yyyy')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quarterly Settings (for managers/admins) */}
          {showQuarterlySettings && (viewContext === 'manager' || viewContext === 'admin') && (
            <QuarterlySettingsManager
              assignment={currentAssignment}
              onUpdate={refetch}
              canManage={true}
            />
          )}

          {/* Template Goals */}
          {currentAssignment.template?.goals && currentAssignment.template.goals.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">KRA Goals</h3>
              {currentAssignment.template.goals.map((goal) => {
                const evaluation = currentAssignment.evaluations?.find(e => e.goal_id === goal.id);
                
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
                    
                    <CardContent className="space-y-4">
                      {/* Goal Details */}
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium">SMART Goal</Label>
                          <p className="text-sm mt-1 p-3 bg-muted rounded-lg whitespace-pre-line">{goal.smart_goal}</p>
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

                      {/* Performance Level Selection/Display */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Performance Level Evaluation
                          {editCapabilities.canEditManager && <span className="text-red-500">*</span>}
                        </Label>
                        {editCapabilities.canEditManager && (
                          <p className="text-xs text-muted-foreground">
                            Select the performance level that best matches the employee's evidence and achievement for this goal.
                          </p>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                          {[1, 2, 3, 4, 5].map(level => {
                            const marks = goal[`level_${level}_marks` as keyof typeof goal] as string || '';
                            const points = goal[`level_${level}_points` as keyof typeof goal] as number || 0;
                            const rating = goal[`level_${level}_rating` as keyof typeof goal] as string || '';
                            const isSelected = evaluations[goal.id]?.selected_level === level;

                            return (
                              <div
                                key={level}
                                onClick={() => editCapabilities.canEditManager && handleLevelSelection(goal.id, level, goal)}
                                className={`p-3 border rounded-lg transition-all ${
                                  isSelected 
                                    ? 'border-green-500 bg-green-50 shadow-md' 
                                    : editCapabilities.canEditManager
                                    ? 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                                    : 'border-gray-200 bg-white'
                                } ${!editCapabilities.canEditManager ? 'cursor-default' : ''}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">Level {level} - {rating}</div>
                                    <div className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{marks}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium text-blue-600">{points} points</div>
                                    {isSelected && (
                                      <div className="text-green-600 font-medium text-xs mt-1">
                                        ✓ Selected
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {evaluations[goal.id]?.selected_level && (
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="text-sm font-medium text-green-800 flex items-center gap-2">
                              <CheckCircle className="h-4 w-4" />
                              Selected: Level {evaluations[goal.id].selected_level} - {evaluations[goal.id].final_rating}
                            </div>
                            <div className="text-xs text-green-600">
                              Awarded: {evaluations[goal.id].awarded_marks} marks • {evaluations[goal.id].awarded_points} points
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Employee Evidence Section */}
                      {editCapabilities.showEmployeeSection && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              Employee Evidence & Comments
                              {editCapabilities.canEditEmployee && <span className="text-red-500">*</span>}
                            </Label>
                            {editCapabilities.canEditEmployee ? (
                              <Textarea
                                value={evaluations[goal.id]?.employee_comments || ''}
                                onChange={(e) => handleEvaluationChange(goal.id, 'employee_comments', e.target.value)}
                                placeholder="Provide detailed evidence of your performance for this goal. Include specific achievements, metrics, examples, and any challenges faced..."
                                rows={4}
                                className="min-h-[100px]"
                              />
                            ) : evaluation?.employee_comments ? (
                              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-sm whitespace-pre-wrap">{evaluation.employee_comments}</p>
                                {evaluation.employee_submitted_at && (
                                  <p className="text-xs text-green-600 mt-2">
                                    Submitted on {formatDateForDisplay(evaluation.employee_submitted_at, 'MMM dd, yyyy')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                <p className="text-sm text-muted-foreground italic">No employee evidence provided yet.</p>
                              </div>
                            )}
                            {editCapabilities.canEditEmployee && (
                              <p className="text-xs text-muted-foreground">
                                Provide specific evidence of your performance and achievements for this goal.
                              </p>
                            )}
                          </div>
                        </>
                      )}

                      {/* Manager Evaluation Section */}
                      {editCapabilities.showManagerSection && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <Edit className="h-4 w-4" />
                              Manager Evaluation Comments
                              {editCapabilities.canEditManager && <span className="text-red-500">*</span>}
                            </Label>
                            {editCapabilities.canEditManager ? (
                              <Textarea
                                value={evaluations[goal.id]?.manager_evaluation_comments || ''}
                                onChange={(e) => handleEvaluationChange(goal.id, 'manager_evaluation_comments', e.target.value)}
                                placeholder="Provide your detailed assessment of the employee's performance. Include feedback on their evidence, specific achievements, areas for improvement, and justification for the selected performance level..."
                                rows={4}
                                className="min-h-[100px]"
                              />
                            ) : evaluation?.manager_evaluation_comments ? (
                              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                                <p className="text-sm whitespace-pre-wrap">{evaluation.manager_evaluation_comments}</p>
                                {evaluation.manager_evaluated_at && (
                                  <p className="text-xs text-purple-600 mt-2">
                                    Evaluated on {formatDateForDisplay(evaluation.manager_evaluated_at, 'MMM dd, yyyy')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                <p className="text-sm text-muted-foreground italic">No manager evaluation provided yet.</p>
                              </div>
                            )}
                            {editCapabilities.canEditManager && (
                              <p className="text-xs text-muted-foreground">
                                Provide specific feedback on the employee's performance and evidence provided.
                              </p>
                            )}
                          </div>
                        </>
                      )}

                      {/* Performance Summary */}
                      {evaluation && (evaluation.selected_level || evaluation.final_rating) && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-blue-800">Performance Summary</div>
                              {evaluation.selected_level && (
                                <div className="text-xs text-blue-600">
                                  Level {evaluation.selected_level}: {evaluation.final_rating}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              {evaluation.awarded_marks && (
                                <div className="text-sm font-medium text-blue-600">
                                  {evaluation.awarded_marks} points
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Completion Status Display */}
          {currentAssignment.status === 'evaluated' && (
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

          {/* Progress Display for Employee */}
          {viewContext === 'employee' && editCapabilities.canEditEmployee && (
            <div className="space-y-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Completion Progress</span>
                <span>{Math.round((currentAssignment.template?.goals?.filter(goal => evaluations[goal.id]?.employee_comments?.trim()).length || 0) / (currentAssignment.template?.goals?.length || 1) * 100)}%</span>
              </div>
              <Progress 
                value={(currentAssignment.template?.goals?.filter(goal => evaluations[goal.id]?.employee_comments?.trim()).length || 0) / (currentAssignment.template?.goals?.length || 1) * 100} 
                className="h-2" 
              />
              <p className="text-xs text-blue-600">
                Complete evidence for all goals to submit for manager review
              </p>
            </div>
          )}

          {/* Progress Display for Manager */}
          {viewContext === 'manager' && editCapabilities.canEditManager && (
            <div className="space-y-2 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Evaluation Progress</span>
                <span>{Math.round((currentAssignment.template?.goals?.filter(goal => evaluations[goal.id]?.selected_level && evaluations[goal.id]?.manager_evaluation_comments?.trim()).length || 0) / (currentAssignment.template?.goals?.length || 1) * 100)}%</span>
              </div>
              <Progress 
                value={(currentAssignment.template?.goals?.filter(goal => evaluations[goal.id]?.selected_level && evaluations[goal.id]?.manager_evaluation_comments?.trim()).length || 0) / (currentAssignment.template?.goals?.length || 1) * 100} 
                className="h-2" 
              />
              <p className="text-xs text-orange-600">
                Complete performance level selection and comments for all goals to finish evaluation
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t">
            <div className="text-sm text-muted-foreground">
              {viewContext === 'employee' && editCapabilities.canEditEmployee && (
                <span>Complete your evidence for all goals to submit for manager review</span>
              )}
              {viewContext === 'manager' && editCapabilities.canEditManager && (
                <span>Select performance levels and provide evaluation comments for all goals</span>
              )}
              {(viewContext === 'admin' || viewContext === 'hr') && (
                <span>Viewing {currentAssignment.employee?.full_name}'s KRA from admin perspective</span>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
              
              {/* Employee Actions */}
              {editCapabilities.canEditEmployee && (
                <>
                  <Button 
                    onClick={handleSaveEmployeeDraft}
                    variant="outline"
                    disabled={isSubmitting}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </Button>
                  <Button 
                    onClick={handleSubmitEmployeeEvaluation}
                    disabled={isSubmitting || !canSubmitEmployee()}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Submitting...' : 'Submit for Review'}
                  </Button>
                </>
              )}
              
              {/* Manager Actions */}
              {editCapabilities.canEditManager && (
                <>
                  <Button 
                    onClick={handleSubmitManagerEvaluation}
                    disabled={isSubmitting || !canSubmitManager()}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Submitting...' : 'Complete Evaluation'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Export with alias for backward compatibility and clearer naming
export { KRAModal as KRAViewModal };
