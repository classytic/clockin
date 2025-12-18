/**
 * Attendance Record Factory
 *
 * Centralized creation and computation for attendance records.
 *
 * @module @classytic/clockin/factories/attendance
 */

import mongoose from 'mongoose';
import type {
  ObjectIdLike,
  TimeSlot,
  CheckInEntry,
  AttendanceStats,
  TimeSlotDistribution,
} from '../types.js';

/**
 * Convert ObjectIdLike to ObjectId.
 */
function toObjectId(id: ObjectIdLike): mongoose.Types.ObjectId {
  if (id instanceof mongoose.Types.ObjectId) {
    return id;
  }
  if (typeof id === 'string') {
    return new mongoose.Types.ObjectId(id);
  }
  // Handle { toString() } case - cast to access toString()
  return new mongoose.Types.ObjectId((id as { toString(): string }).toString());
}

/**
 * Parameters for creating an attendance record.
 */
export interface CreateAttendanceRecordParams {
  /** Tenant/organization ID */
  tenantId: ObjectIdLike;

  /** Target model name (e.g., 'Membership', 'Employee') */
  targetModel: string;

  /** Target document ID */
  targetId: ObjectIdLike;

  /** Year (defaults to current year) */
  year?: number;

  /** Month (1-12, defaults to current month) */
  month?: number;
}

/**
 * Attendance Record Factory
 *
 * Creates and computes attendance records with sensible defaults.
 *
 * @example
 * ```typescript
 * // Create a new attendance record for the current period
 * const record = AttendanceRecordFactory.createForPeriod({
 *   tenantId: organizationId,
 *   targetModel: 'Membership',
 *   targetId: memberId,
 * });
 *
 * // Create for a specific period
 * const record = AttendanceRecordFactory.createForPeriod({
 *   tenantId: organizationId,
 *   targetModel: 'Employee',
 *   targetId: employeeId,
 *   year: 2024,
 *   month: 6,
 * });
 * ```
 */
export class AttendanceRecordFactory {
  /**
   * Create an attendance record for a period.
   *
   * Returns a partial attendance record suitable for upsert operations.
   *
   * @param params - Record parameters
   * @returns Partial attendance record
   */
  static createForPeriod(params: CreateAttendanceRecordParams): {
    tenantId: mongoose.Types.ObjectId;
    targetModel: string;
    targetId: mongoose.Types.ObjectId;
    year: number;
    month: number;
    checkIns: CheckInEntry[];
    monthlyTotal: number;
    uniqueDaysVisited: number;
    visitedDays: string[];
    timeSlotDistribution: TimeSlotDistribution;
  } {
    const now = new Date();
    return {
      tenantId: toObjectId(params.tenantId),
      targetModel: params.targetModel,
      targetId: toObjectId(params.targetId),
      year: params.year ?? now.getFullYear(),
      month: params.month ?? now.getMonth() + 1,
      checkIns: [],
      monthlyTotal: 0,
      uniqueDaysVisited: 0,
      visitedDays: [],
      timeSlotDistribution: {
        early_morning: 0,
        morning: 0,
        afternoon: 0,
        evening: 0,
        night: 0,
      },
    };
  }

  /**
   * Calculate time slot distribution from check-ins.
   *
   * @param checkIns - Array of check-in entries
   * @returns Time slot distribution counts
   */
  static calculateTimeSlotDistribution(checkIns: CheckInEntry[]): TimeSlotDistribution {
    const distribution: TimeSlotDistribution = {
      early_morning: 0,
      morning: 0,
      afternoon: 0,
      evening: 0,
      night: 0,
    };

    for (const checkIn of checkIns) {
      if (checkIn.timeSlot && distribution[checkIn.timeSlot] !== undefined) {
        distribution[checkIn.timeSlot]++;
      }
    }

    return distribution;
  }

  /**
   * Calculate unique visited days from check-ins.
   *
   * @param checkIns - Array of check-in entries
   * @returns Array of unique day strings (YYYY-MM-DD)
   */
  static calculateVisitedDays(checkIns: CheckInEntry[]): string[] {
    const days = new Set<string>();

    for (const checkIn of checkIns) {
      if (checkIn.timestamp) {
        const dayString = new Date(checkIn.timestamp).toISOString().split('T')[0];
        days.add(dayString);
      }
    }

    return Array.from(days).sort();
  }

  /**
   * Calculate the favorite time slot from check-ins.
   *
   * @param checkIns - Array of check-in entries
   * @returns Most frequent time slot, or undefined if no check-ins
   */
  static calculateFavoriteTimeSlot(checkIns: CheckInEntry[]): TimeSlot | undefined {
    if (checkIns.length === 0) return undefined;

    const distribution = this.calculateTimeSlotDistribution(checkIns);
    let maxSlot: TimeSlot | undefined;
    let maxCount = 0;

    for (const [slot, count] of Object.entries(distribution)) {
      if (count > maxCount) {
        maxCount = count;
        maxSlot = slot as TimeSlot;
      }
    }

    return maxSlot;
  }

  /**
   * Calculate attendance record statistics.
   *
   * @param checkIns - Array of check-in entries
   * @returns Computed statistics
   */
  static calculateRecordStats(checkIns: CheckInEntry[]): {
    monthlyTotal: number;
    uniqueDaysVisited: number;
    visitedDays: string[];
    timeSlotDistribution: TimeSlotDistribution;
  } {
    const visitedDays = this.calculateVisitedDays(checkIns);

    return {
      monthlyTotal: checkIns.filter((c) => c.status === 'valid').length,
      uniqueDaysVisited: visitedDays.length,
      visitedDays,
      timeSlotDistribution: this.calculateTimeSlotDistribution(checkIns),
    };
  }

  /**
   * Create initial attendance stats for a new member.
   *
   * @param firstVisitAt - Optional first visit timestamp (defaults to now)
   * @returns Initial attendance stats
   */
  static createInitialStats(firstVisitAt?: Date): Partial<AttendanceStats> {
    const now = firstVisitAt || new Date();

    return {
      totalVisits: 0,
      lastVisitedAt: undefined,
      firstVisitedAt: undefined,
      currentStreak: 0,
      longestStreak: 0,
      monthlyAverage: 0,
      thisMonthVisits: 0,
      lastMonthVisits: 0,
      engagementLevel: 'inactive',
      daysSinceLastVisit: undefined,
      favoriteTimeSlot: undefined,
      loyaltyScore: 0,
      updatedAt: now,
    };
  }
}

export default AttendanceRecordFactory;
