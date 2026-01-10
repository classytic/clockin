/**
 * ClockIn Check-Out Service
 *
 * Handles all check-out operations with full TypeScript support
 *
 * @module @classytic/clockin/services/checkout
 */

import mongoose from 'mongoose';
import { Container } from '../core/container.js';
import { Result, ok, err } from '../core/result.js';
import { EventBus, createEventBus } from '../core/events.js';
import { PluginManager, type PluginContext } from '../core/plugin.js';
import { getConfig } from '../config.js';
import { BUILT_IN_TARGET_MODEL_VALUES } from '../enums.js';
import {
  ClockInError,
  NoActiveSessionError,
  AlreadyCheckedOutError,
  ValidationError,
  TargetModelNotAllowedError,
} from '../errors/index.js';
import { detectAttendanceType } from '../utils/detection.js';
import { getLogger } from '../utils/logger.js';
import type { ClientSession } from 'mongoose';
import type { Logger } from '../types.js';
import type {
  CheckOutParams,
  CheckOutResult,
  ToggleResult,
  OccupancyData,
  ActiveSessionData,
  CheckInData,
  OperationContext,
  ObjectId,
  ObjectIdLike,
  AnyDocument,
  AttendanceTargetModel,
  CheckoutExpiredParams,
  CheckoutExpiredResult,
} from '../types.js';
import { extractSession } from '../core/transaction.js';

