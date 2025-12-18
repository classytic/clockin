/**
 * ClockIn Mongoose Schemas
 *
 * Reusable schemas for attendance tracking
 * These can be embedded in any model (Membership, Employee, etc.)
 *
 * @module @classytic/clockin/schemas
 */

import mongoose from 'mongoose';
import {
  ATTENDANCE_STATUS_VALUES,
  CHECK_IN_METHOD_VALUES,
  ENGAGEMENT_LEVEL_VALUES,
  TIME_SLOT_VALUES,
  ATTENDANCE_TYPE_VALUES,
  CORRECTION_REQUEST_TYPE_VALUES,
  CORRECTION_REQUEST_STATUS_VALUES,
  PRIORITY_VALUES,
} from '../enums.js';
import type { Schema as MongooseSchema } from 'mongoose';

const { Schema } = mongoose;

// ============================================================================
// CHECK-IN ENTRY SCHEMA
// ============================================================================

/**
 * Single check-in entry schema
 * Minimal data per check-in for storage efficiency
 */
export const checkInEntrySchema = new Schema(
  {
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

    // Correction audit trail
    corrections: [
      {
        field: String,
        originalValue: Schema.Types.Mixed,
        newValue: Schema.Types.Mixed,
        reason: String,
        correctedBy: {
          userId: Schema.Types.ObjectId,
          userName: String,
          userRole: String,
        },
        correctedAt: { type: Date, default: Date.now },
      },
    ],

    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
    },
  },
  {
    _id: true,
    timestamps: false,
  }
);

// ============================================================================
// ATTENDANCE STATS SCHEMA
// ============================================================================

/**
 * Pre-calculated attendance statistics
 * Embedded in member/employee documents for fast access
 */
export const attendanceStatsSchema = new Schema(
  {
    totalVisits: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastVisitedAt: {
      type: Date,
    },

    firstVisitedAt: {
      type: Date,
    },

    currentStreak: {
      type: Number,
      default: 0,
      min: 0,
    },

    longestStreak: {
      type: Number,
      default: 0,
      min: 0,
    },

    monthlyAverage: {
      type: Number,
      default: 0,
      min: 0,
    },

    thisMonthVisits: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastMonthVisits: {
      type: Number,
      default: 0,
      min: 0,
    },

    engagementLevel: {
      type: String,
      enum: ENGAGEMENT_LEVEL_VALUES,
      default: 'inactive',
    },

    daysSinceLastVisit: {
      type: Number,
      min: 0,
    },

    favoriteTimeSlot: {
      type: String,
      enum: TIME_SLOT_VALUES,
    },

    loyaltyScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
    timestamps: false,
  }
);

// ============================================================================
// CURRENT SESSION SCHEMA
// ============================================================================

/**
 * Current session tracking schema
 * Real-time check-in status cached on member document for fast access
 */
