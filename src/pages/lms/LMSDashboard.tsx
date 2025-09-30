import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLMSDashboardStats, useUserModules } from '@/hooks/useLMS';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  GraduationCap,
  BookOpen,
  Target,
  Award,
  Clock,
  CheckCircle,
  Play,
  FileText,
  TrendingUp,
  Calendar,
  Users,
  BarChart3,
  Upload
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export function LMSDashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useLMSDashboardStats();
  const { data: modules, isLoading: modulesLoading } = useUserModules();
  const navigate = useNavigate();

  // Check if user is HR/Manager or regular user/candidate
  const isManager = user?.role?.name === 'hr' || user?.role_id === 'hr' || 
                   ['super_admin', 'admin', 'sdm', 'bdm', 'qam'].includes(user?.role?.name || user?.role_id || '');

  const dashboardCards = [
    {
      title: 'Total Modules',
      value: stats?.totalModules || 0,
      description: 'Available learning modules',
      icon: BookOpen,
      color: 'bg-gray-500',
      trend: `${stats?.completedModules || 0} completed`,
    },
    {
      title: 'Overall Progress',
      value: `${stats?.overallProgress || 0}%`,
      description: 'Learning completion',
      icon: Target,
      color: 'bg-gray-500',
      trend: `${stats?.inProgressModules || 0} in progress`,
    },
    {
      title: 'Quiz Performance',
      value: `${stats?.averageScore || 0}%`,
      description: 'Average quiz score',
      icon: Award,
      color: 'bg-gray-500',
      trend: `${stats?.passedQuizzes || 0}/${stats?.totalQuizzes || 0} passed`,
    },
    {
      title: 'Documents',
      value: `${stats?.approvedDocuments || 0}/${stats?.totalDocuments || 0}`,
      description: 'Approved documents',
      icon: FileText,
      color: 'bg-gray-500',
      trend: 'Upload status',
    },
  ];

  const quickActions = [
    {
      title: 'Continue Learning',
      description: 'Resume your modules',
      icon: Play,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/lms/prerequisites'),
    },
    {
      title: 'Upload Documents',
      description: 'Submit required docs',
      icon: Upload,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/lms/documents'),
    },
    {
      title: 'View Progress',
      description: 'Check your progress',
      icon: BarChart3,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/lms/progress'),
    },
  ];

  // Get recent modules for quick access
  const recentModules = modules?.filter(m => 
    m.user_progress?.[0]?.status === 'in_progress' || 
    m.user_progress?.[0]?.last_accessed_at
  ).slice(0, 3);

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Learning Management System</h1>
        <p className="text-muted-foreground">
          {isManager 
            ? 'Monitor learning progress and manage training modules' 
            : 'Complete your learning modules and track your progress'
          }
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
              <CardDescription>
                {isManager ? 'Manage learning content and track progress' : 'Continue your learning journey'}
              </CardDescription>
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

          {/* Recent Learning Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {isManager ? 'Recent Activity' : 'Continue Learning'}
              </CardTitle>
              <CardDescription>
                {isManager ? 'Latest learning activities across the organization' : 'Pick up where you left off'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {modulesLoading ? (
                <LoadingSpinner size="sm" />
              ) : recentModules && recentModules.length > 0 ? (
                <div className="space-y-3">
                  {recentModules.map((module: any) => {
                    const progress = module.user_progress?.[0];
                    return (
                      <div key={module.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-blue-100">
                            <BookOpen className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{module.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {module.category} • {module.estimated_duration_hours}h
                              {progress?.last_accessed_at && (
                                <span> • Last accessed {format(new Date(progress.last_accessed_at), 'MMM dd')}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-sm font-medium">{progress?.progress_percentage || 0}%</div>
                            <Progress value={progress?.progress_percentage || 0} className="w-16 h-1" />
                          </div>
                          <Button size="sm" variant="outline">
                            <Play className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  
                  <div className="pt-2 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => navigate('/lms/prerequisites')}
                    >
                      View All Modules
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {isManager ? 'No recent learning activity' : 'No modules in progress yet'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isManager ? 'Activity will appear as users engage with content' : 'Start a module to begin your learning journey'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Content */}
        <div className="space-y-6">
          {/* Learning Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Learning Progress
              </CardTitle>
              <CardDescription>Your current learning status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user?.avatar_url} />
                    <AvatarFallback>{user?.full_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{user?.position || 'Learner'}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Module Completion</span>
                      <span>{stats?.completionRate || 0}%</span>
                    </div>
                    <Progress value={stats?.completionRate || 0} />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Quiz Performance</span>
                      <span>{stats?.averageScore || 0}%</span>
                    </div>
                    <Progress value={stats?.averageScore || 0} />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Document Approval</span>
                      <span>{stats?.totalDocuments > 0 ? Math.round((stats.approvedDocuments / stats.totalDocuments) * 100) : 0}%</span>
                    </div>
                    <Progress value={stats?.totalDocuments > 0 ? Math.round((stats.approvedDocuments / stats.totalDocuments) * 100) : 0} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Learning Stats */}
          <Card>
            <CardHeader>
              <CardTitle>This Week</CardTitle>
              <CardDescription>Your learning activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Modules Started</span>
                  <Badge variant="outline">{stats?.inProgressModules || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Modules Completed</span>
                  <Badge variant="outline">{stats?.completedModules || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Quizzes Passed</span>
                  <Badge variant="outline">{stats?.passedQuizzes || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Documents Uploaded</span>
                  <Badge variant="outline">{stats?.totalDocuments || 0}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
              <CardDescription>Recommended actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.inProgressModules > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                    <Play className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Continue {stats.inProgressModules} module{stats.inProgressModules > 1 ? 's' : ''}</span>
                  </div>
                )}
                
                {stats?.totalDocuments < 5 && (
                  <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                    <Upload className="h-4 w-4 text-orange-600" />
                    <span className="text-sm">Upload required documents</span>
                  </div>
                )}
                
                {stats?.completionRate >= 80 && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Almost done! Complete remaining modules</span>
                  </div>
                )}
                
                {stats?.averageScore < 70 && stats?.totalQuizzes > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                    <Target className="h-4 w-4 text-red-600" />
                    <span className="text-sm">Retake quizzes to improve scores</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}