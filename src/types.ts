/**
 * ClockIn Type Definitions
 *
 * Production-grade types for attendance tracking with TypeScript
 * Follows industry patterns from Stripe, Netflix, Uber
 *
 * @module @classytic/clockin
 */

import type {
  Model,
  Document,
  ClientSession,
  Types,
  Schema,
} from 'mongoose';

// ============================================================================
// Core Types
// ============================================================================

/** Re-export mongoose ObjectId */
export type ObjectId = Types.ObjectId;

/** ObjectId or string representation */
export type ObjectIdLike = ObjectId | string;

/** Generic document type */
export type AnyDocument = Document & Record<string, unknown>;

/** Generic model type */
export type AnyModel = Model<AnyDocument>;

/** Deep partial type for nested objects */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ============================================================================
// Enums as Types (const assertions for better inference)
// ============================================================================

/** Attendance record status */
export type AttendanceStatus = 'valid' | 'invalid' | 'corrected' | 'disputed';

/** Check-in method */
export type CheckInMethod =
  | 'manual'
  | 'qr_code'
  | 'rfid'
  | 'biometric'
  | 'mobile_app'
  | 'api';

/** Member engagement level */
export type EngagementLevel =
  | 'highly_active'
  | 'active'
  | 'regular'
  | 'occasional'
  | 'inactive'
  | 'at_risk'
  | 'dormant';

/** Time period for aggregation */
export type AttendancePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Built-in target model types with smart defaults.
 * These models have pre-configured detection rules and auto-checkout settings.
 */
export type BuiltInTargetModel =
  | 'Membership'
  | 'Employee'
  | 'Trainer'
  | 'Class'
  | 'Student'
  | 'User';

/**
 * Target model type.
 *
 * As of v2.0, this is a string type to support custom target models.
 * Use `registerTargetModel()` in the builder to configure custom models.
 *
 * @example
 * ```typescript
 * // Built-in models work out of the box
 * const clockin = ClockIn.create()
 *   .withModels({ Attendance, Membership })
 *   .build();
 *
 * // Custom models can be registered with config
 * const clockin = ClockIn.create()
 *   .withModels({ Attendance, Event })
 *   .registerTargetModel('Event', {
 *     detection: { type: 'time-based' },
 *     autoCheckout: { enabled: true, afterHours: 4 }
 *   })
 *   .build();
 * ```
 */
export type AttendanceTargetModel = string;

/** Stats calculation mode */
export type StatsCalculationMode = 'real_time' | 'pre_calculated' | 'hybrid';

/** Attendance type for work day classification */
export type AttendanceType =
  | 'full_day'
  | 'half_day_morning'
  | 'half_day_afternoon'
  | 'paid_leave'
  | 'unpaid_leave'
  | 'overtime';

/** Time slot for pattern analysis */
export type TimeSlot =
  | 'early_morning'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'night';

/** Correction request type */
export type CorrectionRequestType =
  | 'update_check_in_time'
  | 'update_check_out_time'
  | 'add_missing_attendance'
  | 'delete_duplicate'
  | 'override_attendance_type';

/** Correction request status */
export type CorrectionRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'applied';

/** Priority level */
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

// ============================================================================
// Configuration Types
// ============================================================================

/** Engagement thresholds configuration */
export interface EngagementThresholds {
  /** Minimum visits for highly active (default: 12) */
  highlyActive: number;
  /** Minimum visits for active (default: 8) */
  active: number;
  /** Minimum visits for regular (default: 4) */
  regular: number;
  /** Minimum visits for occasional (default: 1) */
  occasional: number;
  /** At-risk configuration */
  atRisk: {
    /** Days inactive before at-risk (default: 14) */
    daysInactive: number;
  };
  /** Dormant configuration */
  dormant: {
    /** Days inactive before dormant (default: 30) */
    daysInactive: number;
  };
}

