import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Target,
  TrendingUp,
  Award,
  MessageCircle,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Star,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';

const performanceGoals = [
  {
    id: 1,
    title: 'Complete React Advanced Training',
    description: 'Finish the advanced React course and implement learnings in current project',
    targetDate: '2025-02-15',
    status: 'in_progress',
    progress: 75,
    weight: 0.3,
    createdBy: 'Sarah Johnson',
    category: 'Learning & Development'
  },
  {
    id: 2,
    title: 'Improve Code Review Quality',
    description: 'Provide more detailed and constructive code reviews for team members',
    targetDate: '2025-01-31',
    status: 'completed',
    progress: 100,
    weight: 0.2,
    createdBy: 'Mike Chen',
    category: 'Team Collaboration'
  },
  {
    id: 3,
    title: 'Lead Mobile App Project',
    description: 'Successfully deliver the mobile app project on time and within budget',
    targetDate: '2025-03-30',
    status: 'not_started',
    progress: 0,
    weight: 0.5,
    createdBy: 'Sarah Johnson',
    category: 'Project Management'
  }
];

const evaluations = [
  {
    id: 1,
    period: 'Q4 2024',
    evaluator: 'Sarah Johnson',
    overallRating: 4.2,
    technicalSkills: 4.5,
    communication: 4.0,
    teamwork: 4.3,
    leadership: 3.8,
    strengths: 'Excellent technical skills, proactive problem-solving, mentors junior developers well',
    improvements: 'Could improve presentation skills and take more initiative in client meetings',
    comments: 'Strong performer with consistent delivery. Ready for more leadership responsibilities.',
    status: 'completed',
    date: '2024-12-20'
  },
  {
    id: 2,
    period: 'Q3 2024',
    evaluator: 'Mike Chen',
    overallRating: 3.9,
    technicalSkills: 4.2,
    communication: 3.8,
    teamwork: 4.1,
    leadership: 3.5,
    strengths: 'Good technical foundation, reliable delivery, team player',
    improvements: 'Focus on code optimization and architectural thinking',
    comments: 'Solid contributor with room for growth in technical leadership.',
    status: 'completed',
    date: '2024-09-15'
  }
];

const appraisals = [
  {
    id: 1,
    year: 2024,
    selfAssessment: 'I have consistently delivered high-quality work and exceeded expectations in most projects...',
    managerAssessment: 'Excellent performance throughout the year with strong technical contributions...',
    hrAssessment: 'Recommended for promotion consideration based on consistent performance...',
    finalRating: 4.1,
    salaryIncrement: 12,
    promotionRecommended: true,
    developmentPlan: 'Focus on leadership skills development and client-facing responsibilities',
    status: 'completed'
  }
];

const feedback = [
  {
    id: 1,
    from: 'Alex Rodriguez',
    type: 'peer',
    rating: 4.5,
    feedback: 'Great team player, always willing to help and share knowledge. Code reviews are thorough and helpful.',
    isAnonymous: false,
    date: '2024-12-15'
  },
  {
    id: 2,
    from: 'Anonymous',
    type: 'subordinate',
    rating: 4.2,
    feedback: 'Good mentor and provides clear guidance. Could be more available for questions during busy periods.',
    isAnonymous: true,
    date: '2024-12-10'
  },
  {
    id: 3,
    from: 'Sarah Johnson',
    type: 'manager',
    rating: 4.3,
    feedback: 'Consistently delivers quality work and shows initiative. Ready for more challenging assignments.',
    isAnonymous: false,
    date: '2024-12-05'
  }
];

