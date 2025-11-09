/**
 * 🔧 Attendance Correction Manager
 * Admin tools for manual attendance corrections
 *
 * Features:
 * - Update check-in/check-out times
 * - Delete incorrect entries
 * - Override attendance type
 * - Add retroactive attendance
 * - Full audit trail
 *
 * Use Cases:
 * - Employee forgot to check in
 * - System error (scanner down)
 * - Incorrect checkout time
 * - Payroll corrections before processing
 *
 * @module lib/attendance/core/correction
 */

import mongoose from 'mongoose';
import { getCurrentPeriod } from '../utils/check-in.utils.js';
import { buildAttendanceMatch } from '../utils/query-builders.js';
import { detectAttendanceType } from '../utils/detection.utils.js';
import { getConfig } from '../configs/index.js';
import { calculateExpectedCheckout } from '../utils/schedule.utils.js';
import { getTimeSlot, CHECK_IN_METHOD, ATTENDANCE_TYPE_VALUES } from '../enums.js';
import logger from '../utils/logger.js';

/**
 * Update check-in timestamp
 * For cases where employee forgot to check in at correct time
 *
 * @param {Object} params
 * @param {Model} params.AttendanceModel - Attendance model
 * @param {ObjectId} params.organizationId - Organization ID
 * @param {ObjectId} params.targetId - Member/Employee ID
 * @param {String} params.targetModel - Entity type
 * @param {String} params.checkInId - Check-in entry ID
 * @param {Date} params.newTimestamp - Corrected check-in time
 * @param {String} params.reason - Reason for correction
 * @param {Object} params.adminContext - Admin user context
 * @returns {Promise<Object>} Updated check-in
 */
