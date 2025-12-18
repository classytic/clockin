/**
 * ClockIn Check-In Service
 *
 * Handles all check-in operations with full TypeScript support
 *
 * @module @classytic/clockin/services/checkin
 */

import mongoose from 'mongoose';
import { Container } from '../core/container.js';
import { Result, ok, err } from '../core/result.js';
import { EventBus, createEventBus } from '../core/events.js';
import { PluginManager, type PluginContext } from '../core/plugin.js';
import { getTimeSlot } from '../enums.js';
import { CHECK_IN_RULES, getConfig } from '../config.js';
import {
  ClockInError,
  ValidationError,
  DuplicateCheckInError,
  InvalidMemberError,
  AttendanceNotEnabledError,
  TargetModelNotAllowedError,
} from '../errors/index.js';
import { calculateExpectedCheckout } from '../utils/schedule.js';
import { calculateEngagementLevel, calculateLoyaltyScore } from '../utils/engagement.js';
import { calculateStreak, isStreakMilestone } from '../utils/streak.js';
import { getLogger } from '../utils/logger.js';
import type { ClientSession } from 'mongoose';
import type { Logger } from '../types.js';
import type {
  CheckInParams,
  CheckInResult,
  CheckInData,
  CheckInEntry,
  AttendanceStats,
  OperationContext,
  ValidationResult,
  BulkCheckInData,
  BulkOperationResult,
  ObjectId,
  ObjectIdLike,
  AnyDocument,
} from '../types.js';
import { extractSession } from '../core/transaction.js';
import { DefaultMemberResolver, type MemberResolver } from '../core/resolver.js';

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
 * Check-In Service
 *
 * Provides type-safe check-in operations
 */
