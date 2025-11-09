/**
 * 🚨 Invalid Member Error
 * Thrown when member exists but cannot check in
 *
 * @module lib/attendance/errors/InvalidMemberError
 */

import AttendanceError from './AttendanceError.js';

/**
 * Invalid Member Error
 *
 * Thrown when:
 * - Member's membership is expired
 * - Member's subscription is not active
 * - Member is suspended/banned
 * - Attendance tracking is disabled for member
 *
 * @example
 * throw new InvalidMemberError('Membership expired on 2025-10-15', {
 *   reason: 'expired',
 *   expiryDate: '2025-10-15'
 * });
 */
export class InvalidMemberError extends AttendanceError {
  constructor(reason, context = {}) {
    super(
      'invalid_member',
      400,
      `Member cannot check in: ${reason}`,
      { reason, ...context }
    );

    this.reason = reason;
  }
}

export default InvalidMemberError;
