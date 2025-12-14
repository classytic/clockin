/**
 * Check-In Utilities
 *
 * Pure functions for check-in logic - easily testable
 *
 * @module @classytic/clockin/utils/check-in
 */

import type { CheckInEntry, ObjectId } from '../types.js';

/**
 * Check if check-in is active (not checked out)
 */
export function isActiveCheckIn(
  checkIn: Pick<CheckInEntry, 'checkOutAt'>
): boolean {
  return !checkIn.checkOutAt;
}

/**
 * Check if check-in is expired (past expected checkout)
 */
export function isExpiredCheckIn(
  checkIn: Pick<CheckInEntry, 'expectedCheckOutAt'>,
  now = new Date()
): boolean {
  if (!checkIn.expectedCheckOutAt) return false;
  return new Date(checkIn.expectedCheckOutAt) < now;
}

/**
 * Find active (not checked out) session in check-ins array
 */
export function findActiveSession<T extends Pick<CheckInEntry, 'checkOutAt'>>(
  checkIns: T[]
): T | undefined {
  return checkIns.find(isActiveCheckIn);
}

/**
 * Filter to active check-ins only
 */
export function filterActiveCheckIns<T extends Pick<CheckInEntry, 'checkOutAt'>>(
  checkIns: T[]
): T[] {
  return checkIns.filter(isActiveCheckIn);
}

/**
 * Count active check-ins
 */
export function countActiveCheckIns(
  checkIns: Pick<CheckInEntry, 'checkOutAt'>[]
): number {
  return filterActiveCheckIns(checkIns).length;
}

/**
 * Calculate duration in minutes between two timestamps
 */
export function calculateDuration(
  startTime: Date | string,
  endTime: Date | string = new Date()
): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Get current period (year and month)
 */
export function getCurrentPeriod(date = new Date()): {
  year: number;
  month: number;
} {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

/**
 * Group items by target model
 */
export function groupByTargetModel<
  T extends { targetModel?: string; _id?: string; count?: number; members?: unknown[] }
>(items: T[]): Record<string, { count: number; members: unknown[] }> {
  return items.reduce(
    (acc, item) => {
      const model = item.targetModel || item._id || 'unknown';
      if (!acc[model]) {
        acc[model] = {
          count: 0,
          members: [],
        };
      }
      acc[model].count += item.count || 1;
      if (item.members) {
        acc[model].members.push(...item.members);
      }
      return acc;
    },
    {} as Record<string, { count: number; members: unknown[] }>
  );
}

/**
 * Calculate total count from grouped data
 */
export function calculateTotalCount(
  groupedData: Record<string, { count: number }>
): number {
  return Object.values(groupedData).reduce((sum, group) => sum + group.count, 0);
}

/**
 * Get unique days from check-ins
 */
export function getUniqueDays(
  checkIns: Pick<CheckInEntry, 'timestamp'>[]
): Set<string> {
  const uniqueDays = new Set<string>();
  checkIns.forEach((ci) => {
    const day = new Date(ci.timestamp).toDateString();
    uniqueDays.add(day);
  });
  return uniqueDays;
}

/**
 * Count unique days visited
 */
export function countUniqueDays(
  checkIns: Pick<CheckInEntry, 'timestamp'>[]
): number {
  return getUniqueDays(checkIns).size;
}

/**
 * Get most common time slot from check-ins
 */
export function getMostCommonTimeSlot(
  distribution: Record<string, number>
): string {
  let maxSlot = 'morning';
  let maxCount = 0;

  for (const [slot, count] of Object.entries(distribution)) {
    if (count > maxCount) {
      maxCount = count;
      maxSlot = slot;
    }
  }

  return maxSlot;
}

/**
 * Group check-ins by unique dates
 */
export function groupCheckInsByDate<T extends Pick<CheckInEntry, 'timestamp'>>(
  checkIns: T[]
): Map<string, T[]> {
  const byDate = new Map<string, T[]>();

  checkIns.forEach((checkIn) => {
    const dateKey = new Date(checkIn.timestamp).toDateString();
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, []);
    }
    byDate.get(dateKey)!.push(checkIn);
  });

  return byDate;
}

export default {
  isActiveCheckIn,
  isExpiredCheckIn,
  findActiveSession,
  filterActiveCheckIns,
  countActiveCheckIns,
  calculateDuration,
  getCurrentPeriod,
  groupByTargetModel,
  calculateTotalCount,
  getUniqueDays,
  countUniqueDays,
  getMostCommonTimeSlot,
  groupCheckInsByDate,
};

