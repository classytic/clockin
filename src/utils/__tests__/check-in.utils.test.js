/**
 * Unit Tests for Check-In Utilities
 * Example tests showing how pure functions are easily testable
 */

import {
  isActiveCheckIn,
  isExpiredCheckIn,
  findActiveSession,
  calculateDuration,
  getCurrentPeriod,
} from '../check-in.utils.js';

describe('Check-In Utilities', () => {
  describe('isActiveCheckIn', () => {
    it('should return true when checkOutAt is null', () => {
      const checkIn = { checkOutAt: null };
      expect(isActiveCheckIn(checkIn)).toBe(true);
    });

    it('should return false when checkOutAt is set', () => {
      const checkIn = { checkOutAt: new Date() };
      expect(isActiveCheckIn(checkIn)).toBe(false);
    });
  });

  describe('isExpiredCheckIn', () => {
    it('should return true when expectedCheckOutAt has passed', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const checkIn = { expectedCheckOutAt: yesterday };
      expect(isExpiredCheckIn(checkIn)).toBe(true);
    });

    it('should return false when expectedCheckOutAt is in future', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const checkIn = { expectedCheckOutAt: tomorrow };
      expect(isExpiredCheckIn(checkIn)).toBe(false);
    });

    it('should return false when expectedCheckOutAt is not set', () => {
      const checkIn = { expectedCheckOutAt: null };
      expect(isExpiredCheckIn(checkIn)).toBe(false);
    });
  });

  describe('findActiveSession', () => {
    it('should find first active check-in', () => {
      const checkIns = [
        { _id: '1', checkOutAt: new Date() },
        { _id: '2', checkOutAt: null },
        { _id: '3', checkOutAt: null },
      ];
      const active = findActiveSession(checkIns);
      expect(active._id).toBe('2');
    });

    it('should return undefined when no active sessions', () => {
      const checkIns = [
        { _id: '1', checkOutAt: new Date() },
        { _id: '2', checkOutAt: new Date() },
      ];
      const active = findActiveSession(checkIns);
      expect(active).toBeUndefined();
    });
  });

  describe('calculateDuration', () => {
    it('should calculate duration in minutes', () => {
      const start = new Date('2025-01-01T10:00:00Z');
      const end = new Date('2025-01-01T10:30:00Z');
      expect(calculateDuration(start, end)).toBe(30);
    });

    it('should use current time when end not provided', () => {
      const start = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
      const duration = calculateDuration(start);
      expect(duration).toBeGreaterThanOrEqual(14);
      expect(duration).toBeLessThanOrEqual(16);
    });
  });

  describe('getCurrentPeriod', () => {
    it('should return current year and month', () => {
      const date = new Date('2025-11-15');
      const period = getCurrentPeriod(date);
      expect(period).toEqual({ year: 2025, month: 11 });
    });

    it('should use current date when not provided', () => {
      const period = getCurrentPeriod();
      expect(period.year).toBeGreaterThan(2024);
      expect(period.month).toBeGreaterThanOrEqual(1);
      expect(period.month).toBeLessThanOrEqual(12);
    });
  });
});
