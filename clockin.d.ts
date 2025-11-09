/**
 * Type definitions for @classytic/clockin
 * Multi-tenant attendance tracking library for Node.js applications
 */

import { Model, Document, Types } from 'mongoose';

// ============ CONFIGURATION ============

export interface AttendanceConfig {
  AttendanceModel: Model<any>;
  configs?: Record<string, any>;
  logger?: any;
}

export function initializeAttendance(config: AttendanceConfig): void;
export function isInitialized(): boolean;
export function setLogger(logger: any): void;

// ============ ENUMS ============

export const ATTENDANCE_STATUS: {
  ACTIVE: 'active';
  INACTIVE: 'inactive';
  EXPIRED: 'expired';
};
export type AttendanceStatusType = 'active' | 'inactive' | 'expired';
export const ATTENDANCE_STATUS_VALUES: AttendanceStatusType[];

export const CHECK_IN_METHOD: {
  MANUAL: 'manual';
  QR: 'qr';
  NFC: 'nfc';
  BIOMETRIC: 'biometric';
  CARD: 'card';
};
export type CheckInMethodType = 'manual' | 'qr' | 'nfc' | 'biometric' | 'card';
export const CHECK_IN_METHOD_VALUES: CheckInMethodType[];

export const ENGAGEMENT_LEVEL: {
  ACTIVE: 'active';
  AT_RISK: 'at_risk';
  INACTIVE: 'inactive';
  CHURNED: 'churned';
};
export type EngagementLevelType = 'active' | 'at_risk' | 'inactive' | 'churned';
export const ENGAGEMENT_LEVEL_VALUES: EngagementLevelType[];

export const ATTENDANCE_PERIOD: {
  TODAY: 'today';
  WEEK: 'week';
  MONTH: 'month';
  YEAR: 'year';
};
export type AttendancePeriodType = 'today' | 'week' | 'month' | 'year';
export const ATTENDANCE_PERIOD_VALUES: AttendancePeriodType[];

export const ATTENDANCE_TARGET_MODELS: {
  MEMBERSHIP: 'Membership';
  EMPLOYEE: 'Employee';
  USER: 'User';
};
export type TargetModelType = 'Membership' | 'Employee' | 'User';
export const ATTENDANCE_TARGET_MODEL_VALUES: TargetModelType[];

export const ATTENDANCE_TYPE: {
  FULL_DAY: 'full_day';
  HALF_DAY: 'half_day';
  PAID_LEAVE: 'paid_leave';
  OVERTIME: 'overtime';
  ABSENT: 'absent';
};
export type AttendanceTypeType = 'full_day' | 'half_day' | 'paid_leave' | 'overtime' | 'absent';
export const ATTENDANCE_TYPE_VALUES: AttendanceTypeType[];

export const TIME_SLOT: {
  EARLY_MORNING: 'early_morning';
  MORNING: 'morning';
  AFTERNOON: 'afternoon';
  EVENING: 'evening';
  NIGHT: 'night';
};
export type TimeSlotType = 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night';
export const TIME_SLOT_VALUES: TimeSlotType[];

export function getEngagementLevel(daysSinceLastVisit: number): EngagementLevelType;
export function getTimeSlot(hour: number): TimeSlotType;
export function calculateWorkDays(checkIns: any[]): number;

// ============ CORE TYPES ============

export interface CheckInParams {
  member: any;
  targetModel: TargetModelType;
  data?: {
    method?: CheckInMethodType;
    location?: string;
    notes?: string;
  };
  context?: {
    organizationId: string;
    userId?: string;
    ipAddress?: string;
  };
}

export interface CheckOutParams {
  member: any;
  targetModel: TargetModelType;
  context?: {
    organizationId: string;
    userId?: string;
  };
}

export interface DashboardParams {
  MemberModel: Model<any>;
  organizationId: string;
  period?: AttendancePeriodType;
  filters?: Record<string, any>;
}

export interface HistoryParams {
  memberId: string;
  organizationId: string;
  year?: number;
  month?: number;
  limit?: number;
  offset?: number;
}

