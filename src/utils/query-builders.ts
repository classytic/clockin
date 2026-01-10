/**
 * Query Builders
 *
 * MongoDB query construction utilities
 *
 * @module @classytic/clockin/utils/query-builders
 */

import mongoose from 'mongoose';
import type { ObjectIdLike, ObjectId, AttendanceTargetModel } from '../types.js';

/**
 * Convert string to ObjectId
 */
export function toObjectId(id: ObjectIdLike): ObjectId {
  if (typeof id === 'string') {
    return new mongoose.Types.ObjectId(id);
  }
  return id as ObjectId;
}

/**
 * Safe ObjectId conversion (returns null if invalid)
 */
export function safeToObjectId(id: unknown): ObjectId | null {
  try {
    if (!id) return null;
    if (typeof id === 'string') {
      return new mongoose.Types.ObjectId(id);
    }
    if (id instanceof mongoose.Types.ObjectId) {
      return id;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build attendance match query
 */
export function buildAttendanceMatch(params: {
  organizationId: ObjectIdLike;
  targetModel?: AttendanceTargetModel | null;
  targetId?: ObjectIdLike | null;
  year?: number;
  month?: number;
}): Record<string, unknown> {
  const match: Record<string, unknown> = {
    organizationId: toObjectId(params.organizationId),
  };

  if (params.targetModel) {
    match.targetModel = params.targetModel;
  }

  if (params.targetId) {
    match.targetId = toObjectId(params.targetId);
  }

  if (params.year !== undefined) {
    match.year = params.year;
  }

  if (params.month !== undefined) {
    match.month = params.month;
  }

  return match;
}

/**
 * Build member match query
 */
export function buildMemberMatch(params: {
  organizationId: ObjectIdLike;
  status?: string | string[];
  additionalFilters?: Record<string, unknown>;
}): Record<string, unknown> {
  const match: Record<string, unknown> = {
    organizationId: toObjectId(params.organizationId),
  };

  if (params.status) {
    match.status = Array.isArray(params.status)
      ? { $in: params.status }
      : params.status;
  }

  return { ...match, ...params.additionalFilters };
}

/**
 * Build occupancy pipeline
 */
export function buildOccupancyPipeline(
  match: Record<string, unknown>
): unknown[] {
  return [
    { $match: match },
    { $unwind: '$checkIns' },
    {
      $match: {
        'checkIns.checkOutAt': null,
      },
    },
    {
      $group: {
        _id: '$targetModel',
        count: { $sum: 1 },
        members: { $push: '$targetId' },
      },
    },
  ];
}

/**
 * Build stats aggregation pipeline
 */
export function buildStatsAggregation(params: {
  organizationId: ObjectIdLike;
  startDate?: Date;
  endDate?: Date;
}): unknown[] {
  const match: Record<string, unknown> = {
    organizationId: toObjectId(params.organizationId),
  };

  if (params.startDate || params.endDate) {
    match.createdAt = {};
    if (params.startDate) {
      (match.createdAt as Record<string, Date>).$gte = params.startDate;
    }
    if (params.endDate) {
      (match.createdAt as Record<string, Date>).$lte = params.endDate;
    }
  }

  return [
    { $match: match },
    {
      $group: {
        _id: null,
        totalMembers: { $sum: 1 },
        activeMembers: {
          $sum: {
            $cond: [{ $gt: ['$attendanceStats.thisMonthVisits', 0] }, 1, 0],
          },
        },
      },
    },
  ];
}

/**
 * Build current session query
 */
export function buildCurrentSessionQuery(params: {
  organizationId: ObjectIdLike;
  isActive?: boolean;
}): Record<string, unknown> {
  const query: Record<string, unknown> = {
    organizationId: toObjectId(params.organizationId),
  };

  if (params.isActive !== undefined) {
    query['currentSession.isActive'] = params.isActive;
  }

  return query;
}

/**
 * Build date range filter
 */
export function buildDateRangeFilter(
  startDate?: Date,
  endDate?: Date,
  field = 'createdAt'
): Record<string, unknown> | null {
  if (!startDate && !endDate) return null;

  const filter: Record<string, Date> = {};

  if (startDate) {
    filter.$gte = startDate;
  }

  if (endDate) {
    filter.$lte = endDate;
  }

  return { [field]: filter };
}

/**
 * Build period filter for attendance queries
 */
export function buildPeriodFilter(
  startDate: Date,
  endDate: Date
): { years: number[]; months: number[] } {
  const years: number[] = [];
  const months: number[] = [];

  const current = new Date(startDate);
  while (current <= endDate) {
    const year = current.getFullYear();
    const month = current.getMonth() + 1;

    if (!years.includes(year)) years.push(year);
    if (!months.includes(month)) months.push(month);

    current.setMonth(current.getMonth() + 1);
  }

  return { years, months };
}

export default {
  toObjectId,
  safeToObjectId,
  buildAttendanceMatch,
  buildMemberMatch,
  buildOccupancyPipeline,
  buildStatsAggregation,
  buildCurrentSessionQuery,
  buildDateRangeFilter,
  buildPeriodFilter,
};

