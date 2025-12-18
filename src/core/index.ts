/**
 * ClockIn Core
 *
 * @module @classytic/clockin/core
 */

export { Container } from './container.js';
export {
  EventBus,
  createEventBus,
  type BaseEvent,
  type EventMemberInfo,
  type CheckInRecordedEvent,
  type CheckInFailedEvent,
  type CheckOutRecordedEvent,
  type CheckOutFailedEvent,
  type MilestoneAchievedEvent,
  type EngagementChangedEvent,
  type StatsUpdatedEvent,
  type MemberAtRiskEvent,
  type MemberInactiveEvent,
  type SessionExpiredEvent,
  type ClockInEventPayload,
  type ClockInEventMap,
  type ClockInEventType,
} from './events.js';
export {
  Result,
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  map,
  mapErr,
  flatMap,
  tryCatch,
  tryCatchSync,
  all,
  match,
  type Ok,
  type Err,
} from './result.js';
export {
  PluginManager,
  definePlugin,
  loggingPlugin,
  metricsPlugin,
  notificationPlugin,
  type ClockInPlugin,
  type PluginContext,
  type PluginLogger,
  type PluginHooks,
  type BeforeCheckInHookData,
  type BeforeCheckOutHookData,
  type CheckInHookData,
  type CheckOutHookData,
  type MilestoneHookData,
  type EngagementHookData,
} from './plugin.js';
export {
  withTransaction,
  withTransactionRetry,
  hasSession,
  extractSession,
  type TransactionOptions,
} from './transaction.js';
export {
  DefaultMemberResolver,
  CompositeResolver,
  createResolver,
  type MemberResolver,
  type DefaultMemberResolverOptions,
} from './resolver.js';
