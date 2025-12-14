/**
 * Attendance Type Detection
 *
 * Smart detection of attendance type based on duration and schedule
 *
 * @module @classytic/clockin/utils/detection
 */

import type {
  AttendanceType,
  TargetModelConfig,
  WorkSchedule,
} from '../types.js';

/**
 * Detect attendance type based on duration
 *
 * @param durationHours - Session duration in hours
 * @param targetModel - Target model name
 * @param member - Member document (for schedule-aware detection)
 * @param config - Target model configuration
 * @returns Detected attendance type
 */
export function detectAttendanceType(
  durationHours: number,
  targetModel: string,
  member: { workSchedule?: WorkSchedule } | null,
  config: TargetModelConfig
): AttendanceType {
  const { detection } = config;
  const { rules } = detection;

  // Schedule-aware detection (for employees)
  if (detection.type === 'schedule-aware' && member?.workSchedule) {
    const schedule = member.workSchedule;
    const standardHours = schedule.hoursPerDay || 8;

    const thresholds = rules.thresholds;

    // Percentage-based thresholds
    if (durationHours >= standardHours * (thresholds.overtime || 1.1)) {
      return 'overtime';
    }
    if (durationHours >= standardHours * (thresholds.fullDay || 0.75)) {
      return 'full_day';
    }
    if (durationHours >= standardHours * (thresholds.halfDay || 0.4)) {
      // Determine morning or afternoon based on time hints
      const hints = detection.timeHints;
      if (hints) {
        const now = new Date();
        const hour = now.getHours();
        if (hour < hints.morningCutoff) {
          return 'half_day_morning';
        }
        return 'half_day_afternoon';
      }
      return 'half_day_morning';
    }

    return rules.defaultType || 'full_day';
  }

  // Time-based detection (for members, students, etc.)
  const thresholds = rules.thresholds;

  if (durationHours >= (thresholds.overtime as number || 10)) {
    return 'overtime';
  }
  if (durationHours >= (thresholds.fullDay as number || 1)) {
    return 'full_day';
  }

  return rules.defaultType || 'full_day';
}

/**
 * Validate check-in against schedule
 *
 * @param params - Validation parameters
 * @returns Validation result with warnings
 */
export function validateSchedule(params: {
  checkInTime: Date;
  targetModel: string;
  member: { workSchedule?: WorkSchedule } | null;
  config: TargetModelConfig;
}): { valid: boolean; warnings: string[] } {
  const { checkInTime, member, config } = params;
  const warnings: string[] = [];

  // Skip validation if not schedule-aware
  if (config.detection.type !== 'schedule-aware') {
    return { valid: true, warnings };
  }

  // Skip if no schedule
  if (!member?.workSchedule) {
    return { valid: true, warnings };
  }

  const { validation } = config;
  const schedule = member.workSchedule;

  // Check working day
  if (!validation.allowWeekends) {
    const dayOfWeek = checkInTime.getDay();
    const workingDays = schedule.workingDays || [1, 2, 3, 4, 5]; // Mon-Fri default

    if (!workingDays.includes(dayOfWeek)) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const warning = `${dayNames[dayOfWeek]} is not a scheduled working day`;

      if (validation.warnOnly) {
        warnings.push(warning);
      } else {
        return { valid: false, warnings: [warning] };
      }
    }
  }

  // Check shift timing
  if (validation.enforceSchedule && schedule.shiftStart) {
    const checkInHour = checkInTime.getHours();
    const checkInMinute = checkInTime.getMinutes();
    const checkInDecimal = checkInHour + checkInMinute / 60;

    const [shiftHour, shiftMinute] = schedule.shiftStart.split(':').map(Number);
    const shiftDecimal = shiftHour + shiftMinute / 60;

    const gracePeriod = validation.gracePeriod || 0;

    if (checkInDecimal < shiftDecimal - gracePeriod) {
      const warning = `Early check-in: ${Math.round((shiftDecimal - checkInDecimal) * 60)} minutes before shift`;
      warnings.push(warning);
    } else if (checkInDecimal > shiftDecimal + gracePeriod) {
      const warning = `Late check-in: ${Math.round((checkInDecimal - shiftDecimal) * 60)} minutes after shift start`;
      warnings.push(warning);
    }
  }

  return { valid: true, warnings };
}

export default {
  detectAttendanceType,
  validateSchedule,
};

