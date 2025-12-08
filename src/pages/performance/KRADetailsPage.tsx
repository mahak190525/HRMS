import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Settings,
  ArrowLeft
} from 'lucide-react';
import { formatDateForDisplay, getCurrentISTDate, parseToISTDate } from '@/utils/dateUtils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { KRAAssignment } from '@/hooks/useKRA';
import { useKRAPermissions } from '@/hooks/useKRAPermissions';
import { useKRAAssignmentDetails, useUpdateKRAEvaluation } from '@/hooks/useKRA';
import { supabase } from '@/services/supabase';
import { QuarterlySettingsManager } from '@/components/kra/QuarterlySettingsManager';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface EvaluationFormData {
  [goalId: string]: {
    employee_comments?: string;
    manager_evaluation_comments?: string;
    selected_level?: number;
    awarded_marks?: number;
    awarded_points?: number;
    final_rating?: string;
  };
}

export function KRADetailsPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const permissions = useKRAPermissions();
  
  const [evaluations, setEvaluations] = useState<EvaluationFormData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [showQuarterlySettings, setShowQuarterlySettings] = useState(false);
  
  const { data: assignment, isLoading, refetch } = useKRAAssignmentDetails(assignmentId || '');
  const updateEvaluation = useUpdateKRAEvaluation();
  
  // Initialize form data
  useEffect(() => {
    if (assignment?.evaluations) {
      const evaluationData: EvaluationFormData = {};
      assignment.evaluations.forEach(evaluation => {
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
  }, [assignment]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  // Sort goals by display_order for consistent rendering
  const sortedGoals = assignment?.template?.goals 
    ? [...assignment.template.goals].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    : [];

  if (!assignment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">KRA Assignment Not Found</h2>
          <p className="text-gray-600 mt-2">The requested KRA assignment could not be found.</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Determine user role capabilities
  const isEmployee = assignment.employee_id === user?.id;
  const isManager = assignment.assigned_by === user?.id;
  const isAdmin = permissions?.canViewAllKRA || user?.isSA;
  const isHR = user?.role?.name === 'hr' || user?.role?.name === 'hrm';

  // Determine view context
  const viewContext = isAdmin ? 'admin' : isHR ? 'hr' : isManager ? 'manager' : 'employee';

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
      case 'submitted':
        return <Send className="h-3 w-3" />;
      case 'evaluated':
      case 'approved':
        return <CheckCircle className="h-3 w-3" />;
      case 'in_progress':
        return <Edit className="h-3 w-3" />;
      case 'assigned':
        return <Clock className="h-3 w-3" />;
      default:
        return <Target className="h-3 w-3" />;
    }
  };

  const getDueStatus = (dueDate?: string, status?: string) => {
    if (!dueDate || status === 'evaluated' || status === 'approved') return null;
    
    const due = parseToISTDate(dueDate);
    const now = getCurrentISTDate();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { status: 'overdue', text: `Overdue by ${Math.abs(diffDays)} day(s)`, color: 'text-red-600' };
    if (diffDays <= 3) return { status: 'due-soon', text: `Due in ${diffDays} day(s)`, color: 'text-orange-600' };
    return { status: 'on-time', text: `Due in ${diffDays} day(s)`, color: 'text-green-600' };
  };

  const dueStatus = getDueStatus(assignment.due_date, assignment.status);

  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

  const getQuarterData = (quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4') => {
    const quarterKey = quarter.toLowerCase() as 'q1' | 'q2' | 'q3' | 'q4';
    const enabled = assignment[`${quarterKey}_enabled` as keyof KRAAssignment] as boolean;
    const status = assignment[`${quarterKey}_status` as keyof KRAAssignment] as string;
    const score = assignment[`${quarterKey}_total_score` as keyof KRAAssignment] as number || 0;
    const possibleScore = assignment[`${quarterKey}_total_possible_score` as keyof KRAAssignment] as number || 0;
    const percentage = assignment[`${quarterKey}_overall_percentage` as keyof KRAAssignment] as number || 0;
    const rating = assignment[`${quarterKey}_overall_rating` as keyof KRAAssignment] as string;
    const dueDate = assignment[`${quarterKey}_due_date` as keyof KRAAssignment] as string;
    const submittedAt = assignment[`${quarterKey}_submitted_at` as keyof KRAAssignment] as string;
    const evaluatedAt = assignment[`${quarterKey}_evaluated_at` as keyof KRAAssignment] as string;

    return {
      enabled,
      status,
      score,
      possibleScore,
      percentage,
      rating,
      dueDate,
      submittedAt,
      evaluatedAt
    };
  };

  const getQuarterEvaluations = (quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4') => {
    return assignment.evaluations?.filter(evaluation => evaluation.quarter === quarter) || [];
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">KRA Details</h1>
            <p className="text-muted-foreground">
              {assignment.employee?.full_name} - {assignment.template?.template_name}
            </p>
          </div>
        </div>
        <Badge className={`flex items-center gap-1 ${getStatusColor(assignment.status || '')}`}>
          {getStatusIcon(assignment.status || '')}
          <span className="capitalize">{assignment.status?.replace('_', ' ')}</span>
        </Badge>
      </div>

      {/* Assignment Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl">{assignment.template?.template_name}</CardTitle>
              <CardDescription className="mt-1">
                {assignment.template?.description}
              </CardDescription>
              
              <div className="flex items-center gap-6 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{assignment.employee?.full_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Assigned: {formatDateForDisplay(assignment.assigned_date)}</span>
                </div>
                {assignment.due_date && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className={dueStatus?.color}>
                      {dueStatus?.text || `Due: ${formatDateForDisplay(assignment.due_date)}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
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
          {/* Overall Progress */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {assignment.overall_percentage?.toFixed(1) || 0}%
              </div>
              <div className="text-sm text-blue-600">Overall Score</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {assignment.total_score || 0}
              </div>
              <div className="text-sm text-green-600">Total Points</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-lg font-semibold text-purple-600">
                {assignment.overall_rating || 'Not Rated'}
              </div>
              <div className="text-sm text-purple-600">Overall Rating</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quarterly Settings (Manager Only) */}
      {showQuarterlySettings && viewContext === 'manager' && (
        <QuarterlySettingsManager
          assignment={assignment}
          onUpdate={refetch}
          canManage={true}
        />
      )}

      {/* Quarterly Tabs */}
      <Tabs value={selectedQuarter} onValueChange={(value) => setSelectedQuarter(value as 'Q1' | 'Q2' | 'Q3' | 'Q4')}>
        <TabsList className="grid w-full grid-cols-4">
          {quarters.map((quarter) => {
            const quarterData = getQuarterData(quarter);
            return (
              <TabsTrigger key={quarter} value={quarter} className="relative">
                {quarter}
                {!quarterData.enabled && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-gray-400 rounded-full" />
                )}
                {quarterData.enabled && quarterData.status === 'evaluated' && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
                )}
                {quarterData.enabled && quarterData.status === 'submitted' && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {quarters.map((quarter) => {
          const quarterData = getQuarterData(quarter);
          const quarterEvaluations = getQuarterEvaluations(quarter);

          return (
            <TabsContent key={quarter} value={quarter} className="space-y-6">
              {/* Quarter Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{quarter} Status</span>
                    <Badge variant={quarterData.enabled ? 'default' : 'secondary'}>
                      {quarterData.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!quarterData.enabled ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>This quarter is not yet enabled for evidence submission.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Quarter Metrics */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-xl font-bold text-blue-600">
                            {quarterData.percentage.toFixed(1)}%
                          </div>
                          <div className="text-xs text-blue-600">Score</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-xl font-bold text-green-600">
                            {quarterData.score}
                          </div>
                          <div className="text-xs text-green-600">Points</div>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <div className="text-sm font-semibold text-purple-600">
                            {quarterData.rating || 'Not Rated'}
                          </div>
                          <div className="text-xs text-purple-600">Rating</div>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <div className="text-sm font-semibold text-orange-600 capitalize">
                            {quarterData.status.replace('_', ' ')}
                          </div>
                          <div className="text-xs text-orange-600">Status</div>
                        </div>
                      </div>

                      {/* Quarter Timeline */}
                      {(quarterData.dueDate || quarterData.submittedAt || quarterData.evaluatedAt) && (
                        <div className="space-y-2">
                          <h4 className="font-medium">Timeline</h4>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {quarterData.dueDate && (
                              <div>Due Date: {formatDateForDisplay(quarterData.dueDate)}</div>
                            )}
                            {quarterData.submittedAt && (
                              <div>Submitted: {formatDateForDisplay(quarterData.submittedAt)}</div>
                            )}
                            {quarterData.evaluatedAt && (
                              <div>Evaluated: {formatDateForDisplay(quarterData.evaluatedAt)}</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Goals for this quarter */}
                      <div className="space-y-4">
                        <h4 className="font-medium">Goals & Evaluations</h4>
                        {sortedGoals.map((goal) => {
                          const evaluation = quarterEvaluations.find(e => e.goal_id === goal.id);
                          
                          return (
                            <Card key={goal.id} className="border-l-4 border-l-blue-500">
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <CardTitle className="text-base">{goal.goal_id}: {goal.strategic_goal_title}</CardTitle>
                                    <CardDescription className="mt-1">
                                      Weight: {goal.weight}% | Max Score: {goal.max_score}
                                    </CardDescription>
                                  </div>
                                  {evaluation?.selected_level && (
                                    <Badge variant="outline">
                                      Level {evaluation.selected_level}
                                    </Badge>
                                  )}
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div>
                                  <Label className="text-sm font-medium">SMART Goal</Label>
                                  <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap" style={{ whiteSpace: 'pre-wrap' }}>
                                    {goal.smart_goal}
                                  </div>
                                </div>
                                
                                <div>
                                  <Label className="text-sm font-medium">Target</Label>
                                  <p className="text-sm text-muted-foreground mt-1">{goal.target}</p>
                                </div>

                                {evaluation?.employee_comments && (
                                  <div>
                                    <Label className="text-sm font-medium">Employee Evidence</Label>
                                    <div className="mt-1 p-3 bg-blue-50 rounded-lg">
                                      <p className="text-sm">{evaluation.employee_comments}</p>
                                    </div>
                                  </div>
                                )}

                                {evaluation?.manager_evaluation_comments && (
                                  <div>
                                    <Label className="text-sm font-medium">Manager Evaluation</Label>
                                    <div className="mt-1 p-3 bg-green-50 rounded-lg">
                                      <p className="text-sm">{evaluation.manager_evaluation_comments}</p>
                                      {evaluation.awarded_marks !== undefined && (
                                        <div className="mt-2 text-sm font-medium">
                                          Score: {evaluation.awarded_marks}/{goal.max_score} 
                                          ({evaluation.final_rating})
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {!evaluation && quarterData.enabled && (
                                  <div className="text-center py-4 text-muted-foreground">
                                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No evidence submitted for this goal yet.</p>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
