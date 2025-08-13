import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Calendar,
  Clock,
  Target,
  Users,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Plus,
  Timer,
  Play,
  Pause,
  Square,
  MessageSquare,
  FileText,
  UserPlus
} from 'lucide-react';
import { format } from 'date-fns';

export function DashboardOverview() {
  const { user } = useAuth();
  const [projectEntry, setProjectEntry] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [trackingTime, setTrackingTime] = useState('02:35:42');

  const stats = [
    {
      title: 'Leave Balance',
      value: '12 days',
      description: 'Annual leave remaining',
      icon: Calendar,
      color: 'bg-blue-500',
      trend: '+2 from last month',
    },
    {
      title: 'Days Present',
      value: '22/23',
      description: 'This month',
      icon: Clock,
      color: 'bg-green-500',
      trend: '95.7% attendance',
    },
    {
      title: 'Active Goals',
      value: '3',
      description: 'Performance goals',
      icon: Target,
      color: 'bg-purple-500',
      trend: '2 completed this quarter',
    },
    {
      title: 'Team Projects',
      value: '5',
      description: 'Active assignments',
      icon: Users,
      color: 'bg-orange-500',
      trend: '1 due this week',
    },
  ];

  const upcomingHolidays = [
    { name: 'Independence Day', date: '2025-08-15', type: 'National' },
    { name: 'Gandhi Jayanti', date: '2025-10-02', type: 'National' },
    { name: 'Diwali', date: '2025-11-01', type: 'Festival' },
    { name: 'Christmas', date: '2025-12-25', type: 'National' },
  ];

  const recentActivities = [
    {
      id: 1,
      type: 'leave',
      title: 'Leave application approved',
      description: 'Annual leave for Dec 20-22',
      time: '2 hours ago',
      status: 'approved',
    },
    {
      id: 2,
      type: 'goal',
      title: 'Goal milestone completed',
      description: 'Q4 Performance Review preparation',
      time: '1 day ago',
      status: 'completed',
    },
    {
      id: 3,
      type: 'project',
      title: 'Project assignment updated',
      description: 'Added to Mobile App Development team',
      time: '3 days ago',
      status: 'info',
    },
  ];

  const handleProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (projectEntry.trim()) {
      // Here you would typically save to database
      console.log('Project logged:', projectEntry);
      setProjectEntry('');
      // Show success toast
    }
  };

  const toggleTimeTracking = () => {
    setIsTracking(!isTracking);
    // Here you would start/stop the actual timer
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {user?.full_name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM do, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="px-3 py-1">
            {user?.role_id?.replace('_', ' ').toUpperCase()}
          </Badge>
          <Avatar className="h-12 w-12">
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback>{user?.full_name?.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <Card key={stat.title} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <IconComponent className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
                <div className="flex items-center pt-1">
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  <span className="text-xs text-green-600">{stat.trend}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Project Entry & Time Tracker */}
        <div className="lg:col-span-2 space-y-6">
          {/* Time Tracker */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5" />
                Time Tracker
              </CardTitle>
              <CardDescription>Track your daily work hours</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <div className="text-3xl font-mono font-bold">{trackingTime}</div>
                  <p className="text-sm text-muted-foreground">Today's work time</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={toggleTimeTracking}
                    variant={isTracking ? "destructive" : "default"}
                    size="sm"
                  >
                    {isTracking ? (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Start
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm">
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Project Entry */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Project Entry</CardTitle>
              <CardDescription>Log your daily project work for billing</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProjectSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="project">Today's Project</Label>
                  <Input
                    id="project"
                    value={projectEntry}
                    onChange={(e) => setProjectEntry(e.target.value)}
                    placeholder="Enter project name or description..."
                    className="mt-1"
                  />
                </div>
                <Button type="submit" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Log Project
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Activities */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Your latest updates and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className={`p-1 rounded-full ${
                      activity.status === 'approved' ? 'bg-green-100' :
                      activity.status === 'completed' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {activity.status === 'approved' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : activity.status === 'completed' ? (
                        <Target className="h-4 w-4 text-blue-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">{activity.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Content */}
        <div className="space-y-6">
          {/* Upcoming Holidays */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Holidays</CardTitle>
              <CardDescription>Public holidays this year</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingHolidays.map((holiday) => (
                  <div key={holiday.name} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{holiday.name}</p>
                      <p className="text-xs text-muted-foreground">{holiday.type}</p>
                    </div>
                    <Badge variant="outline">{format(new Date(holiday.date), 'MMM dd')}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Frequently used features</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="h-auto p-3 flex flex-col gap-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs">Apply Leave</span>
                </Button>
                <Button variant="outline" size="sm" className="h-auto p-3 flex flex-col gap-1">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-xs">Report Issue</span>
                </Button>
                <Button variant="outline" size="sm" className="h-auto p-3 flex flex-col gap-1">
                  <FileText className="h-4 w-4" />
                  <span className="text-xs">Documents</span>
                </Button>
                <Button variant="outline" size="sm" className="h-auto p-3 flex flex-col gap-1">
                  <UserPlus className="h-4 w-4" />
                  <span className="text-xs">Refer Friend</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Performance Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Overview</CardTitle>
              <CardDescription>Your current quarter progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Goals Completed</span>
                    <span>75%</span>
                  </div>
                  <Progress value={75} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Attendance</span>
                    <span>96%</span>
                  </div>
                  <Progress value={96} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Project Delivery</span>
                    <span>88%</span>
                  </div>
                  <Progress value={88} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}