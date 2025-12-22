/**
 * ClockIn Analytics Service
 *
 * Handles all analytics and reporting operations
 *
 * @module @classytic/clockin/services/analytics
 */

import mongoose from 'mongoose';
import { Container } from '../core/container.js';
import { Result, ok, err } from '../core/result.js';
import { ClockInError, ValidationError } from '../errors/index.js';
import { toObjectId, buildAttendanceMatch } from '../utils/query-builders.js';
import { getLogger } from '../utils/logger.js';
import type { ClientSession } from 'mongoose';
import type { Logger } from '../types.js';
import type {
  DashboardParams,
  DashboardResult,
  DashboardSummary,
  HistoryParams,
  AttendanceRecord,
  DailyTrendEntry,
  PeriodStats,
  ObjectIdLike,
  EngagementLevel,
} from '../types.js';

// ============================================================================
// SERVICE CLASS
// ============================================================================

/**
 * Analytics Service
 *
 * Provides attendance analytics and reporting
 */
export class AnalyticsService {
  private container: Container;
  private logger: Logger;

  constructor(container: Container) {
    this.container = container;
    this.logger = container.has('logger') ? container.get<Logger>('logger') : getLogger();
  }

  // ============================================================================
  // DASHBOARD
  // ============================================================================

  /**
   * Get dashboard analytics
   */
  async dashboard(params: DashboardParams): Promise<Result<DashboardResult, ClockInError>> {
    const { MemberModel, organizationId, startDate, endDate } = params;

    if (!organizationId) {
      return err(new ValidationError('organizationId is required'));
    }

    try {
      const orgId = toObjectId(organizationId);
      const now = new Date();
      const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
      const end = endDate || now;

      // Get summary stats
      const summary = await this.getSummary(MemberModel, orgId, start, end);

      // Get engagement distribution
      const engagementDistribution = await this.getEngagementDistribution(MemberModel, orgId);

      // Get top members
      const topMembers = await this.getTopMembers(MemberModel, orgId, 10);

      // Get at-risk members
      const atRiskMembers = await this.getAtRiskMembers(MemberModel, orgId, 10);

      return ok({
        summary,
        engagementDistribution,
        topMembers,
        atRiskMembers,
        dateRange: { start, end },
      });
    } catch (error) {
      this.logger.error('Dashboard analytics failed', { error, organizationId });
      return err(new ClockInError('ATTENDANCE_ERROR', 500, (error as Error).message));
    }
  }

  // ============================================================================
  // HISTORY
  // ============================================================================

  /**
   * Get member attendance history
   */
  async history(params: HistoryParams): Promise<Result<AttendanceRecord[], ClockInError>> {
    const { targetId, organizationId, year, month, targetModel } = params;

    if (!organizationId) {
      return err(new ValidationError('organizationId is required'));
    }

    try {
      const AttendanceModel = this.container.get<mongoose.Model<any>>('AttendanceModel');

      const match = buildAttendanceMatch({
        organizationId,
        targetModel,
        year,
        month,
      });

      match.targetId = toObjectId(targetId);

      const records = await AttendanceModel.find(match)
        .sort({ year: -1, month: -1 })
        .limit(12);

      return ok(records);
    } catch (error) {
      this.logger.error('History fetch failed', { error, targetId });
      return err(new ClockInError('ATTENDANCE_ERROR', 500, (error as Error).message));
    }
  }

  // ============================================================================
  // TRENDS
  // ============================================================================

