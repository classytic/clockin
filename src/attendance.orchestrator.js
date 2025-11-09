/**
 * 🌟 ATTENDANCE ORCHESTRATOR - PUBLIC API
 * Unified, elegant DSL for all attendance operations
 *
 * Usage:
 * ```javascript
 * import { attendance } from '#lib/attendance/index.js';
 *
 * // Check-in
 * await attendance.checkIn({ member, targetModel: 'Membership', data, context });
 *
 * // Analytics
 * const dashboard = await attendance.dashboard({ organizationId });
 * const history = await attendance.history({ memberId, organizationId, year, month });
 *
 * // Stats management
 * await attendance.recalculateStats({ organizationId, memberIds });
 * const stats = attendance.getStats(member);
 *
 * // Note: For member filtering with attendance stats, use /api/v1/memberships endpoint
 * ```
 *
 * @module lib/attendance/orchestrator
 */

import {
  recordCheckIn,
  bulkRecordCheckIns,
  validateCheckIn,
} from './core/check-in.manager.js';

import {
  checkOut,
  getCurrentOccupancy,
  getMemberCurrentSession,
  toggleCheckInOut,
} from './core/checkout.manager.js';

import {
  getMemberAttendanceHistory,
  getDashboardAnalytics,
  getTimeSlotDistribution,
  getDailyAttendanceTrend,
  recalculateAllStats,
} from './core/analytics.manager.js';

import logger from './utils/logger.js';

/**
 * Attendance Orchestrator Class
 * Provides high-level API for attendance operations
 */
class AttendanceOrchestrator {
  constructor() {
    this._AttendanceModel = null;
    this._initialized = false;
  }

  /**
   * Configure orchestrator with models
   * Called once during app bootstrap
   */
  configure({ AttendanceModel }) {
    if (!AttendanceModel) {
      throw new Error('AttendanceModel is required for attendance orchestrator');
    }

    this._AttendanceModel = AttendanceModel;
    this._initialized = true;

    logger.info('Attendance Orchestrator configured', {
      hasAttendanceModel: !!AttendanceModel,
    });
  }

  /**
   * Ensure orchestrator is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this._initialized) {
      throw new Error(
        'Attendance Orchestrator not initialized. ' +
        'Call initializeAttendance({ AttendanceModel }) in your bootstrap.'
      );
    }
  }

  /**
   * Check if orchestrator is initialized
   */
  isInitialized() {
    return this._initialized;
  }

  // ============ CHECK-IN OPERATIONS ============

  /**
   * Record a check-in
   * @param {Object} params
   * @param {Object} params.member - Member document
   * @param {String} params.targetModel - Target model name ('Membership', 'Employee', etc.)
   * @param {Object} params.data - Check-in data (method, notes, location, device)
   * @param {Object} params.context - Request context (userId, userName, userRole)
   * @returns {Promise<Object>} Check-in result
   */
  async checkIn({ member, targetModel, data = {}, context = {} }) {
    this._ensureInitialized();

    logger.info('Processing check-in', {
      memberId: member._id,
      targetModel,
      method: data.method,
    });

    return await recordCheckIn({
      AttendanceModel: this._AttendanceModel,
      member,
      targetModel,
      checkInData: data,
      context,
    });
  }

  /**
   * Validate if member can check in
   * @param {Object} member - Member document
   * @param {String} targetModel - Target model name
   * @param {Object} options - Check-in options (timestamp, etc.)
   * @returns {Object} { valid: Boolean, error?: String, warnings?: Array }
   */
  validate(member, targetModel, options = {}) {
    return validateCheckIn(member, targetModel, options);
  }

  /**
   * Bulk check-in (for data imports)
   * @param {Object} params
   * @param {Array} params.checkIns - Array of check-in data
   * @param {Object} params.context - Request context
   * @returns {Promise<Object>} Results
   */
  async bulkCheckIn({ checkIns, context = {} }) {
    this._ensureInitialized();

    logger.info('Processing bulk check-in', {
      count: checkIns.length,
    });

    return await bulkRecordCheckIns({
      AttendanceModel: this._AttendanceModel,
      checkIns,
      context,
    });
  }

  // ============ CHECK-OUT OPERATIONS ============

  /**
   * Record a check-out
   * @param {Object} params
   * @param {Object} params.member - Member document
   * @param {String} params.targetModel - Target model name
   * @param {String} params.checkInId - Check-in ID to checkout
   * @param {Object} params.context - Request context
   * @returns {Promise<Object>} Check-out result
   */
  async checkOut({ member, targetModel, checkInId, context = {} }) {
    this._ensureInitialized();

    logger.info('Processing check-out', {
      memberId: member._id,
      checkInId,
    });

    return await checkOut({
      AttendanceModel: this._AttendanceModel,
      member,
      targetModel,
      checkInId,
      context,
    });
  }

