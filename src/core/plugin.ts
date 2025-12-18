/**
 * ClockIn Plugin System
 *
 * Extensible hooks for attendance operations
 * Inspired by Revenue library's plugin architecture
 *
 * @module @classytic/clockin/core/plugin
 */

import type { EventBus } from './events.js';
import type { Container } from './container.js';
import type {
  CheckInResult,
  CheckOutResult,
  AttendanceStats,
  EngagementLevel,
  ObjectId,
} from '../types.js';

// ============================================================================
// PLUGIN TYPES
// ============================================================================

/** Plugin logger interface */
export interface PluginLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

/** Plugin context passed to hooks */
export interface PluginContext {
  /** Event bus for emitting events */
  events: EventBus;
  /** Logger instance */
  logger: PluginLogger;
  /** Get value from container */
  get<T>(key: string): T;
  /** Per-request storage */
  storage: Map<string, unknown>;
  /** Request metadata */
  meta: {
    requestId: string;
    timestamp: Date;
  };
}

export interface BeforeCheckInHookData {
  memberId: ObjectId;
  targetModel: string;
}

export interface BeforeCheckOutHookData {
  memberId: ObjectId;
  checkInId: ObjectId;
}

/** Check-in data for plugin hooks */
export interface CheckInHookData {
  memberId: ObjectId;
  memberName?: string;
  targetModel: string;
  checkInId: ObjectId;
  timestamp: Date;
  method: string;
  stats: AttendanceStats;
}

/** Check-out data for plugin hooks */
export interface CheckOutHookData {
  memberId: ObjectId;
  memberName?: string;
  targetModel: string;
  checkInId: ObjectId;
  duration: number;
  timestamp: Date;
}

/** Milestone data for plugin hooks */
export interface MilestoneHookData {
  memberId: ObjectId;
  memberName?: string;
  type: 'visits' | 'streak';
  value: number;
  message: string;
  stats: AttendanceStats;
}

/** Engagement change data for plugin hooks */
export interface EngagementHookData {
  memberId: ObjectId;
  memberName?: string;
  from: EngagementLevel;
  to: EngagementLevel;
  stats: AttendanceStats;
}

/** Plugin hooks interface */
export interface PluginHooks {
  /** Called when ClockIn is initialized */
  onInit?(ctx: PluginContext): void | Promise<void>;
  /** Called before check-in */
  beforeCheckIn?(ctx: PluginContext, data: BeforeCheckInHookData): void | Promise<void>;
  /** Called after successful check-in */
  afterCheckIn?(ctx: PluginContext, data: CheckInHookData): void | Promise<void>;
  /** Called before check-out */
  beforeCheckOut?(ctx: PluginContext, data: BeforeCheckOutHookData): void | Promise<void>;
  /** Called after successful check-out */
  afterCheckOut?(ctx: PluginContext, data: CheckOutHookData): void | Promise<void>;
  /** Called when milestone is achieved */
  onMilestone?(ctx: PluginContext, data: MilestoneHookData): void | Promise<void>;
  /** Called when engagement level changes */
  onEngagementChange?(ctx: PluginContext, data: EngagementHookData): void | Promise<void>;
  /** Called when ClockIn is destroyed */
  onDestroy?(ctx: PluginContext): void | Promise<void>;
}

/** Plugin definition */
export interface ClockInPlugin extends PluginHooks {
  /** Unique plugin name */
  name: string;
  /** Plugin version */
  version?: string;
}

type HookDataMap = {
  beforeCheckIn: BeforeCheckInHookData;
  afterCheckIn: CheckInHookData;
  beforeCheckOut: BeforeCheckOutHookData;
  afterCheckOut: CheckOutHookData;
  onMilestone: MilestoneHookData;
  onEngagementChange: EngagementHookData;
};

type HookWithDataKey = keyof HookDataMap;

// ============================================================================
// PLUGIN MANAGER
// ============================================================================

/**
 * Plugin Manager
 *
 * Manages plugin lifecycle and hook execution
 */
export class PluginManager {
  private plugins: ClockInPlugin[] = [];
  private initialized = false;

