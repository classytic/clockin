/**
 * 🎯 Check-In Manager
 * Core business logic for attendance check-ins
 *
 * Handles:
 * - Recording check-ins
 * - Validation rules
 * - Duplicate prevention
 * - Stats updates
 *
 * @module lib/attendance/core/check-in
 */

import mongoose from 'mongoose';
import { getTimeSlot, CHECK_IN_METHOD } from '../enums.js';
import { CHECK_IN_RULES } from '../config.js';
import { getConfig } from '../configs/index.js';
import { validateCheckIn as validateSchedule } from '../utils/detection.utils.js';
import { calculateExpectedCheckout } from '../utils/schedule.utils.js';
import logger from '../utils/logger.js';

/**
 * Validate check-in request
 * Combines business validation + schedule validation
 *
 * @param {Object} member - Member/entity document
 * @param {String} targetModel - Entity type (Membership, Employee, etc.)
 * @param {Object} options - Check-in options
 * @returns {Object} { valid: Boolean, error?: String, warnings?: Array<String> }
 */
export function validateCheckIn(member, targetModel, options = {}) {
  // 1. Business Validation (always enforced)

  // Check if attendance is enabled
  if (member.attendanceEnabled === false) {
    return {
      valid: false,
      error: 'Attendance tracking is disabled for this member',
    };
  }

  // Check if member has active status (for memberships)
  if (member.status && !['active', 'pending'].includes(member.status)) {
    return {
      valid: false,
      error: `Cannot check in: membership status is ${member.status}`,
    };
  }

  // Check for duplicate check-ins (prevent within X minutes)
  if (member.attendanceStats?.lastVisitedAt) {
    const minutesSinceLastCheckIn =
      (Date.now() - new Date(member.attendanceStats.lastVisitedAt).getTime()) / (1000 * 60);

    if (minutesSinceLastCheckIn < CHECK_IN_RULES.duplicatePreventionMinutes) {
      return {
        valid: false,
        error: `Already checked in ${Math.floor(minutesSinceLastCheckIn)} minutes ago. Please wait ${CHECK_IN_RULES.duplicatePreventionMinutes} minutes between check-ins.`,
        lastCheckIn: member.attendanceStats.lastVisitedAt,
      };
    }
  }

  // 2. Schedule Validation (config-driven)
  const checkInTime = options.timestamp || new Date();
  const scheduleValidation = validateSchedule({
    checkInTime,
    targetModel,
    entityData: member,
  });

  // Combine results
  return {
    valid: scheduleValidation.valid,
    warnings: scheduleValidation.warnings,
  };
}

/**
 * Create check-in entry object
 * @param {Object} data - Check-in data
 * @param {String} targetModel - Entity type
 * @param {Object} entityData - Employee or Member document (for schedule-aware calculation)
 * @param {Object} context - Request context (user, org, etc.)
 * @returns {Object} Check-in entry
 */
export function createCheckInEntry(data, targetModel, entityData, context = {}) {
  const now = new Date();
  const hour = now.getHours();
  const timestamp = data.timestamp || now;

  // Get config for this entity type
  const config = getConfig(targetModel);

  // ⭐ SMART EXPECTED CHECKOUT CALCULATION
  // Uses employee's actual schedule (shiftEnd, hoursPerDay) or smart defaults
  // Priority: shiftEnd > hoursPerDay > config default
  const expectedCheckOutAt = config.autoCheckout?.enabled
    ? calculateExpectedCheckout(timestamp, targetModel, entityData, config)
    : null;

  return {
    timestamp,
    checkOutAt: null,
    expectedCheckOutAt,
    duration: null,
    autoCheckedOut: false,
    recordedBy: {
      userId: context.userId,
      name: context.userName,
      role: context.userRole,
    },
    checkedOutBy: null,
    method: data.method || CHECK_IN_METHOD.MANUAL,
    status: 'valid',
    timeSlot: getTimeSlot(hour),
    location: data.location,
    device: data.device,
    notes: data.notes,
    metadata: data.metadata || new Map(),
  };
}

