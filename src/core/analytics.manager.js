/**
 * 📊 Analytics Manager
 * Business intelligence for attendance data
 *
 * Provides:
 * - Member engagement reports
 * - Attendance trends
 * - Peak hours analysis
 * - Retention insights
 *
 * @module lib/attendance/core/analytics
 */

import mongoose from 'mongoose';
import { ENGAGEMENT_LEVEL } from '../enums.js';
import logger from '../utils/logger.js';

/**
 * Get attendance history for a member
 * @param {Object} params
 * @param {Model} params.AttendanceModel
 * @param {ObjectId} params.memberId
 * @param {ObjectId} params.organizationId
 * @param {Number} params.year
 * @param {Number} params.month
 * @returns {Promise<Object>} Attendance record
 */
export async function getMemberAttendanceHistory({
  AttendanceModel,
  memberId,
  organizationId,
  year,
  month,
  targetModel = 'Membership',
}) {
  const query = {
    tenantId: organizationId,
    targetModel,
    targetId: memberId,
  };
  
  if (year) query.year = year;
  if (month) query.month = month;
  
  const records = await AttendanceModel.find(query)
    .sort({ year: -1, month: -1 })
    .lean();
  
  return records;
}

/**
 * Get dashboard analytics
 * @param {Object} params
 * @param {Model} params.AttendanceModel
 * @param {Model} params.MemberModel
 * @param {ObjectId} params.organizationId
 * @param {Date} params.startDate
 * @param {Date} params.endDate
 * @returns {Promise<Object>} Dashboard data
 */
export async function getDashboardAnalytics({
  AttendanceModel,
  MemberModel,
  organizationId,
  startDate,
  endDate,
}) {
  const start = startDate ? new Date(startDate) : new Date(new Date().setDate(1)); // First day of month
  const end = endDate ? new Date(endDate) : new Date();
  
  // Convert organizationId to ObjectId for consistent querying
  const orgId = new mongoose.Types.ObjectId(organizationId);

  // Run queries in parallel for performance
  const [
    totalMembers,
    activeMembers,
    engagementDistribution,
    attendanceStats,
    topMembers,
    atRiskMembers,
  ] = await Promise.all([
    // Total members
    MemberModel.countDocuments({ organizationId: orgId, status: 'active' }),

    // Active members (visited this month)
    MemberModel.countDocuments({
      organizationId: orgId,
      'attendanceStats.thisMonthVisits': { $gt: 0 },
    }),

    // Engagement distribution
    getEngagementDistribution({ MemberModel, organizationId }),

    // Attendance stats for period
    AttendanceModel.getStatsForPeriod(organizationId, start, end),

    // Top members by visits
    getTopMembers({ MemberModel, organizationId, limit: 10 }),

    // At-risk members
    getAtRiskMembers({ MemberModel, organizationId, limit: 20 }),
  ]);
  
  // Calculate key metrics
  const activationRate = totalMembers > 0 
    ? Math.round((activeMembers / totalMembers) * 100) 
    : 0;
  
  const avgVisitsPerMember = activeMembers > 0
    ? Math.round(attendanceStats.totalCheckIns / activeMembers)
    : 0;
  
  return {
    summary: {
      totalMembers,
      activeMembers,
      activationRate,
      totalCheckIns: attendanceStats.totalCheckIns,
      avgVisitsPerMember,
      uniqueVisitors: attendanceStats.uniqueMembers,
    },
    engagementDistribution,
    topMembers,
    atRiskMembers,
    dateRange: {
      start,
      end,
    },
  };
}

/**
 * Get engagement distribution
 * @param {Object} params
 * @returns {Promise<Array>}
 */
async function getEngagementDistribution({ MemberModel, organizationId }) {
  const pipeline = [
    {
      $match: { organizationId: new mongoose.Types.ObjectId(organizationId) },
    },
    {
      $group: {
        _id: '$attendanceStats.engagementLevel',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        level: '$_id',
        count: 1,
        _id: 0,
      },
    },
    {
      $sort: { count: -1 },
    },
  ];
  
  return await MemberModel.aggregate(pipeline);
}

/**
 * Get top members by visits
 * @param {Object} params
 * @returns {Promise<Array>}
 */
async function getTopMembers({ MemberModel, organizationId, limit = 10 }) {
  return await MemberModel.find({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    'attendanceStats.thisMonthVisits': { $gt: 0 },
  })
    .select('customer attendanceStats')
    .sort({ 'attendanceStats.thisMonthVisits': -1 })
    .limit(limit)
    .lean();
}

/**
 * Get at-risk members (inactive for 14+ days)
 * @param {Object} params
 * @returns {Promise<Array>}
 */
async function getAtRiskMembers({ MemberModel, organizationId, limit = 20 }) {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  return await MemberModel.find({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    status: 'active',
    $or: [
      { 'attendanceStats.lastVisitedAt': { $lt: fourteenDaysAgo } },
      { 'attendanceStats.lastVisitedAt': { $exists: false } },
    ],
  })
    .select('customer attendanceStats')
    .sort({ 'attendanceStats.lastVisitedAt': 1 })
    .limit(limit)
    .lean();
}

/**
 * Get time slot distribution
 * @param {Object} params
 * @param {Model} params.AttendanceModel
 * @param {ObjectId} params.organizationId
 * @param {Date} params.startDate
 * @param {Date} params.endDate
 * @returns {Promise<Object>} Time slot distribution
 */
