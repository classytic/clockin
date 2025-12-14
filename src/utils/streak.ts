/**
 * Streak Calculator
 *
 * Pure functions for calculating attendance streaks
 * No side effects, fully testable
 *
 * @module @classytic/clockin/utils/streak
 */

import { STREAK_CONFIG } from '../config.js';
import type { StreakResult, CheckInEntry } from '../types.js';

/**
 * Calculate current and longest streak from check-in history
 *
 * @param checkIns - Array of check-in entries (any order)
 * @returns Streak result with current and longest streak
 *
 * @example
 * ```typescript
 * const { currentStreak, longestStreak } = calculateStreak(checkIns);
 * console.log(`Current: ${currentStreak} days, Best: ${longestStreak} days`);
 * ```
 */
export function calculateStreak(
  checkIns: Array<{ timestamp: Date | string }>
): StreakResult {
  if (!checkIns || checkIns.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Sort by timestamp descending (newest first)
  const sorted = [...checkIns].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Get unique days (one check-in per day counts)
  const uniqueDays = new Set<string>();
  sorted.forEach((checkIn) => {
    const day = new Date(checkIn.timestamp).toDateString();
    uniqueDays.add(day);
  });

  const days = Array.from(uniqueDays)
    .map((day) => new Date(day))
    .sort((a, b) => b.getTime() - a.getTime()); // Sort descending

  if (days.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Calculate current streak
  let currentStreak = 1;
  const today = new Date();
  const todayStr = today.toDateString();
  const yesterdayStr = new Date(
    today.getTime() - 24 * 60 * 60 * 1000
  ).toDateString();

  // Check if streak is still active
  const lastDayStr = days[0]!.toDateString();
  const isStreakActive = lastDayStr === todayStr || lastDayStr === yesterdayStr;

  if (!isStreakActive) {
    currentStreak = 0;
  } else {
    // Count consecutive days
    for (let i = 1; i < days.length; i++) {
      const diffMs = days[i - 1]!.getTime() - days[i]!.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < days.length; i++) {
    const diffMs = days[i - 1]!.getTime() - days[i]!.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  return { currentStreak, longestStreak };
}

/**
 * Check if streak milestone was reached
 *
 * @param streak - Current streak value
 * @returns Whether milestone reached
 *
 * @example
 * ```typescript
 * if (isStreakMilestone(7)) {
 *   // Send 7-day streak notification
 * }
 * ```
 */
export function isStreakMilestone(streak: number): boolean {
  return STREAK_CONFIG.milestones.includes(streak);
}

/**
 * Get next streak milestone
 *
 * @param currentStreak - Current streak
 * @returns Next milestone or null if none
 *
 * @example
 * ```typescript
 * const next = getNextStreakMilestone(5);
 * console.log(`${7 - 5} days until next milestone!`);
 * ```
 */
export function getNextStreakMilestone(currentStreak: number): number | null {
  return STREAK_CONFIG.milestones.find((m) => m > currentStreak) ?? null;
}

/**
 * Calculate days until streak breaks
 *
 * @param lastVisitDate - Last check-in timestamp
 * @returns Days remaining (0 if already broken)
 *
 * @example
 * ```typescript
 * const daysLeft = daysUntilStreakBreaks(member.attendanceStats.lastVisitedAt);
 * if (daysLeft === 1) {
 *   // Send "visit today to maintain streak" notification
 * }
 * ```
 */
export function daysUntilStreakBreaks(
  lastVisitDate: Date | string | null | undefined
): number {
  if (!lastVisitDate) return 0;

  const now = new Date();
  const lastVisit = new Date(lastVisitDate);
  const hoursSinceVisit =
    (now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60);

  const hoursRemaining = STREAK_CONFIG.breakAfterHours - hoursSinceVisit;
  const daysRemaining = Math.ceil(hoursRemaining / 24);

  return Math.max(0, daysRemaining);
}

/**
 * Get streak status for display
 *
 * @param currentStreak - Current streak
 * @param longestStreak - Longest streak
 * @returns Status object for UI
 */
export function getStreakStatus(
  currentStreak: number,
  longestStreak: number
): {
  current: number;
  longest: number;
  isNewRecord: boolean;
  nextMilestone: number | null;
  isMilestone: boolean;
} {
  return {
    current: currentStreak,
    longest: longestStreak,
    isNewRecord: currentStreak > 0 && currentStreak >= longestStreak,
    nextMilestone: getNextStreakMilestone(currentStreak),
    isMilestone: isStreakMilestone(currentStreak),
  };
}

export default {
  calculateStreak,
  isStreakMilestone,
  getNextStreakMilestone,
  daysUntilStreakBreaks,
  getStreakStatus,
};

