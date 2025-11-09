/**
 * 📋 Attendance Mongoose Schemas
 * Reusable schemas for attendance tracking
 *
 * These schemas can be embedded in any model (Membership, Employee, etc.)
 * 
 * @module lib/attendance/schemas/attendance
 */

import mongoose from 'mongoose';
import {
  ATTENDANCE_STATUS_VALUES,
  CHECK_IN_METHOD_VALUES,
  ENGAGEMENT_LEVEL_VALUES,
  TIME_SLOT_VALUES,
  ATTENDANCE_TYPE_VALUES,
} from '../enums.js';

const { Schema } = mongoose;

/**
 * Single check-in entry schema
 * Minimal data per check-in for storage efficiency
 */
export const checkInEntrySchema = new Schema({
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },

  checkOutAt: {
    type: Date,
    default: null,
  },

  expectedCheckOutAt: {
    type: Date,
    index: true,
  },

  duration: {
    type: Number,
    min: 0,
  },

  autoCheckedOut: {
    type: Boolean,
    default: false,
  },

  recordedBy: {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: String,
    role: String,
  },

  checkedOutBy: {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: String,
    role: String,
  },

  method: {
    type: String,
    enum: CHECK_IN_METHOD_VALUES,
    default: 'manual',
  },

  status: {
    type: String,
    enum: ATTENDANCE_STATUS_VALUES,
    default: 'valid',
  },

  timeSlot: {
    type: String,
    enum: TIME_SLOT_VALUES,
  },

  attendanceType: {
    type: String,
    enum: ATTENDANCE_TYPE_VALUES,
    default: 'full_day',
  },

  location: {
    lat: Number,
    lng: Number,
    accuracy: Number,
  },

  device: {
    type: String,
    platform: String,
    appVersion: String,
  },

  notes: String,

  // Correction audit trail (admin manual corrections)
  corrections: [{
    field: String,                    // 'timestamp', 'checkOutAt', 'attendanceType'
    originalValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    reason: String,
    correctedBy: {
      userId: Schema.Types.ObjectId,
      userName: String,
      userRole: String,
    },
    correctedAt: { type: Date, default: Date.now },
  }],

  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
  },
}, {
  _id: true,
  timestamps: false,
});

/**
 * Pre-calculated attendance statistics
 * Embedded in member/employee documents for fast access
 * 
 * These are updated atomically on each check-in
 * No need to query attendance collection for basic stats
 */
export const attendanceStatsSchema = new Schema({
  // Total lifetime visits
  totalVisits: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Last visit timestamp
  lastVisitedAt: {
    type: Date,
  },
  
  // First visit timestamp (for tenure calculation)
  firstVisitedAt: {
    type: Date,
  },
  
  // Current consecutive visit streak (days)
  currentStreak: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Longest streak ever achieved (days)
  longestStreak: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Average visits per month (calculated)
  monthlyAverage: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Current month visits
  thisMonthVisits: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Last month visits (for comparison)
  lastMonthVisits: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Engagement level (auto-calculated)
  engagementLevel: {
    type: String,
    enum: ENGAGEMENT_LEVEL_VALUES,
    default: 'inactive',
  },
  
  // Days since last visit (for at-risk detection)
  daysSinceLastVisit: {
    type: Number,
    min: 0,
  },
  
  // Favorite time slot (most common check-in time)
  favoriteTimeSlot: {
    type: String,
    enum: TIME_SLOT_VALUES,
  },
  
  // Loyalty score (0-100, calculated from multiple factors)
  loyaltyScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  
  // Last updated timestamp (for cache invalidation)
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  _id: false,
  timestamps: false,
});

/**
 * Monthly attendance summary
 * Lightweight summary for quick access
 */
export const monthlyAttendanceSummarySchema = new Schema({
  year: {
    type: Number,
    required: true,
  },
  
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
  },
  
  totalVisits: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  uniqueDays: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  averagePerWeek: {
    type: Number,
    default: 0,
  },
  
  mostCommonTimeSlot: {
    type: String,
    enum: TIME_SLOT_VALUES,
  },
}, {
  _id: false,
});

/**
 * Attendance pattern analysis
 * For predictive analytics
 */
export const attendancePatternSchema = new Schema({
  // Preferred days of week (0-6, Sunday = 0)
  preferredDays: [{
    type: Number,
    min: 0,
    max: 6,
  }],
  
  // Preferred time slots
  preferredTimeSlots: [{
    type: String,
    enum: TIME_SLOT_VALUES,
  }],
  
  // Average minutes per visit
  averageSessionDuration: Number,
  
  // Regularity score (0-100, how predictable are visits)
  regularityScore: {
    type: Number,
    min: 0,
    max: 100,
  },
  
  // Trend (increasing, decreasing, stable)
  trend: {
    type: String,
    enum: ['increasing', 'decreasing', 'stable'],
  },
}, {
  _id: false,
});

/**
 * Current session tracking schema
 * Real-time check-in status cached on member document for fast access
 *
 * WHY: Frontend needs to know "is this member checked in?" without extra queries
 * Updated atomically on check-in/check-out operations
 */
