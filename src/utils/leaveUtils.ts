/**
 * Utility functions for leave management
 */

export type HalfDayPeriod = '1st_half' | '2nd_half';

/**
 * Get human-readable display text for half day periods
 */
export function getHalfDayPeriodDisplay(period: HalfDayPeriod): string {
  switch (period) {
    case '1st_half':
      return 'Morning (1st Half)';
    case '2nd_half':
      return 'Afternoon (2nd Half)';
    default:
      return 'Half Day';
  }
}

/**
 * Get short display text for half day periods
 */
export function getHalfDayPeriodShort(period: HalfDayPeriod): string {
  switch (period) {
    case '1st_half':
      return 'Morning';
    case '2nd_half':
      return 'Afternoon';
    default:
      return 'Half';
  }
}

/**
 * Get time range for half day periods
 */
export function getHalfDayTimeRange(period: HalfDayPeriod): string {
  switch (period) {
    case '1st_half':
      return '9:00 AM - 1:00 PM';
    case '2nd_half':
      return '2:00 PM - 6:00 PM';
    default:
      return 'Full Day';
  }
}

/**
 * Get badge text for half day periods (used in UI components)
 */
export function getHalfDayBadgeText(period?: HalfDayPeriod): string {
  if (!period) return 'Half Day';
  
  switch (period) {
    case '1st_half':
      return 'Morning Half';
    case '2nd_half':
      return 'Afternoon Half';
    default:
      return 'Half Day';
  }
}

/**
 * Format leave duration for display including half day period
 */
export function formatLeaveDuration(
  daysCount: number, 
  isHalfDay?: boolean, 
  halfDayPeriod?: HalfDayPeriod
): string {
  const daysText = `${daysCount} day${daysCount !== 1 ? 's' : ''}`;
  
  if (isHalfDay && halfDayPeriod) {
    return `${daysText} (${getHalfDayPeriodShort(halfDayPeriod)})`;
  } else if (isHalfDay) {
    return `${daysText} (Half)`;
  }
  
  return daysText;
}
