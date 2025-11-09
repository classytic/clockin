/**
 * 🌟 ATTENDANCE FRAMEWORK - PUBLIC API
 * Reusable, multi-tenant attendance tracking library
 *
 * Usage:
 * ```javascript
 * import { attendance } from '#lib/attendance/index.js';
 *
 * // Check-in
 * await attendance.checkIn({ member, targetModel: 'Membership', data, context });
 *
 * // Analytics
 * const dashboard = await attendance.dashboard({ MemberModel, organizationId });
 * const history = await attendance.history({ memberId, organizationId, year, month });
 *
 * // Stats
 * const stats = attendance.getStats(member);
 * await attendance.recalculateStats({ MemberModel, organizationId });
 *
 * // Note: For member filtering with attendance stats, use /api/v1/memberships endpoint
 * ```
 *
 * @module lib/attendance
 * @version 1.0.0 - Multi-Tenant Attendance System
 */

// ============ TYPE DEFINITIONS (JSDoc - Pure JavaScript) ============

/**
 * @typedef {Object} AttendanceConfig
 * @property {import('mongoose').Model} AttendanceModel - Your Attendance mongoose model
 * @property {Object} [configs] - Custom configs per target model (optional)
 * @property {Object} [logger] - Optional custom logger (pino, winston, etc)
 */

/**
 * @typedef {Object} CheckInParams
 * @property {Object} member - Member/Employee entity
 * @property {string} targetModel - 'Membership' | 'Employee' | 'User'
 * @property {Object} [data] - Check-in data (method, location, etc)
 * @property {Object} [context] - Request context (organizationId, userId, etc)
 */

/**
 * @typedef {Object} CheckOutParams
 * @property {Object} member - Member/Employee entity
 * @property {string} targetModel - 'Membership' | 'Employee' | 'User'
 * @property {Object} [context] - Request context
 */

/**
 * @typedef {Object} DashboardParams
 * @property {import('mongoose').Model} MemberModel - Member mongoose model
 * @property {string} organizationId - Organization ID
 * @property {string} [period] - 'today' | 'week' | 'month'
 * @property {Object} [filters] - Additional filters
 */

/**
 * @typedef {Object} HistoryParams
 * @property {string} memberId - Member ID
 * @property {string} organizationId - Organization ID
 * @property {number} [year] - Year (e.g., 2024)
 * @property {number} [month] - Month (1-12)
 * @property {number} [limit] - Pagination limit
 * @property {number} [offset] - Pagination offset
 */

/**
 * @typedef {Object} AttendanceStats
 * @property {number} totalCheckIns - Total check-ins
 * @property {number} currentStreak - Current consecutive days streak
 * @property {number} longestStreak - Longest streak achieved
 * @property {string} lastVisit - ISO date string of last visit
 * @property {string} engagementLevel - 'active' | 'at_risk' | 'inactive' | 'churned'
 */

/**
 * @typedef {Object} CorrectionRequestParams
 * @property {string} requestType - 'update_check_in_time' | 'update_check_out_time' | 'add_missing_attendance' | 'delete_duplicate' | 'override_attendance_type'
 * @property {string} targetDate - ISO date string
 * @property {Object} [proposedChanges] - Proposed changes
 * @property {string} [reason] - Reason for correction
 */

// ============ CORE ORCHESTRATOR ============
// The main attendance API - use this 99% of the time
export { attendance } from './attendance.orchestrator.js';

// ============ ERRORS ============
// Custom error classes for proper error handling
export {
  AttendanceError,
  DuplicateCheckInError,
  MemberNotFoundError,
  InvalidMemberError,
  ValidationError,
  NotInitializedError,
  AttendanceNotEnabledError,
} from './errors/index.js';

// ============ UTILITIES ============
// Pure functions for calculations and validations
export {
  // Streak calculations
  calculateStreak,
  isStreakMilestone,
  getNextStreakMilestone,
  daysUntilStreakBreaks,

  // Engagement calculations
  calculateEngagementLevel,
  calculateDaysSinceLastVisit,
  calculateLoyaltyScore,
  hasEngagementChanged,
  getEngagementSeverity,

  // Stats calculations
  calculateAttendanceStats,
  calculateGrowthRate,
  calculateMilestonesReached,
  getNextMilestone,

  // Validators
  validateCheckInEligibility,
  validateTargetModel,
  validateCheckInMethod,
  validateOrganizationId,
  validatePagination,
  validateDateRange,
} from './utils/index.js';

// Check-in utilities (pure, testable functions)
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
} from './utils/check-in.utils.js';

// Schedule utilities (pure functions for work schedule calculations)
export * as scheduleUtils from './utils/schedule.utils.js';
export {
  calculateStandardHours,
  calculateThresholds,
  calculateExpectedCheckout,
  parseTime,
  isWorkingDay,
  isWithinShift,
  formatSchedule,
} from './utils/schedule.utils.js';

// Detection utilities (configuration-driven attendance type detection)
export {
  detectAttendanceType,
  validateCheckIn as validateSchedule,  // Schedule-only validation (use validateCheckIn from check-in.manager for full validation)
} from './utils/detection.utils.js';

// Query builders (MongoDB query construction)
export {
  toObjectId,
  buildAttendanceMatch,
  buildMemberMatch,
  buildOccupancyPipeline,
  buildStatsAggregation,
  buildCurrentSessionQuery,
} from './utils/query-builders.js';

// Session service (clean abstraction layer)
export {
  SessionService,
  createSessionService,
} from './services/session.service.js';

