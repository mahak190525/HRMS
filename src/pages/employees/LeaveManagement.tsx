import { useState, useEffect } from 'react';
import { useAllLeaveApplications, useUpdateLeaveApplicationStatus, useLeaveApplicationPermissions } from '@/hooks/useLeaveManagement';
import { useWithdrawLeaveApplication } from '@/hooks/useLeave';
import { useAllEmployeesLeaveBalancesWithManager, useAdjustLeaveBalance, useAdjustCompOffBalance, useLeaveBalanceAdjustments, useUpdateLeaveBalance, useCronSettings, useCreateOrUpdateCronSettings, useTriggerMonthlyAllocation, useManageCronJob } from '@/hooks/useLeaveBalanceManagement';
import { useLeaveWithdrawalLogs } from '@/hooks/useLeave';
// import { useRecalculateAllApprovedLeaveBalances } from '@/hooks/useSandwichLeave';
import { useHolidays, useCreateHoliday, useDeleteHoliday } from '@/hooks/useHolidays';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useEmploymentTermLeaveRates } from '@/hooks/useEmploymentTermLeaveRates';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Calendar,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Download,
  Plus,
  Minus,
  TrendingUp,
  Calculator,
  History,
  Info,
  RotateCcw,
  CalendarPlus,
  Trash2,
  Settings,
  Play
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { 
  isPastDate, 
  getCurrentISTDate, 
  formatDateForDisplay,
  parseToISTDate
} from '@/utils/dateUtils';
import { toast } from 'sonner';

// Helper functions
// Helper function to format days for display (always show 1 decimal place, but don't round)
const formatDaysForDisplay = (days: number): string => {
  // Parse to ensure we have a valid number, then format to 1 decimal place
  const num = Number(days);
  if (isNaN(num)) return '0.0';
  // Use toFixed(1) to show one decimal place, but the actual value isn't rounded
  return num.toFixed(1);
};

// Helper function to restrict input to one decimal place
const restrictToOneDecimal = (value: string): string => {
  // Remove any characters that aren't digits or decimal point
  let cleaned = value.replace(/[^\d.]/g, '');
  // Only allow one decimal point
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  // Restrict to one decimal place
  if (parts.length === 2 && parts[1].length > 1) {
    cleaned = parts[0] + '.' + parts[1].substring(0, 1);
  }
  return cleaned;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'approved':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'rejected':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case 'cancelled':
      return <XCircle className="h-4 w-4 text-gray-600" />;
    case 'withdrawn':
      return <RotateCcw className="h-4 w-4 text-gray-600" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-gray-600" />;
  }
};

const getStatusBadge = (status: string) => {
  const variants = {
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-gray-100 text-gray-800',
    withdrawn: 'bg-gray-100 text-gray-800',
  };
  return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
};

