/**
 * 🏢 Attendance Framework Configuration
 * Centralized configuration for all attendance features
 *
 * This is the SINGLE source of truth for framework behavior
 *
 * @module lib/attendance/config
 */

import {
  ATTENDANCE_TARGET_MODELS,
  ENGAGEMENT_LEVEL,
  STATS_CALCULATION_MODE,
  CHECK_IN_METHOD,
} from './enums.js';

/**
 * Engagement thresholds
 * Define visit counts for each engagement level
 */
export const ENGAGEMENT_THRESHOLDS = {
  highlyActive: 12,     // 12+ visits per month
  active: 8,            // 8-11 visits per month
  regular: 4,           // 4-7 visits per month
  occasional: 1,        // 1-3 visits per month
  atRisk: {
    daysInactive: 14,   // No visit in 14+ days
  },
  dormant: {
    daysInactive: 30,   // No visit in 30+ days
  },
};

/**
 * Stats calculation configuration
 * Control how attendance stats are computed
 */
export const STATS_CONFIG = {
  // Default calculation mode
  defaultMode: STATS_CALCULATION_MODE.PRE_CALCULATED,
  
  // Cache duration for real-time calculations (seconds)
  cacheDuration: 300, // 5 minutes
  
  // Auto-update stats on check-in
  autoUpdateStats: true,
  
  // Batch update stats (for performance)
  batchUpdateEnabled: true,
  batchSize: 100,
};

/**
 * Monthly aggregation configuration
 * One document per member per month (storage optimization)
 */
export const AGGREGATION_CONFIG = {
  // Maximum check-ins per document (anti-pattern protection)
  maxCheckInsPerMonth: 1000,
  
  // Store detailed check-ins for recent months only
  detailedHistoryMonths: 6,
  
  // Archive old records after (months)
  archiveAfterMonths: 24,
  
  // Compress archived records
  compressArchived: true,
};

/**
 * Streak calculation rules
 */
export const STREAK_CONFIG = {
  // Minimum hours between check-ins to count as separate days
  minHoursBetweenVisits: 4,
  
  // Maximum gap (days) to maintain streak
  maxGapDays: 1,
  
  // Reset streak on this gap (days)
  resetStreakAfterDays: 2,
};

/**
 * Check-in validation rules
 */
export const CHECK_IN_RULES = {
  // Prevent duplicate check-ins within X minutes
  duplicatePreventionMinutes: 5,
  
  // Allow early check-in (minutes before scheduled)
  earlyCheckInMinutes: 30,
  
  // Allow late check-in (minutes after scheduled)
  lateCheckInMinutes: 15,
  
  // Require minimum time between check-ins (hours)
  minimumTimeBetweenCheckIns: 4,
};

/**
 * Analytics configuration
 */
export const ANALYTICS_CONFIG = {
  // Peak hours detection
  peakHoursThreshold: 0.7, // 70% of max capacity
  
  // Trending period (days)
  trendingPeriodDays: 30,
  
  // Forecast window (days)
  forecastDays: 7,
  
  // Real-time dashboard refresh (seconds)
  dashboardRefreshSeconds: 60,
};

/**
 * Notification triggers
 */
export const NOTIFICATION_CONFIG = {
  // Notify on streak milestones
  streakMilestones: [7, 14, 30, 60, 90, 180, 365],
  
  // Notify on inactivity (days)
  inactivityAlertDays: 7,
  
  // Celebrate visit milestones
  visitMilestones: [10, 25, 50, 100, 250, 500, 1000],
};

/**
 * Supported target models for attendance
 */
export const SUPPORTED_MODELS = [
  ATTENDANCE_TARGET_MODELS.MEMBERSHIP,
  // Future: ATTENDANCE_TARGET_MODELS.EMPLOYEE,
  // Future: ATTENDANCE_TARGET_MODELS.TRAINER,
];

/**
 * Default check-in method
 */
export const DEFAULT_CHECK_IN_METHOD = CHECK_IN_METHOD.MANUAL;

/**
 * Re-export canonical enums
 */
export {
  ATTENDANCE_TARGET_MODELS,
  ENGAGEMENT_LEVEL,
  STATS_CALCULATION_MODE,
  CHECK_IN_METHOD,
};

/**
 * Get engagement level from visit count
 * @param {Number} visitsThisMonth - Number of visits this month
 * @returns {String} Engagement level
 */
export function getEngagementLevelFromVisits(visitsThisMonth) {
  if (visitsThisMonth >= ENGAGEMENT_THRESHOLDS.highlyActive) {
    return ENGAGEMENT_LEVEL.HIGHLY_ACTIVE;
  }
  if (visitsThisMonth >= ENGAGEMENT_THRESHOLDS.active) {
    return ENGAGEMENT_LEVEL.ACTIVE;
  }
  if (visitsThisMonth >= ENGAGEMENT_THRESHOLDS.regular) {
    return ENGAGEMENT_LEVEL.REGULAR;
  }
  if (visitsThisMonth >= ENGAGEMENT_THRESHOLDS.occasional) {
    return ENGAGEMENT_LEVEL.OCCASIONAL;
  }
  return ENGAGEMENT_LEVEL.INACTIVE;
}

/**
 * Validate check-in timing
 * @param {Date} lastCheckIn - Last check-in timestamp
 * @returns {Object} { valid: Boolean, reason: String }
 */
export function validateCheckInTiming(lastCheckIn) {
  if (!lastCheckIn) {
    return { valid: true };
  }
  
  const hoursSinceLastCheckIn = (Date.now() - new Date(lastCheckIn).getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceLastCheckIn < CHECK_IN_RULES.minimumTimeBetweenCheckIns) {
    return {
      valid: false,
      reason: `Please wait ${CHECK_IN_RULES.minimumTimeBetweenCheckIns} hours between check-ins`,
      nextAllowedTime: new Date(new Date(lastCheckIn).getTime() + CHECK_IN_RULES.minimumTimeBetweenCheckIns * 60 * 60 * 1000),
    };
  }
  
  return { valid: true };
}

/**
 * Check if model supports attendance
 * @param {String} modelName - Model name to check
 * @returns {Boolean}
 */
export function isAttendanceSupported(modelName) {
  return SUPPORTED_MODELS.includes(modelName);
}

/**
 * Export default configuration object
 */
export default {
  ENGAGEMENT_THRESHOLDS,
  STATS_CONFIG,
  AGGREGATION_CONFIG,
  STREAK_CONFIG,
  CHECK_IN_RULES,
  ANALYTICS_CONFIG,
  NOTIFICATION_CONFIG,
  SUPPORTED_MODELS,
  DEFAULT_CHECK_IN_METHOD,
  
  // Helper functions
  getEngagementLevelFromVisits,
  validateCheckInTiming,
  isAttendanceSupported,
};

