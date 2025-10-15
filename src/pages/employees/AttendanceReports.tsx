import { useState } from 'react';
import { useAllEmployeesAttendance } from '@/hooks/useEmployees';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar,
  Download,
  BarChart3,
  Clock
} from 'lucide-react';
import { formatDateForDisplay, getCurrentISTDate } from '@/utils/dateUtils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function AttendanceReports() {
  const [attendanceYear, setAttendanceYear] = useState(getCurrentISTDate().getFullYear());
  const [attendanceMonth, setAttendanceMonth] = useState<number | undefined>(undefined);
  const [shouldFetch, setShouldFetch] = useState(false);
  
  const { data: attendanceData, isLoading: attendanceLoading, refetch } = useAllEmployeesAttendance(
    attendanceYear, 
    attendanceMonth
  );

  const handleGenerateReport = () => {
    setShouldFetch(true);
    refetch();
  };

  const handleDownloadAttendance = () => {
    if (!attendanceData) return;
    
    // Create CSV content
    const headers = ['Employee ID', 'Employee Name', 'Department', 'Month', 'Year', 'Working Days', 'Present Days', 'Absent Days', 'Leave Days', 'Total Hours', 'Overtime Hours'];
    const csvContent = [
      headers.join(','),
      ...attendanceData.map(record => [
        record.user?.employee_id || '',
        record.user?.full_name || '',
        record.user?.department?.name || '',
        record.month,
        record.year,
        record.total_working_days,
        record.days_present,
        record.days_absent,
        record.days_on_leave,
        record.total_hours_worked,
        record.overtime_hours
      ].join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_report_${attendanceYear}${attendanceMonth ? `_${attendanceMonth}` : ''}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance Reports</h1>
        <p className="text-muted-foreground">
          Generate and download attendance reports for all employees
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Generate Attendance Report
          </CardTitle>
          <CardDescription>
            Select time period and generate comprehensive attendance reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div>
              <Select value={attendanceYear.toString()} onValueChange={(value) => setAttendanceYear(parseInt(value))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={attendanceMonth?.toString() || ''} onValueChange={(value) => setAttendanceMonth(value ? parseInt(value) : undefined)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {formatDateForDisplay(new Date(2024, i, 1), 'MMMM')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerateReport} disabled={attendanceLoading}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
            {attendanceData && (
              <Button onClick={handleDownloadAttendance} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Excel
              </Button>
            )}
          </div>

          {attendanceLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : attendanceData && attendanceData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Month/Year</TableHead>
                  <TableHead>Working Days</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead>Leave</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead>Overtime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceData.map((record) => (
                  <TableRow key={`${record.user_id}-${record.month}-${record.year}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{record.user?.full_name}</div>
                        <div className="text-sm text-muted-foreground">{record.user?.employee_id}</div>
                      </div>
                    </TableCell>
                    <TableCell>{record.user?.department?.name}</TableCell>
                    <TableCell>{formatDateForDisplay(new Date(record.year, record.month - 1, 1), 'MMM yyyy')}</TableCell>
                    <TableCell>{record.total_working_days}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-green-600">
                        {record.days_present}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-red-600">
                        {record.days_absent}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-blue-600">
                        {record.days_on_leave}
                      </Badge>
                    </TableCell>
                    <TableCell>{record.total_hours_worked}h</TableCell>
                    <TableCell>{record.overtime_hours}h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : shouldFetch ? (
            <p className="text-center text-muted-foreground py-8">
              No attendance data found for the selected period
            </p>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Generate Attendance Report</h3>
              <p className="text-muted-foreground">
                Select a time period and click "Generate Report" to view attendance data
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}