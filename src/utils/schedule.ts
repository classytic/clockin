/**
 * Schedule Utilities
 *
 * Pure functions for working with employee schedules
 * Functional, testable, zero side effects
 *
 * @module @classytic/clockin/utils/schedule
 */

import type {
  WorkSchedule,
  ScheduleThresholds,
  ScheduleCheckResult,
  WorkingDayResult,
} from '../types.js';

/**
 * Parse time string to decimal hours
 *
 * @example
 * ```typescript
 * parseTime("09:30") // 9.5
 * parseTime("14:00") // 14
 * ```
 *
 * @param timeString - Time in "HH:MM" format
 * @returns Decimal hours (0-24) or null if invalid
 */
export function parseTime(timeString: string | undefined | null): number | null {
  if (!timeString || typeof timeString !== 'string') return null;

  const [hoursStr, minutesStr] = timeString.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  if (isNaN(hours) || isNaN(minutes)) return null;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;

  return hours + minutes / 60;
}

/**
 * Calculate standard daily hours from work schedule
 * Supports multiple schedule formats with graceful fallbacks
 *
 * @example
 * ```typescript
 * calculateStandardHours({ hoursPerDay: 8 }) // 8
 * calculateStandardHours({ hoursPerWeek: 40, workingDays: [1,2,3,4,5] }) // 8
 * calculateStandardHours({ shiftStart: "09:00", shiftEnd: "17:00" }) // 8
 * calculateStandardHours(null) // 8 (default)
 * ```
 *
 * @param workSchedule - Employee's work schedule
 * @returns Standard daily hours (default: 8)
 */
export function calculateStandardHours(
  workSchedule: WorkSchedule | undefined | null
): number {
  if (!workSchedule) return 8;

  // Method 1: Direct hoursPerDay (most explicit)
  if (workSchedule.hoursPerDay && workSchedule.hoursPerDay > 0) {
    return workSchedule.hoursPerDay;
  }

  // Method 2: Calculate from hoursPerWeek / workingDays
  if (
    workSchedule.hoursPerWeek &&
    workSchedule.workingDays &&
    workSchedule.workingDays.length > 0
  ) {
    return workSchedule.hoursPerWeek / workSchedule.workingDays.length;
  }

  // Method 3: Calculate from shift times
  if (workSchedule.shiftStart && workSchedule.shiftEnd) {
    const startHours = parseTime(workSchedule.shiftStart);
    const endHours = parseTime(workSchedule.shiftEnd);

    if (startHours !== null && endHours !== null) {
      const duration = endHours - startHours;
      return duration > 0 ? duration : 8; // Handle overnight shifts as default
    }
  }

  // Fallback: Standard 8-hour workday
  return 8;
}

/**
 * Check if a given time is within the scheduled shift
 *
 * @example
 * ```typescript
 * isWithinShift(new Date("2025-11-08T09:30:00"), { shiftStart: "09:00", shiftEnd: "17:00" })
 * // { within: true, earlyBy: 0, lateBy: 0 }
 * ```
 *
 * @param timestamp - Check-in timestamp
 * @param workSchedule - Employee's work schedule
 * @param toleranceHours - Grace period in hours (default: 1)
 * @returns Check result
 */
export function isWithinShift(
  timestamp: Date,
  workSchedule: WorkSchedule | undefined | null,
  toleranceHours = 1
): ScheduleCheckResult {
  if (!workSchedule?.shiftStart || !workSchedule?.shiftEnd) {
    return { within: true, earlyBy: 0, lateBy: 0 };
  }

  const checkInDate = new Date(timestamp);
  const checkInHour =
    checkInDate.getHours() + checkInDate.getMinutes() / 60;
  const shiftStart = parseTime(workSchedule.shiftStart);
  const shiftEnd = parseTime(workSchedule.shiftEnd);

  if (shiftStart === null || shiftEnd === null) {
    return { within: true, earlyBy: 0, lateBy: 0 };
  }

  const earlyBy = Math.max(0, shiftStart - checkInHour);
  const lateBy = Math.max(0, checkInHour - shiftEnd);

  const within = earlyBy <= toleranceHours && lateBy === 0;

  return { within, earlyBy, lateBy };
}

/**
 * Check if a given day is a scheduled working day
 *
 * @example
 * ```typescript
 * isWorkingDay(new Date("2025-11-10"), { workingDays: [1,2,3,4,5] }) // Monday
 * // { isWorking: true, dayName: 'Monday' }
 * ```
 *
 * @param timestamp - Date to check
 * @param workSchedule - Employee's work schedule
 * @returns Working day result
 */