export const currentSessionSchema = new Schema(
  {
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },

    checkInId: {
      type: Schema.Types.ObjectId,
    },

    checkInTime: {
      type: Date,
    },

    expectedCheckOutAt: {
      type: Date,
    },

    method: {
      type: String,
      enum: CHECK_IN_METHOD_VALUES,
    },
  },
  {
    _id: false,
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Virtual: Calculate duration dynamically
 */
currentSessionSchema.virtual('durationMinutes').get(function () {
  if (!this.isActive || !this.checkInTime) {
    return 0;
  }
  return Math.floor(
    (Date.now() - new Date(this.checkInTime).getTime()) / (1000 * 60)
  );
});

/**
 * Validation: Ensure currentSession state consistency
 */
currentSessionSchema.pre('validate', function () {
  // Skip validation if parent document is being deleted
  const parent = (this as unknown as { $parent?: () => { $isDeleted?: boolean } }).$parent?.();
  if (parent && parent.$isDeleted) {
    return;
  }

  if (this.isActive) {
    if (!this.checkInId) {
      throw new Error('Active currentSession requires checkInId');
    }
    if (!this.checkInTime) {
      throw new Error('Active currentSession requires checkInTime');
    }
    if (!this.method) {
      throw new Error('Active currentSession requires method');
    }
  } else {
    if (this.checkInId) {
      throw new Error('Inactive currentSession must have null checkInId');
    }
    if (this.checkInTime) {
      throw new Error('Inactive currentSession must have null checkInTime');
    }
  }
});

// ============================================================================
// CORRECTION REQUEST SCHEMA
// ============================================================================

/**
 * Correction request schema for employee self-service
 */
export const correctionRequestSchema = new Schema(
  {
    requestType: {
      type: String,
      required: true,
      enum: CORRECTION_REQUEST_TYPE_VALUES,
    },

    status: {
      type: String,
      required: true,
      enum: CORRECTION_REQUEST_STATUS_VALUES,
      default: 'pending',
    },

    checkInId: Schema.Types.ObjectId,

    requestedChanges: {
      checkInTime: Date,
      checkOutTime: Date,
      attendanceType: String,
      reason: { type: String, required: true, maxlength: 500 },
    },

    priority: {
      type: String,
      enum: PRIORITY_VALUES,
      default: 'normal',
    },

    reviewedBy: {
      userId: Schema.Types.ObjectId,
      userName: String,
      userRole: String,
    },

    reviewedAt: Date,
    reviewNotes: String,
    appliedAt: Date,
    createdAt: { type: Date, default: Date.now },
  },
  {
    _id: true,
    timestamps: false,
  }
);

// ============================================================================
// TIME SLOT DISTRIBUTION SCHEMA
// ============================================================================

/**
 * Time slot distribution for analytics
 */
export const timeSlotDistributionSchema = new Schema(
  {
    early_morning: { type: Number, default: 0 },
    morning: { type: Number, default: 0 },
    afternoon: { type: Number, default: 0 },
    evening: { type: Number, default: 0 },
    night: { type: Number, default: 0 },
  },
  {
    _id: false,
    timestamps: false,
  }
);

// ============================================================================
// COMMON ATTENDANCE FIELDS
// ============================================================================

/**
 * Common attendance fields to add to member/employee schemas
 *
 * @example
 * ```typescript
 * import { commonAttendanceFields, applyAttendanceIndexes } from '@classytic/clockin';
 *
 * const membershipSchema = new Schema({
 *   ...commonAttendanceFields,
 *   // ... other fields
 * });
 *
 * applyAttendanceIndexes(membershipSchema, { tenantField: 'organizationId' });
 * ```
 */
export const commonAttendanceFields = {
  currentSession: {
    type: currentSessionSchema,
    default: () => ({ isActive: false }),
  },

  attendanceStats: {
    type: attendanceStatsSchema,
    default: () => ({}),
  },

  attendanceEnabled: {
    type: Boolean,
    default: true,
  },

  attendanceNotes: String,
};

// ============================================================================
// INDEX HELPERS
// ============================================================================

/**
 * Recommended indexes for attendance queries
 */
export const attendanceIndexes = [
  { tenantId: 1, year: 1, month: 1 },
  { targetId: 1, year: 1, month: 1 },
  { tenantId: 1, 'checkIns.timestamp': 1 },
  { tenantId: 1, 'attendanceStats.engagementLevel': 1 },
  { tenantId: 1, 'attendanceStats.lastVisitedAt': 1 },
  { tenantId: 1, 'attendanceStats.currentStreak': -1 },
];

/**
 * Apply attendance indexes to a member/employee schema
 *
 * @param schema - Mongoose schema
 * @param options - Configuration options
 */
export function applyAttendanceIndexes(
  schema: MongooseSchema,
  options: { tenantField?: string } = {}
): void {
  const { tenantField = 'organizationId' } = options;

  // Historical stats indexes
  schema.index({ [tenantField]: 1, 'attendanceStats.engagementLevel': 1 });
  schema.index({ [tenantField]: 1, 'attendanceStats.lastVisitedAt': 1 });
  schema.index({ [tenantField]: 1, 'attendanceStats.currentStreak': -1 });
  schema.index({ [tenantField]: 1, 'attendanceStats.thisMonthVisits': -1 });

  // Real-time session index
  schema.index({ [tenantField]: 1, 'currentSession.isActive': 1 });
}

// ============================================================================
// FULL ATTENDANCE MODEL SCHEMA
// ============================================================================

/**
 * Create full attendance model schema
 * Use this to create your own Attendance model
 *
 * @param options - Schema options
 * @returns Mongoose schema
 */
export function createAttendanceSchema(
  options: {
    ttlDays?: number;
    additionalFields?: Record<string, unknown>;
  } = {}
): MongooseSchema {
  const { ttlDays = 730, additionalFields = {} } = options;

  const schema = new Schema(
    {
      tenantId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
      },

      targetModel: {
        type: String,
        required: true,
        // Note: enum constraint removed in v2.0 to support custom target models.
        // Validation is now handled at runtime via allowedTargetModels config.
        validate: {
          validator: (v: string) => typeof v === 'string' && v.length > 0,
          message: 'targetModel must be a non-empty string',
        },
      },

      targetId: {
        type: Schema.Types.ObjectId,
        required: true,
        refPath: 'targetModel',
        index: true,
      },

      year: {
        type: Number,
        required: true,
        index: true,
      },

      month: {
        type: Number,
        required: true,
        min: 1,
        max: 12,
        index: true,
      },

      checkIns: {
        type: [checkInEntrySchema],
        default: [],
      },

      monthlyTotal: {
        type: Number,
        default: 0,
        min: 0,
      },

      uniqueDaysVisited: {
        type: Number,
        default: 0,
        min: 0,
      },

      // Array of unique day strings (YYYY-MM-DD) for atomic $addToSet operations
      visitedDays: {
        type: [String],
        default: [],
      },

      // Work days tracking
      fullDaysCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      halfDaysCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      paidLeaveDaysCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      overtimeDaysCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalWorkDays: {
        type: Number,
        default: 0,
        min: 0,
      },

      timeSlotDistribution: {
        type: timeSlotDistributionSchema,
        default: () => ({}),
      },

      dayOfWeekDistribution: {
        type: Map,
        of: Number,
        default: () => new Map(),
      },

      correctionRequests: {
        type: [correctionRequestSchema],
        default: [],
      },

      metadata: {
        type: Map,
        of: Schema.Types.Mixed,
      },

      ...additionalFields,
    },
    {
      timestamps: true,
    }
  );

  // Indexes
  schema.index(
    { tenantId: 1, targetModel: 1, targetId: 1, year: 1, month: 1 },
    { unique: true }
  );
  schema.index({ tenantId: 1, year: 1, month: 1 });
  schema.index({ tenantId: 1, targetModel: 1, targetId: 1, year: -1, month: -1 });
  schema.index({ tenantId: 1, 'checkIns.timestamp': 1 });
  schema.index({ 'checkIns.notes': 'text' });

  // TTL index
  if (ttlDays > 0) {
    schema.index({ createdAt: 1 }, { expireAfterSeconds: ttlDays * 24 * 60 * 60 });
  }

  // Virtuals
  schema.virtual('periodKey').get(function () {
    return `${this.year}-${String(this.month).padStart(2, '0')}`;
  });

  schema.virtual('target', {
    refPath: 'targetModel',
    localField: 'targetId',
    foreignField: '_id',
    justOne: true,
  });

  return schema;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  checkInEntrySchema,
  attendanceStatsSchema,
  currentSessionSchema,
  correctionRequestSchema,
  timeSlotDistributionSchema,
  commonAttendanceFields,
  attendanceIndexes,
  applyAttendanceIndexes,
  createAttendanceSchema,
};

