import { useLMSMetrics, useAllCandidatesProgress } from '@/hooks/useLMS';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Users,
  BookOpen,
  Award,
  FileText,
  TrendingUp,
  CheckCircle,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useNavigate } from 'react-router-dom';
import { getCurrentISTDate } from '@/utils/dateUtils';

export function LMSManagerDashboard() {
  const { data: metrics, isLoading: metricsLoading } = useLMSMetrics();
  const { data: candidates, isLoading: candidatesLoading } = useAllCandidatesProgress();
  const navigate = useNavigate();

  const dashboardCards = [
    {
      title: 'Total Learners',
      value: metrics?.totalUsers || 0,
      description: 'Active users in LMS',
      icon: Users,
      color: 'bg-blue-500',
      trend: `${metrics?.usersWithProgress || 0} with progress`,
    },
    {
      title: 'Module Completion',
      value: `${metrics?.completionRate || 0}%`,
      description: 'Overall completion rate',
      icon: BookOpen,
      color: 'bg-green-500',
      trend: `${metrics?.completedModules || 0} modules completed`,
    },
    {
      title: 'Quiz Performance',
      value: `${metrics?.averageQuizScore || 0}%`,
      description: 'Average quiz score',
      icon: Award,
      color: 'bg-purple-500',
      trend: 'Across all quizzes',
    },
    {
      title: 'Document Approval',
      value: `${metrics?.documentApprovalRate || 0}%`,
      description: 'Documents approved',
      icon: FileText,
      color: 'bg-orange-500',
      trend: `${metrics?.documentsApproved || 0}/${metrics?.totalDocuments || 0} approved`,
    },
  ];

  const quickActions = [
    {
      title: 'Manage Modules',
      description: 'Create and edit learning content',
      icon: BookOpen,
      color: 'bg-blue-100 text-blue-600',
      action: () => navigate('/lms/modules'),
    },
    {
      title: 'Review Documents',
      description: 'Approve uploaded documents',
      icon: FileText,
      color: 'bg-green-100 text-green-600',
      action: () => navigate('/lms/candidates'),
    },
    {
      title: 'View Reports',
      description: 'Generate progress reports',
      icon: BarChart3,
      color: 'bg-purple-100 text-purple-600',
      action: () => navigate('/lms/reports'),
    },
  ];

  // Get candidates needing attention
  const candidatesNeedingAttention = candidates?.filter(candidate => {
    const documents = candidate.documents || [];
    const pendingDocs = documents.filter((d: any) => d.status === 'uploaded' || d.status === 'under_review');
    const moduleProgress = candidate.module_progress || [];
    const stuckModules = moduleProgress.filter((mp: any) => 
      mp.status === 'in_progress' && 
      mp.last_accessed_at && 
      new Date(mp.last_accessed_at) < new Date(getCurrentISTDate().getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
    );
    
    return pendingDocs.length > 0 || stuckModules.length > 0;
  }).slice(0, 5);

  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">LMS Manager Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor learning progress and manage training content
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardCards.map((card) => {
          const IconComponent = card.icon;
          return (
            <Card key={card.title} className="relative overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <div className={`p-2 rounded-lg ${card.color}`}>
                  <IconComponent className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">{card.description}</p>
                <div className="flex items-center pt-1">
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  <span className="text-xs text-green-600">{card.trend}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Frequently used LMS management operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {quickActions.map((action) => {
                  const IconComponent = action.icon;
                  return (
                    <Button
                      key={action.title}
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-start gap-2 hover:shadow-md transition-all"
                      onClick={action.action}
                    >
                      <div className={`p-2 rounded-lg ${action.color}`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium">{action.title}</div>
                        <div className="text-xs text-muted-foreground">{action.description}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Learning Analytics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Learning Analytics
              </CardTitle>
              <CardDescription>Key performance indicators for learning programs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Module Completion Rate</span>
                    <span>{metrics?.completionRate || 0}%</span>
                  </div>
                  <Progress value={metrics?.completionRate || 0} />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Quiz Pass Rate</span>
                    <span>{metrics?.averageQuizScore || 0}%</span>
                  </div>
                  <Progress value={metrics?.averageQuizScore || 0} />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Document Approval Rate</span>
                    <span>{metrics?.documentApprovalRate || 0}%</span>
                  </div>
                  <Progress value={metrics?.documentApprovalRate || 0} />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>User Engagement</span>
                    <span>{(metrics?.totalUsers || 0) > 0 ? Math.round(((metrics?.usersWithProgress || 0) / (metrics?.totalUsers || 1)) * 100) : 0}%</span>
                  </div>
                  <Progress value={(metrics?.totalUsers || 0) > 0 ? Math.round(((metrics?.usersWithProgress || 0) / (metrics?.totalUsers || 1)) * 100) : 0} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Content */}
        <div className="space-y-6">
          {/* Candidates Needing Attention */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Needs Attention
              </CardTitle>
              <CardDescription>Candidates requiring review or follow-up</CardDescription>
            </CardHeader>
            <CardContent>
              {candidatesLoading ? (
                <LoadingSpinner size="sm" />
              ) : candidatesNeedingAttention && candidatesNeedingAttention.length > 0 ? (
                <div className="space-y-3">
                  {candidatesNeedingAttention.map((candidate: any) => {
                    const documents = candidate.documents || [];
                    const pendingDocs = documents.filter((d: any) => d.status === 'uploaded' || d.status === 'under_review');
                    
                    return (
                      <div key={candidate.id} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {candidate.full_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{candidate.full_name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {pendingDocs.length > 0 && (
                            <div className="flex items-center gap-1 mb-1">
                              <FileText className="h-3 w-3" />
                              {pendingDocs.length} document{pendingDocs.length > 1 ? 's' : ''} pending review
                            </div>
                          )}
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full mt-2"
                          onClick={() => navigate(`/lms/candidates?candidate=${candidate.id}`)}
                        >
                          Review
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No candidates need immediate attention
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest learning activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-2 border rounded">
                  <div className="p-1 rounded-full bg-green-100">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">Module completed</p>
                    <p className="text-muted-foreground">React Fundamentals by Alice Johnson</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 border rounded">
                  <div className="p-1 rounded-full bg-blue-100">
                    <FileText className="h-3 w-3 text-blue-600" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">Document uploaded</p>
                    <p className="text-muted-foreground">ID Proof by Bob Smith</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 border rounded">
                  <div className="p-1 rounded-full bg-purple-100">
                    <Award className="h-3 w-3 text-purple-600" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">Quiz passed</p>
                    <p className="text-muted-foreground">Security Awareness by Carol Davis</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* This Week's Stats */}
          <Card>
            <CardHeader>
              <CardTitle>This Week</CardTitle>
              <CardDescription>Learning activity summary</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Modules Completed</span>
                  <Badge variant="outline">12</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Quizzes Taken</span>
                  <Badge variant="outline">8</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Documents Reviewed</span>
                  <Badge variant="outline">15</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">New Enrollments</span>
                  <Badge variant="outline">3</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}