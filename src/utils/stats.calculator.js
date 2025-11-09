/**
 * 📊 Stats Calculator
 * Pure functions for calculating attendance statistics
 *
 * @module lib/attendance/utils/stats.calculator
 */

import { calculateStreak } from './streak.calculator.js';
import { calculateEngagementLevel, calculateLoyaltyScore, calculateDaysSinceLastVisit } from './engagement.calculator.js';
import { getTimeSlot } from '../enums.js';

/**
 * Calculate all attendance stats from raw data
 *
 * This is the main stats calculation function used during check-in
 * and stats recalculation.
 *
 * @param {Object} params
 * @param {Array} params.allCheckIns - All check-ins for this member
 * @param {Array} params.thisMonthCheckIns - This month's check-ins
 * @param {Array} params.lastMonthCheckIns - Last month's check-ins
 * @returns {Object} Complete stats object
 *
 * @example
 * const stats = calculateAttendanceStats({
 *   allCheckIns: [...],
 *   thisMonthCheckIns: [...],
 *   lastMonthCheckIns: [...]
 * });
 */
export function calculateAttendanceStats({
  allCheckIns = [],
  thisMonthCheckIns = [],
  lastMonthCheckIns = [],
}) {
  // Basic counts
  const totalVisits = allCheckIns.length;
  const thisMonthVisits = thisMonthCheckIns.length;
  const lastMonthVisits = lastMonthCheckIns.length;

  // Timestamps
  const lastVisitedAt = allCheckIns.length > 0
    ? new Date(allCheckIns[0].timestamp)
    : null;

  const firstVisitedAt = allCheckIns.length > 0
    ? new Date(allCheckIns[allCheckIns.length - 1].timestamp)
    : null;

  // Streaks
  const { currentStreak, longestStreak } = calculateStreak(allCheckIns);

  // Monthly average (total visits / months since first visit)
  let monthlyAverage = 0;
  if (firstVisitedAt) {
    const monthsSinceFirst = calculateMonthsSinceDate(firstVisitedAt);
    monthlyAverage = monthsSinceFirst > 0
      ? Math.round((totalVisits / monthsSinceFirst) * 10) / 10
      : thisMonthVisits;
  }

  // Engagement level
  const engagementLevel = calculateEngagementLevel(thisMonthVisits, lastVisitedAt);

  // Days since last visit
  const daysSinceLastVisit = calculateDaysSinceLastVisit(lastVisitedAt);

  // Favorite time slot
  const favoriteTimeSlot = calculateFavoriteTimeSlot(allCheckIns);

  // Loyalty score
  const loyaltyScore = calculateLoyaltyScore({
    totalVisits,
    currentStreak,
    monthlyAverage,
    firstVisitedAt,
  });

  return {
    totalVisits,
    lastVisitedAt,
    firstVisitedAt,
    currentStreak,
    longestStreak,
    monthlyAverage,
    thisMonthVisits,
    lastMonthVisits,
    engagementLevel,
    daysSinceLastVisit,
    favoriteTimeSlot,
    loyaltyScore,
    updatedAt: new Date(),
  };
}

/**
 * Calculate months since a date
 *
 * @param {Date} date - Start date
 * @returns {Number} Number of months (minimum 1)
 */
function calculateMonthsSinceDate(date) {
  const now = new Date();
  const start = new Date(date);

  const yearsDiff = now.getFullYear() - start.getFullYear();
  const monthsDiff = now.getMonth() - start.getMonth();

  return Math.max(1, yearsDiff * 12 + monthsDiff);
}

/**
 * Calculate favorite time slot from check-in history
 *
 * @param {Array} checkIns - All check-ins
 * @returns {String|null} Most common time slot
 *
 * @example
 * calculateFavoriteTimeSlot(checkIns); // 'morning'
 */
function calculateFavoriteTimeSlot(checkIns) {
  if (!checkIns || checkIns.length === 0) return null;

  // Count occurrences of each time slot
  const slotCounts = {};

  checkIns.forEach(checkIn => {
    const slot = checkIn.timeSlot || getTimeSlot(new Date(checkIn.timestamp));
    slotCounts[slot] = (slotCounts[slot] || 0) + 1;
  });

  // Find most common
  let maxCount = 0;
  let favoriteSlot = null;

  for (const [slot, count] of Object.entries(slotCounts)) {
    if (count > maxCount) {
      maxCount = count;
      favoriteSlot = slot;
    }
  }

  return favoriteSlot;
}

/**
 * Calculate attendance growth rate
 *
 * Compares this month vs last month
 *
 * @param {Number} thisMonth - This month's visits
 * @param {Number} lastMonth - Last month's visits
 * @returns {Number} Growth percentage (-100 to +Infinity)
 *
 * @example
 * calculateGrowthRate(12, 10); // 20 (20% growth)
 * calculateGrowthRate(8, 10); // -20 (20% decline)
 */
export function calculateGrowthRate(thisMonth, lastMonth) {
  if (lastMonth === 0) {
    return thisMonth > 0 ? 100 : 0;
  }

  const growth = ((thisMonth - lastMonth) / lastMonth) * 100;
  return Math.round(growth * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate visit milestones reached
 *
 * @param {Number} totalVisits - Total visits
 * @param {Array} milestones - Milestone thresholds [10, 25, 50, ...]
 * @returns {Array} Array of achieved milestones
 *
 * @example
 * calculateMilestonesReached(55, [10, 25, 50, 100]);
 * // Returns: [10, 25, 50]
 */
export function calculateMilestonesReached(totalVisits, milestones = [10, 25, 50, 100, 250, 500, 1000]) {
  return milestones.filter(milestone => totalVisits >= milestone);
}

/**
 * Get next visit milestone
 *
 * @param {Number} totalVisits - Current total visits
 * @param {Array} milestones - Milestone thresholds
 * @returns {Number|null} Next milestone or null
 *
 * @example
 * getNextMilestone(55, [10, 25, 50, 100]); // 100
 */
export function getNextMilestone(totalVisits, milestones = [10, 25, 50, 100, 250, 500, 1000]) {
  return milestones.find(m => m > totalVisits) || null;
}

export default {
  calculateAttendanceStats,
  calculateGrowthRate,
  calculateMilestonesReached,
  getNextMilestone,
};
