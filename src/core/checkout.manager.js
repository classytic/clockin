/**
 * Checkout Manager
 * Handles member checkout and auto-checkout logic
 */

import mongoose from 'mongoose';
import {
  findActiveSession,
  calculateDuration,
  getCurrentPeriod,
} from '../utils/check-in.utils.js';
import {
  buildAttendanceMatch,
  buildOccupancyPipeline,
  toObjectId,
} from '../utils/query-builders.js';
import { detectAttendanceType } from '../utils/detection.utils.js';

export async function checkOut({
  AttendanceModel,
  member,
  targetModel,
  checkInId,
  context = {},
}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const now = new Date();
    const { year, month } = getCurrentPeriod(now);

    const match = buildAttendanceMatch({
      organizationId: member.organizationId,
      targetModel,
      targetId: member._id,
      year,
      month,
    });

    const attendance = await AttendanceModel.findOne(match).session(session);

    if (!attendance) {
      throw new Error('No active check-in found');
    }

    const checkIn = attendance.checkIns.id(checkInId);
    if (!checkIn) {
      throw new Error('Check-in not found');
    }

    if (checkIn.checkOutAt) {
      throw new Error('Already checked out');
    }

    checkIn.checkOutAt = now;
    checkIn.duration = calculateDuration(checkIn.timestamp, now);
    checkIn.checkedOutBy = {
      userId: context.userId,
      name: context.userName,
      role: context.userRole,
    };

    // ⭐ Smart attendance type detection (configuration-driven)
    // Auto-detect based on duration and employee's workSchedule
    checkIn.attendanceType = detectAttendanceType({
      checkInTime: checkIn.timestamp,
      checkOutTime: now,
      targetModel,
      entityData: member  // Contains workSchedule for employees
    });

    // ⭐ Recalculate work days only on checkout (when type is final)
    attendance.recalculateWorkDays();

    await attendance.save({ session });

    // Reset currentSession on member document for real-time frontend state
    const MemberModel = mongoose.model(targetModel);
    await MemberModel.findByIdAndUpdate(
      member._id,
      {
        $set: {
          'currentSession': {
            isActive: false,
            checkInId: null,
            checkInTime: null,
            expectedCheckOutAt: null,
            method: null,
            // durationMinutes is now a virtual field (no need to set)
          },
        },
      },
      { session }
    );

    await session.commitTransaction();

    return {
      checkIn: checkIn.toObject(),
      duration: checkIn.duration,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function autoCheckOutExpired({ AttendanceModel }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Find all expired sessions
  const expiredAttendance = await AttendanceModel.find({
    year,
    month,
    'checkIns.expectedCheckOutAt': { $lte: now },
    'checkIns.checkOutAt': null,
  });

  let checkedOutCount = 0;

  // Process each expired session
  for (const attendance of expiredAttendance) {
    // ⭐ SMART AUTO-CHECKOUT: Fetch entity data for schedule-aware detection
    const MemberModel = mongoose.model(attendance.targetModel);
    const entityData = await MemberModel.findById(attendance.targetId).lean();

    for (const checkIn of attendance.checkIns) {
      if (
        checkIn.expectedCheckOutAt <= now &&
        !checkIn.checkOutAt
      ) {
        // Update check-in entry
        checkIn.checkOutAt = now;
        checkIn.autoCheckedOut = true;
        checkIn.duration = Math.floor((now - checkIn.timestamp) / (1000 * 60));

        // ⭐ INTELLIGENT ATTENDANCE TYPE DETECTION
        // Now uses entity's actual schedule (employee workSchedule)
        // Falls back gracefully if entity not found
        checkIn.attendanceType = detectAttendanceType({
          checkInTime: checkIn.timestamp,
          checkOutTime: now,
          targetModel: attendance.targetModel,
          entityData: entityData || null  // Now available for schedule-aware detection!
        });

        // Reset currentSession on member document
        await MemberModel.findByIdAndUpdate(attendance.targetId, {
          $set: {
            'currentSession': {
              isActive: false,
              checkInId: null,
              checkInTime: null,
              expectedCheckOutAt: null,
              method: null,
              // durationMinutes is now a virtual field
            },
          },
        });

        checkedOutCount++;
      }
    }

    // Recalculate work days after all checkouts
    attendance.recalculateWorkDays();

    await attendance.save();
  }

  return {
    modifiedCount: checkedOutCount,
  };
}

export async function getCurrentOccupancy({
  AttendanceModel,
  organizationId,
  targetModel = null,
}) {
  const { year, month } = getCurrentPeriod();

  const match = buildAttendanceMatch({
    organizationId,
    targetModel,
    year,
    month,
  });

  const pipeline = buildOccupancyPipeline(match);
  const results = await AttendanceModel.aggregate(pipeline);

  const byType = results.reduce((acc, group) => {
    acc[group._id] = {
      count: group.count,
      members: group.members,
    };
    return acc;
  }, {});

  const total = results.reduce((sum, group) => sum + group.count, 0);

  return {
    total,
    byType,
    timestamp: new Date(),
  };
}

export async function getMemberCurrentSession({
  AttendanceModel,
  memberId,
  organizationId,
  targetModel,
}) {
  const { year, month } = getCurrentPeriod();

  const match = buildAttendanceMatch({
    organizationId,
    targetModel,
    targetId: memberId,
    year,
    month,
  });

  const attendance = await AttendanceModel.findOne(match);
  if (!attendance) return null;

  const activeCheckIn = findActiveSession(attendance.checkIns);
  if (!activeCheckIn) return null;

  return {
    checkInId: activeCheckIn._id,
    timestamp: activeCheckIn.timestamp,
    expectedCheckOutAt: activeCheckIn.expectedCheckOutAt,
    duration: calculateDuration(activeCheckIn.timestamp),
    method: activeCheckIn.method,
  };
}

/**
 * Toggle Check-In/Check-Out (Smart Toggle for RFID/QR)
 * Industry-standard pattern for self-service kiosks
 *
 * - If member has active session → Check-out
 * - If member has no active session → Check-in
 *
 * Perfect for:
 * - RFID card tap
 * - QR code scan
 * - Biometric scan
 * - Mobile app tap
 *
 * @param {Object} params
 * @param {Model} params.AttendanceModel - Attendance model
 * @param {Object} params.member - Member document
 * @param {String} params.targetModel - Target model name
 * @param {Object} params.checkInData - Check-in data (method, notes, location, device)
 * @param {Object} params.context - Request context
 * @returns {Promise<Object>} { action: 'check-in' | 'check-out', ...result }
 */
export async function toggleCheckInOut({
  AttendanceModel,
  member,
  targetModel,
  checkInData = {},
  context = {},
}) {
  // Check for active session
  const activeSession = await getMemberCurrentSession({
    AttendanceModel,
    memberId: member._id,
    organizationId: member.organizationId,
    targetModel,
  });

  // If active session exists → Check-out
  if (activeSession) {
    const checkoutResult = await checkOut({
      AttendanceModel,
      member,
      targetModel,
      checkInId: activeSession.checkInId,
      context,
    });

    return {
      action: 'check-out',
      ...checkoutResult,
      member: {
        id: member._id,
        membershipCode: member.membershipCode,
        name: member.customer?.name,
      },
    };
  }

  // No active session → Check-in
  const { recordCheckIn } = await import('./check-in.manager.js');

  const checkinResult = await recordCheckIn({
    AttendanceModel,
    member,
    targetModel,
    checkInData,
    context,
  });

  return {
    action: 'check-in',
    ...checkinResult,
  };
}
