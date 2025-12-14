/**
 * @classytic/clockin
 * Modern Attendance Management System
 *
 * Type-safe • Plugin-based • Event-driven • Multi-tenant
 *
 * @version 2.0.0
 * @author Classytic
 * @license MIT
 */

// ============================================================================
// MAIN API
// ============================================================================

export {
  ClockIn,
  ClockInBuilder,
  createClockIn,
  type ModelsConfig,
  type SingleTenantConfig,
  type ClockInOptions,
} from './clockin.js';

// ============================================================================
// RESULT TYPE (RUST-INSPIRED)
// ============================================================================

export {
  Result,
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  map,
  mapErr,
  flatMap,
  tryCatch,
  tryCatchSync,
  all,
  match,
  type Ok,
  type Err,
} from './core/result.js';

// ============================================================================
// EVENT SYSTEM
// ============================================================================

export {
  EventBus,
  createEventBus,
  type ClockInEventMap,
  type ClockInEventType,
  type CheckInRecordedEvent,
  type CheckOutRecordedEvent,
  type MilestoneAchievedEvent,
  type EngagementChangedEvent,
} from './core/events.js';

// ============================================================================
// PLUGIN SYSTEM
// ============================================================================

export {
  PluginManager,
  definePlugin,
  loggingPlugin,
  metricsPlugin,
  notificationPlugin,
  type ClockInPlugin,
  type PluginContext,
  type PluginLogger,
  type PluginHooks,
} from './core/plugin.js';

// ============================================================================
// CONTAINER (ADVANCED)
// ============================================================================

export { Container } from './core/container.js';

// ============================================================================
// SERVICES (DIRECT ACCESS IF NEEDED)
// ============================================================================

export { CheckInService } from './services/checkin.service.js';
export { CheckOutService } from './services/checkout.service.js';
export { AnalyticsService } from './services/analytics.service.js';

// ============================================================================
// SCHEMAS (FOR USER MODEL SETUP)
// ============================================================================

export {
  checkInEntrySchema,
  attendanceStatsSchema,
  currentSessionSchema,
  correctionRequestSchema,
  timeSlotDistributionSchema,
  commonAttendanceFields,
  attendanceIndexes,
  applyAttendanceIndexes,
  createAttendanceSchema,
} from './schemas/index.js';

// ============================================================================
// ERRORS
// ============================================================================

export {
  ClockInError,
  NotInitializedError,
  MemberNotFoundError,
  InvalidMemberError,
  DuplicateCheckInError,
  ValidationError,
  AttendanceNotEnabledError,
  NoActiveSessionError,
  AlreadyCheckedOutError,
  createError,
  isClockInError,
  extractErrorInfo,
  // Legacy alias
  AttendanceError,
} from './errors/index.js';

// ============================================================================
// ENUMS
// ============================================================================

export {
  // Status
  ATTENDANCE_STATUS,
  ATTENDANCE_STATUS_VALUES,
  // Methods
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
  // Stats mode
  STATS_CALCULATION_MODE,
  STATS_CALCULATION_MODE_VALUES,
  // Attendance type
  ATTENDANCE_TYPE,
  ATTENDANCE_TYPE_VALUES,
  // Time slot
  TIME_SLOT,
  TIME_SLOT_VALUES,
  // Correction
  CORRECTION_REQUEST_TYPE,
  CORRECTION_REQUEST_TYPE_VALUES,
  CORRECTION_REQUEST_STATUS,
  CORRECTION_REQUEST_STATUS_VALUES,
  // Priority
  PRIORITY,
  PRIORITY_VALUES,
  // Helper functions
  getEngagementLevel,
  getTimeSlot,
  calculateWorkDays,
  isValidTargetModel,
  isValidCheckInMethod,
  isAtRiskEngagement,
  isActiveEngagement,
} from './enums.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

export {
  // Default configs
  ENGAGEMENT_THRESHOLDS,
  STATS_CONFIG,
  AGGREGATION_CONFIG,
  STREAK_CONFIG,
  CHECK_IN_RULES,
  ANALYTICS_CONFIG,
  NOTIFICATION_CONFIG,
  SUPPORTED_MODELS,
  DEFAULT_CHECK_IN_METHOD,
  DEFAULT_RECORD_TTL_DAYS,
  // Config registry
  getConfig,
  registerConfig,
  hasConfig,
  getRegisteredModels,
  // Helper functions
  getEngagementLevelFromVisits,
  validateCheckInTiming,
  isAttendanceSupported,
} from './config.js';

// ============================================================================
// UTILITIES
// ============================================================================

