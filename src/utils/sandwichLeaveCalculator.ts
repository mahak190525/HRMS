import { addDays, isWeekend, isAfter, isEqual } from 'date-fns';
import { parseToISTDate, formatDateForDisplay } from './dateUtils';

// Types for the calculation
export interface LeaveApplication {
  start_date: string;
  end_date: string;
  is_half_day?: boolean;
  half_day_period?: '1st_half' | '2nd_half';
  status: string;
  applied_at: string;
}

export interface Holiday {
  id?: string;
  date: string;
  name: string;
  is_optional?: boolean;
}

export interface SandwichLeaveResult {
  actualDays: number;
  deductedDays: number;
  isSandwichLeave: boolean;
  reason: string;
  details: {
    weekdays: number;
    weekends: number;
    holidays: number;
    sandwichDays: number;
  };
}

/**
 * Checks if a date is a Friday
 */
function isFriday(date: Date): boolean {
  return date.getDay() === 5;
}

/**
 * Checks if a date is a Monday
 */
function isMonday(date: Date): boolean {
  return date.getDay() === 1;
}

/**
 * Checks if a date is a national holiday
 */
function isHoliday(date: Date, holidays: Holiday[]): boolean {
  const dateStr = formatDateForDisplay(date, 'yyyy-MM-dd');
  return holidays.some(holiday => holiday.date === dateStr && !holiday.is_optional);
}

/**
 * Gets all dates between start and end (inclusive)
 */
function getDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate = addDays(currentDate, 1);
  }
  
  return dates;
}

/**
 * Counts weekdays (excluding weekends) in a date range
 */
function countWeekdays(dates: Date[]): number {
  return dates.filter(date => !isWeekend(date)).length;
}

/**
 * Counts weekends in a date range
 */
function countWeekends(dates: Date[]): number {
  return dates.filter(date => isWeekend(date)).length;
}

/**
 * Counts holidays in a date range
 */
function countHolidays(dates: Date[], holidays: Holiday[]): number {
  return dates.filter(date => isHoliday(date, holidays)).length;
}


/**
 * Checks if leave applications span Friday and Monday individually (non-continuous)
 */
