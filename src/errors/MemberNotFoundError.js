/**
 * 🚨 Member Not Found Error
 * Thrown when member/entity doesn't exist or is not accessible
 *
 * @module lib/attendance/errors/MemberNotFoundError
 */

import AttendanceError from './AttendanceError.js';

/**
 * Member Not Found Error
 *
 * Thrown when:
 * - Member ID doesn't exist
 * - Member is in wrong organization (multi-tenant isolation)
 * - Member is soft-deleted
 *
 * @example
 * throw new MemberNotFoundError('abc123', 'Membership');
 */
export class MemberNotFoundError extends AttendanceError {
  constructor(identifier, targetModel = 'Member') {
    super(
      'member_not_found',
      404,
      `${targetModel} not found with identifier: ${identifier}`,
      { identifier, targetModel }
    );

    this.identifier = identifier;
    this.targetModel = targetModel;
  }
}

export default MemberNotFoundError;