export {
  // Logger
  getLogger,
  setLogger,
  resetLogger,
  createChildLogger,
  // Streak
  calculateStreak,
  isStreakMilestone,
  getNextStreakMilestone,
  daysUntilStreakBreaks,
  getStreakStatus,
  // Engagement
  calculateEngagementLevel,
  calculateDaysSinceLastVisit,
  calculateLoyaltyScore,
  calculateMonthsSince,
  hasEngagementChanged,
  getEngagementSeverity,
  getEngagementColor,
  getEngagementDisplayText,
  // Validators
  validateCheckInEligibility,
  validateTargetModel,
  validateCheckInMethod,
  validateOrganizationId,
  validatePagination,
  validateDateRange,
  validateYear,
  validateMonth,
  assertValidMember,
  assertValidCheckInTiming,
  // Schedule
  parseTime,
  calculateStandardHours,
  isWithinShift,
  isWorkingDay,
  calculateThresholds,
  calculateExpectedCheckout,
  formatSchedule,
  // Check-in
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
  // Query builders
  toObjectId,
  safeToObjectId,
  buildAttendanceMatch,
  buildMemberMatch,
  buildOccupancyPipeline,
  buildStatsAggregation,
  buildCurrentSessionQuery,
  buildDateRangeFilter,
  buildPeriodFilter,
  // Namespace exports
  streakUtils,
  engagementUtils,
  validatorUtils,
  scheduleUtils,
  checkInUtils,
  queryBuilders,
} from './utils/index.js';

// Detection utilities
export { detectAttendanceType, validateSchedule } from './utils/detection.js';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Core types
  ObjectId,
  ObjectIdLike,
  AnyDocument,
  AnyModel,
  DeepPartial,
  // Enum types
  AttendanceStatus,
  CheckInMethod,
  EngagementLevel,
  AttendancePeriod,
  AttendanceTargetModel,
  StatsCalculationMode,
  AttendanceType,
  TimeSlot,
  CorrectionRequestType,
  CorrectionRequestStatus,
  Priority,
  // Configuration types
  EngagementThresholds,
  StatsConfig,
  AggregationConfig,
  StreakConfig,
  CheckInRules,
  AnalyticsConfig,
  NotificationConfig,
  AutoCheckoutConfig,
  ValidationConfig,
  DetectionRules,
  TimeHints,
  DetectionConfig,
  ClockInConfig,
  // Schema types
  UserReference,
  LocationData,
  DeviceInfo,
  CorrectionEntry,
  CheckInEntry,
  TimeSlotDistribution,
  CorrectionRequest,
  AttendanceRecord,
  AttendanceStats,
  CurrentSession,
  WorkSchedule,
  // Operation types
  OperationContext,
  CheckInData,
  CheckInParams,
  CheckOutParams,
  CheckInResult,
  CheckOutResult,
  ToggleResult,
  ValidationResult,
  BulkCheckInData,
  BulkOperationResult,
  // Analytics types
  DashboardParams,
  DashboardSummary,
  EngagementDistributionEntry,
  TopMemberEntry,
  DashboardResult,
  HistoryParams,
  OccupancyData,
  ActiveSessionData,
  DailyTrendEntry,
  PeriodStats,
  // Correction types
  UpdateCheckInTimeParams,
  UpdateCheckOutTimeParams,
  OverrideAttendanceTypeParams,
  SubmitCorrectionRequestParams,
  ReviewCorrectionRequestParams,
  // Plugin types
  ClockInInstance,
  Plugin,
  PluginFunction,
  PluginType,
  // Event types
  ClockInEvent,
  EventPayloadBase,
  EventPayload,
  // Logger types
  Logger,
  // Error types
  ErrorCode,
  HttpError,
  // Utility types
  StreakResult,
  ScheduleThresholds,
  ScheduleCheckResult,
  WorkingDayResult,
  // Member types
  ClockInMember,
  WithClockIn,
  // Configuration types (re-export)
  TargetModelConfig,
} from './types.js';

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

import { ClockIn, createClockIn } from './clockin.js';
import { ClockInError } from './errors/index.js';
import { Result, ok, err } from './core/result.js';
import { EventBus } from './core/events.js';
import { loggingPlugin, notificationPlugin } from './core/plugin.js';

export default {
  // Main API
  ClockIn,
  createClockIn,

  // Error handling
  ClockInError,

  // Result type
  Result,
  ok,
  err,

  // Events
  EventBus,

  // Built-in plugins
  loggingPlugin,
  notificationPlugin,
};
