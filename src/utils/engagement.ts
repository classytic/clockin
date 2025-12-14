/**
 * Engagement Calculator
 *
 * Pure functions for calculating member engagement levels
 *
 * @module @classytic/clockin/utils/engagement
 */

import { ENGAGEMENT_THRESHOLDS } from '../config.js';
import { ENGAGEMENT_LEVEL } from '../enums.js';
import type { EngagementLevel, AttendanceStats } from '../types.js';

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
 * @param thisMonthVisits - Visits this month
 * @param lastVisitedAt - Last check-in timestamp
 * @returns Engagement level
 */
export function calculateEngagementLevel(
  thisMonthVisits = 0,
  lastVisitedAt: Date | string | null | undefined = null
): EngagementLevel {
  // Check time-based engagement first (at-risk, dormant)
  if (lastVisitedAt) {
    const daysSinceLastVisit = calculateDaysSinceLastVisit(lastVisitedAt);

    if (daysSinceLastVisit >= ENGAGEMENT_THRESHOLDS.dormant.daysInactive) {
      return ENGAGEMENT_LEVEL.DORMANT;
    }

    if (daysSinceLastVisit >= ENGAGEMENT_THRESHOLDS.atRisk.daysInactive) {
      return ENGAGEMENT_LEVEL.AT_RISK;
    }
  } else {
    // No last visit = dormant
    return ENGAGEMENT_LEVEL.DORMANT;
  }

  // Check frequency-based engagement
  if (thisMonthVisits >= ENGAGEMENT_THRESHOLDS.highlyActive) {
    return ENGAGEMENT_LEVEL.HIGHLY_ACTIVE;
  }

  if (thisMonthVisits >= ENGAGEMENT_THRESHOLDS.active) {
    return ENGAGEMENT_LEVEL.ACTIVE;
  }

  if (thisMonthVisits >= ENGAGEMENT_THRESHOLDS.regular) {
    return ENGAGEMENT_LEVEL.REGULAR;
  }

  if (thisMonthVisits >= ENGAGEMENT_THRESHOLDS.occasional) {
    return ENGAGEMENT_LEVEL.OCCASIONAL;
  }

  return ENGAGEMENT_LEVEL.INACTIVE;
}

/**
 * Calculate days since last visit
 *
 * @param lastVisitedAt - Last check-in timestamp
 * @returns Days since last visit
 */
export function calculateDaysSinceLastVisit(
  lastVisitedAt: Date | string | null | undefined
): number {
  if (!lastVisitedAt) return Infinity;

  const now = new Date();
  const lastVisit = new Date(lastVisitedAt);
  const diffMs = now.getTime() - lastVisit.getTime();
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
 * @param stats - Attendance stats
 * @returns Score 0-100
 */
export function calculateLoyaltyScore(stats: Partial<AttendanceStats> = {}): number {
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
 * @param date - Start date
 * @returns Months since date
 */
export function calculateMonthsSince(
  date: Date | string | null | undefined
): number {
  if (!date) return 0;

  const now = new Date();
  const start = new Date(date);

  const yearsDiff = now.getFullYear() - start.getFullYear();
  const monthsDiff = now.getMonth() - start.getMonth();

  return Math.max(0, yearsDiff * 12 + monthsDiff);
}

/**
 * Check if engagement level changed
 *
 * @param previousLevel - Previous engagement level
 * @param currentLevel - Current engagement level
 * @returns Whether changed
 */
export function hasEngagementChanged(
  previousLevel: EngagementLevel | undefined,
  currentLevel: EngagementLevel
): boolean {
  return previousLevel !== currentLevel;
}

/**
 * Get engagement severity for alerting
 *
 * @param level - Engagement level
 * @returns Severity: 'critical' | 'warning' | 'good' | 'excellent'
 */
export function getEngagementSeverity(
  level: EngagementLevel
): 'critical' | 'warning' | 'good' | 'excellent' {
  const severityMap: Record<EngagementLevel, 'critical' | 'warning' | 'good' | 'excellent'> = {
    dormant: 'critical',
    at_risk: 'warning',
    inactive: 'warning',
    occasional: 'good',
    regular: 'good',
    active: 'excellent',
    highly_active: 'excellent',
  };

  return severityMap[level];
}

/**
 * Get engagement color for UI
 *
 * @param level - Engagement level
 * @returns CSS color class or hex color
 */
export function getEngagementColor(
  level: EngagementLevel
): string {
  const colorMap: Record<EngagementLevel, string> = {
    highly_active: '#22c55e', // green-500
    active: '#84cc16', // lime-500
    regular: '#eab308', // yellow-500
    occasional: '#f97316', // orange-500
    inactive: '#ef4444', // red-500
    at_risk: '#dc2626', // red-600
    dormant: '#991b1b', // red-800
  };

  return colorMap[level];
}

/**
 * Get engagement display text
 *
 * @param level - Engagement level
 * @returns Human-readable text
 */
export function getEngagementDisplayText(level: EngagementLevel): string {
  const textMap: Record<EngagementLevel, string> = {
    highly_active: 'Highly Active',
    active: 'Active',
    regular: 'Regular',
    occasional: 'Occasional',
    inactive: 'Inactive',
    at_risk: 'At Risk',
    dormant: 'Dormant',
  };

  return textMap[level];
}

export default {
  calculateEngagementLevel,
  calculateDaysSinceLastVisit,
  calculateLoyaltyScore,
  calculateMonthsSince,
  hasEngagementChanged,
  getEngagementSeverity,
  getEngagementColor,
  getEngagementDisplayText,
};