// Component for handling action buttons based on permissions
function LeaveApplicationActions({ application }: { application: any }) {
  const { data: permissions } = useLeaveApplicationPermissions(application.user?.id);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [comments, setComments] = useState('');
  const [withdrawalReason, setWithdrawalReason] = useState('');
  const updateLeaveStatus = useUpdateLeaveApplicationStatus();
  const withdrawLeaveApplication = useWithdrawLeaveApplication();

  const handleStatusUpdate = () => {
    if (!newStatus || !application) return;

    updateLeaveStatus.mutate({
      applicationId: application.id,
      status: newStatus as 'approved' | 'rejected' | 'cancelled',
      comments: comments || undefined
    }, {
      onSuccess: () => {
        setIsUpdateDialogOpen(false);
        setNewStatus('');
        setComments('');
      },
      onError: (error: any) => {
        // Error is already handled in the hook's onError, but we can add additional handling here if needed
        console.error('Error updating leave status:', error);
      }
    });
  };

  const handleWithdrawLeave = () => {
    if (!withdrawalReason.trim() || !application) return;

    withdrawLeaveApplication.mutate({
      applicationId: application.id,
      reason: withdrawalReason.trim()
    }, {
      onSuccess: () => {
        setIsWithdrawDialogOpen(false);
        setWithdrawalReason('');
      }
    });
  };

  const canWithdrawLeave = () => {
    if (!['pending', 'approved'].includes(application.status)) {
      return false;
    }
    
    // Check if the leave is in the future (can only withdraw future leaves) using IST
    return !isPastDate(application.start_date);
  };

  const handleWithdrawAttempt = () => {
    if (!canWithdrawLeave()) {
      if (isPastDate(application.start_date)) {
        toast.error('Cannot withdraw past leave applications');
      } else if (!['pending', 'approved'].includes(application.status)) {
        toast.error('Cannot withdraw leave applications that are not pending or approved');
      }
      return;
    }
    setIsWithdrawDialogOpen(true);
  };

  return (
    <div className="flex gap-2">
      {/* View button - always visible */}
      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Eye className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Leave Application Details</DialogTitle>
            <DialogDescription>
              Complete information about this leave request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium">Employee:</p>
                <p className="text-muted-foreground">{application.user?.full_name}</p>
              </div>
              <div>
                <p className="font-medium">Employee ID:</p>
                <p className="text-muted-foreground">{application.user?.employee_id}</p>
              </div>
              <div>
                <p className="font-medium">Email:</p>
                <p className="text-muted-foreground">{application.user?.email}</p>
              </div>
              <div>
                <p className="font-medium">Leave Type:</p>
                <p className="text-muted-foreground">{application.leave_type?.name}</p>
              </div>
              <div>
                <p className="font-medium">Duration:</p>
                <p className="text-muted-foreground">
                  {formatDaysForDisplay(Number(application.days_count))} days
                  {application.is_half_day && (
                    <span className="ml-2 text-blue-600">
                      ({application.half_day_period === '1st_half' ? '1st half' : 
                        application.half_day_period === '2nd_half' ? '2nd half' : 'Half Day'})
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="font-medium">Start Date:</p>
                <p className="text-muted-foreground">{formatDateForDisplay(application.start_date, 'MMM dd, yyyy')}</p>
              </div>
              <div>
                <p className="font-medium">End Date:</p>
                <p className="text-muted-foreground">{formatDateForDisplay(application.end_date, 'MMM dd, yyyy')}</p>
              </div>
              <div>
                <p className="font-medium">Status:</p>
                <Badge className={getStatusBadge(application.status)}>
                  {application.status}
                </Badge>
              </div>
              {application.approved_at && (
                <div>
                  <p className="font-medium">Reviewed At:</p>
                  <p className="text-muted-foreground">
                    {formatDateForDisplay(application.approved_at, 'MMM dd yyyy, HH:mm')}
                  </p>
                </div>
              )}
              {application.approved_by_user && (
                <div>
                  <p className="font-medium">Reviewed By:</p>
                  <p className="text-muted-foreground">{application.approved_by_user.full_name}</p>
                </div>
              )}
            </div>
            <div>
              <p className="font-medium mb-2">Reason:</p>
              <p className="text-muted-foreground text-sm">{application.reason}</p>
            </div>
            {application.comments && (
              <div>
                <p className="font-medium mb-2">Manager Comments:</p>
                <p className="text-muted-foreground text-sm">{application.comments}</p>
              </div>
            )}
                            {(application.is_sandwich_leave || application.sandwich_deducted_days) && (
                              <div className="border-t pt-4">
                                <p className="font-medium mb-2 text-orange-700">Leave Deduction Calculation:</p>
                                <div className={cn(
                                  "p-3 rounded-lg space-y-2",
                                  application.is_sandwich_leave ? "bg-orange-50" : "bg-blue-50"
                                )}>
                                  <div className="flex justify-between text-sm">
                                    <span>Actual Working Days:</span>
                                    <span className="font-medium">{formatDaysForDisplay(Number(application.days_count))}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span>Days Deducted from Balance:</span>
                                    <span className={cn(
                                      "font-medium",
                                      application.is_sandwich_leave ? "text-orange-700" : "text-blue-700"
                                    )}>
                                      {formatDaysForDisplay(Number(application.sandwich_deducted_days || application.days_count))}
                                    </span>
                                  </div>
                                  {application.sandwich_deducted_days && application.sandwich_deducted_days !== application.days_count && (
                                    <div className="flex justify-between text-sm">
                                      <span>Additional Deduction:</span>
                                      <span className="font-medium text-red-600">
                                        +{formatDaysForDisplay(Number(application.sandwich_deducted_days) - Number(application.days_count))} days
                                      </span>
                                    </div>
                                  )}
                                  {application.sandwich_reason && (
                                    <div className="text-sm">
                                      <span className="font-medium">Calculation Rule:</span>
                                      <p className="text-muted-foreground mt-1">{application.sandwich_reason}</p>
                                    </div>
                                  )}
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {application.is_sandwich_leave && (
                                      <Badge className="bg-orange-100 text-orange-800 text-xs">
                                        Sandwich Leave Applied
                                      </Badge>
                                    )}
                                    {!application.is_sandwich_leave && application.sandwich_deducted_days && (
                                      <Badge className="bg-blue-100 text-blue-800 text-xs">
                                        Enhanced Calculation
                                      </Badge>
                                    )}
                                    {application.sandwich_deducted_days === 1 && (
                                      <Badge className="bg-green-100 text-green-800 text-xs">
                                        Single Day Approved
                                      </Badge>
                                    )}
                                    {application.sandwich_deducted_days === 3 && application.days_count === 1 && (
                                      <Badge className="bg-red-100 text-red-800 text-xs">
                                        Sandwich Penalty
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Review button - for users with edit permissions, disabled if already approved/rejected/withdrawn */}
      {permissions?.canEdit && !['approved', 'rejected', 'withdrawn'].includes(application.status) && (
        <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              Review
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review Leave Application</DialogTitle>
              <DialogDescription>
                Approve or reject {application.user?.full_name}'s leave request
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Leave Type:</span>
                    <span className="ml-2">{application.leave_type?.name}</span>
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span>
                    <span className="ml-2">
                      {formatDaysForDisplay(Number(application.days_count))} days
                      {application.is_half_day && (
                        <span className="ml-2 text-blue-600 text-xs">
                          ({application.half_day_period === '1st_half' ? '1st half' : 
                            application.half_day_period === '2nd_half' ? '2nd half' : 'Half Day'})
                        </span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Start Date:</span>
                    <span className="ml-2">{formatDateForDisplay(application.start_date, 'MMM dd, yyyy')}</span>
                  </div>
                  <div>
                    <span className="font-medium">End Date:</span>
                    <span className="ml-2">{formatDateForDisplay(application.end_date, 'MMM dd, yyyy')}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="font-medium">Reason:</span>
                  <p className="text-sm text-muted-foreground mt-1">{application.reason}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="status">Decision</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select decision" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approve</SelectItem>
                      <SelectItem value="rejected">Reject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="comments">Comments (Optional)</Label>
                  <Textarea
                    id="comments"
                    placeholder="Add any comments for the employee..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleStatusUpdate}
                  disabled={!newStatus || updateLeaveStatus.isPending}
                >
                  {updateLeaveStatus.isPending ? 'Updating...' : 'Confirm'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Withdraw button - for admin/HR or specific permissions, only for future leaves */}
      {permissions?.canEdit && canWithdrawLeave() && (
        <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleWithdrawAttempt}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Withdraw
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw Leave Application</DialogTitle>
              <DialogDescription>
                Withdraw {application.user?.full_name}'s leave application
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Employee:</span>
                    <span className="ml-2">{application.user?.full_name}</span>
                  </div>
                  <div>
                    <span className="font-medium">Leave Type:</span>
                    <span className="ml-2">{application.leave_type?.name}</span>
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span>
                    <span className="ml-2">
                      {formatDaysForDisplay(Number(application.days_count))} days
                      {application.is_half_day && (
                        <span className="ml-2 text-blue-600 text-xs">
                          ({application.half_day_period === '1st_half' ? '1st half' : 
                            application.half_day_period === '2nd_half' ? '2nd half' : 'Half Day'})
                        </span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Current Status:</span>
                    <Badge className={getStatusBadge(application.status)}>
                      {application.status}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Start Date:</span>
                    <span className="ml-2">{formatDateForDisplay(application.start_date, 'MMM dd, yyyy')}</span>
                  </div>
                  <div>
                    <span className="font-medium">End Date:</span>
                    <span className="ml-2">{formatDateForDisplay(application.end_date, 'MMM dd, yyyy')}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="font-medium">Original Reason:</span>
                  <p className="text-sm text-muted-foreground mt-1">{application.reason}</p>
                </div>
              </div>
              
              <div>
                <Label htmlFor="withdrawalReason">Reason for Withdrawal</Label>
                <Textarea
                  id="withdrawalReason"
                  placeholder="Provide a reason for withdrawing this leave application..."
                  value={withdrawalReason}
                  onChange={(e) => setWithdrawalReason(e.target.value)}
                  rows={3}
                  className="mt-2"
                />
              </div>
              
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {application.status === 'approved' 
                    ? 'Withdrawing an approved leave will restore the employee\'s leave balance.'
                    : 'This will remove the leave application from the review queue.'}
                  {' '}Withdrawal notifications will be sent to HR, managers, and administrators.
                </AlertDescription>
              </Alert>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsWithdrawDialogOpen(false)}>
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
          </DialogContent>
        </Dialog>
      )}
      
      {/* Show disabled withdraw button for past leaves */}
      {permissions?.canEdit && ['pending', 'approved'].includes(application.status) && !canWithdrawLeave() && (
        <Button 
          size="sm" 
          variant="outline" 
          disabled 
          className="text-gray-400 cursor-not-allowed"
          title="Cannot withdraw past leave applications"
          onClick={() => toast.error('Cannot withdraw past leave applications')}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Past Leave
        </Button>
      )}
    </div>
  );
}

// Component for editing rate of leave
function RateOfLeaveEditor({ balance, currentRate }: { balance: any; currentRate: number }) {
  const [rate, setRate] = useState(currentRate.toString());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const updateLeaveBalance = useUpdateLeaveBalance();
  const queryClient = useQueryClient();

  const handleSave = async () => {
    const rateValue = parseFloat(rate);
    if (isNaN(rateValue) || rateValue < 0) {
      toast.error('Please enter a valid rate (must be >= 0)');
      return;
    }

    const userId = balance.user_id || balance.user?.id;
    if (!userId) {
      toast.error('User ID not found. Please refresh the page.');
      return;
    }

    // Try to get balance_id first
    let balanceId = balance.balance_id || balance.id;
    
    if (balanceId) {
      // We have balance_id, use the standard update
      updateLeaveBalance.mutate({
        balanceId: balanceId,
        updates: {
          rate_of_leave: rateValue
        }
      }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances-with-manager'] });
        },
        onError: (error: any) => {
          // If update fails, try using user_id method
          if (error?.code === 'PGRST116' || error?.message?.includes('not found')) {
            handleSaveByUserId(userId, rateValue);
          }
        }
      });
    } else {
      // No balance_id, use user_id method
      handleSaveByUserId(userId, rateValue);
    }
  };

  const handleSaveByUserId = async (userId: string, rateValue: number) => {
    try {
      const { leaveApi } = await import('@/services/api');
      await leaveApi.updateLeaveBalanceRateByUserId(userId, rateValue);
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances-with-manager'] });
      toast.success('Rate of leave updated successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update rate of leave');
      console.error('Error updating rate of leave:', error);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-1"
          onClick={() => {
            setRate(currentRate.toString());
            setIsDialogOpen(true);
          }}
        >
          <div className="text-center">
            <div className="font-medium">{currentRate.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">days/month</div>
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Rate of Leave</DialogTitle>
          <DialogDescription>
            Set the monthly leave allocation rate for {balance.full_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="rate-of-leave">Rate of Leave (days per month)</Label>
            <Input
              id="rate-of-leave"
              type="number"
              step="0.01"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0.00"
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This is the number of leave days that will be added to the employee's balance each month.
            </p>
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              The monthly allocation will be processed automatically by the cron job based on the configured schedule.
            </AlertDescription>
          </Alert>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={updateLeaveBalance.isPending}
            >
              {updateLeaveBalance.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Component for Cron Settings Tab
function CronSettingsTab() {
  const { data: cronSettings, isLoading, refetch } = useCronSettings();
  const createOrUpdateSettings = useCreateOrUpdateCronSettings();
  const triggerAllocation = useTriggerMonthlyAllocation();
  const manageCronJob = useManageCronJob();
  const [cronSchedule, setCronSchedule] = useState('0 0 1 * *'); // Default: 1st day of month at midnight
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Refetch cron settings after manual trigger to get updated last_run_at
  useEffect(() => {
    if (triggerAllocation.isSuccess) {
      // Wait a bit for the database to update, then refetch
      const timer = setTimeout(() => {
        refetch();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [triggerAllocation.isSuccess, refetch]);

  // Load existing settings when available
  useEffect(() => {
    if (cronSettings) {
      setCronSchedule(cronSettings.cron_schedule || '0 0 1 * *');
      setEndDate(cronSettings.end_date || '');
      setIsActive(cronSettings.is_active ?? true);
    }
  }, [cronSettings]);

  const handleSave = () => {
    if (!endDate) {
      toast.error('Please set an end date');
      return;
    }

    // Validate cron schedule
    const validation = validateCronSchedule(cronSchedule);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid cron schedule format');
      return;
    }

    createOrUpdateSettings.mutate({
      cron_schedule: cronSchedule.trim(),
      end_date: endDate,
      is_active: isActive
    }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        // Automatically manage the pg_cron job after saving settings
        if (isActive) {
          manageCronJob.mutate();
        } else {
          // If inactive, unschedule the job
          manageCronJob.mutate();
        }
      }
    });
  };

  const handleTriggerNow = () => {
    if (!confirm('Are you sure you want to trigger monthly leave allocation now? This will allocate leave to all employees with rate_of_leave > 0.')) {
      return;
    }
    triggerAllocation.mutate();
  };

  // Validate cron schedule format (standard Unix cron: 5 fields)
  const validateCronSchedule = (schedule: string): { valid: boolean; error?: string } => {
    const parts = schedule.trim().split(/\s+/);
    
    if (parts.length !== 5) {
      return {
        valid: false,
        error: `Invalid format. Expected 5 fields (minute hour day month weekday), got ${parts.length}. Example: "0 0 1 * *" (1st day of month at midnight)`
      };
    }
    
    // Helper function to validate a cron field
    const validateCronField = (
      field: string, 
      fieldName: string, 
      min: number, 
      max: number, 
      allowWildcard: boolean = true
    ): { valid: boolean; error?: string } => {
      if (field === '*' && allowWildcard) {
        return { valid: true };
      }
      
      // Check for step expressions (e.g., */2, 0-59/5)
      if (field.includes('/')) {
        const [range, step] = field.split('/');
        const stepNum = parseInt(step);
        if (isNaN(stepNum) || stepNum < 1) {
          return { valid: false, error: `${fieldName} step value must be a positive number` };
        }
        
        // If range is *, it's valid
        if (range === '*') {
          return { valid: true };
        }
        
        // Check for range (e.g., 0-59/5)
        if (range.includes('-')) {
          const [start, end] = range.split('-').map(n => parseInt(n));
          if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
            return { valid: false, error: `${fieldName} range must be ${min}-${max}` };
          }
          return { valid: true };
        }
        
        // Single number with step (e.g., 0/5)
        const num = parseInt(range);
        if (isNaN(num) || num < min || num > max) {
          return { valid: false, error: `${fieldName} must be ${min}-${max} or *` };
        }
        return { valid: true };
      }
      
      // Check for ranges (e.g., 0-59)
      if (field.includes('-')) {
        const [start, end] = field.split('-').map(n => parseInt(n));
        if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
          return { valid: false, error: `${fieldName} range must be ${min}-${max}` };
        }
        return { valid: true };
      }
      
      // Check for lists (e.g., 0,5,10)
      if (field.includes(',')) {
        const values = field.split(',').map(n => parseInt(n.trim()));
        for (const val of values) {
          if (isNaN(val) || val < min || val > max) {
            return { valid: false, error: `${fieldName} values must be ${min}-${max}` };
          }
        }
        return { valid: true };
      }
      
      // Single number
      const num = parseInt(field);
      if (isNaN(num) || num < min || num > max) {
        return { valid: false, error: `${fieldName} must be ${min}-${max} or *` };
      }
      return { valid: true };
    };
    
    const [minute, hour, day, month, weekday] = parts;
    
    // Validate each field
    const minuteValidation = validateCronField(minute, 'Minute', 0, 59);
    if (!minuteValidation.valid) return minuteValidation;
    
    const hourValidation = validateCronField(hour, 'Hour', 0, 23);
    if (!hourValidation.valid) return hourValidation;
    
    const dayValidation = validateCronField(day, 'Day', 1, 31);
    if (!dayValidation.valid) return dayValidation;
    
    const monthValidation = validateCronField(month, 'Month', 1, 12);
    if (!monthValidation.valid) return monthValidation;
    
    const weekdayValidation = validateCronField(weekday, 'Weekday', 0, 7);
    if (!weekdayValidation.valid) return weekdayValidation;
    
    return { valid: true };
  };

  // Parse cron schedule for display
  const parseCronSchedule = (schedule: string) => {
    const validation = validateCronSchedule(schedule);
    if (!validation.valid) {
      return validation.error || 'Invalid schedule';
    }
    
    const parts = schedule.trim().split(/\s+/);
    const [minute, hour, day, month, weekday] = parts;
    
    let description = '';
    if (day !== '*' && month === '*') {
      description = `Day ${day} of every month at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    } else if (weekday !== '*' && day === '*' && month === '*') {
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayIndex = parseInt(weekday) === 7 ? 0 : parseInt(weekday);
      description = `Every ${weekdays[dayIndex]} at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    } else if (day === '*' && month === '*' && weekday === '*') {
      description = `Every day at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    } else {
      description = `Custom schedule: ${schedule}`;
    }
    
    return description;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Monthly Leave Allocation Cron Settings
            </CardTitle>
            <CardDescription>
              Configure the automated monthly leave allocation system
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTriggerNow}
              disabled={triggerAllocation.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              {triggerAllocation.isPending ? 'Running...' : 'Trigger Now'}
            </Button>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              {cronSettings ? 'Update Settings' : 'Configure Settings'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {cronSettings ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Cron Schedule</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  <div className="font-mono text-sm">{cronSettings.cron_schedule}</div>
                  <div className={cn(
                    "text-xs mt-1",
                    validateCronSchedule(cronSettings.cron_schedule).valid 
                      ? "text-muted-foreground" 
                      : "text-red-600 font-medium"
                  )}>
                    {parseCronSchedule(cronSettings.cron_schedule)}
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">End Date</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  <div className="text-sm">{formatDateForDisplay(cronSettings.end_date, 'MMM dd, yyyy')}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Cron job will stop running after this date
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <div className="mt-1">
                  <Badge className={cronSettings.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                    {cronSettings.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              {/* <div>
                <Label className="text-sm font-medium">Last Run</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  <div className="text-sm">
                    {cronSettings.last_run_at 
                      ? formatDateForDisplay(cronSettings.last_run_at, 'MMM dd, yyyy HH:mm')
                      : 'Never'}
                  </div>
                </div>
              </div> */}
              {/* <div>
                <Label className="text-sm font-medium">Next Run</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  <div className="text-sm">
                    {cronSettings.next_run_at 
                      ? formatDateForDisplay(cronSettings.next_run_at, 'MMM dd, yyyy HH:mm')
                      : 'Not scheduled'}
                  </div>
                  {cronSettings.next_run_at && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(cronSettings.next_run_at) > new Date() 
                        ? `In ${Math.ceil((new Date(cronSettings.next_run_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days`
                        : 'Overdue'}
                    </div>
                  )}
                </div>
              </div> */}
            </div>
            
            {/* <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Note:</strong> The cron job uses Supabase's pg_cron extension to automatically run the allocation function. 
                The job will automatically allocate leave to all employees with a &quot;Rate of Leave&quot; &gt; 0 according to the schedule above. 
                The job will stop running after the end date to allow for rate updates before the next cycle.
                {cronSettings.is_active && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => manageCronJob.mutate()}
                      disabled={manageCronJob.isPending}
                    >
                      {manageCronJob.isPending ? 'Updating...' : 'Update Cron Job Schedule'}
                    </Button>
                  </div>
                )}
              </AlertDescription>
            </Alert> */}
          </div>
        ) : (
          <div className="text-center py-8">
            <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Cron Settings Configured</h3>
            <p className="text-muted-foreground mb-4">
              Configure the monthly leave allocation cron job to automatically allocate leave to employees.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Configure Settings
            </Button>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Configure Cron Settings</DialogTitle>
              <DialogDescription>
                Set the schedule and end date for the monthly leave allocation cron job
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="cron-schedule">Cron Schedule (Standard Unix Format)</Label>
                <Input
                  id="cron-schedule"
                  value={cronSchedule}
                  onChange={(e) => setCronSchedule(e.target.value)}
                  placeholder="0 0 1 * *"
                  className={cn(
                    "mt-2 font-mono",
                    cronSchedule && !validateCronSchedule(cronSchedule).valid && "border-red-500"
                  )}
                />
                {cronSchedule && !validateCronSchedule(cronSchedule).valid && (
                  <p className="text-xs text-red-600 mt-1">
                    {validateCronSchedule(cronSchedule).error}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Format: minute hour day month weekday (5 fields, space-separated)
                </p>
              </div>

              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The cron job will stop running after this date. This allows you to update leave rates before the next cycle.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is-active"
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(checked === true)}
                />
                <Label htmlFor="is-active">Active</Label>
                <p className="text-xs text-muted-foreground ml-2">
                  Enable or disable the cron job
                </p>
              </div>

              {/* <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Automatic Scheduling:</strong> This system uses Supabase's pg_cron extension to automatically schedule the job. 
                  After saving settings, the cron job will be automatically scheduled/updated. 
                  Make sure the pg_cron extension is enabled in your Supabase project.
                  <br /><br />
                  <strong>Alternative:</strong> If pg_cron is not available, you can use an external cron service to call the edge function at: 
                  <code className="text-xs">/functions/v1/monthly-leave-allocation</code>
                </AlertDescription>
              </Alert> */}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={!endDate || createOrUpdateSettings.isPending}
                >
                  {createOrUpdateSettings.isPending ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// Component for leave balance adjustment dialog
function LeaveBalanceAdjustment({ employee, onClose, onSuccess }: { 
  employee: any; 
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [balanceType, setBalanceType] = useState<'leave_balance' | 'comp_off_balance'>('leave_balance');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const adjustBalance = useAdjustLeaveBalance();
  const adjustCompOffBalance = useAdjustCompOffBalance();
  const queryClient = useQueryClient();

  const handleAdjustment = () => {
    if (!amount || !reason) return;
    
    const adjustmentAmount = parseFloat(amount);
    if (isNaN(adjustmentAmount) || adjustmentAmount < 0.5) {
      toast.error('Please enter a valid amount (minimum 0.5 days)');
      return;
    }

    if (balanceType === 'comp_off_balance') {
      adjustCompOffBalance.mutate({
        userId: employee.user_id,
        adjustment: {
          type: adjustmentType,
          amount: parseFloat(amount),
          reason
        }
      }, {
        onSuccess: () => {
          // Invalidate and refetch all relevant queries
          queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances-with-manager'] });
          queryClient.invalidateQueries({ queryKey: ['leave-balance-adjustments'] });
          
          // Call the success callback if provided
          onSuccess?.();
          
          // Close the dialog and reset form
          onClose();
          setAmount('');
          setReason('');
        }
      });
    } else {
      adjustBalance.mutate({
        userId: employee.user_id,
        adjustment: {
          type: adjustmentType,
          amount: parseFloat(amount),
          reason
        }
      }, {
        onSuccess: () => {
          // Invalidate and refetch all relevant queries
          queryClient.invalidateQueries({ queryKey: ['all-employees-leave-balances-with-manager'] });
          queryClient.invalidateQueries({ queryKey: ['leave-balance-adjustments'] });
          
          // Call the success callback if provided
          onSuccess?.();
          
          // Close the dialog and reset form
          onClose();
          setAmount('');
          setReason('');
        }
      });
    }
  };

  const isProcessing = balanceType === 'comp_off_balance' 
    ? adjustCompOffBalance.isPending 
    : adjustBalance.isPending;

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This adjustment will be applied to the employee's {balanceType === 'comp_off_balance' ? 'compensatory off balance' : 'main leave balance pool'}.
        </AlertDescription>
      </Alert>

      <div>
        <Label>Leave Balance Type</Label>
        <Select value={balanceType} onValueChange={(value: 'leave_balance' | 'comp_off_balance') => setBalanceType(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="leave_balance">Leave Balance</SelectItem>
            <SelectItem value="comp_off_balance">Comp Off Balance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Action</Label>
        <Select value={adjustmentType} onValueChange={(value: 'add' | 'subtract') => setAdjustmentType(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="add">Add Days</SelectItem>
            <SelectItem value="subtract">Subtract Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Number of Days</Label>
        <Input
          type="number"
          value={amount}
          onChange={(e) => {
            const restricted = restrictToOneDecimal(e.target.value);
            setAmount(restricted);
          }}
          placeholder="Enter number of days"
          step="0.1"
          min="0.1"
          pattern="\d*\.?\d{0,1}"
        />
      </div>

      <div>
        <Label>Reason for Adjustment</Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Provide a reason for this adjustment..."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={handleAdjustment}
          disabled={!amount || !reason || isProcessing}
        >
          {isProcessing ? 'Processing...' : `${adjustmentType === 'add' ? 'Add' : 'Subtract'} ${amount || '0'} Days`}
        </Button>
      </div>
    </div>
  );
}

export function LeaveManagement() {
  const { user } = useAuth();
  const permissions = useEmployeePermissions();
  const { hasAccess } = usePermissions(); // Check page-level permissions
  const [activeTab, setActiveTab] = useState('applications');
  
  // Check if user has page-level access to leave management
  // User-level or role-level page permissions take precedence
  const hasPageAccess = hasAccess('employee_management', 'leave');
  
  // Leave Applications data
  const { data: leaveApplications, isLoading: applicationsLoading } = useAllLeaveApplications();
  
  // Leave Balances data
  const { data: leaveBalances, isLoading: balancesLoading } = useAllEmployeesLeaveBalancesWithManager();
  const { data: adjustmentHistory, isLoading: historyLoading } = useLeaveBalanceAdjustments(undefined, 100);
  
  // Withdrawal logs data
  const { data: withdrawalLogs, isLoading: withdrawalLogsLoading } = useLeaveWithdrawalLogs();
  
  // Employment term leave rates
  const { data: employmentTermLeaveRates } = useEmploymentTermLeaveRates();
  
  // Helper function to get leave rate based on employment term
  const getLeaveRateByEmploymentTerm = (employmentTerm: string | null): number => {
    if (!employmentTerm || !employmentTermLeaveRates) return 0;
    const rateConfig = employmentTermLeaveRates.find(
      (rate) => rate.employment_term === employmentTerm
    );
    return rateConfig?.leave_rate || 0;
  };
  
  // Helper function to format employment term name for display
  const formatEmploymentTermName = (term: string | null): string => {
    if (!term) return 'Not Set';
    const termMap: Record<string, string> = {
      'full_time': 'Full Time',
      'part_time': 'Part Time',
      'associate': 'Associate',
      'contract': 'Contract',
      'probation/internship': 'Probation/Internship'
    };
    return termMap[term] || term;
  };
  
  // Helper function to get employment term info
  const getEmploymentTermInfo = (employmentTerm: string | null) => {
    if (!employmentTerm || !employmentTermLeaveRates) {
      return {
        term: 'Not Set',
        rate: 0,
        description: 'Employment term not configured'
      };
    }
    const rateConfig = employmentTermLeaveRates.find(
      (rate) => rate.employment_term === employmentTerm
    );
    return {
      term: formatEmploymentTermName(employmentTerm),
      rate: rateConfig?.leave_rate || 0,
      description: rateConfig?.description || `Leave rate for ${formatEmploymentTermName(employmentTerm)} employees`
    };
  };

  // Filter data based on permissions
  // If user has page access but not employee permissions, grant view access to all
  const canViewAll = hasPageAccess || permissions.canViewAllEmployees;
  const filteredLeaveBalances = canViewAll 
    ? leaveBalances 
    : leaveBalances?.filter((balance: any) => balance.user?.manager_id === user?.id);

  const filteredAdjustmentHistory = canViewAll 
    ? adjustmentHistory 
    : adjustmentHistory?.filter((adj: any) => adj.user?.manager_id === user?.id);

  const filteredWithdrawalLogs = canViewAll 
    ? withdrawalLogs 
    : withdrawalLogs?.filter((log: any) => log.leave_application?.user?.manager_id === user?.id);

  const filteredLeaveApplications = canViewAll 
    ? leaveApplications 
    : leaveApplications?.filter((app: any) => app.user?.manager_id === user?.id);
  
  // Recalculation mutation (commented out for now)
  // const recalculateBalances = useRecalculateAllApprovedLeaveBalances();
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('');
  const [sandwichFilter, setSandwichFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Dialog states
  const [selectedEmployeeForAdjustment, setSelectedEmployeeForAdjustment] = useState<any>(null);
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  
  // Holiday states
  const [holidayYear, setHolidayYear] = useState(2025);
  const [isAddHolidayDialogOpen, setIsAddHolidayDialogOpen] = useState(false);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayIsOptional, setNewHolidayIsOptional] = useState(false);

  // Holiday data (after holidayYear state is defined)
  const { data: holidays, isLoading: holidaysLoading } = useHolidays(holidayYear);
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();

  // Filter leave applications
  const filteredApplications = filteredLeaveApplications?.filter((application: any) => {
    const matchesSearch = application.user?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         application.user?.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         application.user?.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || statusFilter === 'all' || application.status === statusFilter;
    const matchesType = !typeFilter || typeFilter === 'all' || application.leave_type?.name === typeFilter;
    
    // Sandwich filter
    const matchesSandwich = !sandwichFilter || sandwichFilter === 'all' ||
      (sandwichFilter === 'sandwich' && application.is_sandwich_leave) ||
      (sandwichFilter === 'standard' && !application.is_sandwich_leave);
    
    // Date filter - using IST for consistent comparison
    const applicationDate = parseToISTDate(application.start_date);
    const matchesStartDate = !startDate || applicationDate >= parseToISTDate(startDate);
    const matchesEndDate = !endDate || applicationDate <= parseToISTDate(endDate);
    const matchesDate = matchesStartDate && matchesEndDate;
    
    return matchesSearch && matchesStatus && matchesType && matchesSandwich && matchesDate;
  });

  // Filter leave balances
  const filteredBalances = filteredLeaveBalances?.filter((balance: any) => {
    const matchesSearch = balance.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         balance.employee_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBalanceFilter = !balanceFilter || balanceFilter === 'all' ||
      (balanceFilter === 'positive' && (balance.remaining_days || 0) > 0) ||
      (balanceFilter === 'negative' && (balance.remaining_days || 0) < 0) ||
      (balanceFilter === 'zero' && (balance.remaining_days || 0) === 0);
    
    return matchesSearch && matchesBalanceFilter;
  });

  const getPriorityLevel = (application: any) => {
    const daysUntilStart = differenceInDays(parseToISTDate(application.start_date), getCurrentISTDate());
    if (daysUntilStart <= 3 && application.status === 'pending') return 'urgent';
    if (daysUntilStart <= 7 && application.status === 'pending') return 'high';
    return 'normal';
  };

  const handleExportApplications = () => {
    if (!filteredApplications) return;
    
    const headers = ['Employee Name', 'Employee ID', 'Email', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Reason', 'Status', 'Applied Date', 'Reviewed Date', 'Reviewed Time', 'Reviewed By', 'Comments'];
    const csvContent = [
      headers.join(','),
      ...filteredApplications.map((app: any) => [
        `"${app.user?.full_name || ''}"`,
        app.user?.employee_id || '',
        app.user?.email || '',
        app.leave_type?.name || '',
        app.start_date,
        app.end_date,
        Number(app.days_count),
        `"${app.reason}"`,
        app.status,
        formatDateForDisplay(app.applied_at, 'yyyy-MM-dd'),
        app.approved_at ? formatDateForDisplay(app.approved_at, 'yyyy-MM-dd') : '',
        app.approved_at ? formatDateForDisplay(app.approved_at, 'HH:mm') : '',
        `"${app.approved_by_user?.full_name || ''}"`,
        `"${app.comments || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leave_applications_${formatDateForDisplay(getCurrentISTDate(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleExportBalances = () => {
    if (!filteredBalances) return;
    
    const headers = ['Employee Name', 'Employee ID', 'Tenure (Months)', 'Monthly Rate', 'Allocated Days', 'Used Days', 'Remaining Days', 'Can Carry Forward', 'Anniversary Reset Date'];
    const csvContent = [
      headers.join(','),
      ...filteredBalances.map((balance: any) => [
        `"${balance.full_name || ''}"`,
        balance.employee_id || '',
        balance.tenure_months || 0,
        balance.monthly_rate || 0,
        balance.allocated_days || 0,
        balance.used_days || 0,
        balance.remaining_days || 0,
        balance.can_carry_forward ? 'Yes' : 'No',
        balance.anniversary_reset_date || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leave_balances_${formatDateForDisplay(getCurrentISTDate(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleAddHoliday = () => {
    if (!newHolidayName.trim() || !newHolidayDate) return;

    createHoliday.mutate({
      name: newHolidayName.trim(),
      date: newHolidayDate,
      is_optional: newHolidayIsOptional
    }, {
      onSuccess: () => {
        setIsAddHolidayDialogOpen(false);
        setNewHolidayName('');
        setNewHolidayDate('');
        setNewHolidayIsOptional(false);
      }
    });
  };

  // Calculate stats
  const totalApplications = filteredLeaveApplications?.length || 0;
  const pendingApplications = filteredLeaveApplications?.filter((app: any) => app.status === 'pending').length || 0;
  const approvedApplications = filteredLeaveApplications?.filter((app: any) => app.status === 'approved').length || 0;
  const urgentApplications = filteredLeaveApplications?.filter((app: any) => getPriorityLevel(app) === 'urgent').length || 0;

  const totalEmployees = filteredLeaveBalances?.length || 0;
  const negativeBalances = filteredLeaveBalances?.filter((balance: any) => (balance.remaining_days || 0) < 0).length || 0;
  const zeroBalances = filteredLeaveBalances?.filter((balance: any) => (balance.remaining_days || 0) === 0).length || 0;
  const averageBalance = totalEmployees > 0 
    ? (filteredLeaveBalances?.reduce((sum: number, balance: any) => sum + (balance.remaining_days || 0), 0) || 0) / totalEmployees 
    : 0;

  // Check if user has permission to access leave management
  // Grant access if user has page-level permissions OR employee permissions
  if (!hasPageAccess && !permissions.canViewAllEmployees && !permissions.canViewTeamEmployees) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
          <p className="text-muted-foreground">
            You don't have permission to access Leave Management.
          </p>
        </div>
      </div>
    );
  }

  if (applicationsLoading && balancesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leave Management</h1>
          <p className="text-muted-foreground">
            {permissions.accessLevel === 'all' 
              ? 'Manage employee leave applications and leave balances'
              : 'Manage leave applications and balances for your team members'
            }
          </p>
        </div>
        <div className="flex gap-2">
          {/* <Button 
            onClick={() => recalculateBalances.mutate(undefined, {
              onSuccess: (result) => {
                toast.success(`✅ ${result}`, {
                  duration: 5000,
                });
                // Refetch data to show updated balances
                window.location.reload();
              },
              onError: (error) => {
                toast.error(`Failed to recalculate balances: ${error.message}`);
              }
            })}
            variant="outline"
            disabled={recalculateBalances.isPending}
            className="text-blue-600 hover:text-blue-700"
          >
            <Calculator className="h-4 w-4 mr-2" />
            {recalculateBalances.isPending ? 'Recalculating...' : 'Recalculate Balances'}
          </Button> */}
          <Button 
            onClick={activeTab === 'applications' ? handleExportApplications : handleExportBalances} 
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            Export {activeTab === 'applications' ? 'Applications' : 'Balances'}
          </Button>
        </div>
      </div>

      {/* Enhanced Sandwich Leave System Info */}
      {/* <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Enhanced Sandwich Leave System Active:</strong> Leave balances are automatically calculated using sandwich leave rules. 
          Friday/Monday patterns, holiday exclusions, and approval-based deductions are now enforced. 
          Use "Recalculate Balances" to update existing approved applications with correct calculations.
        </AlertDescription>
      </Alert> */}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={`grid w-full ${
          // Managers (who can view team but not all) should only see "Leave Applications" tab
          permissions.canViewAllEmployees 
            ? 'grid-cols-6' 
            : permissions.canViewTeamEmployees 
              ? 'grid-cols-1' // Managers only see Leave Applications
              : 'grid-cols-4' // Regular employees see all except Holidays and Cron Settings
        }`}>
          <TabsTrigger value="applications" className="cursor-pointer">Leave Applications</TabsTrigger>
          {/* Hide Leave Balances, Adjustment History, and Withdrawal Logs for managers */}
          {permissions.canViewAllEmployees && (
            <>
              <TabsTrigger value="balances" className="cursor-pointer">Leave Balances</TabsTrigger>
              <TabsTrigger value="history" className="cursor-pointer">Adjustment History</TabsTrigger>
              <TabsTrigger value="withdrawals" className="cursor-pointer">Withdrawal Logs</TabsTrigger>
              <TabsTrigger value="holidays" className="cursor-pointer">Holidays</TabsTrigger>
              <TabsTrigger value="cron-settings" className="cursor-pointer">Cron Settings</TabsTrigger>
            </>
          )}
          {/* Regular employees (not managers, not admins) can see balances, history, and withdrawals but not holidays */}
          {!permissions.canViewAllEmployees && !permissions.canViewTeamEmployees && (
            <>
              <TabsTrigger value="balances" className="cursor-pointer">Leave Balances</TabsTrigger>
              <TabsTrigger value="history" className="cursor-pointer">Adjustment History</TabsTrigger>
              <TabsTrigger value="withdrawals" className="cursor-pointer">Withdrawal Logs</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="applications" className="space-y-6">
          {/* Applications Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalApplications}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingApplications}</div>
                <p className="text-xs text-muted-foreground">Awaiting approval</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Approved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{approvedApplications}</div>
                <p className="text-xs text-muted-foreground">This period</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Urgent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{urgentApplications}</div>
                <p className="text-xs text-muted-foreground">Needs immediate attention</p>
              </CardContent>
            </Card>
          </div>

          {/* Urgent Applications Alert */}
          {urgentApplications > 0 && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Urgent:</strong> {urgentApplications} leave application{urgentApplications > 1 ? 's' : ''} 
                {urgentApplications > 1 ? ' are' : ' is'} starting within 3 days and require immediate approval.
              </AlertDescription>
            </Alert>
          )}

          {/* Applications Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
                <div>
                <Label htmlFor="filter-user-name" className='mb-2 ml-2'>Employee Name</Label>
                  <Input
                    id='filter-user-name'
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                <Label htmlFor="status-filter" className='mb-2'>Application Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger >
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="withdrawn">Withdrawn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                <Label htmlFor="type-filter" className='mb-2'>Leave Type</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger >
                      <SelectValue placeholder="All Leave Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Leave Types</SelectItem>
                      <SelectItem value="Annual Leave">Annual Leave</SelectItem>
                      <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                      <SelectItem value="Casual Leave">Casual Leave</SelectItem>
                      <SelectItem value="Maternity Leave">Maternity Leave</SelectItem>
                      <SelectItem value="Paternity Leave">Paternity Leave</SelectItem>
                      <SelectItem value="Emergency Leave">Emergency Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                <Label htmlFor="sandwich-filter" className='mb-2'>Sandwich Status</Label>
                  <Select value={sandwichFilter} onValueChange={setSandwichFilter}>
                    <SelectTrigger >
                      <SelectValue placeholder="Sandwich Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="sandwich">Sandwich Leave</SelectItem>
                      <SelectItem value="standard">Standard Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                <Label htmlFor="start-date-filter" className='mb-2'>Start Date</Label>
                  <Input
                    type="date"
                    placeholder="Start Date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                <Label htmlFor="end-date-filter" className='mb-2'>End Date</Label>
                  <Input
                    type="date"
                    placeholder="End Date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className='mt-6'>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('');
                      setTypeFilter('');
                      setSandwichFilter('');
                      setStartDate('');
                      setEndDate('');
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leave Applications Table */}
          <Card>
            <CardHeader>
              <CardTitle>Leave Applications</CardTitle>
              <CardDescription>
                All employee leave applications requiring review and approval
              </CardDescription>
            </CardHeader>
            <CardContent>
              {applicationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Sandwich Status</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Reviewed</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApplications?.map((application: any) => {
                      const priority = getPriorityLevel(application);
                      return (
                        <TableRow key={application.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="font-medium">{application.user?.full_name}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{application.leave_type?.name}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <div className="font-medium">{formatDaysForDisplay(Number(application.days_count))}</div>
                              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 flex-wrap">
                                {application.is_half_day && (
                                  <span className="text-blue-600">
                                    {application.half_day_period === '1st_half' ? '1st half' : 
                                     application.half_day_period === '2nd_half' ? '2nd half' : 'Half Day'}
                                  </span>
                                )}
                                {application.lop_days != null && Number(application.lop_days) > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {formatDaysForDisplay(Number(application.lop_days))} LOP
                                  </Badge>
                                )}
                                {!application.is_half_day && (application.lop_days == null || Number(application.lop_days) === 0) && 'days'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{formatDateForDisplay(application.start_date, 'MMM dd')}</div>
                              <div className="text-muted-foreground">to {formatDateForDisplay(application.end_date, 'MMM dd, yyyy')}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {application.is_sandwich_leave ? (
                              <Badge className="bg-orange-100 text-orange-800 text-xs">
                                Sandwich
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-gray-600">
                                Standard
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(application.status)}
                              <Badge className={getStatusBadge(application.status)}>
                                {application.status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            {priority === 'urgent' && (
                              <Badge variant="destructive" className="text-xs">
                                Urgent
                              </Badge>
                            )}
                            {priority === 'high' && (
                              <Badge className="bg-orange-100 text-orange-800 text-xs">
                                High
                              </Badge>
                            )}
                            {priority === 'normal' && application.status === 'pending' && (
                              <Badge variant="outline" className="text-xs">
                                Normal
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{formatDateForDisplay(application.applied_at, 'MMM dd, yyyy')}</TableCell>
                          <TableCell>
                            {application.approved_at ? (
                              <div className="text-sm">
                                <div>{formatDateForDisplay(application.approved_at, 'MMM dd, yyyy')}</div>
                                <div className="text-muted-foreground text-xs">
                                  {formatDateForDisplay(application.approved_at, 'HH:mm')}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <LeaveApplicationActions application={application} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              {filteredApplications?.length === 0 && !applicationsLoading && (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Leave Applications Found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || statusFilter || typeFilter || sandwichFilter || startDate || endDate
                      ? 'No applications match your current filters.'
                      : 'No leave applications have been submitted yet.'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances" className="space-y-6">
          {/* Balance Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalEmployees}</div>
                <p className="text-xs text-muted-foreground">With leave balances</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Negative Balances</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{negativeBalances}</div>
                <p className="text-xs text-muted-foreground">Require attention</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Zero Balances</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{zeroBalances}</div>
                <p className="text-xs text-muted-foreground">No days remaining</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Average Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{averageBalance.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">Days per employee</p>
              </CardContent>
            </Card>
          </div>

          {/* Leave Rates Reference Section */}
          {employmentTermLeaveRates && employmentTermLeaveRates.length > 0 && (
            <Card className="bg-blue-50/50 border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  Leave Rates by Employment Term - Reference
                </CardTitle>
                <CardDescription className="text-xs">
                  Quick reference of leave rates configured for each employment term type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {employmentTermLeaveRates
                    .sort((a, b) => {
                      const order = ['full_time', 'part_time', 'associate', 'contract', 'probation/internship'];
                      return order.indexOf(a.employment_term) - order.indexOf(b.employment_term);
                    })
                    .map((rate) => (
                      <div
                        key={rate.employment_term}
                        className="flex flex-col p-3 bg-white rounded-lg border border-blue-100"
                      >
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {formatEmploymentTermName(rate.employment_term)}
                        </div>
                        <div className="mt-auto">
                          <div className="text-lg font-bold text-blue-600">
                            {rate.leave_rate.toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">days/month</div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Balance Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px] max-w-[300px]">
                  <Label htmlFor="employee-name-filter" className='mb-2'>Employee Name</Label>
                  <Input
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex-1 min-w-[200px] max-w-[300px]">
                  <Label htmlFor="balance-filter" className='mb-2'>Balance Status</Label>
                  <Select value={balanceFilter} onValueChange={setBalanceFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Balances" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Balances</SelectItem>
                      <SelectItem value="positive">Positive Balance</SelectItem>
                      <SelectItem value="zero">Zero Balance</SelectItem>
                      <SelectItem value="negative">Negative Balance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='mt-4'>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchTerm('');
                      setBalanceFilter('');
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leave Balances Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                {permissions.accessLevel === 'all' ? 'Employee Leave Balances' : 'Team Leave Balances'}
              </CardTitle>
              <CardDescription>
                {permissions.accessLevel === 'all' 
                  ? 'View and manage leave balances for all employees'
                  : 'View and manage leave balances for your team members'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {balancesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Tenure</TableHead>
                      {/* <TableHead>Monthly Rate</TableHead> */}
                      <TableHead>Rate of Leave</TableHead>
                      {/* <TableHead>Employment Term</TableHead> */}
                      <TableHead>Allocated</TableHead>
                      <TableHead>Used</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Comp Off Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBalances?.map((balance: any) => {
                      // Data validation and cleanup
                      const allocatedDays = Number(balance.allocated_days) || 0;
                      const usedDays = Number(balance.used_days) || 0;
                      const remainingDays = Number(balance.remaining_days) || 0;
                      const tenureMonths = Number(balance.tenure_months) || 0;
                      
                      // Calculate actual remaining if data seems inconsistent
                      const calculatedRemaining = allocatedDays - usedDays;
                      const displayRemaining = Math.abs(remainingDays - calculatedRemaining) > 0.1 ? calculatedRemaining : remainingDays;
                      
                      return (
                        <TableRow key={balance.user_id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>{balance.full_name?.charAt(0) || 'U'}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{balance.full_name || 'Unknown'}</div>
                                <div className="text-sm text-muted-foreground">
                                  ID: {balance.employee_id || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="font-medium">{tenureMonths}</div>
                            <div className="text-xs text-muted-foreground">months</div>
                          </TableCell>
                          {/* <TableCell className="text-center">
                            <div className="font-medium">{monthlyRate.toFixed(1)}</div>
                            <div className="text-xs text-muted-foreground">days/month</div>
                          </TableCell> */}
                          <TableCell className="text-center">
                            {(() => {
                              // Get leave rate from employment term (HR can't configure this)
                              const employmentTerm = balance.employment_terms || balance.user?.employment_terms;
                              const leaveRate = getLeaveRateByEmploymentTerm(employmentTerm);
                              return (
                                <div>
                                  <div className="font-medium">{leaveRate.toFixed(2)}</div>
                                  <div className="text-xs text-muted-foreground">days/month</div>
                                </div>
                              );
                            })()}
                          </TableCell>
                          {/* <TableCell className="text-center">
                            {(() => {
                              const employmentTerm = balance.employment_terms || balance.user?.employment_terms;
                              const termInfo = getEmploymentTermInfo(employmentTerm);
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center justify-center gap-1 cursor-help">
                                        <Info className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">{termInfo.term}</span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <div className="space-y-1">
                                        <div className="font-semibold">{termInfo.term}</div>
                                        <div className="text-xs">
                                          <div>Leave Rate: <strong>{termInfo.rate.toFixed(2)} days/month</strong></div>
                                          {termInfo.description && (
                                            <div className="mt-1 text-muted-foreground">{termInfo.description}</div>
                                          )}
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                          </TableCell> */}
                          <TableCell className="text-center">
                            <div className="font-medium">{allocatedDays}</div>
                            <div className="text-xs text-muted-foreground">allocated</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="font-medium">{usedDays.toFixed(1)}</div>
                            <div className="text-xs text-muted-foreground">used</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className={cn(
                              "font-medium",
                              displayRemaining < 0 ? "text-red-600" : 
                              displayRemaining === 0 ? "text-orange-600" : "text-green-600"
                            )}>
                              <div>{displayRemaining.toFixed(1)}</div>
                              <div className="text-xs text-muted-foreground">remaining</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className={cn(
                              "font-medium",
                              (balance.comp_off_balance || 0) > 0 ? "text-blue-600" : "text-gray-600"
                            )}>
                              <div>{(balance.comp_off_balance || 0).toFixed(1)}</div>
                              <div className="text-xs text-muted-foreground">comp off</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {allocatedDays === 0 ? (
                                <Badge variant="outline" className="text-xs text-gray-600">
                                  No Allocation
                                </Badge>
                              ) : (
                                <>
                                  {balance.can_carry_forward && (
                                    <Badge variant="secondary" className="text-xs">
                                      Can Carry Forward
                                    </Badge>     
                                  )}
                                  {tenureMonths < 9 && (
                                    <Badge variant="outline" className="text-xs text-orange-600">
                                      Salary Deduction
                                    </Badge>
                                  )}
                                </>
                              )}
                              {balance.is_anniversary_today && (
                                <Badge variant="destructive" className="text-xs">
                                  Anniversary Today
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {permissions.canEditAllEmployees && (
                              <Dialog 
                                open={isAdjustmentDialogOpen && selectedEmployeeForAdjustment?.user_id === balance.user_id}
                                onOpenChange={(open) => {
                                  setIsAdjustmentDialogOpen(open);
                                  if (!open) setSelectedEmployeeForAdjustment(null);
                                }}
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedEmployeeForAdjustment(balance);
                                      setIsAdjustmentDialogOpen(true);
                                    }}
                                  >
                                    <Calculator className="h-4 w-4 mr-2" />
                                    Adjust
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Adjust Leave Balance</DialogTitle>
                                  <DialogDescription>
                                    Manually adjust leave balance for {balance.full_name}
                                  </DialogDescription>
                                </DialogHeader>
                                <LeaveBalanceAdjustment 
                                  employee={balance}
                                  onClose={() => {
                                    setIsAdjustmentDialogOpen(false);
                                    setSelectedEmployeeForAdjustment(null);
                                  }}
                                />
                              </DialogContent>
                              </Dialog>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              {filteredBalances?.length === 0 && !balancesLoading && (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Leave Balances Found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || balanceFilter
                      ? 'No balances match your current filters.'
                      : 'No leave balances have been set up yet.'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          {/* Adjustment History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Leave Balance Adjustment History
              </CardTitle>
              <CardDescription>
                {permissions.accessLevel === 'all' 
                  ? 'Track all manual adjustments made to employee leave balances'
                  : 'Track all manual adjustments made to your team members\' leave balances'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : filteredAdjustmentHistory && filteredAdjustmentHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Adjustment</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Adjusted By</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAdjustmentHistory?.map((adjustment: any) => (
                      <TableRow key={adjustment.id}>
                        <TableCell>
                          <div className="font-medium">{adjustment.user?.full_name}</div>
                          <div className="text-sm text-muted-foreground">
                            ID: {adjustment.user?.employee_id}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {adjustment.leave_balance?.leave_type?.name || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className={cn(
                            "flex items-center gap-2 font-medium",
                            adjustment.adjustment_type === 'add' ? "text-green-600" : "text-red-600"
                          )}>
                            {adjustment.adjustment_type === 'add' ? (
                              <Plus className="h-4 w-4" />
                            ) : (
                              <Minus className="h-4 w-4" />
                            )}
                            {adjustment.amount} days
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {adjustment.previous_allocated} → {adjustment.new_allocated}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{adjustment.reason}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{adjustment.adjusted_by_user?.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {adjustment.adjusted_by_user?.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatDateForDisplay(adjustment.created_at, 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Adjustment History</h3>
                  <p className="text-muted-foreground">
                    No manual leave balance adjustments have been made yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-6">
          {/* Withdrawal Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Leave Withdrawal Logs
              </CardTitle>
              <CardDescription>
                {permissions.accessLevel === 'all' 
                  ? 'Track all leave applications that have been withdrawn by employees or administrators'
                  : 'Track leave applications withdrawn by your team members'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {withdrawalLogsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : filteredWithdrawalLogs && filteredWithdrawalLogs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Leave Details</TableHead>
                      <TableHead>Previous Status</TableHead>
                      <TableHead>Withdrawal Reason</TableHead>
                      <TableHead>Withdrawn By</TableHead>
                      <TableHead>Withdrawn Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWithdrawalLogs?.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="font-medium">{log.leave_application?.user?.full_name}</div>
                          <div className="text-sm text-muted-foreground">
                            ID: {log.leave_application?.user?.employee_id}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {log.leave_application?.leave_type?.name}
                              </Badge>
                              <span className="text-sm">
                                {formatDaysForDisplay(Number(log.leave_application?.days_count || 0))} days
                                {log.leave_application?.is_half_day && (
                                  <span className="ml-1 text-blue-600 text-xs">
                                    ({log.leave_application?.half_day_period === '1st_half' ? '1st half' : 
                                      log.leave_application?.half_day_period === '2nd_half' ? '2nd half' : 'Half Day'})
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDateForDisplay(log.leave_application?.start_date, 'MMM dd')} - {formatDateForDisplay(log.leave_application?.end_date, 'MMM dd, yyyy')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(log.previous_status)}>
                            {log.previous_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm max-w-xs truncate" title={log.withdrawal_reason}>
                            {log.withdrawal_reason}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{log.withdrawn_by_user?.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {log.withdrawn_by_user?.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatDateForDisplay(log.withdrawn_at, 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <RotateCcw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Withdrawal Logs</h3>
                  <p className="text-muted-foreground">
                    No leave applications have been withdrawn yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {permissions.canViewAllEmployees && (
          <TabsContent value="cron-settings" className="space-y-6">
          {/* Cron Settings Configuration */}
          <CronSettingsTab />
        </TabsContent>
        )}

        {permissions.canViewAllEmployees && (
          <TabsContent value="holidays" className="space-y-6">
          {/* Holiday Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarPlus className="h-5 w-5" />
                    Holiday Management
                  </CardTitle>
                  <CardDescription>
                    Manage company holidays and optional holidays for leave calculations
                  </CardDescription>
                </div>
                <Dialog open={isAddHolidayDialogOpen} onOpenChange={setIsAddHolidayDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Holiday
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Holiday</DialogTitle>
                      <DialogDescription>
                        Create a new holiday entry for the company calendar
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="holiday-name">Holiday Name</Label>
                        <Input
                          id="holiday-name"
                          placeholder="e.g., Diwali, Christmas, Independence Day"
                          value={newHolidayName}
                          onChange={(e) => setNewHolidayName(e.target.value)}
                          className='mt-2'
                        />
                      </div>
                      <div>
                        <Label htmlFor="holiday-date">Holiday Date</Label>
                        <Input
                          id="holiday-date"
                          type="date"
                          value={newHolidayDate}
                          onChange={(e) => setNewHolidayDate(e.target.value)}
                          className='mt-2'
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="holiday-optional"
                          checked={newHolidayIsOptional}
                          onCheckedChange={(checked) => setNewHolidayIsOptional(checked === true)}
                        />
                        <Label htmlFor="holiday-optional">Optional Holiday</Label>
                        <div className="text-xs text-muted-foreground ml-2">
                          (Won't affect sandwich leave calculations)
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setIsAddHolidayDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleAddHoliday}
                          disabled={!newHolidayName.trim() || !newHolidayDate || createHoliday.isPending}
                        >
                          {createHoliday.isPending ? 'Adding...' : 'Add Holiday'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {/* Year Filter */}
              <div className="mb-6">
                <div className="flex items-center gap-4">
                  <Label htmlFor="year-filter" className="text-sm font-medium">Filter by Year:</Label>
                  <Input
                    id="year-filter"
                    type="number"
                    value={holidayYear}
                    onChange={(e) => {
                      const year = parseInt(e.target.value);
                      if (!isNaN(year) && year >= 1900 && year <= 2100) {
                        setHolidayYear(year);
                      }
                    }}
                    placeholder="Enter year (e.g., 2024)"
                    className="w-48"
                    min="1900"
                    max="2100"
                  />
                  <div className="flex gap-2">
                    {[-1, 0, 1].map((offset) => {
                      const year = getCurrentISTDate().getFullYear() + offset;
                      return (
                        <Button
                          key={year}
                          variant={holidayYear === year ? "default" : "outline"}
                          size="sm"
                          onClick={() => setHolidayYear(year)}
                        >
                          {year}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Holidays Table */}
              {holidaysLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : holidays && holidays.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Holiday Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holidays.map((holiday: any) => {
                      const holidayDate = parseToISTDate(holiday.date);
                      const dayName = holidayDate.toLocaleDateString('en-US', { weekday: 'long' });
                      
                      return (
                        <TableRow key={holiday.id}>
                          <TableCell>
                            <div className="font-medium">{holiday.name}</div>
                          </TableCell>
                          <TableCell>
                            {formatDateForDisplay(holidayDate, 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{dayName}</Badge>
                          </TableCell>
                          <TableCell>
                            {holiday.is_optional ? (
                              <Badge className="bg-blue-100 text-blue-800">
                                Optional
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">
                                Mandatory
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (holiday.id) {
                                  deleteHoliday.mutate(holiday.id);
                                } else {
                                  toast.error('Holiday ID is missing');
                                }
                              }}
                              disabled={deleteHoliday.isPending}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <CalendarPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Holidays Found</h3>
                  <p className="text-muted-foreground">
                    No holidays have been added for {holidayYear}. Add holidays to help with accurate leave calculations.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>
    </div>
  );
}