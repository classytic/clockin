/**
 * ClockIn Utilities
 *
 * Centralized export for all utility functions
 *
 * @module @classytic/clockin/utils
 */

// Logger
export { getLogger, setLogger, resetLogger, createChildLogger } from './logger.js';
export type { Logger } from '../types.js';

// Streak calculations
export {
  calculateStreak,
  isStreakMilestone,
  getNextStreakMilestone,
  daysUntilStreakBreaks,
  getStreakStatus,
} from './streak.js';

// Engagement calculations
export {
  calculateEngagementLevel,
  calculateDaysSinceLastVisit,
  calculateLoyaltyScore,
  calculateMonthsSince,
  hasEngagementChanged,
  getEngagementSeverity,
  getEngagementColor,
  getEngagementDisplayText,
} from './engagement.js';

// Validators
export {
  validateCheckInEligibility,
  validateCheckInTiming,
  validateTargetModel,
  validateCheckInMethod,
  validateOrganizationId,
  validatePagination,
  validateDateRange,
  validateYear,
  validateMonth,
  assertValidMember,
  assertValidCheckInTiming,
} from './validators.js';

// Schedule utilities
export {
  parseTime,
  calculateStandardHours,
  isWithinShift,
  isWorkingDay,
  calculateThresholds,
  calculateExpectedCheckout,
  formatSchedule,
} from './schedule.js';

// Check-in utilities
export {
  isActiveCheckIn,
  isExpiredCheckIn,
  findActiveSession,
  filterActiveCheckIns,
  countActiveCheckIns,
  calculateDuration,
  getCurrentPeriod,
  groupByTargetModel,
  calculateTotalCount,
  getUniqueDays,
  countUniqueDays,
  getMostCommonTimeSlot,
  groupCheckInsByDate,
} from './check-in.js';

// Query builders
export {
  toObjectId,
  safeToObjectId,
  buildAttendanceMatch,
  buildMemberMatch,
  buildOccupancyPipeline,
  buildStatsAggregation,
  buildCurrentSessionQuery,
  buildDateRangeFilter,
  buildPeriodFilter,
} from './query-builders.js';

// Detection utilities
export { detectAttendanceType, validateSchedule } from './detection.js';

// Namespace exports for advanced use
export * as streakUtils from './streak.js';
export * as engagementUtils from './engagement.js';
export * as validatorUtils from './validators.js';
export * as scheduleUtils from './schedule.js';
export * as checkInUtils from './check-in.js';
export * as queryBuilders from './query-builders.js';
export * as detectionUtils from './detection.js';
