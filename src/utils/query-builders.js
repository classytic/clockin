/**
 * MongoDB Query Builders
 * Reusable query construction for attendance operations
 */

import mongoose from 'mongoose';

export const toObjectId = (id) => new mongoose.Types.ObjectId(id);

export const buildAttendanceMatch = ({ organizationId, targetModel, targetId, year, month }) => {
  const match = { tenantId: toObjectId(organizationId) };

  if (targetModel) match.targetModel = targetModel;
  if (targetId) match.targetId = toObjectId(targetId);
  if (year) match.year = year;
  if (month) match.month = month;

  return match;
};

export const buildMemberMatch = ({ organizationId, status, additionalFilters = {} }) => {
  const match = { organizationId: toObjectId(organizationId) };

  if (status) {
    match.status = Array.isArray(status) ? { $in: status } : status;
  }

  return { ...match, ...additionalFilters };
};

export const buildOccupancyPipeline = (match) => [
  { $match: match },
  { $unwind: '$checkIns' },
  {
    $match: {
      'checkIns.checkOutAt': null
    }
  },
  {
    $group: {
      _id: '$targetModel',
      count: { $sum: 1 },
      members: { $push: '$targetId' },
    },
  },
];

export const buildStatsAggregation = ({ organizationId, startDate, endDate }) => {
  const match = { organizationId: toObjectId(organizationId) };

  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  return [
    { $match: match },
    {
      $group: {
        _id: null,
        totalMembers: { $sum: 1 },
        activeMembers: {
          $sum: {
            $cond: [{ $gt: ['$attendanceStats.thisMonthVisits', 0] }, 1, 0]
          }
        },
      },
    },
  ];
};

export const buildCurrentSessionQuery = ({ organizationId, isActive }) => {
  const query = { organizationId: toObjectId(organizationId) };

  if (isActive !== undefined) {
    query['currentSession.isActive'] = isActive;
  }

  return query;
};
