import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useKRAPermissions } from './useKRAPermissions';
import type { KRAAssignment, KRAEvaluation } from './useKRA';

export interface PerformanceMetrics {
  totalAssignments: number;
  completedAssignments: number;
  averagePerformance: number;
  topPerformer: {
    name: string;
    percentage: number;
  } | null;
  performanceDistribution: {
    excellent: number; // 90-100%
    good: number; // 70-89%
    average: number; // 50-69%
    needsImprovement: number; // <50%
  };
}

export interface GoalAnalytics {
  goalId: string;
  goalTitle: string;
  averageScore: number;
  maxScore: number;
  completionRate: number;
  performanceData: Array<{
    employeeName: string;
    score: number;
    percentage: number;
  }>;
}

export interface PerformanceAnalyticsData {
  assignments: KRAAssignment[];
  metrics: PerformanceMetrics;
  goalAnalytics: GoalAnalytics[];
  departmentPerformance: Array<{
    department: string;
    averagePerformance: number;
    employeeCount: number;
  }>;
}

// Hook for comprehensive performance analytics
export function usePerformanceAnalytics(filters?: {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  departmentId?: string;
}) {
  const { user } = useAuth();
  const permissions = useKRAPermissions();

  return useQuery({
    queryKey: ['performance-analytics', user?.id, filters],
    queryFn: async (): Promise<PerformanceAnalyticsData> => {
      if (!user) throw new Error('User not authenticated');

      // Build the query based on permissions
      let query = supabase
        .from('kra_assignments')
        .select(`
          *,
          template:kra_templates (
            id, 
            template_name, 
            evaluation_period_start, 
            evaluation_period_end,
            description
          ),
          employee:users!kra_assignments_employee_id_fkey (
            id, 
            full_name, 
            email, 
            employee_id, 
            position, 
            department_id,
            department:departments!users_department_id_fkey (
              id,
              name
            )
          ),
          assigned_by_user:users!kra_assignments_assigned_by_fkey (
            id, 
            full_name, 
            email, 
            position
          ),
          evaluations:kra_evaluations (
            *,
            goal:kra_goals (
              id,
              goal_id,
              strategic_goal_title,
              weight,
              max_score
            )
          )
        `);

      // Apply permission-based filtering
      if (!permissions.canViewAllKRA) {
        // Managers can only see their team's data
        query = query.eq('assigned_by', user.id);
      }

      // Apply filters
      if (filters?.employeeId) {
        query = query.eq('employee_id', filters.employeeId);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.startDate) {
        query = query.gte('assigned_date', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('assigned_date', filters.endDate);
      }

      query = query.order('created_at', { ascending: false });

      const { data: assignments, error } = await query;

      if (error) throw error;

      const typedAssignments = assignments as KRAAssignment[];

      // Calculate metrics
      const metrics = calculatePerformanceMetrics(typedAssignments);
      
      // Calculate goal analytics
      const goalAnalytics = calculateGoalAnalytics(typedAssignments);
      
      // Calculate department performance
      const departmentPerformance = calculateDepartmentPerformance(typedAssignments);

      return {
        assignments: typedAssignments,
        metrics,
        goalAnalytics,
        departmentPerformance
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for real-time performance metrics
export function usePerformanceMetrics(filters?: {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const { user } = useAuth();
  const permissions = useKRAPermissions();

  return useQuery({
    queryKey: ['performance-metrics', user?.id, filters],
    queryFn: async (): Promise<PerformanceMetrics> => {
      if (!user) throw new Error('User not authenticated');

      let query = supabase
        .from('kra_assignments')
        .select(`
          *,
          employee:users!kra_assignments_employee_id_fkey (
            id, 
            full_name
          )
        `);

      // Apply permission-based filtering
      if (!permissions.canViewAllKRA) {
        query = query.eq('assigned_by', user.id);
      }

      // Apply filters
      if (filters?.employeeId) {
        query = query.eq('employee_id', filters.employeeId);
      }

      if (filters?.startDate) {
        query = query.gte('assigned_date', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('assigned_date', filters.endDate);
      }

      const { data: assignments, error } = await query;

      if (error) throw error;

      return calculatePerformanceMetrics(assignments as KRAAssignment[]);
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });
}

// Helper function to calculate performance metrics
function calculatePerformanceMetrics(assignments: KRAAssignment[]): PerformanceMetrics {
  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter(
    a => a.status === 'evaluated' || a.status === 'approved'
  ).length;

  const evaluatedAssignments = assignments.filter(
    a => (a.status === 'evaluated' || a.status === 'approved') && a.overall_percentage > 0
  );

  const averagePerformance = evaluatedAssignments.length > 0
    ? evaluatedAssignments.reduce((sum, a) => sum + a.overall_percentage, 0) / evaluatedAssignments.length
    : 0;

  // Find top performer
  const topPerformer = evaluatedAssignments.length > 0
    ? evaluatedAssignments.reduce((top, current) => 
        current.overall_percentage > top.overall_percentage ? current : top
      )
    : null;

  // Calculate performance distribution
  const performanceDistribution = {
    excellent: evaluatedAssignments.filter(a => a.overall_percentage >= 90).length,
    good: evaluatedAssignments.filter(a => a.overall_percentage >= 70 && a.overall_percentage < 90).length,
    average: evaluatedAssignments.filter(a => a.overall_percentage >= 50 && a.overall_percentage < 70).length,
    needsImprovement: evaluatedAssignments.filter(a => a.overall_percentage < 50).length,
  };

  return {
    totalAssignments,
    completedAssignments,
    averagePerformance: Math.round(averagePerformance * 100) / 100,
    topPerformer: topPerformer ? {
      name: topPerformer.employee?.full_name || 'Unknown',
      percentage: topPerformer.overall_percentage
    } : null,
    performanceDistribution
  };
}

// Helper function to calculate goal analytics
function calculateGoalAnalytics(assignments: KRAAssignment[]): GoalAnalytics[] {
  const goalMap = new Map<string, GoalAnalytics>();

  assignments.forEach(assignment => {
    if (!assignment.evaluations || assignment.evaluations.length === 0) return;

    assignment.evaluations.forEach(evaluation => {
      if (!evaluation.goal) return;

      const goalKey = `${evaluation.goal.goal_id}-${evaluation.goal.strategic_goal_title}`;
      
      if (!goalMap.has(goalKey)) {
        goalMap.set(goalKey, {
          goalId: evaluation.goal.goal_id,
          goalTitle: evaluation.goal.strategic_goal_title,
          averageScore: 0,
          maxScore: evaluation.goal.weight || evaluation.goal.max_score || 100,
          completionRate: 0,
          performanceData: []
        });
      }

      const goalData = goalMap.get(goalKey)!;
      goalData.performanceData.push({
        employeeName: assignment.employee?.full_name || 'Unknown',
        score: evaluation.awarded_points || 0,
        percentage: ((evaluation.awarded_points || 0) / goalData.maxScore) * 100
      });
    });
  });

  // Calculate averages and completion rates
  goalMap.forEach(goalData => {
    if (goalData.performanceData.length > 0) {
      const totalScore = goalData.performanceData.reduce((sum, data) => sum + data.score, 0);
      goalData.averageScore = totalScore / goalData.performanceData.length;
      
      const completedCount = goalData.performanceData.filter(data => data.score > 0).length;
      goalData.completionRate = (completedCount / goalData.performanceData.length) * 100;
    }
  });

  return Array.from(goalMap.values())
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 15); // Return top 15 goals
}

// Helper function to calculate department performance
function calculateDepartmentPerformance(assignments: KRAAssignment[]) {
  const departmentMap = new Map<string, { 
    total: number; 
    sum: number; 
    count: number; 
    employees: Set<string> 
  }>();

  assignments.forEach(assignment => {
    if (!assignment.employee?.department || 
        assignment.status !== 'evaluated' && assignment.status !== 'approved') {
      return;
    }

    const deptName = (assignment.employee as any).department?.name || 'Unknown Department';
    
    if (!departmentMap.has(deptName)) {
      departmentMap.set(deptName, { 
        total: 0, 
        sum: 0, 
        count: 0, 
        employees: new Set() 
      });
    }

    const deptData = departmentMap.get(deptName)!;
    deptData.sum += assignment.overall_percentage;
    deptData.count++;
    deptData.employees.add(assignment.employee_id);
  });

  return Array.from(departmentMap.entries()).map(([department, data]) => ({
    department,
    averagePerformance: data.count > 0 ? Math.round((data.sum / data.count) * 100) / 100 : 0,
    employeeCount: data.employees.size
  })).sort((a, b) => b.averagePerformance - a.averagePerformance);
}

// Hook for employee performance comparison
export function useEmployeePerformanceComparison(employeeIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['employee-performance-comparison', employeeIds],
    queryFn: async () => {
      if (!user || employeeIds.length === 0) return [];

      const { data: assignments, error } = await supabase
        .from('kra_assignments')
        .select(`
          *,
          employee:users!kra_assignments_employee_id_fkey (
            id, 
            full_name
          ),
          template:kra_templates (
            template_name
          )
        `)
        .in('employee_id', employeeIds)
        .in('status', ['evaluated', 'approved']);

      if (error) throw error;

      return assignments.map(assignment => ({
        employeeId: assignment.employee_id,
        employeeName: assignment.employee?.full_name || 'Unknown',
        templateName: assignment.template?.template_name || 'Unknown',
        percentage: assignment.overall_percentage,
        evaluatedAt: assignment.evaluated_at
      }));
    },
    enabled: !!user && employeeIds.length > 0,
  });
}
