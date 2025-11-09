/**
 * 📅 Schedule Utilities
 * Pure functions for working with employee schedules
 *
 * Design: Functional, testable, zero dependencies
 * Pattern: Pure functions only - no side effects
 *
 * @module lib/attendance/utils/schedule
 */

/**
 * Parse time string to decimal hours
 * @example parseTime("09:30") → 9.5
 * @example parseTime("14:00") → 14
 *
 * @param {String} timeString - Time in "HH:MM" format
 * @returns {Number} Decimal hours (0-24)
 */
export function parseTime(timeString) {
  if (!timeString || typeof timeString !== 'string') return null;

  const [hours, minutes] = timeString.split(':').map(Number);

  if (isNaN(hours) || isNaN(minutes)) return null;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;

  return hours + (minutes / 60);
}

/**
 * Calculate standard daily hours from work schedule
 * Supports multiple schedule formats with graceful fallbacks
 *
 * @example
 * calculateStandardHours({ hoursPerDay: 8 }) → 8
 * calculateStandardHours({ hoursPerWeek: 40, workingDays: [1,2,3,4,5] }) → 8
 * calculateStandardHours({ shiftStart: "09:00", shiftEnd: "17:00" }) → 8
 * calculateStandardHours(null) → 8 (default)
 *
 * @param {Object} workSchedule - Employee's work schedule
 * @param {Number} workSchedule.hoursPerDay - Direct hours per day
 * @param {Number} workSchedule.hoursPerWeek - Hours per week
 * @param {Array<Number>} workSchedule.workingDays - Working days (0=Sun, 6=Sat)
 * @param {String} workSchedule.shiftStart - Shift start time "HH:MM"
 * @param {String} workSchedule.shiftEnd - Shift end time "HH:MM"
 * @returns {Number} Standard daily hours (default: 8)
 */