/** Stats calculation configuration */
export interface StatsConfig {
  /** Default calculation mode */
  defaultMode: StatsCalculationMode;
  /** Cache duration in seconds */
  cacheDuration: number;
  /** Auto-update stats on check-in */
  autoUpdateStats: boolean;
  /** Enable batch updates */
  batchUpdateEnabled: boolean;
  /** Batch size for bulk operations */
  batchSize: number;
}

/** Monthly aggregation configuration */
export interface AggregationConfig {
  /** Maximum check-ins per document */
  maxCheckInsPerMonth: number;
  /** Months to keep detailed history */
  detailedHistoryMonths: number;
  /** Archive records after X months */
  archiveAfterMonths: number;
  /** Compress archived records */
  compressArchived: boolean;
}

/** Streak calculation configuration */
export interface StreakConfig {
  /** Minimum hours between visits for separate days */
  minHoursBetweenVisits: number;
  /** Maximum gap days to maintain streak */
  maxGapDays: number;
  /** Reset streak after X days */
  resetStreakAfterDays: number;
  /** Hours until streak breaks */
  breakAfterHours: number;
  /** Milestone values */
  milestones: number[];
}

/** Check-in validation rules */
export interface CheckInRules {
  /** Minutes between duplicate check-ins */
  duplicatePreventionMinutes: number;
  /** Minutes before scheduled for early check-in */
  earlyCheckInMinutes: number;
  /** Minutes after scheduled for late check-in */
  lateCheckInMinutes: number;
  /** Minimum hours between check-ins */
  minimumTimeBetweenCheckIns: number;
}

/** Analytics configuration */
export interface AnalyticsConfig {
  /** Threshold for peak hours detection (0-1) */
  peakHoursThreshold: number;
  /** Days for trending period */
  trendingPeriodDays: number;
  /** Days for forecast window */
  forecastDays: number;
  /** Dashboard refresh interval in seconds */
  dashboardRefreshSeconds: number;
}

/** Notification configuration */
export interface NotificationConfig {
  /** Streak milestone values */
  streakMilestones: number[];
  /** Days of inactivity before alert */
  inactivityAlertDays: number;
  /** Visit milestone values */
  visitMilestones: number[];
}

/** Auto-checkout configuration */
export interface AutoCheckoutConfig {
  /** Enable auto-checkout */
  enabled: boolean;
  /** Default hours after check-in */
  afterHours: number;
  /** Maximum session duration in hours */
  maxSession: number;
}

/** Schedule validation configuration */
export interface ValidationConfig {
  /** Enforce schedule rules */
  enforceSchedule: boolean;
  /** Allow weekend check-ins */
  allowWeekends: boolean;
  /** Grace period in hours */
  gracePeriod: number;
  /** Only warn, don't block */
  warnOnly: boolean;
}

/** Detection rules configuration */
export interface DetectionRules {
  /** Duration thresholds */
  thresholds: {
    overtime: number;
    fullDay: number;
    halfDay?: number;
    unpaid?: number;
    minimal?: number;
  };
  /** Fallback thresholds when no schedule */
  fallback?: {
    standardHours: number;
    overtime: number;
    fullDay: number;
    halfDay: number;
  };
  /** Default attendance type */
  defaultType: AttendanceType;
}

/** Time hints for half-day classification */
export interface TimeHints {
  /** Hour cutoff for morning shift */
  morningCutoff: number;
  /** Hour start for afternoon shift */
  afternoonStart: number;
}

/** Detection configuration */
export interface DetectionConfig {
  /** Detection type */
  type: 'schedule-aware' | 'time-based';
  /** Field containing work schedule */
  scheduleSource: string | null;
  /** Detection rules */
  rules: DetectionRules;
  /** Time classification hints */
  timeHints: TimeHints | null;
}

/** Target model configuration */
export interface TargetModelConfig {
  /** Target model name */
  targetModel: string;
  /** Detection configuration */
  detection: DetectionConfig;
  /** Auto-checkout configuration */
  autoCheckout: AutoCheckoutConfig;
  /** Validation configuration */
  validation: ValidationConfig;
}

