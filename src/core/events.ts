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

/** Check-out failed event */
export interface CheckOutFailedEvent extends BaseEvent {
  type: 'checkOut:failed';
  data: {
    member?: EventMemberInfo;
    targetModel: string;
    checkInId?: ObjectId;
    error: {
      code: string;
      message: string;
    };
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

/** Member inactive event */
export interface MemberInactiveEvent extends BaseEvent {
  type: 'member:inactive';
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
  | CheckOutFailedEvent
  | MilestoneAchievedEvent
  | EngagementChangedEvent
  | StatsUpdatedEvent
  | MemberAtRiskEvent
  | MemberInactiveEvent
  | SessionExpiredEvent;

/** Event type names */
export type ClockInEventType = ClockInEventPayload['type'];

/** Event map for type-safe listeners */
export interface ClockInEventMap {
  'checkIn:recorded': CheckInRecordedEvent;
  'checkIn:failed': CheckInFailedEvent;
  'checkOut:recorded': CheckOutRecordedEvent;
  'checkOut:failed': CheckOutFailedEvent;
  'milestone:achieved': MilestoneAchievedEvent;
  'engagement:changed': EngagementChangedEvent;
  'stats:updated': StatsUpdatedEvent;
  'member:atRisk': MemberAtRiskEvent;
  'member:inactive': MemberInactiveEvent;
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
/** Unsubscribe function returned by on/once */
export type Unsubscribe = () => void;

export class EventBus {
  private emitter = new EventEmitter();
  private _isDestroyed = false;

  constructor(maxListeners = 100) {
    this.emitter.setMaxListeners(maxListeners);
  }

  /**
   * Check if the event bus has been destroyed
   */
  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  /**
   * Subscribe to an event.
   * Returns an unsubscribe function for cleanup.
   *
   * @example
   * ```typescript
   * const unsubscribe = events.on('checkIn:recorded', handler);
   * // Later, to clean up:
   * unsubscribe();
   * ```
   */
  on<E extends ClockInEventType>(
    event: E,
    handler: (payload: ClockInEventMap[E]) => void | Promise<void>
  ): Unsubscribe {
    if (this._isDestroyed) {
      console.warn('[EventBus] Attempted to subscribe to destroyed event bus');
      return () => {}; // Return no-op unsubscribe
    }
    this.emitter.on(event, handler);
    return () => this.off(event, handler);
  }

  /**
   * Subscribe once (auto-unsubscribes after first event).
   * Returns an unsubscribe function for cleanup before event fires.
   */
  once<E extends ClockInEventType>(
    event: E,
    handler: (payload: ClockInEventMap[E]) => void | Promise<void>
  ): Unsubscribe {
    if (this._isDestroyed) {
      console.warn('[EventBus] Attempted to subscribe to destroyed event bus');
      return () => {};
    }
    this.emitter.once(event, handler);
    return () => this.emitter.off(event, handler);
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
    if (this._isDestroyed) {
      console.warn('[EventBus] Attempted to emit on destroyed event bus');
      return;
    }
    const fullPayload = {
      ...payload,
      timestamp: new Date(),
    };
    this.emitter.emit(event, fullPayload);
  }

  /**
   * Remove all listeners and mark as destroyed.
   * After calling this, new subscriptions will be no-ops.
   */
  clear(): void {
    this.emitter.removeAllListeners();
  }

  /**
   * Destroy the event bus and prevent further use.
   * This should be called when the ClockIn instance is destroyed.
   */
  destroy(): void {
    this.clear();
    this._isDestroyed = true;
  }

  /**
   * Get listener count for an event
   */
  listenerCount(event: ClockInEventType): number {
    return this.emitter.listenerCount(event);
  }

  /**
   * Get total listener count across all events
   */
  totalListenerCount(): number {
    return this.emitter.eventNames().reduce((total, event) => {
      return total + this.emitter.listenerCount(event);
    }, 0);
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