export interface AttendanceStats {
  totalCheckIns: number;
  currentStreak: number;
  longestStreak: number;
  lastVisit: string | null;
  engagementLevel: EngagementLevelType;
  uniqueDaysVisited?: number;
  monthlyTotal?: number;
}

export interface CheckInEntry {
  date: Date;
  checkOutTime?: Date;
  type: AttendanceTypeType;
  method?: CheckInMethodType;
  location?: string;
  notes?: string;
  duration?: number;
}

export interface CorrectionRequestParams {
  requestType: 'update_check_in_time' | 'update_check_out_time' | 'add_missing_attendance' | 'delete_duplicate' | 'override_attendance_type';
  targetDate: string;
  proposedChanges?: Record<string, any>;
  reason?: string;
}

// ============ ORCHESTRATOR ============

export interface AttendanceOrchestrator {
  checkIn(params: CheckInParams): Promise<any>;
  checkOut(params: CheckOutParams): Promise<any>;
  dashboard(params: DashboardParams): Promise<any>;
  history(params: HistoryParams): Promise<any>;
  getStats(member: any): AttendanceStats;
  recalculateStats(params: { MemberModel: Model<any>; organizationId: string }): Promise<void>;
}

export const attendance: AttendanceOrchestrator;

// ============ ERRORS ============

export class AttendanceError extends Error {
  constructor(message: string);
}

export class DuplicateCheckInError extends AttendanceError {
  constructor(message: string);
}

export class MemberNotFoundError extends AttendanceError {
  constructor(message: string);
}

export class InvalidMemberError extends AttendanceError {
  constructor(message: string);
}

export class ValidationError extends AttendanceError {
  constructor(message: string);
}

export class NotInitializedError extends AttendanceError {
  constructor(message: string);
}

export class AttendanceNotEnabledError extends AttendanceError {
  constructor(message: string);
}

// ============ UTILITIES ============

export function calculateStreak(checkIns: CheckInEntry[]): number;
export function isStreakMilestone(streak: number): boolean;
export function getNextStreakMilestone(currentStreak: number): number;
export function daysUntilStreakBreaks(lastVisit: Date): number;

export function calculateEngagementLevel(daysSinceLastVisit: number): EngagementLevelType;
export function calculateDaysSinceLastVisit(lastVisit: Date): number;
export function calculateLoyaltyScore(stats: AttendanceStats): number;
export function hasEngagementChanged(oldLevel: EngagementLevelType, newLevel: EngagementLevelType): boolean;
export function getEngagementSeverity(level: EngagementLevelType): 'low' | 'medium' | 'high' | 'critical';

export function calculateAttendanceStats(checkIns: CheckInEntry[]): AttendanceStats;
export function calculateGrowthRate(current: number, previous: number): number;
export function calculateMilestonesReached(stats: AttendanceStats): string[];
export function getNextMilestone(stats: AttendanceStats): string | null;

export function validateCheckInEligibility(member: any): boolean;
export function validateTargetModel(model: string): boolean;
export function validateCheckInMethod(method: string): boolean;
export function validateOrganizationId(id: string): boolean;
export function validatePagination(limit: number, offset: number): boolean;
export function validateDateRange(startDate: Date, endDate: Date): boolean;

export function isActiveCheckIn(checkIn: CheckInEntry): boolean;
export function isExpiredCheckIn(checkIn: CheckInEntry, maxDuration?: number): boolean;
export function findActiveSession(checkIns: CheckInEntry[]): CheckInEntry | null;
export function filterActiveCheckIns(checkIns: CheckInEntry[]): CheckInEntry[];
export function countActiveCheckIns(checkIns: CheckInEntry[]): number;
export function calculateDuration(checkIn: CheckInEntry, checkOut: CheckInEntry): number;
export function getCurrentPeriod(): { year: number; month: number };
export function groupByTargetModel(checkIns: CheckInEntry[]): Record<string, CheckInEntry[]>;
export function calculateTotalCount(checkIns: CheckInEntry[]): number;

// ============ SCHEDULE UTILITIES ============

