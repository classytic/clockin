/**
 * 🚀 ATTENDANCE FRAMEWORK INITIALIZATION
 * Call this ONCE in your app bootstrap
 *
 * Pattern: Next-Auth / Stripe style initialization
 * - Library provides sensible defaults (convention over configuration)
 * - Apps can override configs during bootstrap (customization when needed)
 * - Clean separation: lib = reusable logic, app = business rules
 *
 * Basic Usage (uses library defaults):
 * ```javascript
 * // bootstrap/attendance.js
 * import { initializeAttendance } from '#lib/attendance';
 * import Attendance from '#lib/attendance/models/attendance.model.js';
 *
 * initializeAttendance({ AttendanceModel: Attendance });
 * ```
 *
 * Advanced Usage (custom configs per module):
 * ```javascript
 * // bootstrap/attendance.js
 * import { initializeAttendance, EMPLOYEE_CONFIG, MEMBERSHIP_CONFIG } from '#lib/attendance';
 * import Attendance from '#lib/attendance/models/attendance.model.js';
 * import { memberAttendanceConfig } from '#config/attendance/member.config.js';
 * import { employeeAttendanceConfig } from '#config/attendance/employee.config.js';
 *
 * initializeAttendance({
 *   AttendanceModel: Attendance,
 *   configs: {
 *     Membership: memberAttendanceConfig,    // Custom member rules
 *     Employee: employeeAttendanceConfig,    // Custom employee rules
 *   }
 * });
 * ```
 *
 * After initialization, all modules can use the orchestrator:
 * ```javascript
 * import { attendance } from '#lib/attendance';
 *
 * await attendance.checkIn({ member, targetModel: 'Membership', data, context });
 * const dashboard = await attendance.dashboard({ organizationId, MemberModel });
 * ```
 *
 * @module lib/attendance/init
 */

import { attendance } from './attendance.orchestrator.js';
import { registerConfig, getConfig } from './configs/index.js';
import logger, { setLogger } from './utils/logger.js';

let _initialized = false;

/**
 * Initialize attendance framework globally
 * MUST be called once at app bootstrap
 *
 * @param {Object} options - Initialization options
 * @param {Model} options.AttendanceModel - Your Attendance model (required)
 * @param {Object} options.configs - Custom configs per target model (optional)
 * @param {Object} options.logger - Optional custom logger (pino, winston, etc)
 * @throws {Error} If called multiple times or with invalid config
 *
 * @example Basic (uses library defaults)
 * initializeAttendance({ AttendanceModel: Attendance });
 *
 * @example Advanced (custom configs)
 * initializeAttendance({
 *   AttendanceModel: Attendance,
 *   configs: {
 *     Membership: myMembershipConfig,
 *     Employee: myEmployeeConfig,
 *   }
 * });
 */
export function initializeAttendance({ AttendanceModel, configs = null, logger: customLogger }) {
  // Allow users to inject their own logger
  if (customLogger) {
    setLogger(customLogger);
  }

  // Prevent double initialization
  if (_initialized) {
    logger.warn('Attendance Framework already initialized. Skipping duplicate initialization.');
    return;
  }

  // Validate required dependencies
  if (!AttendanceModel) {
    const error = new Error(
      'AttendanceModel is required. Usage: initializeAttendance({ AttendanceModel: Attendance })'
    );
    logger.error('Attendance initialization failed', { error: error.message });
    throw error;
  }

  // Register custom configs if provided
  if (configs) {
    for (const [targetModel, config] of Object.entries(configs)) {
      registerConfig(targetModel, config);
    }
    logger.info('Registered custom configs', {
      models: Object.keys(configs)
    });
  }

  // Configure global orchestrator
  attendance.configure({ AttendanceModel });

  _initialized = true;
  logger.info('Attendance Framework initialized', {
    entities: ['Membership', 'Employee'],
    mode: configs ? 'custom' : 'auto (smart defaults)'
  });
}

/**
 * Check if framework is initialized
 * Useful for testing and debugging
 */
export function isInitialized() {
  return _initialized;
}

/**
 * Reset initialization state
 * ONLY for testing purposes
 * @private
 */
export function _resetForTesting() {
  _initialized = false;
  logger.warn('Attendance Framework reset (testing only)');
}

export default initializeAttendance;

