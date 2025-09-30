import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePayrollData, useEmployeePayrollDetails, useGeneratePayslips, useUpdatePayrollData } from '@/hooks/useFinance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Banknote,
  Search,
  Filter,
  Download,
  Eye,
  Calendar as CalendarIcon,
  DollarSign,
  Building,
  Clock,
  User,
  Mail,
  Send,
  CheckCircle,
  AlertTriangle,
  Calculator,
  FileText,
  TrendingUp,
  Edit
} from 'lucide-react';
import { format } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';

const payrollEditSchema = z.object({
  basic_salary: z.number().min(0, 'Basic salary must be positive'),
  allowances: z.number().min(0, 'Allowances must be positive'),
  deductions: z.number().min(0, 'Deductions must be positive'),
  bonus: z.number().min(0, 'Bonus must be positive'),
  overtime_hours: z.number().min(0, 'Overtime hours must be positive'),
  adjustment_reason: z.string().optional(),
});

type PayrollEditFormData = z.infer<typeof payrollEditSchema>;

export function AllPayroll() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [shouldFetch, setShouldFetch] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const { data: payrollData, isLoading: payrollLoading, refetch } = usePayrollData(selectedMonth, selectedYear);
  const { data: employeeDetails, isLoading: detailsLoading } = useEmployeePayrollDetails(
    selectedEmployeeId, 
    selectedMonth, 
    selectedYear
  );
  const generatePayslips = useGeneratePayslips();
  const updatePayrollData = useUpdatePayrollData();

  const editForm = useForm<PayrollEditFormData>({
    resolver: zodResolver(payrollEditSchema),
    defaultValues: {
      basic_salary: 0,
      allowances: 0,
      deductions: 0,
      bonus: 0,
      overtime_hours: 0,
      adjustment_reason: '',
    },
  });

  const handleGeneratePayroll = () => {
    // Always fetch the latest data for the selected period
    setShouldFetch(true);
    refetch();
  };

  const handleGeneratePayslips = () => {
    generatePayslips.mutate({
      month: selectedMonth,
      year: selectedYear
    });
  };

  const handleEditPayroll = (employee: any) => {
    setEditingEmployee(employee);
    editForm.reset({
      basic_salary: employee.payroll.basicSalary || 0,
      allowances: employee.payroll.allowances || 0,
      deductions: employee.payroll.totalDeductions || 0,
      bonus: 0,
      overtime_hours: employee.attendance?.[0]?.overtime_hours || 0,
      adjustment_reason: '',
    });
    setIsEditDialogOpen(true);
  };

  const onPayrollEditSubmit = async (data: PayrollEditFormData) => {
    if (!editingEmployee) return;

    updatePayrollData.mutate({
      userId: editingEmployee.id,
      month: selectedMonth,
      year: selectedYear,
      adjustments: data
    }, {
      onSuccess: () => {
        setIsEditDialogOpen(false);
        setEditingEmployee(null);
        editForm.reset();
        refetch(); // Refresh the payroll data
      }
    });
  };

  const filteredPayrollData = payrollData?.filter(employee => {
    const matchesSearch = employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = !departmentFilter || departmentFilter === 'all' || employee.department?.name === departmentFilter;
    
    return matchesSearch && matchesDepartment;
  });

  const departments = [...new Set(payrollData?.map(emp => emp.department?.name).filter(Boolean))];

  const handleDownloadPayroll = () => {
    if (!filteredPayrollData) return;
    
    // Create CSV content
    const headers = [
      'Employee ID', 'Employee Name', 'Department', 'Base Salary', 'Monthly Salary', 
      'Gross Pay', 'Tax Deduction', 'PF Deduction', 'Total Deductions', 'Net Pay',
      'Total Working Days', 'Days Worked', 'Days on Leave', 'Attendance %'
    ];
    const csvContent = [
      headers.join(','),
      ...filteredPayrollData.map(employee => [
        employee.employee_id || '',
        `"${employee.full_name}"`,
        `"${employee.department?.name || ''}"`,
        employee.payroll.baseSalary,
        employee.payroll.monthlySalary.toFixed(2),
        employee.payroll.grossPay.toFixed(2),
        employee.payroll.taxDeduction.toFixed(2),
        employee.payroll.pfDeduction.toFixed(2),
        employee.payroll.totalDeductions.toFixed(2),
        employee.payroll.netPay.toFixed(2),
        employee.payroll.totalWorkingDays,
        employee.payroll.daysWorked,
        employee.payroll.daysOnLeave,
        employee.payroll.attendanceRatio.toFixed(1)
      ].join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_${selectedYear}_${selectedMonth.toString().padStart(2, '0')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const totalGrossPay = filteredPayrollData?.reduce((sum, emp) => sum + emp.payroll.grossPay, 0) || 0;
  const totalNetPay = filteredPayrollData?.reduce((sum, emp) => sum + emp.payroll.netPay, 0) || 0;
  const totalDeductions = filteredPayrollData?.reduce((sum, emp) => sum + emp.payroll.totalDeductions, 0) || 0;
  const avgAttendance = filteredPayrollData?.reduce((sum, emp) => sum + emp.payroll.attendanceRatio, 0) / (filteredPayrollData?.length || 1) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll Management</h1>
          <p className="text-muted-foreground">
            Manage employee payroll and generate payslips
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1">
            {format(new Date(selectedYear, selectedMonth - 1), 'MMMM yyyy')}
          </Badge>
        </div>
      </div>

      {/* Payroll Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredPayrollData?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Active employees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Gross Payroll</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalGrossPay.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Before deductions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Net Payroll</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalNetPay.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">After deductions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgAttendance.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Generate Payroll Report
          </CardTitle>
          <CardDescription>
            Select month and year to generate payroll data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div>
              <Select value={selectedMonth.toString()} onValueChange={(value) => {
                setSelectedMonth(parseInt(value));
                setShouldFetch(false); // Reset fetch state when month changes
              }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {format(new Date(2024, i, 1), 'MMMM')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={selectedYear.toString()} onValueChange={(value) => {
                setSelectedYear(parseInt(value));
                setShouldFetch(false); // Reset fetch state when year changes
              }}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGeneratePayroll} disabled={payrollLoading}>
              <Calculator className="h-4 w-4 mr-2" />
              {payrollLoading ? 'Generating...' : 'Generate Latest Report'}
            </Button>
            {payrollData && (
              <div className="flex gap-2">
                <Button onClick={handleDownloadPayroll} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button 
                  onClick={handleGeneratePayslips} 
                  disabled={generatePayslips.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {generatePayslips.isPending ? 'Generating...' : 'Generate & Email Payslips'}
                </Button>
              </div>
            )}
          </div>

          {/* Filters */}
          {payrollData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <Input
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm('');
                    setDepartmentFilter('');
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}

          {payrollLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : payrollData && payrollData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Monthly Pay</TableHead>
                  <TableHead>Days Worked</TableHead>
                  <TableHead>Expected Days</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayrollData?.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={employee.avatar_url} />
                          <AvatarFallback>{employee.full_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{employee.full_name}</div>
                          <div className="text-sm text-muted-foreground">{employee.employee_id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        {employee.department?.name || 'Not assigned'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">${employee.payroll.monthlySalary.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Base monthly</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-green-600">
                        {employee.payroll.effectiveDaysWorked}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {employee.payroll.totalWorkingDays}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={employee.payroll.attendanceRatio} className="w-16 h-2" />
                        <span className="text-sm">{employee.payroll.attendanceRatio.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">${employee.payroll.netPay.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">After deductions</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            asChild={false}
                            onClick={() => setSelectedEmployeeId(employee.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Payroll Details - {employee.full_name}</DialogTitle>
                            <DialogDescription>
                              Complete salary breakdown for {format(new Date(selectedYear, selectedMonth - 1), 'MMMM yyyy')}
                            </DialogDescription>
                          </DialogHeader>
                          {detailsLoading ? (
                            <LoadingSpinner size="sm" />
                          ) : employeeDetails && (
                            <Tabs defaultValue="breakdown" className="space-y-4">
                              <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="breakdown">Salary Breakdown</TabsTrigger>
                                <TabsTrigger value="attendance">Attendance Details</TabsTrigger>
                                <TabsTrigger value="leaves">Leave Records</TabsTrigger>
                              </TabsList>

                              <TabsContent value="breakdown" className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* Earnings */}
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-lg flex items-center gap-2">
                                        <TrendingUp className="h-5 w-5 text-green-600" />
                                        Earnings
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                      <div className="flex justify-between">
                                        <span>Basic Salary</span>
                                        <span className="font-medium">${employeeDetails.payrollDetails.basicSalary.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>HRA (30%)</span>
                                        <span className="font-medium">${employeeDetails.payrollDetails.hra.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Allowances</span>
                                        <span className="font-medium">${employeeDetails.payrollDetails.allowances.toLocaleString()}</span>
                                      </div>
                                      <div className="border-t pt-2">
                                        <div className="flex justify-between font-semibold">
                                          <span>Gross Pay</span>
                                          <span>${employeeDetails.payrollDetails.grossPay.toLocaleString()}</span>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>

                                  {/* Deductions */}
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-lg flex items-center gap-2">
                                        <Calculator className="h-5 w-5 text-red-600" />
                                        Deductions
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                      <div className="flex justify-between">
                                        <span>Income Tax (10%)</span>
                                        <span className="font-medium">${employeeDetails.payrollDetails.taxDeduction.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Provident Fund (12%)</span>
                                        <span className="font-medium">${employeeDetails.payrollDetails.pfDeduction.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>ESI (0.75%)</span>
                                        <span className="font-medium">${employeeDetails.payrollDetails.esiDeduction.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Professional Tax</span>
                                        <span className="font-medium">${employeeDetails.payrollDetails.professionalTax}</span>
                                      </div>
                                      <div className="border-t pt-2">
                                        <div className="flex justify-between font-semibold">
                                          <span>Total Deductions</span>
                                          <span>${employeeDetails.payrollDetails.totalDeductions.toLocaleString()}</span>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>

                                {/* Net Pay Summary */}
                                <Card className="bg-green-50 border-green-200">
                                  <CardContent className="pt-6">
                                    <div className="text-center">
                                      <div className="text-3xl font-bold text-green-600 mb-2">
                                        ${employeeDetails.payrollDetails.netPay.toLocaleString()}
                                      </div>
                                      <p className="text-green-700 font-medium">Net Pay (In-Hand Salary)</p>
                                      <p className="text-sm text-green-600 mt-1">
                                        Based on {employeeDetails.payrollDetails.attendanceRatio.toFixed(1)}% attendance
                                      </p>
                                    </div>
                                  </CardContent>
                                </Card>
                              </TabsContent>

                              <TabsContent value="attendance" className="space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  <Card>
                                    <CardContent className="pt-6 text-center">
                                      <div className="text-2xl font-bold">{employeeDetails.payrollDetails.totalWorkingDays}</div>
                                      <p className="text-sm text-muted-foreground">Total Working Days</p>
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardContent className="pt-6 text-center">
                                      <div className="text-2xl font-bold text-green-600">{employeeDetails.payrollDetails.daysWorked}</div>
                                      <p className="text-sm text-muted-foreground">Days Present</p>
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardContent className="pt-6 text-center">
                                      <div className="text-2xl font-bold text-blue-600">{employeeDetails.payrollDetails.daysOnLeave}</div>
                                      <p className="text-sm text-muted-foreground">Days on Leave</p>
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardContent className="pt-6 text-center">
                                      <div className="text-2xl font-bold text-red-600">{employeeDetails.payrollDetails.daysAbsent}</div>
                                      <p className="text-sm text-muted-foreground">Days Absent</p>
                                    </CardContent>
                                  </Card>
                                </div>

                                <Card>
                                  <CardHeader>
                                    <CardTitle>Attendance Summary</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-3">
                                      <div>
                                        <div className="flex justify-between text-sm mb-1">
                                          <span>Attendance Rate</span>
                                          <span>{employeeDetails.payrollDetails.attendanceRatio.toFixed(1)}%</span>
                                        </div>
                                        <Progress value={employeeDetails.payrollDetails.attendanceRatio} />
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        <p>Effective working days: {employeeDetails.payrollDetails.effectiveDaysWorked} (including approved leaves)</p>
                                        <p>Salary calculation is based on effective working days</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </TabsContent>

                              <TabsContent value="leaves" className="space-y-4">
                                {employeeDetails.payrollDetails.leaveApplications.length > 0 ? (
                                  <Card>
                                    <CardHeader>
                                      <CardTitle>Approved Leaves This Month</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-3">
                                        {employeeDetails.payrollDetails.leaveApplications.map((leave: any) => (
                                          <div key={leave.id} className="flex items-center justify-between p-3 border rounded-lg">
                                            <div>
                                              <p className="text-sm font-medium">{leave.leave_type?.name}</p>
                                              <p className="text-xs text-muted-foreground">
                                                {format(new Date(leave.start_date), 'MMM dd')} - {format(new Date(leave.end_date), 'MMM dd')}
                                              </p>
                                            </div>
                                            <Badge variant="outline" className="text-blue-600">
                                              {leave.days_count} days
                                            </Badge>
                                          </div>
                                        ))}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ) : (
                                  <Card>
                                    <CardContent className="text-center py-8">
                                      <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                      <p className="text-muted-foreground">No approved leaves this month</p>
                                    </CardContent>
                                  </Card>
                                )}
                              </TabsContent>
                            </Tabs>
                          )}
                        </DialogContent>
                      </Dialog>
                      <Button 
                        size="sm" 
                        variant="outline"
                        asChild={false}
                        onClick={() => handleEditPayroll(employee)}
                        className="ml-2"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : shouldFetch ? (
            <p className="text-center text-muted-foreground py-8">
              No payroll data found for the selected period
            </p>
          ) : (
            <div className="text-center py-12">
              <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Generate Payroll Report</h3>
              <p className="text-muted-foreground">
                Select a month and year, then click "Generate Report" to view payroll data
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Payroll Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Payroll Data</DialogTitle>
            <DialogDescription>
              Make adjustments to {editingEmployee?.full_name}'s payroll for {format(new Date(selectedYear, selectedMonth - 1), 'MMMM yyyy')}
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onPayrollEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="basic_salary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Basic Salary</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="allowances"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Allowances</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="deductions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Deductions</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="bonus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bonus/Incentive</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="overtime_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overtime Hours</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.5"
                        placeholder="0" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="adjustment_reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Adjustment</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Explain why this payroll adjustment is needed..."
                        {...field}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800">Important Notice</p>
                    <p className="text-yellow-700">
                      Payroll adjustments will be logged for audit purposes. Ensure all changes are justified and documented.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingEmployee(null);
                    editForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updatePayrollData.isPending}>
                  {updatePayrollData.isPending ? 'Saving...' : 'Save Adjustments'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}