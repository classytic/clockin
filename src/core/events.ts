/**
 * ClockIn Event System
 *
 * Type-safe event bus for attendance operations
 * Inspired by Revenue library's event architecture
 *
 * @module @classytic/clockin/core/events
 */

import { EventEmitter } from 'events';
import type {
  ObjectId,
  AttendanceStats,
  EngagementLevel,
  CheckInMethod,
  OperationContext,
} from '../types.js';

// ============================================================================
// EVENT TYPES
// ============================================================================

/** Base event interface */
export interface BaseEvent {
  /** Event timestamp */
  timestamp: Date;
  /** Request ID for tracing */
  requestId?: string;
}

/** Member info in events */
export interface EventMemberInfo {
  id: ObjectId;
  name?: string;
}

/** Check-in recorded event */
export interface CheckInRecordedEvent extends BaseEvent {
  type: 'checkIn:recorded';
  data: {
    checkIn: {
      id: ObjectId;
      timestamp: Date;
      method: CheckInMethod;
    };
    member: EventMemberInfo;
    targetModel: string;
    stats: {
      totalVisits: number;
      currentStreak: number;
      engagementLevel: EngagementLevel;
    };
    context?: OperationContext;
  };
}

/** Check-in failed event */
export interface CheckInFailedEvent extends BaseEvent {
  type: 'checkIn:failed';
  data: {
    member?: EventMemberInfo;
    targetModel: string;
    error: {
      code: string;
      message: string;
    };
    context?: OperationContext;
  };
}

/** Check-out recorded event */
export interface CheckOutRecordedEvent extends BaseEvent {
  type: 'checkOut:recorded';
  data: {
    checkIn: {
      id: ObjectId;
      checkInTime: Date;
      checkOutTime: Date;
    };
    member: EventMemberInfo;
    targetModel: string;
    duration: number;
    context?: OperationContext;
  };
}

/** Milestone achieved event */
export interface MilestoneAchievedEvent extends BaseEvent {
  type: 'milestone:achieved';
  data: {
    member: EventMemberInfo;
    milestone: {
      type: 'visits' | 'streak';
      value: number;
      message: string;
    };
    stats: AttendanceStats;
  };
}

/** Engagement changed event */
export interface EngagementChangedEvent extends BaseEvent {
  type: 'engagement:changed';
  data: {
    member: EventMemberInfo;
    engagement: {
      from: EngagementLevel;
      to: EngagementLevel;
    };
    stats: AttendanceStats;
  };
}

/** Stats updated event */
export interface StatsUpdatedEvent extends BaseEvent {
  type: 'stats:updated';
  data: {
    member: EventMemberInfo;
    stats: AttendanceStats;
  };
}

/** Member at-risk event */
export interface MemberAtRiskEvent extends BaseEvent {
  type: 'member:atRisk';
  data: {
    member: EventMemberInfo;
    stats: AttendanceStats;
    daysSinceLastVisit: number;
  };
}

/** Session expired event */
export interface SessionExpiredEvent extends BaseEvent {
  type: 'session:expired';
  data: {
    member: EventMemberInfo;
    checkInId: ObjectId;
    checkInTime: Date;
    autoCheckedOut: boolean;
  };
}

/** All event types */
export type ClockInEventPayload =
  | CheckInRecordedEvent
  | CheckInFailedEvent
  | CheckOutRecordedEvent
  | MilestoneAchievedEvent
  | EngagementChangedEvent
  | StatsUpdatedEvent
  | MemberAtRiskEvent
  | SessionExpiredEvent;

/** Event type names */
export type ClockInEventType = ClockInEventPayload['type'];

/** Event map for type-safe listeners */
export interface ClockInEventMap {
  'checkIn:recorded': CheckInRecordedEvent;
  'checkIn:failed': CheckInFailedEvent;
  'checkOut:recorded': CheckOutRecordedEvent;
  'milestone:achieved': MilestoneAchievedEvent;
  'engagement:changed': EngagementChangedEvent;
  'stats:updated': StatsUpdatedEvent;
  'member:atRisk': MemberAtRiskEvent;
  'session:expired': SessionExpiredEvent;
}

// ============================================================================
// EVENT BUS
// ============================================================================

/**
 * Type-safe Event Bus
 *
 * @example
 * ```typescript
 * const events = createEventBus();
 *
 * events.on('checkIn:recorded', (event) => {
 *   console.log(`${event.data.member.name} checked in!`);
 * });
 *
 * events.on('milestone:achieved', (event) => {
 *   sendNotification(event.data.member, event.data.milestone.message);
 * });
 * ```
 */
export class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  /**
   * Subscribe to an event
   */
  on<E extends ClockInEventType>(
    event: E,
    handler: (payload: ClockInEventMap[E]) => void | Promise<void>
  ): this {
    this.emitter.on(event, handler);
    return this;
  }

  /**
   * Subscribe once
   */
  once<E extends ClockInEventType>(
    event: E,
    handler: (payload: ClockInEventMap[E]) => void | Promise<void>
  ): this {
    this.emitter.once(event, handler);
    return this;
  }

  /**
   * Unsubscribe from an event
   */
  off<E extends ClockInEventType>(
    event: E,
    handler: (payload: ClockInEventMap[E]) => void | Promise<void>
  ): this {
    this.emitter.off(event, handler);
    return this;
  }

  /**
   * Emit an event
   */
  emit<E extends ClockInEventType>(event: E, payload: Omit<ClockInEventMap[E], 'timestamp'>): void {
    const fullPayload = {
      ...payload,
      timestamp: new Date(),
    };
    this.emitter.emit(event, fullPayload);
  }

  /**
   * Remove all listeners
   */
  clear(): void {
    this.emitter.removeAllListeners();
  }

  /**
   * Get listener count for an event
   */
  listenerCount(event: ClockInEventType): number {
    return this.emitter.listenerCount(event);
  }
}

/**
 * Create a new event bus instance
 */
export function createEventBus(): EventBus {
  return new EventBus();
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default EventBus;