  /**
   * Get daily attendance trend
   */
  async dailyTrend(params: {
    organizationId: ObjectIdLike;
    days?: number;
    targetModel?: string;
  }): Promise<Result<DailyTrendEntry[], ClockInError>> {
    const { organizationId, days = 30, targetModel } = params;

    try {
      const AttendanceModel = this.container.get<mongoose.Model<any>>('AttendanceModel');

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const match: any = {
        tenantId: toObjectId(organizationId),
        'checkIns.timestamp': { $gte: startDate },
      };

      if (targetModel) {
        match.targetModel = targetModel;
      }

      const result = await AttendanceModel.aggregate([
        { $match: match },
        { $unwind: '$checkIns' },
        { $match: { 'checkIns.timestamp': { $gte: startDate } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$checkIns.timestamp' },
            },
            count: { $sum: 1 },
            uniqueMembers: { $addToSet: '$targetId' },
          },
        },
        {
          $project: {
            date: '$_id',
            count: 1,
            uniqueMembers: { $size: '$uniqueMembers' },
          },
        },
        { $sort: { date: 1 } },
      ]);

      return ok(result);
    } catch (error) {
      this.logger.error('Daily trend fetch failed', { error, organizationId });
      return err(new ClockInError('ATTENDANCE_ERROR', 500, (error as Error).message));
    }
  }

  /**
   * Get period statistics
   */
  async periodStats(params: {
    organizationId: ObjectIdLike;
    year: number;
    month: number;
    targetModel?: string;
  }): Promise<Result<PeriodStats, ClockInError>> {
    const { organizationId, year, month, targetModel } = params;

    try {
      const AttendanceModel = this.container.get<mongoose.Model<any>>('AttendanceModel');

      const match: any = {
        tenantId: toObjectId(organizationId),
        year,
        month,
      };

      if (targetModel) {
        match.targetModel = targetModel;
      }

      const result = await AttendanceModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalCheckIns: { $sum: '$monthlyTotal' },
            uniqueMembers: { $addToSet: '$targetId' },
          },
        },
        {
          $project: {
            totalCheckIns: 1,
            uniqueMembers: { $size: '$uniqueMembers' },
            avgCheckInsPerMember: {
              $cond: [
                { $gt: [{ $size: '$uniqueMembers' }, 0] },
                { $divide: ['$totalCheckIns', { $size: '$uniqueMembers' }] },
                0,
              ],
            },
          },
        },
      ]);

      return ok(
        result[0] || {
          totalCheckIns: 0,
          uniqueMembers: 0,
          avgCheckInsPerMember: 0,
        }
      );
    } catch (error) {
      this.logger.error('Period stats fetch failed', { error, organizationId });
      return err(new ClockInError('ATTENDANCE_ERROR', 500, (error as Error).message));
    }
  }

  // ============================================================================
  // TIME SLOT DISTRIBUTION
  // ============================================================================

  /**
   * Get time slot distribution
   */
  async timeSlotDistribution(params: {
    organizationId: ObjectIdLike;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Result<Record<string, number>, ClockInError>> {
    const { organizationId, startDate, endDate } = params;

    try {
      const AttendanceModel = this.container.get<mongoose.Model<any>>('AttendanceModel');

      const now = new Date();
      const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
      const end = endDate || now;

      const result = await AttendanceModel.aggregate([
        {
          $match: {
            tenantId: toObjectId(organizationId),
            'checkIns.timestamp': { $gte: start, $lte: end },
          },
        },
        { $unwind: '$checkIns' },
        {
          $match: {
            'checkIns.timestamp': { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: '$checkIns.timeSlot',
            count: { $sum: 1 },
          },
        },
      ]);

      const distribution: Record<string, number> = {
        early_morning: 0,
        morning: 0,
        afternoon: 0,
        evening: 0,
        night: 0,
      };

      for (const item of result) {
        if (item._id && item._id in distribution) {
          distribution[item._id] = item.count;
        }
      }

      return ok(distribution);
    } catch (error) {
      this.logger.error('Time slot distribution fetch failed', { error, organizationId });
      return err(new ClockInError('ATTENDANCE_ERROR', 500, (error as Error).message));
    }
  }

  // ============================================================================
  // STATS RECALCULATION
  // ============================================================================

  /**
   * Recalculate stats for members
   *
   * @param params.session - Optional MongoDB session for transaction support
   */
  async recalculateStats(params: {
    MemberModel: mongoose.Model<any>;
    organizationId: ObjectIdLike;
    memberIds?: ObjectIdLike[];
    session?: ClientSession;
  }): Promise<Result<{ processed: number; updated: number }, ClockInError>> {
    const { MemberModel, organizationId, memberIds, session } = params;

    try {
      const AttendanceModel = this.container.get<mongoose.Model<any>>('AttendanceModel');

      // Build member query
      const memberQuery: any = { organizationId: toObjectId(organizationId) };
      if (memberIds && memberIds.length > 0) {
        memberQuery._id = { $in: memberIds.map((id) => toObjectId(id)) };
      }

      const members = await MemberModel.find(memberQuery).select('_id');
      let processed = 0;
      let updated = 0;

      for (const member of members) {
        processed++;

        // Get all attendance records for this member
        const records = await AttendanceModel.find({
          tenantId: toObjectId(organizationId),
          targetId: member._id,
        }).sort({ year: 1, month: 1 });

        if (records.length === 0) continue;

        // Calculate total visits
        const totalVisits = records.reduce((sum, r) => sum + (r.monthlyTotal || 0), 0);

        // Get all check-ins sorted by date
        const allCheckIns = records
          .flatMap((r) => r.checkIns || [])
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        if (allCheckIns.length === 0) continue;

        // Calculate stats
        const firstVisit = allCheckIns[0].timestamp;
        const lastVisit = allCheckIns[allCheckIns.length - 1].timestamp;

        // Current month visits
        const now = new Date();
        const currentMonthRecord = records.find(
          (r) => r.year === now.getFullYear() && r.month === now.getMonth() + 1
        );
        const thisMonthVisits = currentMonthRecord?.monthlyTotal || 0;

        // Calculate streak
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 1;
        let lastDate: Date | null = null;

        for (const checkIn of allCheckIns) {
          const checkInDate = new Date(checkIn.timestamp);
          checkInDate.setHours(0, 0, 0, 0);

          if (lastDate) {
            const daysDiff = Math.floor(
              (checkInDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (daysDiff === 1) {
              tempStreak++;
            } else if (daysDiff > 1) {
              longestStreak = Math.max(longestStreak, tempStreak);
              tempStreak = 1;
            }
          }

          lastDate = checkInDate;
        }

        longestStreak = Math.max(longestStreak, tempStreak);

        // Check if last visit was recent for current streak
        const daysSinceLastVisit = Math.floor(
          (now.getTime() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24)
        );

        currentStreak = daysSinceLastVisit <= 1 ? tempStreak : 0;

        // Determine engagement level
        let engagementLevel: EngagementLevel = 'inactive';
        if (daysSinceLastVisit >= 30) {
          engagementLevel = 'dormant';
        } else if (daysSinceLastVisit >= 14) {
          engagementLevel = 'at_risk';
        } else if (thisMonthVisits >= 12) {
          engagementLevel = 'highly_active';
        } else if (thisMonthVisits >= 8) {
          engagementLevel = 'active';
        } else if (thisMonthVisits >= 4) {
          engagementLevel = 'regular';
        } else if (thisMonthVisits >= 1) {
          engagementLevel = 'occasional';
        }

        // Update member (with optional session for transaction support)
        await MemberModel.updateOne(
          { _id: member._id },
          {
            $set: {
              'attendanceStats.totalVisits': totalVisits,
              'attendanceStats.firstVisitedAt': firstVisit,
              'attendanceStats.lastVisitedAt': lastVisit,
              'attendanceStats.currentStreak': currentStreak,
              'attendanceStats.longestStreak': longestStreak,
              'attendanceStats.thisMonthVisits': thisMonthVisits,
              'attendanceStats.engagementLevel': engagementLevel,
              'attendanceStats.daysSinceLastVisit': daysSinceLastVisit,
              'attendanceStats.updatedAt': now,
            },
          },
          { session } // Pass session for transaction support
        );

        updated++;
      }

      this.logger.info('Stats recalculation complete', { processed, updated });

      return ok({ processed, updated });
    } catch (error) {
      this.logger.error('Stats recalculation failed', { error, organizationId });
      return err(new ClockInError('ATTENDANCE_ERROR', 500, (error as Error).message));
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async getSummary(
    MemberModel: mongoose.Model<any>,
    organizationId: mongoose.Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<DashboardSummary> {
    const AttendanceModel = this.container.get<mongoose.Model<any>>('AttendanceModel');

    // Total members
    const totalMembers = await MemberModel.countDocuments({
      organizationId,
      status: { $in: ['active', 'pending'] },
    });

    // Active members (visited this month)
    const activeMembers = await MemberModel.countDocuments({
      organizationId,
      status: { $in: ['active', 'pending'] },
      'attendanceStats.thisMonthVisits': { $gt: 0 },
    });

    // Total check-ins in period
    const checkInResult = await AttendanceModel.aggregate([
      {
        $match: {
          tenantId: organizationId,
          'checkIns.timestamp': { $gte: startDate, $lte: endDate },
        },
      },
      { $unwind: '$checkIns' },
      {
        $match: {
          'checkIns.timestamp': { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$targetId' },
        },
      },
    ]);

    const totalCheckIns = checkInResult[0]?.total || 0;
    const uniqueVisitors = checkInResult[0]?.uniqueVisitors?.length || 0;
    const activationRate = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0;
    const avgVisitsPerMember = uniqueVisitors > 0 ? Math.round(totalCheckIns / uniqueVisitors) : 0;

    return {
      totalMembers,
      activeMembers,
      activationRate,
      totalCheckIns,
      avgVisitsPerMember,
      uniqueVisitors,
    };
  }

  private async getEngagementDistribution(
    MemberModel: mongoose.Model<any>,
    organizationId: mongoose.Types.ObjectId
  ) {
    const result = await MemberModel.aggregate([
      {
        $match: {
          organizationId,
          status: { $in: ['active', 'pending'] },
        },
      },
      {
        $group: {
          _id: '$attendanceStats.engagementLevel',
          count: { $sum: 1 },
        },
      },
    ]);

    return result.map((r) => ({
      level: r._id as EngagementLevel | null,
      count: r.count,
    }));
  }

  private async getTopMembers(
    MemberModel: mongoose.Model<any>,
    organizationId: mongoose.Types.ObjectId,
    limit: number
  ) {
    return MemberModel.find({
      organizationId,
      status: { $in: ['active', 'pending'] },
      'attendanceStats.totalVisits': { $gt: 0 },
    })
      .sort({ 'attendanceStats.thisMonthVisits': -1 })
      .limit(limit)
      .select('_id customer attendanceStats')
      .lean();
  }

  private async getAtRiskMembers(
    MemberModel: mongoose.Model<any>,
    organizationId: mongoose.Types.ObjectId,
    limit: number
  ) {
    return MemberModel.find({
      organizationId,
      status: { $in: ['active', 'pending'] },
      'attendanceStats.engagementLevel': { $in: ['at_risk', 'dormant'] },
    })
      .sort({ 'attendanceStats.lastVisitedAt': 1 })
      .limit(limit)
      .select('_id customer attendanceStats')
      .lean();
  }
}

export default AnalyticsService;