export class CheckInService {
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
   * Create plugin context for an operation (reusable across hooks)
   */
  private createPluginContext(): PluginContext {
    return {
      events: this.container.has('events') ? this.container.get<EventBus>('events') : createEventBus(),
      logger: this.logger,
      get: <T>(key: string) => this.container.get<T>(key),
      storage: new Map(), // Shared across all hooks in this operation
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

  /**
   * Validate if member can check in
   */
  validate<TMember extends AnyDocument>(
    member: TMember | null | undefined,
    targetModel: string,
    options: { timestamp?: Date } = {}
  ): ValidationResult {
    // Check member exists
    if (!member) {
      return { valid: false, error: 'Member not found' };
    }

    // Check attendance enabled
    if ((member as any).attendanceEnabled === false) {
      return { valid: false, error: 'Attendance tracking is disabled for this member' };
    }

    // Check membership status
    const status = (member as any).status;
    if (status && !['active', 'pending'].includes(status)) {
      return { valid: false, error: `Cannot check in: membership status is ${status}` };
    }

    // Check duplicate prevention
    const lastVisit = (member as any).attendanceStats?.lastVisitedAt;
    if (lastVisit) {
      const minutesSince = (Date.now() - new Date(lastVisit).getTime()) / (1000 * 60);

      if (minutesSince < CHECK_IN_RULES.duplicatePreventionMinutes) {
        return {
          valid: false,
          error: `Already checked in ${Math.floor(minutesSince)} minutes ago. Please wait ${CHECK_IN_RULES.duplicatePreventionMinutes} minutes.`,
          lastCheckIn: new Date(lastVisit),
          nextAllowedTime: new Date(
            new Date(lastVisit).getTime() + CHECK_IN_RULES.duplicatePreventionMinutes * 60 * 1000
          ),
        };
      }
    }

    return { valid: true };
  }

  // ============================================================================
  // CHECK-IN
  // ============================================================================

  /**
   * Record a check-in
   *
   * @example
   * ```typescript
   * const result = await checkInService.record({
   *   member,
   *   targetModel: 'Membership',
   *   data: { method: 'qr_code' },
   *   context: { organizationId },
   * });
   *
   * if (isOk(result)) {
   *   console.log(`Total visits: ${result.value.stats.totalVisits}`);
   * }
   * ```
   */
  async record<TMember extends AnyDocument>(
    params: CheckInParams<TMember>
  ): Promise<Result<CheckInResult, ClockInError>> {
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

    // Validate member
    const validation = this.validate(member, targetModel, data);
    if (!validation.valid) {
      if ((member as any)?.attendanceEnabled === false) {
        return err(new AttendanceNotEnabledError((member as any)?._id?.toString()));
      }
      if (validation.lastCheckIn && validation.nextAllowedTime) {
        return err(new DuplicateCheckInError(validation.lastCheckIn, validation.nextAllowedTime));
      }
      return err(new InvalidMemberError(validation.error || 'Invalid member'));
    }

    // Get models from container
    const AttendanceModel = this.container.get<mongoose.Model<any>>('AttendanceModel');
    const events = this.container.has('events') ? this.container.get<EventBus>('events') : null;
    const plugins = this.container.has('plugins') ? this.container.get<PluginManager>('plugins') : null;

    // Create plugin context ONCE for this entire operation (shared storage across hooks)
    const pluginCtx = plugins ? this.createPluginContext() : null;

    const now = new Date(data.timestamp || Date.now());
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const options = this.container.has('options')
      ? this.container.get<ClockInRuntimeOptions>('options')
      : undefined;

    // Get organization ID (multi-tenant) or fallback to configured single-tenant orgId
    const organizationId =
      context.organizationId ||
      (member as any).organizationId ||
      options?.singleTenant?.organizationId;
    if (!organizationId) {
      return err(new ValidationError('organizationId is required'));
    }

    const shouldAutoInjectOrgId =
      !!options?.singleTenant?.organizationId && options?.singleTenant?.autoInject !== false;

    // Extract session for transactional operations
    const session = extractSession(context);

    // Run plugin hooks (use shared context)
    if (plugins && pluginCtx) {
      await plugins.runHook('beforeCheckIn', pluginCtx, {
        memberId: (member as any)._id,
        targetModel,
      });
    }

    try {
      // Resolve target model (strict: must be registered via .withModels())
      const MemberModel = this.getModel(targetModel);

      // Create check-in entry with generated _id for atomicity
      const checkInEntry = this.createCheckInEntry(data, targetModel, member, context, now);
      const checkInId = new mongoose.Types.ObjectId();
      const checkInWithId = { _id: checkInId, ...checkInEntry };
      const dayString = now.toISOString().split('T')[0];

      // Atomic upsert with retry for E11000 duplicate key errors
      // This handles race conditions when two concurrent upserts try to create the same document
      const upsertWithRetry = async (retries = 1): Promise<any> => {
        try {
          return await AttendanceModel.findOneAndUpdate(
            {
              tenantId: organizationId,
              targetModel,
              targetId: (member as any)._id,
              year,
              month,
            },
            {
              $push: { checkIns: checkInWithId },
              $inc: { monthlyTotal: 1 },
              $addToSet: { visitedDays: dayString },
              $setOnInsert: {
                tenantId: organizationId,
                targetModel,
                targetId: (member as any)._id,
                year,
                month,
              },
            },
            {
              new: true,
              upsert: true,
              session, // Pass session for transaction support
            }
          );
        } catch (error: any) {
          // E11000 duplicate key error - retry once without upsert
          if (error.code === 11000 && retries > 0) {
            return await AttendanceModel.findOneAndUpdate(
              {
                tenantId: organizationId,
                targetModel,
                targetId: (member as any)._id,
                year,
                month,
              },
              {
                $push: { checkIns: checkInWithId },
                $inc: { monthlyTotal: 1 },
                $addToSet: { visitedDays: dayString },
              },
              { new: true, session } // Pass session for transaction support
            );
          }
          throw error;
        }
      };

      const attendance = await upsertWithRetry();

      // Update uniqueDaysVisited count (derived from visitedDays array length)
      attendance.uniqueDaysVisited = attendance.visitedDays?.length || 1;
      await attendance.save({ session });

      // Get the added check-in
      const addedCheckIn = attendance.checkIns.find(
        (c: any) => c._id.toString() === checkInId.toString()
      ) || checkInWithId;

      // Calculate updated stats
      const stats = this.calculateStats(member, attendance, now);

      // Update member document (using model from container)
      const updatedMember = await MemberModel.findByIdAndUpdate(
        (member as any)._id,
        {
          $set: {
            ...(shouldAutoInjectOrgId && !(member as any).organizationId
              ? { organizationId }
              : {}),
            attendanceStats: stats,
            currentSession: {
              isActive: true,
              checkInId: addedCheckIn._id,
              checkInTime: addedCheckIn.timestamp,
              expectedCheckOutAt: addedCheckIn.expectedCheckOutAt,
              method: addedCheckIn.method,
            },
          },
        },
        { new: true, session } // Pass session for transaction support
      );

      // Emit events
      if (events) {
        events.emit('checkIn:recorded', {
          type: 'checkIn:recorded',
          data: {
            checkIn: {
              id: addedCheckIn._id,
              timestamp: addedCheckIn.timestamp,
              method: addedCheckIn.method,
            },
            member: {
              id: (member as any)._id,
              name: (member as any).customer?.name || (member as any).name,
            },
            targetModel,
            stats: {
              totalVisits: stats.totalVisits,
              currentStreak: stats.currentStreak,
              engagementLevel: stats.engagementLevel,
            },
            context,
          },
        });

        // Check for milestones
        this.checkMilestones(events, member, stats);
      }

      // Run plugin hooks (use SAME context as beforeCheckIn for shared storage)
      if (plugins && pluginCtx) {
        await plugins.runHook('afterCheckIn', pluginCtx, {
          memberId: (member as any)._id,
          memberName: (member as any).customer?.name || (member as any).name,
          targetModel,
          checkInId: addedCheckIn._id,
          timestamp: addedCheckIn.timestamp,
          method: addedCheckIn.method,
          stats,
        });
      }

      this.logger.info('Check-in recorded', {
        memberId: (member as any)._id,
        targetModel,
        totalVisits: stats.totalVisits,
      });

      return ok({
        checkIn: addedCheckIn,
        attendance,
        updatedMember,
        stats,
      });
    } catch (error) {
      this.logger.error('Check-in failed', { error, memberId: (member as any)?._id });

      if (error instanceof ClockInError) {
        return err(error);
      }
      return err(new ClockInError('ATTENDANCE_ERROR', 500, (error as Error).message));
    }
  }

  /**
   * Bulk check-in (for data imports)
   *
   * Supports pluggable member resolution via the `resolver` option.
   * If no resolver is provided, uses the container-registered resolver
   * or falls back to DefaultMemberResolver.
   *
   * @example
   * ```typescript
   * // Use default resolver (tries email, membershipCode, employeeId, _id)
   * await checkInService.recordBulk(checkIns, context);
   *
   * // Use custom identifier fields
   * await checkInService.recordBulk(checkIns, context, {
   *   resolver: new DefaultMemberResolver(container, {
   *     identifierFields: ['membershipCode', 'employeeId'],
   *   }),
   * });
   *
   * // Use completely custom resolver
   * await checkInService.recordBulk(checkIns, context, {
   *   resolver: myCustomResolver,
   * });
   * ```
   */
  async recordBulk(
    checkIns: BulkCheckInData[],
    context: OperationContext = {},
    options: { resolver?: MemberResolver } = {}
  ): Promise<BulkOperationResult> {
    const results: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    // Get resolver: passed option > container-registered > default
    const resolver = options.resolver
      || (this.container.has('memberResolver')
          ? this.container.get<MemberResolver>('memberResolver')
          : new DefaultMemberResolver(this.container));

    for (const checkInData of checkIns) {
      try {
        const targetModel = checkInData.targetModel || 'Membership';

        // Use resolver to find member by identifier
        const member = await resolver.resolve(
          checkInData.memberIdentifier,
          targetModel,
          context
        );

        if (!member) {
          results.failed++;
          results.errors.push({
            memberIdentifier: checkInData.memberIdentifier,
            error: 'Member not found',
          });
          continue;
        }

        const result = await this.record({
          member,
          targetModel,
          data: checkInData,
          context, // Session flows through via context
        });

        if (result.ok) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            memberIdentifier: checkInData.memberIdentifier,
            error: result.error.message,
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          memberIdentifier: checkInData.memberIdentifier,
          error: (error as Error).message,
        });
      }
    }

    return results;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private createCheckInEntry(
    data: CheckInData,
    targetModel: string,
    member: AnyDocument,
    context: OperationContext,
    now: Date
  ): CheckInEntry {
    const hour = now.getHours();
    const config = getConfig(targetModel, this.container);

    // Calculate expected checkout
    const workSchedule = (member as Record<string, unknown>).workSchedule as import('../types.js').WorkSchedule | undefined;
    const expectedCheckOutAt = config.autoCheckout?.enabled
      ? calculateExpectedCheckout(
          now,
          workSchedule,
          config.autoCheckout.afterHours,
          config.autoCheckout.maxSession
        )
      : null;

    return {
      timestamp: now,
      checkOutAt: null,
      expectedCheckOutAt,
      duration: null,
      autoCheckedOut: false,
      recordedBy: {
        userId: context.userId as ObjectId,
        name: context.userName,
        role: context.userRole,
      },
      checkedOutBy: null,
      method: data.method || 'manual',
      status: 'valid',
      timeSlot: getTimeSlot(hour),
      attendanceType: 'full_day',
      location: data.location,
      device: data.device,
      notes: data.notes,
    };
  }

  private calculateStats(member: AnyDocument, attendance: any, now: Date): AttendanceStats {
    const existing = (member as any).attendanceStats || {};

    // First visit
    const firstVisitedAt = existing.firstVisitedAt || now;

    // Calculate streak
    const { currentStreak, longestStreak } = calculateStreak(
      attendance.checkIns.map((c: CheckInEntry) => ({ timestamp: c.timestamp }))
    );

    // Total visits (increment by 1)
    const totalVisits = (existing.totalVisits || 0) + 1;

    // This month visits
    const thisMonthVisits = attendance.monthlyTotal;

    // Monthly average
    const monthsSince = Math.max(
      1,
      Math.ceil((now.getTime() - new Date(firstVisitedAt).getTime()) / (1000 * 60 * 60 * 24 * 30))
    );
    const monthlyAverage = Math.round(totalVisits / monthsSince);

    // Engagement level
    const engagementLevel = calculateEngagementLevel(thisMonthVisits, now);

    // Loyalty score
    const loyaltyScore = calculateLoyaltyScore({
      totalVisits,
      currentStreak,
      monthlyAverage,
      firstVisitedAt,
    });

    // Favorite time slot
    const timeSlots = attendance.checkIns.map((c: CheckInEntry) => c.timeSlot);
    const slotCounts = timeSlots.reduce((acc: Record<string, number>, slot: string) => {
      acc[slot] = (acc[slot] || 0) + 1;
      return acc;
    }, {});
    const favoriteTimeSlot = Object.entries(slotCounts).sort(
      (a, b) => (b[1] as number) - (a[1] as number)
    )[0]?.[0] as any;

    return {
      totalVisits,
      lastVisitedAt: now,
      firstVisitedAt,
      currentStreak,
      longestStreak,
      monthlyAverage,
      thisMonthVisits,
      lastMonthVisits: existing.lastMonthVisits || 0,
      engagementLevel,
      daysSinceLastVisit: 0,
      favoriteTimeSlot,
      loyaltyScore,
      updatedAt: now,
    };
  }

  private checkMilestones(events: EventBus, member: AnyDocument, stats: AttendanceStats): void {
    // Check visit milestones
    const visitMilestones = [10, 25, 50, 100, 250, 500, 1000];
    if (visitMilestones.includes(stats.totalVisits)) {
      events.emit('milestone:achieved', {
        type: 'milestone:achieved',
        data: {
          member: {
            id: (member as any)._id,
            name: (member as any).customer?.name || (member as any).name,
          },
          milestone: {
            type: 'visits',
            value: stats.totalVisits,
            message: `Congratulations! You've reached ${stats.totalVisits} visits!`,
          },
          stats,
        },
      });
    }

    // Check streak milestones
    if (isStreakMilestone(stats.currentStreak)) {
      events.emit('milestone:achieved', {
        type: 'milestone:achieved',
        data: {
          member: {
            id: (member as any)._id,
            name: (member as any).customer?.name || (member as any).name,
          },
          milestone: {
            type: 'streak',
            value: stats.currentStreak,
            message: `Amazing! ${stats.currentStreak}-day streak! 🔥`,
          },
          stats,
        },
      });
    }
  }
}

export default CheckInService;
