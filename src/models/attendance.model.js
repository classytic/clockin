/**
 * 📊 Attendance Record Model
 * 
 * Storage-optimized attendance tracking
 * One document per member per month (not per check-in!)
 * 
 * This design minimizes storage and maximizes query performance:
 * - 1 member with 20 check-ins/month = 1 document (not 20)
 * - Indexed for fast tenant-scoped queries
 * - Efficient for analytics and reporting
 * 
 * @module lib/attendance/models/attendance
 */

import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';
import { checkInEntrySchema } from '../schemas/attendance.schema.js';
import { ATTENDANCE_TARGET_MODEL_VALUES } from '../enums.js';

const { Schema } = mongoose;

const attendanceSchema = new Schema({
  // Multi-tenancy: Each gym/organization has isolated data
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  
  // Polymorphic reference to any attendee (Membership, Employee, etc.)
  targetModel: {
    type: String,
    required: true,
    enum: ATTENDANCE_TARGET_MODEL_VALUES,
  },
  
  targetId: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'targetModel',
    index: true,
  },
  
  // Time period (one document per month)
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
  
  // All check-ins for this member for this month
  // Array of check-in entries (efficient storage)
  checkIns: {
    type: [checkInEntrySchema],
    default: [],
  },
  
  // Pre-calculated monthly total (for fast queries)
  monthlyTotal: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Unique days visited this month
  uniqueDaysVisited: {
    type: Number,
    default: 0,
    min: 0,
  },

  // ⭐ WORK DAYS TRACKING (For Employee Payroll)
  // Tracks full days, half days for accurate salary calculation
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

  // Total work days (decimal): fullDays + (halfDays * 0.5) + paidLeaveDays
  // Used directly by payroll for salary calculation
  totalWorkDays: {
    type: Number,
    default: 0,
    min: 0,
  },

  // Time slot distribution for this month
  timeSlotDistribution: {
    early_morning: { type: Number, default: 0 },
    morning: { type: Number, default: 0 },
    afternoon: { type: Number, default: 0 },
    evening: { type: Number, default: 0 },
    night: { type: Number, default: 0 },
  },
  
  // Day of week distribution (0=Sunday, 6=Saturday)
  dayOfWeekDistribution: {
    type: Map,
    of: Number,
    default: () => new Map(),
  },

  // ⭐ CORRECTION REQUESTS (Employee Self-Service)
  // Nested structure - no separate collection needed!
  correctionRequests: [{
    requestType: {
      type: String,
      required: true,
      enum: [
        'update_check_in_time',
        'update_check_out_time',
        'add_missing_attendance',
        'delete_duplicate',
        'override_attendance_type',
      ],
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'approved', 'rejected', 'applied'],
      default: 'pending',
    },
    checkInId: Schema.Types.ObjectId, // Reference to checkIns array item
    requestedChanges: {
      checkInTime: Date,
      checkOutTime: Date,
      attendanceType: String,
      reason: { type: String, required: true, maxlength: 500 },
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
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
  }],

  // Metadata for extensibility
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
  },
}, {
  timestamps: true,
  roleBasedSelect: {
    user: '',
    admin: '',
    superadmin: '',
  },
});

// ============ INDEXES ============
// Compound index for unique constraint and efficient queries
attendanceSchema.index(
  { tenantId: 1, targetId: 1, year: 1, month: 1 },
  { unique: true }
);

// Analytics queries
attendanceSchema.index({ tenantId: 1, year: 1, month: 1 });
attendanceSchema.index({ targetId: 1, year: -1, month: -1 });

// Date range queries
attendanceSchema.index({ tenantId: 1, 'checkIns.timestamp': 1 });

// Text search on notes (for disputes/corrections)
attendanceSchema.index({ 'checkIns.notes': 'text' });

// TTL index: Auto-delete records older than 2 years (730 days)
// Keeps system clean and minimal - focus on functionality, not long-term data storage
// Admins can export historical data before auto-deletion via export API
attendanceSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 }); // 730 days = 63,072,000 seconds

// ============ VIRTUALS ============
attendanceSchema.virtual('periodKey').get(function() {
  return `${this.year}-${String(this.month).padStart(2, '0')}`;
});

attendanceSchema.virtual('target', {
  refPath: 'targetModel',
  localField: 'targetId',
  foreignField: '_id',
  justOne: true,
});

// ============ INSTANCE METHODS ============

/**
 * Add a new check-in to this month's record
 * @param {Object} checkInData - Check-in data
 * @returns {Object} Updated document
 */
attendanceSchema.methods.addCheckIn = async function(checkInData) {
  // Add to check-ins array
  this.checkIns.push(checkInData);

  // Update monthly total
  this.monthlyTotal = this.checkIns.length;

  // Update unique days visited
  const uniqueDays = new Set(
    this.checkIns.map(ci => new Date(ci.timestamp).toDateString())
  );
  this.uniqueDaysVisited = uniqueDays.size;

  // Update time slot distribution
  if (checkInData.timeSlot) {
    this.timeSlotDistribution[checkInData.timeSlot] =
      (this.timeSlotDistribution[checkInData.timeSlot] || 0) + 1;
  }

  // Update day of week distribution
  const dayOfWeek = new Date(checkInData.timestamp).getDay();
  const currentCount = this.dayOfWeekDistribution.get(String(dayOfWeek)) || 0;
  this.dayOfWeekDistribution.set(String(dayOfWeek), currentCount + 1);

  // ⭐ Note: Work days are recalculated only on checkout (when attendance type is final)
  // No need to recalculate here - wasteful since type is determined at checkout

  await this.save();
  return this;
};

