/**
 * ClockIn Errors - Structured Error Hierarchy
 *
 * Follows Stripe/Auth0 error handling patterns:
 * - Machine-readable codes
 * - HTTP status codes
 * - Rich context data
 * - Proper stack traces
 *
 * @module @classytic/clockin/errors
 */

import type { ErrorCode } from '../types.js';

// ============================================================================
// BASE ERROR
// ============================================================================

/**
 * Base error class for all ClockIn errors
 *
 * @example
 * ```typescript
 * throw new ClockInError(
 *   'MEMBER_NOT_FOUND',
 *   404,
 *   'Member with ID abc123 not found'
 * );
 * ```
 */
export class ClockInError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly context: Record<string, unknown>;
  readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    status: number,
    message: string,
    context: Record<string, unknown> = {}
  ) {
    super(message);

    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.context = context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      error: {
        type: this.name,
        code: this.code,
        message: this.message,
        status: this.status,
        context: this.context,
        timestamp: this.timestamp.toISOString(),
      },
    };
  }

  /**
   * Check if error is operational (expected) vs programmer error
   */
  isOperational(): boolean {
    return true;
  }
}

// ============================================================================
// SPECIALIZED ERRORS
// ============================================================================

/**
 * Error thrown when ClockIn is not initialized
 */
export class NotInitializedError extends ClockInError {
  constructor(message = 'ClockIn is not initialized. Call initializeClockIn() first.') {
    super('NOT_INITIALIZED', 500, message);
  }
}

/**
 * Error thrown when member is not found
 */
export class MemberNotFoundError extends ClockInError {
  constructor(identifier?: string, context: Record<string, unknown> = {}) {
    const message = identifier
      ? `Member not found: ${identifier}`
      : 'Member not found';
    super('MEMBER_NOT_FOUND', 404, message, { identifier, ...context });
  }
}

/**
 * Error thrown when member is invalid for check-in
 */
export class InvalidMemberError extends ClockInError {
  constructor(reason: string, context: Record<string, unknown> = {}) {
    super('INVALID_MEMBER', 400, reason, context);
  }
}

/**
 * Error thrown for duplicate check-ins
 */
export class DuplicateCheckInError extends ClockInError {
  readonly lastCheckIn: Date;
  readonly nextAllowedTime: Date;

  constructor(
    lastCheckIn: Date,
    nextAllowedTime: Date,
    context: Record<string, unknown> = {}
  ) {
    const minutesSince = Math.floor(
      (Date.now() - lastCheckIn.getTime()) / (1000 * 60)
    );
    const message = `Already checked in ${minutesSince} minutes ago. Please wait until ${nextAllowedTime.toISOString()}.`;

    super('DUPLICATE_CHECK_IN', 429, message, {
      lastCheckIn: lastCheckIn.toISOString(),
      nextAllowedTime: nextAllowedTime.toISOString(),
      ...context,
    });

    this.lastCheckIn = lastCheckIn;
    this.nextAllowedTime = nextAllowedTime;
  }
}

/**
 * Error thrown for validation failures
 */
export class ValidationError extends ClockInError {
  readonly field?: string;
  readonly validValues?: unknown[];

  constructor(
    message: string,
    context: { field?: string; value?: unknown; validValues?: unknown[] } = {}
  ) {
    super('VALIDATION_ERROR', 400, message, context);
    this.field = context.field;
    this.validValues = context.validValues;
  }
}

/**
 * Error thrown when attendance is not enabled for member
 */
export class AttendanceNotEnabledError extends ClockInError {
  constructor(memberId?: string) {
    const message = memberId
      ? `Attendance tracking is disabled for member ${memberId}`
      : 'Attendance tracking is disabled for this member';
    super('ATTENDANCE_NOT_ENABLED', 403, message, { memberId });
  }
}

/**
 * Error thrown when no active session exists
 */
export class NoActiveSessionError extends ClockInError {
  constructor(memberId?: string, context: Record<string, unknown> = {}) {
    const message = memberId
      ? `No active check-in session for member ${memberId}`
      : 'No active check-in session found';
    super('NO_ACTIVE_SESSION', 404, message, { memberId, ...context });
  }
}

/**
 * Error thrown when member is already checked out
 */
export class AlreadyCheckedOutError extends ClockInError {
  constructor(checkInId?: string, context: Record<string, unknown> = {}) {
    const message = checkInId
      ? `Check-in ${checkInId} is already checked out`
      : 'Already checked out';
    super('ALREADY_CHECKED_OUT', 409, message, { checkInId, ...context });
  }
}

/**
 * Error thrown when target model is not in the allowed list
 */
export class TargetModelNotAllowedError extends ClockInError {
  readonly targetModel: string;
  readonly allowedModels: string[];

  constructor(
    targetModel: string,
    allowedModels: string[],
    context: Record<string, unknown> = {}
  ) {
    const message = `Target model "${targetModel}" is not allowed. Allowed models: ${allowedModels.join(', ')}`;
    super('TARGET_MODEL_NOT_ALLOWED', 400, message, {
      targetModel,
      allowedModels,
      ...context,
    });
    this.targetModel = targetModel;
    this.allowedModels = allowedModels;
  }
}

// ============================================================================
// ERROR FACTORY
// ============================================================================

/**
 * Create error from code
 */
export function createError(
  code: ErrorCode,
  message: string,
  context?: Record<string, unknown>
): ClockInError {
  const statusMap: Record<ErrorCode, number> = {
    ATTENDANCE_ERROR: 500,
    NOT_INITIALIZED: 500,
    MEMBER_NOT_FOUND: 404,
    INVALID_MEMBER: 400,
    DUPLICATE_CHECK_IN: 429,
    VALIDATION_ERROR: 400,
    ATTENDANCE_NOT_ENABLED: 403,
    NO_ACTIVE_SESSION: 404,
    ALREADY_CHECKED_OUT: 409,
    TARGET_MODEL_NOT_ALLOWED: 400,
  };

  return new ClockInError(code, statusMap[code] || 500, message, context);
}

/**
 * Check if error is a ClockInError
 */
export function isClockInError(error: unknown): error is ClockInError {
  return error instanceof ClockInError;
}

/**
 * Extract error info for logging/response
 */
export function extractErrorInfo(error: unknown): {
  code: string;
  status: number;
  message: string;
  context?: Record<string, unknown>;
} {
  if (isClockInError(error)) {
    return {
      code: error.code,
      status: error.status,
      message: error.message,
      context: error.context,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'ATTENDANCE_ERROR',
      status: 500,
      message: error.message,
    };
  }

  return {
    code: 'ATTENDANCE_ERROR',
    status: 500,
    message: String(error),
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  ClockInError,
  NotInitializedError,
  MemberNotFoundError,
  InvalidMemberError,
  DuplicateCheckInError,
  ValidationError,
  AttendanceNotEnabledError,
  NoActiveSessionError,
  AlreadyCheckedOutError,
  TargetModelNotAllowedError,
  createError,
  isClockInError,
  extractErrorInfo,
};

