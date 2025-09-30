import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useATSDashboardStats, useMyInterviews, useMyAssessments } from '@/hooks/useATS';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users,
  Calendar,
  Clock,
  CheckCircle,
  TrendingUp,
  UserCheck,
  Code,
  Award,
  AlertCircle,
  Eye,
  Play,
  FileText,
  Target
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isTomorrow, isPast } from 'date-fns';

export function ATSDashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useATSDashboardStats();
  const { data: myInterviews, isLoading: interviewsLoading } = useMyInterviews();
  const { data: myAssessments, isLoading: assessmentsLoading } = useMyAssessments();
  const navigate = useNavigate();

  // Check if user is HR or candidate
  const isHR = user?.role?.name === 'hr' || user?.role_id === 'hr' || 
              ['super_admin', 'admin'].includes(user?.role?.name || user?.role_id || '');
  
  const isCandidate = user?.role?.name === 'candidate' || user?.role_id === 'candidate';

  const dashboardCards = isHR ? [
    {
      title: 'Total Candidates',
      value: stats?.totalCandidates || 0,
      description: 'All applications',
      icon: Users,
      color: 'bg-gray-500',
      trend: `+${stats?.appliedCandidates || 0} new this week`,
    },
    {
      title: 'Active Interviews',
      value: stats?.activeInterviews || 0,
      description: 'Scheduled interviews',
      icon: Calendar,
      color: 'bg-gray-500',
      trend: 'Next 7 days',
    },
    {
      title: 'Pending Assessments',
      value: stats?.pendingAssessments || 0,
      description: 'Awaiting completion',
      icon: Code,
      color: 'bg-gray-500',
      trend: 'Requires attention',
    },
    {
      title: 'Recent Hires',
      value: stats?.recentHires || 0,
      description: 'Last 30 days',
      icon: UserCheck,
      color: 'bg-gray-500',
      trend: 'Successful placements',
    },
  ] : [
    {
      title: 'My Applications',
      value: '1',
      description: 'Active application',
      icon: FileText,
      color: 'bg-gray-500',
      trend: 'In progress',
    },
    {
      title: 'Interviews',
      value: myInterviews?.length || 0,
      description: 'Total interviews',
      icon: Calendar,
      color: 'bg-gray-500',
      trend: myInterviews?.filter(i => i.status === 'scheduled').length + ' upcoming',
    },
    {
      title: 'Assessments',
      value: myAssessments?.length || 0,
      description: 'Coding assessments',
      icon: Code,
      color: 'bg-gray-500',
      trend: myAssessments?.filter(a => a.status === 'assigned').length + ' pending',
    },
    {
      title: 'Overall Score',
      value: myAssessments?.length > 0 ? 
        Math.round(myAssessments.reduce((sum, a) => sum + (a.score || 0), 0) / myAssessments.length) + '%' : 
        'N/A',
      description: 'Average assessment score',
      icon: Target,
      color: 'bg-gray-500',
      trend: 'Performance metric',
    },
  ];

  const quickActions = isHR ? [
    {
      title: 'Add Candidate',
      description: 'Register new candidate',
      icon: Users,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/ats/candidates?action=create'),
    },
    {
      title: 'Schedule Interview',
      description: 'Set up new interview',
      icon: Calendar,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/ats/candidates'),
    },
    {
      title: 'Create Assessment',
      description: 'Design coding test',
      icon: Code,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/ats/assessment'),
    },
  ] : [
    {
      title: 'View Profile',
      description: 'Check application status',
      icon: Users,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/ats/profile'),
    },
    {
      title: 'Take Assessment',
      description: 'Complete coding test',
      icon: Code,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/ats/assessment'),
    },
    {
      title: 'Interview Prep',
      description: 'Prepare for interviews',
      icon: Calendar,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/ats/interviews'),
    },
  ];

  const getInterviewStatus = (interview: any) => {
    const scheduledDate = new Date(interview.scheduled_at);
    
    if (interview.status === 'completed') return { text: 'Completed', color: 'bg-green-100 text-green-800' };
    if (interview.status === 'cancelled') return { text: 'Cancelled', color: 'bg-red-100 text-red-800' };
    if (isPast(scheduledDate)) return { text: 'Missed', color: 'bg-red-100 text-red-800' };
    if (isToday(scheduledDate)) return { text: 'Today', color: 'bg-blue-100 text-blue-800' };
    if (isTomorrow(scheduledDate)) return { text: 'Tomorrow', color: 'bg-yellow-100 text-yellow-800' };
    return { text: 'Scheduled', color: 'bg-gray-100 text-gray-800' };
  };

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
        <h1 className="text-3xl font-bold tracking-tight">
          {isHR ? 'ATS Dashboard' : 'My Application Portal'}
        </h1>
        <p className="text-muted-foreground">
          {isHR 
            ? 'Manage candidates, interviews, and assessments' 
            : 'Track your application progress and upcoming interviews'
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
                {isHR ? 'Frequently used ATS operations' : 'Available actions for your application'}
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

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {isHR ? 'Recent Activity' : 'My Interview Schedule'}
              </CardTitle>
              <CardDescription>
                {isHR ? 'Latest candidate and interview updates' : 'Upcoming and past interviews'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {interviewsLoading ? (
                <LoadingSpinner size="sm" />
              ) : myInterviews && myInterviews.length > 0 ? (
                <div className="space-y-3">
                  {myInterviews.slice(0, 5).map((interview: any) => {
                    const status = getInterviewStatus(interview);
                    return (
                      <div key={interview.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-blue-100">
                            <Calendar className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {isHR ? `Interview with ${interview.candidate?.full_name}` : interview.interview_type} Interview
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(interview.scheduled_at), 'MMM dd, yyyy HH:mm')} • {interview.duration_minutes}min
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={status.color}>
                            {status.text}
                          </Badge>
                          {interview.meeting_link && interview.status === 'scheduled' && (
                            <Button size="sm" variant="outline">
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  <div className="pt-2 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => navigate(isHR ? '/ats/interviews' : '/ats')}
                    >
                      View All Interviews
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {isHR ? 'No recent interview activity' : 'No interviews scheduled yet'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Content */}
        <div className="space-y-6">
          {isHR ? (
            <>
              {/* Candidate Pipeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Candidate Pipeline
                  </CardTitle>
                  <CardDescription>Current hiring funnel</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Applied</span>
                        <span>{stats?.appliedCandidates || 0}</span>
                      </div>
                      <Progress value={stats?.appliedCandidates ? (stats.appliedCandidates / stats.totalCandidates) * 100 : 0} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Screening</span>
                        <span>{stats?.screeningCandidates || 0}</span>
                      </div>
                      <Progress value={stats?.screeningCandidates ? (stats.screeningCandidates / stats.totalCandidates) * 100 : 0} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Interview Scheduled</span>
                        <span>{stats?.interviewScheduled || 0}</span>
                      </div>
                      <Progress value={stats?.interviewScheduled ? (stats.interviewScheduled / stats.totalCandidates) * 100 : 0} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Selected</span>
                        <span>{stats?.selectedCandidates || 0}</span>
                      </div>
                      <Progress value={stats?.selectedCandidates ? (stats.selectedCandidates / stats.totalCandidates) * 100 : 0} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* This Week's Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>This Week</CardTitle>
                  <CardDescription>Key performance indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">New Applications</span>
                      <Badge variant="outline">{stats?.appliedCandidates || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Interviews Conducted</span>
                      <Badge variant="outline">
                        {myInterviews?.filter(i => i.status === 'completed').length || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Assessments Graded</span>
                      <Badge variant="outline">
                        {myAssessments?.filter(a => a.status === 'graded').length || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Offers Extended</span>
                      <Badge variant="outline">{stats?.selectedCandidates || 0}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              {/* Application Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Application Status
                  </CardTitle>
                  <CardDescription>Your current application progress</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user?.avatar_url} />
                        <AvatarFallback>{user?.full_name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user?.full_name}</p>
                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Application Progress</span>
                        <span>75%</span>
                      </div>
                      <Progress value={75} />
                      <p className="text-xs text-muted-foreground">
                        Assessment completed, interview scheduled
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Upcoming Assessments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    Pending Assessments
                  </CardTitle>
                  <CardDescription>Coding tests to complete</CardDescription>
                </CardHeader>
                <CardContent>
                  {assessmentsLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : myAssessments?.filter(a => a.status === 'assigned').length > 0 ? (
                    <div className="space-y-3">
                      {myAssessments.filter(a => a.status === 'assigned').map((assessment: any) => (
                        <div key={assessment.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">{assessment.title}</p>
                            <Badge variant="outline">{assessment.time_limit_minutes}min</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            {assessment.description}
                          </p>
                          <Button size="sm" className="w-full">
                            <Play className="h-4 w-4 mr-2" />
                            Start Assessment
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No pending assessments
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}