/**
 * Recalculate work days based on attendance types
 * Called automatically after check-in/check-out
 * Smart calculation for payroll
 */
attendanceSchema.methods.recalculateWorkDays = function() {
  let fullDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let overtimeDays = 0;

  // Group check-ins by unique dates
  const checkInsByDate = new Map();

  this.checkIns.forEach(checkIn => {
    const dateKey = new Date(checkIn.timestamp).toDateString();
    if (!checkInsByDate.has(dateKey)) {
      checkInsByDate.set(dateKey, []);
    }
    checkInsByDate.get(dateKey).push(checkIn);
  });

  // For each unique date, determine the attendance type
  for (const [date, checkInsOnDate] of checkInsByDate.entries()) {
    // Get the most recent check-in for this date (in case of multiple)
    const latestCheckIn = checkInsOnDate.sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    )[0];

    const attendanceType = latestCheckIn.attendanceType || 'full_day';

    // Count based on attendance type
    switch (attendanceType) {
      case 'full_day':
        fullDays++;
        break;
      case 'half_day_morning':
      case 'half_day_afternoon':
        halfDays++;
        break;
      case 'paid_leave':
        paidLeaveDays++;
        break;
      case 'overtime':
        overtimeDays++;
        fullDays++; // Overtime also counts as a full day
        break;
      case 'unpaid_leave':
        // Don't count unpaid leave
        break;
      default:
        fullDays++; // Default to full day if unknown
    }
  }

  // Update counts
  this.fullDaysCount = fullDays;
  this.halfDaysCount = halfDays;
  this.paidLeaveDaysCount = paidLeaveDays;
  this.overtimeDaysCount = overtimeDays;

  // Calculate total work days (decimal)
  // Formula: fullDays + (halfDays * 0.5) + paidLeaveDays
  this.totalWorkDays = fullDays + (halfDays * 0.5) + paidLeaveDays;
};

/**
 * Get check-ins for a specific date range
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Array} Filtered check-ins
 */
attendanceSchema.methods.getCheckInsInRange = function(startDate, endDate) {
  return this.checkIns.filter(checkIn => {
    const timestamp = new Date(checkIn.timestamp);
    return timestamp >= startDate && timestamp <= endDate;
  });
};

/**
 * Get most common time slot
 * @returns {String} Time slot
 */
attendanceSchema.methods.getMostCommonTimeSlot = function() {
  let maxSlot = 'morning';
  let maxCount = 0;
  
  for (const [slot, count] of Object.entries(this.timeSlotDistribution)) {
    if (count > maxCount) {
      maxCount = count;
      maxSlot = slot;
    }
  }
  
  return maxSlot;
};

// ============ STATIC METHODS ============

/**
 * Find or create attendance record for a member and month
 * @param {ObjectId} tenantId
 * @param {String} targetModel
 * @param {ObjectId} targetId
 * @param {Number} year
 * @param {Number} month
 * @returns {Object} Attendance document
 */
attendanceSchema.statics.findOrCreateForMonth = async function(
  tenantId,
  targetModel,
  targetId,
  year,
  month
) {
  const attendance = await this.findOneAndUpdate(
    { tenantId, targetModel, targetId, year, month },
    {
      $setOnInsert: {
        tenantId,
        targetModel,
        targetId,
        year,
        month,
        checkIns: [],
        monthlyTotal: 0,
      },
    },
    { upsert: true, new: true }
  );
  
  return attendance;
};

/**
 * Get attendance statistics for a date range
 * @param {ObjectId} tenantId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Object} Aggregated stats
 */
attendanceSchema.statics.getStatsForPeriod = async function(
  tenantId,
  startDate,
  endDate
) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const pipeline = [
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        $or: [
          {
            year: { $gte: start.getFullYear(), $lte: end.getFullYear() },
            month: { $gte: start.getMonth() + 1, $lte: end.getMonth() + 1 },
          },
        ],
      },
    },
    {
      $unwind: '$checkIns',
    },
    {
      $match: {
        'checkIns.timestamp': { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: null,
        totalCheckIns: { $sum: 1 },
        uniqueMembers: { $addToSet: '$targetId' },
        avgCheckInsPerMember: { $avg: '$monthlyTotal' },
      },
    },
    {
      $project: {
        totalCheckIns: 1,
        uniqueMembers: { $size: '$uniqueMembers' },
        avgCheckInsPerMember: 1,
      },
    },
  ];
  
  const [result] = await this.aggregate(pipeline);
  return result || { totalCheckIns: 0, uniqueMembers: 0, avgCheckInsPerMember: 0 };
};

// ============ PLUGINS ============
attendanceSchema.plugin(mongoosePaginate);
attendanceSchema.plugin(aggregatePaginate);

// ============ MODEL ============
const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);

export default Attendance;