type ClockInRuntimeOptions = {
  singleTenant?: {
    organizationId: ObjectIdLike;
    autoInject?: boolean;
  };
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

/**
 * Check-Out Service
 *
 * Provides type-safe check-out operations
 */
export class CheckOutService {
  private container: Container;
  private logger: Logger;

  constructor(container: Container) {
    this.container = container;
    this.logger = container.has('logger') ? container.get<Logger>('logger') : getLogger();
  }

  /**
   * Get model from container (supports multi-connection setups)
   * No fallbacks: models must be registered via .withModels()
   */
  private getModel(targetModel: string): mongoose.Model<any> {
    const models = this.container.has('models')
      ? this.container.get<Record<string, mongoose.Model<any>>>('models')
      : {};

    if (models[targetModel]) {
      return models[targetModel];
    }

    throw new ValidationError(
      `Model "${targetModel}" is not registered. Register it via .withModels({ ${targetModel} })`
    );
  }

  /**
   * Create plugin context for an operation
   */
  private createPluginContext(): PluginContext {
    return {
      events: this.container.has('events') ? this.container.get<EventBus>('events') : createEventBus(),
      logger: this.logger,
      get: <T>(key: string) => this.container.get<T>(key),
      storage: new Map(),
      meta: {
        requestId: Math.random().toString(36).substring(7),
        timestamp: new Date(),
      },
    };
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  /**
   * Validate targetModel against allowlist (if configured).
   * Throws TargetModelNotAllowedError if not allowed.
   */
  private validateTargetModelAllowed(targetModel: string): void {
    if (!this.container.has('allowedTargetModels')) {
      return; // No allowlist configured, allow any
    }

    const allowedModels = this.container.get<string[]>('allowedTargetModels');
    if (!allowedModels.includes(targetModel)) {
      throw new TargetModelNotAllowedError(targetModel, allowedModels);
    }
  }

  // ============================================================================
  // CHECK-OUT
  // ============================================================================

  /**
   * Record a check-out
   */
  async record<TMember extends AnyDocument>(
    params: CheckOutParams<TMember>
  ): Promise<Result<CheckOutResult, ClockInError>> {
    const { member, targetModel, checkInId, context = {} } = params;

    // Validate targetModel against allowlist (if configured)
    try {
      this.validateTargetModelAllowed(targetModel);
    } catch (error) {
      if (error instanceof TargetModelNotAllowedError) {
        return err(error);
      }
      throw error;
    }

    const AttendanceModel = this.container.get<mongoose.Model<any>>('AttendanceModel');
    const events = this.container.has('events') ? this.container.get<EventBus>('events') : null;
    const plugins = this.container.has('plugins') ? this.container.get<PluginManager>('plugins') : null;

    // Create plugin context ONCE for this entire operation
    const pluginCtx = plugins ? this.createPluginContext() : null;

    const now = new Date();
    const options = this.container.has('options')
      ? this.container.get<ClockInRuntimeOptions>('options')
      : undefined;

    const organizationId =
      context.organizationId ||
      (member as any).organizationId ||
      options?.singleTenant?.organizationId;

    if (!organizationId) {
      return err(new ValidationError('organizationId is required'));
    }

    // Extract session for transactional operations
    const session = extractSession(context);

    // Run plugin hooks (shared context)
    if (plugins && pluginCtx) {
      await plugins.runHook('beforeCheckOut', pluginCtx, {
        memberId: (member as any)._id,
        checkInId: checkInId as ObjectId,
      });
    }

    try {
      // Resolve target model (strict: must be registered via .withModels())
      const MemberModel = this.getModel(targetModel);

      // Find attendance record with the check-in
      let attendanceQuery = AttendanceModel.findOne({
        organizationId: organizationId,
        targetModel,
        targetId: (member as any)._id,
        'checkIns._id': checkInId,
      });
      if (session) {
        attendanceQuery = attendanceQuery.session(session);
      }
      const attendance = await attendanceQuery;

      if (!attendance) {
        return err(new NoActiveSessionError((member as any)._id?.toString()));
      }

      // Find the check-in entry
      const checkIn = attendance.checkIns.find(
        (c: any) => c._id.toString() === checkInId.toString()
      );

      if (!checkIn) {
        return err(new NoActiveSessionError((member as any)._id?.toString()));
      }

      if (checkIn.checkOutAt) {
        return err(new AlreadyCheckedOutError(checkInId.toString()));
      }

      // Calculate duration in minutes
      const duration = Math.floor(
        (now.getTime() - new Date(checkIn.timestamp).getTime()) / (1000 * 60)
      );

      // Detect attendance type based on duration
      const config = getConfig(targetModel, this.container);
      const attendanceType = detectAttendanceType(
        duration / 60, // hours
        targetModel,
        member as any,
        config
      );

      // Update check-in entry
      checkIn.checkOutAt = now;
      checkIn.duration = duration;
      checkIn.attendanceType = attendanceType;
      checkIn.checkedOutBy = {
        userId: context.userId as ObjectId,
        name: context.userName,
        role: context.userRole,
      };

      const workdayCounts = attendance.checkIns.reduce(
        (counts: { full: number; half: number; paidLeave: number; overtime: number }, entry: any) => {
          const type = entry.attendanceType as string | undefined;
          if (!type) {
            return counts;
          }

          switch (type) {
            case 'full_day':
              counts.full += 1;
              break;
            case 'half_day':
            case 'half_day_morning':
            case 'half_day_afternoon':
              counts.half += 1;
              break;
            case 'paid_leave':
              counts.paidLeave += 1;
              break;
            case 'overtime':
              counts.overtime += 1;
              break;
            default:
              break;
          }

          return counts;
        },
        { full: 0, half: 0, paidLeave: 0, overtime: 0 }
      );

      attendance.fullDaysCount = workdayCounts.full;
      attendance.halfDaysCount = workdayCounts.half;
      attendance.paidLeaveDaysCount = workdayCounts.paidLeave;
      attendance.overtimeDaysCount = workdayCounts.overtime;
      attendance.totalWorkDays =
        workdayCounts.full +
        workdayCounts.half * 0.5 +
        workdayCounts.paidLeave +
        workdayCounts.overtime;

      await attendance.save({ session });

      // Clear current session on member (using model from container)
      await MemberModel.findByIdAndUpdate(
        (member as any)._id,
        {
          $set: {
            'currentSession.isActive': false,
            'currentSession.checkInId': null,
            'currentSession.checkInTime': null,
            'currentSession.expectedCheckOutAt': null,
            'currentSession.method': null,
          },
        },
        { session } // Pass session for transaction support
      );

      // Emit events
      if (events) {
        events.emit('checkOut:recorded', {
          type: 'checkOut:recorded',
          data: {
            checkIn: {
              id: checkIn._id,
              checkInTime: checkIn.timestamp,
              checkOutTime: now,
            },
            member: {
              id: (member as any)._id,
              name: (member as any).customer?.name || (member as any).name,
            },
            targetModel,
            duration,
            context,
          },
        });
      }

      // Run plugin hooks (use SAME context as beforeCheckOut)
      if (plugins && pluginCtx) {
        await plugins.runHook('afterCheckOut', pluginCtx, {
          memberId: (member as any)._id,
          memberName: (member as any).customer?.name || (member as any).name,
          targetModel,
          checkInId: checkIn._id,
          duration,
          timestamp: now,
        });
      }

      this.logger.info('Check-out recorded', {
        memberId: (member as any)._id,
        checkInId,
        duration,
      });

      return ok({
        checkIn,
        duration,
      });
    } catch (error) {
      this.logger.error('Check-out failed', { error, memberId: (member as any)?._id });

      if (error instanceof ClockInError) {
        return err(error);
      }
      return err(new ClockInError('ATTENDANCE_ERROR', 500, (error as Error).message));
    }
  }

  // ============================================================================
  // TOGGLE (SMART CHECK-IN/OUT)
  // ============================================================================

  /**
   * Toggle check-in/out (smart action based on current state)
   *
   * Perfect for:
   * - RFID card tap
   * - QR code scan
   * - Biometric scan
   * - Mobile app tap
   */
  async toggle<TMember extends AnyDocument>(params: {
    member: TMember;
    targetModel: string;
    data?: CheckInData;
    context?: OperationContext;
  }): Promise<Result<ToggleResult, ClockInError>> {
    const { member, targetModel, data = {}, context = {} } = params;

    // Validate targetModel against allowlist (if configured)
    try {
      this.validateTargetModelAllowed(targetModel);
    } catch (error) {
      if (error instanceof TargetModelNotAllowedError) {
        return err(error);
      }
      throw error;
    }

    // Check if member has active session
    const currentSession = (member as any).currentSession;

    if (currentSession?.isActive && currentSession.checkInId) {
      // Has active session -> check out
      const result = await this.record({
        member,
        targetModel: targetModel as AttendanceTargetModel,
        checkInId: currentSession.checkInId,
        context,
      });

      if (!result.ok) {
        return err(result.error);
      }

      return ok({
        action: 'check-out',
        checkIn: result.value.checkIn,
        duration: result.value.duration,
        member: {
          id: (member as any)._id,
          membershipCode: (member as any).membershipCode,
          name: (member as any).customer?.name || (member as any).name,
        },
      });
    } else {
      // No active session -> check in
      // Dynamic import to avoid circular dependency
      const { CheckInService } = await import('./checkin.service.js');
      const checkInService = new CheckInService(this.container);

      const result = await checkInService.record({
        member,
        targetModel: targetModel as AttendanceTargetModel,
        data,
        context,
      });

      if (!result.ok) {
        return err(result.error);
      }

      return ok({
        action: 'check-in',
        checkIn: result.value.checkIn,
        attendance: result.value.attendance,
        updatedMember: result.value.updatedMember,
        stats: result.value.stats,
        member: {
          id: (member as any)._id,
          membershipCode: (member as any).membershipCode,
          name: (member as any).customer?.name || (member as any).name,
        },
      });
    }
  }

  // ============================================================================
  // OCCUPANCY & SESSIONS
  // ============================================================================

  /**
   * Batch check-out for expired sessions
   */
  async checkoutExpired(
    params: CheckoutExpiredParams
  ): Promise<Result<CheckoutExpiredResult, ClockInError>> {
    const { targetModel, before = new Date(), limit = 500, context = {} } = params;
    const options = this.container.has('options')
      ? this.container.get<ClockInRuntimeOptions>('options')
      : undefined;

    const organizationId =
      params.organizationId || context.organizationId || options?.singleTenant?.organizationId;

    if (!organizationId) {
      return err(new ValidationError('organizationId is required'));
    }

    if (limit <= 0) {
      return err(new ValidationError('limit must be a positive number'));
    }

    if (targetModel) {
      try {
        this.validateTargetModelAllowed(targetModel);
      } catch (error) {
        if (error instanceof TargetModelNotAllowedError) {
          return err(error);
        }
        throw error;
      }
    }

    const allowedModels = this.container.has('allowedTargetModels')
      ? this.container.get<string[]>('allowedTargetModels')
      : null;
    const models = targetModel
      ? [targetModel]
      : (() => {
          if (this.container.has('models')) {
            const registeredModels = this.container.get<Record<string, mongoose.Model<any>>>('models');
            const names = Object.keys(registeredModels).filter((name) => name !== 'Attendance');
            return allowedModels ? names.filter((name) => allowedModels.includes(name)) : names;
          }
          return allowedModels || BUILT_IN_TARGET_MODEL_VALUES;
        })();

    const summary: CheckoutExpiredResult = {
      total: 0,
      processed: 0,
      failed: 0,
      errors: [],
    };

    for (const model of models) {
      let Model: mongoose.Model<any>;
      try {
        Model = this.getModel(model);
      } catch (error) {
        summary.errors.push({
          targetModel: model,
          reason: (error as Error).message,
        });
        summary.failed += 1;
        continue;
      }

      const expiredMembers = await Model.find({
        organizationId,
        'currentSession.isActive': true,
        'currentSession.expectedCheckOutAt': { $lt: before },
      })
        .sort({ 'currentSession.expectedCheckOutAt': 1 })
        .limit(limit)
        .select('_id currentSession');

      if (expiredMembers.length === 0) {
        continue;
      }

      summary.total += expiredMembers.length;

      for (const member of expiredMembers) {
        const currentSession = (member as any).currentSession;
        const checkInId = currentSession?.checkInId;

        if (!checkInId) {
          summary.failed += 1;
          summary.errors.push({
            targetModel: model,
            memberId: (member as any)._id,
            reason: 'Missing currentSession.checkInId',
          });
          continue;
        }

        const result = await this.record({
          member,
          targetModel: model as AttendanceTargetModel,
          checkInId,
          context: {
            ...context,
            organizationId,
          },
        });

        if (result.ok) {
          summary.processed += 1;
        } else {
          summary.failed += 1;
          summary.errors.push({
            targetModel: model,
            memberId: (member as any)._id,
            checkInId,
            reason: result.error.message,
          });
        }
      }
    }

    return ok(summary);
  }

  /**
   * Get current occupancy (who's checked in right now)
   */
  async getOccupancy(params: {
    organizationId: ObjectIdLike;
    targetModel?: string;
  }): Promise<Result<OccupancyData, ClockInError>> {
    const { organizationId, targetModel } = params;

    try {
      // Query all models with active sessions.
      // Prefer container-registered models (supports custom target models and multi-connection setups).
      const models = targetModel
        ? [targetModel]
        : (() => {
            if (this.container.has('models')) {
              const registeredModels = this.container.get<Record<string, mongoose.Model<any>>>('models');
              return Object.keys(registeredModels).filter((name) => name !== 'Attendance');
            }
            return BUILT_IN_TARGET_MODEL_VALUES;
          })();

      const occupancy: OccupancyData = {
        total: 0,
        byType: {},
        timestamp: new Date(),
      };

      for (const model of models) {
        try {
          const Model = this.getModel(model);
          const activeMembers = await Model.find({
            organizationId,
            'currentSession.isActive': true,
          }).select('_id currentSession');

          if (activeMembers.length > 0) {
            occupancy.byType[model] = {
              count: activeMembers.length,
              members: activeMembers.map((m: any) => m._id),
            };
            occupancy.total += activeMembers.length;
          }
        } catch {
          // Model doesn't exist in container or mongoose, skip
        }
      }

      return ok(occupancy);
    } catch (error) {
      return err(new ClockInError('ATTENDANCE_ERROR', 500, (error as Error).message));
    }
  }

  /**
   * Get member's current active session
   */
  async getCurrentSession(params: {
    memberId: ObjectIdLike;
    organizationId: ObjectIdLike;
    targetModel: string;
  }): Promise<Result<ActiveSessionData | null, ClockInError>> {
    const { memberId, organizationId, targetModel } = params;

    try {
      const Model = this.getModel(targetModel);
      const member = await Model.findOne({
        _id: memberId,
        organizationId,
      }).select('currentSession');

      if (!member || !member.currentSession?.isActive) {
        return ok(null);
      }

      const session = member.currentSession;
      const duration = session.checkInTime
        ? Math.floor((Date.now() - new Date(session.checkInTime).getTime()) / (1000 * 60))
        : 0;

      return ok({
        checkInId: session.checkInId,
        timestamp: session.checkInTime,
        expectedCheckOutAt: session.expectedCheckOutAt,
        duration,
        method: session.method,
      });
    } catch (error) {
      return err(new ClockInError('ATTENDANCE_ERROR', 500, (error as Error).message));
    }
  }
}

export default CheckOutService;
