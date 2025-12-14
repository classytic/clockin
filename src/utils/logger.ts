/**
 * Logger Utility
 *
 * Injectable logger for ClockIn operations
 * Defaults to console, but can be replaced with any logger (pino, winston, etc.)
 *
 * @module @classytic/clockin/utils/logger
 */

import type { Logger } from '../types.js';

/**
 * Default console logger
 */
const defaultLogger: Logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(`[ClockIn] INFO: ${message}`, meta || '');
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(`[ClockIn] ERROR: ${message}`, meta || '');
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(`[ClockIn] WARN: ${message}`, meta || '');
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
      console.debug(`[ClockIn] DEBUG: ${message}`, meta || '');
    }
  },
};

/**
 * Current logger instance
 */
let currentLogger: Logger = defaultLogger;

/**
 * Get the current logger
 */
export function getLogger(): Logger {
  return currentLogger;
}

/**
 * Set a custom logger
 *
 * @param logger - Custom logger instance (pino, winston, etc.)
 *
 * @example
 * ```typescript
 * import pino from 'pino';
 * import { setLogger } from '@classytic/clockin';
 *
 * setLogger(pino({ name: 'clockin' }));
 * ```
 */
export function setLogger(logger: Logger): void {
  currentLogger = logger;
}

/**
 * Reset to default logger
 */
export function resetLogger(): void {
  currentLogger = defaultLogger;
}

/**
 * Create a child logger with prefix
 */
export function createChildLogger(prefix: string): Logger {
  return {
    info: (message, meta) => currentLogger.info(`[${prefix}] ${message}`, meta),
    error: (message, meta) => currentLogger.error(`[${prefix}] ${message}`, meta),
    warn: (message, meta) => currentLogger.warn(`[${prefix}] ${message}`, meta),
    debug: (message, meta) => currentLogger.debug(`[${prefix}] ${message}`, meta),
  };
}

// Export default logger instance
export default currentLogger;

