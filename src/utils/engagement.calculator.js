/**
 * 🎯 Engagement Calculator
 * Pure functions for calculating member engagement levels
 *
 * @module lib/attendance/utils/engagement.calculator
 */

import { ENGAGEMENT_LEVEL, ENGAGEMENT_THRESHOLDS } from '../config.js';

/**
 * Calculate engagement level from visit counts
 *
 * Logic:
 * - Highly Active: 12+ visits/month
 * - Active: 8-11 visits/month
 * - Regular: 4-7 visits/month
 * - Occasional: 1-3 visits/month
 * - Inactive: 0 visits this month
 * - At Risk: No visit in 14+ days
 * - Dormant: No visit in 30+ days
 *
 * @param {Number} thisMonthVisits - Visits this month
 * @param {Date} lastVisitedAt - Last check-in timestamp
 * @returns {String} Engagement level
 *
 * @example
 * calculateEngagementLevel(15, new Date()); // 'highly_active'
 * calculateEngagementLevel(0, null); // 'inactive'
 */
export function calculateEngagementLevel(thisMonthVisits = 0, lastVisitedAt = null) {
  // Check time-based engagement first (at-risk, dormant)
  if (lastVisitedAt) {
    const daysSinceLastVisit = calculateDaysSinceLastVisit(lastVisitedAt);

    if (daysSinceLastVisit >= ENGAGEMENT_THRESHOLDS.dormant.daysInactive) {
      return ENGAGEMENT_LEVEL.DORMANT;
    }

    if (daysSinceLastVisit >= ENGAGEMENT_THRESHOLDS.atRisk.daysInactive) {
      return ENGAGEMENT_LEVEL.AT_RISK;
    }
  }

  // Check frequency-based engagement
  if (thisMonthVisits >= ENGAGEMENT_THRESHOLDS.highlyActive) {
    return ENGAGEMENT_LEVEL.HIGHLY_ACTIVE;
  }

  if (thisMonthVisits >= ENGAGEMENT_THRESHOLDS.active.min) {
    return ENGAGEMENT_LEVEL.ACTIVE;
  }

  if (thisMonthVisits >= ENGAGEMENT_THRESHOLDS.regular.min) {
    return ENGAGEMENT_LEVEL.REGULAR;
  }

  if (thisMonthVisits >= ENGAGEMENT_THRESHOLDS.occasional.min) {
    return ENGAGEMENT_LEVEL.OCCASIONAL;
  }

  return ENGAGEMENT_LEVEL.INACTIVE;
}

/**
 * Calculate days since last visit
 *
 * @param {Date} lastVisitedAt - Last check-in timestamp
 * @returns {Number} Days since last visit
 */
export function calculateDaysSinceLastVisit(lastVisitedAt) {
  if (!lastVisitedAt) return Infinity;

  const now = new Date();
  const lastVisit = new Date(lastVisitedAt);
  const diffMs = now - lastVisit;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Calculate loyalty score (0-100)
 *
 * Based on multiple factors:
 * - Total visits (weight: 40%)
 * - Current streak (weight: 30%)
 * - Monthly consistency (weight: 20%)
 * - Tenure (weight: 10%)
 *
 * @param {Object} stats - Attendance stats
 * @returns {Number} Score 0-100
 *
 * @example
 * calculateLoyaltyScore({
 *   totalVisits: 100,
 *   currentStreak: 30,
 *   monthlyAverage: 12,
 *   firstVisitedAt: new Date('2024-01-01')
 * });
 * // Returns: 85
 */
export function calculateLoyaltyScore(stats = {}) {
  const {
    totalVisits = 0,
    currentStreak = 0,
    monthlyAverage = 0,
    firstVisitedAt = null,
  } = stats;

  // Visit score (0-40 points, capped at 200 visits)
  const visitScore = Math.min((totalVisits / 200) * 40, 40);

  // Streak score (0-30 points, capped at 90 days)
  const streakScore = Math.min((currentStreak / 90) * 30, 30);

  // Consistency score (0-20 points, based on monthly average)
  const consistencyScore = Math.min((monthlyAverage / 15) * 20, 20);

  // Tenure score (0-10 points, capped at 2 years)
  let tenureScore = 0;
  if (firstVisitedAt) {
    const monthsSinceFirst = calculateMonthsSince(firstVisitedAt);
    tenureScore = Math.min((monthsSinceFirst / 24) * 10, 10);
  }

  const totalScore = visitScore + streakScore + consistencyScore + tenureScore;

  return Math.round(Math.min(totalScore, 100));
}

/**
 * Calculate months since date
 *
 * @param {Date} date - Start date
 * @returns {Number} Months since date
 */
export function calculateMonthsSince(date) {
  if (!date) return 0;

  const now = new Date();
  const start = new Date(date);

  const yearsDiff = now.getFullYear() - start.getFullYear();
  const monthsDiff = now.getMonth() - start.getMonth();

  return yearsDiff * 12 + monthsDiff;
}

/**
 * Check if engagement level changed
 *
 * @param {String} previousLevel - Previous engagement level
 * @param {String} currentLevel - Current engagement level
 * @returns {Boolean} True if changed
 */
export function hasEngagementChanged(previousLevel, currentLevel) {
  return previousLevel !== currentLevel;
}

/**
 * Get engagement severity (for alerting)
 *
 * @param {String} level - Engagement level
 * @returns {String} 'critical' | 'warning' | 'good' | 'excellent'
 */
export function getEngagementSeverity(level) {
  const severityMap = {
    [ENGAGEMENT_LEVEL.DORMANT]: 'critical',
    [ENGAGEMENT_LEVEL.AT_RISK]: 'warning',
    [ENGAGEMENT_LEVEL.INACTIVE]: 'warning',
    [ENGAGEMENT_LEVEL.OCCASIONAL]: 'good',
    [ENGAGEMENT_LEVEL.REGULAR]: 'good',
    [ENGAGEMENT_LEVEL.ACTIVE]: 'excellent',
    [ENGAGEMENT_LEVEL.HIGHLY_ACTIVE]: 'excellent',
  };

  return severityMap[level] || 'good';
}

export default {
  calculateEngagementLevel,
  calculateDaysSinceLastVisit,
  calculateLoyaltyScore,
  calculateMonthsSince,
  hasEngagementChanged,
  getEngagementSeverity,
};
