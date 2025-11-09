/**
 * 🚨 Attendance Not Enabled Error
 * Thrown when attendance tracking is disabled for member/organization
 *
 * @module lib/attendance/errors/AttendanceNotEnabledError
 */

import AttendanceError from './AttendanceError.js';

/**
 * Attendance Not Enabled Error
 *
 * Thrown when:
 * - Member has attendanceEnabled: false
 * - Organization has disabled attendance feature
 * - Specific membership plan doesn't support attendance
 *
 * @example
 * throw new AttendanceNotEnabledError('member', memberId);
 */
export class AttendanceNotEnabledError extends AttendanceError {
  constructor(entityType = 'member', entityId) {
    super(
      'attendance_not_enabled',
      403,
      `Attendance tracking is not enabled for this ${entityType}`,
      { entityType, entityId }
    );

    this.entityType = entityType;
    this.entityId = entityId;
  }
}

export default AttendanceNotEnabledError;
