/**
 * Check-In Factory
 *
 * Centralized creation of check-in entries for consistency across operations.
 *
 * @module @classytic/clockin/factories/checkin
 */

import mongoose from 'mongoose';
import { getTimeSlot } from '../enums.js';
import type {
  CheckInEntry,
  CheckInData,
  ObjectId,
  ObjectIdLike,
  TimeSlot,
  CheckInMethod,
  AttendanceType,
  UserReference,
} from '../types.js';

/**
 * Check-in entry with optional recordedBy for factory use.
 * In some cases (e.g., system-generated check-ins), recordedBy may not be available.
 */
type FactoryCheckInEntry = Omit<CheckInEntry, 'recordedBy'> & {
  recordedBy?: UserReference;
};

/**
 * Parameters for creating a check-in entry.
 */
export interface CreateCheckInParams {
  /** Check-in timestamp (defaults to now) */
  timestamp?: Date;

  /** Check-in method */
  method?: CheckInMethod;

  /** Attendance type */
  attendanceType?: AttendanceType;

  /** Location information */
  location?: CheckInEntry['location'];

  /** Device information */
  device?: CheckInEntry['device'];

  /** Notes */
  notes?: string;

  /** User who recorded the check-in */
  recordedBy?: {
    userId?: ObjectIdLike;
    name?: string;
    role?: string;
  };

  /** Expected check-out time (for auto-checkout) */
  expectedCheckOutAt?: Date | null;
}

/**
 * Check-In Factory
 *
 * Creates check-in entries with sensible defaults and validation.
 * Centralizes check-in creation logic for consistency.
 *
 * @example
 * ```typescript
 * // Create a simple check-in
 * const entry = CheckInFactory.create({
 *   method: 'qr_code',
 * });
 *
 * // Create with full context
 * const entry = CheckInFactory.create({
 *   timestamp: new Date(),
 *   method: 'mobile_app',
 *   recordedBy: { userId, name, role },
 *   location: { coordinates: [lng, lat] },
 * });
 * ```
 */
export class CheckInFactory {
  /**
   * Create a single check-in entry with generated _id.
   *
   * @param params - Check-in parameters
   * @returns Complete check-in entry ready for storage
   */
  static create(params: CreateCheckInParams = {}): FactoryCheckInEntry & { _id: mongoose.Types.ObjectId } {
    const now = params.timestamp || new Date();
    const hour = now.getHours();

    return {
      _id: new mongoose.Types.ObjectId(),
      timestamp: now,
      checkOutAt: null,
      expectedCheckOutAt: params.expectedCheckOutAt ?? null,
      duration: null,
      autoCheckedOut: false,
      recordedBy: params.recordedBy
        ? {
            userId: params.recordedBy.userId as ObjectId,
            name: params.recordedBy.name,
            role: params.recordedBy.role,
          }
        : undefined,
      checkedOutBy: null,
      method: params.method || 'manual',
      status: 'valid',
      timeSlot: getTimeSlot(hour),
      attendanceType: params.attendanceType || 'full_day',
      location: params.location,
      device: params.device,
      notes: params.notes,
    };
  }

  /**
   * Create multiple check-in entries at once.
   *
   * Useful for bulk imports or batch operations.
   *
   * @param items - Array of check-in parameters
   * @returns Array of check-in entries
   *
   * @example
   * ```typescript
   * const entries = CheckInFactory.createBatch([
   *   { method: 'api', timestamp: date1 },
   *   { method: 'api', timestamp: date2 },
   *   { method: 'api', timestamp: date3 },
   * ]);
   * ```
   */
  static createBatch(
    items: CreateCheckInParams[]
  ): Array<FactoryCheckInEntry & { _id: mongoose.Types.ObjectId }> {
    return items.map((item) => this.create(item));
  }

  /**
   * Create a check-in entry from CheckInData (service layer input).
   *
   * This is a convenience method that transforms service-layer data
   * into a check-in entry.
   *
   * @param data - Check-in data from service
   * @param context - Additional context (recordedBy, etc.)
   * @returns Check-in entry
   */
  static fromCheckInData(
    data: CheckInData,
    context: {
      userId?: ObjectIdLike;
      userName?: string;
      userRole?: string;
      expectedCheckOutAt?: Date | null;
    } = {}
  ): FactoryCheckInEntry & { _id: mongoose.Types.ObjectId } {
    return this.create({
      timestamp: data.timestamp ? new Date(data.timestamp) : undefined,
      method: data.method,
      location: data.location,
      device: data.device,
      notes: data.notes,
      recordedBy: {
        userId: context.userId,
        name: context.userName,
        role: context.userRole,
      },
      expectedCheckOutAt: context.expectedCheckOutAt,
    });
  }
}

export default CheckInFactory;
