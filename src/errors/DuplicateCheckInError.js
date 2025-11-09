/**
 * 🚨 Duplicate Check-In Error
 * Thrown when member tries to check in too soon after last check-in
 *
 * @module lib/attendance/errors/DuplicateCheckInError
 */

import AttendanceError from './AttendanceError.js';

/**
 * Duplicate Check-In Error
 *
 * Thrown when:
 * - Member already checked in within minimum time window (e.g., 5 minutes)
 * - Prevents accidental duplicate check-ins
 *
 * @example
 * throw new DuplicateCheckInError(lastCheckIn, 5);
 * // Error: Already checked in 2 minutes ago. Please wait 3 more minutes.
 */
export class DuplicateCheckInError extends AttendanceError {
  constructor(lastCheckIn, minimumMinutes = 5) {
    const minutesAgo = Math.floor(
      (Date.now() - new Date(lastCheckIn).getTime()) / (1000 * 60)
    );

    const waitMinutes = minimumMinutes - minutesAgo;

    const message = waitMinutes > 0
      ? `Already checked in ${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago. Please wait ${waitMinutes} more minute${waitMinutes !== 1 ? 's' : ''}.`
      : `Already checked in ${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago.`;

    super('duplicate_check_in', 409, message, {
      lastCheckIn,
      minutesAgo,
      minimumMinutes,
      waitMinutes: Math.max(0, waitMinutes),
    });

    this.lastCheckIn = lastCheckIn;
    this.minutesAgo = minutesAgo;
    this.minimumMinutes = minimumMinutes;
  }
}

export default DuplicateCheckInError;
