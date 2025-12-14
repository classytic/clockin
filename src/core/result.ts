/**
 * ClockIn Result Type
 *
 * Rust-inspired Result<T, E> for explicit error handling
 * No more try/catch spaghetti - errors as values
 *
 * @module @classytic/clockin/core/result
 */

// ============================================================================
// TYPES
// ============================================================================

/** Success variant */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
  readonly error?: never;
}

/** Error variant */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
  readonly value?: never;
}

/** Result type - either Ok or Err */
export type Result<T, E = Error> = Ok<T> | Err<E>;

// ============================================================================
// CONSTRUCTORS
// ============================================================================

/**
 * Create a successful result
 *
 * @example
 * ```typescript
 * const result = ok({ checkIn, stats });
 * ```
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Create an error result
 *
 * @example
 * ```typescript
 * const result = err(new MemberNotFoundError());
 * ```
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/**
 * Check if result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

// ============================================================================
// UNWRAP FUNCTIONS
// ============================================================================

/**
 * Unwrap a result, throwing if Err
 *
 * @throws The error if result is Err
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwrap with a default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return isOk(result) ? result.value : defaultValue;
}

/**
 * Unwrap with a default factory
 */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
  return isOk(result) ? result.value : fn(result.error);
}

// ============================================================================
// TRANSFORMATIONS
// ============================================================================

/**
 * Map over the Ok value
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return isOk(result) ? ok(fn(result.value)) : result;
}

/**
 * Map over the Err value
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return isErr(result) ? err(fn(result.error)) : result;
}

/**
 * Chain results (flatMap)
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  return isOk(result) ? fn(result.value) : result;
}

// ============================================================================
// ASYNC UTILITIES
// ============================================================================

/**
 * Wrap an async function in Result
 *
 * @example
 * ```typescript
 * const result = await tryCatch(() => fetchMember(id));
 * if (isOk(result)) {
 *   console.log(result.value);
 * }
 * ```
 */
export async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Synchronous version of tryCatch
 */
export function tryCatchSync<T>(fn: () => T): Result<T, Error> {
  try {
    return ok(fn());
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

// ============================================================================
// COMBINATORS
// ============================================================================

/**
 * Combine multiple results into one
 * Returns first error or array of all values
 */
export function all<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    values.push(result.value);
  }

  return ok(values);
}

/**
 * Pattern match on a result
 *
 * @example
 * ```typescript
 * const message = match(result, {
 *   ok: (value) => `Success: ${value.id}`,
 *   err: (error) => `Error: ${error.message}`,
 * });
 * ```
 */
export function match<T, E, U>(
  result: Result<T, E>,
  handlers: {
    ok: (value: T) => U;
    err: (error: E) => U;
  }
): U {
  return isOk(result) ? handlers.ok(result.value) : handlers.err(result.error);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export const Result = {
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
};

export default Result;