/** Single-tenant configuration */
export interface SingleTenantConfig {
  /** Fixed organization ID */
  organizationId: ObjectIdLike;
  /** Auto-inject organizationId if missing */
  autoInject: boolean;
}

/** Main ClockIn configuration */
export interface ClockInConfig {
  /** Attendance model (required) */
  AttendanceModel: Model<any>;
  /** Custom configs per target model */
  configs?: Record<string, TargetModelConfig>;
  /** Single-tenant configuration */
  singleTenant?: SingleTenantConfig | null;
  /** Custom logger */
  logger?: Logger;
  /** TTL for attendance records in days (default: 730) */
  recordTtlDays?: number;
}

// ============================================================================
// Schema Types
// ============================================================================

/** User reference for audit */
export interface UserReference {
  userId?: ObjectId;
  name?: string;
  role?: string;
  userName?: string;
  userRole?: string;
}

/** Location data */
export interface LocationData {
  lat?: number;
  lng?: number;
  accuracy?: number;
}

/** Device information */
export interface DeviceInfo {
  type?: string;
  platform?: string;
  appVersion?: string;
}

/** Correction entry */
export interface CorrectionEntry {
  field: string;
  originalValue: unknown;
  newValue: unknown;
  reason?: string;
  correctedBy: UserReference;
  correctedAt: Date;
}

/** Single check-in entry */
export interface CheckInEntry {
  _id?: ObjectId;
  timestamp: Date;
  checkOutAt?: Date | null;
  expectedCheckOutAt?: Date | null;
  duration?: number | null;
  autoCheckedOut: boolean;
  recordedBy: UserReference;
  checkedOutBy?: UserReference | null;
  method: CheckInMethod;
  status: AttendanceStatus;
  timeSlot?: TimeSlot;
  attendanceType: AttendanceType;
  location?: LocationData;
  device?: DeviceInfo;
  notes?: string;
  corrections?: CorrectionEntry[];
  metadata?: Map<string, unknown>;
}

/** Time slot distribution */
export interface TimeSlotDistribution {
  early_morning: number;
  morning: number;
  afternoon: number;
  evening: number;
  night: number;
}

/** Correction request */
export interface CorrectionRequest {
  _id?: ObjectId;
  requestType: CorrectionRequestType;
  status: CorrectionRequestStatus;
  checkInId?: ObjectId;
  requestedChanges: {
    checkInTime?: Date;
    checkOutTime?: Date;
    attendanceType?: AttendanceType;
    reason: string;
  };
  priority: Priority;
  reviewedBy?: UserReference;
  reviewedAt?: Date;
  reviewNotes?: string;
  appliedAt?: Date;
  createdAt: Date;
}

