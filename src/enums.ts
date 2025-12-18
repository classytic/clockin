/**
 * ClockIn Enums - Single Source of Truth
 *
 * All attendance-related enums defined with const assertions
 * for type inference and runtime values
 *
 * @module @classytic/clockin/enums
 */

import type {
  AttendanceStatus,
  CheckInMethod,
  EngagementLevel,
  AttendancePeriod,
  StatsCalculationMode,
  AttendanceType,
  TimeSlot,
  CorrectionRequestType,
  CorrectionRequestStatus,
  Priority,
} from './types.js';

// ============================================================================
// ATTENDANCE STATUS
// ============================================================================

export const ATTENDANCE_STATUS = {
  VALID: 'valid',
  INVALID: 'invalid',
  CORRECTED: 'corrected',
  DISPUTED: 'disputed',
} as const satisfies Record<string, AttendanceStatus>;

export const ATTENDANCE_STATUS_VALUES = Object.values(ATTENDANCE_STATUS);

// ============================================================================
// CHECK-IN METHOD
// ============================================================================

export const CHECK_IN_METHOD = {
  MANUAL: 'manual',
  QR_CODE: 'qr_code',
  RFID: 'rfid',
  BIOMETRIC: 'biometric',
  MOBILE_APP: 'mobile_app',
  API: 'api',
} as const satisfies Record<string, CheckInMethod>;

export const CHECK_IN_METHOD_VALUES = Object.values(CHECK_IN_METHOD);

// ============================================================================
// ENGAGEMENT LEVEL
// ============================================================================

export const ENGAGEMENT_LEVEL = {
  HIGHLY_ACTIVE: 'highly_active',
  ACTIVE: 'active',
  REGULAR: 'regular',
  OCCASIONAL: 'occasional',
  INACTIVE: 'inactive',
  AT_RISK: 'at_risk',
  DORMANT: 'dormant',
} as const satisfies Record<string, EngagementLevel>;

export const ENGAGEMENT_LEVEL_VALUES = Object.values(ENGAGEMENT_LEVEL);

// ============================================================================
// ATTENDANCE PERIOD
// ============================================================================

export const ATTENDANCE_PERIOD = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const satisfies Record<string, AttendancePeriod>;

export const ATTENDANCE_PERIOD_VALUES = Object.values(ATTENDANCE_PERIOD);

// ============================================================================
// ATTENDANCE TARGET MODELS
// ============================================================================

/**
 * Built-in target models with pre-configured settings.
 *
 * Custom target models are supported - just pass them to `.withModels()`.
 * Built-in models have smart defaults for detection and auto-checkout.
 */
export const BUILT_IN_TARGET_MODELS = {
  MEMBERSHIP: 'Membership',
  EMPLOYEE: 'Employee',
  TRAINER: 'Trainer',
  CLASS: 'Class',
  STUDENT: 'Student',
  USER: 'User',
} as const;

/** Array of built-in target model names */
export const BUILT_IN_TARGET_MODEL_VALUES = Object.values(BUILT_IN_TARGET_MODELS);

// ============================================================================
// STATS CALCULATION MODE
// ============================================================================

export const STATS_CALCULATION_MODE = {
  REAL_TIME: 'real_time',
  PRE_CALCULATED: 'pre_calculated',
  HYBRID: 'hybrid',
} as const satisfies Record<string, StatsCalculationMode>;

export const STATS_CALCULATION_MODE_VALUES = Object.values(STATS_CALCULATION_MODE);

// ============================================================================
// ATTENDANCE TYPE
// ============================================================================

export const ATTENDANCE_TYPE = {
  FULL_DAY: 'full_day',
  HALF_DAY_MORNING: 'half_day_morning',
  HALF_DAY_AFTERNOON: 'half_day_afternoon',
  PAID_LEAVE: 'paid_leave',
  UNPAID_LEAVE: 'unpaid_leave',
  OVERTIME: 'overtime',
} as const satisfies Record<string, AttendanceType>;

