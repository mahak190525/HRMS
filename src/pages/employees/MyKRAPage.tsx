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
import { 
  ArrowLeft,
  Calendar, 
  CheckCircle, 
  Target, 
  Clock,
  AlertTriangle,
  Save,
  Send,
  FileText,
  Upload,
  Download,
  Trash2,
  Eye
} from 'lucide-react';
import { formatDateForDisplay, getCurrentISTDate, parseToISTDate } from '@/utils/dateUtils';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import type { KRAAssignment } from '@/hooks/useKRA';
import { useKRAAssignmentDetails, useUpdateKRAEvaluation, useMyKRAAssignments, triggerKRAEmail } from '@/hooks/useKRA';
import { supabase } from '@/services/supabase';
import { EvidenceUploadModal } from '@/components/kra/EvidenceUploadModal';
import { getEvidenceFiles, getEvidenceFileUrl, deleteEvidenceFile } from '@/services/evidenceService';
import type { EvidenceFile } from '@/services/evidenceService';

interface EvaluationFormData {
  [goalId: string]: {
    employee_comments: string;
    manager_evaluation_comments: string;
    awarded_marks?: number;
    awarded_points?: number;
    final_rating?: string;
  };
}

export function MyKRAPage() {
  const navigate = useNavigate();
  const { assignmentId } = useParams();
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<EvaluationFormData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  
  // Get all assignments to find the current one
  const { data: myAssignments, isLoading: assignmentsLoading } = useMyKRAAssignments();
  const assignment = myAssignments?.find(a => a.id === assignmentId);
  
  // Get detailed assignment data
  const { data: detailedAssignment, refetch, isLoading: detailsLoading } = useKRAAssignmentDetails(assignmentId || '');
  const updateEvaluationMutation = useUpdateKRAEvaluation();

  const currentAssignment = detailedAssignment || assignment;
  const isLoading = assignmentsLoading || detailsLoading;

  // Load evidence files when quarter changes or assignment loads
  useEffect(() => {
    if (currentAssignment?.id) {
      loadEvidenceFiles();
    }
  }, [selectedQuarter, currentAssignment?.id]);

  // Initialize evaluations when assignment data loads
  useEffect(() => {
    if (currentAssignment?.template?.goals) {
      console.log('Initializing evaluations for quarter:', selectedQuarter);
      const initialEvaluations: EvaluationFormData = {};
      
      currentAssignment.template.goals.forEach((goal) => {
        const existingEvaluation = currentAssignment.evaluations?.find(
          (evaluation) => evaluation.goal_id === goal.id && evaluation.quarter === selectedQuarter
        );
        
        initialEvaluations[goal.id] = {
          employee_comments: existingEvaluation?.employee_comments || '',
          manager_evaluation_comments: existingEvaluation?.manager_evaluation_comments || '',
          awarded_marks: existingEvaluation?.awarded_marks || undefined,
          awarded_points: existingEvaluation?.awarded_points || undefined,
          final_rating: existingEvaluation?.final_rating || undefined,
        };
        
        console.log(`Goal ${goal.id} for ${selectedQuarter}:`, {
          existing: existingEvaluation?.employee_comments,
          initialized: initialEvaluations[goal.id].employee_comments
        });
      });
      
      setEvaluations(initialEvaluations);
      console.log('Set evaluations:', initialEvaluations);
    }
  }, [currentAssignment, selectedQuarter]);

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

  const isEditable = (assignment: KRAAssignment | null, quarter: string) => {
    if (!assignment) return false;
    
    // Check if the quarter is enabled
    const quarterEnabled = assignment[`${quarter.toLowerCase()}_enabled` as keyof KRAAssignment] as boolean;
    if (!quarterEnabled) return false;
    
    // Check due date for the specific quarter
    const quarterDueDate = assignment[`${quarter.toLowerCase()}_due_date` as keyof KRAAssignment] as string;
    if (quarterDueDate) {
      const now = getCurrentISTDate();
      const dueDate = parseToISTDate(quarterDueDate);
      if (now > dueDate) return false;
    }
    
    // Check quarter status
    const quarterStatus = assignment[`${quarter.toLowerCase()}_status` as keyof KRAAssignment] as string;
    return !['submitted', 'evaluated', 'approved'].includes(quarterStatus || '');
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
    console.log('handleEvaluationChange called:', { goalId, field, value });
    setEvaluations(prev => {
      const updated = {
        ...prev,
        [goalId]: {
          ...prev[goalId],
          [field]: value
        }
      };
      console.log('Updated evaluations:', updated);
      return updated;
    });
  };

  // Load evidence files for the current quarter
  const loadEvidenceFiles = async () => {
    if (!assignmentId) return;
    
    setLoadingEvidence(true);
    try {
      const { data, error } = await getEvidenceFiles(assignmentId, selectedQuarter);
      if (error) {
        console.error('Error loading evidence files:', error);
        toast.error('Failed to load evidence files');
      } else {
        setEvidenceFiles(data || []);
      }
    } catch (error) {
      console.error('Error loading evidence files:', error);
      toast.error('Failed to load evidence files');
    } finally {
      setLoadingEvidence(false);
    }
  };

  // Handle evidence file deletion
  const handleDeleteEvidence = async (fileId: string) => {
    try {
      const result = await deleteEvidenceFile(fileId);
      if (result.success) {
        toast.success('Evidence file deleted successfully');
        loadEvidenceFiles(); // Reload the list
      } else {
        toast.error(result.error || 'Failed to delete evidence file');
      }
    } catch (error) {
      console.error('Error deleting evidence file:', error);
      toast.error('Failed to delete evidence file');
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


  const handleSaveAllEvaluations = async (isDraft = true) => {
    if (!currentAssignment?.template?.goals) return;

    // Validation for submissions (not drafts)
    if (!isDraft) {
      const validationErrors: string[] = [];
      
      // Check if all goals have comments
      const goalsWithoutComments: string[] = [];
      for (const goal of currentAssignment.template.goals) {
        const evaluationData = evaluations[goal.id];
        if (!evaluationData?.employee_comments?.trim()) {
          goalsWithoutComments.push(goal.strategic_goal_title);
        }
      }
      
      if (goalsWithoutComments.length > 0) {
        validationErrors.push(`Please provide comments for all goals. Missing comments for: ${goalsWithoutComments.join(', ')}`);
      }
      
      // Show validation errors and return early
      if (validationErrors.length > 0) {
        validationErrors.forEach(error => toast.error(error));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let successCount = 0;
      let errorCount = 0;
      const goalCount = currentAssignment.template.goals.length;

      // Process all evaluations for the current quarter
      for (const goal of currentAssignment.template.goals) {
        try {
          const evaluationData = evaluations[goal.id];
          
          // For drafts, save even empty comments; for submissions, all comments are validated above
          const existingEvaluation = currentAssignment.evaluations?.find(
            (evaluation) => evaluation.goal_id === goal.id && evaluation.quarter === selectedQuarter
          );

          const payload = {
            assignment_id: currentAssignment.id,
            goal_id: goal.id,
            quarter: selectedQuarter,
            employee_comments: evaluationData?.employee_comments || '',
            // Only set employee_submitted_at for submissions (not drafts)
            employee_submitted_at: isDraft ? undefined : new Date().toISOString(),
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

          successCount++;
        } catch (error) {
          console.error(`Error processing goal ${goal.id}:`, error);
          errorCount++;
        }
      }

      // If not a draft, update the quarter status to submitted
      if (!isDraft && successCount > 0) {
        const { error } = await supabase
          .from('kra_assignments')
          .update({
            [`${selectedQuarter.toLowerCase()}_status`]: 'submitted',
            [`${selectedQuarter.toLowerCase()}_submitted_at`]: new Date().toISOString(),
            [`${selectedQuarter.toLowerCase()}_submitted_by`]: user?.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentAssignment.id);

        if (error) throw error;
      }

      await refetch();

      // Trigger email notification for quarter submission (not for drafts)
      if (!isDraft && successCount > 0) {
        console.log(`🎯 Triggering ${selectedQuarter} submission email for assignment:`, currentAssignment.id);
        await triggerKRAEmail('submission', currentAssignment.id, {
          quarter: selectedQuarter
        });
      }

      // Provide comprehensive feedback
      if (isDraft) {
        if (successCount === goalCount) {
          toast.success(`All ${goalCount} goals saved as draft successfully`);
        } else if (successCount > 0) {
          toast.success(`${successCount} of ${goalCount} goals saved as draft`);
        } else {
          toast.error('No goals were saved');
        }
      } else {
        if (successCount === goalCount) {
          toast.success(`${selectedQuarter} evaluation submitted successfully - notifications and emails sent!`);
        } else if (successCount > 0) {
          toast.success(`${selectedQuarter} evaluation submitted - ${successCount} of ${goalCount} goals processed - notifications and emails sent!`);
          if (errorCount > 0) {
            toast.error(`${errorCount} goals had errors and were not submitted`);
          }
        } else {
          toast.error('No goals were submitted. Please add comments to your goals.');
        }
      }
    } catch (error) {
      console.error('Error processing evaluations:', error);
      toast.error(isDraft ? 'Failed to save draft' : 'Failed to submit evaluation');
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
          <Button variant="ghost" onClick={() => navigate('/dashboard/performance')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Performance
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
  const canEdit = isEditable(currentAssignment, selectedQuarter);
  const progressPercentage = currentAssignment[`${selectedQuarter.toLowerCase()}_overall_percentage` as keyof KRAAssignment] as number || 0;


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard/performance')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Performance
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {user?.full_name ? `${user.full_name}'s KRA Sheet` : currentAssignment.template?.template_name}
            </h1>
            <p className="text-muted-foreground">
              {currentAssignment.template?.template_name} - {currentAssignment.template?.description}
            </p>
          </div>
        </div>
        <Badge className={getStatusColor(quarterStatus)}>
          {selectedQuarter} - {quarterStatus?.replace('_', ' ') || 'Not Started'}
        </Badge>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>
                  {currentAssignment.assigned_by_user?.full_name?.split(' ').map(n => n[0]).join('') || 'M'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">Assigned by</p>
                <p className="text-sm text-muted-foreground">
                  {currentAssignment.assigned_by_user?.full_name || 'Unknown'}
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
                <span>{selectedQuarter} Completion Progress</span>
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

      {/* Quarter Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Quarter</CardTitle>
          <CardDescription>
            Choose which quarter you want to view or complete
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
              {selectedQuarter} KRA Goals ({currentAssignment.template.goals.length})
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
                  Submit {selectedQuarter} KRA
                </Button>
              </div>
            )}
          </div>

          {canEdit && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <div className="flex items-start gap-2 mb-2">
                  <div className="font-medium">Instructions:</div>
                </div>
                <ul className="space-y-1 ml-4 list-disc">
                  <li><span className="font-medium">Save Draft:</span> Saves your progress on all goals without submitting. You can continue editing later.</li>
                  <li><span className="font-medium">Submit {selectedQuarter} KRA:</span> Submits your entire {selectedQuarter} evaluation for manager review.</li>
                </ul>
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-amber-800 text-xs">
                      <div className="font-medium mb-1">Required for Submission:</div>
                      <ul className="space-y-0.5 list-disc ml-4">
                        <li>Comments must be provided for all goals</li>
                      </ul>
                      <div className="mt-2 text-amber-700">
                        <span className="font-medium">Optional:</span> Evidence documents can be uploaded to support your evaluation
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isQuarterEnabled(currentAssignment, selectedQuarter) && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">{selectedQuarter} Not Available Yet</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Your manager hasn't enabled {selectedQuarter} evaluation yet. Please check back later or contact your manager.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Evidence Documents Section - Quarter Level */}
          {isQuarterEnabled(currentAssignment, selectedQuarter) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Evidence Documents for {selectedQuarter}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Upload supporting documents for your {selectedQuarter} performance across all goals (optional)
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-muted-foreground">
                    Upload up to 5 documents as evidence for this quarter
                  </div>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEvidenceModalOpen(true)}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Evidence
                    </Button>
                  )}
                </div>
                
                {loadingEvidence ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="sm" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading evidence files...</span>
                  </div>
                ) : evidenceFiles.length > 0 ? (
                  <div className="space-y-3">
                    {evidenceFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
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
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEvidence(file.id)}
                              className="text-red-600 hover:text-red-700"
                              title="Delete document"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                      {evidenceFiles.length}/5 files uploaded for {selectedQuarter}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground mb-4">
                      No evidence documents uploaded for {selectedQuarter}
                    </div>
                    {/* {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEvidenceModalOpen(true)}
                        className="flex items-center gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Your First Document
                      </Button>
                    )} */}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Goals Section */}
          {isQuarterEnabled(currentAssignment, selectedQuarter) && currentAssignment.template.goals.map((goal, index) => {
            const evaluation = evaluations[goal.id] || {};
            const existingEvaluation = currentAssignment.evaluations?.find(
              (evaluation) => evaluation.goal_id === goal.id && evaluation.quarter === selectedQuarter
            );

            return (
              <Card key={`${goal.id}-${selectedQuarter}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        Goal {index + 1}: {goal.strategic_goal_title}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {goal.smart_goal}
                      </CardDescription>
                      <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                        <span>Weight: {goal.weight}%</span>
                        <span>Max Score: {goal.max_score}</span>
                        {existingEvaluation?.awarded_marks && (
                          <span>Awarded: {existingEvaluation.awarded_marks}</span>
                        )}
                      </div>
                    </div>
                    {existingEvaluation && existingEvaluation.employee_submitted_at && (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Submitted
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Performance Levels (Read-only for employees) */}
                  <div>
                    <Label className="text-sm font-medium">Performance Levels Reference</Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">
                      These are the performance levels your manager will use to evaluate your work. Provide evidence in your comments below.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                      {[1, 2, 3, 4, 5].map((levelNumber) => {
                        const marks = goal[`level_${levelNumber}_marks` as keyof typeof goal] as string;
                        const points = goal[`level_${levelNumber}_points` as keyof typeof goal] as number;
                        const rating = goal[`level_${levelNumber}_rating` as keyof typeof goal] as string;
                        const isManagerSelected = existingEvaluation?.selected_level === levelNumber;
                        
                        return (
                          <div
                            key={levelNumber}
                            className={`p-4 border rounded-lg ${
                              isManagerSelected
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className={`font-bold text-sm ${isManagerSelected ? 'text-green-700' : 'text-gray-700'}`}>
                                Level {levelNumber}
                              </div>
                              {isManagerSelected && (
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span className="text-xs text-green-600 font-medium">Manager Selected</span>
                                </div>
                              )}
                            </div>
                            <div className="text-xs mb-2 text-muted-foreground">
                              {points} points
                            </div>
                            <div className="text-xs leading-relaxed text-gray-600 mb-2">
                              {marks}
                            </div>
                            {rating && (
                              <div className="text-xs font-medium text-gray-700">
                                {rating}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {existingEvaluation?.selected_level && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-green-800">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            Your manager has evaluated this goal at Level {existingEvaluation.selected_level}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Employee Comments */}
                  <div>
                    <Label htmlFor={`comments-${goal.id}`} className="text-sm font-medium">
                      Your Evidence & Comments for {selectedQuarter}
                      {canEdit && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    <Textarea
                      key={`comments-${goal.id}-${selectedQuarter}`}
                      id={`comments-${goal.id}`}
                      placeholder={`Provide evidence and comments for your ${selectedQuarter} performance on this goal... (Required for submission)`}
                      value={evaluation.employee_comments || ''}
                      onChange={(e) => handleEvaluationChange(goal.id, 'employee_comments', e.target.value)}
                      className={`mt-2 min-h-[100px] ${
                        canEdit && !evaluation.employee_comments?.trim() 
                          ? 'border-red-200 focus:border-red-500' 
                          : ''
                      }`}
                      disabled={!canEdit}
                      required={canEdit}
                    />
                    {canEdit && !evaluation.employee_comments?.trim() && (
                      <p className="text-xs text-red-500 mt-1">
                        Comments are required for submission
                      </p>
                    )}
                  </div>

                  {/* Manager Feedback (if available) */}
                  {existingEvaluation?.manager_evaluation_comments && (
                    <div>
                      <Label className="text-sm font-medium">Manager Feedback</Label>
                      <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm">{existingEvaluation.manager_evaluation_comments}</p>
                        {existingEvaluation.awarded_marks && (
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>Awarded Marks: {existingEvaluation.awarded_marks}</span>
                            <span>Points: {existingEvaluation.awarded_points}</span>
                            {existingEvaluation.final_rating && (
                              <span>Rating: {existingEvaluation.final_rating}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  
                  {!canEdit && (
                    <div className="pt-4 text-sm text-muted-foreground">
                      {quarterStatus === 'submitted' ? 
                        `This goal was submitted for ${selectedQuarter}. Waiting for manager evaluation.` :
                        `${selectedQuarter} evaluation period has ended or is not yet available.`
                      }
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Evidence Upload Modal */}
      {currentAssignment && (
        <EvidenceUploadModal
          isOpen={isEvidenceModalOpen}
          onClose={() => setIsEvidenceModalOpen(false)}
          assignmentId={currentAssignment.id}
          employeeName={currentAssignment.employee?.full_name || 'Employee'}
          templateName={currentAssignment.template?.template_name || 'KRA Template'}
          quarter={selectedQuarter}
          onFilesUploaded={loadEvidenceFiles}
        />
      )}
    </div>
  );
}
