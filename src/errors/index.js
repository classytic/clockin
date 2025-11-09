/**
 * 🚨 Attendance Errors - Export Index
 * Centralized export for all attendance error classes
 *
 * @module lib/attendance/errors
 */

export { AttendanceError } from './AttendanceError.js';
export { DuplicateCheckInError } from './DuplicateCheckInError.js';
export { MemberNotFoundError } from './MemberNotFoundError.js';
export { InvalidMemberError } from './InvalidMemberError.js';
export { ValidationError } from './ValidationError.js';
export { NotInitializedError } from './NotInitializedError.js';
export { AttendanceNotEnabledError } from './AttendanceNotEnabledError.js';

// Default export for convenience
export { AttendanceError as default } from './AttendanceError.js';
