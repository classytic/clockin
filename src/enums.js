/**
 * 📋 ATTENDANCE ENUMS - SINGLE SOURCE OF TRUTH
 * All attendance-related enums for the reusable attendance library
 *
 * This is the ONLY place these are defined.
 * All other modules re-export from here.
 *
 * @module lib/attendance/enums
 */

// ============ ATTENDANCE STATUS ============
/**
 * Attendance Record Status
 */
export const ATTENDANCE_STATUS = {
  VALID: 'valid',
  INVALID: 'invalid',
  CORRECTED: 'corrected',
  DISPUTED: 'disputed',
};

export const ATTENDANCE_STATUS_VALUES = Object.values(ATTENDANCE_STATUS);

// ============ CHECK-IN METHOD ============
/**
 * How the check-in was performed
 */
export const CHECK_IN_METHOD = {
  MANUAL: 'manual',              // Staff manually checked in
  QR_CODE: 'qr_code',           // QR code scan
  RFID: 'rfid',                 // RFID card
  BIOMETRIC: 'biometric',       // Fingerprint/face recognition
  MOBILE_APP: 'mobile_app',     // Self check-in via app
  API: 'api',                   // API integration
};

export const CHECK_IN_METHOD_VALUES = Object.values(CHECK_IN_METHOD);

// ============ MEMBER ENGAGEMENT LEVEL ============
/**
 * Member engagement classification based on attendance patterns
 */
export const ENGAGEMENT_LEVEL = {
  HIGHLY_ACTIVE: 'highly_active',     // 12+ visits/month
  ACTIVE: 'active',                   // 8-11 visits/month
  REGULAR: 'regular',                 // 4-7 visits/month
  OCCASIONAL: 'occasional',           // 1-3 visits/month
  INACTIVE: 'inactive',               // 0 visits this month
  AT_RISK: 'at_risk',                // No visit in 14+ days
  DORMANT: 'dormant',                // No visit in 30+ days
};

export const ENGAGEMENT_LEVEL_VALUES = Object.values(ENGAGEMENT_LEVEL);

// ============ ATTENDANCE PERIOD TYPE ============
/**
 * Time period for aggregation
 */
export const ATTENDANCE_PERIOD = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

export const ATTENDANCE_PERIOD_VALUES = Object.values(ATTENDANCE_PERIOD);

// ============ ATTENDANCE TARGET MODELS ============
/**
 * Valid target models for polymorphic attendance tracking
 * 
 * These are the mongoose models that can have attendance:
 * - Membership: Gym member attendance
 * - Employee: Staff attendance (future)
 * - Trainer: Trainer attendance (future)
 * - Class: Class/session attendance (future)
 */
export const ATTENDANCE_TARGET_MODELS = {
  MEMBERSHIP: 'Membership',
  EMPLOYEE: 'Employee',
  TRAINER: 'Trainer',
  CLASS: 'Class',
};

export const ATTENDANCE_TARGET_MODEL_VALUES = Object.values(ATTENDANCE_TARGET_MODELS);

// ============ STATS CALCULATION MODE ============
/**
 * How attendance stats are calculated
 */
export const STATS_CALCULATION_MODE = {
  REAL_TIME: 'real_time',      // Calculate on-the-fly
  PRE_CALCULATED: 'pre_calculated',  // Use stored stats
  HYBRID: 'hybrid',            // Use cached with fallback
};

export const STATS_CALCULATION_MODE_VALUES = Object.values(STATS_CALCULATION_MODE);

// ============ ATTENDANCE TYPE ============
/**
 * Attendance type for work day classification
 * Used for employees to track full days, half days, and leaves
 */