export function Performance() {
  const { user } = useAuth();
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'not_started':
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

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

  const overallProgress = performanceGoals.reduce((acc, goal) => acc + (goal.progress * goal.weight), 0);

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
            <div className="text-2xl font-bold mb-2">4.2/5</div>
            <div className="flex gap-1 mb-2">
              {renderStars(4.2)}
            </div>
            <p className="text-xs text-muted-foreground">Q4 2024 evaluation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Goals Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {performanceGoals.filter(g => g.status === 'completed').length}/
              {performanceGoals.length}
            </div>
            <Progress value={(performanceGoals.filter(g => g.status === 'completed').length / performanceGoals.length) * 100} className="mb-2" />
            <p className="text-xs text-muted-foreground">This year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Feedback Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">4.3/5</div>
            <div className="flex gap-1 mb-2">
              {renderStars(4.3)}
            </div>
            <p className="text-xs text-muted-foreground">Average from peers</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="goals" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
          <TabsTrigger value="appraisals">Appraisals</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
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
              <div className="space-y-4">
                {performanceGoals.map((goal) => (
                  <div key={goal.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold">{goal.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{goal.category}</Badge>
                        <Badge className={getStatusBadge(goal.status)}>
                          {goal.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Progress</span>
                          <span>{goal.progress}%</span>
                        </div>
                        <Progress value={goal.progress} />
                      </div>

                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Weight: {Math.round(goal.weight * 100)}%</span>
                        <span>Target: {format(new Date(goal.targetDate), 'MMM dd, yyyy')}</span>
                        <span>Set by: {goal.createdBy}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
              <div className="space-y-4">
                {evaluations.map((evaluation) => (
                  <div key={evaluation.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold">{evaluation.period} Evaluation</h3>
                        <p className="text-sm text-muted-foreground">
                          Evaluated by: {evaluation.evaluator}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{evaluation.overallRating}/5</div>
                        <div className="flex gap-1">
                          {renderStars(evaluation.overallRating)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-lg font-semibold">{evaluation.technicalSkills}</div>
                        <div className="text-xs text-muted-foreground">Technical</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">{evaluation.communication}</div>
                        <div className="text-xs text-muted-foreground">Communication</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">{evaluation.teamwork}</div>
                        <div className="text-xs text-muted-foreground">Teamwork</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">{evaluation.leadership}</div>
                        <div className="text-xs text-muted-foreground">Leadership</div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(evaluation.date), 'MMM dd, yyyy')}
                      </span>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedItem(evaluation)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{selectedItem?.period} Performance Evaluation</DialogTitle>
                            <DialogDescription>
                              Detailed evaluation feedback and ratings
                            </DialogDescription>
                          </DialogHeader>
                          {selectedItem && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-4 gap-4 text-center">
                                <div>
                                  <div className="text-lg font-semibold">{selectedItem.technicalSkills}</div>
                                  <div className="text-xs text-muted-foreground">Technical Skills</div>
                                </div>
                                <div>
                                  <div className="text-lg font-semibold">{selectedItem.communication}</div>
                                  <div className="text-xs text-muted-foreground">Communication</div>
                                </div>
                                <div>
                                  <div className="text-lg font-semibold">{selectedItem.teamwork}</div>
                                  <div className="text-xs text-muted-foreground">Teamwork</div>
                                </div>
                                <div>
                                  <div className="text-lg font-semibold">{selectedItem.leadership}</div>
                                  <div className="text-xs text-muted-foreground">Leadership</div>
                                </div>
                              </div>

                              <div>
                                <h4 className="font-medium mb-2">Strengths:</h4>
                                <p className="text-sm text-muted-foreground">{selectedItem.strengths}</p>
                              </div>

                              <div>
                                <h4 className="font-medium mb-2">Areas for Improvement:</h4>
                                <p className="text-sm text-muted-foreground">{selectedItem.improvements}</p>
                              </div>

                              <div>
                                <h4 className="font-medium mb-2">Manager Comments:</h4>
                                <p className="text-sm text-muted-foreground">{selectedItem.comments}</p>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </div>
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
              <div className="space-y-4">
                {appraisals.map((appraisal) => (
                  <div key={appraisal.id} className="border rounded-lg p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-semibold">{appraisal.year} Annual Appraisal</h3>
                        <Badge className={getStatusBadge(appraisal.status)}>
                          {appraisal.status}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">{appraisal.finalRating}/5</div>
                        <div className="flex gap-1 justify-end">
                          {renderStars(appraisal.finalRating)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">+{appraisal.salaryIncrement}%</div>
                        <div className="text-sm text-muted-foreground">Salary Increment</div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-lg font-bold text-blue-600">
                          {appraisal.promotionRecommended ? 'Yes' : 'No'}
                        </div>
                        <div className="text-sm text-muted-foreground">Promotion Recommended</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-lg font-bold text-purple-600">Active</div>
                        <div className="text-sm text-muted-foreground">Development Plan</div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Self Assessment:</h4>
                        <p className="text-sm text-muted-foreground">{appraisal.selfAssessment}</p>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Manager Assessment:</h4>
                        <p className="text-sm text-muted-foreground">{appraisal.managerAssessment}</p>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Development Plan:</h4>
                        <p className="text-sm text-muted-foreground">{appraisal.developmentPlan}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
              <div className="space-y-4">
                {feedback.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {item.isAnonymous ? 'Anonymous' : item.from}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {item.type}
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
                        {format(new Date(item.date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.feedback}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}