/**
 * 📝 Correction Request Manager
 * Employee self-service correction requests
 *
 * Uses NESTED STRUCTURE in attendance model - no separate collection!
 * - Leaner, simpler, everything in one place
 * - Correction requests stored as array in monthly attendance document
 * - Perfect for "competitive programmer" minimal style
 *
 * Workflow:
 * 1. Employee: submitCorrectionRequest() → adds to correctionRequests array
 * 2. Admin: reviewCorrectionRequest() → updates array item
 * 3. System: applyCorrectionRequest() → auto-apply if approved
 * 4. Employee: getCorrectionRequests() → query array
 *
 * @module lib/attendance/core/correction-request
 */

import mongoose from 'mongoose';
import { getCurrentPeriod } from '../utils/check-in.utils.js';
import { buildAttendanceMatch } from '../utils/query-builders.js';
import {
  updateCheckInTime,
  updateCheckOutTime,
  overrideAttendanceType,
  deleteCheckIn,
  addRetroactiveAttendance,
} from './correction.manager.js';
import logger from '../utils/logger.js';

/**
 * Submit correction request (employee self-service)
 * Adds request to correctionRequests array in attendance document
 *
 * @param {Object} params
 * @param {Model} params.AttendanceModel
 * @param {ObjectId} params.organizationId
 * @param {ObjectId} params.employeeId
 * @param {String} params.targetModel
 * @param {String} params.requestType
 * @param {Date} params.date
 * @param {String} params.checkInId - Optional (not needed for add_missing)
 * @param {Object} params.requestedChanges
 * @param {String} params.priority - Optional
 * @returns {Promise<Object>}
 */
export async function submitCorrectionRequest({
  AttendanceModel,
  organizationId,
  employeeId,
  targetModel,
  requestType,
  date,
  checkInId = null,
  requestedChanges,
  priority = 'normal',
}) {
  try {
    // Validate required fields
    if (!requestedChanges.reason || requestedChanges.reason.trim().length === 0) {
      throw new Error('Reason is required for correction request');
    }

    const requestDate = new Date(date);
    const { year, month } = getCurrentPeriod(requestDate);

    // Find or create attendance record for the month
    const attendance = await AttendanceModel.findOrCreateForMonth(
      organizationId,
      targetModel,
      employeeId,
      year,
      month
    );

    // Create request object
    const request = {
      requestType,
      status: 'pending',
      checkInId: checkInId ? new mongoose.Types.ObjectId(checkInId) : null,
      requestedChanges,
      priority,
      createdAt: new Date(),
    };

    // Add to correctionRequests array
    attendance.correctionRequests.push(request);
    await attendance.save();

    // Get the newly added request (with generated _id)
    const addedRequest = attendance.correctionRequests[attendance.correctionRequests.length - 1];

    logger.info('Correction request submitted', {
      requestId: addedRequest._id,
      organizationId,
      employeeId,
      requestType,
      date,
    });

    return {
      success: true,
      request: addedRequest.toObject(),
      message: 'Correction request submitted successfully. Awaiting admin review.',
    };
  } catch (error) {
    logger.error('Failed to submit correction request', {
      error: error.message,
      organizationId,
      employeeId,
      requestType,
    });
    throw error;
  }
}

/**
 * Get correction requests (with filters)
 * Queries correctionRequests arrays across attendance documents
 *
 * @param {Object} params
 * @param {Model} params.AttendanceModel
 * @param {ObjectId} params.organizationId
 * @param {ObjectId} params.employeeId - Optional (for employee to see their own)
 * @param {String} params.status - Optional filter
 * @param {Object} params.pagination
 * @returns {Promise<Object>}
 */
export async function getCorrectionRequests({
  AttendanceModel,
  organizationId,
  employeeId = null,
  status = null,
  pagination = { page: 1, limit: 20 },
}) {
  try {
    const match = { tenantId: organizationId };

    if (employeeId) {
      match.targetId = new mongoose.Types.ObjectId(employeeId);
    }

    // Build aggregation pipeline
    const pipeline = [
      { $match: match },
      { $unwind: { path: '$correctionRequests', preserveNullAndEmptyArrays: false } },
    ];

    // Filter by status if provided
    if (status) {
      pipeline.push({
        $match: { 'correctionRequests.status': status },
      });
    }

    // Add metadata
    pipeline.push(
      {
        $addFields: {
          'correctionRequests.attendanceId': '$_id',
          'correctionRequests.employeeId': '$targetId',
          'correctionRequests.targetModel': '$targetModel',
          'correctionRequests.year': '$year',
          'correctionRequests.month': '$month',
        },
      },
      { $replaceRoot: { newRoot: '$correctionRequests' } },
      { $sort: { createdAt: -1 } }
    );

    // Execute aggregation with pagination
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const [results, countResult] = await Promise.all([
      AttendanceModel.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]),
      AttendanceModel.aggregate([...pipeline, { $count: 'total' }]),
    ]);

    const total = countResult[0]?.total || 0;
    const pages = Math.ceil(total / limit);

    return {
      success: true,
      requests: results,
      pagination: {
        total,
        page,
        limit,
        pages,
        hasNextPage: page < pages,
        hasPrevPage: page > 1,
      },
    };
  } catch (error) {
    logger.error('Failed to get correction requests', {
      error: error.message,
      organizationId,
      employeeId,
    });
    throw error;
  }
}