/** Monthly attendance record document */
export interface AttendanceRecord {
  _id?: ObjectId;
  organizationId: ObjectId;
  targetModel: AttendanceTargetModel;
  targetId: ObjectId;
  year: number;
  month: number;
  checkIns: CheckInEntry[];
  monthlyTotal: number;
  uniqueDaysVisited: number;
  fullDaysCount: number;
  halfDaysCount: number;
  paidLeaveDaysCount: number;
  overtimeDaysCount: number;
  totalWorkDays: number;
  timeSlotDistribution: TimeSlotDistribution;
  dayOfWeekDistribution: Map<string, number>;
  correctionRequests: CorrectionRequest[];
  metadata?: Map<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Pre-calculated attendance stats (embedded in member documents) */
export interface AttendanceStats {
  totalVisits: number;
  lastVisitedAt?: Date | null;
  firstVisitedAt?: Date | null;
  currentStreak: number;
  longestStreak: number;
  monthlyAverage: number;
  thisMonthVisits: number;
  lastMonthVisits: number;
  engagementLevel: EngagementLevel;
  daysSinceLastVisit?: number;
  favoriteTimeSlot?: TimeSlot;
  loyaltyScore: number;
  updatedAt?: Date;
}

/** Current session tracking (embedded in member documents) */
export interface CurrentSession {
  isActive: boolean;
  checkInId?: ObjectId | null;
  checkInTime?: Date | null;
  expectedCheckOutAt?: Date | null;
  method?: CheckInMethod | null;
  /** Virtual field - calculated dynamically */
  readonly durationMinutes?: number;
}

/** Work schedule definition */
export interface WorkSchedule {
  hoursPerDay?: number;
  hoursPerWeek?: number;
  workingDays?: number[];
  shiftStart?: string;
  shiftEnd?: string;
}

// ============================================================================
// Operation Types
// ============================================================================

/** Base operation context */
export interface OperationContext {
  /** User performing the operation */
  userId?: ObjectIdLike;
  /** User name */
  userName?: string;
  /** User role */
  userRole?: string;
  /** Organization ID */
  organizationId?: ObjectIdLike;
  /** MongoDB session for transactions */
  session?: ClientSession;
}

/** Check-in data */
export interface CheckInData {
  /** Check-in method */
  method?: CheckInMethod;
  /** Timestamp (defaults to now) */
  timestamp?: Date;
  /** Location data */
  location?: LocationData;
  /** Device info */
  device?: DeviceInfo;
  /** Notes */
  notes?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/** Check-in parameters */
export interface CheckInParams<TMember = AnyDocument> {
  /** Member/entity document */
  member: TMember;
  /** Target model name */
  targetModel: AttendanceTargetModel;
  /** Check-in data */
  data?: CheckInData;
  /** Operation context */
  context?: OperationContext;
}

/** Check-out parameters */
export interface CheckOutParams<TMember = AnyDocument> {
  /** Member/entity document */
  member: TMember;
  /** Target model name */
  targetModel: AttendanceTargetModel;
  /** Check-in ID to checkout */
  checkInId: ObjectIdLike;
  /** Operation context */
  context?: OperationContext;
}

/** Check-in result */
export interface CheckInResult {
  /** Created check-in entry */
  checkIn: CheckInEntry;
  /** Updated attendance record */
  attendance: AttendanceRecord;
  /** Updated member document */
  updatedMember: AnyDocument;
  /** Updated stats */
  stats: AttendanceStats;
}

/** Check-out result */
export interface CheckOutResult {
  /** Updated check-in entry */
  checkIn: CheckInEntry;
  /** Session duration in minutes */
  duration: number;
}

/** Batch checkout parameters for expired sessions */
export interface CheckoutExpiredParams {
  /** Organization ID (optional in single-tenant mode) */
  organizationId?: ObjectIdLike;
  /** Target model name (optional: process all registered models) */
  targetModel?: AttendanceTargetModel;
  /** Process sessions with expectedCheckOutAt before this time */
  before?: Date;
  /** Max sessions to process per target model */
  limit?: number;
  /** Operation context */
  context?: OperationContext;
}

/** Batch checkout result summary */
export interface CheckoutExpiredResult {
  /** Total sessions considered */
  total: number;
  /** Successfully checked out */
  processed: number;
  /** Failed to check out */
  failed: number;
  /** Failure details */
  errors: Array<{
    targetModel?: string;
    memberId?: ObjectIdLike;
    checkInId?: ObjectIdLike;
    reason: string;
  }>;
}

/** Toggle result (check-in or check-out) */
export interface ToggleResult extends Partial<CheckInResult>, Partial<CheckOutResult> {
  /** Action performed */
  action: 'check-in' | 'check-out';
  /** Member info */
  member?: {
    id: ObjectId;
    membershipCode?: string;
    name?: string;
  };
}

/** Validation result */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Warning messages */
  warnings?: string[];
  /** Last check-in timestamp */
  lastCheckIn?: Date;
  /** Next allowed check-in time */
  nextAllowedTime?: Date;
}

/** Bulk check-in data */
export interface BulkCheckInData extends CheckInData {
  /** Member identifier (email, code, etc.) */
  memberIdentifier: string;
  /** Target model */
  targetModel?: AttendanceTargetModel;
}

/** Bulk operation result */
export interface BulkOperationResult {
  /** Successful operations */
  success: number;
  /** Failed operations */
  failed: number;
  /** Error details */
  errors: Array<{
    memberIdentifier: string;
    error: string;
  }>;
}

// ============================================================================
// Analytics Types
// ============================================================================

/** Dashboard parameters */
export interface DashboardParams {
  /** Member model */
  MemberModel: Model<any>;
  /** Organization ID */
  organizationId: ObjectIdLike;
  /** Start date */
  startDate?: Date;
  /** End date */
  endDate?: Date;
}

/** Dashboard summary */
export interface DashboardSummary {
  /** Total members count */
  totalMembers: number;
  /** Active members this month */
  activeMembers: number;
  /** Activation rate percentage */
  activationRate: number;
  /** Total check-ins in period */
  totalCheckIns: number;
  /** Average visits per member */
  avgVisitsPerMember: number;
  /** Unique visitors in period */
  uniqueVisitors: number;
}

/** Engagement distribution entry */
export interface EngagementDistributionEntry {
  /** Engagement level */
  level: EngagementLevel | null;
  /** Member count */
  count: number;
}

/** Top member entry */
export interface TopMemberEntry {
  _id: ObjectId;
  customer?: {
    name?: string;
    email?: string;
  };
  attendanceStats: AttendanceStats;
}

/** Dashboard result */
export interface DashboardResult {
  /** Summary metrics */
  summary: DashboardSummary;
  /** Engagement distribution */
  engagementDistribution: EngagementDistributionEntry[];
  /** Top members by visits */
  topMembers: TopMemberEntry[];
  /** At-risk members */
  atRiskMembers: TopMemberEntry[];
  /** Date range */
  dateRange: {
    start: Date;
    end: Date;
  };
}

/** History parameters */
export interface HistoryParams {
  /** Target document ID (e.g., Membership ID, Employee ID) */
  targetId: ObjectIdLike;
  /** Organization ID */
  organizationId: ObjectIdLike;
  /** Year filter */
  year?: number;
  /** Month filter */
  month?: number;
  /** Target model filter */
  targetModel?: AttendanceTargetModel;
}

/** Occupancy data */
export interface OccupancyData {
  /** Total currently checked in */
  total: number;
  /** Breakdown by target model */
  byType: Record<string, {
    count: number;
    members: ObjectId[];
  }>;
  /** Timestamp */
  timestamp: Date;
}

/** Active session data */
export interface ActiveSessionData {
  /** Check-in ID */
  checkInId: ObjectId;
  /** Check-in timestamp */
  timestamp: Date;
  /** Expected checkout */
  expectedCheckOutAt?: Date;
  /** Duration in minutes */
  duration: number;
  /** Check-in method */
  method: CheckInMethod;
}

/** Daily trend entry */
export interface DailyTrendEntry {
  /** Date string */
  date: string;
  /** Total check-ins */
  count: number;
  /** Unique members */
  uniqueMembers: number;
}

/** Period stats */
export interface PeriodStats {
  /** Total check-ins */
  totalCheckIns: number;
  /** Unique members */
  uniqueMembers: number;
  /** Average check-ins per member */
  avgCheckInsPerMember: number;
}

// ============================================================================
// Correction Types
// ============================================================================

/** Update check-in time parameters */
export interface UpdateCheckInTimeParams {
  /** Attendance record ID */
  attendanceId: ObjectIdLike;
  /** Check-in entry ID */
  checkInId: ObjectIdLike;
  /** New timestamp */
  newTimestamp: Date;
  /** Reason for correction */
  reason: string;
  /** Operation context */
  context: OperationContext;
}

/** Update check-out time parameters */
export interface UpdateCheckOutTimeParams {
  /** Attendance record ID */
  attendanceId: ObjectIdLike;
  /** Check-in entry ID */
  checkInId: ObjectIdLike;
  /** New checkout timestamp */
  newCheckOutTime: Date;
  /** Reason for correction */
  reason: string;
  /** Operation context */
  context: OperationContext;
}

/** Override attendance type parameters */
export interface OverrideAttendanceTypeParams {
  /** Attendance record ID */
  attendanceId: ObjectIdLike;
  /** Check-in entry ID */
  checkInId: ObjectIdLike;
  /** New attendance type */
  newType: AttendanceType;
  /** Reason for override */
  reason: string;
  /** Operation context */
  context: OperationContext;
}

/** Submit correction request parameters */
export interface SubmitCorrectionRequestParams {
  /** Member ID */
  memberId: ObjectIdLike;
  /** Organization ID */
  organizationId?: ObjectIdLike;
  /** Year */
  year: number;
  /** Month */
  month: number;
  /** Target model (required when creating a new attendance record) */
  targetModel?: AttendanceTargetModel;
  /** Request type */
  requestType: CorrectionRequestType;
  /** Check-in ID (if applicable) */
  checkInId?: ObjectIdLike;
  /** Proposed changes */
  proposedChanges: {
    checkInTime?: Date;
    checkOutTime?: Date;
    attendanceType?: AttendanceType;
    reason: string;
  };
  /** Priority */
  priority?: Priority;
  /** Operation context (session, user metadata) */
  context?: OperationContext;
}

/** Review correction request parameters */
export interface ReviewCorrectionRequestParams {
  /** Attendance record ID */
  attendanceId: ObjectIdLike;
  /** Request ID */
  requestId: ObjectIdLike;
  /** Approval status */
  approved: boolean;
  /** Review notes */
  notes?: string;
  /** Operation context */
  context: OperationContext;
}

/** List correction requests parameters */
export interface ListCorrectionRequestsParams {
  /** Attendance record ID */
  attendanceId?: ObjectIdLike;
  /** Member ID (used with organizationId + year/month) */
  memberId?: ObjectIdLike;
  /** Organization ID (required if attendanceId is not provided) */
  organizationId?: ObjectIdLike;
  /** Year (required if attendanceId is not provided) */
  year?: number;
  /** Month (required if attendanceId is not provided) */
  month?: number;
  /** Target model name */
  targetModel?: AttendanceTargetModel;
  /** Filter by status */
  status?: CorrectionRequestStatus;
  /** Filter by request type */
  requestType?: CorrectionRequestType;
  /** Operation context */
  context?: OperationContext;
}

/** Apply correction request parameters */
export interface ApplyCorrectionRequestParams {
  /** Attendance record ID */
  attendanceId: ObjectIdLike;
  /** Request ID */
  requestId: ObjectIdLike;
  /** Operation context */
  context: OperationContext;
}

// ============================================================================
// Plugin Types
// ============================================================================

/** Result type for service methods */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

/** ClockIn instance for plugin reference */
export interface ClockInInstance {
  /** Configured attendance model */
  AttendanceModel: Model<any>;
  /** Model name */
  model: string;
  /** Event hooks */
  _hooks: Map<string, Array<(data: unknown) => void | Promise<void>>>;
  /** Is initialized */
  _initialized: boolean;