export async function updateCheckInTime({
  AttendanceModel,
  organizationId,
  targetId,
  targetModel,
  checkInId,
  newTimestamp,
  reason,
  adminContext = {},
}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate timestamp
    const correctedTime = new Date(newTimestamp);
    if (isNaN(correctedTime.getTime())) {
      throw new Error('Invalid timestamp provided');
    }

    if (correctedTime > new Date()) {
      throw new Error('Cannot set check-in time in the future');
    }

    // Find attendance record
    const { year, month } = getCurrentPeriod(correctedTime);
    const match = buildAttendanceMatch({
      organizationId,
      targetModel,
      targetId,
      year,
      month,
    });

    const attendance = await AttendanceModel.findOne(match).session(session);
    if (!attendance) {
      throw new Error('Attendance record not found');
    }

    // Find check-in entry
    const checkIn = attendance.checkIns.id(checkInId);
    if (!checkIn) {
      throw new Error('Check-in entry not found');
    }

    // Store original value for audit
    const originalTimestamp = checkIn.timestamp;

    // Update timestamp
    checkIn.timestamp = correctedTime;
    checkIn.timeSlot = getTimeSlot(correctedTime.getHours());

    // Recalculate duration if already checked out
    if (checkIn.checkOutAt) {
      checkIn.duration = Math.floor((new Date(checkIn.checkOutAt) - correctedTime) / (1000 * 60));

      // Recalculate attendance type with new duration
      const MemberModel = mongoose.model(targetModel);
      const entityData = await MemberModel.findById(targetId).lean();

      checkIn.attendanceType = detectAttendanceType({
        checkInTime: correctedTime,
        checkOutTime: checkIn.checkOutAt,
        targetModel,
        entityData,
      });
    } else {
      // Recalculate expected checkout
      const config = getConfig(targetModel);
      const MemberModel = mongoose.model(targetModel);
      const entityData = await MemberModel.findById(targetId).lean();

      checkIn.expectedCheckOutAt = config.autoCheckout?.enabled
        ? calculateExpectedCheckout(correctedTime, targetModel, entityData, config)
        : null;
    }

    // Add correction metadata
    if (!checkIn.corrections) checkIn.corrections = [];
    checkIn.corrections.push({
      field: 'timestamp',
      originalValue: originalTimestamp,
      newValue: correctedTime,
      reason,
      correctedBy: {
        userId: adminContext.userId,
        userName: adminContext.userName,
        userRole: adminContext.userRole,
      },
      correctedAt: new Date(),
    });

    // Recalculate work days (for employees)
    attendance.recalculateWorkDays();

    await attendance.save({ session });
    await session.commitTransaction();

    logger.info('Check-in time updated', {
      organizationId,
      targetId,
      checkInId,
      originalTimestamp,
      newTimestamp: correctedTime,
      correctedBy: adminContext.userName,
      reason,
    });

    return {
      success: true,
      checkIn: checkIn.toObject(),
      correction: {
        field: 'timestamp',
        from: originalTimestamp,
        to: correctedTime,
        reason,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    logger.error('Failed to update check-in time', {
      error: error.message,
      organizationId,
      targetId,
      checkInId,
    });
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Update check-out timestamp
 * For cases where employee forgot to check out
 *
 * @param {Object} params
 * @param {Model} params.AttendanceModel
 * @param {ObjectId} params.organizationId
 * @param {ObjectId} params.targetId
 * @param {String} params.targetModel
 * @param {String} params.checkInId
 * @param {Date} params.newCheckOutTime
 * @param {String} params.reason
 * @param {Object} params.adminContext
 * @returns {Promise<Object>}
 */
export async function updateCheckOutTime({
  AttendanceModel,
  organizationId,
  targetId,
  targetModel,
  checkInId,
  newCheckOutTime,
  reason,
  adminContext = {},
}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const correctedTime = new Date(newCheckOutTime);
    if (isNaN(correctedTime.getTime())) {
      throw new Error('Invalid checkout time provided');
    }

    if (correctedTime > new Date()) {
      throw new Error('Cannot set check-out time in the future');
    }

    // Find attendance record
    const { year, month } = getCurrentPeriod(correctedTime);
    const match = buildAttendanceMatch({
      organizationId,
      targetModel,
      targetId,
      year,
      month,
    });

    const attendance = await AttendanceModel.findOne(match).session(session);
    if (!attendance) {
      throw new Error('Attendance record not found');
    }

    const checkIn = attendance.checkIns.id(checkInId);
    if (!checkIn) {
      throw new Error('Check-in entry not found');
    }

    // Validate: checkout must be after check-in
    if (correctedTime <= checkIn.timestamp) {
      throw new Error('Check-out time must be after check-in time');
    }

    // Store original value
    const originalCheckOut = checkIn.checkOutAt;

    // Update checkout
    checkIn.checkOutAt = correctedTime;
    checkIn.duration = Math.floor((correctedTime - new Date(checkIn.timestamp)) / (1000 * 60));

    // Recalculate attendance type
    const MemberModel = mongoose.model(targetModel);
    const entityData = await MemberModel.findById(targetId).lean();

    checkIn.attendanceType = detectAttendanceType({
      checkInTime: checkIn.timestamp,
      checkOutTime: correctedTime,
      targetModel,
      entityData,
    });

    checkIn.checkedOutBy = {
      userId: adminContext.userId,
      name: adminContext.userName,
      role: adminContext.userRole,
    };

    // Add correction metadata
    if (!checkIn.corrections) checkIn.corrections = [];
    checkIn.corrections.push({
      field: 'checkOutAt',
      originalValue: originalCheckOut,
      newValue: correctedTime,
      reason,
      correctedBy: {
        userId: adminContext.userId,
        userName: adminContext.userName,
        userRole: adminContext.userRole,
      },
      correctedAt: new Date(),
    });

    // Recalculate work days
    attendance.recalculateWorkDays();

    // Reset currentSession on member document
    await MemberModel.findByIdAndUpdate(
      targetId,
      {
        $set: {
          'currentSession.isActive': false,
          'currentSession.checkInId': null,
          'currentSession.checkInTime': null,
          'currentSession.expectedCheckOutAt': null,
        },
      },
      { session }
    );

    await attendance.save({ session });
    await session.commitTransaction();

    logger.info('Check-out time updated', {
      organizationId,
      targetId,
      checkInId,
      originalCheckOut,
      newCheckOutTime: correctedTime,
      correctedBy: adminContext.userName,
      reason,
    });

    return {
      success: true,
      checkIn: checkIn.toObject(),
      correction: {
        field: 'checkOutAt',
        from: originalCheckOut,
        to: correctedTime,
        reason,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    logger.error('Failed to update check-out time', {
      error: error.message,
      organizationId,
      targetId,
      checkInId,
    });
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Override attendance type (for payroll corrections)
 * Admin can manually set full_day/half_day/overtime
 *
 * @param {Object} params
 * @param {Model} params.AttendanceModel
 * @param {ObjectId} params.organizationId
 * @param {ObjectId} params.targetId
 * @param {String} params.targetModel
 * @param {String} params.checkInId
 * @param {String} params.newType - New attendance type
 * @param {String} params.reason
 * @param {Object} params.adminContext
 * @returns {Promise<Object>}
 */
export async function overrideAttendanceType({
  AttendanceModel,
  organizationId,
  targetId,
  targetModel,
  checkInId,
  newType,
  reason,
  adminContext = {},
}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate attendance type
    if (!ATTENDANCE_TYPE_VALUES.includes(newType)) {
      throw new Error(`Invalid attendance type: ${newType}`);
    }

    // Find attendance record (current month)
    const { year, month } = getCurrentPeriod();
    const match = buildAttendanceMatch({
      organizationId,
      targetModel,
      targetId,
      year,
      month,
    });

    const attendance = await AttendanceModel.findOne(match).session(session);
    if (!attendance) {
      throw new Error('Attendance record not found');
    }

    const checkIn = attendance.checkIns.id(checkInId);
    if (!checkIn) {
      throw new Error('Check-in entry not found');
    }

    // Store original value
    const originalType = checkIn.attendanceType;

    // Update type
    checkIn.attendanceType = newType;

    // Add correction metadata
    if (!checkIn.corrections) checkIn.corrections = [];
    checkIn.corrections.push({
      field: 'attendanceType',
      originalValue: originalType,
      newValue: newType,
      reason,
      correctedBy: {
        userId: adminContext.userId,
        userName: adminContext.userName,
        userRole: adminContext.userRole,
      },
      correctedAt: new Date(),
    });

    // Recalculate work days (critical for payroll)
    attendance.recalculateWorkDays();

    await attendance.save({ session });
    await session.commitTransaction();

    logger.info('Attendance type overridden', {
      organizationId,
      targetId,
      checkInId,
      originalType,
      newType,
      correctedBy: adminContext.userName,
      reason,
    });

    return {
      success: true,
      checkIn: checkIn.toObject(),
      correction: {
        field: 'attendanceType',
        from: originalType,
        to: newType,
        reason,
      },
      workDays: {
        fullDays: attendance.fullDaysCount,
        halfDays: attendance.halfDaysCount,
        totalWorkDays: attendance.totalWorkDays,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    logger.error('Failed to override attendance type', {
      error: error.message,
      organizationId,
      targetId,
      checkInId,
    });
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Delete check-in entry
 * For accidental duplicate entries
 *
 * @param {Object} params
 * @param {Model} params.AttendanceModel
 * @param {ObjectId} params.organizationId
 * @param {ObjectId} params.targetId
 * @param {String} params.targetModel
 * @param {String} params.checkInId
 * @param {String} params.reason
 * @param {Object} params.adminContext
 * @returns {Promise<Object>}
 */
export async function deleteCheckIn({
  AttendanceModel,
  organizationId,
  targetId,
  targetModel,
  checkInId,
  reason,
  adminContext = {},
}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find attendance record
    const { year, month } = getCurrentPeriod();
    const match = buildAttendanceMatch({
      organizationId,
      targetModel,
      targetId,
      year,
      month,
    });

    const attendance = await AttendanceModel.findOne(match).session(session);
    if (!attendance) {
      throw new Error('Attendance record not found');
    }

    const checkIn = attendance.checkIns.id(checkInId);
    if (!checkIn) {
      throw new Error('Check-in entry not found');
    }

    // Store for audit log
    const deletedCheckIn = checkIn.toObject();

    // Remove from array
    checkIn.remove();

    // Update counters
    attendance.monthlyTotal = attendance.checkIns.length;

    // Recalculate unique days
    const uniqueDays = new Set(
      attendance.checkIns.map(ci => new Date(ci.timestamp).toDateString())
    );
    attendance.uniqueDaysVisited = uniqueDays.size;

    // Recalculate work days
    attendance.recalculateWorkDays();

    await attendance.save({ session });

    // If this was an active session, reset it
    const MemberModel = mongoose.model(targetModel);
    const member = await MemberModel.findById(targetId).session(session);

    if (member?.currentSession?.checkInId?.toString() === checkInId) {
      await MemberModel.findByIdAndUpdate(
        targetId,
        {
          $set: {
            'currentSession.isActive': false,
            'currentSession.checkInId': null,
            'currentSession.checkInTime': null,
            'currentSession.expectedCheckOutAt': null,
          },
        },
        { session }
      );
    }

    await session.commitTransaction();

    logger.warn('Check-in deleted', {
      organizationId,
      targetId,
      checkInId,
      deletedCheckIn,
      deletedBy: adminContext.userName,
      reason,
    });

    return {
      success: true,
      deleted: true,
      checkIn: deletedCheckIn,
      reason,
      deletedBy: adminContext.userName,
    };
  } catch (error) {
    await session.abortTransaction();
    logger.error('Failed to delete check-in', {
      error: error.message,
      organizationId,
      targetId,
      checkInId,
    });
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Add retroactive attendance
 * For cases where employee completely missed check-in/out
 *
 * @param {Object} params
 * @param {Model} params.AttendanceModel
 * @param {ObjectId} params.organizationId
 * @param {ObjectId} params.targetId
 * @param {String} params.targetModel
 * @param {Date} params.date - Date of attendance
 * @param {Date} params.checkInTime
 * @param {Date} params.checkOutTime
 * @param {String} params.reason
 * @param {Object} params.adminContext
 * @returns {Promise<Object>}
 */
export async function addRetroactiveAttendance({
  AttendanceModel,
  organizationId,
  targetId,
  targetModel,
  date,
  checkInTime,
  checkOutTime,
  reason,
  adminContext = {},
}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    const attendanceDate = new Date(date);

    // Validation
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      throw new Error('Invalid timestamps provided');
    }

    if (checkOut <= checkIn) {
      throw new Error('Check-out must be after check-in');
    }

    if (attendanceDate > new Date()) {
      throw new Error('Cannot add future attendance');
    }

    // Calculate duration
    const duration = Math.floor((checkOut - checkIn) / (1000 * 60));

    // Get entity data for detection
    const MemberModel = mongoose.model(targetModel);
    const entityData = await MemberModel.findById(targetId).lean();

    if (!entityData) {
      throw new Error(`${targetModel} not found with ID: ${targetId}`);
    }

    // Detect attendance type
    const attendanceType = detectAttendanceType({
      checkInTime: checkIn,
      checkOutTime: checkOut,
      targetModel,
      entityData,
    });

    // Find or create monthly record
    const year = attendanceDate.getFullYear();
    const month = attendanceDate.getMonth() + 1;

    const attendance = await AttendanceModel.findOrCreateForMonth(
      organizationId,
      targetModel,
      targetId,
      year,
      month
    );

    // Create retroactive check-in entry
    const checkInEntry = {
      timestamp: checkIn,
      checkOutAt: checkOut,
      duration,
      attendanceType,
      autoCheckedOut: false,
      recordedBy: {
        userId: adminContext.userId,
        name: adminContext.userName,
        role: adminContext.userRole,
      },
      checkedOutBy: {
        userId: adminContext.userId,
        name: adminContext.userName,
        role: adminContext.userRole,
      },
      method: CHECK_IN_METHOD.MANUAL,
      status: 'valid',
      timeSlot: getTimeSlot(checkIn.getHours()),
      notes: `Retroactive entry: ${reason}`,
      corrections: [
        {
          field: 'retroactive',
          originalValue: null,
          newValue: 'added',
          reason,
          correctedBy: {
            userId: adminContext.userId,
            userName: adminContext.userName,
            userRole: adminContext.userRole,
          },
          correctedAt: new Date(),
        },
      ],
    };

    // Add to attendance
    await attendance.addCheckIn(checkInEntry);

    // Recalculate work days
    attendance.recalculateWorkDays();

    await attendance.save({ session });
    await session.commitTransaction();

    logger.info('Retroactive attendance added', {
      organizationId,
      targetId,
      date: attendanceDate,
      checkInTime: checkIn,
      checkOutTime: checkOut,
      attendanceType,
      addedBy: adminContext.userName,
      reason,
    });

    return {
      success: true,
      retroactive: true,
      checkIn: checkInEntry,
      attendanceType,
      duration,
      reason,
    };
  } catch (error) {
    await session.abortTransaction();
    logger.error('Failed to add retroactive attendance', {
      error: error.message,
      organizationId,
      targetId,
      date,
    });
    throw error;
  } finally {
    session.endSession();
  }
}

export default {
  updateCheckInTime,
  updateCheckOutTime,
  overrideAttendanceType,
  deleteCheckIn,
  addRetroactiveAttendance,
};
