/**
 * ClockIn Correction Request Service
 *
 * Handles correction request lifecycle: submit, list, review, apply
 *
 * @module @classytic/clockin/services/corrections
 */

import mongoose from 'mongoose';
import { Container } from '../core/container.js';
import { Result, ok, err } from '../core/result.js';
import { ValidationError } from '../errors/index.js';
import {
  ATTENDANCE_STATUS,
  CORRECTION_REQUEST_STATUS,
  CORRECTION_REQUEST_TYPE,
  getTimeSlot,
} from '../enums.js';
import { AttendanceRecordFactory } from '../factories/attendance.factory.js';
import type {
  ApplyCorrectionRequestParams,
  AttendanceRecord,
  CorrectionRequest,
  ListCorrectionRequestsParams,
  ObjectIdLike,
  OperationContext,
  SubmitCorrectionRequestParams,
  ReviewCorrectionRequestParams,
  CorrectionEntry,
  CheckInEntry,
} from '../types.js';
import { extractSession } from '../core/transaction.js';

type ClockInRuntimeOptions = {
  singleTenant?: {
    organizationId: ObjectIdLike;
    autoInject?: boolean;
  };
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

/**
 * Correction Request Service
 *
 * Provides type-safe correction request operations
 */
export class CorrectionRequestService {
  private container: Container;

  constructor(container: Container) {
    this.container = container;
  }

  private toObjectId(id: ObjectIdLike): mongoose.Types.ObjectId {
    if (id instanceof mongoose.Types.ObjectId) {
      return id;
    }
    if (typeof id === 'string') {
      return new mongoose.Types.ObjectId(id);
    }
    return new mongoose.Types.ObjectId((id as { toString(): string }).toString());
  }

  private getOrganizationId(
    explicit: ObjectIdLike | undefined,
    context?: OperationContext
  ): ObjectIdLike | undefined {
    if (explicit) return explicit;
    if (context?.organizationId) return context.organizationId;

    const options = this.container.has('options')
      ? this.container.get<ClockInRuntimeOptions>('options')
      : undefined;
    return options?.singleTenant?.organizationId;
  }

  private attachCorrection(
    checkIn: CheckInEntry,
    field: string,
    originalValue: unknown,
    newValue: unknown,
    reason: string,
    context?: OperationContext
  ): void {
    const correction: CorrectionEntry = {
      field,
      originalValue,
      newValue,
      reason,
      correctedBy: {
        userId: context?.userId as any,
        userName: context?.userName,
        userRole: context?.userRole,
      },
      correctedAt: new Date(),
    } as CorrectionEntry;

    if (!checkIn.corrections) {
      checkIn.corrections = [];
    }
    checkIn.corrections.push(correction);
  }

  private recomputeWorkdayCounts(attendance: AttendanceRecord): void {
    const counts = attendance.checkIns.reduce(
      (acc, entry) => {
        const type = entry.attendanceType as string | undefined;
        if (!type) {
          return acc;
        }

        switch (type) {
          case 'full_day':
            acc.full += 1;
            break;
          case 'half_day':
          case 'half_day_morning':
          case 'half_day_afternoon':
            acc.half += 1;
            break;
          case 'paid_leave':
            acc.paidLeave += 1;
            break;
          case 'overtime':
            acc.overtime += 1;
            break;
          default:
            break;
        }

        return acc;
      },
      { full: 0, half: 0, paidLeave: 0, overtime: 0 }
    );

    (attendance as any).fullDaysCount = counts.full;
    (attendance as any).halfDaysCount = counts.half;
    (attendance as any).paidLeaveDaysCount = counts.paidLeave;
    (attendance as any).overtimeDaysCount = counts.overtime;
    (attendance as any).totalWorkDays =
      counts.full +
      counts.half * 0.5 +
      counts.paidLeave +
      counts.overtime;
  }

  // ============================================================================
  // SUBMIT
  // ============================================================================

  /**
   * Submit a correction request
   */
  async submit(
    params: SubmitCorrectionRequestParams
  ): Promise<Result<CorrectionRequest, Error>> {
    const {
      memberId,
      organizationId,
      year,
      month,
      requestType,
      checkInId,
      proposedChanges,
      priority,
      targetModel,
      context,
    } = params;

    const resolvedOrgId = this.getOrganizationId(organizationId, context);
    if (!resolvedOrgId) {
      return err(new ValidationError('organizationId is required'));
    }
    if (!memberId) {
      return err(new ValidationError('memberId is required'));
    }
    if (!year || !month) {
      return err(new ValidationError('year and month are required'));
    }
    if (month < 1 || month > 12) {
      return err(new ValidationError('month must be between 1 and 12'));
    }
    if (!proposedChanges?.reason) {
      return err(new ValidationError('proposedChanges.reason is required'));
    }

    const requiresCheckInId = requestType !== CORRECTION_REQUEST_TYPE.ADD_MISSING_ATTENDANCE;
    if (requiresCheckInId && !checkInId) {
      return err(new ValidationError('checkInId is required for this request type'));
    }

    const AttendanceModel = this.container.get<mongoose.Model<any>>('AttendanceModel');
    const session = extractSession(context);

    const query: Record<string, unknown> = {
      organizationId: this.toObjectId(resolvedOrgId),
      targetId: this.toObjectId(memberId),
      year,
      month,
    };
    if (targetModel) {
      query.targetModel = targetModel;
    }

    let attendanceQuery = AttendanceModel.findOne(query);
    if (session) {
      attendanceQuery = attendanceQuery.session(session);
    }
    let attendance = await attendanceQuery;

    if (!attendance) {
      if (!targetModel) {
        return err(
          new ValidationError('targetModel is required when creating a new attendance record')
        );
      }
      const record = AttendanceRecordFactory.createForPeriod({
        organizationId: resolvedOrgId,
        targetModel,
        targetId: memberId,
        year,
        month,
      });
      attendance = new AttendanceModel(record);
    }

    if (checkInId) {
      const matchingCheckIn = attendance.checkIns.find(
        (entry: any) => entry._id?.toString() === checkInId.toString()
      );
      if (!matchingCheckIn) {
        return err(new ValidationError('checkInId was not found in the attendance record'));
      }
    }

    const request: CorrectionRequest = {
      requestType,
      status: CORRECTION_REQUEST_STATUS.PENDING,
      checkInId: checkInId ? this.toObjectId(checkInId) : undefined,
      requestedChanges: {
        checkInTime: proposedChanges.checkInTime,
        checkOutTime: proposedChanges.checkOutTime,
        attendanceType: proposedChanges.attendanceType,
        reason: proposedChanges.reason,
      },
      priority: priority || 'normal',
      createdAt: new Date(),
    } as CorrectionRequest;

    attendance.correctionRequests.push(request);

    await attendance.save({ session });

    return ok(attendance.correctionRequests[attendance.correctionRequests.length - 1]);
  }

  // ============================================================================
  // LIST
  // ============================================================================

  /**
   * List correction requests
   */
  async list(
    params: ListCorrectionRequestsParams
  ): Promise<Result<CorrectionRequest[], Error>> {
    const {
      attendanceId,
      memberId,
      organizationId,
      year,
      month,
      status,
      requestType,
      targetModel,
      context,
    } = params;

    const AttendanceModel = this.container.get<mongoose.Model<any>>('AttendanceModel');
    const session = extractSession(context);

    let attendance: any = null;
    if (attendanceId) {
      let query = AttendanceModel.findById(attendanceId);
      if (session) {
        query = query.session(session);
      }
      attendance = await query;
    } else {
      const resolvedOrgId = this.getOrganizationId(organizationId, context);
      if (!resolvedOrgId || !memberId || !year || !month) {
        return err(
          new ValidationError('organizationId, memberId, year, and month are required')
        );
      }

      const query: Record<string, unknown> = {
        organizationId: this.toObjectId(resolvedOrgId),
        targetId: this.toObjectId(memberId),
        year,
        month,
      };
      if (targetModel) {
        query.targetModel = targetModel;
      }

      let attendanceQuery = AttendanceModel.findOne(query);
      if (session) {
        attendanceQuery = attendanceQuery.session(session);
      }
      attendance = await attendanceQuery;
    }

    if (!attendance) {
      return ok([]);
    }

    let requests: CorrectionRequest[] = attendance.correctionRequests || [];
    if (status) {
      requests = requests.filter((req) => req.status === status);
    }
    if (requestType) {
      requests = requests.filter((req) => req.requestType === requestType);
    }

    return ok(requests);
  }

  // ============================================================================
  // REVIEW
  // ============================================================================

  /**
   * Review a correction request (approve or reject)
   */
  async review(
    params: ReviewCorrectionRequestParams
  ): Promise<Result<CorrectionRequest, Error>> {
    const { attendanceId, requestId, approved, notes, context } = params;

    const AttendanceModel = this.container.get<mongoose.Model<any>>('AttendanceModel');
    const session = extractSession(context);

    let attendanceQuery = AttendanceModel.findById(attendanceId);
    if (session) {
      attendanceQuery = attendanceQuery.session(session);
    }
    const attendance = await attendanceQuery;

    if (!attendance) {
      return err(new ValidationError('Attendance record not found'));
    }

    const request = attendance.correctionRequests.find(
      (entry: any) => entry._id?.toString() === requestId.toString()
    );

    if (!request) {
      return err(new ValidationError('Correction request not found'));
    }

    if (request.status !== CORRECTION_REQUEST_STATUS.PENDING) {
      return err(new ValidationError('Correction request has already been reviewed'));
    }

    request.status = approved
      ? CORRECTION_REQUEST_STATUS.APPROVED
      : CORRECTION_REQUEST_STATUS.REJECTED;
    request.reviewNotes = notes;
    request.reviewedAt = new Date();
    request.reviewedBy = {
      userId: context?.userId as any,
      userName: context?.userName,
      userRole: context?.userRole,
    };

    await attendance.save({ session });

    return ok(request);
  }

  // ============================================================================
  // APPLY
  // ============================================================================

  /**
   * Apply an approved correction request
   */
  async apply(
    params: ApplyCorrectionRequestParams
  ): Promise<Result<CorrectionRequest, Error>> {
    const { attendanceId, requestId, context } = params;

    const AttendanceModel = this.container.get<mongoose.Model<any>>('AttendanceModel');
    const session = extractSession(context);

    let attendanceQuery = AttendanceModel.findById(attendanceId);
    if (session) {
      attendanceQuery = attendanceQuery.session(session);
    }
    const attendance = await attendanceQuery;

    if (!attendance) {
      return err(new ValidationError('Attendance record not found'));
    }

    const request = attendance.correctionRequests.find(
      (entry: any) => entry._id?.toString() === requestId.toString()
    );

    if (!request) {
      return err(new ValidationError('Correction request not found'));
    }

    if (request.status === CORRECTION_REQUEST_STATUS.APPLIED) {
      return err(new ValidationError('Correction request has already been applied'));
    }

    if (request.status !== CORRECTION_REQUEST_STATUS.APPROVED) {
      return err(new ValidationError('Only approved correction requests can be applied'));
    }

    const reason = request.requestedChanges?.reason || 'Correction applied';
    const now = new Date();

    const findCheckIn = (): any => {
      if (!request.checkInId) return null;
      return attendance.checkIns.find(
        (entry: any) => entry._id?.toString() === request.checkInId?.toString()
      );
    };

    switch (request.requestType) {
      case CORRECTION_REQUEST_TYPE.UPDATE_CHECK_IN_TIME: {
        const checkIn = findCheckIn();
        if (!checkIn) {
          return err(new ValidationError('checkInId is required for this correction type'));
        }
        const newTime = request.requestedChanges?.checkInTime;
        if (!newTime) {
          return err(new ValidationError('requestedChanges.checkInTime is required'));
        }
        const originalTime = checkIn.timestamp;
        checkIn.timestamp = newTime;
        checkIn.timeSlot = getTimeSlot(new Date(newTime).getHours());
        if (checkIn.checkOutAt) {
          checkIn.duration = Math.floor(
            (new Date(checkIn.checkOutAt).getTime() - new Date(checkIn.timestamp).getTime()) / (1000 * 60)
          );
        }
        this.attachCorrection(checkIn, 'timestamp', originalTime, newTime, reason, context);
        break;
      }
      case CORRECTION_REQUEST_TYPE.UPDATE_CHECK_OUT_TIME: {
        const checkIn = findCheckIn();
        if (!checkIn) {
          return err(new ValidationError('checkInId is required for this correction type'));
        }
        const newTime = request.requestedChanges?.checkOutTime;
        if (!newTime) {
          return err(new ValidationError('requestedChanges.checkOutTime is required'));
        }
        const originalTime = checkIn.checkOutAt;
        checkIn.checkOutAt = newTime;
        if (checkIn.timestamp) {
          checkIn.duration = Math.floor(
            (new Date(checkIn.checkOutAt).getTime() - new Date(checkIn.timestamp).getTime()) / (1000 * 60)
          );
        }
        this.attachCorrection(checkIn, 'checkOutAt', originalTime, newTime, reason, context);
        break;
      }
      case CORRECTION_REQUEST_TYPE.OVERRIDE_ATTENDANCE_TYPE: {
        const checkIn = findCheckIn();
        if (!checkIn) {
          return err(new ValidationError('checkInId is required for this correction type'));
        }
        const newType = request.requestedChanges?.attendanceType;
        if (!newType) {
          return err(new ValidationError('requestedChanges.attendanceType is required'));
        }
        const originalType = checkIn.attendanceType;
        checkIn.attendanceType = newType;
        this.attachCorrection(checkIn, 'attendanceType', originalType, newType, reason, context);
        break;
      }
      case CORRECTION_REQUEST_TYPE.DELETE_DUPLICATE: {
        const checkIn = findCheckIn();
        if (!checkIn) {
          return err(new ValidationError('checkInId is required for this correction type'));
        }
        const originalStatus = checkIn.status;
        checkIn.status = ATTENDANCE_STATUS.INVALID;
        this.attachCorrection(checkIn, 'status', originalStatus, checkIn.status, reason, context);
        break;
      }
      case CORRECTION_REQUEST_TYPE.ADD_MISSING_ATTENDANCE: {
        const checkInTime = request.requestedChanges?.checkInTime;
        if (!checkInTime) {
          return err(new ValidationError('requestedChanges.checkInTime is required'));
        }
        const checkOutTime = request.requestedChanges?.checkOutTime;
        const attendanceType = request.requestedChanges?.attendanceType || 'full_day';

        const entry: CheckInEntry = {
          timestamp: checkInTime,
          checkOutAt: checkOutTime || null,
          expectedCheckOutAt: null,
          duration: checkOutTime
            ? Math.floor(
                (new Date(checkOutTime).getTime() - new Date(checkInTime).getTime()) / (1000 * 60)
              )
            : null,
          autoCheckedOut: false,
          recordedBy: {
            userId: context?.userId as any,
            name: context?.userName,
            role: context?.userRole,
          },
          checkedOutBy: null,
          method: 'manual',
          status: ATTENDANCE_STATUS.VALID,
          timeSlot: getTimeSlot(new Date(checkInTime).getHours()),
          attendanceType,
        };

        attendance.checkIns.push(entry);
        break;
      }
      default:
        return err(new ValidationError('Unsupported correction request type'));
    }

    request.status = CORRECTION_REQUEST_STATUS.APPLIED;
    request.appliedAt = now;

    const stats = AttendanceRecordFactory.calculateRecordStats(attendance.checkIns);
    attendance.monthlyTotal = stats.monthlyTotal;
    attendance.uniqueDaysVisited = stats.uniqueDaysVisited;
    (attendance as any).visitedDays = stats.visitedDays;
    attendance.timeSlotDistribution = stats.timeSlotDistribution as any;

    this.recomputeWorkdayCounts(attendance as AttendanceRecord);

    await attendance.save({ session });

    return ok(request);
  }
}

// ============================================================================
// FUNCTIONAL EXPORTS
// ============================================================================

type CorrectionsProvider =
  | CorrectionRequestService
  | { corrections: CorrectionRequestService };

function resolveService(provider: CorrectionsProvider): CorrectionRequestService {
  if (provider instanceof CorrectionRequestService) {
    return provider;
  }
  return provider.corrections;
}

export function submitCorrectionRequest(
  provider: CorrectionsProvider,
  params: SubmitCorrectionRequestParams
): Promise<Result<CorrectionRequest, Error>> {
  return resolveService(provider).submit(params);
}

export function listCorrectionRequests(
  provider: CorrectionsProvider,
  params: ListCorrectionRequestsParams
): Promise<Result<CorrectionRequest[], Error>> {
  return resolveService(provider).list(params);
}

export function reviewCorrectionRequest(
  provider: CorrectionsProvider,
  params: ReviewCorrectionRequestParams
): Promise<Result<CorrectionRequest, Error>> {
  return resolveService(provider).review(params);
}

export function applyCorrectionRequest(
  provider: CorrectionsProvider,
  params: ApplyCorrectionRequestParams
): Promise<Result<CorrectionRequest, Error>> {
  return resolveService(provider).apply(params);
}
