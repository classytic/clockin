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
  type ClockInPlugin,
  type PluginContext,
  type PluginHooks,
} from './core/plugin.js';

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
  // Methods
  CHECK_IN_METHOD,
  // Engagement
  ENGAGEMENT_LEVEL,
  // Period
  ATTENDANCE_PERIOD,
  // Target models
  BUILT_IN_TARGET_MODELS,
  // Attendance type
  ATTENDANCE_TYPE,
  // Time slot
  TIME_SLOT,
  // Correction
  CORRECTION_REQUEST_TYPE,
  CORRECTION_REQUEST_STATUS,
  // Priority
  PRIORITY,
  // Helper functions
  getEngagementLevel,
  getTimeSlot,
} from './enums.js';

// ============================================================================
// ESSENTIAL TYPES - Commonly used types
// ============================================================================

export type {
  // Core types
  ObjectId,
  ObjectIdLike,
  AnyDocument,
  // Enum types
  AttendanceStatus,
  CheckInMethod,
  EngagementLevel,
  AttendancePeriod,
  AttendanceType,
  TimeSlot,
  // Schema types
  CheckInEntry,
  AttendanceRecord,
  AttendanceStats,
  CurrentSession,
  // Operation types
  OperationContext,
  CheckInParams,
  CheckOutParams,
  CheckInResult,
  CheckOutResult,
  ValidationResult,
  BulkCheckInData,
  BulkOperationResult,
  // Analytics types
  DashboardParams,
  DashboardResult,
  // Member types
  ClockInMember,
  // Plugin types
  ClockInInstance,
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
};