export const currentSessionSchema = new Schema({
  // Is member currently checked in?
  isActive: {
    type: Boolean,
    default: false,
    index: true, // For "who's in the gym now" queries
  },

  // Reference to active check-in entry ID in Attendance collection
  checkInId: {
    type: Schema.Types.ObjectId,
  },

  // When did they check in?
  checkInTime: {
    type: Date,
  },

  // Expected check-out time (for auto-checkout)
  expectedCheckOutAt: {
    type: Date,
  },

  // Check-in method used
  method: {
    type: String,
    enum: CHECK_IN_METHOD_VALUES,
  },
}, {
  _id: false,
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

/**
 * Virtual field: Calculate duration dynamically
 * Returns minutes since check-in (only if currently active)
 */
currentSessionSchema.virtual('durationMinutes').get(function() {
  if (!this.isActive || !this.checkInTime) {
    return 0;
  }
  return Math.floor((Date.now() - new Date(this.checkInTime).getTime()) / (1000 * 60));
});

/**
 * Validation: Ensure currentSession state consistency
 * - If isActive = true, must have checkInId, checkInTime, and method
 * - If isActive = false, must have null checkInId and checkInTime
 */
currentSessionSchema.pre('validate', function(next) {
  // Skip validation if parent document is being deleted
  if (this.ownerDocument && this.ownerDocument().$isDeleted) {
    return next();
  }

  if (this.isActive) {
    // Active session requires all fields
    if (!this.checkInId) {
      return next(new Error('Active currentSession requires checkInId'));
    }
    if (!this.checkInTime) {
      return next(new Error('Active currentSession requires checkInTime'));
    }
    if (!this.method) {
      return next(new Error('Active currentSession requires method'));
    }
  } else {
    // Inactive session must have null fields
    if (this.checkInId) {
      return next(new Error('Inactive currentSession must have null checkInId'));
    }
    if (this.checkInTime) {
      return next(new Error('Inactive currentSession must have null checkInTime'));
    }
  }

  next();
});

/**
 * Common attendance fields
 * Use this for models that need basic attendance tracking
 */
export const commonAttendanceFields = {
  // ⭐ REAL-TIME STATUS: Current active session (cached for fast frontend access)
  currentSession: {
    type: currentSessionSchema,
    default: () => ({ isActive: false }),
  },

  // Historical stats (updated on each check-in/out)
  attendanceStats: {
    type: attendanceStatsSchema,
    default: () => ({}),
  },

  // Is attendance tracking enabled for this member?
  attendanceEnabled: {
    type: Boolean,
    default: true,
  },

  // Admin notes about attendance
  attendanceNotes: String,
};

/**
 * Index recommendations for attendance queries
 */
export const attendanceIndexes = [
  // Find by tenant and date range
  { tenantId: 1, year: 1, month: 1 },

  // Find by member and date
  { targetId: 1, year: 1, month: 1 },

  // Analytics queries
  { tenantId: 1, 'checkIns.timestamp': 1 },

  // Engagement queries
  { tenantId: 1, 'attendanceStats.engagementLevel': 1 },
  { tenantId: 1, 'attendanceStats.lastVisitedAt': 1 },

  // Pattern analysis
  { tenantId: 1, 'attendanceStats.currentStreak': -1 },
];

/**
 * Apply attendance indexes to a model schema
 * Automatically adds all recommended indexes for attendance tracking
 *
 * Usage:
 * ```javascript
 * import { commonAttendanceFields, applyAttendanceIndexes } from '#lib/attendance/index.js';
 *
 * const membershipSchema = new Schema({
 *   ...commonAttendanceFields,
 *   // ... other fields
 * });
 *
 * applyAttendanceIndexes(membershipSchema, { tenantField: 'organizationId' });
 * ```
 *
 * @param {Schema} schema - Mongoose schema to apply indexes to
 * @param {Object} options - Configuration options
 * @param {String} options.tenantField - Name of tenant ID field (default: 'organizationId')
 */
export function applyAttendanceIndexes(schema, options = {}) {
  const { tenantField = 'organizationId' } = options;

  // Historical stats indexes (for analytics and filtering)
  schema.index({ [tenantField]: 1, 'attendanceStats.engagementLevel': 1 });
  schema.index({ [tenantField]: 1, 'attendanceStats.lastVisitedAt': 1 });
  schema.index({ [tenantField]: 1, 'attendanceStats.currentStreak': -1 });
  schema.index({ [tenantField]: 1, 'attendanceStats.thisMonthVisits': -1 });

  // Real-time session index (for occupancy and "who's checked in" queries)
  schema.index({ [tenantField]: 1, 'currentSession.isActive': 1 });
}

// Export all schemas
export default {
  checkInEntrySchema,
  currentSessionSchema,
  attendanceStatsSchema,
  monthlyAttendanceSummarySchema,
  attendancePatternSchema,
  commonAttendanceFields,
  attendanceIndexes,
};

