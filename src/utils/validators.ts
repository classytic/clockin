/**
 * Validators
 *
 * Reusable validation functions for attendance operations
 *
 * @module @classytic/clockin/utils/validators
 */

import {
  CHECK_IN_METHOD_VALUES,
  BUILT_IN_TARGET_MODEL_VALUES,
} from '../enums.js';
import { CHECK_IN_RULES } from '../config.js';
import {
  ValidationError,
  InvalidMemberError,
  AttendanceNotEnabledError,
  DuplicateCheckInError,
} from '../errors/index.js';
import type {
  AttendanceTargetModel,
  CheckInMethod,
  ValidationResult,
  ClockInMember,
  ObjectIdLike,
} from '../types.js';

/**
 * Validate check-in eligibility
 *
 * Checks:
 * - Member exists
 * - Membership is active
 * - Attendance is enabled
 * - Not already checked in recently
 *
 * @param member - Member document
 * @returns Validation result
 */
export function validateCheckInEligibility<T extends Partial<ClockInMember>>(
  member: T | null | undefined
): ValidationResult {
  if (!member) {
    return { valid: false, error: 'Member not found' };
  }

  // Check if attendance is enabled
  if (member.attendanceEnabled === false) {
    return {
      valid: false,
      error: 'Attendance tracking is disabled for this member',
    };
  }

  // Check membership status (if applicable)
  if (member.status && !['active', 'pending'].includes(member.status)) {
    return {
      valid: false,
      error: `Membership is ${member.status}. Only active or pending memberships can check in.`,
    };
  }

  return { valid: true };
}

/**
 * Validate check-in timing (duplicate prevention)
 *
 * @param lastCheckIn - Last check-in timestamp
 * @returns Validation result with next allowed time
 */
export function validateCheckInTiming(
  lastCheckIn: Date | string | null | undefined
): ValidationResult {
  if (!lastCheckIn) {
    return { valid: true };
  }

  const lastCheckInDate = new Date(lastCheckIn);
  const minutesSinceLastCheckIn =
    (Date.now() - lastCheckInDate.getTime()) / (1000 * 60);

  if (minutesSinceLastCheckIn < CHECK_IN_RULES.duplicatePreventionMinutes) {
    const nextAllowedTime = new Date(
      lastCheckInDate.getTime() +
        CHECK_IN_RULES.duplicatePreventionMinutes * 60 * 1000
    );

    return {
      valid: false,
      error: `Already checked in ${Math.floor(minutesSinceLastCheckIn)} minutes ago. Please wait ${CHECK_IN_RULES.duplicatePreventionMinutes} minutes between check-ins.`,
      lastCheckIn: lastCheckInDate,
      nextAllowedTime,
    };
  }

  return { valid: true };
}

/**
 * Configuration for target model validation
 */
export interface TargetModelValidationConfig {
  /**
   * Allowed target models. If empty/undefined, any non-empty string is accepted.
   * @default undefined (allow any)
   */
  allowedTargetModels?: string[];
}

/**
 * Validate target model.
 *
 * As of v2.0, this function supports custom target models via allowlist configuration.
 * If no allowlist is configured, any non-empty string is accepted.
 *
 * @param targetModel - Model name
 * @param config - Optional validation config with allowlist
 * @throws ValidationError if model is empty or not in allowlist (when configured)
 *
 * @example
 * ```typescript
 * // Allow any target model (default behavior)
 * validateTargetModel('CustomEvent');
 *
 * // Restrict to specific models
 * validateTargetModel('CustomEvent', {
 *   allowedTargetModels: ['Membership', 'Employee', 'CustomEvent']
 * });
 * ```
 */
export function validateTargetModel(
  targetModel: string | undefined,
  config: TargetModelValidationConfig = {}
): asserts targetModel is AttendanceTargetModel {
  if (!targetModel || typeof targetModel !== 'string' || targetModel.trim().length === 0) {
    throw new ValidationError('targetModel is required and must be a non-empty string', {
      field: 'targetModel',
      validValues: config.allowedTargetModels || BUILT_IN_TARGET_MODEL_VALUES,
    });
  }

  // If allowlist is configured, validate against it
  const allowlist = config.allowedTargetModels;
  if (allowlist && allowlist.length > 0 && !allowlist.includes(targetModel)) {
    throw new ValidationError(`targetModel "${targetModel}" is not in the allowed list`, {
      field: 'targetModel',
      value: targetModel,
      validValues: allowlist,
    });
  }
}

