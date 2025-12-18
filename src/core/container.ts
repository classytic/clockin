/**
 * ClockIn Dependency Injection Container
 *
 * Simple, type-safe DI container for service management.
 * Each ClockIn instance has its own container - no global singletons.
 *
 * @module @classytic/clockin/core/container
 */

import type { Model } from 'mongoose';
import type { EventBus } from './events.js';
import type { PluginManager } from './plugin.js';
import type { Logger, AttendanceRecord, TargetModelConfig, SingleTenantConfig } from '../types.js';

/**
 * Runtime options stored in container
 */
export interface ClockInRuntimeOptions {
  singleTenant?: SingleTenantConfig | null;
  debug?: boolean;
  logger?: Logger;
}

// ============================================================================
// Container Types
// ============================================================================

type Factory<T> = () => T;

/**
 * Well-known container keys for type-safe access
 */
export type WellKnownKeys = {
  AttendanceModel: Model<AttendanceRecord>;
  models: Record<string, Model<unknown>>;
  events: EventBus;
  plugins: PluginManager;
  logger: Logger;
  options: ClockInRuntimeOptions;
  configRegistry: Map<string, TargetModelConfig>;
  allowedTargetModels: Set<string>;
};

// ============================================================================
// Container Class
// ============================================================================

/**
 * Lightweight DI Container with type-safe accessors
 *
 * Each ClockIn instance creates its own container, avoiding global state issues
 * in serverless and multi-app environments.
 *
 * @example
 * ```typescript
 * const container = new Container();
 * container.singleton('logger', myLogger);
 * container.factory('service', () => new MyService(container.get('logger')));
 *
 * // Type-safe access for well-known keys
 * const logger = container.get<Logger>('logger');
 *
 * // Or use typed helper methods
 * const attendanceModel = container.getAttendanceModel();
 * ```
 */
export class Container {
  private singletons = new Map<string, unknown>();
  private factories = new Map<string, Factory<unknown>>();

  /**
   * Register a singleton value
   */
  singleton<T>(key: string, value: T): this {
    this.singletons.set(key, value);
    return this;
  }

  /**
   * Register a factory function (lazy instantiation)
   */
  factory<T>(key: string, factory: Factory<T>): this {
    this.factories.set(key, factory as Factory<unknown>);
    return this;
  }

  /**
   * Get a value from the container
   * @throws Error if key not found
   */
  get<T>(key: string): T {
    // Check singletons first
    if (this.singletons.has(key)) {
      return this.singletons.get(key) as T;
    }

    // Check factories
    if (this.factories.has(key)) {
      const factory = this.factories.get(key)!;
      const instance = factory();
      // Cache the result as singleton
      this.singletons.set(key, instance);
      return instance as T;
    }

    throw new Error(`Container: "${key}" not found. Available: ${this.keys().join(', ')}`);
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.singletons.has(key) || this.factories.has(key);
  }

  /**
   * Get all registered keys
   */
  keys(): string[] {
    return [
      ...new Set([...this.singletons.keys(), ...this.factories.keys()]),
    ];
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.singletons.clear();
    this.factories.clear();
  }

  // ========================================
  // Type-Safe Accessors for Well-Known Keys
  // ========================================

  /**
   * Get the AttendanceModel (strongly typed)
   * @throws Error if not registered
   */
  getAttendanceModel<T extends AttendanceRecord = AttendanceRecord>(): Model<T> {
    return this.get<Model<T>>('AttendanceModel');
  }

  /**
   * Get all registered models
   */
  getModels(): Record<string, Model<unknown>> {
    return this.get<Record<string, Model<unknown>>>('models');
  }

  /**
   * Get logger
   */
  getLogger(): Logger {
    return this.get<Logger>('logger');
  }

  /**
   * Get runtime options
   */
  getOptions(): ClockInRuntimeOptions {
    return this.get<ClockInRuntimeOptions>('options');
  }

  /**
   * Get config registry
   */
  getConfigRegistry(): Map<string, TargetModelConfig> {
    return this.get<Map<string, TargetModelConfig>>('configRegistry');
  }

  /**
   * Get allowed target models
   */
  getAllowedTargetModels(): Set<string> {
    return this.get<Set<string>>('allowedTargetModels');
  }

  /**
   * Check if single-tenant mode is enabled
   */
  isSingleTenant(): boolean {
    if (!this.has('options')) return false;
    const options = this.getOptions();
    return !!options.singleTenant;
  }

  /**
   * Get organization ID for single-tenant mode
   */
  getOrganizationId(): string | null {
    if (!this.has('options')) return null;
    const options = this.getOptions();
    if (!options.singleTenant?.organizationId) return null;
    return typeof options.singleTenant.organizationId === 'string'
      ? options.singleTenant.organizationId
      : options.singleTenant.organizationId.toString();
  }
}

export default Container;
