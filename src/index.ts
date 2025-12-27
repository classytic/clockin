/**
 * @classytic/clockin
 * Modern Attendance Management System
 *
 * Type-safe | Plugin-based | Event-driven | Multi-tenant
 *
 * @version 2.0.0
 * @author Classytic
 * @license MIT
 *
 * @example
 * ```typescript
 * import { ClockIn, isOk } from '@classytic/clockin';
 *
 * const clockin = await ClockIn
 *   .create()
 *   .withModels({ Attendance, Membership })
 *   .build();
 *
 * const result = await clockin.checkIn.record({
 *   member,
 *   targetModel: 'Membership',
 *   context: { organizationId },
 * });
 *
 * if (isOk(result)) {
 *   console.log(`Total visits: ${result.value.stats.totalVisits}`);
 * }
 * ```
 */

// ============================================================================
// MAIN API - The primary interface
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
// RESULT TYPE - Error handling without exceptions
// ============================================================================

export {
  Result,
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  type Ok,
  type Err,
} from './core/result.js';

// ============================================================================
// PLUGINS - Built-in plugins
// ============================================================================

export {
  definePlugin,
  loggingPlugin,
  metricsPlugin,
  notificationPlugin,
  PluginError,
  type ClockInPlugin,
  type PluginContext,
  type PluginHooks,
  type PluginManagerOptions,
  type BeforeCheckInHookData,
  type BeforeCheckOutHookData,
  type CheckInHookData,
  type CheckOutHookData,
  type MilestoneHookData,
  type EngagementHookData,
} from './core/plugin.js';

// ============================================================================
// EVENTS - Type-safe event bus
// ============================================================================

export {
  EventBus,
  createEventBus,
  type Unsubscribe,
  type ClockInEventPayload,
  type ClockInEventMap,
  type ClockInEventType,
  type BaseEvent,
  type EventMemberInfo,
  type CheckInRecordedEvent,
  type CheckInFailedEvent,
  type CheckOutRecordedEvent,
  type CheckOutFailedEvent,
  type MilestoneAchievedEvent,
  type EngagementChangedEvent,
  type StatsUpdatedEvent,
  type MemberAtRiskEvent,
  type MemberInactiveEvent,
  type SessionExpiredEvent,
} from './core/events.js';

// ============================================================================
// SCHEMAS - For user model setup
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
// ERRORS - Error classes
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
  TargetModelNotAllowedError,
  isClockInError,
} from './errors/index.js';

// ============================================================================
// ENUMS - Constants
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
  BUILT_IN_TARGET_MODELS,
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
} from './enums.js';

// ============================================================================
// CONFIG UTILITIES - Configuration helpers
// ============================================================================

export {
  deepMerge,
  generateDefaultConfig,
  getConfig,
} from './config.js';

// ============================================================================
// ESSENTIAL TYPES - Commonly used types
// ============================================================================

export type {
  // Core types
  ObjectId,
  ObjectIdLike,
  AnyDocument,
  DeepPartial,
  // Enum types
  AttendanceStatus,
  CheckInMethod,
  EngagementLevel,
  AttendancePeriod,
  AttendanceType,
  AttendanceTargetModel,
  TimeSlot,
  Priority,
  CorrectionRequestType,
  CorrectionRequestStatus,
  // Schema types
  CheckInEntry,
  AttendanceRecord,
  AttendanceStats,
  CurrentSession,
  CorrectionEntry,
  CorrectionRequest,
  LocationData,
  DeviceInfo,
  // Operation types
  OperationContext,
  CheckInParams,
  CheckOutParams,
  CheckInResult,
  CheckOutResult,
  CheckoutExpiredParams,
  CheckoutExpiredResult,
  ToggleResult,
  CheckInData,
  ValidationResult,
  BulkCheckInData,
  BulkOperationResult,
  SubmitCorrectionRequestParams,
  ReviewCorrectionRequestParams,
  // Analytics types
  DashboardParams,
  DashboardResult,
  HistoryParams,
  OccupancyData,
  ActiveSessionData,
  DailyTrendEntry,
  PeriodStats,
  // Member types
  ClockInMember,
  // Legacy instance typing (v1-style plugins)
  ClockInInstance,
  // Configuration types
  EngagementThresholds,
  StatsConfig,
  AggregationConfig,
  StreakConfig,
  CheckInRules,
  AnalyticsConfig,
  NotificationConfig,
  WorkSchedule,
  AutoCheckoutConfig,
  ValidationConfig,
  DetectionRules,
  TimeHints,
  DetectionConfig,
  TargetModelConfig,
  SingleTenantConfig as ClockInSingleTenantConfig,
  ClockInConfig,
  // Logger types
  Logger,
} from './types.js';

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

import { ClockIn, createClockIn } from './clockin.js';
import { ClockInError } from './errors/index.js';
import { ok, err, isOk, isErr } from './core/result.js';
import { loggingPlugin, notificationPlugin } from './core/plugin.js';
import { deepMerge } from './config.js';

export default {
  ClockIn,
  createClockIn,
  ClockInError,
  ok,
  err,
  isOk,
  isErr,
  loggingPlugin,
  notificationPlugin,
  deepMerge,
};
