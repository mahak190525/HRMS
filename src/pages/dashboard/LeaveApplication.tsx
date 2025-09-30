import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLeaveTypes, useLeaveBalance, useLeaveApplications, useCreateLeaveApplication, useEmployeesOnLeave, useUserLeaveSummary, useRecalculateUserBalance, useWithdrawLeaveApplication } from '@/hooks/useLeave';
import { useSandwichLeavePreview, useRelatedFridayMondayApplications } from '@/hooks/useSandwichLeave';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Users,
  RefreshCw,
  Calculator,
  RotateCcw
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { useUpcomingHolidays } from '@/hooks/useDashboard';
import { useLocation } from 'react-router-dom';
import { formatDateForDatabase, isPastDate } from '@/utils/dateUtils';

const leaveTypeColors = {
  annual: 'bg-blue-500',
  sick: 'bg-red-500',
  casual: 'bg-green-500',
  maternity: 'bg-purple-500',
  paternity: 'bg-orange-500',
  emergency: 'bg-yellow-500',
};

export function LeaveApplication() {
  const { user } = useAuth();
  const location = useLocation();
  const { data: leaveTypes, isLoading: typesLoading } = useLeaveTypes();
  const { data: leaveBalance, isLoading: balanceLoading } = useLeaveBalance();
  const { data: leaveHistory, isLoading: historyLoading } = useLeaveApplications();
  const { data: holidays, isLoading: holidaysLoading } = useUpcomingHolidays();
  const { data: employeesOnLeave, isLoading: onLeaveLoading } = useEmployeesOnLeave();
  const { data: leaveSummary, isLoading: summaryLoading } = useUserLeaveSummary();
  const createLeaveApplication = useCreateLeaveApplication();
  const recalculateBalance = useRecalculateUserBalance();
  const withdrawLeaveApplication = useWithdrawLeaveApplication();
  const sandwichLeavePreview = useSandwichLeavePreview();
  const relatedApplications = useRelatedFridayMondayApplications();
  
  const [selectedType, setSelectedType] = useState('');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState('');
  const [defaultTab, setDefaultTab] = useState('apply');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<'1st_half' | '2nd_half'>('1st_half');
  
  // Withdraw dialog state
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [selectedLeaveForWithdraw, setSelectedLeaveForWithdraw] = useState<any>(null);
  const [withdrawalReason, setWithdrawalReason] = useState('');
  const [sandwichCalculation, setSandwichCalculation] = useState<any>(null);
  const [relatedApps, setRelatedApps] = useState<any[]>([]);

  // Check if we should open history tab based on URL hash
  useEffect(() => {
    if (location.hash === '#history') {
      setDefaultTab('history');
    }
  }, [location.hash]);

  // Calculate sandwich leave preview when dates change
  useEffect(() => {
    if (startDate && endDate && user) {
      // Calculate sandwich leave preview
      sandwichLeavePreview.mutate({
        startDate: formatDateForDatabase(startDate),
        endDate: formatDateForDatabase(endDate),
        isHalfDay,
      }, {
        onSuccess: (data) => {
          setSandwichCalculation(data);
        },
        onError: (error) => {
          console.error('Failed to calculate sandwich leave:', error);
          setSandwichCalculation(null);
        }
      });

      // Check for related Friday/Monday applications
      relatedApplications.mutate({
        startDate: formatDateForDatabase(startDate),
        endDate: formatDateForDatabase(endDate),
      }, {
        onSuccess: (data) => {
          setRelatedApps(data);
        },
        onError: (error) => {
          console.error('Failed to find related applications:', error);
          setRelatedApps([]);
        }
      });
    } else {
      setSandwichCalculation(null);
      setRelatedApps([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, isHalfDay, user?.id]);

  const calculateDays = () => {
    if (isHalfDay) {
      return 0.5;
    }
    if (startDate && endDate) {
      return differenceInDays(endDate, startDate) + 1;
    }
    return 0;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'withdrawn':
        return <RotateCcw className="h-4 w-4 text-gray-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      withdrawn: 'bg-gray-100 text-gray-800',
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const handleWithdrawLeave = async () => {
    if (!selectedLeaveForWithdraw || !withdrawalReason.trim()) return;

    withdrawLeaveApplication.mutate({
      applicationId: selectedLeaveForWithdraw.id,
      reason: withdrawalReason.trim()
    }, {
      onSuccess: () => {
        setIsWithdrawDialogOpen(false);
        setSelectedLeaveForWithdraw(null);
        setWithdrawalReason('');
      }
    });
  };

  const canWithdrawLeave = (leave: any) => {
    // Only pending leaves can be withdrawn by employees
    // Approved leaves require manager/HR intervention
    if (leave.status !== 'pending') {
      return false;
    }
    
    // Check if the leave is in the future (can only withdraw future leaves) using IST
    return !isPastDate(leave.start_date);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !startDate || !endDate || !reason.trim() || !user) return;

    const leaveType = leaveTypes?.find(lt => lt.name.toLowerCase().replace(' ', '_') === selectedType);
    if (!leaveType) {
      toast.error('Invalid leave type selected');
      return;
    }

    const daysRequested = calculateDays();
    
    // Use enhanced balance information if available
    const remainingDays = leaveSummary?.success 
      ? leaveSummary.balance?.remaining_days || 0
      : totalLeaveBalance - usedLeave;
    
    // Check tenure and provide appropriate warnings only if leaveSummary is loaded
    if (leaveSummary?.success && leaveSummary?.user) {
      const tenureMonths = leaveSummary.user.tenure_months || 0;
      const isEligibleForPaidLeaves = leaveSummary.rules?.eligible_for_paid_leaves;
      
      // Warning for users with < 9 months tenure (all leave will be salary deduction)
      if (tenureMonths < 9 || !isEligibleForPaidLeaves) {
        const shouldProceed = window.confirm(
          `You have ${tenureMonths} months of tenure. Since your tenure is less than 9 months, ` +
          `ALL ${daysRequested} days will be deducted from your salary. ` +
          `Do you want to proceed with this unpaid leave application?`
        );
        if (!shouldProceed) return;
      }
      // Warning for users with paid leave balance but requesting more than available
      else if (daysRequested > remainingDays && remainingDays >= 0) {
        const excessDays = daysRequested - remainingDays;
        const shouldProceed = window.confirm(
          `This request uses your ${remainingDays} available paid leave days plus ${excessDays} additional days. ` +
          `The ${excessDays} excess days will be deducted from your salary. Do you want to proceed?`
        );
        if (!shouldProceed) return;
      }
      // For users with negative balance (already over their limit)
      else if (remainingDays < 0) {
        const shouldProceed = window.confirm(
          `Your leave balance is already negative (${remainingDays} days). ` +
          `All ${daysRequested} requested days will be deducted from your salary. Do you want to proceed?`
        );
        if (!shouldProceed) return;
      }
    }

    createLeaveApplication.mutate({
      user_id: user.id,
      leave_type_id: leaveType.id,
      start_date: formatDateForDatabase(isHalfDay ? startDate : startDate),
      end_date: formatDateForDatabase(isHalfDay ? startDate : endDate), // For half day, end date = start date
      days_count: daysRequested,
      is_half_day: isHalfDay,
      half_day_period: isHalfDay ? halfDayPeriod : undefined,
      reason: reason.trim(),
      status: 'pending'
    }, {
      onSuccess: () => {
        // Reset form
        setSelectedType('');
        setStartDate(undefined);
        setEndDate(undefined);
        setReason('');
        setIsHalfDay(false);
        setHalfDayPeriod('1st_half');
      }
    });
  };

  const totalLeaveBalance = leaveBalance?.reduce((sum, lb) => sum + lb.allocated_days, 0) || 0;
  const usedLeave = leaveBalance?.reduce((sum, lb) => sum + lb.used_days, 0) || 0;

  if (typesLoading || balanceLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leave Application</h1>
        <p className="text-muted-foreground">
          Manage your leave requests and view your leave balance
        </p>
      </div>

      <Tabs value={defaultTab} onValueChange={setDefaultTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="apply">Apply for Leave</TabsTrigger>
          <TabsTrigger value="balance">Leave Balance</TabsTrigger>
          <TabsTrigger value="history">Leave History</TabsTrigger>
        </TabsList>

        <TabsContent value="apply" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    New Leave Application
                  </CardTitle>
                  <CardDescription>
                    Submit a new leave request for approval
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <Label htmlFor="leaveType">Leave Type</Label>
                      <Select value={selectedType} onValueChange={setSelectedType}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select leave type" />
                        </SelectTrigger>
                        <SelectContent>
                          {leaveTypes?.map((type) => {
                            const typeKey = type.name.toLowerCase().replace(' ', '_');
                            return (
                            <SelectItem key={type.id} value={typeKey}>
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${leaveTypeColors[typeKey as keyof typeof leaveTypeColors] || 'bg-gray-500'}`} />
                                {type.name}
                              </div>
                            </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="halfDay" 
                          checked={isHalfDay}
                          onCheckedChange={(checked) => {
                            setIsHalfDay(checked as boolean);
                            // Reset end date when switching to half day
                            if (checked) {
                              setEndDate(startDate);
                            }
                          }}
                        />
                        <Label 
                          htmlFor="halfDay" 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Half Day Leave (0.5 days)
                        </Label>
                      </div>

                      {isHalfDay && (
                        <div className="ml-6 space-y-2">
                          <Label className="text-sm font-medium">Select Half Day Period</Label>
                          <Select value={halfDayPeriod} onValueChange={(value: '1st_half' | '2nd_half') => setHalfDayPeriod(value)}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1st_half">
                                <div className="flex flex-col">
                                  <span className="font-medium">1st Half</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="2nd_half">
                                <div className="flex flex-col">
                                  <span className="font-medium">2nd Half</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <div className={cn("grid gap-4", isHalfDay ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
                      <div>
                        <Label>{isHalfDay ? "Date" : "Start Date"}</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal mt-1",
                                !startDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {startDate ? format(startDate, "PPP") : (isHalfDay ? "Pick date" : "Pick start date")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={startDate}
                              onSelect={(date) => {
                                setStartDate(date);
                                // For half day, automatically set end date to same as start date
                                if (isHalfDay && date) {
                                  setEndDate(date);
                                }
                              }}
                              disabled={(date) => {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                return date < today;
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {!isHalfDay && (
                        <div>
                          <Label>End Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal mt-1",
                                  !endDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, "PPP") : "Pick end date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={endDate}
                                onSelect={setEndDate}
                                disabled={(date) => date < (startDate || new Date())}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </div>

                    {startDate && (isHalfDay || endDate) && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Total days requested: <strong>{calculateDays()} {calculateDays() === 1 ? 'day' : 'days'}</strong>
                          {isHalfDay && (
                            <span className="text-muted-foreground ml-2">
                              ({halfDayPeriod === '1st_half' ? '1st Half' : '2nd Half'} on {format(startDate, "PPP")})
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div>
                      <Label htmlFor="reason">Reason for Leave</Label>
                      <Textarea
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Please provide a reason for your leave request..."
                        className="mt-2"
                        rows={4}
                      />
                    </div>

                    {/* Sandwich Leave Preview */}
                    {sandwichCalculation && startDate && endDate && (
                      <Card className={cn(
                        "border-l-4",
                        sandwichCalculation.is_sandwich_leave ? "border-l-orange-500" : "border-l-blue-500"
                      )}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Calculator className="h-4 w-4" />
                            Leave Calculation Preview
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Actual Working Days:</span>
                              <p className="font-medium">{sandwichCalculation.actual_days}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Days to be Deducted:</span>
                              <p className={cn(
                                "font-medium",
                                sandwichCalculation.is_sandwich_leave ? "text-orange-600" : "text-green-600"
                              )}>
                                {sandwichCalculation.deducted_days}
                              </p>
                            </div>
                          </div>
                          
                          {sandwichCalculation.is_sandwich_leave && (
                            <Alert className="bg-orange-50 border-orange-200">
                              <AlertCircle className="h-4 w-4 text-orange-600" />
                              <AlertDescription className="text-orange-800">
                                <strong>Sandwich Leave Applied:</strong> {sandwichCalculation.reason}
                              </AlertDescription>
                            </Alert>
                          )}
                          
                          {!sandwichCalculation.is_sandwich_leave && (
                            <Alert className="bg-green-50 border-green-200">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <AlertDescription className="text-green-800">
                                <strong>Normal Leave:</strong> {sandwichCalculation.reason}
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Related Applications Warning */}
                          {relatedApps.length > 0 && (
                            <Alert className="bg-blue-50 border-blue-200">
                              <Info className="h-4 w-4 text-blue-600" />
                              <AlertDescription className="text-blue-800">
                                <strong>Related Applications Found:</strong> You have {relatedApps.length} related Friday/Monday application(s). 
                                Combined deduction will be {relatedApps[0]?.combined_deduction || 4} days total.
                              </AlertDescription>
                            </Alert>
                          )}

                          {sandwichCalculation.details && (
                            <div className="border-t pt-3">
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div className="flex justify-between">
                                  <span>Total Days:</span>
                                  <span>{sandwichCalculation.details.total_days}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Working Days:</span>
                                  <span>{sandwichCalculation.details.working_days}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Weekend Days:</span>
                                  <span>{sandwichCalculation.details.weekend_days}</span>
                                </div>
                                {sandwichCalculation.details.holiday_days > 0 && (
                                  <div className="flex justify-between text-green-600">
                                    <span>Holidays (Excluded):</span>
                                    <span>{sandwichCalculation.details.holiday_days}</span>
                                  </div>
                                )}
                                {sandwichCalculation.details.sandwich_days > 0 && (
                                  <div className="flex justify-between text-orange-600">
                                    <span>Sandwich Penalty:</span>
                                    <span>+{sandwichCalculation.details.sandwich_days}</span>
                                  </div>
                                )}
                              </div>

                              {/* Business Rules Summary */}
                              {sandwichCalculation.details.business_rules && (
                                <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
                                  <p className="font-medium mb-1">Sandwich Leave Rules:</p>
                                  <ul className="space-y-1 text-muted-foreground">
                                    <li>• {sandwichCalculation.details.business_rules.continuous_fri_mon}</li>
                                    <li>• {sandwichCalculation.details.business_rules.separate_fri_mon}</li>
                                    <li>• {sandwichCalculation.details.business_rules.single_approved}</li>
                                    <li>• {sandwichCalculation.details.business_rules.single_unapproved}</li>
                                    <li>• {sandwichCalculation.details.business_rules.holidays_excluded}</li>
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={
                        !selectedType || 
                        !startDate || 
                        (!isHalfDay && !endDate) || 
                        !reason.trim() || 
                        createLeaveApplication.isPending || 
                        (!isHalfDay && startDate && endDate && startDate > endDate)
                      }
                    >
                      {createLeaveApplication.isPending ? 'Submitting...' : 'Submit Leave Application'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Leave Balance
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => recalculateBalance.mutate()}
                    disabled={recalculateBalance.isPending}
                    className="h-8 w-8 p-0"
                  >
                    <RefreshCw className={cn("h-4 w-4", recalculateBalance.isPending && "animate-spin")} />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {summaryLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : leaveSummary?.success ? (
                    <>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Total Leave Balance</span>
                          <span>{leaveSummary.balance?.allocated_days || totalLeaveBalance} days</span>
                        </div>
                        <Progress value={leaveSummary.balance?.allocated_days > 0 ? 
                          ((leaveSummary.balance.allocated_days - (leaveSummary.balance.used_days || 0)) / leaveSummary.balance.allocated_days) * 100 : 0} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Used This Year</span>
                          <span>{leaveSummary.balance?.used_days || usedLeave} days</span>
                        </div>
                        <Progress 
                          value={leaveSummary.balance?.allocated_days > 0 ? 
                            ((leaveSummary.balance.used_days || 0) / leaveSummary.balance.allocated_days) * 100 : 0} 
                          className="bg-red-100" 
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Remaining</span>
                          <span className={cn(
                            "font-medium",
                            (leaveSummary.balance?.remaining_days || 0) < 0 ? "text-red-600" : "text-green-600"
                          )}>
                            {leaveSummary.balance?.remaining_days || (totalLeaveBalance - usedLeave)} days
                          </span>
                        </div>
                      </div>
                      
                      {/* Manual Allocation Information */}
                      <div className="border-t pt-3 space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Tenure</span>
                          <span>{leaveSummary.user?.tenure_months || 0} months</span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                          <Info className="h-3 w-3" />
                          <span>Leave allocations are managed manually by HR once a year</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    // Fallback to original display
                    <>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Total Leave Balance</span>
                          <span>{totalLeaveBalance} days</span>
                        </div>
                        <Progress value={((totalLeaveBalance - usedLeave) / totalLeaveBalance) * 100} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Used This Year</span>
                          <span>{usedLeave} days</span>
                        </div>
                        <Progress value={(usedLeave / totalLeaveBalance) * 100} className="bg-red-100" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Remaining</span>
                          <span>{totalLeaveBalance - usedLeave} days</span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Holidays</CardTitle>
                </CardHeader>
                <CardContent>
                  {holidaysLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : holidays && holidays.length > 0 ? (
                    <div className="space-y-3">
                      {holidays.slice(0, 3).map((holiday: any) => (
                        <div key={holiday.id} className="flex justify-between items-center">
                          <span className="text-sm">{holiday.name}</span>
                          <Badge variant="outline">{format(new Date(holiday.date), 'MMM dd')}</Badge>
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

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Who's On Leave
                  </CardTitle>
                  <CardDescription>
                    All employees on leave today and upcoming days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {onLeaveLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : employeesOnLeave && employeesOnLeave.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {employeesOnLeave.map((leave: any) => {
                        const isCurrentUser = leave.user?.id === user?.id;
                        return (
                        <div 
                          key={leave.id} 
                          className={`flex items-center gap-3 p-2 rounded-lg border ${
                            isCurrentUser 
                              ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' 
                              : 'bg-white/50'
                          }`}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={leave.user?.avatar_url} />
                            <AvatarFallback>
                              {leave.user?.full_name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {leave.user?.full_name}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-blue-600 font-semibold">(You)</span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {/* <span>{leave.leave_type?.name}</span>
                              <span>•</span> */}
                              <span>
                                {format(new Date(leave.start_date), 'MMM dd')} - {format(new Date(leave.end_date), 'MMM dd')}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="secondary" className="text-xs">
                              {leave.days_count} day{leave.days_count !== 1 ? 's' : ''}
                              {leave.is_half_day && (
                                leave.half_day_period === '1st_half' ? ' (1st half)' : 
                                leave.half_day_period === '2nd_half' ? ' (2nd half)' : ' (Half Day)'
                              )}
                            </Badge>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No employees on leave
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="balance" className="space-y-6">
          {/* Manual Leave Allocation Information */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <Info className="h-5 w-5" />
                Leave Allocation Policy
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p><strong>Your Status:</strong></p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Tenure: {leaveSummary?.user?.tenure_months || 0} months</li>
                    <li>Leave Applications: Always allowed</li>
                    <li>Balance Allocated: {totalLeaveBalance} days for this year</li>
                  </ul>
                </div>
                <div>
                  <p><strong>HR Policy:</strong></p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Leave allocations are set manually by HR</li>
                    <li>Allocation happens once per year</li>
                    <li>Contact HR for balance adjustments</li>
                    <li>All leave applications require approval</li>
                  </ul>
                </div>
              </div>
              <Alert className="mt-3">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Note:</strong> Your leave balance is manually allocated by HR once a year. 
                  If you have questions about your allocation, please contact the HR department.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {balanceLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <LoadingSpinner size="sm" />
                  </CardContent>
                </Card>
              ))
            ) : (
              leaveBalance?.map((balance) => {
                const typeKey = balance.leave_type?.name?.toLowerCase().replace(' ', '_') || 'other';
                return (
              <Card key={balance.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className={`w-4 h-4 rounded-full ${leaveTypeColors[typeKey as keyof typeof leaveTypeColors] || 'bg-gray-500'}`} />
                    {balance.leave_type?.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">{balance.remaining_days}</div>
                  <p className="text-sm text-muted-foreground">days available</p>
                  <Progress 
                    value={balance.allocated_days > 0 ? (balance.remaining_days / balance.allocated_days) * 100 : 0} 
                    className="mt-3" 
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {balance.used_days} days used this year
                  </p>
                </CardContent>
              </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Leave History</CardTitle>
              <CardDescription>
                View all your previous leave applications and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <LoadingSpinner size="sm" />
              ) : leaveHistory && leaveHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Comments</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveHistory.map((leave: any) => (
                      <TableRow key={leave.id}>
                        <TableCell className="font-medium">{leave.leave_type?.name}</TableCell>
                        <TableCell>
                          {format(new Date(leave.start_date), 'MMM dd')} - {format(new Date(leave.end_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          {leave.days_count}
                          {leave.is_half_day && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {leave.half_day_period === '1st_half' ? '1st half' : 
                               leave.half_day_period === '2nd_half' ? '2nd half' : 'Half Day'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{leave.reason}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(leave.status)}
                            <Badge className={getStatusBadge(leave.status)}>
                              {leave.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {leave.comments ? (
                            <div className="text-sm text-gray-600 truncate" title={leave.comments}>
                              {leave.comments}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">No comments</span>
                          )}
                        </TableCell>
                        <TableCell>{format(new Date(leave.applied_at), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                          {canWithdrawLeave(leave) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedLeaveForWithdraw(leave);
                                setIsWithdrawDialogOpen(true);
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Withdraw
                            </Button>
                          )}
                          {leave.status === 'approved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="text-gray-400 cursor-not-allowed"
                              title="Approved leaves cannot be withdrawn directly. Please contact your manager or HR department."
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Contact Manager/HR
                            </Button>
                          )}
                          {leave.status === 'pending' && !canWithdrawLeave(leave) && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="text-gray-400 cursor-not-allowed"
                              title="Cannot withdraw past leave applications"
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Past Leave
                            </Button>
                          )}
                          {leave.status === 'withdrawn' && (
                            <Badge variant="outline" className="text-gray-500">
                              Withdrawn
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No leave applications found
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Withdraw Leave Application Dialog */}
      <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Leave Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to withdraw this leave application? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {selectedLeaveForWithdraw && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Leave Type:</span>
                    <span className="ml-2">{selectedLeaveForWithdraw.leave_type?.name}</span>
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span>
                    <span className="ml-2">
                      {selectedLeaveForWithdraw.days_count} day{selectedLeaveForWithdraw.days_count !== 1 ? 's' : ''}
                      {selectedLeaveForWithdraw.is_half_day && (
                        selectedLeaveForWithdraw.half_day_period === '1st_half' ? ' (1st half)' : 
                        selectedLeaveForWithdraw.half_day_period === '2nd_half' ? ' (2nd half)' : ' (Half Day)'
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Start Date:</span>
                    <span className="ml-2">{format(new Date(selectedLeaveForWithdraw.start_date), 'MMM dd, yyyy')}</span>
                  </div>
                  <div>
                    <span className="font-medium">End Date:</span>
                    <span className="ml-2">{format(new Date(selectedLeaveForWithdraw.end_date), 'MMM dd, yyyy')}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="font-medium">Current Status:</span>
                  <Badge className={cn("ml-2", getStatusBadge(selectedLeaveForWithdraw.status))}>
                    {selectedLeaveForWithdraw.status}
                  </Badge>
                </div>
              </div>

              <div>
                <Label htmlFor="withdrawalReason">Reason for Withdrawal</Label>
                <Textarea
                  id="withdrawalReason"
                  value={withdrawalReason}
                  onChange={(e) => setWithdrawalReason(e.target.value)}
                  placeholder="Please provide a reason for withdrawing this leave application..."
                  rows={3}
                  className="mt-2"
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Withdrawing this pending leave application will remove it from review and restore your leave balance.
                  {' '}Note: Withdrawal notifications will be sent to HR, managers, and administrators.
                  {' '}For approved leaves, please contact your manager or HR department directly.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsWithdrawDialogOpen(false);
                    setSelectedLeaveForWithdraw(null);
                    setWithdrawalReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleWithdrawLeave}
                  disabled={!withdrawalReason.trim() || withdrawLeaveApplication.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {withdrawLeaveApplication.isPending ? 'Withdrawing...' : 'Confirm Withdrawal'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}