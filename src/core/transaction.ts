/**
 * Transaction Helper
 *
 * Provides utilities for MongoDB transactions following Stripe/AWS patterns.
 * Matches the explicit session passing approach used in @classytic/payroll.
 *
 * @module @classytic/clockin/core/transaction
 */

import type { ClientSession, Connection } from 'mongoose';

/**
 * Transaction options
 */
export interface TransactionOptions {
  /** Read concern level */
  readConcern?: 'local' | 'majority' | 'snapshot';
  /** Write concern */
  writeConcern?: { w: 'majority' | number; j?: boolean };
  /** Read preference */
  readPreference?: 'primary' | 'primaryPreferred' | 'secondary' | 'secondaryPreferred' | 'nearest';
  /** Max commit time in ms */
  maxCommitTimeMS?: number;
}

/**
 * Execute a function within a MongoDB transaction.
 *
 * This is a convenience helper - users can also manage sessions manually
 * by passing `context.session` to operations.
 *
 * @example
 * ```typescript
 * import { withTransaction } from '@classytic/clockin';
 *
 * const result = await withTransaction(mongoose.connection, async (session) => {
 *   const checkInResult = await clockin.checkIn.record({
 *     member,
 *     targetModel: 'Membership',
 *     context: { organizationId, session },
 *   });
 *
 *   // Both operations are atomic
 *   await SomeOtherModel.create([{ ... }], { session });
 *
 *   return checkInResult;
 * });
 * ```
 */
export async function withTransaction<T>(
  connection: Connection,
  fn: (session: ClientSession) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  const session = await connection.startSession();

  try {
    session.startTransaction({
      readConcern: options?.readConcern ? { level: options.readConcern } : undefined,
      writeConcern: options?.writeConcern,
      readPreference: options?.readPreference,
      maxCommitTimeMS: options?.maxCommitTimeMS,
    });

    const result = await fn(session);

    await session.commitTransaction();
    return result;
  } catch (error) {
    // Only abort if transaction is still in progress
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

/**
 * Execute a function with retry logic for transient transaction errors.
 *
 * MongoDB transactions can fail due to transient errors (e.g., write conflicts).
 * This helper automatically retries the entire transaction in such cases.
 *
 * @example
 * ```typescript
 * const result = await withTransactionRetry(
 *   mongoose.connection,
 *   async (session) => {
 *     // Your transactional operations
 *   },
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function withTransactionRetry<T>(
  connection: Connection,
  fn: (session: ClientSession) => Promise<T>,
  options?: TransactionOptions & { maxRetries?: number }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withTransaction(connection, fn, options);
    } catch (error) {
      lastError = error as Error;

      // Check if this is a retryable error
      const isRetryable =
        (error as { errorLabels?: string[] }).errorLabels?.includes('TransientTransactionError') ||
        (error as { code?: number }).code === 112; // WriteConflict

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 100ms, 200ms, 400ms, etc.
      const backoffMs = Math.min(100 * Math.pow(2, attempt - 1), 1000);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError || new Error('Transaction failed after max retries');
}

/**
 * Type guard to check if an object has a session property
 */
export function hasSession(
  obj: unknown
): obj is { session: ClientSession } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'session' in obj &&
    (obj as { session: unknown }).session != null
  );
}

/**
 * Extract session from various input formats (context, options, etc.)
 */
export function extractSession(
  input?: { session?: ClientSession } | null
): ClientSession | undefined {
  return input?.session ?? undefined;
}
