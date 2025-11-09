/**
 * 🎯 Universal Attendance Detection
 * Single detection engine that uses configurations
 *
 * Pattern: Configuration-driven (like Stripe's processing logic)
 * Pure functions - testable, predictable, beautiful
 *
 * @module lib/attendance/utils/detection
 */

import { ATTENDANCE_TYPE } from '../enums.js';
import { getConfig } from '../configs/index.js';
import { calculateStandardHours, calculateThresholds, isWithinShift, isWorkingDay } from './schedule.utils.js';

/**
 * Detect attendance type using configuration-driven logic
 * Universal function that works for all entity types
 *
 * @example
 * // Membership (simple)
 * detect({ checkInTime, checkOutTime, targetModel: 'Membership' })
 *
 * // Employee (schedule-aware)
 * detect({ checkInTime, checkOutTime, targetModel: 'Employee', entityData: employee })
 *
 * @param {Object} params
 * @param {Date} params.checkInTime - Check-in timestamp
 * @param {Date} params.checkOutTime - Check-out timestamp (null if still checked in)
 * @param {String} params.targetModel - Entity type (Membership, Employee)
 * @param {Object} params.entityData - Entity document (contains workSchedule for employees)
 * @returns {String} Attendance type (ATTENDANCE_TYPE enum value)
 */
export function detectAttendanceType({ checkInTime, checkOutTime = null, targetModel, entityData = null }) {
  // Get configuration for this entity type
  const config = getConfig(targetModel);

  // If no checkout yet, return predicted type
  if (!checkOutTime) {
    return config.detection.rules.defaultType;
  }

  // Route to appropriate detection method
  if (config.detection.type === 'schedule-aware') {
    return detectScheduleAware({ checkInTime, checkOutTime, entityData, config });
  }

  if (config.detection.type === 'time-based') {
    return detectTimeBased({ checkInTime, checkOutTime, config });
  }

  // Fallback
  return ATTENDANCE_TYPE.FULL_DAY;
}

/**
 * Schedule-aware detection for employees
 * Uses employee's workSchedule to determine thresholds
 *
 * @private
 */
function detectScheduleAware({ checkInTime, checkOutTime, entityData, config }) {
  // Extract work schedule from entity
  const scheduleField = config.detection.scheduleSource;
  const workSchedule = entityData?.[scheduleField];

  // Calculate duration
  const durationHours = (new Date(checkOutTime) - new Date(checkInTime)) / (1000 * 60 * 60);

  // Calculate thresholds based on schedule
  const thresholds = workSchedule
    ? calculateThresholds(workSchedule)
    : config.detection.rules.fallback;

  const checkInHour = new Date(checkInTime).getHours();
  const checkOutHour = new Date(checkOutTime).getHours();

  // Apply percentage-based thresholds
  if (workSchedule) {
    // Overtime detection
    if (durationHours > thresholds.overtime) {
      return ATTENDANCE_TYPE.OVERTIME;
    }

    // Full day detection
    if (durationHours >= thresholds.fullDay) {
      return ATTENDANCE_TYPE.FULL_DAY;
    }

    // Half day detection
    if (durationHours >= thresholds.halfDay) {
      return classifyHalfDay(checkInHour, checkOutHour, config.detection.timeHints);
    }

    // Unpaid leave (too short)
    return ATTENDANCE_TYPE.UNPAID_LEAVE;
  }

  // Fallback to fixed thresholds
  if (durationHours > thresholds.overtime) {
    return ATTENDANCE_TYPE.OVERTIME;
  }

  if (durationHours >= thresholds.fullDay) {
    return ATTENDANCE_TYPE.FULL_DAY;
  }

  if (durationHours >= thresholds.halfDay) {
    return classifyHalfDay(checkInHour, checkOutHour, config.detection.timeHints);
  }

  return ATTENDANCE_TYPE.UNPAID_LEAVE;
}

/**
 * Time-based detection for memberships
 * Simple duration-based classification
 *
 * @private
 */
function detectTimeBased({ checkInTime, checkOutTime, config }) {
  const durationHours = (new Date(checkOutTime) - new Date(checkInTime)) / (1000 * 60 * 60);
  const thresholds = config.detection.rules.thresholds;

  // For memberships, we only care if they visited
  // Any visit counts as attendance
  if (durationHours >= thresholds.minimal) {
    return ATTENDANCE_TYPE.FULL_DAY;
  }

  // Very short visits don't count
  return ATTENDANCE_TYPE.UNPAID_LEAVE;
}

/**
 * Classify half-day as morning or afternoon
 * Uses time-of-day hints from configuration
 *
 * @private
 */
function classifyHalfDay(checkInHour, checkOutHour, timeHints) {
  // Morning shift: checked in before noon and out before 2pm
  if (checkInHour < timeHints.morningCutoff && checkOutHour < 14) {
    return ATTENDANCE_TYPE.HALF_DAY_MORNING;
  }

  // Afternoon shift: checked in after 11am
  if (checkInHour >= timeHints.afternoonStart) {
    return ATTENDANCE_TYPE.HALF_DAY_AFTERNOON;
  }

  // Default to morning if ambiguous
  return ATTENDANCE_TYPE.HALF_DAY_MORNING;
}

/**
 * Validate check-in against schedule rules
 * Returns validation result with warnings
 *
 * @param {Object} params
 * @param {Date} params.checkInTime - Check-in timestamp
 * @param {String} params.targetModel - Entity type
 * @param {Object} params.entityData - Entity document
 * @returns {Object} { valid: Boolean, warnings: Array<String> }
 */
export function validateCheckIn({ checkInTime, targetModel, entityData = null }) {
  const config = getConfig(targetModel);
  const validation = config.validation;

  // No validation needed
  if (!validation.enforceSchedule) {
    return { valid: true, warnings: [] };
  }

  const warnings = [];
  const scheduleField = config.detection.scheduleSource;
  const workSchedule = entityData?.[scheduleField];

  // No schedule to validate against
  if (!workSchedule) {
    return { valid: true, warnings: [] };
  }

  // Check working day
  if (!validation.allowWeekends) {
    const { isWorking, dayName } = isWorkingDay(checkInTime, workSchedule);
    if (!isWorking) {
      warnings.push(`Not a scheduled working day (${dayName})`);
    }
  }

  // Check shift hours
  const { within, earlyBy, lateBy } = isWithinShift(
    checkInTime,
    workSchedule,
    validation.gracePeriod
  );

  if (!within) {
    if (earlyBy > 0) {
      warnings.push(`Early check-in by ${earlyBy.toFixed(1)} hours`);
    }
    if (lateBy > 0) {
      warnings.push(`Late check-in by ${lateBy.toFixed(1)} hours`);
    }
  }

  // For warnOnly mode, always return valid but with warnings
  if (validation.warnOnly) {
    return { valid: true, warnings };
  }

  // Strict mode: invalid if there are warnings
  return { valid: warnings.length === 0, warnings };
}

export default {
  detectAttendanceType,
  validateCheckIn,
};
