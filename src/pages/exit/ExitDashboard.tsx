import { useAuth } from '@/contexts/AuthContext';
import { useExitProcess } from '@/hooks/useExit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  LogOut,
  Calendar,
  Clock,
  CheckCircle,
  FileText,
  ClipboardCheck,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  User,
  Award
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useNavigate } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { formatDateForDisplay, getCurrentISTDate, parseToISTDate } from '@/utils/dateUtils';

export function ExitDashboard() {
  const { user } = useAuth();
  const { data: exitProcess, isLoading: exitProcessLoading } = useExitProcess();
  const navigate = useNavigate();

  // Check if user is HR
  const isHR = user?.role?.name === 'hr' || user?.role_id === 'hr' || 
              ['super_admin', 'admin'].includes(user?.role?.name || user?.role_id || '');

  const daysRemaining = exitProcess ? 
    Math.max(0, differenceInDays(parseToISTDate(exitProcess.last_working_day), getCurrentISTDate())) : 0;

  const dashboardCards = [
    {
      title: 'Days Remaining',
      value: daysRemaining,
      description: 'Until last working day',
      icon: Calendar,
      color: 'bg-gray-500',
      trend: `${exitProcess?.notice_period_days || 0} day notice period`,
    },
    {
      title: 'Exit Status',
      value: exitProcess?.status?.replace('_', ' ') || 'Not Started',
      description: 'Current exit process status',
      icon: LogOut,
      color: 'bg-gray-500',
      trend: 'Process tracking',
    },
    {
      title: 'Clearance Progress',
      value: '0%', // Will be calculated from clearance items
      description: 'Checklist completion',
      icon: ClipboardCheck,
      color: 'bg-gray-500',
      trend: 'Items completed',
    },
    {
      title: 'Documents Ready',
      value: '0/5', // Will be calculated from documents
      description: 'Exit documents prepared',
      icon: FileText,
      color: 'bg-gray-500',
      trend: 'Ready for download',
    },
  ];

  const quickActions = [
    {
      title: 'View Documents',
      description: 'Download exit documents',
      icon: FileText,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/exit/documents'),
    },
    {
      title: 'Clearance Checklist',
      description: 'Complete exit tasks',
      icon: ClipboardCheck,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/exit/clearance'),
    },
    {
      title: 'Exit Interview',
      description: 'Schedule or complete interview',
      icon: MessageSquare,
      color: 'bg-gray-100 text-gray-600',
      action: () => navigate('/exit/interview'),
    },
  ];

  if (exitProcessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!exitProcess) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exit Dashboard</h1>
          <p className="text-muted-foreground">
            Exit process management and transition support
          </p>
        </div>

        <Card>
          <CardContent className="text-center py-12">
            <LogOut className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Exit Process</h3>
            <p className="text-muted-foreground">
              {isHR 
                ? 'No employees are currently in the exit process.'
                : 'You do not have an active exit process. This dashboard will be available when you submit a resignation.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Exit Dashboard</h1>
        <p className="text-muted-foreground">
          {isHR 
            ? `Managing exit process for ${exitProcess.user?.full_name || 'employee'}`
            : 'Your exit process and transition support'}
        </p>
      </div>

      {/* Exit Process Overview */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={exitProcess.user?.avatar_url} />
              <AvatarFallback className="text-lg">
                {exitProcess.user?.full_name?.charAt(0) || user?.full_name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-xl font-semibold">
                {isHR ? exitProcess.user?.full_name : user?.full_name}
              </h3>
              <p className="text-muted-foreground">
                {exitProcess.user?.position || user?.position} • {exitProcess.user?.department?.name || 'Department'}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <Badge variant="outline" className="text-orange-700 border-orange-300">
                  {exitProcess.exit_type.replace('_', ' ')}
                </Badge>
                <Badge className="bg-orange-100 text-orange-800">
                  {exitProcess.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-orange-600">{daysRemaining}</div>
              <div className="text-sm text-muted-foreground">days remaining</div>
              <div className="text-xs text-muted-foreground mt-1">
                Last day: {formatDateForDisplay(exitProcess.last_working_day, 'MMM dd, yyyy')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <CardTitle>Exit Process Actions</CardTitle>
              <CardDescription>
                Complete your exit process tasks and requirements
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

          {/* Exit Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Exit Timeline
              </CardTitle>
              <CardDescription>Important dates and milestones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 border rounded-lg bg-gray-50">
                  <div className="p-2 rounded-full bg-blue-100">
                    <Calendar className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Resignation Submitted</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateForDisplay(exitProcess.resignation_date, 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>

                <div className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="p-2 rounded-full bg-yellow-100">
                    <ClipboardCheck className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Complete Clearance</p>
                    <p className="text-sm text-muted-foreground">
                      Return assets and complete handover
                    </p>
                  </div>
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>

                <div className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="p-2 rounded-full bg-purple-100">
                    <MessageSquare className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Exit Interview</p>
                    <p className="text-sm text-muted-foreground">
                      Share feedback and experiences
                    </p>
                  </div>
                  <Clock className="h-5 w-5 text-gray-400" />
                </div>

                <div className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="p-2 rounded-full bg-green-100">
                    <Award className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Last Working Day</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateForDisplay(exitProcess.last_working_day, 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="text-sm font-medium text-orange-600">
                    {daysRemaining} days
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Content */}
        <div className="space-y-6">
          {/* Exit Process Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Exit Details
              </CardTitle>
              <CardDescription>Process information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Exit Type:</span>
                  <span className="font-medium capitalize">{exitProcess.exit_type.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Notice Period:</span>
                  <span className="font-medium">{exitProcess.notice_period_days} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resignation Date:</span>
                  <span className="font-medium">{formatDateForDisplay(exitProcess.resignation_date, 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Working Day:</span>
                  <span className="font-medium">{formatDateForDisplay(exitProcess.last_working_day, 'MMM dd, yyyy')}</span>
                </div>
                {exitProcess.new_company && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New Company:</span>
                    <span className="font-medium">{exitProcess.new_company}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
              <CardDescription>Immediate actions required</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg">
                  <ClipboardCheck className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm">Complete clearance checklist</span>
                </div>
                
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Download exit documents</span>
                </div>
                
                <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                  <MessageSquare className="h-4 w-4 text-purple-600" />
                  <span className="text-sm">Schedule exit interview</span>
                </div>
                
                {daysRemaining <= 7 && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-sm">Final week - complete all tasks</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Support Information */}
          <Card>
            <CardHeader>
              <CardTitle>Support & Contacts</CardTitle>
              <CardDescription>Get help during your transition</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">HR Department</p>
                  <p className="text-muted-foreground">hr@company.com</p>
                  <p className="text-muted-foreground">+1 (555) 123-4567</p>
                </div>
                <div>
                  <p className="font-medium">IT Support</p>
                  <p className="text-muted-foreground">it@company.com</p>
                  <p className="text-muted-foreground">For asset returns</p>
                </div>
                <div>
                  <p className="font-medium">Finance Team</p>
                  <p className="text-muted-foreground">finance@company.com</p>
                  <p className="text-muted-foreground">Final settlement queries</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}