  /**
   * Get current occupancy (who's checked in right now)
   * @param {Object} params
   * @param {ObjectId} params.organizationId - Tenant ID
   * @param {String} params.targetModel - Optional: filter by entity type
   * @returns {Promise<Object>} Occupancy data
   */
  async getOccupancy({ organizationId, targetModel = null }) {
    this._ensureInitialized();

    return await getCurrentOccupancy({
      AttendanceModel: this._AttendanceModel,
      organizationId,
      targetModel,
    });
  }

  /**
   * Get member's current active session
   * @param {Object} params
   * @param {ObjectId} params.memberId - Member ID
   * @param {ObjectId} params.organizationId - Tenant ID
   * @param {String} params.targetModel - Entity type
   * @returns {Promise<Object|null>} Active session or null
   */
  async getCurrentSession({ memberId, organizationId, targetModel }) {
    this._ensureInitialized();

    return await getMemberCurrentSession({
      AttendanceModel: this._AttendanceModel,
      memberId,
      organizationId,
      targetModel,
    });
  }

  /**
   * Toggle Check-In/Check-Out (Smart Toggle for RFID/QR/Biometric)
   * Industry-standard pattern for self-service kiosks
   *
   * - If member has active session → Automatically check-out
   * - If member has no active session → Automatically check-in
   *
   * Perfect for:
   * - RFID card tap at entrance
   * - QR code scan on mobile/kiosk
   * - Biometric scan (fingerprint/face)
   * - Mobile app "tap to check-in"
   *
   * @param {Object} params
   * @param {Object} params.member - Member document
   * @param {String} params.targetModel - Target model name ('Membership', 'Employee', etc.)
   * @param {Object} params.data - Check-in data (method, notes, location, device)
   * @param {Object} params.context - Request context
   * @returns {Promise<Object>} { action: 'check-in' | 'check-out', ...result }
   */
  async toggle({ member, targetModel, data = {}, context = {} }) {
    this._ensureInitialized();

    logger.info('Processing toggle check-in/check-out', {
      memberId: member._id,
      targetModel,
      method: data.method,
    });

    return await toggleCheckInOut({
      AttendanceModel: this._AttendanceModel,
      member,
      targetModel,
      checkInData: data,
      context,
    });
  }

  // ============ MEMBER OPERATIONS ============

  /**
   * Get attendance history for a member
   * @param {Object} params
   * @param {ObjectId} params.memberId
   * @param {ObjectId} params.organizationId
   * @param {Number} params.year - Optional year filter
   * @param {Number} params.month - Optional month filter
   * @param {String} params.targetModel - Target model name
   * @returns {Promise<Array>} Attendance records
   */
  async history({
    memberId,
    organizationId,
    year,
    month,
    targetModel = 'Membership',
  }) {
    this._ensureInitialized();

    return await getMemberAttendanceHistory({
      AttendanceModel: this._AttendanceModel,
      memberId,
      organizationId,
      year,
      month,
      targetModel,
    });
  }

  // ============ ANALYTICS OPERATIONS ============

  /**
   * Get dashboard analytics
   * @param {Object} params
   * @param {Model} params.MemberModel
   * @param {ObjectId} params.organizationId
   * @param {Date} params.startDate - Optional
   * @param {Date} params.endDate - Optional
   * @returns {Promise<Object>} Dashboard data
   */
  async dashboard({
    MemberModel,
    organizationId,
    startDate,
    endDate,
  }) {
    logger.info('🔍 [ORCHESTRATOR] dashboard() called', {
      organizationId,
      organizationIdType: typeof organizationId,
      hasStartDate: !!startDate,
      hasEndDate: !!endDate,
      isInitialized: this._initialized,
    });

    this._ensureInitialized();

    logger.info('🔍 [ORCHESTRATOR] Calling getDashboardAnalytics...');
    const result = await getDashboardAnalytics({
      AttendanceModel: this._AttendanceModel,
      MemberModel,
      organizationId,
      startDate,
      endDate,
    });

    logger.info('🔍 [ORCHESTRATOR] getDashboardAnalytics result', {
      hasResult: !!result,
      resultKeys: result ? Object.keys(result) : [],
      hasSummary: !!result?.summary,
    });

    return result;
  }

  /**
   * Get time slot distribution
   * @param {Object} params
   * @param {ObjectId} params.organizationId
   * @param {Date} params.startDate
   * @param {Date} params.endDate
   * @returns {Promise<Object>} Time slot distribution
   */
  async timeSlots({ organizationId, startDate, endDate }) {
    this._ensureInitialized();

    return await getTimeSlotDistribution({
      AttendanceModel: this._AttendanceModel,
      organizationId,
      startDate,
      endDate,
    });
  }

  /**
   * Get daily attendance trend
   * @param {Object} params
   * @param {ObjectId} params.organizationId
   * @param {Number} params.days - Number of days to look back
   * @returns {Promise<Array>} Daily attendance data
   */
  async trend({ organizationId, days = 30 }) {
    this._ensureInitialized();

    return await getDailyAttendanceTrend({
      AttendanceModel: this._AttendanceModel,
      organizationId,
      days,
    });
  }

