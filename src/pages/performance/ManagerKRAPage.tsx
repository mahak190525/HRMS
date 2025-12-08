import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft,
  Calendar, 
  CheckCircle, 
  Target, 
  Clock,
  AlertTriangle,
  Save,
  Send,
  Settings,
  FileText,
  Star,
  Download,
  Eye
} from 'lucide-react';
import { formatDateForDisplay, getCurrentISTDate, parseToISTDate } from '@/utils/dateUtils';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import type { KRAAssignment } from '@/hooks/useKRA';
import { useKRAAssignmentDetails, useUpdateKRAEvaluation, useKRAAssignments, triggerKRAEmail } from '@/hooks/useKRA';
import { supabase } from '@/services/supabase';
import { QuarterlySettingsManager } from '@/components/kra/QuarterlySettingsManager';
import { getEvidenceFiles, getEvidenceFileUrl } from '@/services/evidenceService';

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

export function ManagerKRAPage() {
  const navigate = useNavigate();
  const { assignmentId } = useParams();
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<EvaluationFormData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [showQuarterlySettings, setShowQuarterlySettings] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<any[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  
  // Get all team assignments to find the current one
  const { data: teamAssignments, isLoading: assignmentsLoading } = useKRAAssignments();
  const assignment = teamAssignments?.find(a => a.id === assignmentId);
  
  // Get detailed assignment data
  const { data: detailedAssignment, refetch, isLoading: detailsLoading } = useKRAAssignmentDetails(assignmentId || '');
  const updateEvaluationMutation = useUpdateKRAEvaluation();

  const currentAssignment = detailedAssignment || assignment;
  const isLoading = assignmentsLoading || detailsLoading;

  // Sort goals by display_order for consistent rendering
  const sortedGoals = currentAssignment?.template?.goals 
    ? [...currentAssignment.template.goals].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    : [];

  // Initialize evaluations when assignment data loads
  useEffect(() => {
    if (currentAssignment?.template?.goals) {
      const initialEvaluations: EvaluationFormData = {};
      
      currentAssignment.template.goals.forEach((goal) => {
        const existingEvaluation = currentAssignment.evaluations?.find(
          (evaluation) => evaluation.goal_id === goal.id && evaluation.quarter === selectedQuarter
        );
        
        initialEvaluations[goal.id] = {
          employee_comments: existingEvaluation?.employee_comments || '',
          manager_evaluation_comments: existingEvaluation?.manager_evaluation_comments || '',
          selected_level: existingEvaluation?.selected_level || undefined,
          awarded_marks: existingEvaluation?.awarded_marks || undefined,
          awarded_points: existingEvaluation?.awarded_points || undefined,
          final_rating: existingEvaluation?.final_rating || undefined,
        };
      });
      
      setEvaluations(initialEvaluations);
    }
  }, [currentAssignment, selectedQuarter]);

  // Load evidence files when assignment or quarter changes
  useEffect(() => {
    const loadEvidenceFiles = async () => {
      if (!assignmentId) {
        console.log('No assignmentId, skipping evidence load');
        setEvidenceFiles([]);
        return;
      }

      console.log('Loading evidence files for:', { assignmentId, selectedQuarter });
      setLoadingEvidence(true);
      try {
        const { data: files, error } = await getEvidenceFiles(assignmentId, selectedQuarter);
        console.log('getEvidenceFiles response:', { files, error });
        if (error) {
          console.error('Error loading evidence files:', error);
          toast.error(`Failed to load evidence files: ${error.message || error}`);
          setEvidenceFiles([]);
        } else {
          console.log('Successfully loaded evidence files:', files);
          setEvidenceFiles(files || []);
        }
      } catch (error) {
        console.error('Exception loading evidence files:', error);
        toast.error('Failed to load evidence files');
        setEvidenceFiles([]);
      } finally {
        setLoadingEvidence(false);
      }
    };

    loadEvidenceFiles();
  }, [assignmentId, selectedQuarter]);

  // Handle evidence file view/preview
  const handleViewEvidence = async (filePath: string) => {
    try {
      const { url, error } = await getEvidenceFileUrl(filePath);
      if (error || !url) {
        toast.error('Failed to generate preview link');
        return;
      }
      
      // Open the file in a new tab for viewing
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error viewing evidence file:', error);
      toast.error('Failed to view evidence file');
    }
  };

  // Handle evidence file download
  const handleDownloadEvidence = async (filePath: string) => {
    try {
      const { url, error } = await getEvidenceFileUrl(filePath);
      if (error || !url) {
        toast.error('Failed to generate download link');
        return;
      }
      
      // Create a temporary link element to trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filePath.split('/').pop() || 'evidence-file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading evidence file:', error);
      toast.error('Failed to download evidence file');
    }
  };

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
    
    const now = getCurrentISTDate();
    const due = parseToISTDate(dueDate);
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) return { status: 'overdue', days: Math.abs(daysUntilDue), color: 'text-red-600' };
    if (daysUntilDue <= 3) return { status: 'due-soon', days: daysUntilDue, color: 'text-orange-600' };
    return { status: 'on-track', days: daysUntilDue, color: 'text-green-600' };
  };

  const canEvaluate = (assignment: KRAAssignment | null, quarter: string) => {
    if (!assignment) return false;
    
    // Check if the quarter is enabled
    const quarterEnabled = assignment[`${quarter.toLowerCase()}_enabled` as keyof KRAAssignment] as boolean;
    if (!quarterEnabled) return false;
    
    // Check quarter status - manager can evaluate if employee has submitted
    const quarterStatus = assignment[`${quarter.toLowerCase()}_status` as keyof KRAAssignment] as string;
    return quarterStatus === 'submitted' || quarterStatus === 'in_progress';
  };

  const getQuarterDueDate = (assignment: KRAAssignment | null, quarter: string) => {
    if (!assignment) return null;
    return assignment[`${quarter.toLowerCase()}_due_date` as keyof KRAAssignment] as string;
  };

  const getQuarterStatus = (assignment: KRAAssignment | null, quarter: string) => {
    if (!assignment) return 'not_started';
    return assignment[`${quarter.toLowerCase()}_status` as keyof KRAAssignment] as string || 'not_started';
  };

  const isQuarterEnabled = (assignment: KRAAssignment | null, quarter: string) => {
    if (!assignment) return false;
    return assignment[`${quarter.toLowerCase()}_enabled` as keyof KRAAssignment] as boolean || false;
  };

  const handleEvaluationChange = (goalId: string, field: keyof EvaluationFormData[string], value: any) => {
    console.log('Manager evaluation change:', { goalId, field, value });
    setEvaluations(prev => {
      const updated = {
        ...prev,
        [goalId]: {
          ...prev[goalId],
          [field]: value
        }
      };

      // Auto-fill awarded_marks and final_rating when performance level is selected
      if (field === 'selected_level' && currentAssignment?.template?.goals) {
        const goal = currentAssignment.template.goals.find(g => g.id === goalId);
        if (goal && value) {
          const levelNumber = value as number;
          const marks = goal[`level_${levelNumber}_marks` as keyof typeof goal] as string;
          const points = goal[`level_${levelNumber}_points` as keyof typeof goal] as number;
          const rating = goal[`level_${levelNumber}_rating` as keyof typeof goal] as string;
          
          // Use the level points directly as awarded marks (no calculation needed)
          updated[goalId] = {
            ...updated[goalId],
            awarded_marks: points, // Use the level points directly
            final_rating: rating || marks // Use rating if available, otherwise use marks description
          };
        }
      }

      console.log('Updated manager evaluations:', updated);
      return updated;
    });
  };

  const calculateAwardedPoints = (selectedLevel: number, goalWeight: number, maxScore: number) => {
    // Calculate points based on level (1-5 scale)
    const levelPercentage = selectedLevel / 5; // Convert to percentage (0.2, 0.4, 0.6, 0.8, 1.0)
    return (levelPercentage * goalWeight * maxScore) / 100;
  };


  const handleSaveAllEvaluations = async (isDraft: boolean) => {
    if (!currentAssignment?.template?.goals || !user) return;

    setIsSubmitting(true);
    try {
      const goals = currentAssignment.template.goals;
      let savedCount = 0;
      let errors: string[] = [];

      for (const goal of goals) {
        const evaluationData = evaluations[goal.id];
        if (!evaluationData) continue;

        // For non-draft submissions, validate required fields
        if (!isDraft && (!evaluationData.manager_evaluation_comments?.trim() || !evaluationData.selected_level)) {
          errors.push(`Goal ${goal.goal_id}: Missing evaluation comments or performance level`);
          continue;
        }

        try {
          const existingEvaluation = currentAssignment.evaluations?.find(
            (evaluation) => evaluation.goal_id === goal.id && evaluation.quarter === selectedQuarter
          );

          const awardedPoints = evaluationData.selected_level 
            ? calculateAwardedPoints(evaluationData.selected_level, goal.weight, goal.max_score)
            : 0;

          const payload = {
            assignment_id: currentAssignment.id,
            goal_id: goal.id,
            quarter: selectedQuarter,
            manager_evaluation_comments: evaluationData.manager_evaluation_comments,
            selected_level: evaluationData.selected_level,
            awarded_marks: evaluationData.awarded_marks || 0, // This should be the level points (whole numbers)
            awarded_points: awardedPoints, // This is for weighted calculations
            final_rating: evaluationData.final_rating,
            manager_evaluated_at: isDraft ? null : new Date().toISOString(),
            manager_evaluated_by: isDraft ? null : user.id,
          };

          if (existingEvaluation) {
            await updateEvaluationMutation.mutateAsync({
              id: existingEvaluation.id,
              ...payload
            });
          } else {
            const { error } = await supabase
              .from('kra_evaluations')
              .insert([payload]);
            
            if (error) throw error;
          }

          savedCount++;
        } catch (error) {
          console.error(`Error saving evaluation for goal ${goal.goal_id}:`, error);
          errors.push(`Goal ${goal.goal_id}: Failed to save`);
        }
      }

      await refetch();

      // Trigger notifications and email for quarterly evaluation completion (not for drafts)
      if (!isDraft && savedCount > 0 && errors.length === 0) {
        try {
          console.log(`🎯 Triggering ${selectedQuarter} evaluation completion notifications for assignment:`, currentAssignment.id);
          
          // Call the new manual notification function
          try {
            const { data, error: notificationError } = await supabase.rpc('send_kra_evaluation_notifications', {
              p_assignment_id: currentAssignment.id,
              p_quarter: selectedQuarter,
              p_manager_id: user.id
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
          console.log('✅ Quarterly evaluation email triggered successfully');
        } catch (emailError) {
          console.error('❌ Failed to trigger evaluation email:', emailError);
          // Don't fail the entire operation if email fails
        }
      }

      if (errors.length > 0) {
        toast.error(`Saved ${savedCount} goals. Errors: ${errors.join(', ')}`);
      } else if (savedCount > 0) {
        toast.success(isDraft 
          ? `Draft saved successfully for ${savedCount} goals` 
          : `${selectedQuarter} evaluation submitted successfully - notifications and emails sent!`
        );
      } else {
        toast.error('No evaluations to save. Please fill in the evaluation details.');
      }
    } catch (error) {
      console.error('Error saving evaluations:', error);
      toast.error('Failed to save evaluations');
    } finally {
      setIsSubmitting(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!currentAssignment) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/performance/kra')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to KRA Management
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">KRA Assignment Not Found</h3>
            <p className="text-muted-foreground text-center max-w-md">
              The KRA assignment you're looking for doesn't exist or you don't have access to it.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const quarterDueDate = getQuarterDueDate(currentAssignment, selectedQuarter);
  const quarterStatus = getQuarterStatus(currentAssignment, selectedQuarter);
  const dueStatus = quarterDueDate ? getDueStatus(quarterDueDate, quarterStatus) : null;
  const canEdit = canEvaluate(currentAssignment, selectedQuarter);
  const progressPercentage = currentAssignment[`${selectedQuarter.toLowerCase()}_overall_percentage` as keyof KRAAssignment] as number || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/performance/kra')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to KRA Management
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {currentAssignment.employee?.full_name} - {currentAssignment.template?.template_name}
            </h1>
            <p className="text-muted-foreground">
              Evaluate {selectedQuarter} performance and provide feedback
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(quarterStatus)}>
            {selectedQuarter} - {quarterStatus?.replace('_', ' ') || 'Not Started'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowQuarterlySettings(!showQuarterlySettings)}
            className="flex items-center gap-1"
          >
            <Settings className="h-3 w-3" />
            Quarterly Settings
          </Button>
        </div>
      </div>

      {/* Assignment Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Assignment Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>
                  {currentAssignment.employee?.full_name?.split(' ').map(n => n[0]).join('') || 'E'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">Employee</p>
                <p className="text-sm text-muted-foreground">
                  {currentAssignment.employee?.full_name || 'Unknown'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Assigned Date</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateForDisplay(currentAssignment.assigned_date, 'MMM dd, yyyy')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{selectedQuarter} Due Date</p>
                <p className="text-sm text-muted-foreground">
                  {quarterDueDate ? formatDateForDisplay(quarterDueDate, 'MMM dd, yyyy') : 'Not set'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{selectedQuarter} Progress</p>
                <p className="text-sm text-muted-foreground">
                  {progressPercentage.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Due Date Warning */}
          {dueStatus && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              dueStatus.status === 'overdue' ? 'bg-red-50 border border-red-200' :
              dueStatus.status === 'due-soon' ? 'bg-orange-50 border border-orange-200' :
              'bg-green-50 border border-green-200'
            }`}>
              {dueStatus.status === 'overdue' ? (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              ) : (
                <Clock className="h-4 w-4 text-orange-600" />
              )}
              <span className={`text-sm font-medium ${dueStatus.color}`}>
                {dueStatus.status === 'overdue' ? `${dueStatus.days} days overdue` :
                 dueStatus.status === 'due-soon' ? `Due in ${dueStatus.days} days` :
                 `${dueStatus.days} days remaining`}
              </span>
            </div>
          )}

          {/* Progress */}
          {quarterStatus !== 'not_started' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{selectedQuarter} Evaluation Progress</span>
                <span>{progressPercentage.toFixed(1)}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}

          {/* Score Display */}
          {quarterStatus === 'evaluated' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-gray-700">Quarterly Score ({selectedQuarter})</h4>
                <div className="text-2xl font-bold text-blue-600">
                  {progressPercentage.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">
                  Individual {selectedQuarter} performance
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-gray-700">Cumulative Score</h4>
                <div className="text-2xl font-bold text-green-600">
                  {(currentAssignment[`${selectedQuarter.toLowerCase()}_cumulative_percentage` as keyof KRAAssignment] as number || 0).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">
                  Running total through {selectedQuarter}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quarterly Settings */}
      {showQuarterlySettings && (
        <QuarterlySettingsManager
          assignment={currentAssignment}
          onUpdate={refetch}
          canManage={true}
        />
      )}

      {/* Quarter Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Quarter</CardTitle>
          <CardDescription>
            Choose which quarter you want to evaluate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedQuarter} onValueChange={(value) => setSelectedQuarter(value as 'Q1' | 'Q2' | 'Q3' | 'Q4')}>
            <TabsList className="grid w-full grid-cols-4">
              {['Q1', 'Q2', 'Q3', 'Q4'].map(quarter => {
                const isEnabled = isQuarterEnabled(currentAssignment, quarter);
                const qStatus = getQuarterStatus(currentAssignment, quarter);
                const qDueDate = getQuarterDueDate(currentAssignment, quarter);
                const qDueStatus = qDueDate ? getDueStatus(qDueDate, qStatus) : null;
                
                return (
                  <TabsTrigger 
                    key={quarter} 
                    value={quarter}
                    disabled={!isEnabled}
                    className="flex flex-col gap-1 cursor-pointer data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
                  >
                    <span>{quarter}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {isEnabled ? (qStatus?.replace('_', ' ') || 'Not Started') : 'Not Available'}
                    </span>
                    {qDueStatus?.status === 'overdue' && isEnabled && (
                      <Badge variant="destructive" className="text-xs">Overdue</Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Goals Evaluation */}
      {currentAssignment.template?.goals && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {selectedQuarter} KRA Goals Evaluation ({currentAssignment.template.goals.length})
            </h2>
            {canEdit && (
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleSaveAllEvaluations(true)}
                  disabled={isSubmitting}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
                <Button
                  onClick={() => handleSaveAllEvaluations(false)}
                  disabled={isSubmitting}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Submit Evaluation
                </Button>
              </div>
            )}
          </div>

          {!isQuarterEnabled(currentAssignment, selectedQuarter) && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">{selectedQuarter} Not Available Yet</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  {selectedQuarter} evaluation hasn't been enabled yet. Use Quarterly Settings to enable it.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Employee Evidence Documents Section - Quarter Level */}
          {isQuarterEnabled(currentAssignment, selectedQuarter) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Employee Evidence Documents for {selectedQuarter}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Documents uploaded by {currentAssignment?.employee?.full_name} for {selectedQuarter} evaluation
                </p>
              </CardHeader>
              <CardContent>
                {loadingEvidence ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="sm" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading evidence files...</span>
                  </div>
                ) : evidenceFiles.length > 0 ? (
                  <div className="space-y-3">
                    {evidenceFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">{file.original_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {(file.file_size / 1024 / 1024).toFixed(2)} MB • 
                              Uploaded {new Date(file.uploaded_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewEvidence(file.file_path)}
                            title="View document"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadEvidence(file.file_path)}
                            title="Download document"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                      {evidenceFiles.length} document{evidenceFiles.length !== 1 ? 's' : ''} uploaded by employee
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 border-2 border-dashed border-muted-foreground/25 rounded-lg bg-gray-50/50">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">
                      No evidence documents uploaded by employee for {selectedQuarter}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Goals Section */}
          {isQuarterEnabled(currentAssignment, selectedQuarter) && sortedGoals.map((goal, index) => {
            const evaluation = evaluations[goal.id] || {};
            const existingEvaluation = currentAssignment.evaluations?.find(
              (evaluation) => evaluation.goal_id === goal.id && evaluation.quarter === selectedQuarter
            );

            return (
              <Card key={goal.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        Goal {index + 1}: {goal.strategic_goal_title}
                      </CardTitle>
                      <div className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap" style={{ whiteSpace: 'pre-wrap' }}>
                        {goal.smart_goal}
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                        <span>Weight: {goal.weight}%</span>
                        <span>Max Score: {goal.max_score}</span>
                        {existingEvaluation?.awarded_marks && (
                          <span>Awarded: {existingEvaluation.awarded_marks}</span>
                        )}
                      </div>
                    </div>
                    {existingEvaluation && existingEvaluation.manager_evaluated_at && (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Evaluated
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Employee Comments (Read-only) */}
                  {existingEvaluation?.employee_comments && (
                    <div>
                      <Label className="text-sm font-medium">Employee Evidence & Comments</Label>
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm">{existingEvaluation.employee_comments}</p>
                        {existingEvaluation.employee_submitted_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Submitted on {formatDateForDisplay(existingEvaluation.employee_submitted_at, 'MMM dd, yyyy')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}


                  {/* Performance Level Selection (Manager Only) */}
                  <div>
                    <Label className="text-sm font-medium">Select Performance Level</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mt-2">
                      {[1, 2, 3, 4, 5].map((levelNumber) => {
                        const marks = goal[`level_${levelNumber}_marks` as keyof typeof goal] as string;
                        const points = goal[`level_${levelNumber}_points` as keyof typeof goal] as number;
                        const rating = goal[`level_${levelNumber}_rating` as keyof typeof goal] as string;
                        const isSelected = evaluation.selected_level === levelNumber;
                        
                        return (
                          <div
                            key={levelNumber}
                            className={`p-4 border-2 rounded-lg transition-all duration-200 ${
                              isSelected
                                ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/20'
                                : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'
                            } ${
                              canEdit 
                                ? 'cursor-pointer hover:shadow-sm' 
                                : 'cursor-not-allowed opacity-60'
                            }`}
                            onClick={() => {
                              if (canEdit) {
                                handleEvaluationChange(goal.id, 'selected_level', levelNumber);
                              }
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className={`font-bold text-sm ${isSelected ? 'text-primary' : 'text-gray-700'}`}>
                                Level {levelNumber}
                              </div>
                              {isSelected && (
                                <CheckCircle className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            <div className={`text-xs mb-2 ${isSelected ? 'text-primary/80' : 'text-muted-foreground'}`}>
                              {points} points
                            </div>
                            <div className="text-xs leading-relaxed text-gray-600 mb-2">
                              {marks}
                            </div>
                            {rating && (
                              <div className={`text-xs font-medium ${isSelected ? 'text-primary' : 'text-gray-700'}`}>
                                {rating}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {evaluation.selected_level && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-green-800">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            Level {evaluation.selected_level} selected
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Manager Evaluation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`marks-${goal.id}`} className="text-sm font-medium">
                        Awarded Marks (out of {goal.max_score})
                        {evaluation.selected_level && (
                          <span className="text-xs text-green-600 ml-2">
                            ✓ Auto-filled from Level {evaluation.selected_level}
                          </span>
                        )}
                      </Label>
                      <Input
                        id={`marks-${goal.id}`}
                        type="number"
                        min="0"
                        max={goal.max_score}
                        step="0.1"
                        value={evaluation.awarded_marks || ''}
                        onChange={(e) => handleEvaluationChange(goal.id, 'awarded_marks', parseFloat(e.target.value) || 0)}
                        className={`mt-2 ${evaluation.selected_level ? 'border-green-300 bg-green-50' : ''}`}
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`rating-${goal.id}`} className="text-sm font-medium">
                        Final Rating
                        {evaluation.selected_level && (
                          <span className="text-xs text-green-600 ml-2">
                            ✓ Auto-filled from Level {evaluation.selected_level}
                          </span>
                        )}
                      </Label>
                      <Input
                        id={`rating-${goal.id}`}
                        value={evaluation.final_rating || ''}
                        onChange={(e) => handleEvaluationChange(goal.id, 'final_rating', e.target.value)}
                        placeholder="e.g., Excellent, Good, Needs Improvement"
                        className={`mt-2 ${evaluation.selected_level ? 'border-green-300 bg-green-50' : ''}`}
                        disabled={!canEdit}
                      />
                    </div>
                  </div>

                  {/* Manager Comments */}
                  <div>
                    <Label htmlFor={`manager-comments-${goal.id}`} className="text-sm font-medium">
                      Manager Evaluation Comments
                    </Label>
                    <Textarea
                      id={`manager-comments-${goal.id}`}
                      placeholder={`Provide detailed feedback on the employee's ${selectedQuarter} performance for this goal...`}
                      value={evaluation.manager_evaluation_comments || ''}
                      onChange={(e) => handleEvaluationChange(goal.id, 'manager_evaluation_comments', e.target.value)}
                      className="mt-2 min-h-[100px]"
                      disabled={!canEdit}
                    />
                  </div>

                  
                  {!canEdit && (
                    <div className="pt-4 text-sm text-muted-foreground">
                      {quarterStatus === 'evaluated' ? 
                        `This goal has been evaluated for ${selectedQuarter}.` :
                        `${selectedQuarter} evaluation is not available yet or employee hasn't submitted their evidence.`
                      }
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