export const ATTENDANCE_TYPE = {
  FULL_DAY: 'full_day',                      // Standard 8-hour workday
  HALF_DAY_MORNING: 'half_day_morning',      // Morning shift (4 hours)
  HALF_DAY_AFTERNOON: 'half_day_afternoon',  // Afternoon shift (4 hours)
  PAID_LEAVE: 'paid_leave',                  // Paid leave (counts as full day)
  UNPAID_LEAVE: 'unpaid_leave',              // Unpaid leave (no pay)
  OVERTIME: 'overtime',                       // Overtime shift (>8 hours)
};

export const ATTENDANCE_TYPE_VALUES = Object.values(ATTENDANCE_TYPE);

// ============ TIME SLOT ============
/**
 * Time slots for pattern analysis
 */
export const TIME_SLOT = {
  EARLY_MORNING: 'early_morning',    // 5am - 8am
  MORNING: 'morning',                // 8am - 12pm
  AFTERNOON: 'afternoon',            // 12pm - 5pm
  EVENING: 'evening',                // 5pm - 9pm
  NIGHT: 'night',                    // 9pm - 12am
};

export const TIME_SLOT_VALUES = Object.values(TIME_SLOT);

// ============ HELPER FUNCTIONS ============

/**
 * Determine engagement level from monthly visits
 * @param {Number} monthlyVisits - Number of visits this month
 * @param {Date} lastVisit - Last visit date
 * @returns {String} Engagement level
 */
export function getEngagementLevel(monthlyVisits, lastVisit) {
  if (!lastVisit) return ENGAGEMENT_LEVEL.DORMANT;
  
  const daysSinceLastVisit = Math.floor((Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24));
  
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
 * @param {Number} hour - Hour (0-23)
 * @returns {String} Time slot
 */
export function getTimeSlot(hour) {
  if (hour >= 5 && hour < 8) return TIME_SLOT.EARLY_MORNING;
  if (hour >= 8 && hour < 12) return TIME_SLOT.MORNING;
  if (hour >= 12 && hour < 17) return TIME_SLOT.AFTERNOON;
  if (hour >= 17 && hour < 21) return TIME_SLOT.EVENING;
  return TIME_SLOT.NIGHT;
}

/**
 * Calculate consecutive streak
 * Helper to determine if visits are consecutive days
 * @param {Array<Date>} visitDates - Array of visit dates (sorted desc)
 * @returns {Number} Consecutive days streak
 */
export function calculateStreak(visitDates) {
  if (!visitDates || visitDates.length === 0) return 0;

  let streak = 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < visitDates.length - 1; i++) {
    const current = new Date(visitDates[i]);
    const next = new Date(visitDates[i + 1]);
    current.setHours(0, 0, 0, 0);
    next.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((current - next) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculate work days value for payroll
 * Converts attendance records to decimal work days for salary calculation
 *
 * @param {Number} fullDays - Number of full days attended
 * @param {Number} halfDays - Number of half days attended
 * @param {Number} paidLeaveDays - Number of paid leave days
 * @returns {Number} Total work days (decimal)
 */
export function calculateWorkDays(fullDays = 0, halfDays = 0, paidLeaveDays = 0) {
  return fullDays + (halfDays * 0.5) + paidLeaveDays;
}

// Default export for convenience
export default {
  ATTENDANCE_STATUS,
  ATTENDANCE_STATUS_VALUES,
  CHECK_IN_METHOD,
  CHECK_IN_METHOD_VALUES,
  ENGAGEMENT_LEVEL,
  ENGAGEMENT_LEVEL_VALUES,
  ATTENDANCE_PERIOD,
  ATTENDANCE_PERIOD_VALUES,
  ATTENDANCE_TARGET_MODELS,
  ATTENDANCE_TARGET_MODEL_VALUES,
  STATS_CALCULATION_MODE,
  STATS_CALCULATION_MODE_VALUES,
  ATTENDANCE_TYPE,
  ATTENDANCE_TYPE_VALUES,
  TIME_SLOT,
  TIME_SLOT_VALUES,

  // Helper functions
  getEngagementLevel,
  getTimeSlot,
  calculateStreak,
  calculateWorkDays,
};