function hasIndividualFridayMondayLeaves(applications: LeaveApplication[]): boolean {
  const fridayApplications = applications.filter(app => {
    const startDate = parseToISTDate(app.start_date);
    const endDate = parseToISTDate(app.end_date);
    return isFriday(startDate) && formatDateForDisplay(startDate, 'yyyy-MM-dd') === formatDateForDisplay(endDate, 'yyyy-MM-dd');
  });
  
  const mondayApplications = applications.filter(app => {
    const startDate = parseToISTDate(app.start_date);
    const endDate = parseToISTDate(app.end_date);
    return isMonday(startDate) && formatDateForDisplay(startDate, 'yyyy-MM-dd') === formatDateForDisplay(endDate, 'yyyy-MM-dd');
  });
  
  // Check if there are Friday and Monday applications that are consecutive
  for (const fridayApp of fridayApplications) {
    for (const mondayApp of mondayApplications) {
      const fridayDate = parseToISTDate(fridayApp.start_date);
      const mondayDate = parseToISTDate(mondayApp.start_date);
      const expectedMonday = addDays(fridayDate, 3); // Friday + 3 days = Monday
      
      if (formatDateForDisplay(mondayDate, 'yyyy-MM-dd') === formatDateForDisplay(expectedMonday, 'yyyy-MM-dd')) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Checks if an application was submitted without prior approval (sudden leave)
 */
function isSuddenLeave(application: LeaveApplication): boolean {
  const appliedDate = parseToISTDate(application.applied_at);
  const leaveStartDate = parseToISTDate(application.start_date);
  
  // If applied on the same day or after the leave start date, consider it sudden
  return isAfter(appliedDate, leaveStartDate) || isEqual(appliedDate, leaveStartDate);
}

/**
 * Main function to calculate sandwich leave deduction based on business rules
 */
export function calculateSandwichLeave(
  application: LeaveApplication,
  holidays: Holiday[],
  allUserApplications?: LeaveApplication[]
): SandwichLeaveResult {
  const startDate = parseToISTDate(application.start_date);
  const endDate = parseToISTDate(application.end_date);
  const dates = getDateRange(startDate, endDate);
  
  // Get day of week (0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday)
  const startDayOfWeek = startDate.getDay();
  const endDayOfWeek = endDate.getDay();
  
  // Count different types of days
  const weekdays = countWeekdays(dates);
  const weekends = countWeekends(dates);
  const holidayCount = countHolidays(dates, holidays);
  
  // Base calculation: weekdays minus holidays
  let actualWorkingDays = weekdays - holidayCount;
  
  // Handle half days
  if (application.is_half_day) {
    actualWorkingDays = 0.5;
  }
  
  let deductedDays = actualWorkingDays;
  let isSandwichLeave = false;
  let reason = 'Regular leave (actual working days excluding holidays)';
  let sandwichDays = 0;
  
  const dateRangeLength = dates.length;
  const isSuddenLeaveApplication = isSuddenLeave(application);
  
  // ========================================
  // SANDWICH LEAVE BUSINESS RULES
  // ========================================
  
  // Case 1: Friday + Saturday + Sunday (3 days) - Deduct 4 days
  if (startDayOfWeek === 5 && dateRangeLength === 3 && endDayOfWeek === 0) {
    isSandwichLeave = true;
    deductedDays = 4;
    sandwichDays = 4;
    reason = 'Sandwich leave: Friday + Saturday + Sunday (4 days deducted)';
  }
  
  // Case 2: Saturday + Sunday + Monday (3 days) - Deduct 4 days
  else if (startDayOfWeek === 6 && dateRangeLength === 3 && endDayOfWeek === 1) {
    isSandwichLeave = true;
    deductedDays = 4;
    sandwichDays = 4;
    reason = 'Sandwich leave: Saturday + Sunday + Monday (4 days deducted)';
  }
  
  // Case 3: Friday to Monday (continuous 4-day block) - Deduct 4 days
  else if (startDayOfWeek === 5 && endDayOfWeek === 1 && dateRangeLength === 4) {
    isSandwichLeave = true;
    deductedDays = 4;
    sandwichDays = 4;
    reason = 'Sandwich leave: Friday to Monday continuous (4 days deducted)';
  }
  
  // Case 4: Individual Friday and Monday leaves (non-continuous with 3-day gap)
  else if ((startDayOfWeek === 5 || startDayOfWeek === 1) && 
           formatDateForDisplay(startDate, 'yyyy-MM-dd') === formatDateForDisplay(endDate, 'yyyy-MM-dd')) {
    
    // Check if there's a corresponding Friday/Monday application exactly 3 days apart
    const hasPairApplication = allUserApplications && hasIndividualFridayMondayLeaves([application, ...allUserApplications]);
    
    if (hasPairApplication) {
      // Individual Friday/Monday sandwich pattern - treat as sandwich of 4 days total
      isSandwichLeave = true;
      deductedDays = 2; // Each application gets 2 days (total 4 across both)
      sandwichDays = 2;
      reason = 'Sandwich leave: Individual Friday/Monday pattern (2 days each, 4 total)';
    } else {
      // Single Friday or Monday without pair
      if (application.status === 'approved' && !isSuddenLeaveApplication) {
        // Rule 4: If leave is applied for only Friday or only Monday with prior approval, deduct only 1 day
        deductedDays = 1;
        reason = 'Single Friday/Monday leave (approved with prior approval - 1 day)';
      } else if (isSuddenLeaveApplication || application.status !== 'approved') {
        // Rule 5: If leave is unapproved or sudden (without approval), and for Friday or Monday, treat it as a sandwich of 3 days
        isSandwichLeave = true;
        deductedDays = 3;
        sandwichDays = 3;
        reason = 'Single Friday/Monday leave (unapproved/sudden - 3 days penalty)';
      } else {
        deductedDays = 1;
        reason = 'Single Friday/Monday leave (1 day)';
      }
    }
  }
  
  // For other single days, use actual working days
  else if (formatDateForDisplay(startDate, 'yyyy-MM-dd') === formatDateForDisplay(endDate, 'yyyy-MM-dd')) {
    deductedDays = actualWorkingDays;
    reason = 'Single day leave (actual working days)';
  }
  
  // Multi-day leaves that don't match sandwich patterns
  else {
    deductedDays = actualWorkingDays;
    reason = 'Regular leave (actual working days excluding holidays)';
  }
  
  // Ensure minimum deduction for half days
  if (application.is_half_day && deductedDays < 0.5) {
    deductedDays = 0.5;
  }
  
  return {
    actualDays: actualWorkingDays,
    deductedDays,
    isSandwichLeave,
    reason,
    details: {
      weekdays,
      weekends,
      holidays: holidayCount,
      sandwichDays
    }
  };
}

/**
 * Helper function to get all holidays for a year
 */
export async function getHolidaysForYear(): Promise<Holiday[]> {
  // This would typically be called from the API
  // For now, we'll return an empty array as a placeholder
  return [];
}

/**
 * Calculate total leave deduction for multiple applications
 */
export function calculateTotalLeaveDeduction(
  applications: LeaveApplication[],
  holidays: Holiday[]
): { totalDeducted: number; applications: Array<LeaveApplication & { calculation: SandwichLeaveResult }> } {
  let totalDeducted = 0;
  const calculatedApplications = applications.map(app => {
    const calculation = calculateSandwichLeave(app, holidays, applications);
    totalDeducted += calculation.deductedDays;
    return { ...app, calculation };
  });
  
  return {
    totalDeducted,
    applications: calculatedApplications
  };
}
