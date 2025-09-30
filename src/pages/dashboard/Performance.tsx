import { useState } from 'react';
import { 
  usePerformanceGoals, 
  usePerformanceEvaluations,
  usePerformanceAppraisals,
  usePerformanceFeedback 
} from '@/hooks/usePerformance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Target,
  Award,
  MessageCircle,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Star,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { MyKRAView } from '@/components/kra/MyKRAView';
import { useMyKRAAssignments } from '@/hooks/useKRA';

export function Performance() {
  const { data: performanceGoals, isLoading: goalsLoading } = usePerformanceGoals();
  const { data: evaluations, isLoading: evaluationsLoading } = usePerformanceEvaluations();
  const { data: appraisals, isLoading: appraisalsLoading } = usePerformanceAppraisals();
  const { data: feedback, isLoading: feedbackLoading } = usePerformanceFeedback();
  const { data: myKRAAssignments, isLoading: kraLoading } = useMyKRAAssignments();
  
  const [selectedItem, setSelectedItem] = useState<any>(null);


  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'bg-green-100 text-green-800',
      in_progress: 'bg-blue-100 text-blue-800',
      not_started: 'bg-gray-100 text-gray-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating) 
            ? 'text-yellow-400 fill-current' 
            : i < rating 
            ? 'text-yellow-400 fill-current opacity-50' 
            : 'text-gray-300'
        }`}
      />
    ));
  };

  const overallProgress = performanceGoals?.reduce((acc, goal) => acc + (goal.progress_percentage * goal.weight), 0) || 0;
  const completedGoals = performanceGoals?.filter(g => g.status === 'completed').length || 0;
  const totalGoals = performanceGoals?.length || 0;
  const averageFeedbackRating = feedback && feedback.length > 0 ? feedback.reduce((sum, f) => sum + (f.rating || 0), 0) / feedback.length : 0;

  if (goalsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Performance Portal</h1>
        <p className="text-muted-foreground">
          Track your goals, evaluations, and performance feedback
        </p>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{Math.round(overallProgress)}%</div>
            <Progress value={overallProgress} className="mb-2" />
            <p className="text-xs text-muted-foreground">Current year goals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Latest Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{evaluations?.[0]?.overall_rating ? `${evaluations[0].overall_rating}/5` : 'N/A'}</div>
            <div className="flex gap-1 mb-2">
              {renderStars(evaluations?.[0]?.overall_rating || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {evaluations?.[0] ? format(new Date(evaluations[0].evaluation_period_end), 'MMM yyyy') + ' evaluation' : 'No evaluations yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Goals Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {completedGoals}/{totalGoals}
            </div>
            <Progress value={totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0} className="mb-2" />
            <p className="text-xs text-muted-foreground">This year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Feedback Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{averageFeedbackRating.toFixed(1)}/5</div>
            <div className="flex gap-1 mb-2">
              {renderStars(averageFeedbackRating)}
            </div>
            <p className="text-xs text-muted-foreground">Average from peers</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="goals" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
          <TabsTrigger value="appraisals">Appraisals</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="kra">KRA</TabsTrigger>
        </TabsList>

        <TabsContent value="goals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Performance Goals
              </CardTitle>
              <CardDescription>
                Track your current performance goals and objectives
              </CardDescription>
            </CardHeader>
            <CardContent>
              {performanceGoals && performanceGoals.length > 0 ? (
                <div className="space-y-4">
                  {performanceGoals?.map((goal: any) => (
                    <div key={goal.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold">{goal.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Goal</Badge>
                          <Badge className={getStatusBadge(goal.status)}>
                            {goal.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Progress</span>
                            <span>{goal.progress_percentage}%</span>
                          </div>
                          <Progress value={goal.progress_percentage} />
                        </div>

                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>Weight: {Math.round(goal.weight * 100)}%</span>
                          <span>Target: {format(new Date(goal.target_date), 'MMM dd, yyyy')}</span>
                          <span>Set by: {goal.created_by_user?.full_name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No performance goals assigned yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evaluations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Evaluations
              </CardTitle>
              <CardDescription>
                View your quarterly and annual performance evaluations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {evaluationsLoading ? (
                <LoadingSpinner size="sm" />
              ) : evaluations && evaluations.length > 0 ? (
                <div className="space-y-4">
                  {evaluations.map((evaluation: any) => (
                    <div key={evaluation.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold">
                            {format(new Date(evaluation.evaluation_period_start), 'MMM yyyy')} - {format(new Date(evaluation.evaluation_period_end), 'MMM yyyy')} Evaluation
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Evaluated by: {evaluation.evaluator?.full_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{evaluation.overall_rating}/5</div>
                          <div className="flex gap-1">
                            {renderStars(evaluation.overall_rating)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                          <div className="text-lg font-semibold">{evaluation.technical_skills_rating}</div>
                          <div className="text-xs text-muted-foreground">Technical</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold">{evaluation.communication_rating}</div>
                          <div className="text-xs text-muted-foreground">Communication</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold">{evaluation.teamwork_rating}</div>
                          <div className="text-xs text-muted-foreground">Teamwork</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold">{evaluation.leadership_rating}</div>
                          <div className="text-xs text-muted-foreground">Leadership</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(evaluation.created_at), 'MMM dd, yyyy')}
                        </span>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              asChild
                              onClick={() => setSelectedItem(evaluation)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Performance Evaluation Details</DialogTitle>
                              <DialogDescription>
                                Detailed evaluation feedback and ratings
                              </DialogDescription>
                            </DialogHeader>
                            {selectedItem && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-4 gap-4 text-center">
                                  <div>
                                    <div className="text-lg font-semibold">{selectedItem.technical_skills_rating}</div>
                                    <div className="text-xs text-muted-foreground">Technical Skills</div>
                                  </div>
                                  <div>
                                    <div className="text-lg font-semibold">{selectedItem.communication_rating}</div>
                                    <div className="text-xs text-muted-foreground">Communication</div>
                                  </div>
                                  <div>
                                    <div className="text-lg font-semibold">{selectedItem.teamwork_rating}</div>
                                    <div className="text-xs text-muted-foreground">Teamwork</div>
                                  </div>
                                  <div>
                                    <div className="text-lg font-semibold">{selectedItem.leadership_rating}</div>
                                    <div className="text-xs text-muted-foreground">Leadership</div>
                                  </div>
                                </div>

                                {selectedItem.strengths && (
                                  <div>
                                    <h4 className="font-medium mb-2">Strengths:</h4>
                                    <p className="text-sm text-muted-foreground">{selectedItem.strengths}</p>
                                  </div>
                                )}

                                {selectedItem.areas_for_improvement && (
                                  <div>
                                    <h4 className="font-medium mb-2">Areas for Improvement:</h4>
                                    <p className="text-sm text-muted-foreground">{selectedItem.areas_for_improvement}</p>
                                  </div>
                                )}

                                {selectedItem.comments && (
                                  <div>
                                    <h4 className="font-medium mb-2">Manager Comments:</h4>
                                    <p className="text-sm text-muted-foreground">{selectedItem.comments}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No evaluations available yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appraisals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Annual Appraisals
              </CardTitle>
              <CardDescription>
                View your annual performance appraisals and career development plans
              </CardDescription>
            </CardHeader>
            <CardContent>
              {appraisalsLoading ? (
                <LoadingSpinner size="sm" />
              ) : appraisals && appraisals.length > 0 ? (
                <div className="space-y-4">
                  {appraisals.map((appraisal: any) => (
                    <div key={appraisal.id} className="border rounded-lg p-6">
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <h3 className="text-xl font-semibold">{appraisal.appraisal_year} Annual Appraisal</h3>
                          <Badge className={getStatusBadge(appraisal.status)}>
                            {appraisal.status}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold">{appraisal.final_rating}/5</div>
                          <div className="flex gap-1 justify-end">
                            {renderStars(appraisal.final_rating)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">+{appraisal.salary_increment_percentage}%</div>
                          <div className="text-sm text-muted-foreground">Salary Increment</div>
                        </div>
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-lg font-bold text-blue-600">
                            {appraisal.promotion_recommended ? 'Yes' : 'No'}
                          </div>
                          <div className="text-sm text-muted-foreground">Promotion Recommended</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <div className="text-lg font-bold text-purple-600">Active</div>
                          <div className="text-sm text-muted-foreground">Development Plan</div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {appraisal.self_assessment && (
                          <div>
                            <h4 className="font-medium mb-2">Self Assessment:</h4>
                            <p className="text-sm text-muted-foreground">{appraisal.self_assessment}</p>
                          </div>
                        )}
                        {appraisal.manager_assessment && (
                          <div>
                            <h4 className="font-medium mb-2">Manager Assessment:</h4>
                            <p className="text-sm text-muted-foreground">{appraisal.manager_assessment}</p>
                          </div>
                        )}
                        {appraisal.development_plan && (
                          <div>
                            <h4 className="font-medium mb-2">Development Plan:</h4>
                            <p className="text-sm text-muted-foreground">{appraisal.development_plan}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No appraisals available yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                360° Feedback
              </CardTitle>
              <CardDescription>
                Feedback received from managers, peers, and team members
              </CardDescription>
            </CardHeader>
            <CardContent>
              {feedbackLoading ? (
                <LoadingSpinner size="sm" />
              ) : feedback && feedback.length > 0 ? (
                <div className="space-y-4">
                  {feedback.map((item: any) => (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {item.is_anonymous ? 'Anonymous' : item.feedback_giver?.full_name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {item.feedback_type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex gap-1">
                              {renderStars(item.rating)}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {item.rating}/5
                            </span>
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(item.created_at), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.feedback_text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No feedback received yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kra" className="space-y-6">
          <MyKRAView 
            assignments={myKRAAssignments || []} 
            isLoading={kraLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}