  /**
   * Register a plugin
   */
  register(plugin: ClockInPlugin): this {
    if (this.plugins.some((p) => p.name === plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" already registered`);
    }
    this.plugins.push(plugin);
    return this;
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): readonly ClockInPlugin[] {
    return this.plugins;
  }

  /**
   * Initialize all plugins
   */
  async init(ctx: PluginContext): Promise<void> {
    if (this.initialized) return;

    for (const plugin of this.plugins) {
      if (plugin.onInit) {
        await plugin.onInit(ctx);
        ctx.logger.debug(`Plugin initialized: ${plugin.name}`);
      }
    }

    this.initialized = true;
  }

  /**
   * Run a hook on all plugins
   */
  async runHook<K extends HookWithDataKey>(
    hook: K,
    ctx: PluginContext,
    data: HookDataMap[K]
  ): Promise<void> {
    for (const plugin of this.plugins) {
      const hookFn = plugin[hook] as
        | ((ctx: PluginContext, data: HookDataMap[K]) => void | Promise<void>)
        | undefined;
      if (hookFn) {
        try {
          await hookFn(ctx, data);
        } catch (error) {
          const err = error as Error;
          ctx.logger.error(`Plugin "${plugin.name}" hook "${hook}" failed`, {
            error: err.message,
            stack: err.stack,
          });
        }
      }
    }
  }

  /**
   * Destroy all plugins
   */
  async destroy(ctx: PluginContext): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.onDestroy) {
        await plugin.onDestroy(ctx);
      }
    }
    this.plugins = [];
    this.initialized = false;
  }
}

// ============================================================================
// BUILT-IN PLUGINS
// ============================================================================

/**
 * Create a plugin with type safety
 */
export function definePlugin(plugin: ClockInPlugin): ClockInPlugin {
  return plugin;
}

/**
 * Logging plugin - logs all attendance operations
 */
export function loggingPlugin(options: { level?: 'debug' | 'info' } = {}): ClockInPlugin {
  const level = options.level ?? 'info';

  return definePlugin({
    name: 'clockin:logging',
    version: '1.0.0',

    afterCheckIn(ctx, data) {
      const log = level === 'debug' ? ctx.logger.debug : ctx.logger.info;
      log.call(ctx.logger, 'Check-in recorded', {
        memberId: data.memberId,
        method: data.method,
        totalVisits: data.stats.totalVisits,
      });
    },

    afterCheckOut(ctx, data) {
      const log = level === 'debug' ? ctx.logger.debug : ctx.logger.info;
      log.call(ctx.logger, 'Check-out recorded', {
        memberId: data.memberId,
        duration: data.duration,
      });
    },

    onMilestone(ctx, data) {
      ctx.logger.info(`🎉 Milestone achieved: ${data.message}`, {
        memberId: data.memberId,
        type: data.type,
        value: data.value,
      });
    },

    onEngagementChange(ctx, data) {
      ctx.logger.info('Engagement level changed', {
        memberId: data.memberId,
        from: data.from,
        to: data.to,
      });
    },
  });
}

/**
 * Metrics plugin - tracks attendance metrics
 */
export function metricsPlugin(options: {
  onMetric: (metric: { name: string; value: number; tags: Record<string, string> }) => void;
}): ClockInPlugin {
  return definePlugin({
    name: 'clockin:metrics',
    version: '1.0.0',

    afterCheckIn(ctx, data) {
      options.onMetric({
        name: 'clockin.checkin.count',
        value: 1,
        tags: {
          targetModel: data.targetModel,
          method: data.method,
        },
      });
    },

    afterCheckOut(ctx, data) {
      options.onMetric({
        name: 'clockin.checkout.count',
        value: 1,
        tags: { targetModel: data.targetModel },
      });

      options.onMetric({
        name: 'clockin.session.duration',
        value: data.duration,
        tags: { targetModel: data.targetModel },
      });
    },
  });
}

/**
 * Notification plugin - sends notifications on events
 */
export function notificationPlugin(options: {
  onMilestone?: (data: MilestoneHookData) => void | Promise<void>;
  onEngagementChange?: (data: EngagementHookData) => void | Promise<void>;
  onAtRisk?: (data: EngagementHookData) => void | Promise<void>;
}): ClockInPlugin {
  return definePlugin({
    name: 'clockin:notifications',
    version: '1.0.0',

    async onMilestone(ctx, data) {
      if (options.onMilestone) {
        await options.onMilestone(data);
      }
    },

    async onEngagementChange(ctx, data) {
      if (options.onEngagementChange) {
        await options.onEngagementChange(data);
      }

      // Special handling for at-risk members
      if (data.to === 'at_risk' && options.onAtRisk) {
        await options.onAtRisk(data);
      }
    },
  });
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  PluginManager,
  definePlugin,
  loggingPlugin,
  metricsPlugin,
  notificationPlugin,
};

