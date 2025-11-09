/**
 * ✅ Validators
 * Reusable validation functions for attendance operations
 *
 * @module lib/attendance/utils/validators
 */

import { ATTENDANCE_TARGET_MODEL_VALUES, CHECK_IN_METHOD_VALUES } from '../enums.js';
import { ValidationError, InvalidMemberError, AttendanceNotEnabledError } from '../errors/index.js';

/**
 * Validate check-in eligibility
 *
 * Checks:
 * - Member exists
 * - Membership is active
 * - Attendance is enabled
 * - Not already checked in recently
 *
 * @param {Object} member - Member document
 * @returns {Object} { valid: Boolean, error?: String }
 *
 * @example
 * const result = validateCheckInEligibility(member);
 * if (!result.valid) throw new InvalidMemberError(result.error);
 */
export function validateCheckInEligibility(member) {
  if (!member) {
    return { valid: false, error: 'Member not found' };
  }

  // Check if attendance is enabled
  if (member.attendanceEnabled === false) {
    return { valid: false, error: 'Attendance tracking is disabled for this member' };
  }

  // Check membership status (if applicable)
  if (member.status && !['active', 'pending'].includes(member.status)) {
    return {
      valid: false,
      error: `Membership is ${member.status}. Only active or pending memberships can check in.`,
    };
  }

  // Check subscription status (if applicable)
  if (member.subscription && member.subscription.status === 'expired') {
    return {
      valid: false,
      error: `Membership expired on ${member.subscription.endDate?.toISOString().split('T')[0]}`,
    };
  }

  return { valid: true };
}

/**
 * Validate target model is supported
 *
 * @param {String} targetModel - Model name
 * @throws {ValidationError} If model not supported
 */
export function validateTargetModel(targetModel) {
  if (!targetModel) {
    throw new ValidationError('targetModel is required', {
      field: 'targetModel',
      validValues: ATTENDANCE_TARGET_MODEL_VALUES,
    });
  }

  if (!ATTENDANCE_TARGET_MODEL_VALUES.includes(targetModel)) {
    throw new ValidationError(
      `Invalid targetModel: ${targetModel}`,
      {
        field: 'targetModel',
        value: targetModel,
        validValues: ATTENDANCE_TARGET_MODEL_VALUES,
      }
    );
  }
}

/**
 * Validate check-in method
 *
 * @param {String} method - Check-in method
 * @throws {ValidationError} If method invalid
 */
export function validateCheckInMethod(method) {
  if (!method) return; // Optional

  if (!CHECK_IN_METHOD_VALUES.includes(method)) {
    throw new ValidationError(
      `Invalid check-in method: ${method}`,
      {
        field: 'method',
        value: method,
        validValues: CHECK_IN_METHOD_VALUES,
      }
    );
  }
}

/**
 * Validate organization/tenant ID
 *
 * @param {*} organizationId - Tenant ID
 * @throws {ValidationError} If invalid
 */
export function validateOrganizationId(organizationId) {
  if (!organizationId) {
    throw new ValidationError('organizationId is required', {
      field: 'organizationId',
    });
  }
}

/**
 * Validate pagination parameters
 *
 * @param {Object} pagination - Pagination options
 * @throws {ValidationError} If invalid
 */
export function validatePagination(pagination = {}) {
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
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @throws {ValidationError} If invalid
 */
export function validateDateRange(startDate, endDate) {
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
      startDate,
      endDate,
    });
  }
}

export default {
  validateCheckInEligibility,
  validateTargetModel,
  validateCheckInMethod,
  validateOrganizationId,
  validatePagination,
  validateDateRange,
};