/**
 * Validate check-in method
 *
 * @param method - Check-in method
 * @throws ValidationError if method invalid
 */
export function validateCheckInMethod(method: string | undefined): asserts method is CheckInMethod | undefined {
  if (!method) return; // Optional

  if (!CHECK_IN_METHOD_VALUES.includes(method as CheckInMethod)) {
    throw new ValidationError(`Invalid check-in method: ${method}`, {
      field: 'method',
      value: method,
      validValues: CHECK_IN_METHOD_VALUES,
    });
  }
}

/**
 * Validate organization/tenant ID
 *
 * @param organizationId - Tenant ID
 * @throws ValidationError if invalid
 */
export function validateOrganizationId(
  organizationId: ObjectIdLike | undefined
): asserts organizationId is ObjectIdLike {
  if (!organizationId) {
    throw new ValidationError('organizationId is required', {
      field: 'organizationId',
    });
  }
}

/**
 * Validate pagination parameters
 *
 * @param pagination - Pagination options
 * @throws ValidationError if invalid
 */
export function validatePagination(
  pagination: { page?: number; limit?: number } = {}
): void {
  const { page, limit } = pagination;

  if (page !== undefined) {
    if (typeof page !== 'number' || page < 1) {
      throw new ValidationError('page must be a positive number', {
        field: 'page',
        value: page,
      });
    }
  }

  if (limit !== undefined) {
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      throw new ValidationError('limit must be between 1 and 100', {
        field: 'limit',
        value: limit,
      });
    }
  }
}

/**
 * Validate date range
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @throws ValidationError if invalid
 */
export function validateDateRange(
  startDate?: Date | null,
  endDate?: Date | null
): void {
  if (startDate && !(startDate instanceof Date)) {
    throw new ValidationError('startDate must be a Date object', {
      field: 'startDate',
      value: startDate,
    });
  }

  if (endDate && !(endDate instanceof Date)) {
    throw new ValidationError('endDate must be a Date object', {
      field: 'endDate',
      value: endDate,
    });
  }

  if (startDate && endDate && startDate > endDate) {
    throw new ValidationError('startDate must be before endDate', {
      field: 'dateRange',
    });
  }
}

/**
 * Validate year value
 *
 * @param year - Year value
 * @throws ValidationError if invalid
 */
export function validateYear(year?: number): void {
  if (year !== undefined) {
    if (typeof year !== 'number' || year < 2000 || year > 2100) {
      throw new ValidationError('year must be between 2000 and 2100', {
        field: 'year',
        value: year,
      });
    }
  }
}

/**
 * Validate month value
 *
 * @param month - Month value (1-12)
 * @throws ValidationError if invalid
 */
export function validateMonth(month?: number): void {
  if (month !== undefined) {
    if (typeof month !== 'number' || month < 1 || month > 12) {
      throw new ValidationError('month must be between 1 and 12', {
        field: 'month',
        value: month,
      });
    }
  }
}

/**
 * Validate member for check-in and throw appropriate errors
 *
 * @param member - Member document
 * @throws MemberNotFoundError, AttendanceNotEnabledError, InvalidMemberError
 */
export function assertValidMember<T extends Partial<ClockInMember>>(
  member: T | null | undefined
): asserts member is T & ClockInMember {
  const result = validateCheckInEligibility(member);

  if (!result.valid) {
    if (!member) {
      throw new InvalidMemberError('Member not found');
    }

    if (member.attendanceEnabled === false) {
      throw new AttendanceNotEnabledError(member._id?.toString());
    }

    throw new InvalidMemberError(result.error || 'Invalid member');
  }
}

/**
 * Assert check-in timing is valid
 *
 * @param lastCheckIn - Last check-in timestamp
 * @throws DuplicateCheckInError if too soon
 */
export function assertValidCheckInTiming(
  lastCheckIn: Date | string | null | undefined
): void {
  const result = validateCheckInTiming(lastCheckIn);

  if (!result.valid && result.lastCheckIn && result.nextAllowedTime) {
    throw new DuplicateCheckInError(result.lastCheckIn, result.nextAllowedTime);
  }
}

export default {
  validateCheckInEligibility,
  validateCheckInTiming,
  validateTargetModel,
  validateCheckInMethod,
  validateOrganizationId,
  validatePagination,
  validateDateRange,
  validateYear,
  validateMonth,
  assertValidMember,
  assertValidCheckInTiming,
};

