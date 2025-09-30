/**
 * Date utility functions for consistent IST (Indian Standard Time) handling
 * IST is UTC+5:30
 */

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
 * Format date for display (keeping original date-fns format behavior)
 * This preserves the original date without timezone conversion for display
 */
export function formatDateForDisplay(date: Date | string, formatStr?: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // For display purposes, we want to show the date as stored in the database
  // without additional timezone conversion
  if (formatStr) {
    // If a specific format is requested, use date-fns format
    const { format } = require('date-fns');
    return format(dateObj, formatStr);
  }
  
  // Default format: MMM dd, yyyy
  const { format } = require('date-fns');
  return format(dateObj, 'MMM dd, yyyy');
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
  dateToISOString
};