export namespace scheduleUtils {
  export function calculateStandardHours(schedule: any): number;
  export function calculateThresholds(standardHours: number): { fullDay: number; halfDay: number };
  export function calculateExpectedCheckout(checkInTime: Date, standardHours: number): Date;
  export function parseTime(timeString: string): { hours: number; minutes: number };
  export function isWorkingDay(date: Date, schedule: any): boolean;
  export function isWithinShift(time: Date, schedule: any): boolean;
  export function formatSchedule(schedule: any): string;
}

export function calculateStandardHours(schedule: any): number;
export function calculateThresholds(standardHours: number): { fullDay: number; halfDay: number };
export function calculateExpectedCheckout(checkInTime: Date, standardHours: number): Date;
export function parseTime(timeString: string): { hours: number; minutes: number };
export function isWorkingDay(date: Date, schedule: any): boolean;
export function isWithinShift(time: Date, schedule: any): boolean;
export function formatSchedule(schedule: any): string;

// ============ DETECTION UTILITIES ============

export function detectAttendanceType(checkIn: CheckInEntry, schedule: any): AttendanceTypeType;
export function validateSchedule(checkIn: CheckInEntry, schedule: any): { valid: boolean; errors: string[] };

// ============ QUERY BUILDERS ============

export function toObjectId(id: string): Types.ObjectId;
export function buildAttendanceMatch(filters: any): any;
export function buildMemberMatch(filters: any): any;
export function buildOccupancyPipeline(organizationId: string): any[];
export function buildStatsAggregation(organizationId: string): any[];
export function buildCurrentSessionQuery(memberId: string, targetModel: TargetModelType): any;

// ============ SESSION SERVICE ============

export class SessionService {
  constructor(AttendanceModel: Model<any>);
  findActiveSession(memberId: string, targetModel: TargetModelType): Promise<any>;
  createSession(params: CheckInParams): Promise<any>;
  endSession(memberId: string, targetModel: TargetModelType): Promise<any>;
  getSessionDuration(sessionId: string): Promise<number>;
}

export function createSessionService(AttendanceModel: Model<any>): SessionService;

// ============ EVENTS ============

