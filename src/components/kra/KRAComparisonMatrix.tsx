import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  BarChart3, 
  Download, 
  Filter,
  Users,
  Calendar,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { useAllKRAAssignments } from '@/hooks/useKRA';
import { useDepartmentsBasic } from '@/hooks/useATS';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { toast } from 'sonner';
import type { KRAAssignment } from '@/hooks/useKRA';

interface KRAComparisonMatrixProps {
  className?: string;
  // Optional props for team context
  teamAssignments?: KRAAssignment[];
  isTeamContext?: boolean;
  isLoading?: boolean;
}

interface MatrixData {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  departmentId: string;
  evaluationPeriod: string;
  evaluationPeriodStart: string;
  evaluationPeriodEnd: string;
  templateName: string;
  q1Score: number | null;
  q1Percentage: number | null;
  q1Status: string;
  q2Score: number | null;
  q2Percentage: number | null;
  q2Status: string;
  q3Score: number | null;
  q3Percentage: number | null;
  q3Status: string;
  q4Score: number | null;
  q4Percentage: number | null;
  q4Status: string;
  annualAverage: number | null;
  completedQuarters: number;
}

export function KRAComparisonMatrix({ 
  className, 
  teamAssignments, 
  isTeamContext = false, 
  isLoading: propIsLoading 
}: KRAComparisonMatrixProps) {
  const { data: allAssignments = [], isLoading: allAssignmentsLoading } = useAllKRAAssignments();
  const { data: departments = [] } = useDepartmentsBasic();
  
  // Use team assignments if provided, otherwise use all assignments
  const assignments = teamAssignments || allAssignments;
  const isLoading = propIsLoading !== undefined ? propIsLoading : allAssignmentsLoading;
  
  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedEvaluationPeriod, setSelectedEvaluationPeriod] = useState<string>('all');

  // Get unique evaluation periods from assignments
  const evaluationPeriods = useMemo(() => {
    const periods = new Set<string>();
    assignments.forEach(assignment => {
      if (assignment.template?.evaluation_period_start && assignment.template?.evaluation_period_end) {
        const periodKey = `${assignment.template.evaluation_period_start}_${assignment.template.evaluation_period_end}`;
        periods.add(periodKey);
      }
    });
    return Array.from(periods).map(period => {
      const [start, end] = period.split('_');
      return {
        key: period,
        label: `${formatDateForDisplay(start, 'MMM yyyy')} - ${formatDateForDisplay(end, 'MMM yyyy')}`,
        start,
        end
      };
    }).sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  }, [assignments]);

  // Process assignments into matrix data
  const matrixData = useMemo((): MatrixData[] => {
    return assignments
      .filter(assignment => {
        // Filter by department
        if (selectedDepartment !== 'all' && assignment.employee?.department_id !== selectedDepartment) {
          return false;
        }
        
        // Filter by evaluation period
        if (selectedEvaluationPeriod !== 'all') {
          const [filterStart, filterEnd] = selectedEvaluationPeriod.split('_');
          const assignmentStart = assignment.template?.evaluation_period_start;
          const assignmentEnd = assignment.template?.evaluation_period_end;
          
          if (assignmentStart !== filterStart || assignmentEnd !== filterEnd) {
            return false;
          }
        }
        
        return true;
      })
      .map(assignment => {
        const employee = assignment.employee;
        const template = assignment.template;
        
        return {
          employeeId: employee?.id || '',
          employeeName: employee?.full_name || 'Unknown',
          employeeCode: employee?.employee_id || 'N/A',
          department: employee?.department?.name || 'No Department',
          departmentId: employee?.department_id || '',
          evaluationPeriod: template ? 
            `${formatDateForDisplay(template.evaluation_period_start, 'MMM yyyy')} - ${formatDateForDisplay(template.evaluation_period_end, 'MMM yyyy')}` : 
            'Unknown Period',
          evaluationPeriodStart: template?.evaluation_period_start || '',
          evaluationPeriodEnd: template?.evaluation_period_end || '',
          templateName: template?.template_name || 'Unknown Template',
          
          // Q1 Data
          q1Score: assignment.q1_total_score ?? null,
          q1Percentage: assignment.q1_overall_percentage ?? null,
          q1Status: assignment.q1_status || 'not_started',
          
          // Q2 Data
          q2Score: assignment.q2_total_score ?? null,
          q2Percentage: assignment.q2_overall_percentage ?? null,
          q2Status: assignment.q2_status || 'not_started',
          
          // Q3 Data
          q3Score: assignment.q3_total_score ?? null,
          q3Percentage: assignment.q3_overall_percentage ?? null,
          q3Status: assignment.q3_status || 'not_started',
          
          // Q4 Data
          q4Score: assignment.q4_total_score ?? null,
          q4Percentage: assignment.q4_overall_percentage ?? null,
          q4Status: assignment.q4_status || 'not_started',
          
          // Annual Summary - Calculate from available quarterly scores
          annualAverage: (() => {
            const quarterlyScores = [
              assignment.q1_overall_percentage,
              assignment.q2_overall_percentage,
              assignment.q3_overall_percentage,
              assignment.q4_overall_percentage
            ].filter(score => score !== null && score !== undefined && typeof score === 'number');
            
            
            if (quarterlyScores.length === 0) {
              // Fallback to database annual average if available
              return assignment.annual_average_percentage ?? null;
            }
            
            const sum = quarterlyScores.reduce((acc, score) => acc + score, 0);
            return sum / quarterlyScores.length;
          })(),
          completedQuarters: (() => {
            const completedStatuses = ['evaluated', 'approved'];
            return [
              assignment.q1_status,
              assignment.q2_status,
              assignment.q3_status,
              assignment.q4_status
            ].filter(status => completedStatuses.includes(status)).length;
          })()
        };
      })
      .sort((a, b) => {
        // Sort by department first, then by employee name
        if (a.department !== b.department) {
          return a.department.localeCompare(b.department);
        }
        return a.employeeName.localeCompare(b.employeeName);
      });
  }, [assignments, selectedDepartment, selectedEvaluationPeriod]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (matrixData.length === 0) {
      return {
        totalEmployees: 0,
        avgQ1: 0,
        avgQ2: 0,
        avgQ3: 0,
        avgQ4: 0,
        avgAnnual: 0,
        completionRate: 0
      };
    }

    const q1Scores = matrixData.filter(d => d.q1Percentage !== null && typeof d.q1Percentage === 'number').map(d => d.q1Percentage!);
    const q2Scores = matrixData.filter(d => d.q2Percentage !== null && typeof d.q2Percentage === 'number').map(d => d.q2Percentage!);
    const q3Scores = matrixData.filter(d => d.q3Percentage !== null && typeof d.q3Percentage === 'number').map(d => d.q3Percentage!);
    const q4Scores = matrixData.filter(d => d.q4Percentage !== null && typeof d.q4Percentage === 'number').map(d => d.q4Percentage!);
    const annualScores = matrixData.filter(d => d.annualAverage !== null && typeof d.annualAverage === 'number').map(d => d.annualAverage!);

    const avgQ1 = q1Scores.length > 0 ? q1Scores.reduce((sum, score) => sum + score, 0) / q1Scores.length : 0;
    const avgQ2 = q2Scores.length > 0 ? q2Scores.reduce((sum, score) => sum + score, 0) / q2Scores.length : 0;
    const avgQ3 = q3Scores.length > 0 ? q3Scores.reduce((sum, score) => sum + score, 0) / q3Scores.length : 0;
    const avgQ4 = q4Scores.length > 0 ? q4Scores.reduce((sum, score) => sum + score, 0) / q4Scores.length : 0;
    const avgAnnual = annualScores.length > 0 ? annualScores.reduce((sum, score) => sum + score, 0) / annualScores.length : 0;

    const totalPossibleQuarters = matrixData.length * 4;
    const completedQuarters = matrixData.reduce((sum, d) => sum + d.completedQuarters, 0);
    const completionRate = totalPossibleQuarters > 0 ? (completedQuarters / totalPossibleQuarters) * 100 : 0;

    return {
      totalEmployees: matrixData.length,
      avgQ1: Math.round(avgQ1 * 100) / 100,
      avgQ2: Math.round(avgQ2 * 100) / 100,
      avgQ3: Math.round(avgQ3 * 100) / 100,
      avgQ4: Math.round(avgQ4 * 100) / 100,
      avgAnnual: Math.round(avgAnnual * 100) / 100,
      completionRate: Math.round(completionRate * 100) / 100
    };
  }, [matrixData]);

  // Helper functions
  const getStatusBadge = (status: string, percentage: number | null) => {
    if (status === 'not_started') {
      return <Badge variant="outline" className="text-xs">Not Started</Badge>;
    }
    if (status === 'in_progress') {
      return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">In Progress</Badge>;
    }
    if (status === 'submitted') {
      return <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">Submitted</Badge>;
    }
    if (status === 'evaluated') {
      if (percentage !== null && typeof percentage === 'number') {
        const color = percentage >= 80 ? 'bg-green-50 text-green-700 border-green-200' :
                     percentage >= 60 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                     'bg-red-50 text-red-700 border-red-200';
        return <Badge variant="outline" className={`text-xs ${color}`}>{percentage.toFixed(1)}%</Badge>;
      } else {
        // Evaluated but no percentage - might be a data issue
        return <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">Evaluated</Badge>;
      }
    }
    return <Badge variant="outline" className="text-xs">-</Badge>;
  };

  const getScoreColor = (percentage: number | null) => {
    if (percentage === null) return 'text-gray-400';
    if (percentage >= 80) return 'text-green-600 font-semibold';
    if (percentage >= 60) return 'text-blue-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  const clearFilters = () => {
    setSelectedDepartment('all');
    setSelectedEvaluationPeriod('all');
  };

  const exportData = () => {
    // Create CSV data
    const headers = [
      'Employee Name',
      'Employee Code', 
      'Department',
      'Evaluation Period',
      'Q1 Score (%)',
      'Q1 Status',
      'Q2 Score (%)',
      'Q2 Status',
      'Q3 Score (%)',
      'Q3 Status',
      'Q4 Score (%)',
      'Q4 Status',
      'Annual Average (%)',
      'Completed Quarters'
    ];

    const csvData = matrixData.map(row => [
      row.employeeName,
      row.employeeCode,
      row.department,
      row.evaluationPeriod,
      row.q1Percentage?.toFixed(1) || '-',
      row.q1Status,
      row.q2Percentage?.toFixed(1) || '-',
      row.q2Status,
      row.q3Percentage?.toFixed(1) || '-',
      row.q3Status,
      row.q4Percentage?.toFixed(1) || '-',
      row.q4Status,
      row.annualAverage?.toFixed(1) || '-',
      row.completedQuarters
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const filename = isTeamContext 
      ? `team-kra-comparison-matrix-${new Date().toISOString().split('T')[0]}.csv`
      : `kra-comparison-matrix-${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    const message = isTeamContext 
      ? 'Team KRA comparison matrix exported successfully!'
      : 'KRA comparison matrix exported successfully!';
    toast.success(message);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-96">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            {isTeamContext ? 'Team KRA Quarterly Comparison Matrix' : 'KRA Quarterly Comparison Matrix'}
          </h2>
          <p className="text-muted-foreground">
            {isTeamContext 
              ? 'Compare quarterly KRA performance across your team members' 
              : 'Compare quarterly KRA performance across employees and evaluation periods'
            }
          </p>
        </div>
        <Button onClick={exportData} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              {isTeamContext ? 'Team Members' : 'Employees'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalEmployees}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Q1 Avg</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(summaryStats.avgQ1)}`}>
              {summaryStats.avgQ1 > 0 ? `${summaryStats.avgQ1}%` : '-'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Q2 Avg</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(summaryStats.avgQ2)}`}>
              {summaryStats.avgQ2 > 0 ? `${summaryStats.avgQ2}%` : '-'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Q3 Avg</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(summaryStats.avgQ3)}`}>
              {summaryStats.avgQ3 > 0 ? `${summaryStats.avgQ3}%` : '-'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Q4 Avg</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(summaryStats.avgQ4)}`}>
              {summaryStats.avgQ4 > 0 ? `${summaryStats.avgQ4}%` : '-'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.completionRate}%</div>
          </CardContent>
        </Card>
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
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Department</label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Evaluation Period</label>
              <Select value={selectedEvaluationPeriod} onValueChange={setSelectedEvaluationPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select evaluation period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Periods</SelectItem>
                  {evaluationPeriods.map((period) => (
                    <SelectItem key={period.key} value={period.key}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Matrix Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {isTeamContext ? 'Team Quarterly Performance Matrix' : 'Quarterly Performance Matrix'}
          </CardTitle>
          <CardDescription>
            {isTeamContext 
              ? 'Quarterly scores and status for each team member across evaluation periods'
              : 'Quarterly scores and status for each employee across evaluation periods'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {matrixData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
              <p>
                {isTeamContext 
                  ? 'No team KRA assignments found matching the selected filters.'
                  : 'No KRA assignments found matching the selected filters.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Employee</TableHead>
                    <TableHead className="min-w-[120px]">Department</TableHead>
                    <TableHead className="min-w-[200px]">Evaluation Period</TableHead>
                    <TableHead className="text-center min-w-[100px]">Q1</TableHead>
                    <TableHead className="text-center min-w-[100px]">Q2</TableHead>
                    <TableHead className="text-center min-w-[100px]">Q3</TableHead>
                    <TableHead className="text-center min-w-[100px]">Q4</TableHead>
                    <TableHead className="text-center min-w-[120px]">Annual Avg</TableHead>
                    <TableHead className="text-center min-w-[100px]">Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrixData.map((row, index) => (
                    <TableRow key={`${row.employeeId}-${row.evaluationPeriodStart}-${index}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{row.employeeName}</div>
                          <div className="text-sm text-muted-foreground">{row.employeeCode}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {row.department}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{row.templateName}</div>
                          <div className="text-muted-foreground">{row.evaluationPeriod}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(row.q1Status, row.q1Percentage)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(row.q2Status, row.q2Percentage)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(row.q3Status, row.q3Percentage)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(row.q4Status, row.q4Percentage)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={getScoreColor(row.annualAverage)}>
                          {row.annualAverage ? `${row.annualAverage.toFixed(1)}%` : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {row.completedQuarters}/4
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