export function calculateStandardHours(workSchedule) {
  // Fallback: No schedule provided
  if (!workSchedule) return 8;

  // Method 1: Direct hoursPerDay (most explicit)
  if (workSchedule.hoursPerDay && workSchedule.hoursPerDay > 0) {
    return workSchedule.hoursPerDay;
  }

  // Method 2: Calculate from hoursPerWeek / workingDays
  if (workSchedule.hoursPerWeek && workSchedule.workingDays?.length > 0) {
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
 * Used for enforceSchedule validation
 *
 * @example
 * isWithinShift(new Date("2025-11-08T09:30:00"), { shiftStart: "09:00", shiftEnd: "17:00" })
 * → { within: true, earlyBy: 0, lateBy: 0 }
 *
 * @param {Date} timestamp - Check-in timestamp
 * @param {Object} workSchedule - Employee's work schedule
 * @param {String} workSchedule.shiftStart - Shift start time "HH:MM"
 * @param {String} workSchedule.shiftEnd - Shift end time "HH:MM"
 * @param {Number} toleranceHours - Grace period in hours (default: 1)
 * @returns {Object} { within: Boolean, earlyBy: Number, lateBy: Number }
 */
export function isWithinShift(timestamp, workSchedule, toleranceHours = 1) {
  if (!workSchedule?.shiftStart || !workSchedule?.shiftEnd) {
    return { within: true, earlyBy: 0, lateBy: 0 }; // No schedule = always valid
  }

  const checkInHour = new Date(timestamp).getHours() + (new Date(timestamp).getMinutes() / 60);
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
 * isWorkingDay(new Date("2025-11-10"), { workingDays: [1,2,3,4,5] }) // Monday
 * → { isWorking: true, dayName: 'Monday' }
 *
 * @param {Date} timestamp - Date to check
 * @param {Object} workSchedule - Employee's work schedule
 * @param {Array<Number>} workSchedule.workingDays - Working days (0=Sun, 6=Sat)
 * @returns {Object} { isWorking: Boolean, dayName: String }
 */
export function isWorkingDay(timestamp, workSchedule) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = new Date(timestamp).getDay();
  const dayName = dayNames[day];

  if (!workSchedule?.workingDays || workSchedule.workingDays.length === 0) {
    return { isWorking: true, dayName }; // No schedule = all days valid
  }

  const isWorking = workSchedule.workingDays.includes(day);

  return { isWorking, dayName };
}

/**
 * Calculate attendance classification thresholds based on schedule
 * Returns thresholds as percentages of standard hours
 *
 * @example
 * calculateThresholds({ hoursPerDay: 4 })
 * → { overtime: 4.4, fullDay: 3, halfDay: 1.6, unpaid: 1.6 }
 *
 * @param {Object} workSchedule - Employee's work schedule
 * @returns {Object} Thresholds in hours
 */
export function calculateThresholds(workSchedule) {
  const standardHours = calculateStandardHours(workSchedule);

  return {
    overtime: standardHours * 1.1,      // 110% = overtime
    fullDay: standardHours * 0.75,      // 75% = full day
    halfDay: standardHours * 0.4,       // 40% = half day
    unpaid: standardHours * 0.4,        // <40% = unpaid leave
  };
}

/**
 * Calculate intelligent expected checkout time
 * Uses employee's actual schedule or smart defaults
 *
 * Priority:
 * 1. Employee's shiftEnd (if today is a working day)
 * 2. Employee's hoursPerDay (checkIn + hours)
 * 3. Config default (afterHours)
 * 4. Respect maxSession limit
 *
 * @example
 * // Employee with shift end at 5 PM, checks in at 9 AM
 * calculateExpectedCheckout(checkInTime, 'Employee', employee, config)
 * → Today 5:00 PM
 *
 * // Employee with 8 hours/day, checks in at 10 AM
 * calculateExpectedCheckout(checkInTime, 'Employee', employee, config)
 * → Today 6:00 PM (10 AM + 8 hours)
 *
 * // Member checks in at 8 AM
 * calculateExpectedCheckout(checkInTime, 'Membership', member, config)
 * → Today 2:00 PM (8 AM + 6 hours default)
 *
 * @param {Date} checkInTime - Check-in timestamp
 * @param {String} targetModel - Entity type (Employee, Membership)
 * @param {Object} entityData - Employee or Member document with workSchedule
 * @param {Object} config - Attendance config for entity type
 * @returns {Date} Expected checkout time
 */
export function calculateExpectedCheckout(checkInTime, targetModel, entityData, config) {
  const checkIn = new Date(checkInTime);
  const workSchedule = entityData?.workSchedule || entityData?.employment?.workSchedule;

  // For employees with schedule
  if (targetModel === 'Employee' && workSchedule) {
    // Method 1: Use shiftEnd if it's a working day and shift is defined
    if (workSchedule.shiftEnd) {
      const shiftEnd = parseTime(workSchedule.shiftEnd);
      if (shiftEnd !== null) {
        // Check if today is a working day
        const { isWorking } = isWorkingDay(checkIn, workSchedule);

        if (isWorking) {
          // Set checkout to today's shift end time
          const expectedCheckout = new Date(checkIn);
          expectedCheckout.setHours(Math.floor(shiftEnd), (shiftEnd % 1) * 60, 0, 0);

          // If shift end is before check-in (employee is late), add standard hours
          if (expectedCheckout <= checkIn) {
            const standardHours = calculateStandardHours(workSchedule);
            expectedCheckout.setTime(checkIn.getTime() + (standardHours * 60 * 60 * 1000));
          }

          // Respect max session limit
          const maxSessionMs = (config.autoCheckout?.maxSession || 12) * 60 * 60 * 1000;
          const maxCheckout = new Date(checkIn.getTime() + maxSessionMs);

          return expectedCheckout < maxCheckout ? expectedCheckout : maxCheckout;
        }
      }
    }

    // Method 2: Use hoursPerDay to calculate checkout
    const standardHours = calculateStandardHours(workSchedule);
    if (standardHours > 0) {
      const expectedCheckout = new Date(checkIn.getTime() + (standardHours * 60 * 60 * 1000));

      // Respect max session limit
      const maxSessionMs = (config.autoCheckout?.maxSession || 12) * 60 * 60 * 1000;
      const maxCheckout = new Date(checkIn.getTime() + maxSessionMs);

      return expectedCheckout < maxCheckout ? expectedCheckout : maxCheckout;
    }
  }

  // Fallback: Use config default
  const defaultHours = config.autoCheckout?.afterHours || 6;
  const expectedCheckout = new Date(checkIn.getTime() + (defaultHours * 60 * 60 * 1000));

  // Respect max session limit
  const maxSessionMs = (config.autoCheckout?.maxSession || 12) * 60 * 60 * 1000;
  const maxCheckout = new Date(checkIn.getTime() + maxSessionMs);

  return expectedCheckout < maxCheckout ? expectedCheckout : maxCheckout;
}

/**
 * Format work schedule for display
 *
 * @example
 * formatSchedule({ hoursPerDay: 8, shiftStart: "09:00", shiftEnd: "17:00", workingDays: [1,2,3,4,5] })
 * → "8 hours/day, Mon-Fri, 09:00-17:00"
 *
 * @param {Object} workSchedule - Employee's work schedule
 * @returns {String} Human-readable schedule
 */
export function formatSchedule(workSchedule) {
  if (!workSchedule) return 'Not configured';

  const parts = [];

  // Hours
  const hours = calculateStandardHours(workSchedule);
  parts.push(`${hours} hours/day`);

  // Working days
  if (workSchedule.workingDays?.length > 0) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = workSchedule.workingDays.map(d => dayNames[d]).join(', ');
    parts.push(days);
  }

  // Shift times
  if (workSchedule.shiftStart && workSchedule.shiftEnd) {
    parts.push(`${workSchedule.shiftStart}-${workSchedule.shiftEnd}`);
  }

  return parts.join(', ');
}

// Export all utilities
export default {
  parseTime,
  calculateStandardHours,
  isWithinShift,
  isWorkingDay,
  calculateThresholds,
  calculateExpectedCheckout,
  formatSchedule,
};