export const ATTENDANCE_TYPE_VALUES = Object.values(ATTENDANCE_TYPE);

// ============================================================================
// TIME SLOT
// ============================================================================

export const TIME_SLOT = {
  EARLY_MORNING: 'early_morning',
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  EVENING: 'evening',
  NIGHT: 'night',
} as const satisfies Record<string, TimeSlot>;

export const TIME_SLOT_VALUES = Object.values(TIME_SLOT);

// ============================================================================
// CORRECTION REQUEST TYPE
// ============================================================================

export const CORRECTION_REQUEST_TYPE = {
  UPDATE_CHECK_IN_TIME: 'update_check_in_time',
  UPDATE_CHECK_OUT_TIME: 'update_check_out_time',
  ADD_MISSING_ATTENDANCE: 'add_missing_attendance',
  DELETE_DUPLICATE: 'delete_duplicate',
  OVERRIDE_ATTENDANCE_TYPE: 'override_attendance_type',
} as const satisfies Record<string, CorrectionRequestType>;

export const CORRECTION_REQUEST_TYPE_VALUES = Object.values(CORRECTION_REQUEST_TYPE);

// ============================================================================
// CORRECTION REQUEST STATUS
// ============================================================================

export const CORRECTION_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  APPLIED: 'applied',
} as const satisfies Record<string, CorrectionRequestStatus>;

export const CORRECTION_REQUEST_STATUS_VALUES = Object.values(CORRECTION_REQUEST_STATUS);

// ============================================================================
// PRIORITY
// ============================================================================

export const PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const satisfies Record<string, Priority>;

export const PRIORITY_VALUES = Object.values(PRIORITY);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get engagement level from monthly visits and last visit
 * @param monthlyVisits - Number of visits this month
 * @param lastVisit - Last visit date (optional)
 * @returns Engagement level
 */
export function getEngagementLevel(
  monthlyVisits: number,
  lastVisit: Date | null | undefined
): EngagementLevel {
  if (!lastVisit) {
    return ENGAGEMENT_LEVEL.DORMANT;
  }

  const daysSinceLastVisit = Math.floor(
    (Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastVisit >= 30) return ENGAGEMENT_LEVEL.DORMANT;
  if (daysSinceLastVisit >= 14) return ENGAGEMENT_LEVEL.AT_RISK;
  if (monthlyVisits === 0) return ENGAGEMENT_LEVEL.INACTIVE;
  if (monthlyVisits >= 12) return ENGAGEMENT_LEVEL.HIGHLY_ACTIVE;
  if (monthlyVisits >= 8) return ENGAGEMENT_LEVEL.ACTIVE;
  if (monthlyVisits >= 4) return ENGAGEMENT_LEVEL.REGULAR;
  return ENGAGEMENT_LEVEL.OCCASIONAL;
}

/**
 * Get time slot from hour
 * @param hour - Hour (0-23)
 * @returns Time slot
 */
export function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 5 && hour < 8) return TIME_SLOT.EARLY_MORNING;
  if (hour >= 8 && hour < 12) return TIME_SLOT.MORNING;
  if (hour >= 12 && hour < 17) return TIME_SLOT.AFTERNOON;
  if (hour >= 17 && hour < 21) return TIME_SLOT.EVENING;
  return TIME_SLOT.NIGHT;
}

/**
 * Calculate work days value for payroll
 * @param fullDays - Number of full days
 * @param halfDays - Number of half days
 * @param paidLeaveDays - Number of paid leave days
 * @returns Total work days (decimal)
 */
export function calculateWorkDays(
  fullDays = 0,
  halfDays = 0,
  paidLeaveDays = 0
): number {
  return fullDays + halfDays * 0.5 + paidLeaveDays;
}


// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
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
  // Helpers
  getEngagementLevel,
  getTimeSlot,
};

