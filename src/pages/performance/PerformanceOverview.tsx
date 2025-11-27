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
  ResponsiveContainer,
  Cell
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
import { parseISO } from 'date-fns';
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
  evaluationStartDate: string;
  evaluationEndDate: string;
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
    evaluationStartDate: '',
    evaluationEndDate: '',
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
    startDate: filters.evaluationStartDate,
    endDate: filters.evaluationEndDate
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

      // Evaluation period date range filter
      if ((filters.evaluationStartDate || filters.evaluationEndDate) && assignment.template) {
        const templateStart = assignment.template.evaluation_period_start;
        const templateEnd = assignment.template.evaluation_period_end;
        
        if (!templateStart || !templateEnd) return false;

        const evalStart = parseISO(templateStart);
        const evalEnd = parseISO(templateEnd);
        
        if (filters.evaluationStartDate && filters.evaluationEndDate) {
          const filterStart = parseISO(filters.evaluationStartDate);
          const filterEnd = parseISO(filters.evaluationEndDate);
          
          // Check if evaluation period overlaps with filter range
          if (evalEnd < filterStart || evalStart > filterEnd) {
            return false;
          }
        } else if (filters.evaluationStartDate) {
          const filterStart = parseISO(filters.evaluationStartDate);
          if (evalEnd < filterStart) return false;
        } else if (filters.evaluationEndDate) {
          const filterEnd = parseISO(filters.evaluationEndDate);
          if (evalStart > filterEnd) return false;
        }
      }

      return true;
    });
  }, [assignments, filters]);

  // Helper function to recalculate KRA percentage using correct logic
  // Currently disabled - will re-enable after migration is applied
  // const recalculateKRAPercentage = (assignment: any): number => {
  //   return assignment.overall_percentage || 0;
  // };

  // Create a map to store unique strategic goal titles and their assigned colors
  const goalColorMap = useMemo(() => {
    const colors = [
      '#dc2626', // red-600
      '#2563eb', // blue-600
      '#16a34a', // green-600
      '#ca8a04', // yellow-600
      '#9333ea', // purple-600
      '#ea580c', // orange-600
      '#0891b2', // cyan-600
      '#be185d', // pink-600
      '#059669', // emerald-600
      '#7c3aed', // violet-600
      '#0d9488', // teal-600
      '#f59e0b', // amber-500
    ];

    const uniqueGoalTitles = new Set<string>();
    
    // Collect all unique strategic goal titles from assignments
    filteredAssignments.forEach(assignment => {
      if (assignment.evaluations) {
        assignment.evaluations.forEach((evaluation: any) => {
          if (evaluation.goal?.strategic_goal_title) {
            uniqueGoalTitles.add(evaluation.goal.strategic_goal_title);
          }
        });
      }
    });

    // Create a map with sequential color assignment
    const colorMap = new Map<string, string>();
    Array.from(uniqueGoalTitles).sort().forEach((title, index) => {
      colorMap.set(title, colors[index % colors.length]);
    });

    return colorMap;
  }, [filteredAssignments]);

  // Helper function to get color for a strategic goal title
  const getGoalColor = (strategicGoalTitle: string): string => {
    return goalColorMap.get(strategicGoalTitle) || '#6b7280'; // fallback to gray
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
        const quarter = evaluation.quarter || 'Q1'; // Get the specific quarter
        
        const maxPossiblePoints = evaluation.goal.level_5_points || evaluation.goal.max_score || 100;
        const awardedPoints = evaluation.awarded_marks || 0; // Use awarded_marks (level points) instead of awarded_points
        const percentage = maxPossiblePoints > 0 ? (awardedPoints / maxPossiblePoints) * 100 : 0;
        
        // Create a unique display name combining goal ID, period, and quarter
        const displayName = `${goalId} - ${kraPeriod} - ${quarter}`;
        
        chartData.push({
          displayName: displayName, // Unique key for X-axis
          goalId: goalId,
          goalTitle: goalTitle,
          shortGoalTitle: shortGoalTitle,
          kraPeriod: kraPeriod,
          quarter: quarter, // Add quarter information
          employeeName: employeeName,
          points: awardedPoints,
          maxPoints: maxPossiblePoints,
          percentage: percentage,
          weight: evaluation.goal.weight || 0,
          assignmentId: assignment.id,
          evaluationId: evaluation.id,
          color: getGoalColor(goalTitle) // Add color based on strategic goal title
        });
      });
    });

    // Sort by goal ID first, then by KRA period, then by quarter for consistent ordering
    return chartData
      .sort((a, b) => {
        // First sort by goal ID
        const goalIdCompare = a.goalId.localeCompare(b.goalId);
        if (goalIdCompare !== 0) return goalIdCompare;
        
        // Then by KRA period
        const periodCompare = a.kraPeriod.localeCompare(b.kraPeriod);
        if (periodCompare !== 0) return periodCompare;
        
        // Finally by quarter (Q1, Q2, Q3, Q4)
        const quarterOrder = { 'Q1': 1, 'Q2': 2, 'Q3': 3, 'Q4': 4 };
        return (quarterOrder[a.quarter as keyof typeof quarterOrder] || 0) - (quarterOrder[b.quarter as keyof typeof quarterOrder] || 0);
      })
      .slice(0, 25); // Show more data points to see progression
  }, [filteredAssignments, getGoalColor]);

  // Process progression over time data - showing cumulative goal performance across quarters
  const progressionData = useMemo(() => {
    // Group evaluations by goal and track cumulative performance across quarters
    const goalProgressionMap = new Map<string, Map<string, any>>();
    
    filteredAssignments.forEach((assignment) => {
      if (!assignment.evaluations || assignment.evaluations.length === 0) return;
      
      const templateName = assignment.template?.template_name || 'Unknown Template';
      const employeeName = assignment.employee?.full_name || 'Unknown Employee';
      
      // Group evaluations by goal and quarter
      const goalQuarterMap = new Map<string, Map<string, any>>();
      
      assignment.evaluations.forEach((evaluation: any) => {
        if (!evaluation.goal || !evaluation.quarter) return;
        
        const goalId = evaluation.goal.goal_id;
        const goalTitle = evaluation.goal.strategic_goal_title;
        const quarter = evaluation.quarter;
        
        if (!goalQuarterMap.has(goalId)) {
          goalQuarterMap.set(goalId, new Map());
        }
        
        const maxPossiblePoints = evaluation.goal.level_5_points || evaluation.goal.max_score || 100;
        const awardedPoints = evaluation.awarded_points || 0;
        const awardedMarks = evaluation.awarded_marks || 0; // This is what the manager actually awarded
        const percentage = maxPossiblePoints > 0 ? (awardedPoints / maxPossiblePoints) * 100 : 0;
        
        goalQuarterMap.get(goalId)!.set(quarter, {
          goalId,
          goalTitle,
          quarter,
          percentage,
          awardedPoints,
          awardedMarks, // Manager's awarded marks/points
          maxPossiblePoints,
          templateName,
          employeeName
        });
      });
      
      // Store individual quarterly awarded marks for each goal
      goalQuarterMap.forEach((quarterMap, goalId) => {
        const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
        
        quarters.forEach(quarter => {
          const quarterData = quarterMap.get(quarter);
          if (quarterData) {
            const periodKey = `${templateName} - ${quarter}`;
            
            if (!goalProgressionMap.has(goalId)) {
              goalProgressionMap.set(goalId, new Map());
            }
            
            goalProgressionMap.get(goalId)!.set(periodKey, {
              goalId,
              goalTitle: quarterData.goalTitle,
              quarter,
              periodKey,
              quarterAwardedMarks: quarterData.awardedMarks,
              quarterMaxMarks: quarterData.maxPossiblePoints || 100,
              templateName,
              employeeName
            });
          }
        });
      });
    });
    
    // Convert to array format for line chart
    const allPeriods = new Set<string>();
    goalProgressionMap.forEach((periodMap) => {
      periodMap.forEach((_, periodKey) => {
        allPeriods.add(periodKey);
      });
    });
    
    const sortedPeriods = Array.from(allPeriods).sort((a, b) => {
      // Sort by template name first, then by quarter
      const [templateA, quarterA] = a.split(' - ');
      const [templateB, quarterB] = b.split(' - ');
      
      if (templateA !== templateB) {
        return templateA.localeCompare(templateB);
      }
      
      // Sort quarters in order Q1, Q2, Q3, Q4
      const quarterOrder = { 'Q1': 1, 'Q2': 2, 'Q3': 3, 'Q4': 4 };
      return (quarterOrder[quarterA as keyof typeof quarterOrder] || 0) - (quarterOrder[quarterB as keyof typeof quarterOrder] || 0);
    });
    
    // Build chart data with one data point per period
    const chartData = sortedPeriods.map(period => {
      const dataPoint: any = { kraSheet: period };
      
      goalProgressionMap.forEach((periodMap, goalId) => {
        const goalData = periodMap.get(period);
        if (goalData) {
          dataPoint[goalId] = goalData.quarterAwardedMarks;
          dataPoint[`${goalId}_goalTitle`] = goalData.goalTitle;
          dataPoint[`${goalId}_quarter`] = goalData.quarter;
          dataPoint[`${goalId}_quarterMarks`] = goalData.quarterAwardedMarks;
          dataPoint[`${goalId}_quarterMaxMarks`] = goalData.quarterMaxMarks;
        }
      });
      
      return dataPoint;
    });
    
    // Get list of unique goals for rendering lines
    const goalsList = Array.from(goalProgressionMap.entries()).map(([goalId, periodMap]) => {
      const firstEntry = Array.from(periodMap.values())[0];
      return {
        goalId,
        goalTitle: `${goalId}: ${firstEntry.goalTitle}`,
        color: getGoalColor(firstEntry.goalTitle) // Use goal title for color
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
      evaluationStartDate: '',
      evaluationEndDate: '',
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
    <div className="space-y-6 pr-4">
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
              <Select value={filters.employeeId} onValueChange={(value) => handleFilterChange('employeeId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
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

            {/* Evaluation Start Date Filter */}
            <div className="space-y-2">
              <Label htmlFor="evaluation-start-date">Evaluation Start Date</Label>
              <Input
                id="evaluation-start-date"
                type="date"
                value={filters.evaluationStartDate}
                onChange={(e) => handleFilterChange('evaluationStartDate', e.target.value)}
              />
            </div>

            {/* Evaluation End Date Filter */}
            <div className="space-y-2">
              <Label htmlFor="evaluation-end-date">Evaluation End Date</Label>
              <Input
                id="evaluation-end-date"
                type="date"
                value={filters.evaluationEndDate}
                onChange={(e) => handleFilterChange('evaluationEndDate', e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

        {/* <Card>
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
        </Card> */}
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                  <XAxis 
                    dataKey="kraSheet" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={11}
                    interval={0}
                    stroke="#000000"
                    tick={{ fill: '#000000' }}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    label={{ value: 'Cumulative Performance %', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#000000' } }}
                    stroke="#000000"
                    tick={{ fill: '#000000' }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Performance']}
                    labelFormatter={(label) => `KRA Sheet: ${label}`}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      color: '#000000'
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                  <XAxis 
                    dataKey="displayName" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={9}
                    interval={0}
                    stroke="#000000"
                    tick={{ fill: '#000000' }}
                  />
                  <YAxis 
                    label={{ value: 'Points', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#000000' } }}
                    stroke="#000000"
                    tick={{ fill: '#000000' }}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
                    allowEscapeViewBox={{ x: false, y: true }}
                    content={({ active, payload, coordinate }) => {
                      if (active && payload && payload.length && coordinate) {
                        const data = payload[0].payload;
                        
                        // Position tooltip above chart area if mouse is in lower half, below if in upper half
                        const isLowerHalf = coordinate.y > 200; // Approximate middle of chart
                        
                        return (
                          <div 
                            className="bg-white/95 p-3 border border-gray-200 rounded-lg shadow-lg max-w-sm fixed z-50"
                            style={{
                              left: `${coordinate.x - 150}px`, // Center horizontally around cursor
                              top: isLowerHalf ? '20px' : 'auto', // Top area if cursor in lower half
                              bottom: isLowerHalf ? 'auto' : '20px', // Bottom area if cursor in upper half
                              transform: 'translateX(0)', // Remove any default transforms
                              pointerEvents: 'none' // Prevent tooltip from interfering with mouse events
                            }}
                          >
                            <p className="font-medium text-gray-800 mb-1">{`Goal ${data.goalId}`}</p>
                            <p className="text-sm text-gray-900 mb-2">{data.goalTitle}</p>
                            <div className="border-t border-gray-200 pt-2 space-y-1">
                              <p className="text-sm text-gray-600">{`KRA Period: ${data.kraPeriod}`}</p>
                              <p className="text-sm text-gray-600">{`Quarter: ${data.quarter}`}</p>
                              <p className="text-sm text-gray-500">{`Employee: ${data.employeeName}`}</p>
                              <p className="text-sm font-medium text-gray-700">{`Points: ${data.points}/${data.maxPoints}`}</p>
                              <p className="text-sm text-gray-700">{`Percentage: ${data.percentage.toFixed(1)}%`}</p>
                              <p className="text-xs text-gray-600">{`Weight: ${data.weight}%`}</p>
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
                    name="Points Awarded"
                    radius={[2, 2, 0, 0]}
                  >
                    {goalComparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#6b7280'} />
                    ))}
                  </Bar>
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
            Goal Points Progression
          </CardTitle>
          <CardDescription>
            Track individual goal performance points awarded by managers each quarter
          </CardDescription>
        </CardHeader>
        <CardContent>
          {progressionData.chartData.length > 0 && progressionData.goalsList.length > 0 ? (
            <>
              {/* Debug info - remove in production */}
              {/* <div className="mb-4 p-2 bg-gray-50 rounded text-xs text-gray-600">
                <p>Chart Data Points: {progressionData.chartData.length}</p>
                <p>Goals: {progressionData.goalsList.length}</p>
                <p>Goals: {progressionData.goalsList.map(g => g.goalTitle).join(', ')}</p>
              </div> */}
              {/* Legend outside chart for better space utilization */}
              <div className="mb-4 flex flex-wrap gap-3">
                {progressionData.goalsList.map(goal => (
                  <div key={goal.goalId} className="flex items-center gap-2 text-sm">
                    <div 
                      className="w-4 h-1 rounded"
                      style={{ backgroundColor: goal.color }}
                    />
                    <span className="text-gray-700">
                      {goal.goalTitle.length > 25 ? goal.goalTitle.substring(0, 25) + '...' : goal.goalTitle}
                    </span>
                  </div>
                ))}
              </div>
              <div className="h-[500px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={progressionData.chartData} 
                  margin={{ top: 20, right: 30, left: 60, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" opacity={0.7} />
                  <XAxis 
                    dataKey="kraSheet" 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    fontSize={11}
                    stroke="#000000"
                    tick={{ fill: '#000000' }}
                  />
                  <YAxis 
                    domain={[0, 'dataMax']}
                    label={{ value: 'Points Awarded', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#000000' } }}
                    stroke="#000000"
                    tick={{ fill: '#000000' }}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white/95 p-3 border border-gray-200 rounded-lg shadow-lg max-w-xs">
                            <p className="font-medium text-gray-800 mb-2">{`Period: ${label}`}</p>
                            {payload.map((entry: any, index: number) => {
                              const goalId = entry.dataKey;
                              const quarterMaxMarks = entry.payload[`${goalId}_quarterMaxMarks`] || 0;
                              
                              return (
                                <div key={index} className="mb-1">
                                  <p className="text-sm font-medium" style={{ color: entry.color }}>
                                    {goalId}
                                  </p>
                                  <p className="text-xs text-gray-700">
                                    {`Points: ${entry.value}/${quarterMaxMarks}`}
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
                  {progressionData.goalsList.map(goal => (
                    <Line
                      key={goal.goalId}
                      type="monotone"
                      dataKey={goal.goalId}
                      stroke={goal.color}
                      strokeWidth={4}
                      dot={{ 
                        fill: goal.color, 
                        r: 6, 
                        stroke: '#ffffff', 
                        strokeWidth: 2,
                        fillOpacity: 1
                      }}
                      activeDot={{ 
                        r: 10, 
                        stroke: goal.color, 
                        strokeWidth: 3,
                        fill: '#ffffff',
                        fillOpacity: 1
                      }}
                      connectNulls={false}
                      name={goal.goalId}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              </div>
            </>
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