  // ========================================
  // Check-In Service
  // ========================================

  /** Check-in operations */
  checkIn: {
    /** Validate if member can check in */
    validate<TMember extends AnyDocument>(
      member: TMember | null | undefined,
      targetModel: string,
      options?: { timestamp?: Date }
    ): ValidationResult;
    /** Record a check-in */
    record<TMember extends AnyDocument>(
      params: CheckInParams<TMember>
    ): Promise<Result<CheckInResult>>;
    /** Bulk check-in (for data imports) */
    recordBulk(
      checkIns: BulkCheckInData[],
      context?: OperationContext
    ): Promise<BulkOperationResult>;
  };

  // ========================================
  // Check-Out Service
  // ========================================

  /** Check-out operations */
  checkOut: {
    /** Record a check-out */
    record<TMember extends AnyDocument>(
      params: CheckOutParams<TMember>
    ): Promise<Result<CheckOutResult>>;
    /** Toggle check-in/out (smart action based on current state) */
    toggle<TMember extends AnyDocument>(params: {
      member: TMember;
      targetModel: string;
      data?: CheckInData;
      context?: OperationContext;
    }): Promise<Result<ToggleResult>>;
    /** Get current occupancy (who's checked in right now) */
    getOccupancy(params: {
      organizationId: ObjectIdLike;
      targetModel?: string;
    }): Promise<Result<OccupancyData>>;
    /** Batch check-out for expired sessions */
    checkoutExpired(
      params: CheckoutExpiredParams
    ): Promise<Result<CheckoutExpiredResult>>;
    /** Get member's current active session */
    getCurrentSession(params: {
      memberId: ObjectIdLike;
      organizationId: ObjectIdLike;
      targetModel: string;
    }): Promise<Result<ActiveSessionData | null>>;
  };