export const attendanceEvents: {
  on(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
  off(event: string, listener: (...args: any[]) => void): void;
};

// ============ WEBHOOKS ============

export const webhookManager: {
  register(url: string, events: string[]): void;
  unregister(url: string): void;
  trigger(event: string, data: any): Promise<void>;
};

// ============ CONFIGURATIONS ============

export function getConfig(targetModel: TargetModelType): any;
export function registerConfig(targetModel: TargetModelType, config: any): void;
export function hasConfig(targetModel: TargetModelType): boolean;
export function getRegisteredModels(): TargetModelType[];

export const ENGAGEMENT_THRESHOLDS: {
  ACTIVE: number;
  AT_RISK: number;
  INACTIVE: number;
  CHURNED: number;
};

export const STATS_CONFIG: any;
export const AGGREGATION_CONFIG: any;
export const STREAK_CONFIG: any;
export const CHECK_IN_RULES: any;
export const ANALYTICS_CONFIG: any;
export const NOTIFICATION_CONFIG: any;
export const SUPPORTED_MODELS: TargetModelType[];
export const DEFAULT_CHECK_IN_METHOD: CheckInMethodType;

export function getEngagementLevelFromVisits(visits: number, period: AttendancePeriodType): EngagementLevelType;
export function validateCheckInTiming(lastCheckIn: Date, newCheckIn: Date): boolean;
export function isAttendanceSupported(model: string): boolean;

// ============ SCHEMAS ============

export const checkInEntrySchema: any;
export const currentSessionSchema: any;
export const attendanceStatsSchema: any;
export const monthlyAttendanceSummarySchema: any;
export const attendancePatternSchema: any;
export const commonAttendanceFields: any;
export const attendanceIndexes: any;
export function applyAttendanceIndexes(schema: any): void;

export const checkInBody: any;
export const checkInResponse: any;
export const attendanceHistoryQuery: any;
export const analyticsQuery: any;
export const bulkCheckInBody: any;
export const updateStatsBody: any;

// ============ MODELS ============

export const AttendanceModel: Model<any>;

// ============ CORE MANAGERS ============

export namespace CheckIn {
  export function validateCheckIn(params: CheckInParams): Promise<void>;
  export function createCheckInEntry(params: CheckInParams): CheckInEntry;
  export function recordCheckIn(params: CheckInParams): Promise<any>;
  export function calculateUpdatedStats(member: any, checkIn: CheckInEntry): AttendanceStats;
  export function bulkRecordCheckIns(params: CheckInParams[]): Promise<any[]>;
}

export function validateCheckIn(params: CheckInParams): Promise<void>;
export function createCheckInEntry(params: CheckInParams): CheckInEntry;
export function recordCheckIn(params: CheckInParams): Promise<any>;
export function calculateUpdatedStats(member: any, checkIn: CheckInEntry): AttendanceStats;
export function bulkRecordCheckIns(params: CheckInParams[]): Promise<any[]>;

export namespace Analytics {
  export function getMemberAttendanceHistory(params: HistoryParams): Promise<any>;
  export function getDashboardAnalytics(params: DashboardParams): Promise<any>;
  export function getTimeSlotDistribution(organizationId: string, period: AttendancePeriodType): Promise<any>;
  export function getDailyAttendanceTrend(organizationId: string, days: number): Promise<any>;
  export function recalculateAllStats(organizationId: string, MemberModel: Model<any>): Promise<void>;
}

export function getMemberAttendanceHistory(params: HistoryParams): Promise<any>;
export function getDashboardAnalytics(params: DashboardParams): Promise<any>;
export function getTimeSlotDistribution(organizationId: string, period: AttendancePeriodType): Promise<any>;
export function getDailyAttendanceTrend(organizationId: string, days: number): Promise<any>;
export function recalculateAllStats(organizationId: string, MemberModel: Model<any>): Promise<void>;

export namespace Correction {
  export function updateCheckInTime(attendanceId: string, checkInId: string, newTime: Date): Promise<any>;
  export function updateCheckOutTime(attendanceId: string, checkInId: string, newTime: Date): Promise<any>;
  export function overrideAttendanceType(attendanceId: string, checkInId: string, newType: AttendanceTypeType): Promise<any>;
  export function deleteCheckIn(attendanceId: string, checkInId: string): Promise<any>;
  export function addRetroactiveAttendance(params: any): Promise<any>;
}

export function updateCheckInTime(attendanceId: string, checkInId: string, newTime: Date): Promise<any>;
export function updateCheckOutTime(attendanceId: string, checkInId: string, newTime: Date): Promise<any>;
export function overrideAttendanceType(attendanceId: string, checkInId: string, newType: AttendanceTypeType): Promise<any>;
export function deleteCheckIn(attendanceId: string, checkInId: string): Promise<any>;
export function addRetroactiveAttendance(params: any): Promise<any>;

export namespace CorrectionRequest {
  export function submitCorrectionRequest(params: CorrectionRequestParams): Promise<any>;
  export function getCorrectionRequests(filters: any): Promise<any[]>;
  export function reviewCorrectionRequest(requestId: string, status: 'approved' | 'rejected', reviewedBy: string): Promise<any>;
  export function applyCorrectionRequest(requestId: string): Promise<any>;
}

export function submitCorrectionRequest(params: CorrectionRequestParams): Promise<any>;
export function getCorrectionRequests(filters: any): Promise<any[]>;
export function reviewCorrectionRequest(requestId: string, status: 'approved' | 'rejected', reviewedBy: string): Promise<any>;
export function applyCorrectionRequest(requestId: string): Promise<any>;

// ============ JOBS ============

export function cleanupStaleSessions(maxAge?: number): Promise<number>;
export function cleanupStaleSessionsForOrg(organizationId: string, maxAge?: number): Promise<number>;
export function getStaleSessionCount(organizationId?: string): Promise<number>;

// ============ DEFAULT EXPORT ============

export default attendance;
