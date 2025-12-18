/**
 * ClockIn Core
 *
 * @module @classytic/clockin/core
 */

export { Container } from './container.js';
export { EventBus, createEventBus, type ClockInEventMap, type ClockInEventType } from './events.js';
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
