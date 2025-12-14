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
  AttendanceTargetModel,
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

export const ATTENDANCE_TARGET_MODELS = {
  MEMBERSHIP: 'Membership',
  EMPLOYEE: 'Employee',
  TRAINER: 'Trainer',
  CLASS: 'Class',
  STUDENT: 'Student',
  USER: 'User',
} as const satisfies Record<string, AttendanceTargetModel>;

export const ATTENDANCE_TARGET_MODEL_VALUES = Object.values(ATTENDANCE_TARGET_MODELS);

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

/**
 * Check if target model is supported
 * @param model - Model name to check
 * @returns Whether model is supported
 */
export function isValidTargetModel(model: string): model is AttendanceTargetModel {
  return ATTENDANCE_TARGET_MODEL_VALUES.includes(model as AttendanceTargetModel);
}

/**
 * Check if check-in method is valid
 * @param method - Method to check
 * @returns Whether method is valid
 */
export function isValidCheckInMethod(method: string): method is CheckInMethod {
  return CHECK_IN_METHOD_VALUES.includes(method as CheckInMethod);
}

/**
 * Check if engagement level indicates risk
 * @param level - Engagement level
 * @returns Whether member is at risk
 */
export function isAtRiskEngagement(level: EngagementLevel): boolean {
  return level === ENGAGEMENT_LEVEL.AT_RISK || level === ENGAGEMENT_LEVEL.DORMANT;
}

/**
 * Check if engagement level is active
 * @param level - Engagement level
 * @returns Whether member is actively engaged
 */
export function isActiveEngagement(level: EngagementLevel): boolean {
  return (
    level === ENGAGEMENT_LEVEL.HIGHLY_ACTIVE ||
    level === ENGAGEMENT_LEVEL.ACTIVE ||
    level === ENGAGEMENT_LEVEL.REGULAR
  );
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
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
  // Helpers
  getEngagementLevel,
  getTimeSlot,
  calculateWorkDays,
  isValidTargetModel,
  isValidCheckInMethod,
  isAtRiskEngagement,
  isActiveEngagement,
};

