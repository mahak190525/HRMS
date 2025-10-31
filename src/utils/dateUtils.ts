/**
 * Date utility functions for consistent IST (Indian Standard Time) handling
 * IST is UTC+5:30
 */

import { format } from 'date-fns';

// IST timezone offset in minutes (5 hours 30 minutes = 330 minutes)
const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * Get current date in IST timezone
 */
export function getCurrentISTDate(): Date {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (IST_OFFSET_MINUTES * 60000));
  return ist;
}

/**
 * Convert a Date object to IST date string in YYYY-MM-DD format
 * This ensures the date is always formatted in IST timezone
 */
export function formatDateForDatabase(date: Date): string {
  const istDate = convertToIST(date);
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert any Date object to IST timezone
 */
export function convertToIST(date: Date): Date {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (IST_OFFSET_MINUTES * 60000));
  return ist;
}

/**
 * Get today's date in IST in YYYY-MM-DD format
 */
export function getTodayIST(): string {
  return formatDateForDatabase(getCurrentISTDate());
}

/**
 * Get IST date string for a specific number of days from today
 */
export function getISTDateOffset(daysOffset: number): string {
  const today = getCurrentISTDate();
  today.setDate(today.getDate() + daysOffset);
  return formatDateForDatabase(today);
}

/**
 * Parse a date string and return IST date
 * This ensures the parsed date is always in IST timezone
 */
export function parseToISTDate(dateString: string): Date {
  const date = new Date(dateString);
  return convertToIST(date);
}

/**
 * Get current IST timestamp for database storage
 */
export function getCurrentISTTimestamp(): string {
  const istDate = getCurrentISTDate();
  return istDate.toISOString();
}

/**
 * Check if a date is today in IST
 */
export function isToday(date: Date | string): boolean {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  const todayIST = getTodayIST();
  const inputDateIST = formatDateForDatabase(inputDate);
  return todayIST === inputDateIST;
}

/**
 * Check if a date is in the future (compared to IST today)
 */
export function isFutureDate(date: Date | string): boolean {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  const todayIST = getTodayIST();
  const inputDateIST = formatDateForDatabase(inputDate);
  return inputDateIST > todayIST;
}

/**
 * Check if a date is in the past (compared to IST today)
 */
export function isPastDate(date: Date | string): boolean {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  const todayIST = getTodayIST();
  const inputDateIST = formatDateForDatabase(inputDate);
  return inputDateIST < todayIST;
}

/**
 * Format date for display in IST timezone
 * This ensures all displayed dates are consistently in IST
 */
export function formatDateForDisplay(date: Date | string, formatStr?: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Convert to IST for consistent display
  const istDate = convertToIST(dateObj);
  
  if (formatStr) {
    // If a specific format is requested, use date-fns format with IST date
    return format(istDate, formatStr);
  }
  
  // Default format: MMM dd, yyyy
  return format(istDate, 'MMM dd, yyyy');
}

/**
 * Get current time in IST for time tracking
 */
export function getCurrentISTTime(): string {
  const istDate = getCurrentISTDate();
  const hours = String(istDate.getHours()).padStart(2, '0');
  const minutes = String(istDate.getMinutes()).padStart(2, '0');
  const seconds = String(istDate.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Helper function to replace all .toISOString().split('T')[0] usage
 * Use this instead of the problematic timezone conversion
 */
export function dateToISOString(date: Date): string {
  return formatDateForDatabase(date);
}

/**
 * Compare two dates in IST timezone
 * Returns -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareISTDates(date1: Date | string, date2: Date | string): number {
  const istDate1 = typeof date1 === 'string' ? parseToISTDate(date1) : convertToIST(date1);
  const istDate2 = typeof date2 === 'string' ? parseToISTDate(date2) : convertToIST(date2);
  
  if (istDate1 < istDate2) return -1;
  if (istDate1 > istDate2) return 1;
  return 0;
}

/**
 * Get IST date range for a given start and end date
 * Useful for filtering data by date ranges in IST
 */
export function getISTDateRange(startDate: string, endDate: string): { start: Date; end: Date } {
  return {
    start: parseToISTDate(startDate),
    end: parseToISTDate(endDate)
  };
}

export default {
  getCurrentISTDate,
  formatDateForDatabase,
  convertToIST,
  getTodayIST,
  getISTDateOffset,
  parseToISTDate,
  getCurrentISTTimestamp,
  isToday,
  isFutureDate,
  isPastDate,
  formatDateForDisplay,
  getCurrentISTTime,
  dateToISOString,
  compareISTDates,
  getISTDateRange
};

// Helper function to sanitize date values for database operations
export const sanitizeDateValue = (dateValue: string | null | undefined): string | null => {
  if (!dateValue || dateValue === '') {
    return null;
  }
  return dateValue;
};

// Helper function to sanitize multiple date fields in an object
export const sanitizeDateFields = (data: Record<string, any>, dateFields: string[]): Record<string, any> => {
  const sanitized = { ...data };
  dateFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = sanitizeDateValue(sanitized[field]);
    }
  });
  return sanitized;
};
