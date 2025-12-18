/**
 * ClockIn Configuration
 *
 * Centralized configuration with sensible defaults.
 * All config is instance-scoped - no global state.
 *
 * @module @classytic/clockin/config
 */

import { STATS_CALCULATION_MODE, CHECK_IN_METHOD } from './enums.js';
import type {
  EngagementThresholds,
  StatsConfig,
  AggregationConfig,
  StreakConfig,
  CheckInRules,
  AnalyticsConfig,
  NotificationConfig,
  TargetModelConfig,
  DeepPartial,
  EngagementLevel,
} from './types.js';

// Re-export TargetModelConfig type
export type { TargetModelConfig } from './types.js';

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Engagement thresholds
 * Define visit counts for each engagement level
 */
export const ENGAGEMENT_THRESHOLDS: EngagementThresholds = {
  highlyActive: 12, // 12+ visits per month
  active: 8, // 8-11 visits per month
  regular: 4, // 4-7 visits per month
  occasional: 1, // 1-3 visits per month
  atRisk: {
    daysInactive: 14, // No visit in 14+ days
  },
  dormant: {
    daysInactive: 30, // No visit in 30+ days
  },
};

/**
 * Stats calculation configuration
 */
export const STATS_CONFIG: StatsConfig = {
  defaultMode: STATS_CALCULATION_MODE.PRE_CALCULATED,
  cacheDuration: 300, // 5 minutes
  autoUpdateStats: true,
  batchUpdateEnabled: true,
  batchSize: 100,
};

/**
 * Monthly aggregation configuration
 */
export const AGGREGATION_CONFIG: AggregationConfig = {
  maxCheckInsPerMonth: 1000,
  detailedHistoryMonths: 6,
  archiveAfterMonths: 24,
  compressArchived: true,
};

/**
 * Streak calculation configuration
 */
export const STREAK_CONFIG: StreakConfig = {
  minHoursBetweenVisits: 4,
  maxGapDays: 1,
  resetStreakAfterDays: 2,
  breakAfterHours: 48,
  milestones: [7, 14, 30, 60, 90, 180, 365],
};

/**
 * Check-in validation rules
 */
export const CHECK_IN_RULES: CheckInRules = {
  duplicatePreventionMinutes: 5,
  earlyCheckInMinutes: 30,
  lateCheckInMinutes: 15,
  minimumTimeBetweenCheckIns: 4, // hours
};

/**
 * Analytics configuration
 */
export const ANALYTICS_CONFIG: AnalyticsConfig = {
  peakHoursThreshold: 0.7,
  trendingPeriodDays: 30,
  forecastDays: 7,
  dashboardRefreshSeconds: 60,
};

/**
 * Notification configuration
 */
export const NOTIFICATION_CONFIG: NotificationConfig = {
  streakMilestones: [7, 14, 30, 60, 90, 180, 365],
  inactivityAlertDays: 7,
  visitMilestones: [10, 25, 50, 100, 250, 500, 1000],
};

/**
 * Default check-in method
 */
export const DEFAULT_CHECK_IN_METHOD = CHECK_IN_METHOD.MANUAL;

/**
 * Default record TTL in days
 */
export const DEFAULT_RECORD_TTL_DAYS = 730; // 2 years

// ============================================================================
// TARGET MODEL CONFIGURATIONS
// ============================================================================

/**
 * Container interface for type-safe access
 */
interface ConfigContainer {
  has(key: string): boolean;
  get<T>(key: string): T;
}

/**
 * Generate smart default config based on entity type.
 *
 * Built-in models (Employee, Membership, etc.) get optimized defaults.
 * Custom models get sensible time-based defaults.
 */
export function generateDefaultConfig(targetModel: string): TargetModelConfig {
  const isEmployee = targetModel === 'Employee';

  return {
    targetModel,
    detection: {
      type: isEmployee ? 'schedule-aware' : 'time-based',
      scheduleSource: isEmployee ? 'workSchedule' : null,
      rules: {
        thresholds: isEmployee
          ? { overtime: 1.1, fullDay: 0.75, halfDay: 0.4, unpaid: 0.4 }
          : { overtime: 10, fullDay: 1, minimal: 0.5 },
        fallback: isEmployee
          ? { standardHours: 8, overtime: 9, fullDay: 6, halfDay: 3 }
          : undefined,
        defaultType: 'full_day',
      },
      timeHints: isEmployee ? { morningCutoff: 12, afternoonStart: 11 } : null,
    },
    autoCheckout: {
      enabled: true,
      afterHours: isEmployee ? 9 : 6,
      maxSession: 12,
    },
    validation: {
      enforceSchedule: isEmployee,
      allowWeekends: !isEmployee,
      gracePeriod: isEmployee ? 1 : 0,
      warnOnly: true,
    },
  };
}

/**
 * Get configuration for a target model.
 *
 * Looks up config from the container's registry, falling back to smart defaults.
 * All config is instance-scoped - no global state.
 *
 * @param targetModel - Entity type (Membership, Employee, etc.)
 * @param container - Container with instance-specific config
 * @returns Configuration object
 */
export function getConfig(targetModel: string, container?: ConfigContainer): TargetModelConfig {
  if (!container) {
    return generateDefaultConfig(targetModel);
  }

  // Check instance registry
  if (container.has('configRegistry')) {
    const registry = container.get<Map<string, TargetModelConfig>>('configRegistry');
    if (registry.has(targetModel)) {
      return registry.get(targetModel)!;
    }
  }

  // Generate defaults and cache in registry
  const defaultConfig = generateDefaultConfig(targetModel);

  if (container.has('configRegistry')) {
    const registry = container.get<Map<string, TargetModelConfig>>('configRegistry');
    registry.set(targetModel, defaultConfig);
  }

  return defaultConfig;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Deep merge two objects
 */
export function deepMerge<T>(target: T, source: DeepPartial<T>): T {
  const result = { ...target } as T & Record<string, unknown>;

  for (const key in source) {
    const sourceValue = (source as Record<string, unknown>)[key];
    const targetValue = (result as Record<string, unknown>)[key];

    if (
      sourceValue !== undefined &&
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as DeepPartial<Record<string, unknown>>
      );
    } else if (sourceValue !== undefined) {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return result as T;
}

/**
 * Get engagement level from visit count
 */
export function getEngagementLevelFromVisits(visitsThisMonth: number): EngagementLevel {
  if (visitsThisMonth >= ENGAGEMENT_THRESHOLDS.highlyActive) return 'highly_active';
  if (visitsThisMonth >= ENGAGEMENT_THRESHOLDS.active) return 'active';
  if (visitsThisMonth >= ENGAGEMENT_THRESHOLDS.regular) return 'regular';
  if (visitsThisMonth >= ENGAGEMENT_THRESHOLDS.occasional) return 'occasional';
  return 'inactive';
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  ENGAGEMENT_THRESHOLDS,
  STATS_CONFIG,
  AGGREGATION_CONFIG,
  STREAK_CONFIG,
  CHECK_IN_RULES,
  ANALYTICS_CONFIG,
  NOTIFICATION_CONFIG,
  DEFAULT_CHECK_IN_METHOD,
  DEFAULT_RECORD_TTL_DAYS,
  getConfig,
  generateDefaultConfig,
  deepMerge,
  getEngagementLevelFromVisits,
};
