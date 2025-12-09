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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { differenceInDays, addYears, differenceInCalendarDays, subDays } from 'date-fns';
import { formatDateForDisplay, getCurrentISTDate } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { useUpcomingHolidays } from '@/hooks/useDashboard';
import { useLocation } from 'react-router-dom';
import { formatDateForDatabase, isPastDate } from '@/utils/dateUtils';
import { Gift } from 'lucide-react';
import { supabase } from '@/services/supabase';

const leaveTypeColors = {
  annual: 'bg-blue-500',
  sick: 'bg-red-500',
  casual: 'bg-green-500',
  maternity: 'bg-purple-500',
  paternity: 'bg-orange-500',
  emergency: 'bg-yellow-500',
  birthday: 'bg-pink-500',
  'birthday_leave': 'bg-pink-500',
};

export function LeaveApplication() {
  const { user, refreshUserRoles } = useAuth();
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
  
  // Refresh user data when component mounts to ensure comp_off_balance is up to date
  useEffect(() => {
    if (user?.id) {
      refreshUserRoles().catch(console.error);
    }
  }, []); // Only run once on mount
  
  const [selectedType, setSelectedType] = useState('');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState('');
  const [defaultTab, setDefaultTab] = useState('apply');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<'1st_half' | '2nd_half'>('1st_half');
  
  // Check if selected leave type is birthday leave
  const isBirthdayLeaveSelected = Boolean(selectedType && leaveTypes?.some(
    lt => lt.name.toLowerCase().replace(' ', '_') === selectedType && lt.name.toLowerCase().includes('birthday')
  ));
  
  // Auto-disable half day and set end date to start date when birthday leave is selected
  useEffect(() => {
    if (isBirthdayLeaveSelected) {
      setIsHalfDay(false);
      if (startDate) {
        setEndDate(startDate);
      }
    }
  }, [isBirthdayLeaveSelected, startDate]);
  
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

  // Helper function to check if a date is more than 7 days before today
  const isMoreThan7DaysPast = (date: Date): boolean => {
    const today = getCurrentISTDate();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = subDays(today, 7);
    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);
    return dateToCheck < sevenDaysAgo;
  };

  // Helper function to format days for display (always show 1 decimal place, but don't round)
  const formatDaysForDisplay = (days: number): string => {
    // Parse to ensure we have a valid number, then format to 1 decimal place
    const num = Number(days);
    if (isNaN(num)) return '0.0';
    // Use toFixed(1) to show one decimal place, but the actual value isn't rounded
    return num.toFixed(1);
  };

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

  // Check for duplicate/overlapping leave applications
  // Note: halfDayPeriodCheck is reserved for future use if we need to allow different half-day periods on the same day
  const checkForDuplicateLeave = (newStartDate: Date, newEndDate: Date, isHalfDayCheck: boolean, _halfDayPeriodCheck?: '1st_half' | '2nd_half') => {
    if (!leaveHistory || !user || leaveHistory.length === 0) return null;

    // Filter to only pending or approved leaves (exclude rejected, cancelled, withdrawn)
    const activeLeaves = leaveHistory.filter(
      (leave: any) => leave.status === 'pending' || leave.status === 'approved'
    );

    if (activeLeaves.length === 0) return null;

    // Convert dates to Date objects for comparison
    const newStart = new Date(newStartDate);
    const newEnd = new Date(newEndDate);
    newStart.setHours(0, 0, 0, 0);
    newEnd.setHours(0, 0, 0, 0);

    for (const existingLeave of activeLeaves) {
      const existingStart = new Date(existingLeave.start_date);
      const existingEnd = new Date(existingLeave.end_date);
      existingStart.setHours(0, 0, 0, 0);
      existingEnd.setHours(0, 0, 0, 0);

      // Check for date range overlap: two ranges overlap if start1 <= end2 AND start2 <= end1
      const hasDateOverlap = newStart <= existingEnd && existingStart <= newEnd;

      if (hasDateOverlap) {
        // Case 1: New leave is half day
        if (isHalfDayCheck) {
          // For half day, start and end dates should be the same
          const newDate = newStart.getTime();
          
          // Check if the new half day date falls within the existing leave range
          if (newDate >= existingStart.getTime() && newDate <= existingEnd.getTime()) {
            // If existing is also half day on the same date, it's a conflict regardless of period
            // (user can't apply for the same day more than once)
            if (existingLeave.is_half_day && existingStart.getTime() === existingEnd.getTime() && existingStart.getTime() === newDate) {
              return existingLeave;
            } else if (!existingLeave.is_half_day) {
              // Existing is full day - conflict
              return existingLeave;
            }
          }
        } 
        // Case 2: New leave is full day
        else {
          // If existing is half day, check if it falls within the new range
          if (existingLeave.is_half_day) {
            // For half day, start and end dates should be the same
            const existingDate = existingStart.getTime();
            if (existingDate >= newStart.getTime() && existingDate <= newEnd.getTime()) {
              // Half day falls within full day range - conflict
              return existingLeave;
            }
          } else {
            // Both are full day leaves and dates overlap - conflict
            return existingLeave;
          }
        }
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !startDate || !endDate || !reason.trim() || !user) return;

    // Validate that start date is not more than 7 days in the past
    if (isMoreThan7DaysPast(startDate)) {
      toast.error('You can only apply for backdated leave up to 7 days from today. Please select a date within the allowed range.');
      return;
    }

    // Validate that end date is not more than 7 days in the past
    if (endDate && isMoreThan7DaysPast(endDate)) {
      toast.error('End date cannot be more than 7 days in the past. Please select a date within the allowed range.');
      return;
    }

    const leaveType = leaveTypes?.find(lt => lt.name.toLowerCase().replace(' ', '_') === selectedType);
    if (!leaveType) {
      toast.error('Invalid leave type selected');
      return;
    }

    const daysRequested = calculateDays();

    // Check for duplicate/overlapping leave applications
    const duplicateLeave = checkForDuplicateLeave(startDate, endDate, isHalfDay, halfDayPeriod);
    if (duplicateLeave) {
      const duplicateDateStr = formatDateForDisplay(duplicateLeave.start_date, 'MMM dd, yyyy');
      if (duplicateLeave.start_date !== duplicateLeave.end_date) {
        const duplicateEndDateStr = formatDateForDisplay(duplicateLeave.end_date, 'MMM dd, yyyy');
        toast.error(
          `You already have a ${duplicateLeave.status} leave application for ${duplicateDateStr} - ${duplicateEndDateStr}. ` +
          `Please withdraw the existing application first if you need to make changes.`
        );
      } else {
        const halfDayInfo = duplicateLeave.is_half_day 
          ? ` (${duplicateLeave.half_day_period === '1st_half' ? '1st half' : '2nd half'})`
          : '';
        toast.error(
          `You already have a ${duplicateLeave.status} leave application for ${duplicateDateStr}${halfDayInfo}. ` +
          `Please withdraw the existing application first if you need to make changes.`
        );
      }
      return;
    }
    
    // Check if this is birthday leave and validate
    const isBirthdayLeave = leaveType.name.toLowerCase().includes('birthday');
    const isCompensatoryOff = leaveType.name.toLowerCase().includes('compensatory') || leaveType.name.toLowerCase().includes('comp off');
    
    if (isBirthdayLeave) {
      // Validate that user has a birthday set
      if (!user.date_of_birth) {
        toast.error('Cannot apply for birthday leave: Your date of birth is not set in the system. Please contact HR.');
        return;
      }
      
      // Validate that the leave date matches the birthday
      const userBirthday = new Date(user.date_of_birth);
      const leaveDate = new Date(startDate!);
      
      // Compare month and day (ignore year)
      if (userBirthday.getMonth() !== leaveDate.getMonth() || userBirthday.getDate() !== leaveDate.getDate()) {
        const birthdayMonth = userBirthday.toLocaleDateString('en-US', { month: 'long' });
        const birthdayDay = userBirthday.getDate();
        toast.error(`Birthday leave can only be availed on your birthday (${birthdayMonth} ${birthdayDay}). Please select your birthday date.`);
        return;
      }
      
      // Validate that start_date and end_date are the same
      if (startDate && endDate && startDate.getTime() !== endDate.getTime()) {
        toast.error('Birthday leave can only be applied for a single day. Start date and end date must be the same.');
        return;
      }
      
      // Validate that it's not a half day
      if (isHalfDay) {
        toast.error('Birthday leave must be a full day leave. Half day is not allowed.');
        return;
      }
      
      // For birthday leave, skip balance checks (paid leave, no deduction)
      // Proceed directly to submission
    }
    // Check if this is compensatory off and validate balance
    else if (isCompensatoryOff) {
      const compOffBalance = user.comp_off_balance || 0;
      if (compOffBalance <= 0) {
        toast.error('You do not have any compensatory off balance available');
        return;
      }
      if (daysRequested > compOffBalance) {
        toast.error(`You only have ${compOffBalance} day(s) of compensatory off balance available`);
        return;
      }
      // For compensatory off, skip regular leave balance checks and proceed directly
    } 
    // Skip balance checks for birthday leave (already handled above)
    else if (!isBirthdayLeave) {
      // Use enhanced balance information if available (only for non-compensatory leaves)
      const remainingDays = leaveSummary?.success 
        ? (leaveSummary.balance?.remaining_days != null ? Number(leaveSummary.balance.remaining_days) : totalRemainingDays)
        : totalRemainingDays;
      
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
    }

    // Calculate LOP days based on monthly leave rate usage for the application month
    let lopDays = 0;
    if (!isBirthdayLeave && !isCompensatoryOff) {
      const remainingDays = leaveSummary?.success 
        ? (leaveSummary.balance?.remaining_days != null ? Number(leaveSummary.balance.remaining_days) : totalRemainingDays)
        : totalRemainingDays;
      
      // Get leave rate from leaveBalance (rate_of_leave field)
      const mainLeaveBalance = leaveBalance?.find(lb => 
        lb.leave_type?.name?.toLowerCase().includes('annual') || 
        lb.leave_type?.name?.toLowerCase().includes('total')
      ) || leaveBalance?.[0];
      
      // Access rate_of_leave from the balance record
      const leaveRate = (mainLeaveBalance as any)?.rate_of_leave || 0;
      
      // Get the month and year of the leave application
      const leaveMonth = startDate.getMonth() + 1; // JavaScript months are 0-indexed
      const leaveYear = startDate.getFullYear();
      
      // Calculate how much of the monthly leave rate has been used this month
      // IMPORTANT: Check ALL existing approved leaves for this month to determine remaining monthly rate
      // Only non-LOP days from approved leaves count against the monthly rate
      let monthlyRateUsed = 0;
      let remainingMonthlyRate = 0;
      
      if (leaveRate > 0 && user?.id) {
        try {
          // Get compensatory off and birthday leave type IDs to exclude (these don't count against monthly rate)
          const { data: leaveTypesData } = await supabase
            .from('leave_types')
            .select('id, name');
          
          const compOffTypeId = leaveTypesData?.find(lt => 
            lt.name.toLowerCase().includes('compensatory') || lt.name.toLowerCase().includes('comp off')
          )?.id;
          
          const birthdayLeaveTypeId = leaveTypesData?.find(lt => 
            lt.name.toLowerCase() === 'birthday leave'
          )?.id;
          
          // Query ALL approved leaves for this month (excluding compensatory off and birthday leave)
          // This tells us how much of the monthly rate has already been consumed
          let query = supabase
            .from('leave_applications')
            .select('days_count, lop_days, leave_type_id, start_date')
            .eq('user_id', user.id)
            .eq('status', 'approved')
            .filter('start_date', 'gte', `${leaveYear}-${String(leaveMonth).padStart(2, '0')}-01`)
            .filter('start_date', 'lt', leaveMonth === 12 
              ? `${leaveYear + 1}-01-01` 
              : `${leaveYear}-${String(leaveMonth + 1).padStart(2, '0')}-01`);
          
          // Exclude compensatory off and birthday leave from monthly rate calculation
          if (compOffTypeId) {
            query = query.neq('leave_type_id', compOffTypeId);
          }
          if (birthdayLeaveTypeId) {
            query = query.neq('leave_type_id', birthdayLeaveTypeId);
          }
          
          const { data: monthlyLeaves, error } = await query;
          
          if (!error && monthlyLeaves) {
            // Sum up only non-LOP days from approved leaves
            // LOP days don't count against monthly rate, so we subtract them
            monthlyRateUsed = monthlyLeaves.reduce((sum: number, leave: any) => {
              const daysUsed = Number(leave.days_count) || 0;
              const lopDaysInLeave = Number(leave.lop_days) || 0;
              // Only count non-LOP days against the monthly rate
              // Example: If a leave has 2.0 days_count and 0.5 lop_days, only 1.5 counts against monthly rate
              return sum + Math.max(0, daysUsed - lopDaysInLeave);
            }, 0);
          }
          
          // Calculate remaining monthly rate available for this month
          // This is what can still be used from the monthly allocation
          remainingMonthlyRate = Math.max(0, leaveRate - monthlyRateUsed);
          
        } catch (error) {
          console.error('Error calculating monthly leave usage:', error);
          // On error, assume monthly rate is exhausted to be safe
          remainingMonthlyRate = 0;
        }
      }
      
      // Priority order for covering leave days:
      // 1) Use positive balance first (if available)
      // 2) Then use remaining monthly rate (if available and not exhausted by existing approved leaves)
      // 3) Mark remainder as LOP (only what can't be covered by balance or monthly rate)
      let daysCoveredByBalance = 0;
      let daysCoveredByRate = 0;
      let daysAsLOP = 0;
      
      // Step 1: Use positive balance first (if available)
      // This uses the accumulated leave balance from previous allocations
      if (remainingDays > 0) {
        daysCoveredByBalance = Math.min(remainingDays, daysRequested);
      }
      
      // Step 2: Calculate what's left after using balance
      const remainingAfterBalance = daysRequested - daysCoveredByBalance;
      
      // Step 3: Use remaining monthly rate for the remainder (if available)
      // remainingMonthlyRate already accounts for existing approved leaves for this month
      // Only use it if there's still rate available after checking existing approved leaves
      if (remainingAfterBalance > 0 && leaveRate > 0 && remainingMonthlyRate > 0) {
        daysCoveredByRate = Math.min(remainingMonthlyRate, remainingAfterBalance);
      }
      
      // Step 4: Mark the remainder as LOP
      // This is what can't be covered by either balance or monthly rate
      const remainingAfterRate = remainingAfterBalance - daysCoveredByRate;
      if (remainingAfterRate > 0) {
        daysAsLOP = remainingAfterRate;
      }
      
      lopDays = daysAsLOP;
      
      // Provide appropriate user feedback
      if (lopDays > 0) {
        if (daysCoveredByBalance > 0 && daysCoveredByRate > 0) {
          // Used both balance and rate, still have LOP
          toast.warning(
            `This leave will use ${formatDaysForDisplay(daysCoveredByBalance)} day(s) from your balance, ` +
            `${formatDaysForDisplay(daysCoveredByRate)} day(s) from your monthly leave rate, ` +
            `and ${formatDaysForDisplay(lopDays)} day(s) will be marked as Loss of Pay (LOP).`
          );
        } else if (daysCoveredByBalance > 0 && daysCoveredByRate === 0) {
          // Used balance, but rate exhausted or not available, have LOP
          if (leaveRate > 0 && remainingMonthlyRate <= 0) {
            toast.warning(
              `This leave will use ${formatDaysForDisplay(daysCoveredByBalance)} day(s) from your balance. ` +
              `You have already used your monthly leave rate (${formatDaysForDisplay(leaveRate)} days) for ${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}. ` +
              `${formatDaysForDisplay(lopDays)} day(s) will be marked as Loss of Pay (LOP).`
            );
          } else {
            toast.warning(
              `This leave will use ${formatDaysForDisplay(daysCoveredByBalance)} day(s) from your balance. ` +
              `${formatDaysForDisplay(lopDays)} day(s) will be marked as Loss of Pay (LOP).`
            );
          }
        } else if (daysCoveredByBalance === 0 && daysCoveredByRate > 0) {
          // No balance, used rate, have LOP
          toast.warning(
            `This leave will use ${formatDaysForDisplay(daysCoveredByRate)} day(s) from your monthly leave rate. ` +
            `${formatDaysForDisplay(lopDays)} day(s) will be marked as Loss of Pay (LOP).`
          );
        } else {
          // No balance, no rate (or exhausted), all LOP
          if (leaveRate > 0 && remainingMonthlyRate <= 0) {
            toast.warning(
              `You have already used your monthly leave rate (${formatDaysForDisplay(leaveRate)} days) for ${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}. ` +
              `All ${formatDaysForDisplay(lopDays)} day(s) will be marked as Loss of Pay (LOP) and will not be deducted from your leave balance.`
            );
          } else {
            toast.warning(
              `All ${formatDaysForDisplay(lopDays)} day(s) will be marked as Loss of Pay (LOP).`
            );
          }
        }
      } else if (daysCoveredByRate > 0 && remainingDays < daysRequested) {
        // Used rate to cover shortfall, no LOP
        toast.info(
          `This leave will use ${formatDaysForDisplay(daysCoveredByBalance)} day(s) from your balance. ` +
          `The remaining ${formatDaysForDisplay(daysCoveredByRate)} day(s) will be covered by your monthly leave rate (${formatDaysForDisplay(remainingMonthlyRate)} days remaining this month).`
        );
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
      status: 'pending',
      applied_at: getCurrentISTDate().toISOString(),
      lop_days: lopDays > 0 ? lopDays : undefined
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

  const totalLeaveBalance = leaveBalance?.reduce((sum, lb) => sum + (Number(lb.allocated_days) || 0), 0) || 0;
  const usedLeave = leaveBalance?.reduce((sum, lb) => sum + (Number(lb.used_days) || 0), 0) || 0;
  const totalRemainingDays = leaveBalance?.reduce((sum, lb) => {
    const remaining = lb.remaining_days != null ? Number(lb.remaining_days) : 0;
    return sum + remaining;
  }, 0) || 0;

  // Calculate next birthday and check if it's within 15 days
  const getBirthdayReminderInfo = () => {
    if (!user?.date_of_birth) return null;

    const today = getCurrentISTDate();
    const birthDate = new Date(user.date_of_birth);
    
    // Get this year's birthday
    const currentYear = today.getFullYear();
    let nextBirthday = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
    
    // If birthday has already passed this year, use next year's birthday
    if (nextBirthday < today) {
      nextBirthday = addYears(nextBirthday, 1);
    }
    
    // Calculate days until birthday
    const daysUntilBirthday = differenceInCalendarDays(nextBirthday, today);
    
    // Show banner if birthday is within 15 days (0 to 15 days)
    if (daysUntilBirthday >= 0 && daysUntilBirthday <= 15) {
      return {
        daysUntil: daysUntilBirthday,
        birthdayDate: nextBirthday,
        isToday: daysUntilBirthday === 0,
        isTomorrow: daysUntilBirthday === 1
      };
    }
    
    return null;
  };

  const birthdayReminder = getBirthdayReminderInfo();

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

      {/* Birthday Leave Reminder Banner */}
      {birthdayReminder && (
        <Alert className="bg-gradient-to-r from-pink-50 to-purple-50 border-2 border-pink-300 shadow-lg max-w-2/3">
          <Gift className="h-5 w-5 text-pink-600 flex-shrink-0" />
          <AlertDescription className="text-pink-900 min-w-0 max-w-full overflow-visible">
            <div className="flex flex-col items-left w-full min-w-0">
              <div className="flex-1 min-w-0 pr-0 sm:pr-2">
                <strong className="text-base sm:text-lg block break-words">
                  {birthdayReminder.isToday 
                    ? "🎉 Happy Birthday! 🎉" 
                    : birthdayReminder.isTomorrow
                    ? "Your birthday is tomorrow!"
                    : `Your birthday is in ${birthdayReminder.daysUntil} day${birthdayReminder.daysUntil !== 1 ? 's' : ''}!`}
                </strong>
                <p className="mt-1 text-xs sm:text-sm break-words leading-relaxed">
                  You can apply for a <strong>paid Birthday Leave</strong> on{' '}
                  <strong>{formatDateForDisplay(birthdayReminder.birthdayDate, 'MMMM do, yyyy')}</strong>. 
                  This is a paid leave that does not deduct from your leave balance!
                </p>
              </div>
              <Button
                variant="outline"
                className="bg-pink-100 hover:bg-pink-200 border-pink-300 text-pink-900 font-semibold mt-2 w-1/4 sm:flex-shrink-0 text-sm sm:text-base px-3 sm:px-4"
                onClick={() => {
                  // Switch to "Apply for Leave" tab
                  setDefaultTab('apply');
                  
                  // Auto-select birthday leave and set the date
                  const birthdayLeaveType = leaveTypes?.find(
                    lt => lt.name.toLowerCase().includes('birthday')
                  );
                  if (birthdayLeaveType) {
                    const typeKey = birthdayLeaveType.name.toLowerCase().replace(' ', '_');
                    setSelectedType(typeKey);
                    setStartDate(birthdayReminder.birthdayDate);
                    setEndDate(birthdayReminder.birthdayDate);
                    setIsHalfDay(false);
                    
                    // Scroll to form after tab switch (with longer delay to ensure tab is visible)
                    setTimeout(() => {
                      document.getElementById('leave-application-form')?.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                      });
                    }, 300);
                  }
                }}
              >
                Apply for Birthday Leave
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

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
                  <form id="leave-application-form" onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <Label htmlFor="leaveType">Leave Type</Label>
                      <Select value={selectedType} onValueChange={setSelectedType}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select leave type" />
                        </SelectTrigger>
                        <SelectContent>
                          {leaveTypes?.map((type) => {
                            const typeKey = type.name.toLowerCase().replace(' ', '_');
                            const isCompensatoryOff = type.name.toLowerCase().includes('compensatory') || type.name.toLowerCase().includes('comp off');
                            const isBirthdayLeave = type.name.toLowerCase().includes('birthday');
                            const compOffBalance = user?.comp_off_balance || 0;
                            
                            // Only show compensatory off if user has balance
                            if (isCompensatoryOff && compOffBalance <= 0) {
                              return null;
                            }
                            
                            return (
                            <SelectItem key={type.id} value={typeKey}>
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${leaveTypeColors[typeKey as keyof typeof leaveTypeColors] || 'bg-gray-500'}`} />
                                {type.name}
                                {isCompensatoryOff && compOffBalance > 0 && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({compOffBalance} available)
                                  </span>
                                )}
                                {isBirthdayLeave && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    (Paid leave, no balance deduction)
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {isBirthdayLeaveSelected && user?.date_of_birth && (
                        <Alert className="mt-2 bg-pink-50 border-pink-200">
                          <Info className="h-4 w-4 text-pink-600" />
                          <AlertDescription className="text-pink-800">
                            <strong>Birthday Leave:</strong> This leave can only be availed on your birthday (
                            {new Date(user.date_of_birth).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}). 
                            It is a paid leave and does not deduct from your leave balance.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="halfDay" 
                          checked={isHalfDay}
                          disabled={isBirthdayLeaveSelected}
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
                          className={cn(
                            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                            isBirthdayLeaveSelected && "opacity-50"
                          )}
                        >
                          Half Day Leave (0.5 days)
                          {isBirthdayLeaveSelected && (
                            <span className="text-xs text-muted-foreground ml-1">(Not available for birthday leave)</span>
                          )}
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
                              {startDate ? formatDateForDisplay(startDate, "PPP") : (isHalfDay ? "Pick date" : "Pick start date")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={startDate}
                              onSelect={(date) => {
                                setStartDate(date);
                                // For half day or birthday leave, automatically set end date to same as start date
                                if ((isHalfDay || isBirthdayLeaveSelected) && date) {
                                  setEndDate(date);
                                }
                              }}
                              disabled={(date) => isMoreThan7DaysPast(date)}
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
                                  !endDate && "text-muted-foreground",
                                  isBirthdayLeaveSelected && "opacity-50 cursor-not-allowed"
                                )}
                                disabled={isBirthdayLeaveSelected}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDate ? formatDateForDisplay(endDate, "PPP") : "Pick end date"}
                                {isBirthdayLeaveSelected && " (Same as start date)"}
                              </Button>
                            </PopoverTrigger>
                              {!isBirthdayLeaveSelected && (
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={endDate}
                                  onSelect={setEndDate}
                                  disabled={(date) => {
                                    // Disable dates more than 7 days in the past
                                    if (isMoreThan7DaysPast(date)) return true;
                                    // Disable dates before start date
                                    if (startDate && date < startDate) return true;
                                    return false;
                                  }}
                                  initialFocus
                                />
                              </PopoverContent>
                            )}
                          </Popover>
                        </div>
                      )}
                    </div>

                    {startDate && (isHalfDay || endDate) && (
                      <>
                        {/* Backdated Leave Warning */}
                        {isPastDate(startDate) && !isMoreThan7DaysPast(startDate) && (
                          <Alert className="bg-amber-50 border-amber-200">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-800">
                              <strong>Backdated Leave:</strong> You are applying for a leave that has already passed. 
                              Backdated leave applications are allowed up to 7 days from today. Your leave balance will be deducted accordingly.
                            </AlertDescription>
                          </Alert>
                        )}
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            Total days requested: <strong>{formatDaysForDisplay(calculateDays())} {calculateDays() === 1 ? 'day' : 'days'}</strong>
                            {isHalfDay && (
                              <span className="text-muted-foreground ml-2">
                                ({halfDayPeriod === '1st_half' ? '1st Half' : '2nd Half'} on {formatDateForDisplay(startDate, "PPP")})
                              </span>
                            )}
                          </AlertDescription>
                        </Alert>
                      </>
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
                    onClick={() => {
                      recalculateBalance.mutate(user?.id || '');
                      // Also refresh user data to get updated comp_off_balance
                      refreshUserRoles().catch(console.error);
                    }}
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
                        {(() => {
                          // Use actual remaining_days from database for accurate progress calculation
                          const allocatedDays = leaveSummary.balance?.allocated_days || totalLeaveBalance;
                          const remainingDays = leaveBalance && leaveBalance.length > 0 
                            ? totalRemainingDays 
                            : (leaveSummary?.balance?.remaining_days != null 
                              ? Number(leaveSummary.balance.remaining_days) 
                              : (totalLeaveBalance - usedLeave));
                          const progressValue = allocatedDays > 0 
                            ? Math.max(0, Math.min(100, (remainingDays / allocatedDays) * 100)) 
                            : 0;
                          return <Progress value={progressValue} />;
                        })()}
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
                          {(() => {
                            // Prioritize leaveBalance data (direct from database) to ensure negative values are shown correctly
                            // Then fallback to leaveSummary, then calculated value
                            let remaining: number;
                            if (leaveBalance && leaveBalance.length > 0) {
                              // Sum remaining_days from all leave types (this will correctly show negative values)
                              remaining = totalRemainingDays;
                            } else if (leaveSummary?.balance?.remaining_days != null) {
                              // Use the actual remaining_days from database (may be negative)
                              remaining = Number(leaveSummary.balance.remaining_days);
                            } else {
                              // Fallback calculation (should match database value)
                              remaining = totalLeaveBalance - usedLeave;
                            }
                            return (
                              <span className={cn(
                                "font-medium",
                                remaining < 0 ? "text-red-600" : "text-green-600"
                              )}>
                                {remaining} days
                                {remaining < 0 && (
                                  <span className="text-xs text-red-500 ml-1">(over limit)</span>
                                )}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      
                      {/* Compensatory Off Balance */}
                      <div className="border-t pt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Compensatory Off Balance</span>
                          <span className={cn(
                            "font-medium",
                            (user?.comp_off_balance || 0) > 0 ? "text-blue-600" : "text-gray-600"
                          )}>
                            {user?.comp_off_balance || 0} days
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
                        <Progress value={totalLeaveBalance > 0 ? Math.max(0, Math.min(100, (totalRemainingDays / totalLeaveBalance) * 100)) : 0} />
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
                          <span className={cn(
                            "font-medium",
                            totalRemainingDays < 0 ? "text-red-600" : "text-green-600"
                          )}>
                            {totalRemainingDays} days
                            {totalRemainingDays < 0 && (
                              <span className="text-xs text-red-500 ml-1">(over limit)</span>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      {/* Compensatory Off Balance */}
                      <div className="border-t pt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Compensatory Off Balance</span>
                          <span className={cn(
                            "font-medium",
                            (user?.comp_off_balance || 0) > 0 ? "text-blue-600" : "text-gray-600"
                          )}>
                            {user?.comp_off_balance || 0} days
                          </span>
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
                          <Badge variant="outline">{formatDateForDisplay(holiday.date, 'MMM dd')}</Badge>
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
                    All employees on leave today and upcoming days. LOP (Loss of Pay) days are marked in red.
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
                                {formatDateForDisplay(leave.start_date, 'MMM dd')} - {formatDateForDisplay(leave.end_date, 'MMM dd')}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="secondary" className="text-xs">
                                {formatDaysForDisplay(Number(leave.days_count))} day{Number(leave.days_count) !== 1 ? 's' : ''}
                                {leave.is_half_day && (
                                  leave.half_day_period === '1st_half' ? ' (1st half)' : 
                                  leave.half_day_period === '2nd_half' ? ' (2nd half)' : ' (Half Day)'
                                )}
                              </Badge>
                              {leave.lop_days != null && Number(leave.lop_days) > 0 && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="destructive" className="text-xs cursor-help">
                                        {formatDaysForDisplay(Number(leave.lop_days))} LOP
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <p className="font-medium mb-1">Loss of Pay (LOP)</p>
                                      <p className="text-xs">
                                        {formatDaysForDisplay(Number(leave.lop_days))} day(s) will be deducted from salary as this leave exceeds the available balance.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
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
              <>
                {leaveBalance?.map((balance) => {
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
                        {(() => {
                          const remainingDays = balance.remaining_days != null ? Number(balance.remaining_days) : 0;
                          const allocatedDays = balance.allocated_days != null ? Number(balance.allocated_days) : 0;
                          return (
                            <>
                              <div className={cn(
                                "text-3xl font-bold mb-2",
                                remainingDays < 0 ? "text-red-600" : ""
                              )}>
                                {remainingDays}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {remainingDays < 0 ? "days over limit" : "days available"}
                              </p>
                              <Progress 
                                value={allocatedDays > 0 
                                  ? Math.max(0, Math.min(100, (remainingDays / allocatedDays) * 100))
                                  : 0} 
                                className="mt-3" 
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                {balance.used_days} days used this year
                              </p>
                            </>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  );
                })}
                
                {/* Comp Off Balance Card */}
                {user?.comp_off_balance !== undefined && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <div className="w-4 h-4 rounded-full bg-blue-500" />
                        Compensatory Off
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={cn(
                        "text-3xl font-bold mb-2",
                        (user.comp_off_balance || 0) > 0 ? "text-blue-600" : "text-gray-600"
                      )}>
                        {user.comp_off_balance || 0}
                      </div>
                      <p className="text-sm text-muted-foreground">days available</p>
                      <Progress 
                        value={100} 
                        className="mt-3 bg-blue-100" 
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Compensatory off balance
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
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
                          {formatDateForDisplay(leave.start_date, 'MMM dd')} - {formatDateForDisplay(leave.end_date, 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{formatDaysForDisplay(Number(leave.days_count))}</span>
                            {leave.is_half_day && (
                              <Badge variant="outline" className="text-xs">
                                {leave.half_day_period === '1st_half' ? '1st half' : 
                                 leave.half_day_period === '2nd_half' ? '2nd half' : 'Half Day'}
                              </Badge>
                            )}
                            {leave.lop_days != null && Number(leave.lop_days) > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {formatDaysForDisplay(Number(leave.lop_days))} LOP
                              </Badge>
                            )}
                          </div>
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
                        <TableCell>{formatDateForDisplay(leave.applied_at, 'MMM dd, yyyy')}</TableCell>
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
                      {formatDaysForDisplay(Number(selectedLeaveForWithdraw.days_count))} day{Number(selectedLeaveForWithdraw.days_count) !== 1 ? 's' : ''}
                      {selectedLeaveForWithdraw.is_half_day && (
                        selectedLeaveForWithdraw.half_day_period === '1st_half' ? ' (1st half)' : 
                        selectedLeaveForWithdraw.half_day_period === '2nd_half' ? ' (2nd half)' : ' (Half Day)'
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Start Date:</span>
                    <span className="ml-2">{formatDateForDisplay(selectedLeaveForWithdraw.start_date, 'MMM dd, yyyy')}</span>
                  </div>
                  <div>
                    <span className="font-medium">End Date:</span>
                    <span className="ml-2">{formatDateForDisplay(selectedLeaveForWithdraw.end_date, 'MMM dd, yyyy')}</span>
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