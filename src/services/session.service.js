/**
 * Session Service
 * Clean abstraction for session management operations
 */

import {
  findActiveSession,
  calculateDuration,
  getCurrentPeriod,
  isActiveCheckIn,
} from '../utils/check-in.utils.js';

import {
  buildAttendanceMatch,
  buildOccupancyPipeline,
} from '../utils/query-builders.js';

export class SessionService {
  constructor(AttendanceModel) {
    this.AttendanceModel = AttendanceModel;
  }

  async findMemberActiveSession({ memberId, organizationId, targetModel }) {
    const { year, month } = getCurrentPeriod();

    const match = buildAttendanceMatch({
      organizationId,
      targetModel,
      targetId: memberId,
      year,
      month,
    });

    const attendance = await this.AttendanceModel.findOne(match);
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

  async getOccupancy({ organizationId, targetModel }) {
    const { year, month } = getCurrentPeriod();

    const match = buildAttendanceMatch({
      organizationId,
      targetModel,
      year,
      month,
    });

    const pipeline = buildOccupancyPipeline(match);
    const results = await this.AttendanceModel.aggregate(pipeline);

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

  async findExpiredSessions() {
    const { year, month } = getCurrentPeriod();
    const now = new Date();

    return this.AttendanceModel.find({
      year,
      month,
      'checkIns.expectedCheckOutAt': { $lte: now },
      'checkIns.checkOutAt': null,
    });
  }

  filterActiveCheckIns(checkIns) {
    return checkIns.filter(isActiveCheckIn);
  }

  filterExpiredCheckIns(checkIns, now = new Date()) {
    return checkIns.filter(
      (checkIn) => !checkIn.checkOutAt && checkIn.expectedCheckOutAt <= now
    );
  }
}

export const createSessionService = (AttendanceModel) =>
  new SessionService(AttendanceModel);
