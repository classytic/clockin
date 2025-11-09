/**
 * 🔥 Streak Calculator
 * Pure functions for calculating attendance streaks
 *
 * Extracted from check-in.manager.js for:
 * - Better testability
 * - Reusability
 * - Clean separation of concerns
 *
 * @module lib/attendance/utils/streak.calculator
 */

import { STREAK_CONFIG } from '../config.js';

/**
 * Calculate current and longest streak from check-in history
 *
 * Logic:
 * - A streak continues if member visited within last 24 hours
 * - Streak breaks if gap > 24 hours
 * - Returns both current and longest streak
 *
 * @param {Array} checkIns - Array of check-in timestamps (sorted newest first)
 * @returns {Object} { currentStreak, longestStreak }
 *
 * @example
 * calculateStreak([
 *   new Date('2025-11-01'),
 *   new Date('2025-10-31'),
 *   new Date('2025-10-30'),
 * ]);
 * // Returns: { currentStreak: 3, longestStreak: 3 }
 */
export function calculateStreak(checkIns) {
  if (!checkIns || checkIns.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Sort by timestamp descending (newest first)
  const sorted = [...checkIns].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  // Get unique days (one check-in per day counts)
  const uniqueDays = new Set();
  sorted.forEach(checkIn => {
    const day = new Date(checkIn.timestamp).toDateString();
    uniqueDays.add(day);
  });

  const days = Array.from(uniqueDays).map(day => new Date(day));
  days.sort((a, b) => b - a); // Sort descending

  if (days.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Calculate current streak
  let currentStreak = 1; // Start with first day
  const today = new Date();
  const todayStr = today.toDateString();
  const yesterdayStr = new Date(today.getTime() - 24 * 60 * 60 * 1000).toDateString();

  // Check if streak is still active
  const lastDayStr = days[0].toDateString();
  const isStreakActive = lastDayStr === todayStr || lastDayStr === yesterdayStr;

  if (!isStreakActive) {
    currentStreak = 0;
  } else {
    // Count consecutive days
    for (let i = 1; i < days.length; i++) {
      const diffMs = days[i - 1] - days[i];
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak++;
      } else {
        break; // Streak broken
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 1; i < days.length; i++) {
    const diffMs = days[i - 1] - days[i];
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
 * @param {Number} streak - Current streak value
 * @returns {Boolean} True if milestone reached
 *
 * @example
 * isStreakMilestone(7); // true (7-day milestone)
 * isStreakMilestone(8); // false
 */
export function isStreakMilestone(streak) {
  return STREAK_CONFIG.milestones.includes(streak);
}

/**
 * Get next streak milestone
 *
 * @param {Number} currentStreak - Current streak
 * @returns {Number|null} Next milestone or null if none
 *
 * @example
 * getNextStreakMilestone(5); // 7
 * getNextStreakMilestone(100); // 180
 */
export function getNextStreakMilestone(currentStreak) {
  const milestones = STREAK_CONFIG.milestones;
  return milestones.find(m => m > currentStreak) || null;
}

/**
 * Calculate days until streak breaks (for UI countdown)
 *
 * @param {Date} lastVisitDate - Last check-in timestamp
 * @returns {Number} Days remaining (0 if already broken)
 *
 * @example
 * daysUntilStreakBreaks(new Date('2025-11-01')); // 1 (if today is 2025-11-01)
 */
export function daysUntilStreakBreaks(lastVisitDate) {
  if (!lastVisitDate) return 0;

  const now = new Date();
  const lastVisit = new Date(lastVisitDate);
  const hoursSinceVisit = (now - lastVisit) / (1000 * 60 * 60);

  const hoursRemaining = STREAK_CONFIG.breakAfterHours - hoursSinceVisit;
  const daysRemaining = Math.ceil(hoursRemaining / 24);

  return Math.max(0, daysRemaining);
}

export default {
  calculateStreak,
  isStreakMilestone,
  getNextStreakMilestone,
  daysUntilStreakBreaks,
};
