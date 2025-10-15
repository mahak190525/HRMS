import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  History,
  Filter,
  Download,
  DollarSign,
  Edit,
  Plus,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { formatDateForDisplay, getCurrentISTDate } from '@/utils/dateUtils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { usePayrollLogs } from '@/hooks/useFinance';

export function PayrollLogs() {
  // Removed unused user variable
  const { data: payrollLogs, isLoading: logsLoading } = usePayrollLogs();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  const filteredLogs = payrollLogs?.filter(log => {
    const matchesSearch = log.employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.adjusted_by_user.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Determine action type based on adjustment fields
    let actionType = 'adjustment';
    if (log.bonus_amount > 0) actionType = 'bonus';
    else if (log.deductions_adjustment > 0) actionType = 'deduction';
    else if (log.overtime_hours > 0) actionType = 'overtime';
    
    const matchesAction = !actionFilter || actionFilter === 'all' || actionType === actionFilter;
    const matchesMonth = !monthFilter || monthFilter === 'all' || log.month.toString() === monthFilter;
    const matchesYear = !yearFilter || yearFilter === 'all' || log.year.toString() === yearFilter;
    
    return matchesSearch && matchesAction && matchesMonth && matchesYear;
  }) || [];

  const handleDownloadLogs = () => {
    if (!filteredLogs) return;
    
    // Create CSV content
    const headers = ['Date', 'Employee', 'Employee ID', 'Action Type', 'Field Changed', 'Old Value', 'New Value', 'Reason', 'Adjusted By'];
    const csvContent = [
      headers.join(','),
      ...filteredLogs.map(log => [
        formatDateForDisplay(log.adjusted_at, 'yyyy-MM-dd HH:mm:ss'),
        `"${log.employee.full_name}"`,
        log.employee.employee_id,
        'adjustment',
        'multiple_fields',
        '',
        '',
        `"${log.adjustment_reason || ''}"`,
        `"${log.adjusted_by_user.full_name}"`
      ].join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_logs_${formatDateForDisplay(getCurrentISTDate(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getActionBadge = (log: any) => {
    let action = 'adjustment';
    if (log.bonus_amount > 0) action = 'bonus';
    else if (log.deductions_adjustment > 0) action = 'deduction';
    else if (log.overtime_hours > 0) action = 'overtime';
    
    const variants = {
      adjustment: 'bg-blue-100 text-blue-800',
      bonus: 'bg-green-100 text-green-800',
      deduction: 'bg-red-100 text-red-800',
      overtime: 'bg-purple-100 text-purple-800',
      payslip_generated: 'bg-gray-100 text-gray-800',
    };
    return variants[action as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getActionIcon = (log: any) => {
    let action = 'adjustment';
    if (log.bonus_amount > 0) action = 'bonus';
    else if (log.deductions_adjustment > 0) action = 'deduction';
    else if (log.overtime_hours > 0) action = 'overtime';
    
    switch (action) {
      case 'adjustment':
        return <Edit className="h-4 w-4 text-blue-600" />;
      case 'bonus':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'deduction':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'overtime':
        return <DollarSign className="h-4 w-4 text-purple-600" />;
      case 'payslip_generated':
        return <CheckCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <History className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll Logs</h1>
          <p className="text-muted-foreground">
            Track all payroll adjustments, bonuses, and payslip generation activities
          </p>
        </div>
        <Button onClick={handleDownloadLogs} variant="outline" disabled={!filteredLogs?.length}>
          <Download className="h-4 w-4 mr-2" />
          Export Logs
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Adjustments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payrollLogs?.filter(l => l.basic_salary_adjustment !== 0).length || 0}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Bonuses Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payrollLogs?.filter(l => l.bonus_amount > 0).length || 0}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Deductions Applied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payrollLogs?.filter(l => l.deductions_adjustment > 0).length || 0}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Payslips Generated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">This month</p>
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="adjustment">Adjustments</SelectItem>
                  <SelectItem value="bonus">Bonuses</SelectItem>
                  <SelectItem value="deduction">Deductions</SelectItem>
                  <SelectItem value="overtime">Overtime</SelectItem>
                  <SelectItem value="payslip_generated">Payslip Generated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger>
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
            <div>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setActionFilter('');
                  setMonthFilter('');
                  setYearFilter('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Activity Logs</CardTitle>
          <CardDescription>
            Complete audit trail of all payroll changes and activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <LoadingSpinner size="sm" />
          ) : filteredLogs && filteredLogs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Field Changed</TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Adjusted By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="text-sm">
                        {formatDateForDisplay(log.adjusted_at || log.created_at, 'MMM dd, yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateForDisplay(log.adjusted_at || log.created_at, 'HH:mm:ss')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {log.employee?.full_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{log.employee?.full_name}</div>
                          <div className="text-xs text-muted-foreground">{log.employee?.employee_id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log)}
                        <Badge className={getActionBadge(log)}>
                          Adjustment
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono">
                        Multiple fields
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        {log.basic_salary_adjustment !== 0 && (
                          <div className="text-blue-600">Salary: ${log.basic_salary_adjustment}</div>
                        )}
                        {log.bonus_amount > 0 && (
                          <div className="text-green-600">Bonus: +${log.bonus_amount}</div>
                        )}
                        {log.deductions_adjustment > 0 && (
                          <div className="text-red-600">Deduction: -${log.deductions_adjustment}</div>
                        )}
                        {log.overtime_hours > 0 && (
                          <div className="text-purple-600">Overtime: {log.overtime_hours}h</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {log.adjustment_reason || 'No reason provided'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-xs">
                            {log.adjusted_by_user?.full_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{log.adjusted_by_user?.full_name}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Logs Found</h3>
              <p className="text-muted-foreground">
                {searchTerm || actionFilter || monthFilter || yearFilter
                  ? 'No logs match your current filters.'
                  : 'No payroll activity logs available yet.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}