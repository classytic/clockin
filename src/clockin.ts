/**
 * ClockIn - Modern Attendance Management
 * @classytic/clockin
 *
 * @example
 * ```typescript
 * const clockin = await ClockIn
 *   .create()
 *   .withModels({ Attendance, Membership })
 *   .withPlugin(loggingPlugin())
 *   .build();
 *
 * const result = await clockin.checkIn.record({ member, targetModel: 'Membership' });
 * ```
 */

import mongoose from 'mongoose';
import { Container } from './core/container.js';
import { EventBus, createEventBus } from './core/events.js';
import { PluginManager, type ClockInPlugin, type PluginContext } from './core/plugin.js';
import { CheckInService } from './services/checkin.service.js';
import { CheckOutService } from './services/checkout.service.js';
import { AnalyticsService } from './services/analytics.service.js';
import { CorrectionRequestService } from './services/corrections.service.js';
import { generateDefaultConfig, deepMerge } from './config.js';
import { ValidationError } from './errors/index.js';
import { setLogger } from './utils/logger.js';
import {
  DefaultMemberResolver,
  type MemberResolver,
  type DefaultMemberResolverOptions,
} from './core/resolver.js';
import type { Logger, ObjectIdLike, DeepPartial, TargetModelConfig } from './types.js';

// ============================================================================
// TYPES
// ============================================================================

/** Models configuration */
export interface ModelsConfig {
  Attendance: mongoose.Model<any>;
  [targetModel: string]: mongoose.Model<any>;
}

/** Single-tenant configuration */
export interface SingleTenantConfig {
  organizationId?: ObjectIdLike;
  autoInject?: boolean;
}

/** ClockIn options */
export interface ClockInOptions {
  debug?: boolean;
  logger?: Logger;
  singleTenant?: SingleTenantConfig;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_TENANT_ID = new mongoose.Types.ObjectId('000000000000000000000001');

// ============================================================================
// CLOCKIN CLASS
// ============================================================================

export class ClockIn {
  private readonly _container: Container;
  private readonly _events: EventBus;
  private readonly _plugins: PluginManager;
  private readonly _logger: Logger;
  private readonly _singleTenant?: SingleTenantConfig;

  public readonly checkIn: CheckInService;
  public readonly checkOut: CheckOutService;
  public readonly analytics: AnalyticsService;
  public readonly corrections: CorrectionRequestService;

  private constructor(
    container: Container,
    events: EventBus,
    plugins: PluginManager,
    logger: Logger,
    singleTenant?: SingleTenantConfig
  ) {
    this._container = container;
    this._events = events;
    this._plugins = plugins;
    this._logger = logger;
    this._singleTenant = singleTenant;

    // Register in container
    container.singleton('events', events);
    container.singleton('plugins', plugins);
    container.singleton('logger', logger);
    container.singleton('options', { singleTenant, debug: false, logger });

    // Initialize services
    this.checkIn = new CheckInService(container);
    this.checkOut = new CheckOutService(container);
    this.analytics = new AnalyticsService(container);
    this.corrections = new CorrectionRequestService(container);
  }

  // ============ STATIC ============

  static create(options: ClockInOptions = {}): ClockInBuilder {
    return new ClockInBuilder(options);
  }

  /** @internal */
  static _build(
    container: Container,
    events: EventBus,
    plugins: PluginManager,
    logger: Logger,
    singleTenant?: SingleTenantConfig
  ): ClockIn {
    return new ClockIn(container, events, plugins, logger, singleTenant);
  }

  // ============ ACCESSORS ============

  get container(): Container {
    return this._container;
  }

  get events(): EventBus {
    return this._events;
  }

  get plugins(): PluginManager {
    return this._plugins;
  }

  get isSingleTenant(): boolean {
    return !!this._singleTenant;
  }

  get singleTenantOrgId(): ObjectIdLike | undefined {
    return this._singleTenant?.organizationId;
  }

  // ============ EVENTS ============

  on: EventBus['on'] = (event, handler) => this._events.on(event, handler);
  once: EventBus['once'] = (event, handler) => this._events.once(event, handler);
  off: EventBus['off'] = (event, handler) => this._events.off(event, handler);

  // ============ HELPERS ============