  // ========================================
  // Analytics Service
  // ========================================

  /** Analytics operations */
  analytics: {
    /** Get dashboard analytics */
    dashboard(params: DashboardParams): Promise<Result<DashboardResult>>;
    /** Get member attendance history */
    history(params: HistoryParams): Promise<Result<AttendanceRecord[]>>;
    /** Get daily attendance trend */
    dailyTrend(params: {
      organizationId: ObjectIdLike;
      days?: number;
      targetModel?: string;
    }): Promise<Result<DailyTrendEntry[]>>;
    /** Get period statistics */
    periodStats(params: {
      organizationId: ObjectIdLike;
      year: number;
      month: number;
      targetModel?: string;
    }): Promise<Result<PeriodStats>>;
    /** Get time slot distribution */
    timeSlotDistribution(params: {
      organizationId: ObjectIdLike;
      startDate?: Date;
      endDate?: Date;
    }): Promise<Result<Record<string, number>>>;
    /** Recalculate stats for members */
    recalculateStats(params: {
      MemberModel: Model<any>;
      organizationId: ObjectIdLike;
      memberIds?: ObjectIdLike[];
    }): Promise<Result<{ processed: number; updated: number }>>;
  };

  // ========================================
  // Event System
  // ========================================

  /** Register event listener */
  on(event: string, listener: (data: unknown) => void | Promise<void>): () => void;
  /** Register one-time event listener */
  once(event: string, listener: (data: unknown) => void | Promise<void>): () => void;
  /** Remove event listener */
  off(event: string, listener: (data: unknown) => void | Promise<void>): void;

