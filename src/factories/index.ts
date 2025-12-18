/**
 * ClockIn Factories
 *
 * Centralized object creation for consistency and testability.
 *
 * @module @classytic/clockin/factories
 */

export {
  CheckInFactory,
  type CreateCheckInParams,
} from './checkin.factory.js';

export {
  AttendanceRecordFactory,
  type CreateAttendanceRecordParams,
} from './attendance.factory.js';