  createContext(): PluginContext {
    return {
      events: this._events,
      logger: this._logger,
      get: <T>(key: string) => this._container.get<T>(key),
      storage: new Map(),
      meta: {
        requestId: Math.random().toString(36).substring(7),
        timestamp: new Date(),
      },
    };
  }

  async destroy(): Promise<void> {
    await this._plugins.destroy(this.createContext());
    // Properly destroy event bus (prevents memory leaks from lingering listeners)
    this._events.destroy();
    this._container.clear();
  }
}

// ============================================================================
// BUILDER
// ============================================================================

export class ClockInBuilder {
  private _options: ClockInOptions;
  private _models: ModelsConfig | null = null;
  private _plugins: ClockInPlugin[] = [];
  private _targetConfigs = new Map<string, DeepPartial<TargetModelConfig>>();
  private _allowedTargetModels: string[] | undefined = undefined;
  private _memberResolver: MemberResolver | null = null;
  private _identifierFields: string[] | undefined = undefined;
  private _pluginFailFast = false;

  constructor(options: ClockInOptions = {}) {
    this._options = options;
  }

  withModels(models: ModelsConfig): this {
    this._models = models;
    return this;
  }

  /**
   * Configure a target model with custom settings.
   *
   * Use this to register custom target models or override settings for built-in models.
   *
   * @example
   * ```typescript
   * ClockIn.create()
   *   .withModels({ Attendance, Event })
   *   .withTargetModel('Event', {
   *     detection: { type: 'time-based' },
   *     autoCheckout: { enabled: true, afterHours: 4 }
   *   })
   *   .build();
   * ```
   */
  withTargetModel(name: string, config: DeepPartial<TargetModelConfig>): this {
    this._targetConfigs.set(name, config);
    return this;
  }

  /**
   * Alias for withTargetModel - register a custom target model with configuration.
   *
   * @example
   * ```typescript
   * ClockIn.create()
   *   .withModels({ Attendance, Workshop })
   *   .registerTargetModel('Workshop', {
   *     detection: { type: 'time-based' },
   *     autoCheckout: { enabled: true, afterHours: 2 }
   *   })
   *   .build();
   * ```
   */
  registerTargetModel(name: string, config: DeepPartial<TargetModelConfig> = {}): this {
    return this.withTargetModel(name, config);
  }

  /**
   * Allow any target model (default behavior).
   *
   * This explicitly enables the default v2.0 behavior where any non-empty string
   * is accepted as a target model. Use this for clarity when you want to support
   * custom target models without restrictions.
   *
   * @example
   * ```typescript
   * ClockIn.create()
   *   .withModels({ Attendance, Event, Workshop, Membership })
   *   .allowAnyTargetModel()
   *   .build();
   * ```
   */
  allowAnyTargetModel(): this {
    this._allowedTargetModels = undefined;
    return this;
  }

  /**
   * Restrict target models to a specific allowlist.
   *
   * When configured, only the specified target models will be accepted.
   * Use this for stricter validation when you know exactly which models
   * should be supported.
   *
   * @example
   * ```typescript
   * ClockIn.create()
   *   .withModels({ Attendance, Membership, Employee })
   *   .restrictTargetModels(['Membership', 'Employee'])
   *   .build();
   * ```
   */
  restrictTargetModels(models: string[]): this {
    this._allowedTargetModels = models;
    return this;
  }

  /**
   * Set a custom member resolver for bulk operations.
   *
   * The resolver determines how members are looked up by identifier
   * in bulk check-in operations. Use this to implement custom lookup
   * strategies (e.g., by membership code, employee ID, etc.).
   *
   * @example
   * ```typescript
   * // Custom resolver that looks up by membership code
   * const models = { Attendance, Membership };
   *
   * const customResolver: MemberResolver = {
   *   async resolve(identifier, targetModel, context) {
   *     const Model = models[targetModel];
   *     return Model.findOne({
   *       organizationId: context.organizationId,
   *       membershipCode: identifier,
   *     });
   *   },
   * };
   *
   * ClockIn.create()
   *   .withModels(models)
   *   .withMemberResolver(customResolver)
   *   .build();
   * ```
   */
  withMemberResolver(resolver: MemberResolver): this {
    this._memberResolver = resolver;
    return this;
  }