export function isWorkingDay(
  timestamp: Date,
  workSchedule: WorkSchedule | undefined | null
): WorkingDayResult {
  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const day = new Date(timestamp).getDay();
  const dayName = dayNames[day]!;

  if (!workSchedule?.workingDays || workSchedule.workingDays.length === 0) {
    return { isWorking: true, dayName };
  }

  const isWorking = workSchedule.workingDays.includes(day);

  return { isWorking, dayName };
}

/**
 * Calculate attendance classification thresholds based on schedule
 *
 * @example
 * ```typescript
 * calculateThresholds({ hoursPerDay: 4 })
 * // { overtime: 4.4, fullDay: 3, halfDay: 1.6, unpaid: 1.6 }
 * ```
 *
 * @param workSchedule - Employee's work schedule
 * @returns Thresholds in hours
 */
export function calculateThresholds(
  workSchedule: WorkSchedule | undefined | null
): ScheduleThresholds {
  const standardHours = calculateStandardHours(workSchedule);

  return {
    overtime: standardHours * 1.1, // 110% = overtime
    fullDay: standardHours * 0.75, // 75% = full day
    halfDay: standardHours * 0.4, // 40% = half day
    unpaid: standardHours * 0.4, // <40% = unpaid leave
  };
}

/**
 * Calculate expected checkout time based on schedule
 *
 * @param checkInTime - Check-in timestamp
 * @param workSchedule - Employee's work schedule
 * @param defaultHours - Default hours if no schedule
 * @param maxSession - Maximum session hours
 * @returns Expected checkout time
 */
export function calculateExpectedCheckout(
  checkInTime: Date,
  workSchedule: WorkSchedule | undefined | null,
  defaultHours = 6,
  maxSession = 12
): Date {
  const checkIn = new Date(checkInTime);

  // Use schedule if available
  if (workSchedule) {
    // Method 1: Use shiftEnd if it's a working day
    if (workSchedule.shiftEnd) {
      const shiftEnd = parseTime(workSchedule.shiftEnd);
      if (shiftEnd !== null) {
        const { isWorking } = isWorkingDay(checkIn, workSchedule);

        if (isWorking) {
          const expectedCheckout = new Date(checkIn);
          expectedCheckout.setHours(
            Math.floor(shiftEnd),
            (shiftEnd % 1) * 60,
            0,
            0
          );

          // If shift end is before check-in (late arrival), add standard hours
          if (expectedCheckout <= checkIn) {
            const standardHours = calculateStandardHours(workSchedule);
            expectedCheckout.setTime(
              checkIn.getTime() + standardHours * 60 * 60 * 1000
            );
          }

          // Respect max session
          const maxCheckout = new Date(
            checkIn.getTime() + maxSession * 60 * 60 * 1000
          );
          return expectedCheckout < maxCheckout ? expectedCheckout : maxCheckout;
        }
      }
    }

    // Method 2: Use hoursPerDay
    const standardHours = calculateStandardHours(workSchedule);
    if (standardHours > 0) {
      const expectedCheckout = new Date(
        checkIn.getTime() + standardHours * 60 * 60 * 1000
      );
      const maxCheckout = new Date(
        checkIn.getTime() + maxSession * 60 * 60 * 1000
      );
      return expectedCheckout < maxCheckout ? expectedCheckout : maxCheckout;
    }
  }

  // Fallback: Use default hours
  const expectedCheckout = new Date(
    checkIn.getTime() + defaultHours * 60 * 60 * 1000
  );
  const maxCheckout = new Date(
    checkIn.getTime() + maxSession * 60 * 60 * 1000
  );

  return expectedCheckout < maxCheckout ? expectedCheckout : maxCheckout;
}

/**
 * Format work schedule for display
 *
 * @example
 * ```typescript
 * formatSchedule({ hoursPerDay: 8, shiftStart: "09:00", shiftEnd: "17:00", workingDays: [1,2,3,4,5] })
 * // "8 hours/day, Mon, Tue, Wed, Thu, Fri, 09:00-17:00"
 * ```
 *
 * @param workSchedule - Employee's work schedule
 * @returns Human-readable schedule
 */
export function formatSchedule(
  workSchedule: WorkSchedule | undefined | null
): string {
  if (!workSchedule) return 'Not configured';

  const parts: string[] = [];

  // Hours
  const hours = calculateStandardHours(workSchedule);
  parts.push(`${hours} hours/day`);

  // Working days
  if (workSchedule.workingDays && workSchedule.workingDays.length > 0) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = workSchedule.workingDays.map((d) => dayNames[d]).join(', ');
    parts.push(days);
  }

  // Shift times
  if (workSchedule.shiftStart && workSchedule.shiftEnd) {
    parts.push(`${workSchedule.shiftStart}-${workSchedule.shiftEnd}`);
  }

  return parts.join(', ');
}

export default {
  parseTime,
  calculateStandardHours,
  isWithinShift,
  isWorkingDay,
  calculateThresholds,
  calculateExpectedCheckout,
  formatSchedule,
};

