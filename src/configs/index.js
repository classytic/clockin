/**
 * 📋 Smart Attendance Configuration
 * Single source of truth - generates configs on-the-fly
 *
 * Pattern: Smart defaults with override capability
 * - Configs generated based on entity type (Employee vs Membership)
 * - Ultra-lean: No duplication, minimal code
 * - Apps can still override during initialization
 *
 * @module lib/attendance/configs
 */

/**
 * Configuration registry (runtime mutable)
 */
const CONFIGS = new Map();

/**
 * Generate smart default config based on entity type
 * @param {String} targetModel - Entity type
 * @returns {Object} Configuration
 */
function generateDefaultConfig(targetModel) {
  const isEmployee = targetModel === 'Employee';

  return {
    targetModel,
    detection: {
      type: isEmployee ? 'schedule-aware' : 'time-based',
      scheduleSource: isEmployee ? 'workSchedule' : null,
      rules: {
        thresholds: isEmployee
          ? { overtime: 1.1, fullDay: 0.75, halfDay: 0.4, unpaid: 0.4 }  // percentage-based
          : { overtime: 10, fullDay: 1, minimal: 0.5 },                   // hours-based
        fallback: isEmployee ? { standardHours: 8, overtime: 9, fullDay: 6, halfDay: 3 } : null,
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
 * Get configuration for a target model
 * Auto-generates if not registered (smart defaults)
 *
 * @param {String} targetModel - Entity type (Membership, Employee, etc.)
 * @returns {Object} Configuration object
 */
export function getConfig(targetModel) {
  // Return custom config if registered
  if (CONFIGS.has(targetModel)) {
    return CONFIGS.get(targetModel);
  }

  // Auto-generate smart default
  const defaultConfig = generateDefaultConfig(targetModel);
  CONFIGS.set(targetModel, defaultConfig);

  return defaultConfig;
}

/**
 * Register or override a configuration
 *
 * @param {String} targetModel - Entity type
 * @param {Object} config - Configuration object
 *
 * @example Override defaults
 * const customConfig = getConfig('Employee');
 * customConfig.detection.rules.thresholds.overtime = 1.2;
 * registerConfig('Employee', customConfig);
 */
export function registerConfig(targetModel, config) {
  if (!config || typeof config !== 'object') {
    throw new Error(`Invalid config for ${targetModel}`);
  }
  CONFIGS.set(targetModel, config);
}

/**
 * Check if a target model has a custom config
 * @param {String} targetModel - Entity type
 * @returns {Boolean}
 */
export function hasConfig(targetModel) {
  return CONFIGS.has(targetModel);
}

/**
 * Get all registered models
 * @returns {Array<String>}
 */
export function getRegisteredModels() {
  return Array.from(CONFIGS.keys());
}

export default {
  getConfig,
  registerConfig,
  hasConfig,
  getRegisteredModels,
};