// ============ EVENTS ============
// Event emitter for integrations
export { attendanceEvents } from './events/attendance.events.js';

// ============ WEBHOOKS ============
// Webhook manager (TODO: implement when notification system ready)
export { webhookManager } from './webhooks/webhook.manager.js';

// ============ CANONICAL ENUMS (Single Source of Truth) ============
export {
  // Status
  ATTENDANCE_STATUS,
  ATTENDANCE_STATUS_VALUES,

  // Check-in method
  CHECK_IN_METHOD,
  CHECK_IN_METHOD_VALUES,

  // Engagement
  ENGAGEMENT_LEVEL,
  ENGAGEMENT_LEVEL_VALUES,

  // Period
  ATTENDANCE_PERIOD,
  ATTENDANCE_PERIOD_VALUES,

  // Target models
  ATTENDANCE_TARGET_MODELS,
  ATTENDANCE_TARGET_MODEL_VALUES,

  // Stats calculation
  STATS_CALCULATION_MODE,
  STATS_CALCULATION_MODE_VALUES,

  // Attendance types (for work day classification)
  ATTENDANCE_TYPE,
  ATTENDANCE_TYPE_VALUES,

  // Time slots
  TIME_SLOT,
  TIME_SLOT_VALUES,

  // Helper functions
  getEngagementLevel,
  getTimeSlot,
  calculateWorkDays,
} from './enums.js';

// ============ ATTENDANCE CONFIGURATIONS (Smart Defaults) ============
// Auto-generates configs based on entity type
export {
  getConfig,
  registerConfig,
  hasConfig,
  getRegisteredModels,
} from './configs/index.js';

// ============ CONFIGURATION ============
export {
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
} from './config.js';

// ============ SCHEMAS ============
// Mongoose schemas for models
export {
  checkInEntrySchema,
  currentSessionSchema,
  attendanceStatsSchema,
  monthlyAttendanceSummarySchema,
  attendancePatternSchema,
  commonAttendanceFields,
  attendanceIndexes,
  applyAttendanceIndexes, // Helper to apply indexes automatically
} from './schemas/attendance.schema.js';

// JSON Schema definitions for API operations
export {
  checkInBody,
  checkInResponse,
  attendanceHistoryQuery,
  analyticsQuery,
  bulkCheckInBody,
  updateStatsBody,
} from './schemas/api.schema.js';

// ============ MODELS ============
// Attendance model (monthly aggregation)
export { default as AttendanceModel } from './models/attendance.model.js';

// Note: Correction requests use nested structure in attendance model (no separate collection)

// ============ CORE MANAGERS ============
// For advanced use cases - most apps won't need these
// Prefer using the orchestrator above
export * as CheckIn from './core/check-in.manager.js';
export * as Analytics from './core/analytics.manager.js';

// Individual functions (for tree-shaking)
export {
  validateCheckIn,
  createCheckInEntry,
  recordCheckIn,
  calculateUpdatedStats,
  bulkRecordCheckIns,
} from './core/check-in.manager.js';

export {
  getMemberAttendanceHistory,
  getDashboardAnalytics,
  getTimeSlotDistribution,
  getDailyAttendanceTrend,
  recalculateAllStats,
} from './core/analytics.manager.js';

// Correction operations (admin manual corrections)
export * as Correction from './core/correction.manager.js';
export {
  updateCheckInTime,
  updateCheckOutTime,
  overrideAttendanceType,
  deleteCheckIn,
  addRetroactiveAttendance,
} from './core/correction.manager.js';

// Correction requests (employee self-service)
export * as CorrectionRequest from './core/correction-request.manager.js';
export {
  submitCorrectionRequest,
  getCorrectionRequests,
  reviewCorrectionRequest,
  applyCorrectionRequest,
} from './core/correction-request.manager.js';

// ============ INITIALIZATION ============
/**
 * Initialize attendance framework
 * Call this ONCE in your app bootstrap (bootstrap/attendance.js)
 *
 * Benefits:
 * - Global DI for Attendance model
 * - Zero per-module wiring
 * - Single bootstrap point
 *
 * Usage:
 * ```javascript
 * import { initializeAttendance } from '#lib/attendance/index.js';
 * import Attendance from '#lib/attendance/models/attendance.model.js';
 *
 * initializeAttendance({ AttendanceModel: Attendance });
 * ```
 *
 * @param {AttendanceConfig} config - Configuration object
 * @returns {void}
 *
 * @example
 * // Basic initialization
 * initializeAttendance({ AttendanceModel: Attendance });
 *
 * @example
 * // With custom logger
 * initializeAttendance({
 *   AttendanceModel: Attendance,
 *   logger: myPinoLogger
 * });
 *
 * @example
 * // With custom configs
 * initializeAttendance({
 *   AttendanceModel: Attendance,
 *   configs: {
 *     Membership: myMembershipConfig,
 *     Employee: myEmployeeConfig
 *   }
 * });
 */
export { initializeAttendance, isInitialized } from './init.js';

// ============ LOGGER CONFIGURATION ============
// Logger configuration (for custom logger injection)
export { setLogger } from './utils/logger.js';

// ============ JOBS & MAINTENANCE ============
// Background jobs for maintenance and cleanup
export {
  cleanupStaleSessions,
  cleanupStaleSessionsForOrg,
  getStaleSessionCount,
} from './jobs/cleanup-stale-sessions.js';

// ============ DEFAULT EXPORT ============
// For CommonJS compatibility and convenience
export { attendance as default } from './attendance.orchestrator.js';