/**
 * Review correction request (admin approval/rejection)
 * Updates the nested request in correctionRequests array
 *
 * @param {Object} params
 * @param {Model} params.AttendanceModel
 * @param {String} params.attendanceId - Attendance document ID
 * @param {String} params.requestId - Request subdocument ID
 * @param {String} params.action - 'approve' or 'reject'
 * @param {String} params.reviewNotes
 * @param {Object} params.adminContext
 * @returns {Promise<Object>}
 */
export async function reviewCorrectionRequest({
  AttendanceModel,
  attendanceId,
  requestId,
  action,
  reviewNotes = '',
  adminContext,
}) {
  try {
    if (!['approve', 'reject'].includes(action)) {
      throw new Error('Invalid action. Must be approve or reject');
    }

    // Find attendance document with the request
    const attendance = await AttendanceModel.findById(attendanceId);

    if (!attendance) {
      throw new Error('Attendance record not found');
    }

    // Find the specific request in array
    const request = attendance.correctionRequests.id(requestId);

    if (!request) {
      throw new Error('Correction request not found');
    }

    if (request.status !== 'pending') {
      throw new Error(`Request already ${request.status}`);
    }

    // Update status
    request.status = action === 'approve' ? 'approved' : 'rejected';
    request.reviewedBy = {
      userId: adminContext.userId,
      userName: adminContext.userName,
      userRole: adminContext.userRole,
    };
    request.reviewedAt = new Date();
    request.reviewNotes = reviewNotes;

    await attendance.save();

    logger.info(`Correction request ${action}d`, {
      attendanceId,
      requestId,
      action,
      reviewedBy: adminContext.userName,
    });

    return {
      success: true,
      request: request.toObject(),
      message: `Request ${action}d successfully`,
    };
  } catch (error) {
    logger.error('Failed to review correction request', {
      error: error.message,
      attendanceId,
      requestId,
      action,
    });
    throw error;
  }
}

/**
 * Apply approved correction request
 * Automatically applies the correction using correction.manager
 *
 * @param {Object} params
 * @param {Model} params.AttendanceModel
 * @param {String} params.attendanceId
 * @param {String} params.requestId
 * @param {Object} params.adminContext
 * @returns {Promise<Object>}
 */
export async function applyCorrectionRequest({
  AttendanceModel,
  attendanceId,
  requestId,
  adminContext,
}) {
  try {
    // Find attendance document
    const attendance = await AttendanceModel.findById(attendanceId);

    if (!attendance) {
      throw new Error('Attendance record not found');
    }

    // Find the request
    const request = attendance.correctionRequests.id(requestId);

    if (!request) {
      throw new Error('Correction request not found');
    }

    if (request.status !== 'approved') {
      throw new Error('Request must be approved before applying');
    }

    let correctionResult;

    // Apply correction based on request type
    switch (request.requestType) {
      case 'update_check_in_time':
        correctionResult = await updateCheckInTime({
          AttendanceModel,
          organizationId: attendance.tenantId,
          targetId: attendance.targetId,
          targetModel: attendance.targetModel,
          checkInId: request.checkInId,
          newTimestamp: request.requestedChanges.checkInTime,
          reason: request.requestedChanges.reason,
          adminContext,
        });
        break;

      case 'update_check_out_time':
        correctionResult = await updateCheckOutTime({
          AttendanceModel,
          organizationId: attendance.tenantId,
          targetId: attendance.targetId,
          targetModel: attendance.targetModel,
          checkInId: request.checkInId,
          newCheckOutTime: request.requestedChanges.checkOutTime,
          reason: request.requestedChanges.reason,
          adminContext,
        });
        break;

      case 'override_attendance_type':
        correctionResult = await overrideAttendanceType({
          AttendanceModel,
          organizationId: attendance.tenantId,
          targetId: attendance.targetId,
          targetModel: attendance.targetModel,
          checkInId: request.checkInId,
          newType: request.requestedChanges.attendanceType,
          reason: request.requestedChanges.reason,
          adminContext,
        });
        break;

      case 'delete_duplicate':
        correctionResult = await deleteCheckIn({
          AttendanceModel,
          organizationId: attendance.tenantId,
          targetId: attendance.targetId,
          targetModel: attendance.targetModel,
          checkInId: request.checkInId,
          reason: request.requestedChanges.reason,
          adminContext,
        });
        break;

      case 'add_missing_attendance':
        correctionResult = await addRetroactiveAttendance({
          AttendanceModel,
          organizationId: attendance.tenantId,
          targetId: attendance.targetId,
          targetModel: attendance.targetModel,
          date: new Date(attendance.year, attendance.month - 1, 1),
          checkInTime: request.requestedChanges.checkInTime,
          checkOutTime: request.requestedChanges.checkOutTime,
          reason: request.requestedChanges.reason,
          adminContext,
        });
        break;

      default:
        throw new Error(`Unknown request type: ${request.requestType}`);
    }

    // Mark request as applied
    request.status = 'applied';
    request.appliedAt = new Date();
    await attendance.save();

    logger.info('Correction request applied', {
      attendanceId,
      requestId,
      requestType: request.requestType,
      appliedBy: adminContext.userName,
    });

    return {
      success: true,
      request: request.toObject(),
      correction: correctionResult,
      message: 'Correction applied successfully',
    };
  } catch (error) {
    logger.error('Failed to apply correction request', {
      error: error.message,
      attendanceId,
      requestId,
    });
    throw error;
  }
}

export default {
  submitCorrectionRequest,
  getCorrectionRequests,
  reviewCorrectionRequest,
  applyCorrectionRequest,
};
