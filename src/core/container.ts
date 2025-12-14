/**
 * ClockIn Dependency Injection Container
 *
 * Simple, type-safe DI container for service management
 * Inspired by Revenue library's Container pattern
 *
 * @module @classytic/clockin/core/container
 */

type Factory<T> = () => T;

/**
 * Lightweight DI Container
 *
 * @example
 * ```typescript
 * const container = new Container();
 * container.singleton('logger', myLogger);
 * container.factory('service', () => new MyService(container.get('logger')));
 *
 * const service = container.get<MyService>('service');
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
}

export default Container;

