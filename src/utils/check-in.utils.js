/**
 * Check-In Utilities
 * Pure functions for check-in logic - easily testable, no dependencies
 */

export const isActiveCheckIn = (checkIn) => !checkIn.checkOutAt;

export const isExpiredCheckIn = (checkIn, now = new Date()) => {
  if (!checkIn.expectedCheckOutAt) return false;
  return new Date(checkIn.expectedCheckOutAt) < now;
};

export const findActiveSession = (checkIns) =>
  checkIns.find(isActiveCheckIn);

export const filterActiveCheckIns = (checkIns) =>
  checkIns.filter(isActiveCheckIn);

export const countActiveCheckIns = (checkIns) =>
  filterActiveCheckIns(checkIns).length;

export const calculateDuration = (startTime, endTime = new Date()) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return Math.floor((end - start) / (1000 * 60));
};

export const getCurrentPeriod = (date = new Date()) => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
});

export const groupByTargetModel = (items) =>
  items.reduce((acc, item) => {
    const model = item.targetModel || item._id;
    if (!acc[model]) {
      acc[model] = {
        count: 0,
        members: [],
      };
    }
    acc[model].count += item.count || 1;
    if (item.members) {
      acc[model].members.push(...item.members);
    }
    return acc;
  }, {});

export const calculateTotalCount = (groupedData) =>
  Object.values(groupedData).reduce((sum, group) => sum + group.count, 0);
