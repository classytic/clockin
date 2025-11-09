/**
 * 🚨 Attendance Error - Base Class
 * Custom error hierarchy for attendance library
 *
 * Inspired by Stripe/Auth0 error handling patterns
 *
 * @module lib/attendance/errors/AttendanceError
 */

/**
 * Base error class for all attendance-related errors
 *
 * Features:
 * - Structured error codes (machine-readable)
 * - HTTP status codes (API-ready)
 * - Additional context data
 * - Stack trace preservation
 *
 * @example
 * throw new AttendanceError(
 *   'member_not_found',
 *   404,
 *   'Member with ID abc123 not found'
 * );
 */
export class AttendanceError extends Error {
  constructor(code, statusCode, message, context = {}) {
    super(message);

    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON() {
    return {
      error: {
        type: this.name,
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        context: this.context,
        timestamp: this.timestamp,
      },
    };
  }

  /**
   * Check if error is operational (expected) vs programmer error
   */
  isOperational() {
    return true; // All attendance errors are operational
  }
}

export default AttendanceError;