export async function getTimeSlotDistribution({
  AttendanceModel,
  organizationId,
  startDate,
  endDate,
}) {
  const start = startDate ? new Date(startDate) : new Date(new Date().setDate(1));
  const end = endDate ? new Date(endDate) : new Date();
  
  const pipeline = [
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(organizationId),
        'checkIns.timestamp': { $gte: start, $lte: end },
      },
    },
    {
      $project: {
        timeSlotDistribution: 1,
      },
    },
    {
      $group: {
        _id: null,
        early_morning: { $sum: '$timeSlotDistribution.early_morning' },
        morning: { $sum: '$timeSlotDistribution.morning' },
        afternoon: { $sum: '$timeSlotDistribution.afternoon' },
        evening: { $sum: '$timeSlotDistribution.evening' },
        night: { $sum: '$timeSlotDistribution.night' },
      },
    },
  ];
  
  const [result] = await AttendanceModel.aggregate(pipeline);
  
  return result || {
    early_morning: 0,
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  };
}

/**
 * Get daily attendance trend
 * @param {Object} params
 * @returns {Promise<Array>} Daily counts
 */
export async function getDailyAttendanceTrend({
  AttendanceModel,
  organizationId,
  days = 30,
}) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const endDate = new Date();
  
  const pipeline = [
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(organizationId),
      },
    },
    {
      $unwind: '$checkIns',
    },
    {
      $match: {
        'checkIns.timestamp': { $gte: startDate, $lte: endDate },
      },
    },
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
        _id: 0,
      },
    },
    {
      $sort: { date: 1 },
    },
  ];
  
  return await AttendanceModel.aggregate(pipeline);
}

/**
 * Recalculate stats for all members
 * Useful for data migrations or corrections
 * @param {Object} params
 * @returns {Promise<Object>} Results
 */
export async function recalculateAllStats({
  AttendanceModel,
  MemberModel,
  organizationId,
  memberIds = null,
}) {
  const query = { organizationId };
  if (memberIds && memberIds.length > 0) {
    query._id = { $in: memberIds.map(id => new mongoose.Types.ObjectId(id)) };
  }
  
  const members = await MemberModel.find(query);
  
  let updated = 0;
  let failed = 0;
  
  for (const member of members) {
    try {
      // Get all attendance records for this member
      const attendanceRecords = await AttendanceModel.find({
        tenantId: organizationId,
        targetId: member._id,
      }).sort({ year: 1, month: 1 });
      
      if (attendanceRecords.length === 0) {
        continue;
      }
      
      // Calculate fresh stats from records
      const stats = calculateStatsFromRecords(attendanceRecords);
      
      // Update member
      await MemberModel.updateOne(
        { _id: member._id },
        { $set: { attendanceStats: stats } }
      );
      
      updated++;
    } catch (error) {
      logger.error('Failed to recalculate stats for member', {
        memberId: member._id,
        error: error.message,
      });
      failed++;
    }
  }
  
  return { updated, failed, total: members.length };
}

/**
 * Calculate stats from attendance records
 * @param {Array} records - Attendance records
 * @returns {Object} Calculated stats
 */
function calculateStatsFromRecords(records) {
  let totalVisits = 0;
  let firstVisit = null;
  let lastVisit = null;
  let thisMonthVisits = 0;
  let lastMonthVisits = 0;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  
  for (const record of records) {
    totalVisits += record.monthlyTotal;
    
    // Get first and last visits
    if (record.checkIns.length > 0) {
      const firstCheckIn = new Date(record.checkIns[0].timestamp);
      const lastCheckIn = new Date(record.checkIns[record.checkIns.length - 1].timestamp);
      
      if (!firstVisit || firstCheckIn < firstVisit) {
        firstVisit = firstCheckIn;
      }
      if (!lastVisit || lastCheckIn > lastVisit) {
        lastVisit = lastCheckIn;
      }
    }
    
    // This month visits
    if (record.year === currentYear && record.month === currentMonth) {
      thisMonthVisits = record.monthlyTotal;
    }
    
    // Last month visits
    if (record.year === lastMonthYear && record.month === lastMonth) {
      lastMonthVisits = record.monthlyTotal;
    }
  }
  
  // Calculate monthly average
  const monthsSinceFirst = firstVisit
    ? Math.max(1, Math.ceil((now - firstVisit) / (1000 * 60 * 60 * 24 * 30)))
    : 1;
  const monthlyAverage = Math.round(totalVisits / monthsSinceFirst);
  
  // Calculate days since last visit
  const daysSinceLastVisit = lastVisit
    ? Math.floor((now - lastVisit) / (1000 * 60 * 60 * 24))
    : 999;
  
  // Determine engagement level
  let engagementLevel = ENGAGEMENT_LEVEL.INACTIVE;
  if (daysSinceLastVisit >= 30) engagementLevel = ENGAGEMENT_LEVEL.DORMANT;
  else if (daysSinceLastVisit >= 14) engagementLevel = ENGAGEMENT_LEVEL.AT_RISK;
  else if (thisMonthVisits >= 12) engagementLevel = ENGAGEMENT_LEVEL.HIGHLY_ACTIVE;
  else if (thisMonthVisits >= 8) engagementLevel = ENGAGEMENT_LEVEL.ACTIVE;
  else if (thisMonthVisits >= 4) engagementLevel = ENGAGEMENT_LEVEL.REGULAR;
  else if (thisMonthVisits >= 1) engagementLevel = ENGAGEMENT_LEVEL.OCCASIONAL;
  
  return {
    totalVisits,
    firstVisitedAt: firstVisit,
    lastVisitedAt: lastVisit,
    thisMonthVisits,
    lastMonthVisits,
    monthlyAverage,
    daysSinceLastVisit,
    engagementLevel,
    currentStreak: 0, // Would need day-by-day calculation
    longestStreak: 0,
    loyaltyScore: 0,
    updatedAt: now,
  };
}

export default {
  getMemberAttendanceHistory,
  getDashboardAnalytics,
  getTimeSlotDistribution,
  getDailyAttendanceTrend,
  recalculateAllStats,
};

