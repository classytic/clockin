/**
 * 📡 Attendance Events
 * Event emitter for attendance library integrations
 *
 * Enables external systems to react to attendance events:
 * - Notifications (email, SMS, push)
 * - Analytics tracking
 * - Webhooks
 * - Custom business logic
 *
 * Inspired by Stripe's webhook events system
 *
 * @module lib/attendance/events/attendance.events
 */

import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

/**
 * Attendance Event Emitter
 *
 * Events emitted:
 * - 'checkIn:recorded' - When check-in is successfully recorded
 * - 'checkIn:failed' - When check-in fails
 * - 'milestone:achieved' - When member reaches milestone (visits, streak)
 * - 'engagement:changed' - When engagement level changes
 * - 'stats:updated' - When attendance stats are recalculated
 * - 'member:atRisk' - When member becomes at-risk
 * - 'member:inactive' - When member becomes inactive
 *
 * @example
 * import { attendanceEvents } from '#lib/attendance/events';
 *
 * // Listen for milestones
 * attendanceEvents.on('milestone:achieved', ({ member, milestone }) => {
 *   notificationService.send(member, `Congrats! ${milestone.value} visits!`);
 * });
 *
 * // Listen for at-risk members
 * attendanceEvents.on('member:atRisk', ({ member }) => {
 *   retentionSystem.flagMember(member);
 * });
 */
class AttendanceEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Allow many listeners
  }

  /**
   * Emit check-in recorded event
   *
   * @param {Object} data
   * @param {Object} data.checkIn - Check-in document
   * @param {Object} data.member - Member document
   * @param {Object} data.stats - Updated stats
   * @param {Object} data.context - Request context
   */
  emitCheckInRecorded({ checkIn, member, stats, context }) {
    const event = {
      type: 'checkIn:recorded',
      timestamp: new Date(),
      data: {
        checkIn: {
          id: checkIn._id,
          timestamp: checkIn.timestamp,
          method: checkIn.method,
        },
        member: {
          id: member._id,
          name: member.customer?.name || member.name,
        },
        stats: {
          totalVisits: stats.totalVisits,
          currentStreak: stats.currentStreak,
          engagementLevel: stats.engagementLevel,
        },
        context,
      },
    };

    logger.debug('Event: check-in recorded', event.data);
    this.emit('checkIn:recorded', event.data);
  }

  /**
   * Emit check-in failed event
   *
   * @param {Object} data
   * @param {Object} data.member - Member document
   * @param {Error} data.error - Error object
   * @param {Object} data.context - Request context
   */
  emitCheckInFailed({ member, error, context }) {
    const event = {
      type: 'checkIn:failed',
      timestamp: new Date(),
      data: {
        member: {
          id: member?._id,
          name: member?.customer?.name || member?.name,
        },
        error: {
          code: error.code,
          message: error.message,
        },
        context,
      },
    };

    logger.warn('Event: check-in failed', event.data);
    this.emit('checkIn:failed', event.data);
  }

  /**
   * Emit milestone achieved event
   *
   * @param {Object} data
   * @param {Object} data.member - Member document
   * @param {Object} data.milestone - Milestone details
   * @param {Object} data.stats - Current stats
   */
  emitMilestoneAchieved({ member, milestone, stats }) {
    const event = {
      type: 'milestone:achieved',
      timestamp: new Date(),
      data: {
        member: {
          id: member._id,
          name: member.customer?.name || member.name,
        },
        milestone: {
          type: milestone.type, // 'visits' | 'streak'
          value: milestone.value, // 10, 50, 100, etc.
          message: milestone.message,
        },
        stats,
      },
    };

    logger.info('Event: milestone achieved', event.data);
    this.emit('milestone:achieved', event.data);

    // TODO: Trigger notification system when available
    // await notificationService.send({
    //   to: member.customer?.email,
    //   template: 'milestone_achieved',
    //   data: milestone
    // });
  }

  /**
   * Emit engagement changed event
   *
   * @param {Object} data
   * @param {Object} data.member - Member document
   * @param {String} data.from - Previous engagement level
   * @param {String} data.to - New engagement level
   * @param {Object} data.stats - Current stats
   */
  emitEngagementChanged({ member, from, to, stats }) {
    const event = {
      type: 'engagement:changed',
      timestamp: new Date(),
      data: {
        member: {
          id: member._id,
          name: member.customer?.name || member.name,
        },
        engagement: { from, to },
        stats,
      },
    };

    logger.info('Event: engagement changed', event.data);
    this.emit('engagement:changed', event.data);

    // Emit specific engagement events
    if (to === 'at_risk') {
      this.emitMemberAtRisk({ member, stats });
    }

    if (to === 'inactive' || to === 'dormant') {
      this.emitMemberInactive({ member, stats });
    }

    // TODO: Trigger retention workflows when available
    // if (to === 'at_risk') {
    //   await retentionWorkflow.flagMember(member);
    // }
  }

  /**
   * Emit member at-risk event
   *
   * @param {Object} data
   * @param {Object} data.member - Member document
   * @param {Object} data.stats - Current stats
   */
  emitMemberAtRisk({ member, stats }) {
    const event = {
      type: 'member:atRisk',
      timestamp: new Date(),
      data: {
        member: {
          id: member._id,
          name: member.customer?.name || member.name,
        },
        stats,
      },
    };

    logger.warn('Event: member at-risk', event.data);
    this.emit('member:atRisk', event.data);

    // TODO: Trigger re-engagement campaign
    // await campaignService.trigger('re-engagement', member);
  }

  /**
   * Emit member inactive event
   *
   * @param {Object} data
   * @param {Object} data.member - Member document
   * @param {Object} data.stats - Current stats
   */
  emitMemberInactive({ member, stats }) {
    const event = {
      type: 'member:inactive',
      timestamp: new Date(),
      data: {
        member: {
          id: member._id,
          name: member.customer?.name || member.name,
        },
        stats,
      },
    };

    logger.warn('Event: member inactive', event.data);
    this.emit('member:inactive', event.data);
  }

  /**
   * Emit stats updated event
   *
   * @param {Object} data
   * @param {Object} data.member - Member document
   * @param {Object} data.stats - Updated stats
   */
  emitStatsUpdated({ member, stats }) {
    const event = {
      type: 'stats:updated',
      timestamp: new Date(),
      data: {
        member: {
          id: member._id,
        },
        stats,
      },
    };

    logger.debug('Event: stats updated', event.data);
    this.emit('stats:updated', event.data);
  }
}

// Singleton instance
export const attendanceEvents = new AttendanceEventEmitter();

export default attendanceEvents;
