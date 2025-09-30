import React, { useState, lazy, Suspense, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats, useUpcomingHolidays, useTodayTimeEntries } from '@/hooks/useDashboard';
import { secondTimeApi } from '@/services/secondTimeApi';
import type { UserTimeData } from '@/services/secondTimeApi';
import { timeTrackingApi } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
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
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import {supabase} from '@/services/supabase'
import { getTodayIST } from '@/utils/dateUtils';

export function DashboardOverview() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: holidays, isLoading: holidaysLoading } = useUpcomingHolidays();
  const { data: timeEntries, refetch: refetchTimeEntries } = useTodayTimeEntries();
  
  // State for second time data
  const [secondTimeData, setSecondTimeData] = useState<UserTimeData | null>(null);
  const [secondTimeLoading, setSecondTimeLoading] = useState(false);
  const [secondTimeError, setSecondTimeError] = useState<string | null>(null);
  
  const [assignedProjects, setAssignedProjects] = useState<Array<{ id: string; project_name: string }>>([]);
  const [assignedProjectsLoading, setAssignedProjectsLoading] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projectDescription, setProjectDescription] = useState('');
  const [hoursByProject, setHoursByProject] = useState<Record<string, number>>({});
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [projectsMenuOpen, setProjectsMenuOpen] = useState(false);

  // Format time from hours to HH:MM:SS
  const formatTimeFromHours = (hours: number): string => {
    const totalSeconds = Math.floor(hours * 3600);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate today's time directly from entries (without relying on stored hours_worked)
  const calculateTodayTime = () => {
    if (!secondTimeData?.todayEntries) return 0;
    
    // Since we're now only getting the latest entry within 8 hours, 
    // we can directly use the totalHoursToday from the API
    return secondTimeData.totalHoursToday || 0;
  };

  const todayTime = calculateTodayTime();
  const todayTimeFormatted = formatTimeFromHours(todayTime);

  // Fetch second time data when user email changes
  useEffect(() => {
    if (user?.email) {
      setSecondTimeLoading(true);
      setSecondTimeError(null);
      
      // First debug the database
      secondTimeApi.debugDatabase()
        .then(() => {
          // Now get user data
          return secondTimeApi.getUserTimeData(user.email);
        })
        .then(data => {
          setSecondTimeData(data);
        })
        .catch(err => {
          setSecondTimeError(err.message || 'Failed to fetch time data');
          console.error('Error fetching time data:', err);
        })
        .finally(() => {
          setSecondTimeLoading(false);
        });
    }
  }, [user?.email]);

  // Fetch assigned projects for the current user
  useEffect(() => {
    const fetchAssignedProjects = async () => {
      if (!user?.id) return;
      setAssignedProjectsLoading(true);
      try {
        const { data: assignments, error: assignmentError } = await supabase
          .from('project_assignments')
          .select('project_id')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (assignmentError) throw assignmentError;

        const projectIds = (assignments || []).map((a: any) => a.project_id).filter(Boolean);
        if (projectIds.length === 0) {
          setAssignedProjects([]);
          return;
        }

        const { data: projects, error: projectsError } = await supabase
          .from('new_projects')
          .select('id, project_name')
          .in('id', projectIds);

        if (projectsError) throw projectsError;
        setAssignedProjects((projects || []) as Array<{ id: string; name: string }>);
      } catch (err) {
        console.error('Failed to fetch assigned projects:', err);
        setAssignedProjects([]);
      } finally {
        setAssignedProjectsLoading(false);
      }
    };

    fetchAssignedProjects();
  }, [user?.id]);

  // Keep hours map in sync with selected projects
  useEffect(() => {
    setHoursByProject((prev: Record<string, number>) => {
      const next: Record<string, number> = {};
      selectedProjectIds.forEach((id: string) => {
        next[id] = prev[id] ?? 0;
      });
      return next;
    });
  }, [selectedProjectIds]);

  const statsCards = [
    {
      title: 'Leave Balance',
      value: `${stats?.leaveBalance || 0} days`,
      description: 'Annual leave remaining',
      icon: Calendar,
      color: 'bg-gray-500',
    },
    {
      title: 'Today\'s Hours',
      value: `${todayTime.toFixed(1)}h`,
      description: 'Total work time today',
      icon: Clock,
      color: 'bg-gray-500',
    },
    {
      title: 'Today\'s Sessions',
      value: `${secondTimeData?.todayEntries.length || 0}`,
      description: 'Time entries today',
      icon: Target,
      color: 'bg-gray-500',
    },
    {
      title: 'Daily Target',
      value: `${todayTime ? Math.round((todayTime / 8) * 100) : 0}%`,
      description: '8h daily goal',
      icon: Users,
      color: 'bg-gray-500',
    },
  ];

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (assignedProjects.length === 0) {
      toast.error('You have no assigned projects. Cannot submit.');
      return;
    }
    if (selectedProjectIds.length === 0) {
      toast.error('Please select at least one project');
      return;
    }
    if (!projectDescription.trim()) {
      toast.error('Please enter a description');
      return;
    }
    const entriesWithHours = selectedProjectIds
      .map((id: string) => ({ id, hours: Number(hoursByProject[id] ?? 0) }))
      .filter((x: { id: string; hours: number }) => x.hours > 0);
    if (entriesWithHours.length === 0) {
      toast.error('Please enter hours for at least one selected project');
      return;
    }

    setIsSubmittingProject(true);
    try {
      await Promise.all(
        entriesWithHours.map(({ id: projectId, hours }: { id: string; hours: number }) =>
          timeTrackingApi.createTimeEntry({
            user_id: user.id,
            project_id: projectId,
            entry_date: getTodayIST(),
            hours_worked: hours,
            description: projectDescription,
            task_type: 'development',
            is_billable: true,
            status: 'submitted'
          })
        )
      );

      setSelectedProjectIds([]);
      setProjectDescription('');
      setHoursByProject({});
      refetchTimeEntries();
      toast.success('Project entry logged successfully!');
    } catch (error) {
      toast.error('Failed to log project entry');
      console.error('Project entry error:', error);
    } finally {
      setIsSubmittingProject(false);
    }
  };



  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome {user?.full_name?.split(' ')[0]}!
          </h1>
          <p className="text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM do, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <Badge variant="outline" className="px-3 mb-2">
              {(user?.role?.name || user?.role_id)?.replace('_', ' ').toUpperCase()}
            </Badge>
            <p className="text-xs font-semibold px-1 py-1 rounded-md border border-orange-200/50 bg-white/70 text-orange-700 shadow-lg shadow-orange-200/30">{user?.email}</p>
          </div>
          <Avatar className="h-12 w-12">
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback>{user?.full_name?.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <LoadingSpinner size="sm" />
              </CardContent>
            </Card>
          ))
        ) : (
          statsCards.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <Card key={stat.title} className="relative overflow-hidden hover:shadow-2xl hover:shadow-orange-200/20 transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`p-2.5 rounded-xl ${stat.color} shadow-lg`}>
                  <IconComponent className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          );
          })
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Project Entry & Time Tracker */}
        <div className="lg:col-span-2 space-y-6">
          {/* Time Tracker */}
          <Card className="hover:shadow-2xl hover:shadow-orange-200/20 transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5" />
                Time Tracker
              </CardTitle>
              <CardDescription>Real-time data from external system</CardDescription>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="text-xs"
              >
                Refresh Data
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-center">
                  {secondTimeLoading ? (
                    <div className="text-3xl font-mono font-bold">
                      <LoadingSpinner size="sm" />
                    </div>
                  ) : secondTimeError ? (
                    <div className="text-3xl font-mono font-bold text-red-500">
                      Error
                    </div>
                  ) : (
                    <div className="text-3xl font-mono font-bold">{todayTimeFormatted}</div>
                  )}
                  <p className="text-sm text-muted-foreground">Today's work time</p>
                  {secondTimeData && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {secondTimeData.todayEntries.length} entries today
                    </p>
                  )}
                  {/* Start Time Display */}
                  {secondTimeData?.todayEntries && secondTimeData.todayEntries.length > 0 && (
                    <div className="mt-2 p-2 bg-blue-50/50 rounded-lg border border-blue-200/30">
                      <p className="text-xs font-medium text-blue-700 mb-1">Tracker Started</p>
                      <p className="text-sm font-mono text-blue-800">
                        {new Date(secondTimeData.todayEntries[0].start_time).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </p>
                      <p className="text-xs text-blue-600">
                        {new Date(secondTimeData.todayEntries[0].start_time).toLocaleDateString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 text-right">
                  <div className="text-sm">
                    <p className="font-medium">Weekly: {secondTimeData?.totalHoursThisWeek.toFixed(1) || '0.0'}h</p>
                    <p className="text-muted-foreground">Monthly: {secondTimeData?.totalHoursThisMonth.toFixed(1) || '0.0'}h</p>
                  </div>
                  <Badge variant="outline" className="border-green-200/50 bg-green-50/50">
                    Read Only
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Project Entry */}
          <Card className="hover:shadow-2xl hover:shadow-orange-200/20 transition-all duration-300">
            <CardHeader>
              <CardTitle>Quick Project Entry</CardTitle>
              <CardDescription>Log your daily project work for billing</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProjectSubmit} className="space-y-4">
                <div>
                  <Label>Today's Projects</Label>
                  <Popover open={projectsMenuOpen} onOpenChange={setProjectsMenuOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={projectsMenuOpen} className="mt-1 w-full justify-between min-h-[2.5rem]">
                        <div className="flex flex-wrap gap-1 flex-1 mr-2">
                          {selectedProjectIds.length > 0 ? (
                            selectedProjectIds.map((id) => {
                              const project = assignedProjects.find((p) => p.id === id);
                              return project ? (
                                <Badge key={id} variant="secondary" className="text-xs px-2 py-1">
                                  {project.project_name}
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedProjectIds((prev) => prev.filter((pid) => pid !== id));
                                    }}
                                    className="ml-1 hover:bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center cursor-pointer"
                                  >
                                    ×
                                  </span>
                                </Badge>
                              ) : null;
                            })
                          ) : assignedProjectsLoading ? (
                            <span className="text-muted-foreground">Loading projects...</span>
                          ) : assignedProjects.length === 0 ? (
                            <span className="text-muted-foreground">No assigned projects</span>
                          ) : (
                            <span className="text-muted-foreground">Select projects</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
                      <Command>
                        <CommandInput placeholder="Search projects..." />
                        <CommandEmpty>No projects found.</CommandEmpty>
                        <CommandGroup>
                          {assignedProjects.map((p: { id: string; project_name: string }) => {
                            const checked = selectedProjectIds.includes(p.id);
                            return (
                              <CommandItem
                                key={p.id}
                                value={p.project_name}
                                onSelect={() => {
                                  setSelectedProjectIds((prev) =>
                                    checked ? prev.filter((id) => prev !== p.id) : [...prev, p.id]
                                  );
                                }}
                                className="flex items-center gap-2"
                              >
                                <Checkbox checked={checked} aria-label={p.project_name} />
                                <span className="truncate">{p.project_name}</span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                {selectedProjectIds.length > 0 && (
                  <div className="space-y-2">
                    <Label>Hours per selected project</Label>
                    <div className="space-y-2">
                      {selectedProjectIds.map((id) => {
                        const project = assignedProjects.find((p) => p.id === id);
                        const name = project?.project_name || id;
                        return (
                          <div key={id} className="flex items-center gap-2">
                            <span className="text-sm w-48 truncate" title={name}>{name}</span>
                            <Input
                              type="number"
                              min={0}
                              step={0.25}
                              value={Number.isFinite(hoursByProject[id]) ? hoursByProject[id] : ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setHoursByProject((prev) => ({
                                  ...prev,
                                  [id]: Number(e.target.value)
                                }))
                              }
                              className="w-28"
                              placeholder="Hours"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <Label htmlFor="description">What did you do today?</Label>
                  <Textarea
                    id="description"
                    value={projectDescription}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setProjectDescription(e.target.value)}
                    placeholder="E.g., Implemented feature X, fixed bug Y, meetings, etc."
                    className="mt-2"
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full shadow-lg" disabled={selectedProjectIds.length === 0 || !projectDescription.trim() || isSubmittingProject}
                >
                  {isSubmittingProject ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Logging...
                    </>
                  ) : (
                    <>
                  <Plus className="h-4 w-4 mr-2" />
                  Log Project
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Today's Time Entries from Second Database */}
          <Card className="hover:shadow-2xl hover:shadow-orange-200/20 transition-all duration-300">
            <CardHeader>
              <CardTitle>Today's Time Entries</CardTitle>
              <CardDescription>Real time data from external system</CardDescription>
            </CardHeader>
            <CardContent>
              {secondTimeLoading ? (
                <div className="flex justify-center py-4">
                  <LoadingSpinner size="sm" />
                </div>
              ) : secondTimeError ? (
                <div className="text-center py-4">
                  <p className="text-sm text-red-500 mb-2">Failed to load time data</p>
                  <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                    Retry
                  </Button>
                </div>
              ) : secondTimeData?.error ? (
                <div className="text-center py-4">
                  <p className="text-sm text-amber-600 mb-2">{secondTimeData.error}</p>
                  <p className="text-xs text-muted-foreground">This user may not have time tracking data yet</p>
                </div>
              ) : secondTimeData?.todayEntries && secondTimeData.todayEntries.length > 0 ? (
                <div className="space-y-3">
                  {secondTimeData.todayEntries.map((entry: any) => {
                    const startTime = new Date(entry.start_time);
                    const now = new Date();
                    
                    // Get comprehensive duration information using database duration
                    const duration = secondTimeApi.getDurationInfo(entry);
                    
                    // Calculate end time from start_time + duration
                    const endTime = new Date(startTime.getTime() + (duration.seconds * 1000));
                    
                    return (
                      <div key={entry.id} className={`flex items-center justify-between p-4 border rounded-xl backdrop-blur-sm hover:shadow-md transition-all ${
                        duration.isOngoing 
                          ? 'border-orange-300 bg-orange-50/30' 
                          : 'border-blue-200/30 bg-white/50'
                      }`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`text-lg font-mono font-bold ${
                              duration.isOngoing ? 'text-orange-600' : 'text-blue-600'
                            }`}>
                              {duration.formatted}
                            </div>
                            <Badge variant="outline" className={
                              duration.isOngoing 
                                ? 'border-orange-200/50 bg-orange-50/50 text-orange-700'
                                : 'border-blue-200/50 bg-blue-50/50'
                            }>
                              {duration.isOngoing ? 'Ongoing' : 
                                duration.hours >= 8 ? 'Full Day' : 
                                duration.hours >= 4 ? 'Half Day' : 'Partial'
                              }
                            </Badge>
                          </div>
                          <p className="text-sm font-medium text-gray-800">
                            {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {
                              duration.isOngoing 
                                ? 'Now (ongoing)' 
                                : endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Entry ID: {entry.id.slice(0, 8)} • {startTime.toLocaleDateString()}
                            {duration.isOngoing && <span className="text-orange-600 font-medium"> • Live Session</span>}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-mono font-bold ${
                            duration.isOngoing ? 'text-orange-600' : 'text-green-600'
                          }`}>
                            {duration.hours.toFixed(1)}h
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {duration.isOngoing ? 'Live' : 'Total'} • {duration.seconds}s
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Started: {startTime.toLocaleDateString([], { 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-2">No time entries for today</p>
                  <p className="text-xs text-muted-foreground">Data is fetched from external time tracking system</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Content */}
        <div className="space-y-6">
          {/* Upcoming Holidays */}
          <Card className="hover:shadow-2xl hover:shadow-orange-200/20 transition-all duration-300">
            <CardHeader>
              <CardTitle>Upcoming Holidays</CardTitle>
              <CardDescription>Public holidays this year</CardDescription>
            </CardHeader>
            <CardContent>
              {holidaysLoading ? (
                <LoadingSpinner size="sm" />
              ) : holidays && holidays.length > 0 ? (
                <div className="space-y-3">
                  {holidays.map((holiday: any) => (
                    <div key={holiday.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-orange-50/50 transition-colors">
                      <div>
                        <p className="text-sm font-medium">{holiday.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {holiday.is_optional ? 'Optional' : 'Public Holiday'}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-orange-200/50">
                        {format(new Date(holiday.date), 'MMM dd')}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming holidays
                </p>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          {/* <Card className="hover:shadow-2xl hover:shadow-orange-200/20 transition-all duration-300">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Frequently used features</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="h-auto p-3 flex flex-col gap-1 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs">Apply Leave</span>
                </Button>
                <Button variant="outline" size="sm" className="h-auto p-3 flex flex-col gap-1 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-xs">Report Issue</span>
                </Button>
                <Button variant="outline" size="sm" className="h-auto p-3 flex flex-col gap-1 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                  <FileText className="h-4 w-4" />
                  <span className="text-xs">Documents</span>
                </Button>
                <Button variant="outline" size="sm" className="h-auto p-3 flex flex-col gap-1 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                  <UserPlus className="h-4 w-4" />
                  <span className="text-xs">Refer Friend</span>
                </Button>
              </div>
            </CardContent>
          </Card> */}

          {/* Today's Performance Overview */}
          <Card className="hover:shadow-2xl hover:shadow-orange-200/20 transition-all duration-300">
            <CardHeader>
              <CardTitle>Today's Performance</CardTitle>
              <CardDescription>Your time tracking for today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Daily Target (8h)</span>
                    <span>{todayTime ? Math.round((todayTime / 8) * 100) : 0}%</span>
                  </div>
                  <Progress value={todayTime ? Math.min((todayTime / 8) * 100, 100) : 0} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {todayTime.toFixed(1)}h / 8h target
                  </p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Time Entries</span>
                    <span>{secondTimeData?.todayEntries.length || 0}</span>
                  </div>
                  <Progress value={secondTimeData?.todayEntries.length ? Math.min((secondTimeData.todayEntries.length / 3) * 100, 100) : 0} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {secondTimeData?.todayEntries.length || 0} entries today
                  </p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Average Session</span>
                    <span>{secondTimeData?.todayEntries.length ? (todayTime / secondTimeData.todayEntries.length).toFixed(1) : '0.0'}h</span>
                  </div>
                  <Progress value={secondTimeData?.todayEntries.length ? Math.min(((todayTime / secondTimeData.todayEntries.length) / 4) * 100, 100) : 0} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Per time entry
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