/**
 * Record a check-in
 * 
 * This is the main function for check-ins. It:
 * 1. Validates the check-in
 * 2. Creates the check-in entry
 * 3. Updates monthly attendance record
 * 4. Updates member stats atomically
 * 
 * @param {Object} params
 * @param {Model} params.AttendanceModel - Attendance model
 * @param {Object} params.member - Member document
 * @param {String} params.targetModel - Target model name (Membership, Employee, etc.)
 * @param {Object} params.checkInData - Check-in data
 * @param {Object} params.context - Request context
 * @returns {Promise<Object>} { checkIn, attendance, updatedMember }
 */
export async function recordCheckIn({
  AttendanceModel,
  member,
  targetModel,
  checkInData,
  context = {},
}) {
  // Validate check-in (business + schedule validation)
  const validation = validateCheckIn(member, targetModel, checkInData);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Log warnings if any (schedule validation warnings)
  if (validation.warnings && validation.warnings.length > 0) {
    logger.warn('Check-in validation warnings', {
      memberId: member._id,
      targetModel,
      warnings: validation.warnings,
    });
  }

  const now = new Date(checkInData.timestamp || Date.now());
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  // Start session for atomic operations
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // 1. Find or create monthly attendance record
    const attendance = await AttendanceModel.findOrCreateForMonth(
      member.organizationId,
      targetModel,
      member._id,
      year,
      month
    );

    // 2. Create check-in entry (with smart expected checkout based on employee schedule)
    const checkInEntry = createCheckInEntry(checkInData, targetModel, member, context);

    // 3. Add check-in to monthly record
    await attendance.addCheckIn(checkInEntry);

    // Get the newly added check-in (with generated _id)
    const addedCheckIn = attendance.checkIns[attendance.checkIns.length - 1];

    // 4. Update member stats atomically
    const updatedStats = calculateUpdatedStats(member, attendance, now);

    // 5. Update currentSession for real-time frontend state
    const currentSession = {
      isActive: true,
      checkInId: addedCheckIn._id,  // Use the _id from the added subdocument
      checkInTime: addedCheckIn.timestamp,
      expectedCheckOutAt: addedCheckIn.expectedCheckOutAt,
      method: addedCheckIn.method,
      // durationMinutes is now a virtual field (calculated dynamically)
    };

    // Update member document
    const MemberModel = mongoose.model(targetModel);
    const updatedMember = await MemberModel.findByIdAndUpdate(
      member._id,
      {
        $set: {
          'attendanceStats': updatedStats,
          'currentSession': currentSession,
        },
      },
      { new: true, session }
    );
    
    await session.commitTransaction();
    
    logger.info('Check-in recorded', {
      memberId: member._id,
      targetModel,
      timestamp: checkInEntry.timestamp,
      totalVisits: updatedStats.totalVisits,
    });
    
    return {
      checkIn: checkInEntry,
      attendance,
      updatedMember,
      stats: updatedStats,
    };
    
  } catch (error) {
    await session.abortTransaction();
    logger.error('Check-in failed', {
      error: error.message,
      memberId: member._id,
      targetModel,
    });
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Calculate updated stats after check-in
 * @param {Object} member - Current member document
 * @param {Object} attendance - Monthly attendance record
 * @param {Date} checkInTime - Check-in timestamp
 * @returns {Object} Updated stats
 */
export function calculateUpdatedStats(member, attendance, checkInTime) {
  const stats = member.attendanceStats || {};
  const now = new Date(checkInTime);
  
  // Initialize if first check-in
  if (!stats.firstVisitedAt) {
    stats.firstVisitedAt = now;
  }
  
  // Calculate streak
  const lastVisit = stats.lastVisitedAt ? new Date(stats.lastVisitedAt) : null;
  let currentStreak = stats.currentStreak || 0;
  
  if (lastVisit) {
    const daysSinceLastVisit = Math.floor((now - lastVisit) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastVisit === 1) {
      // Consecutive day
      currentStreak += 1;
    } else if (daysSinceLastVisit === 0) {
      // Same day, maintain streak
      currentStreak = currentStreak || 1;
    } else {
      // Streak broken
      currentStreak = 1;
    }
  } else {
    currentStreak = 1;
  }
  
  // Update longest streak
  const longestStreak = Math.max(stats.longestStreak || 0, currentStreak);
  
  // Total visits
  const totalVisits = (stats.totalVisits || 0) + 1;
  
  // This month visits
  const thisMonthVisits = attendance.monthlyTotal;
  
  // Calculate monthly average
  const monthsSinceFirstVisit = stats.firstVisitedAt
    ? Math.max(1, Math.ceil((now - new Date(stats.firstVisitedAt)) / (1000 * 60 * 60 * 24 * 30)))
    : 1;
  const monthlyAverage = Math.round(totalVisits / monthsSinceFirstVisit);
  
  // Determine engagement level
  const engagementLevel = getEngagementLevelFromStats({
    thisMonthVisits,
    daysSinceLastVisit: 0,
  });
  
  // Calculate loyalty score (0-100)
  const loyaltyScore = calculateLoyaltyScore({
    totalVisits,
    currentStreak,
    monthlyAverage,
    monthsSinceFirstVisit,
  });
  
  return {
    totalVisits,
    lastVisitedAt: now,
    firstVisitedAt: stats.firstVisitedAt || now,
    currentStreak,
    longestStreak,
    monthlyAverage,
    thisMonthVisits,
    lastMonthVisits: stats.lastMonthVisits || 0,
    engagementLevel,
    daysSinceLastVisit: 0,
    favoriteTimeSlot: attendance.getMostCommonTimeSlot(),
    loyaltyScore,
    updatedAt: now,
  };
}

/**
 * Get engagement level from stats
 * @param {Object} stats
 * @returns {String} Engagement level
 */
function getEngagementLevelFromStats(stats) {
  if (stats.daysSinceLastVisit >= 30) return 'dormant';
  if (stats.daysSinceLastVisit >= 14) return 'at_risk';
  if (stats.thisMonthVisits === 0) return 'inactive';
  if (stats.thisMonthVisits >= 12) return 'highly_active';
  if (stats.thisMonthVisits >= 8) return 'active';
  if (stats.thisMonthVisits >= 4) return 'regular';
  return 'occasional';
}

/**
 * Calculate loyalty score (0-100)
 * @param {Object} factors
 * @returns {Number} Score between 0-100
 */
function calculateLoyaltyScore(factors) {
  const {
    totalVisits = 0,
    currentStreak = 0,
    monthlyAverage = 0,
    monthsSinceFirstVisit = 1,
  } = factors;
  
  // Weighted scoring
  const visitScore = Math.min(30, (totalVisits / 100) * 30);
  const streakScore = Math.min(25, (currentStreak / 30) * 25);
  const consistencyScore = Math.min(25, (monthlyAverage / 12) * 25);
  const tenureScore = Math.min(20, (monthsSinceFirstVisit / 12) * 20);
  
  return Math.round(visitScore + streakScore + consistencyScore + tenureScore);
}

/**
 * Bulk check-in (for importing historical data)
 * @param {Object} params
 * @param {Model} params.AttendanceModel
 * @param {Array} params.checkIns - Array of check-in data
 * @param {Object} params.context
 * @returns {Promise<Object>} Results
 */
export async function bulkRecordCheckIns({
  AttendanceModel,
  checkIns,
  context = {},
}) {
  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };
  
  for (const checkInData of checkIns) {
    try {
      // Find member
      const MemberModel = mongoose.model(checkInData.targetModel || 'Membership');
      const member = await MemberModel.findOne({
        organizationId: context.organizationId,
        'customer.email': checkInData.memberIdentifier,
      });
      
      if (!member) {
        results.failed++;
        results.errors.push({
          memberIdentifier: checkInData.memberIdentifier,
          error: 'Member not found',
        });
        continue;
      }
      
      await recordCheckIn({
        AttendanceModel,
        member,
        targetModel: checkInData.targetModel || 'Membership',
        checkInData,
        context,
      });
      
      results.success++;
      
    } catch (error) {
      results.failed++;
      results.errors.push({
        memberIdentifier: checkInData.memberIdentifier,
        error: error.message,
      });
    }
  }
  
  return results;
}

export default {
  validateCheckIn,
  createCheckInEntry,
  recordCheckIn,
  calculateUpdatedStats,
  bulkRecordCheckIns,
};

