import { useState } from 'react';
import { useAllEmployeesAttendance, useEmployeeDaywiseAttendance } from '@/hooks/useEmployees';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Calendar,
  Download,
  BarChart3,
  Clock,
  Eye
} from 'lucide-react';
import { formatDateForDisplay, getCurrentISTDate } from '@/utils/dateUtils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function AttendanceReports() {
  const [attendanceYear, setAttendanceYear] = useState(getCurrentISTDate().getFullYear());
  const [attendanceMonth, setAttendanceMonth] = useState<number | undefined>(undefined);
  const [shouldFetch, setShouldFetch] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string; month: number; year: number } | null>(null);
  const [isDaywiseModalOpen, setIsDaywiseModalOpen] = useState(false);
  
  const { data: attendanceData, isLoading: attendanceLoading, refetch } = useAllEmployeesAttendance(
    attendanceYear, 
    attendanceMonth
  );

  const { data: daywiseData, isLoading: daywiseLoading, refetch: refetchDaywise } = useEmployeeDaywiseAttendance(
    selectedEmployee?.id || '',
    selectedEmployee?.year || attendanceYear,
    selectedEmployee?.month || 1
  );

  const handleGenerateReport = () => {
    console.log('Generating attendance report for:', { year: attendanceYear, month: attendanceMonth });
    setShouldFetch(true);
    refetch();
  };

  const handleViewDaywise = (employeeId: string, employeeName: string, month: number, year: number) => {
    console.log(`Viewing daywise for employee ${employeeName} (${employeeId}) for ${month}/${year}`);
    setSelectedEmployee({ id: employeeId, name: employeeName, month, year });
    setIsDaywiseModalOpen(true);
    // Trigger the daywise data fetch
    setTimeout(() => {
      refetchDaywise();
    }, 100);
  };

  const handleDownloadAttendance = () => {
    if (!attendanceData) return;
    
    // Create CSV content with proper escaping
    const headers = ['Employee ID', 'Employee Name', 'Department', 'Month', 'Year', 'Working Days', 'Present Days', 'Absent Days', 'Leave Days', 'Total Hours', 'Overtime Hours'];
    const csvContent = [
      headers.join(','),
      ...attendanceData.map(record => [
        `"${record.user?.employee_id || ''}"`,
        `"${record.user?.full_name || ''}"`,
        `"${record.user?.department?.name || ''}"`,
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
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Create more descriptive filename
    const monthName = attendanceMonth ? formatDateForDisplay(new Date(attendanceYear, attendanceMonth - 1, 1), 'MMMM') : 'All_Months';
    a.download = `attendance_report_${attendanceYear}_${monthName}.csv`;
    
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
            Select time period and generate comprehensive attendance reports based on time tracking data from the second database.
            <br />
            <span className="text-xs text-muted-foreground">
              Hours are allocated to the day when the time tracker was started (accounts for night shifts).
            </span>
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
              <Select value={attendanceMonth?.toString() || 'all'} onValueChange={(value) => setAttendanceMonth(value === 'all' ? undefined : parseInt(value))}>
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
                Download CSV
              </Button>
            )}
          </div>

          {attendanceLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
              <span className="ml-3 text-muted-foreground">Generating attendance report from time tracking data...</span>
            </div>
          ) : attendanceData && attendanceData.length > 0 ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{attendanceData.length}</div>
                    <div className="text-sm text-muted-foreground">Total Records</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {attendanceData.reduce((sum, record) => sum + record.days_present, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Present Days</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-red-600">
                      {attendanceData.reduce((sum, record) => sum + record.days_absent, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Absent Days</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round(attendanceData.reduce((sum, record) => sum + record.total_hours_worked, 0))}h
                    </div>
                    <div className="text-sm text-muted-foreground">Total Hours Worked</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-orange-600">
                      {Math.round(attendanceData.reduce((sum, record) => sum + record.overtime_hours, 0))}h
                    </div>
                    <div className="text-sm text-muted-foreground">Total Overtime</div>
                  </CardContent>
                </Card>
              </div>

              {/* Attendance Table */}
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
                  <TableHead>Actions</TableHead>
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
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDaywise(
                          record.user_id,
                          record.user?.full_name || 'Unknown',
                          record.month,
                          record.year
                        )}
                        className="h-8 w-8 p-0"
                        title="View daywise attendance details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
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

      {/* Daywise Attendance Modal */}
      <Dialog open={isDaywiseModalOpen} onOpenChange={setIsDaywiseModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Daywise Attendance - {selectedEmployee?.name}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDaywiseModalOpen(false)}
              >
                Close
              </Button>
            </DialogTitle>
            <DialogDescription>
              Daily attendance details for {selectedEmployee && daywiseData ? `${daywiseData.monthName} ${daywiseData.year}` : ''}
              <br />
              <span className="text-xs text-muted-foreground">
                Note: Hours are allocated to the day when the time tracker was started (important for night shifts)
              </span>
            </DialogDescription>
          </DialogHeader>
          
          {daywiseLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
              <span className="ml-3 text-muted-foreground">Loading daywise attendance...</span>
            </div>
          ) : daywiseData ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-600">{daywiseData.summary.daysPresent}</div>
                    <div className="text-sm text-muted-foreground">Days Present</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-red-600">{daywiseData.summary.daysAbsent}</div>
                    <div className="text-sm text-muted-foreground">Days Absent</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-purple-600">{daywiseData.daywiseData.filter(d => d.status === 'Holiday').length}</div>
                    <div className="text-sm text-muted-foreground">Holidays</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-blue-600">{daywiseData.summary.totalHours}h</div>
                    <div className="text-sm text-muted-foreground">Total Hours</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-orange-600">{daywiseData.summary.averageHoursPerDay}h</div>
                    <div className="text-sm text-muted-foreground">Avg Hours/Day</div>
                  </CardContent>
                </Card>
              </div>

              {/* Daywise Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hours Worked</TableHead>
                    <TableHead>Time Entries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {daywiseData.daywiseData.map((day) => (
                    <TableRow key={day.date}>
                      <TableCell>
                        <div className="font-medium">{formatDateForDisplay(new Date(day.date), 'MMM dd, yyyy')}</div>
                      </TableCell>
                      <TableCell>
                        <div className={`font-medium ${day.isWeekend ? 'text-muted-foreground' : ''}`}>
                          {day.dayName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={
                            day.status === 'Present' ? 'text-green-600 border-green-200' :
                            day.status === 'Absent' ? 'text-red-600 border-red-200' :
                            day.status === 'Holiday' ? 'text-purple-600 border-purple-200' :
                            'text-gray-600 border-gray-200'
                          }
                          title={day.status === 'Holiday' && day.holiday ? day.holiday.name : undefined}
                        >
                          {day.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{day.hoursWorked}h</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {day.timeEntries.length > 0 ? (
                            day.timeEntries.map((entry: any) => (
                              <div key={entry.id} className="text-sm">
                                <span className="text-muted-foreground">
                                  Started: {formatDateForDisplay(new Date(entry.startTime), 'HH:mm')} - {entry.formattedDuration}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">No entries</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
              <p className="text-muted-foreground">
                Unable to load daywise attendance data for this employee
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}