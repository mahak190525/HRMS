import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  BarChart, 
  Bar,
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Target,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { parseISO, isWithinInterval } from 'date-fns';
import { toast } from 'sonner';

// Import KRA hooks and types
import { usePerformanceAnalytics, usePerformanceMetrics } from '@/hooks/usePerformanceAnalytics';
import { useFilteredEmployees } from '@/hooks/useEmployees';
// import { calculateKRAPercentage } from '@/utils/kraCalculations';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

interface PerformanceFilters {
  employeeId: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface KRAPercentageData {
  name: string;
  percentage: number;
  employee: string;
  template: string;
  kraSheet: string;
}


export function PerformanceOverview() {
  const { user } = useAuth();
  
  // State for filters
  const [filters, setFilters] = useState<PerformanceFilters>({
    employeeId: '',
    startDate: '',
    endDate: '',
    status: ''
  });

  // Use the new performance analytics hook for optimized data fetching
  const { 
    data: analyticsData, 
    isLoading: analyticsLoading 
  } = usePerformanceAnalytics(filters);

  // Use real-time metrics for summary stats
  const { 
    data: metrics, 
    isLoading: metricsLoading 
  } = usePerformanceMetrics({
    employeeId: filters.employeeId,
    startDate: filters.startDate,
    endDate: filters.endDate
  });


  // Fetch employees based on user permissions using the existing hook
  const { data: availableEmployees = [], isLoading: employeesLoading } = useFilteredEmployees();

  // Fetch KRA assignments WITH evaluations for proper chart display
  const { data: assignmentsWithEvaluations = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['kra-assignments-with-evaluations', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const roleName = user.role?.name || user.role_id || '';
      const isAdmin = user.isSA || roleName === 'admin' || roleName === 'super_admin';
      const isHR = roleName === 'hr' || roleName === 'hrm';

      let query = supabase
        .from('kra_assignments')
        .select(`
          *,
          template:kra_templates (
            id, template_name, evaluation_period_start, evaluation_period_end, description
          ),
          employee:users!kra_assignments_employee_id_fkey (
            id, full_name, email, employee_id
          ),
          assigned_by_user:users!kra_assignments_assigned_by_fkey (
            id, full_name, email
          ),
          evaluations:kra_evaluations (
            *,
            goal:kra_goals (
              id, goal_id, strategic_goal_title, weight, max_score
            )
          )
        `);

      // Apply role-based filtering
      if (!isAdmin && !isHR) {
        // Managers see only their team's assignments
        query = query.eq('assigned_by', user.id);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching assignments with evaluations:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!user
  });

  // Auto-select first employee if none selected and employees are available
  useEffect(() => {
    if (availableEmployees.length > 0 && !filters.employeeId) {
      setFilters(prev => ({ 
        ...prev, 
        employeeId: availableEmployees[0].id 
      }));
    }
  }, [availableEmployees, filters.employeeId]);

  // Get assignments - prefer analytics data, fallback to direct fetch with evaluations
  const assignments = useMemo(() => {
    if (analyticsData?.assignments && analyticsData.assignments.length > 0) {
      return analyticsData.assignments;
    }
    
    // Use our custom fetch that includes evaluations
    return assignmentsWithEvaluations;
  }, [analyticsData, assignmentsWithEvaluations]);

  // Filter assignments based on current filters
  const filteredAssignments = useMemo(() => {
    return assignments.filter(assignment => {
      // Employee filter
      if (filters.employeeId && assignment.employee_id !== filters.employeeId) {
        return false;
      }

      // Status filter
      if (filters.status && assignment.status !== filters.status) {
        return false;
      }

      // Date range filter
      if (filters.startDate || filters.endDate) {
        const assignmentDate = assignment.assigned_date;
        if (!assignmentDate) return false;

        const date = parseISO(assignmentDate);
        
        if (filters.startDate && filters.endDate) {
          const startDate = parseISO(filters.startDate);
          const endDate = parseISO(filters.endDate);
          
          if (!isWithinInterval(date, { start: startDate, end: endDate })) {
            return false;
          }
        } else if (filters.startDate) {
          const startDate = parseISO(filters.startDate);
          if (date < startDate) return false;
        } else if (filters.endDate) {
          const endDate = parseISO(filters.endDate);
          if (date > endDate) return false;
        }
      }

      return true;
    });
  }, [assignments, filters]);

  // Helper function to recalculate KRA percentage using correct logic
  const recalculateKRAPercentage = (assignment: any): number => {
    // Temporarily disabled - will re-enable after migration is applied
    return assignment.overall_percentage || 0;
    
    /* TODO: Re-enable after migration
    if (!assignment.evaluations || assignment.evaluations.length === 0) {
      return assignment.overall_percentage || 0;
    }

    try {
      const evaluationData = assignment.evaluations.map((evaluation: any) => ({
        goal: {
          goal_id: evaluation.goal?.goal_id || '',
          weight: evaluation.goal?.weight || 0,
          level_5_points: evaluation.goal?.max_score || evaluation.goal?.level_5_points || 100
        },
        awarded_points: evaluation.awarded_points || 0
      }));

      const calculatedPercentage = calculateKRAPercentage(evaluationData);
      return calculatedPercentage;
    } catch (error) {
      console.warn('Error recalculating KRA percentage:', error);
      return assignment.overall_percentage || 0;
    }
    */
  };

  // Process data for KRA percentage overview chart
  const kraPercentageData = useMemo((): KRAPercentageData[] => {
    const realData = filteredAssignments
      .filter(assignment => assignment.overall_percentage >= 0) // Show all assignments with any percentage (including 0)
      .map(assignment => {
        const kraSheetName = `${assignment.employee?.full_name || 'Unknown'} - ${assignment.template?.template_name || 'KRA'}`;
        
        // Use stored percentage for now (will use recalculated after migration)
        const correctedPercentage = assignment.overall_percentage || 0;
        
        return {
          name: kraSheetName,
          percentage: Math.round(correctedPercentage * 100) / 100, // Round to 2 decimal places
          employee: assignment.employee?.full_name || 'Unknown',
          template: assignment.template?.template_name || 'Unknown',
          kraSheet: kraSheetName // Use this as the display key
        };
      })
      .sort((a, b) => b.percentage - a.percentage);

    // If still no data, show all assignments for debugging
    if (realData.length === 0 && filteredAssignments.length > 0) {
      return filteredAssignments.slice(0, 5).map(assignment => {
        const kraSheetName = `${assignment.employee?.full_name || 'Unknown'} - ${assignment.template?.template_name || 'KRA'}`;
        return {
          name: kraSheetName,
          percentage: assignment.overall_percentage || 0,
          employee: assignment.employee?.full_name || 'Unknown',
          template: assignment.template?.template_name || 'Unknown',
          kraSheet: kraSheetName
        };
      });
    }

    return realData;
  }, [filteredAssignments]);

  // Process goal comparison data - comparing points across different KRA periods for each goal
  const goalComparisonData = useMemo(() => {
    const chartData: any[] = [];
    
    // Process all assignments to show goals with their points across different periods
    filteredAssignments.forEach((assignment) => {
      if (!assignment.evaluations || assignment.evaluations.length === 0) return;
      
      const kraPeriod = assignment.template?.template_name || 'Unknown';
      const employeeName = assignment.employee?.full_name || 'Unknown';
      
      assignment.evaluations.forEach((evaluation: any) => {
        
        if (!evaluation.goal) return;

        const goalId = evaluation.goal.goal_id;
        const goalTitle = evaluation.goal.strategic_goal_title;
        const shortGoalTitle = goalTitle.length > 30 ? goalTitle.substring(0, 30) + '...' : goalTitle;
        
        const maxPossiblePoints = evaluation.goal.level_5_points || evaluation.goal.max_score || 100;
        const awardedPoints = evaluation.awarded_points || 0;
        const percentage = maxPossiblePoints > 0 ? (awardedPoints / maxPossiblePoints) * 100 : 0;
        
        // Create a unique display name combining goal ID, period, and employee
        const displayName = `${goalId} - ${kraPeriod}`;
        
        chartData.push({
          displayName: displayName, // Unique key for X-axis
          goalId: goalId,
          goalTitle: goalTitle,
          shortGoalTitle: shortGoalTitle,
          kraPeriod: kraPeriod,
          employeeName: employeeName,
          points: awardedPoints,
          maxPoints: maxPossiblePoints,
          percentage: percentage,
          weight: evaluation.goal.weight || 0,
          assignmentId: assignment.id,
          evaluationId: evaluation.id
        });
      });
    });

    // Sort by goal ID first, then by KRA period for consistent ordering
    return chartData
      .sort((a, b) => {
        // First sort by goal ID
        const goalIdCompare = a.goalId.localeCompare(b.goalId);
        if (goalIdCompare !== 0) return goalIdCompare;
        
        // Then by KRA period
        return a.kraPeriod.localeCompare(b.kraPeriod);
      })
      .slice(0, 25); // Show more data points to see progression
  }, [filteredAssignments]);

  // Helper function to assign colors to goals
  const getGoalColor = (goalId: string) => {
    const colors = [
      '#f97316', // orange-500
      '#fb923c', // orange-400
      '#f59e0b', // amber-500
      '#fbbf24', // amber-400
      '#ea580c', // orange-600
      '#d97706', // amber-600
      '#fb7185', // rose-400
      '#f472b6', // pink-400
    ];
    
    // Simple hash function to assign consistent colors
    let hash = 0;
    for (let i = 0; i < goalId.length; i++) {
      hash = goalId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Process progression over time data - showing how each goal performs across different KRA periods
  const progressionData = useMemo(() => {
    // Group evaluations by goal and KRA period
    const goalProgressionMap = new Map<string, Map<string, any>>();
    
    filteredAssignments.forEach((assignment) => {
      if (!assignment.evaluations || assignment.evaluations.length === 0) return;
      
      const kraSheetName = assignment.template?.template_name || 'Unknown';
      
      assignment.evaluations.forEach((evaluation: any) => {
        if (!evaluation.goal) return;
        
        const goalId = evaluation.goal.goal_id;
        const goalTitle = evaluation.goal.strategic_goal_title;
        
        // Ensure we're getting the correct max points - prefer level_5_points
        const maxPossiblePoints = evaluation.goal.level_5_points || evaluation.goal.max_score || 100;
        const awardedPoints = evaluation.awarded_points || 0;
        const percentage = maxPossiblePoints > 0 ? (awardedPoints / maxPossiblePoints) * 100 : 0;
        
        if (!goalProgressionMap.has(goalId)) {
          goalProgressionMap.set(goalId, new Map());
        }
        
        const goalData = goalProgressionMap.get(goalId)!;
        
        // Only set if this KRA sheet doesn't already have this goal (prevent duplicates)
        if (!goalData.has(kraSheetName)) {
          goalData.set(kraSheetName, {
            goalId,
            goalTitle,
            kraSheet: kraSheetName,
            points: awardedPoints,
            maxPoints: maxPossiblePoints,
            percentage: percentage,
            weight: evaluation.goal.weight || 0,
            evaluationId: evaluation.id
          });
        }
      });
    });
    
    // Convert to array format for line chart
    // Create a list of all KRA periods
    const allKraPeriods = new Set<string>();
    filteredAssignments.forEach(a => {
      if (a.template?.template_name) {
        allKraPeriods.add(a.template.template_name);
      }
    });
    
    const sortedPeriods = Array.from(allKraPeriods).sort();
    
    // Build chart data with one data point per KRA period
    const chartData = sortedPeriods.map(period => {
      const dataPoint: any = { kraSheet: period };
      
      goalProgressionMap.forEach((periodMap, goalId) => {
        const goalData = periodMap.get(period);
        if (goalData) {
          dataPoint[goalId] = goalData.percentage;
          dataPoint[`${goalId}_goalTitle`] = goalData.goalTitle;
          dataPoint[`${goalId}_points`] = goalData.points;
          dataPoint[`${goalId}_maxPoints`] = goalData.maxPoints;
        }
      });
      
      return dataPoint;
    });
    
    // Get list of unique goals for rendering lines
    const goalsList = Array.from(goalProgressionMap.entries()).map(([goalId, periodMap]) => {
      const firstEntry = Array.from(periodMap.values())[0];
      return {
        goalId,
        goalTitle: firstEntry.goalTitle,
        color: getGoalColor(goalId)
      };
    });
    
    return { chartData, goalsList };
  }, [filteredAssignments, getGoalColor]);

  // Handle filter changes
  const handleFilterChange = (key: keyof PerformanceFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      employeeId: '',
      startDate: '',
      endDate: '',
      status: ''
    });
  };

  // Export data (placeholder)
  const exportData = () => {
    toast.info('Export functionality coming soon!');
  };

  // Check loading states for all data sources
  const isLoading = analyticsLoading || metricsLoading || employeesLoading || assignmentsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Overview</h1>
          <p className="text-muted-foreground">
            Comprehensive performance analytics and KRA insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Employee Filter */}
            <div className="space-y-2">
              <Label htmlFor="employee-filter">Employee</Label>
              <Select value={filters.employeeId || 'all'} onValueChange={(value) => handleFilterChange('employeeId', value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {availableEmployees.length === 0 ? (
                    <SelectItem value="no-employees" disabled>
                      No employees available
                    </SelectItem>
                  ) : (
                    availableEmployees.map((employee: any) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.full_name || employee.email || 'Unknown Employee'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date Filter */}
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>

            {/* End Date Filter */}
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="evaluated">Evaluated</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalAssignments || filteredAssignments.length}</div>
            <p className="text-xs text-muted-foreground">KRA assignments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.completedAssignments || filteredAssignments.filter(a => a.status === 'evaluated' || a.status === 'approved').length}
            </div>
            <p className="text-xs text-muted-foreground">Evaluations completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Average Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.averagePerformance ? `${Math.round(metrics.averagePerformance)}%` : 
                kraPercentageData.length > 0 
                  ? `${Math.round(kraPercentageData.reduce((sum, item) => sum + item.percentage, 0) / kraPercentageData.length)}%`
                  : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">Overall performance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Top Performer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {metrics?.topPerformer?.name || (kraPercentageData.length > 0 ? kraPercentageData[0].employee : 'N/A')}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.topPerformer?.percentage ? `${Math.round(metrics.topPerformer.percentage)}%` :
                kraPercentageData.length > 0 ? `${Math.round(kraPercentageData[0].percentage)}%` : 'No data'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main KRA Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            KRA Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {kraPercentageData.length > 0 ? (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={kraPercentageData} 
                  margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                >
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" opacity={0.3} />
                  <XAxis 
                    dataKey="kraSheet" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={11}
                    interval={0}
                    stroke="#ea580c"
                    tick={{ fill: '#ea580c' }}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    label={{ value: 'Performance %', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#ea580c' } }}
                    stroke="#ea580c"
                    tick={{ fill: '#ea580c' }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Performance']}
                    labelFormatter={(label) => `KRA Sheet: ${label}`}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #fed7aa',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(251, 146, 60, 0.1)',
                      color: '#ea580c'
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="percentage" 
                    fill="url(#colorGradient)" 
                    name="Performance %" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No KRA performance data available</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Goal Performance Comparison Across KRA Periods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Goal Performance Across KRA Periods
          </CardTitle>
          <CardDescription>
            Compare how each goal performs across different KRA evaluation periods (Q1, Q2, Q3, Q4, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {goalComparisonData.length > 0 ? (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={goalComparisonData} 
                  margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                >
                  <defs>
                    <linearGradient id="colorGradientSecondary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fb923c" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" opacity={0.3} />
                  <XAxis 
                    dataKey="displayName" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={9}
                    interval={0}
                    stroke="#ea580c"
                    tick={{ fill: '#ea580c' }}
                  />
                  <YAxis 
                    label={{ value: 'Points', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#ea580c' } }}
                    stroke="#ea580c"
                    tick={{ fill: '#ea580c' }}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white/95 p-3 border border-orange-200 rounded-lg shadow-lg shadow-orange-100/50 max-w-sm">
                            <p className="font-medium text-orange-800 mb-1">{`Goal ${data.goalId}`}</p>
                            <p className="text-sm text-orange-900 mb-2">{data.goalTitle}</p>
                            <div className="border-t border-orange-200 pt-2 space-y-1">
                              <p className="text-sm text-orange-600">{`KRA Period: ${data.kraPeriod}`}</p>
                              <p className="text-sm text-orange-500">{`Employee: ${data.employeeName}`}</p>
                              <p className="text-sm font-medium text-orange-700">{`Points: ${data.points}/${data.maxPoints}`}</p>
                              <p className="text-sm text-orange-700">{`Percentage: ${data.percentage.toFixed(1)}%`}</p>
                              <p className="text-xs text-orange-600">{`Weight: ${data.weight}%`}</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="points" 
                    fill="url(#colorGradientSecondary)" 
                    name="Points Awarded"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <div className="text-center">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No goal comparison data available</p>
                <p className="text-sm">Need evaluated KRA periods to show goal performance trends</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Goal Progression Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Goal Progression Over Time
          </CardTitle>
          <CardDescription>
            Track how each goal's performance evolves across different KRA periods
          </CardDescription>
        </CardHeader>
        <CardContent>
          {progressionData.chartData.length > 0 && progressionData.goalsList.length > 0 ? (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={progressionData.chartData} 
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <defs>
                    {progressionData.goalsList.map(goal => (
                      <linearGradient key={`gradient-${goal.goalId}`} id={`lineGradient-${goal.goalId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={goal.color} stopOpacity={0.8} />
                        <stop offset="100%" stopColor={goal.color} stopOpacity={0.3} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" opacity={0.3} />
                  <XAxis 
                    dataKey="kraSheet" 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    fontSize={11}
                    stroke="#ea580c"
                    tick={{ fill: '#ea580c' }}
                  />
                  <YAxis 
                    domain={[0, 100]}
                    label={{ value: 'Performance %', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#ea580c' } }}
                    stroke="#ea580c"
                    tick={{ fill: '#ea580c' }}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white/95 p-3 border border-orange-200 rounded-lg shadow-lg shadow-orange-100/50 max-w-xs">
                            <p className="font-medium text-orange-800 mb-2">{`KRA Period: ${label}`}</p>
                            {payload.map((entry: any, index: number) => {
                              const goalId = entry.dataKey;
                              const goalTitle = entry.payload[`${goalId}_goalTitle`] || goalId;
                              const points = entry.payload[`${goalId}_points`] || 0;
                              const maxPoints = entry.payload[`${goalId}_maxPoints`] || 0;
                              
                              return (
                                <div key={index} className="mb-1">
                                  <p className="text-sm font-medium" style={{ color: entry.color }}>
                                    {goalTitle}
                                  </p>
                                  <p className="text-xs text-orange-700">
                                    {`${entry.value?.toFixed(1)}% (${points}/${maxPoints} points)`}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    formatter={(value) => {
                      const goal = progressionData.goalsList.find(g => g.goalId === value);
                      return goal ? goal.goalTitle : value;
                    }}
                  />
                  {progressionData.goalsList.map(goal => (
                    <Line
                      key={goal.goalId}
                      type="monotone"
                      dataKey={goal.goalId}
                      stroke={goal.color}
                      strokeWidth={2}
                      dot={{ fill: goal.color, r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls={false}
                      name={goal.goalId}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No progression data available</p>
                <p className="text-sm">Need multiple KRA periods to show progression</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug Information and Additional Insights */}
      {kraPercentageData.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Performance Data Available</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              There are no completed KRA evaluations matching your current filters. 
              Try adjusting the filters or check back once evaluations are completed.
            </p>
            {/* Debug info */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Total assignments: {assignments.length}</p>
              <p>Filtered assignments: {filteredAssignments.length}</p>
              <p>Available employees: {availableEmployees.length}</p>
              <p>Selected employee: {filters.employeeId || 'None'}</p>
              {assignments.length > 0 && (
                <p>Sample assignment status: {assignments[0]?.status}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
