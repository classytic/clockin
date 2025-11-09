/**
 * 🚨 Not Initialized Error
 * Thrown when attempting to use attendance library before initialization
 *
 * @module lib/attendance/errors/NotInitializedError
 */

import AttendanceError from './AttendanceError.js';

/**
 * Not Initialized Error
 *
 * Thrown when:
 * - Using orchestrator before calling initializeAttendance()
 * - Required models not registered
 *
 * @example
 * throw new NotInitializedError();
 */
export class NotInitializedError extends AttendanceError {
  constructor() {
    super(
      'not_initialized',
      500,
      'Attendance library not initialized. Call initializeAttendance({ AttendanceModel }) in your bootstrap.',
      {
        fix: 'Add initializeAttendance() to your app startup',
        example: "import { initializeAttendance } from '#lib/attendance'; initializeAttendance({ AttendanceModel });",
      }
    );
  }
}

export default NotInitializedError;