  /**
   * Configure the default member resolver with custom identifier fields.
   *
   * The default resolver tries each field in order until a member is found.
   * Use this to customize which fields are searched for member lookup.
   *
   * @example
   * ```typescript
   * ClockIn.create()
   *   .withModels({ Attendance, Membership })
   *   .withIdentifierFields(['membershipCode', 'email', 'customer.email'])
   *   .build();
   * ```
   */
  withIdentifierFields(fields: string[]): this {
    this._identifierFields = fields;
    return this;
  }

  withPlugin(plugin: ClockInPlugin): this {
    this._plugins.push(plugin);
    return this;
  }

  withPlugins(plugins: ClockInPlugin[]): this {
    this._plugins.push(...plugins);
    return this;
  }

  /**
   * Enable fail-fast mode for plugins.
   * When enabled, the first plugin hook failure will throw an error
   * instead of logging and continuing.
   *
   * @param enabled - Whether to enable fail-fast mode (default: true)
   */
  withPluginFailFast(enabled = true): this {
    this._pluginFailFast = enabled;
    return this;
  }

  withLogger(logger: Logger): this {
    this._options.logger = logger;
    setLogger(logger);
    return this;
  }

  forSingleTenant(config: SingleTenantConfig = {}): this {
    this._options.singleTenant = {
      organizationId: config.organizationId ?? DEFAULT_TENANT_ID,
      autoInject: config.autoInject !== false,
    };
    return this;
  }

  withDebug(enabled = true): this {
    this._options.debug = enabled;
    return this;
  }

  async build(): Promise<ClockIn> {
    if (!this._models) {
      throw new ValidationError('Models are required. Use .withModels({ Attendance, Membership })');
    }
    if (!this._models.Attendance) {
      throw new ValidationError('Attendance model is required in models configuration');
    }

    // Container
    const container = new Container();

    // Logger
    const logger: Logger = this._options.logger || {
      debug: (msg, data) => this._options.debug && console.debug(`[ClockIn] ${msg}`, data ?? ''),
      info: (msg, data) => console.info(`[ClockIn] ${msg}`, data ?? ''),
      warn: (msg, data) => console.warn(`[ClockIn] ${msg}`, data ?? ''),
      error: (msg, data) => console.error(`[ClockIn] ${msg}`, data ?? ''),
    };

    // Register models
    container.singleton('AttendanceModel', this._models.Attendance);
    container.singleton('models', this._models);

    // Per-instance config registry
    const configRegistry = new Map<string, TargetModelConfig>();
    container.singleton('configRegistry', configRegistry);

    for (const [name, config] of this._targetConfigs) {
      const defaults = generateDefaultConfig(name);
      configRegistry.set(name, deepMerge(defaults, config));
    }

    // Target model allowlist (only register if configured)
    if (this._allowedTargetModels !== undefined) {
      container.singleton('allowedTargetModels', this._allowedTargetModels);
    }

    // Member resolver (for bulk operations)
    const memberResolver = this._memberResolver
      || new DefaultMemberResolver(container, {
           identifierFields: this._identifierFields,
         });
    container.singleton('memberResolver', memberResolver);

    // Events
    const events = createEventBus();

    // Plugins
    const pluginManager = new PluginManager({ failFast: this._pluginFailFast });
    for (const plugin of this._plugins) {
      pluginManager.register(plugin);
    }

    // Create instance
    const clockin = ClockIn._build(
      container,
      events,
      pluginManager,
      logger,
      this._options.singleTenant
    );

    // Initialize plugins (awaited)
    await pluginManager.init(clockin.createContext());

    logger.info('ClockIn initialized', {
      models: Object.keys(this._models),
      plugins: this._plugins.map((p) => p.name),
      singleTenant: !!this._options.singleTenant,
    });

    return clockin;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export async function createClockIn(config: {
  models: ModelsConfig;
  options?: ClockInOptions;
  plugins?: ClockInPlugin[];
  targetConfigs?: Record<string, DeepPartial<TargetModelConfig>>;
}): Promise<ClockIn> {
  let builder = ClockIn.create(config.options);
  builder = builder.withModels(config.models);

  if (config.plugins) {
    builder = builder.withPlugins(config.plugins);
  }

  if (config.targetConfigs) {
    for (const [name, cfg] of Object.entries(config.targetConfigs)) {
      builder = builder.withTargetModel(name, cfg);
    }
  }

  return builder.build();
}

export default ClockIn;