  // ============ STATS OPERATIONS ============

  /**
   * Recalculate stats for members
   * Useful for data corrections or migrations
   * @param {Object} params
   * @param {Model} params.MemberModel
   * @param {ObjectId} params.organizationId
   * @param {Array} params.memberIds - Optional: specific member IDs
   * @returns {Promise<Object>} Results
   */
  async recalculateStats({
    MemberModel,
    organizationId,
    memberIds = null,
  }) {
    this._ensureInitialized();

    logger.info('Recalculating attendance stats', {
      organizationId,
      memberCount: memberIds ? memberIds.length : 'all',
    });

    return await recalculateAllStats({
      AttendanceModel: this._AttendanceModel,
      MemberModel,
      organizationId,
      memberIds,
    });
  }

  /**
   * Get stats from member document
   * @param {Object} member - Member document
   * @returns {Object} Attendance stats
   */
  getStats(member) {
    return member.attendanceStats || {
      totalVisits: 0,
      thisMonthVisits: 0,
      currentStreak: 0,
      engagementLevel: 'inactive',
    };
  }

  /**
   * Check if member is active
   * @param {Object} member - Member document
   * @returns {Boolean}
   */
  isActive(member) {
    const stats = this.getStats(member);
    return ['active', 'highly_active', 'regular'].includes(stats.engagementLevel);
  }

  /**
   * Check if member is at risk
   * @param {Object} member - Member document
   * @returns {Boolean}
   */
  isAtRisk(member) {
    const stats = this.getStats(member);
    return ['at_risk', 'dormant'].includes(stats.engagementLevel);
  }

  // ============ UTILITIES ============

  /**
   * Get attendance model (for advanced use cases)
   * @returns {Model} Attendance model
   */
  getAttendanceModel() {
    this._ensureInitialized();
    return this._AttendanceModel;
  }

  // ============ CORRECTION OPERATIONS (Admin) ============

  /**
   * Update check-in timestamp (admin correction)
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async updateCheckInTime(params) {
    this._ensureInitialized();
    const { updateCheckInTime } = await import('./core/correction.manager.js');
    return await updateCheckInTime({
      AttendanceModel: this._AttendanceModel,
      ...params,
    });
  }

  /**
   * Update check-out timestamp (admin correction)
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async updateCheckOutTime(params) {
    this._ensureInitialized();
    const { updateCheckOutTime } = await import('./core/correction.manager.js');
    return await updateCheckOutTime({
      AttendanceModel: this._AttendanceModel,
      ...params,
    });
  }

  /**
   * Override attendance type (admin correction for payroll)
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async overrideAttendanceType(params) {
    this._ensureInitialized();
    const { overrideAttendanceType } = await import('./core/correction.manager.js');
    return await overrideAttendanceType({
      AttendanceModel: this._AttendanceModel,
      ...params,
    });
  }

  /**
   * Delete check-in entry (admin correction)
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async deleteCheckIn(params) {
    this._ensureInitialized();
    const { deleteCheckIn } = await import('./core/correction.manager.js');
    return await deleteCheckIn({
      AttendanceModel: this._AttendanceModel,
      ...params,
    });
  }

  /**
   * Add retroactive attendance (admin correction)
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async addRetroactiveAttendance(params) {
    this._ensureInitialized();
    const { addRetroactiveAttendance } = await import('./core/correction.manager.js');
    return await addRetroactiveAttendance({
      AttendanceModel: this._AttendanceModel,
      ...params,
    });
  }

  // ============ CORRECTION REQUESTS (Employee Self-Service) ============

  /**
   * Submit correction request (employee)
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async submitCorrectionRequest(params) {
    this._ensureInitialized();
    const { submitCorrectionRequest } = await import('./core/correction-request.manager.js');
    return await submitCorrectionRequest({
      AttendanceModel: this._AttendanceModel,
      ...params,
    });
  }

  /**
   * Get correction requests (with filters)
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async getCorrectionRequests(params) {
    this._ensureInitialized();
    const { getCorrectionRequests } = await import('./core/correction-request.manager.js');
    return await getCorrectionRequests({
      AttendanceModel: this._AttendanceModel,
      ...params,
    });
  }

  /**
   * Review correction request (admin)
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async reviewCorrectionRequest(params) {
    this._ensureInitialized();
    const { reviewCorrectionRequest } = await import('./core/correction-request.manager.js');
    return await reviewCorrectionRequest({
      AttendanceModel: this._AttendanceModel,
      ...params,
    });
  }

  /**
   * Apply approved correction request (admin)
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async applyCorrectionRequest(params) {
    this._ensureInitialized();
    const { applyCorrectionRequest } = await import('./core/correction-request.manager.js');
    return await applyCorrectionRequest({
      AttendanceModel: this._AttendanceModel,
      ...params,
    });
  }
}

// Create singleton instance
export const attendanceOrchestrator = new AttendanceOrchestrator();

// Default export (convenience)
export const attendance = attendanceOrchestrator;

export default attendance;