  // ========================================
  // Instance Properties
  // ========================================

  /** Whether single-tenant mode is enabled */
  readonly isSingleTenant: boolean;
  /** Single-tenant organization ID (if configured) */
  readonly singleTenantOrgId: ObjectIdLike | undefined;

  // ========================================
  // Lifecycle
  // ========================================

  /** Destroy instance and clean up resources */
  destroy(): Promise<void>;

  /** Extended properties from plugins */
  [key: string]: unknown;
}

/** Plugin interface */
export interface Plugin {
  /** Plugin name */
  name: string;
  /** Apply plugin to ClockIn instance */
  apply(clockIn: ClockInInstance): void;
}

/** Plugin function signature */
export type PluginFunction = (clockIn: ClockInInstance) => void;

/** Plugin type (object or function) */
export type PluginType = Plugin | PluginFunction;

// ============================================================================
// Event Types
// ============================================================================

/** Event names */
export type ClockInEvent =
  | 'checkIn:recorded'
  | 'checkIn:failed'
  | 'checkOut:recorded'
  | 'checkOut:failed'
  | 'milestone:achieved'
  | 'engagement:changed'
  | 'stats:updated'
  | 'member:atRisk'
  | 'member:inactive'
  | 'session:expired';

/** Event payload base */
export interface EventPayloadBase {
  /** Event type */
  type: ClockInEvent;
  /** Event timestamp */
  timestamp: Date;
}

/** Check-in recorded event */
export interface CheckInRecordedEvent extends EventPayloadBase {
  type: 'checkIn:recorded';
  data: {
    checkIn: {
      id: ObjectId;
      timestamp: Date;
      method: CheckInMethod;
    };
    member: {
      id: ObjectId;
      name?: string;
    };
    stats: {
      totalVisits: number;
      currentStreak: number;
      engagementLevel: EngagementLevel;
    };
    context?: OperationContext;
  };
}

/** Milestone achieved event */
export interface MilestoneAchievedEvent extends EventPayloadBase {
  type: 'milestone:achieved';
  data: {
    member: {
      id: ObjectId;
      name?: string;
    };
    milestone: {
      type: 'visits' | 'streak';
      value: number;
      message: string;
    };
    stats: AttendanceStats;
  };
}

/** Engagement changed event */
export interface EngagementChangedEvent extends EventPayloadBase {
  type: 'engagement:changed';
  data: {
    member: {
      id: ObjectId;
      name?: string;
    };
    engagement: {
      from: EngagementLevel;
      to: EngagementLevel;
    };
    stats: AttendanceStats;
  };
}

/** All event payloads union */
export type EventPayload =
  | CheckInRecordedEvent
  | MilestoneAchievedEvent
  | EngagementChangedEvent;

// ============================================================================
// Logger Types
// ============================================================================

/** Logger interface */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

// ============================================================================
// Error Types
// ============================================================================

/** Error code enumeration */
export type ErrorCode =
  | 'ATTENDANCE_ERROR'
  | 'NOT_INITIALIZED'
  | 'MEMBER_NOT_FOUND'
  | 'INVALID_MEMBER'
  | 'DUPLICATE_CHECK_IN'
  | 'VALIDATION_ERROR'
  | 'ATTENDANCE_NOT_ENABLED'
  | 'NO_ACTIVE_SESSION'
  | 'ALREADY_CHECKED_OUT'
  | 'TARGET_MODEL_NOT_ALLOWED';

/** HTTP error with status code */
export interface HttpError extends Error {
  code: ErrorCode;
  status: number;
  context?: Record<string, unknown>;
  timestamp: Date;
}

// ============================================================================
// Utility Types
// ============================================================================

/** Streak calculation result */
export interface StreakResult {
  /** Current consecutive days */
  currentStreak: number;
  /** Longest streak ever */
  longestStreak: number;
}

/** Schedule thresholds */
export interface ScheduleThresholds {
  /** Hours for overtime */
  overtime: number;
  /** Hours for full day */
  fullDay: number;
  /** Hours for half day */
  halfDay: number;
  /** Hours for unpaid */
  unpaid: number;
}

/** Schedule check result */
export interface ScheduleCheckResult {
  /** Is within shift */
  within: boolean;
  /** Hours early */
  earlyBy: number;
  /** Hours late */
  lateBy: number;
}

/** Working day check result */
export interface WorkingDayResult {
  /** Is a working day */
  isWorking: boolean;
  /** Day name */
  dayName: string;
}

// ============================================================================
// Member Type Helper
// ============================================================================

/**
 * Base member interface that ClockIn expects
 * Extend this in your application
 */
export interface ClockInMember {
  _id: ObjectId;
  organizationId: ObjectId;
  status?: string;
  attendanceEnabled?: boolean;
  attendanceStats?: AttendanceStats;
  currentSession?: CurrentSession;
  customer?: {
    name?: string;
    email?: string;
  };
  name?: string;
  membershipCode?: string;
  workSchedule?: WorkSchedule;
}

/**
 * Member model with ClockIn fields applied
 * Use this to type your member model
 */
export type WithClockIn<TMember> = TMember & {
  attendanceStats: AttendanceStats;
  currentSession: CurrentSession;
  attendanceEnabled: boolean;
};
