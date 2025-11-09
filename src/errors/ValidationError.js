/**
 * 🚨 Validation Error
 * Thrown when input parameters fail validation
 *
 * @module lib/attendance/errors/ValidationError
 */

import AttendanceError from './AttendanceError.js';

/**
 * Validation Error
 *
 * Thrown when:
 * - Required parameters missing
 * - Invalid parameter types
 * - Invalid enum values
 * - Business rule violations
 *
 * @example
 * throw new ValidationError('targetModel must be one of: Membership, Employee', {
 *   field: 'targetModel',
 *   value: 'InvalidModel',
 *   validValues: ['Membership', 'Employee']
 * });
 */
export class ValidationError extends AttendanceError {
  constructor(message, context = {}) {
    super('validation_error', 400, message, context);

    this.field = context.field || null;
    this.value = context.value || null;
  }
}

export default ValidationError;
